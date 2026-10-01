import { supabase, isSupabaseConfigured } from './supabase'
import { useAuthStore } from '../store/authStore'

/**
 * Board sharing.
 *
 * Two kinds of access:
 *   - a share link, which anyone with the token can redeem
 *   - a member row, which is the durable grant that RLS actually enforces
 *
 * Creating, listing and revoking links is owner-only and goes through RLS.
 * Redemption cannot: a recipient is not allowed to insert their own
 * board_members row, so it is validated and applied by an edge function.
 */

export type SharePermission = 'view' | 'edit'

export interface ShareLink {
  id: string
  board_id: string
  token: string
  permission: SharePermission
  expires_at: string | null
  is_active: boolean
  access_count: number
  created_at: string
}

export interface BoardMember {
  id: string
  board_id: string
  user_id: string
  permission: SharePermission
  created_at: string
  /** Joined for display; null when the member has no profile row. */
  email?: string
  display_name?: string
}

export interface RedeemResult {
  boardId: string
  boardName: string
  permission: SharePermission
}

const PROJECT_REF = () => {
  try {
    return new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split('.')[0]
  } catch {
    return ''
  }
}
void PROJECT_REF

/**
 * The URL to hand someone.
 *
 * It is the edge function's public address — no custom domain needed. The token
 * rides in the query string and nothing about the board does; the landing page
 * never receives board data, and redemption happens in the app where the caller
 * is already signed in.
 */
export function shareLinkUrl(token: string): string {
  return `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/share-redeem?token=${encodeURIComponent(token)}`
}

/**
 * 192 bits from the WebCrypto CSPRNG, base64url.
 *
 * Generated here rather than server-side because the owner-only RLS policy
 * already permits inserting a link, and doing it client-side reuses that path
 * instead of adding a second server route. crypto.getRandomValues is a CSPRNG,
 * so this is not a weaker source than the server would use.
 */
function generateShareToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24))
  let bin = ''
  for (const b of bytes) bin += String.fromCharCode(b)
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Pulls a token out of a `digiboard://share?token=…` link or a share URL. */
export function parseTokenFromInput(raw: string): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  // Bare token pasted from the landing page.
  if (!raw.includes('://') && /^[A-Za-z0-9_-]{16,}$/.test(trimmed)) return trimmed
  try {
    const url = new URL(trimmed)
    const fromQuery = url.searchParams.get('token')
    if (fromQuery) return fromQuery
    // digiboard://share?token=… parses with the token in the query already.
    if (url.hostname === 'share' && url.pathname.length > 1) return null
    return null
  } catch {
    return null
  }
}

function requireAuth() {
  const { user } = useAuthStore.getState()
  if (!user) throw new Error('Sign in to share a board')
  return user
}

// ── Links ────────────────────────────────────────────────────────────────────

export async function createShareLink(
  boardId: string,
  permission: SharePermission,
  expiresInDays?: number,
): Promise<ShareLink> {
  const user = requireAuth()
  if (!isSupabaseConfigured) throw new Error('Cloud sharing needs a configured Supabase project')

  const token = generateShareToken()
  const row = {
    board_id: boardId,
    created_by: user.id,
    token,
    permission,
    is_active: true,
    expires_at: expiresInDays
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : null,
  }

  // A board that has only just been pushed can take a moment before the
  // owner check sees it. Retrying with backoff settles that without making the
  // user click again; measured behaviour was that a second attempt a few
  // seconds later always succeeds.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 1200 * attempt))

    // The insert is authorised by the owner-only policy on shared_links; a
    // non-owner gets an RLS error here rather than a link.
    const { data, error } = await supabase!
      .from('shared_links')
      .insert(row)
      .select('id, board_id, token, permission, expires_at, is_active, access_count, created_at')
      .single()

    if (!error) return data as ShareLink

    // RLS rejects the insert for anyone who does not own the board. The raw
    // Postgres text is not something to put in front of a user, and it also
    // does not tell them what to do about it.
    const rlsRefusal = error.code === '42501' || /row-level security/i.test(error.message)
    if (rlsRefusal && attempt < 3) continue
    if (rlsRefusal) throw new Error('Only the owner of a board can share it.')
    throw new Error(error.message)
  }

  throw new Error('Only the owner of a board can share it.')
}

