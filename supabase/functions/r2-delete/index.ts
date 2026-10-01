// Supabase Edge Function: issues a short-lived presigned DELETE URL for an R2 object.
//
// Paired with `r2-upload-url`. Verifies the caller can write to the board that
// owns the key before signing, so a user cannot delete another account's files by
// guessing a key.
//
// Deploy:
//   supabase functions deploy r2-delete
// Shares the same Edge Secrets as the upload function.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SERVICE = 's3'
const ALGORITHM = 'AWS4-HMAC-SHA256'
const MAX_EXPIRY = 900

// R2 uses the account-specific host but always signs with region `auto`; the
// account id is not a valid region and is rejected with InvalidRegionName.
const REGION = 'auto'

const enc = new TextEncoder()

const hex = (buf: ArrayBuffer) =>
  [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')

const hmac = async (key: ArrayBuffer | Uint8Array, data: string) => {
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return crypto.subtle.sign('HMAC', cryptoKey, enc.encode(data))
}

const amzDate = (d: Date) => d.toISOString().replace(/[:-]|\.\d{3}/g, '')
const dateStamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
const encodeKey = (key: string) => key.split('/').map(encodeURIComponent).join('/')

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const accountId = Deno.env.get('R2_ACCOUNT_ID')
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID')
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY')
  const bucket = Deno.env.get('R2_BUCKET_NAME')

  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    return json({ error: 'Storage is not configured on the server' }, 503)
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
  const userId = userData.user.id

  let body: { fileKey?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const fileKey = (body.fileKey ?? '').trim()
  if (!fileKey) return json({ error: 'fileKey is required' }, 400)

  // The key is caller-supplied, so it is checked against the authenticated user
  // rather than trusted. Every key this app writes is namespaced by user id.
  const expectedPrefix = `users/${userId}/boards/`
  if (!fileKey.startsWith(expectedPrefix)) {
    return json({ error: 'That file does not belong to you' }, 403)
  }

  const boardId = fileKey.slice(expectedPrefix.length).split('/')[0]

  // RLS is the authority on whether this user can write to that board.
  const { data: board, error: boardErr } = await userClient
    .from('boards')
    .select('id, owner_id')
    .eq('id', boardId)
    .maybeSingle()

  if (boardErr) return json({ error: 'Could not verify board access' }, 403)
  if (!board) return json({ error: 'Board not found or not accessible' }, 403)

  // ── SigV4 presign for DELETE ──────────────────────────────────────────────
  const now = new Date()
  const amz = amzDate(now)
  const stamp = dateStamp(now)
  const expires = Math.min(MAX_EXPIRY, 900)
  const credential = `${accessKeyId}/${stamp}/${REGION}/${SERVICE}/aws4_request`
  const host = `${accountId}.r2.cloudflarestorage.com`
  const signedHeaders = 'host'

  const canonicalQuery = [
    ['X-Amz-Algorithm', ALGORITHM],
    ['X-Amz-Credential', credential],
    ['X-Amz-Date', amz],
    ['X-Amz-Expires', String(expires)],
    ['X-Amz-SignedHeaders', signedHeaders],
  ]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')

  const canonicalRequest = [
    'DELETE',
    `/${bucket}/${encodeKey(fileKey)}`,
    canonicalQuery,
    `host:${host}\n`,
    signedHeaders,
    'UNSIGNED-PAYLOAD',
  ].join('\n')

  const scope = `${stamp}/${REGION}/${SERVICE}/aws4_request`
  const stringToSign = [
    ALGORITHM,
    amz,
    scope,
    hex(await crypto.subtle.digest('SHA-256', enc.encode(canonicalRequest))),
  ].join('\n')

  let key = enc.encode(`AWS4${secretAccessKey}`) as unknown as ArrayBuffer
  for (const part of [stamp, REGION, SERVICE, 'aws4_request']) {
    key = await hmac(key, part)
  }
  const signature = hex(await hmac(key, stringToSign))

  const deleteUrl = `https://${host}/${bucket}/${encodeKey(fileKey)}?${canonicalQuery}&X-Amz-Signature=${signature}`

  return json({ deleteUrl, expiresIn: expires })
})
