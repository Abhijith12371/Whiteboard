import { useEffect, useState } from 'react'
import { CloudUpload, Loader2, X, FolderSync } from 'lucide-react'
import { syncEngine } from '../../lib/syncEngine'
import { listBoards } from '../../services/db'

interface MigrationPromptProps {
  open: boolean
  onClose: () => void
  onDone: (uploaded: string[]) => void
}

const DISMISS_KEY = 'digiboard_migration_dismissed'

/**
 * Phase 6 — shown once after the first sign-in when this device holds boards the
 * cloud has never seen. Local boards are only ever read and copied, never moved
 * or deleted, so declining costs nothing.
 */
export function MigrationPrompt({ open, onClose, onDone }: MigrationPromptProps) {
  const [local, setLocal] = useState<{ id: string; name: string }[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (localStorage.getItem(DISMISS_KEY) === 'true') {
      onClose()
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        const [remote, locals] = await Promise.all([
          syncEngine.fetchOwnedBoards(),
          listBoards(),
        ])
        if (cancelled) return
        const remoteIds = new Set(remote.map((b) => b.id))
        setLocal(locals.filter((b) => !remoteIds.has(b.id)).map((b) => ({ id: b.id, name: b.name })))
      } catch {
        if (!cancelled) setError('Could not check your cloud boards.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [open, onClose])

  const decline = () => {
    // Remember the choice so we stop asking, but leave every local board intact.
    localStorage.setItem(DISMISS_KEY, 'true')
    onClose()
  }

  const upload = async () => {
    setBusy(true)
    setError(null)
    try {
      const result = await syncEngine.migrateLocalBoards()
      onDone(result.uploaded)
    } catch {
      setError('Upload failed. Your boards are still saved on this device.')
      setBusy(false)
    }
  }

  // Nothing to offer: close on its own rather than flashing an empty dialog.
  // Done in an effect because closing means updating the parent's state, which
  // must not happen during this component's render.
  useEffect(() => {
    if (!open) return
    if (!busy && !error && local.length === 0) onClose()
  }, [open, busy, error, local.length, onClose])

  if (!open || local.length === 0) return null

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-scrim/40 backdrop-blur-sm p-4">
      <div
        role="dialog"
        aria-label="Sync local boards to cloud"
        className="w-[min(460px,94vw)] rounded-2xl border border-border bg-card shadow-2xl p-6"
      >
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <FolderSync size={20} />
            </div>
            <div>
              <h2 className="font-semibold">Sync your local boards?</h2>
              <p className="text-xs text-muted-foreground">
                {local.length} board{local.length === 1 ? '' : 's'} on this device
              </p>
            </div>
          </div>
          <button
            onClick={decline}
            disabled={busy}
            aria-label="Close"
            className="p-1.5 hover:bg-accent rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          These boards were created before you signed in. Uploading copies them to your cloud
          account so they follow you to other devices.
        </p>

        <ul className="mb-4 max-h-40 overflow-y-auto rounded-lg border border-border divide-y divide-border">
          {local.map((b) => (
            <li key={b.id} className="px-3 py-2 text-sm truncate">
              {b.name}
            </li>
          ))}
        </ul>

        {error && (
          <p className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            onClick={decline}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
          >
            Not now
          </button>
          <button
            onClick={upload}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium rounded-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-2"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} />}
            {busy ? 'Uploading…' : `Upload ${local.length} board${local.length === 1 ? '' : 's'}`}
          </button>
        </div>

        <p className="mt-3 text-xs text-muted-foreground">
          Uploading never deletes your local copies.
        </p>
      </div>
    </div>
  )
}
