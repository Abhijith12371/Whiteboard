import { useCallback, useEffect, useState } from 'react'
import {
  X, Link2, Copy, Check, Trash2, Loader2, Plus, Eye, Pencil, ShieldOff,
} from 'lucide-react'
import {
  createShareLink, listShareLinks, revokeShareLink, shareLinkUrl, copyToClipboard,
  type ShareLink, type SharePermission,
} from '../../lib/sharing'
import { useAuthStore } from '../../store/authStore'

interface ShareDialogProps {
  boardId: string
  boardName: string
  onClose: () => void
}

const EXPIRY_OPTIONS: { label: string; days?: number }[] = [
  { label: 'Never' },
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
]

/**
 * Owner-facing sharing controls.
 *
 * Deliberately link-first: a link is the cheapest way to grant access and needs
 * no contact list. Everything here acts on Supabase rows under the owner-only
 * RLS policies, so a non-owner calling these gets rejected rather than trusted.
 */
export function ShareDialog({ boardId, boardName, onClose }: ShareDialogProps) {
  const user = useAuthStore((s) => s.user)

  const [links, setLinks] = useState<ShareLink[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [permission, setPermission] = useState<SharePermission>('view')
  const [expiry, setExpiry] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [revokingId, setRevokingId] = useState<string | null>(null)
  // Expiry is judged against a timestamp captured when the list loads, rather
  // than Date.now() during render, which would make output depend on when the
  // component happened to evaluate.
  const [now, setNow] = useState(() => Date.now())

  const refresh = useCallback(async () => {
    try {
      setLinks(await listShareLinks(boardId))
      setNow(Date.now())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load share links')
    } finally {
      setLoading(false)
    }
  }, [boardId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = async () => {
    setCreating(true)
    setError(null)
    try {
      const link = await createShareLink(
        boardId,
        permission,
        expiry === 0 ? undefined : expiry,
      )
      await refresh()
      // Copy immediately: the common next step is sending it on, and the raw
      // token is only ever shown in this dialog.
      const ok = await copyToClipboard(shareLinkUrl(link.token))
      setCopiedId(ok ? link.id : null)
      if (!ok) setError('Link created. Copy it from the list below.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create a share link')
    } finally {
      setCreating(false)
    }
  }

  const copy = async (link: ShareLink) => {
    const ok = await copyToClipboard(shareLinkUrl(link.token))
    if (ok) {
      setCopiedId(link.id)
      setTimeout(() => setCopiedId((c) => (c === link.id ? null : c)), 2000)
    } else {
      setError('Could not copy. Select the link text and copy it manually.')
    }
  }

  const revoke = async (link: ShareLink) => {
    if (!window.confirm('Revoke this link? Anyone using it will lose access.')) return
    setRevokingId(link.id)
    setError(null)
    try {
      await revokeShareLink(boardId, link.id)
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not revoke that link')
    } finally {
      setRevokingId(null)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-scrim/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Share ${boardName}`}
        className="w-[min(560px,94vw)] max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-card shadow-2xl p-5 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 mb-1">
          <div>
            <h2 className="font-semibold text-lg">Share board</h2>
            <p className="text-sm text-muted-foreground truncate">{boardName}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="p-1.5 hover:bg-accent rounded-lg transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {!user && (
          <p className="mt-4 text-sm text-muted-foreground bg-muted/60 border border-border rounded-lg px-3 py-2">
            Sign in to share this board. Boards stay private until you do.
          </p>
        )}

        {user && (
          <>
            {/* Create */}
            <div className="mt-5 rounded-xl border border-border p-4">
              <div className="flex items-center gap-2 mb-3">
                <Link2 size={16} className="text-primary" />
                <span className="font-medium text-sm">Create a share link</span>
              </div>

              <div
                className="inline-flex rounded-lg border border-border p-0.5 mb-3"
                role="radiogroup"
                aria-label="Permission"
              >
                {(['view', 'edit'] as SharePermission[]).map((p) => (
                  <button
                    key={p}
                    role="radio"
                    aria-checked={permission === p}
                    onClick={() => setPermission(p)}
                    className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors flex items-center gap-1.5 ${
                      permission === p
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {p === 'view' ? <Eye size={14} /> : <Pencil size={14} />}
                    {p === 'view' ? 'Can view' : 'Can edit'}
                  </button>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                <select
                  value={expiry}
                  onChange={(e) => setExpiry(Number(e.target.value))}
                  aria-label="Link expiry"
                  className="px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  {EXPIRY_OPTIONS.map((o) => (
                    <option key={o.label} value={o.days ?? 0}>
                      {o.label}
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => void create()}
                  disabled={creating}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Plus size={15} />
                  )}
                  {creating ? 'Creating…' : 'Create & copy link'}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="mt-3 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            {/* Existing links */}
            <div className="mt-5">
              <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                <Link2 size={14} className="text-muted-foreground" />
                Share links
              </h3>

              {loading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                  <Loader2 size={15} className="animate-spin" /> Loading…
                </div>
              ) : links.length === 0 ? (
                <p className="text-sm text-muted-foreground py-3">
                  No links yet. Anyone you send a link to must be signed in to DigiBoard.
                </p>
              ) : (
                <ul className="space-y-2">
                  {links.map((link) => {
                    const expired =
                      link.expires_at != null && new Date(link.expires_at).getTime() < now
                    const inactive = !link.is_active || expired
                    return (
                      <li
                        key={link.id}
                        className="rounded-lg border border-border px-3 py-2.5 flex items-center gap-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-sm font-medium">
                            {link.permission === 'edit' ? (
                              <Pencil size={13} className="text-primary" />
                            ) : (
                              <Eye size={13} className="text-muted-foreground" />
                            )}
                            {link.permission === 'edit' ? 'Can edit' : 'Can view'}
                            {inactive && (
                              <span className="text-xs font-normal text-destructive">
                                {expired ? '· expired' : '· revoked'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {link.expires_at
                              ? `Expires ${new Date(link.expires_at).toLocaleDateString()}`
                              : 'Never expires'}
                            {link.access_count > 0 && ` · opened ${link.access_count}×`}
                          </p>
                        </div>

                        <button
                          onClick={() => void copy(link)}
                          disabled={inactive}
                          aria-label="Copy link"
                          className="p-2 rounded-md hover:bg-accent transition-colors disabled:opacity-40"
                        >
                          {copiedId === link.id ? (
                            <Check size={15} className="text-success" />
                          ) : (
                            <Copy size={15} className="text-muted-foreground" />
                          )}
                        </button>

                        <button
                          onClick={() => void revoke(link)}
                          disabled={revokingId === link.id}
                          aria-label="Revoke link"
                          title="Revoke link"
                          className="p-2 rounded-md hover:bg-danger-muted text-muted-foreground hover:text-danger transition-colors disabled:opacity-40"
                        >
                          {revokingId === link.id ? (
                            <Loader2 size={15} className="animate-spin" />
                          ) : (
                            <Trash2 size={15} />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            <p className="mt-5 text-xs text-muted-foreground flex items-start gap-1.5">
              <ShieldOff size={13} className="shrink-0 mt-0.5" />
              Revoking a link stops it working immediately for new visitors, but
              cannot un-share a board someone has already opened and synced to
              their own account.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
