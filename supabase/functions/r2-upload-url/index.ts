// Supabase Edge Function: issues a short-lived presigned PUT URL for Cloudflare R2.
//
// The R2 secret key never leaves this function — it lives in Edge Secrets and is
// used only to sign. The client receives a time-limited, single-object URL, which
// is the same trust model as an S3 presigned URL: the holder can write that one
// object for a few minutes, and nothing else.
//
// Deploy:
//   supabase functions deploy r2-upload-url
// Secrets (set with `supabase secrets set`, never in the client bundle):
//   R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SERVICE = 's3'
const ALGORITHM = 'AWS4-HMAC-SHA256'
const MAX_EXPIRY = 900 // 15 minutes is the cap we allow callers to request

// R2 is addressed through the account-specific host, but the SigV4 credential
// scope is always region `auto`. Passing the account id as the region is
// rejected with InvalidRegionName.
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

// Presigned URLs are case sensitive, so normalise the timestamp to the exact
// shape AWS SigV4 requires: YYYYMMDDTHHMMSSZ.
const amzDate = (d: Date) => d.toISOString().replace(/[:-]|\.\d{3}/g, '')
const dateStamp = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')

/** Percent-encode a path segment (R2 keys are literal, so encode each part). */
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

  // ── Authenticate the caller ────────────────────────────────────────────────
  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer ')) return json({ error: 'Unauthorized' }, 401)

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data: userData, error: userErr } = await userClient.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'Unauthorized' }, 401)
  const userId = userData.user.id

  // ── Validate the request ───────────────────────────────────────────────────
  let body: { boardId?: string; fileName?: string; contentType?: string; size?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const boardId = body.boardId
  const fileName = (body.fileName ?? '').trim()
  const contentType = body.contentType ?? 'application/octet-stream'
  const size = Number(body.size ?? 0)

  if (!boardId || !fileName) return json({ error: 'boardId and fileName are required' }, 400)
  if (size <= 0 || size > 25 * 1024 * 1024) {
    return json({ error: 'File must be between 1 byte and 25 MB' }, 400)
  }

  // RLS on `boards` is the authority on ownership, so a caller cannot mint an
  // upload URL for somebody else's board.
  const { data: board, error: boardErr } = await userClient
    .from('boards')
    .select('id, owner_id')
    .eq('id', boardId)
    .maybeSingle()

  if (boardErr) return json({ error: 'Could not verify board access' }, 403)
  if (!board) return json({ error: 'Board not found or not accessible' }, 403)

  // ── Build the key: users/{userId}/boards/{boardId}/{fileId} ───────────────
  const safeExt = (fileName.match(/\.[A-Za-z0-9]{1,8}$/)?.[0] ?? '').toLowerCase()
  const fileId = crypto.randomUUID()
  const objectKey = `users/${userId}/boards/${boardId}/${fileId}${safeExt}`

  // ── SigV4 presign ──────────────────────────────────────────────────────────
  const now = new Date()
  const amz = amzDate(now)
  const stamp = dateStamp(now)
  const expires = Math.min(MAX_EXPIRY, 900)
  const credential = `${accessKeyId}/${stamp}/${REGION}/${SERVICE}/aws4_request`
  const host = `${accountId}.r2.cloudflarestorage.com`

  // Only `host` is signed, so the caller must send that header unchanged.
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
    'PUT',
    `/${bucket}/${encodeKey(objectKey)}`,
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

  const uploadUrl = `https://${host}/${bucket}/${encodeKey(objectKey)}?${canonicalQuery}&X-Amz-Signature=${signature}`

  // The URL stored on the object and handed to the browser as its `src`.
  //
  // It cannot be the S3 API endpoint above: that host rejects unsigned requests,
  // so a plain <img src> against it returns 400 and the image never paints.
  // When the bucket is served publicly (r2.dev dev domain, or a custom domain)
  // that host is supplied as R2_PUBLIC_BASE_URL and used instead. Keys are
  // unguessable UUIDs, so public read does not make objects enumerable.
  const publicBase = Deno.env.get('R2_PUBLIC_BASE_URL')?.replace(/\/+$/, '')
  const publicUrl = publicBase
    ? `${publicBase}/${encodeKey(objectKey)}`
    : `https://${host}/${bucket}/${encodeKey(objectKey)}`

  return json({
    uploadUrl,
    objectKey,
    expiresIn: expires,
    publicUrl,
    // Lets the client and diagnostics tell a served host from a dead endpoint.
    publicUrlIsServable: Boolean(publicBase),
    contentType,
  })
})
