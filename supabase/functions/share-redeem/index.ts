// Supabase Edge Function: redeem a share link.
//
// A share token is a bearer credential, and RLS deliberately stops a recipient
// from inserting their own board_members row — otherwise any signed-in user
// could grant themselves access to any board id they could guess. So redemption
// happens here, with the service role, after validating the token.
//
//   GET  /share-redeem?token=…        landing page + "Open in DigiBoard"
//   POST /share-redeem { token }       redeem (requires a signed-in caller)
//
// Deploy:
//   supabase functions deploy share-redeem
//
// SUPABASE_SERVICE_ROLE_KEY is provisioned automatically for edge functions, so
// there is nothing to set by hand. It is used only in this file, never returned.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const APP_PROTOCOL = 'digiboard'

const enc = new TextEncoder()

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  })
}

/**
 * Redirects to the hosted landing page.
 *
 * This function cannot serve the page itself: Supabase's gateway rewrites any
 * text/html response to text/plain ("HTML content is not supported"), so the
 * browser is shown the source instead of a page, and the missing charset
 * mangles the encoding. Serving a custom domain is the only documented
 * alternative, so the static page lives on the public R2 bucket and is linked to
 * from here. The page carries no board data — only the token, which the app
 * redeems against this function over POST.
 *
 * URLSearchParams handles encoding, so no manual escaping is needed.
 */
function redirectToLanding(
  landingBase: string,
  params: { token?: string; boardName?: string; permission?: string; error?: string },
) {
  const url = new URL(landingBase)
  if (params.token) url.searchParams.set('token', params.token)
  if (params.boardName) url.searchParams.set('name', params.boardName)
  if (params.permission) url.searchParams.set('perm', params.permission)
  if (params.error) url.searchParams.set('err', params.error)
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      'Cache-Control': 'no-store',
    },
  })
}

function landingBase(): string | null {
  return Deno.env.get('SHARE_LANDING_URL') ?? null
}


/**
 * 24 random bytes, base64url. A UUID would be guessable-ish and this is a
 * credential; `crypto.getRandomValues` is the CSPRNG.
 */
function newToken(): string {
  const bytes = new Uint8Array(24)
  crypto.getRandomValues(bytes)
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getUser(req: Request) {
  const header = req.headers.get('Authorization') ?? ''
  if (!header.startsWith('Bearer ')) return null
  const client = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: header } } },
  )
  const { data, error } = await client.auth.getUser()
  return error || !data.user ? null : data.user
}

type LinkRow = {
  id: string
  board_id: string
  permission: string
  is_active: boolean
  expires_at: string | null
  access_count: number
}

/** Validates a token and returns its link, or an error the caller can show. */
async function validateToken(token: string) {
  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  )

  // access_count is selected so redemption can increment it accurately rather
  // than writing a value derived from a field that was never fetched.
  const { data, error } = await admin
    .from('shared_links')
    .select('id, board_id, permission, is_active, expires_at, access_count')
    .eq('token', token)
    .maybeSingle()

  if (error) return { error: 'Could not verify that link' }
  if (!data) return { error: 'That share link does not exist' }
  if (!data.is_active) return { error: 'That share link has been revoked' }
  if (data.expires_at && new Date(data.expires_at).getTime() < Date.now()) {
    return { error: 'That share link has expired' }
  }
  return { admin, link: data as LinkRow }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url)
  const token = (req.method === 'POST'
    ? (await req.json().catch(() => ({}))).token
    : url.searchParams.get('token')) as string | undefined

  if (!token || token.length < 16) {
    if (req.method !== 'POST' && landingBase()) {
      // A malformed link is still a link someone clicked; show the page with a
      // reason rather than dumping JSON at them.
      return redirectToLanding(landingBase()!, {
        error: token ? 'That share link is not valid.' : 'No share token was supplied.',
      })
    }
    return json({ error: 'A share token is required' }, 400)
  }

  const { admin, link, error } = await validateToken(token)
  if (error) {
    if (req.method !== 'POST' && landingBase()) {
      return redirectToLanding(landingBase()!, { error })
    }
    return json({ error }, 404)
  }

  // ── POST: redeem ──────────────────────────────────────────────────────────
  if (req.method === 'POST') {
    const user = await getUser(req)
    if (!user) {
      return json(
        { error: 'Sign in to DigiBoard to open this shared board', needsAuth: true },
        401,
      )
    }

    // A member row is the durable grant; the link only decides the permission a
    // new member receives. Existing members keep the higher of the two so a
    // later view-only link cannot downgrade someone who already has edit.
    const rank: Record<string, number> = { view: 0, edit: 1, admin: 2 }
    const { data: existing } = await admin
      .from('board_members')
      .select('id, permission')
      .eq('board_id', link.board_id)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existing) {
      if (rank[existing.permission] < rank[link.permission]) {
        await admin
          .from('board_members')
          .update({ permission: link.permission })
          .eq('id', existing.id)
      }
    } else {
      const { error: insErr } = await admin.from('board_members').insert({
        board_id: link.board_id,
        user_id: user.id,
        permission: link.permission,
        // The link, not a person, is what granted access.
        invited_by: null,
      })
      if (insErr) return json({ error: insErr.message }, 500)
    }

    // Best-effort; a failed counter must not block the redemption.
    await admin
      .from('shared_links')
      .update({ access_count: (link.access_count ?? 0) + 1 })
      .eq('id', link.id)

    const { data: board } = await admin
      .from('boards')
      .select('id, name')
      .eq('id', link.board_id)
      .maybeSingle()

    return json({
      boardId: link.board_id,
      boardName: board?.name ?? 'Shared board',
      permission: link.permission,
    })
  }

  // ── GET: landing page ─────────────────────────────────────────────────────
  // No board data here. The page only carries the token, and the token is
  // No board data in the URL — only the token, and display strings that the
  // hosted page renders as text. Redemption still happens over POST in the app.
  const { data: board } = await admin
    .from('boards')
    .select('name')
    .eq('id', link.board_id)
    .maybeSingle()

  const landing = landingBase()
  if (!landing) {
    // Misconfigured: hand back the deep link and token as JSON so the link is
    // still usable, just without the hosted page.
    return json({
      error: 'Share landing page is not configured on the server',
      deepLink: `${APP_PROTOCOL}://share?token=${token}`,
      token,
    }, 503)
  }

  return redirectToLanding(landing, {
    token,
    boardName: board?.name ?? undefined,
    permission: link.permission === 'edit' ? 'Can edit' : 'Can view',
  })
})