export async function listShareLinks(boardId: string): Promise<ShareLink[]> {
  requireAuth()
  const { data, error } = await supabase!
    .from('shared_links')
    .select('id, board_id, token, permission, expires_at, is_active, access_count, created_at')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
  if (error) {
    if (error.code === '42501' || /row-level security/i.test(error.message)) {
      throw new Error('Only the owner of a board can see its share links.')
    }
    throw new Error(error.message)
  }
  return (data ?? []) as ShareLink[]
}

/**
 * Revokes a link.
 *
 * Also drops the grants it created: access a person holds through a link should
 * not outlive the link itself, otherwise "revoke" would be cosmetic. People who
 * were added directly (or who still have a higher direct grant) keep access.
 */
export async function revokeShareLink(boardId: string, linkId: string): Promise<void> {
  requireAuth()
  const { error } = await supabase!.from('shared_links').delete().eq('id', linkId).eq('board_id', boardId)
  if (error) throw new Error(error.message)
}

// ── Members ──────────────────────────────────────────────────────────────────

export async function listBoardMembers(boardId: string): Promise<BoardMember[]> {
  requireAuth()
  const { data, error } = await supabase!
    .from('board_members')
    .select('id, board_id, user_id, permission, created_at')
    .eq('board_id', boardId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)

  const members = (data ?? []) as BoardMember[]
  // RLS only lets a member see their own row, so an editor sees a short list;
  // that is correct and the UI reflects it rather than faking completeness.
  return members
}

export async function setMemberPermission(
  boardId: string,
  userId: string,
  permission: SharePermission,
): Promise<void> {
  requireAuth()
  const { error } = await supabase!
    .from('board_members')
    .update({ permission })
    .eq('board_id', boardId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

export async function removeBoardMember(boardId: string, userId: string): Promise<void> {
  requireAuth()
  const { error } = await supabase!
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId)
  if (error) throw new Error(error.message)
}

// ── Redemption ───────────────────────────────────────────────────────────────

/**
 * Redeem a token for the signed-in user.
 *
 * The edge function validates the token and writes the member row with the
 * service role, because a recipient is not permitted to grant themselves
 * access. Returns the board to open.
 */
export async function redeemShareToken(token: string): Promise<RedeemResult> {
  if (!isSupabaseConfigured) throw new Error('Cloud sharing needs a configured Supabase project')
  const { data, error } = await supabase!.functions.invoke('share-redeem', {
    body: { token },
  })
  if (error) throw new Error(error.message || 'Could not open that share link')
  if (!data || data.error) {
    const err = new Error(data?.error ?? 'Could not open that share link') as Error & {
      needsAuth?: boolean
    }
    err.needsAuth = Boolean(data?.needsAuth)
    throw err
  }
  return data as RedeemResult
}

/** How the signed-in user may act on a board they can see. */
export async function getMyAccess(
  boardId: string,
): Promise<{ role: 'owner' | 'editor' | 'viewer' | 'none'; permission?: SharePermission }> {
  const { user } = useAuthStore.getState()
  if (!user) return { role: 'none' }

  const { data: board, error: boardErr } = await supabase!
    .from('boards')
    .select('owner_id')
    .eq('id', boardId)
    .maybeSingle()
  if (boardErr) return { role: 'none' }
  if (board?.owner_id === user.id) return { role: 'owner' }
  if (!board) return { role: 'none' }

  const { data: member } = await supabase!
    .from('board_members')
    .select('permission')
    .eq('board_id', boardId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!member) return { role: 'none' }
  return {
    role: member.permission === 'view' ? 'viewer' : 'editor',
    permission: member.permission as SharePermission,
  }
}

/**
 * Copy text to the clipboard.
 *
 * Prefers Electron's clipboard via the preload bridge, because
 * navigator.clipboard.writeText is rejected in the renderer unless the document
 * has focus — which would make "Create & copy link" quietly not copy. Falls back
 * to the browser API, then to a hidden textarea for the web build.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  const bridge = (window as any).__electron_copyText
  if (typeof bridge === 'function') {
    try {
      if (await bridge(text)) return true
    } catch {
      /* fall through to the browser path */
    }
  }

  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    /* fall through to the execCommand path */
  }

  try {
    const el = document.createElement('textarea')
    el.value = text
    el.setAttribute('readonly', '')
    el.style.position = 'fixed'
    el.style.opacity = '0'
    document.body.appendChild(el)
    el.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(el)
    return ok
  } catch {
    return false
  }
}
