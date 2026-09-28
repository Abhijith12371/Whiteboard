import { useState } from 'react'
import { Cloud, CloudOff, CloudUpload, Check, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { syncEngine } from '../../lib/syncEngine'

interface BoardSyncBadgeProps {
  boardId: string
}

/**
 * Per-board cloud state for the home grid.
 *
 * Only meaningful once signed in — with no account there is nowhere to sync to,
 * so the badge stays hidden rather than implying a backup that does not exist.
 */
export function BoardSyncBadge({ boardId }: BoardSyncBadgeProps) {
  const user = useAuthStore((s) => s.user)
  const isOnline = useAuthStore((s) => s.isOnline)
  // Subscribing to the aggregate status re-renders when a push starts or
  // finishes, so the badge flips from pending to synced without a manual reload.
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const [busy, setBusy] = useState(false)

  if (!user) return null

  const state = syncEngine.boardState(boardId)
  const syncingNow = syncStatus === 'syncing'

  const onSync = async (e: React.MouseEvent) => {
    // The row itself opens the board; syncing must not navigate.
    e.stopPropagation()
    if (busy || !isOnline) return
    setBusy(true)
    try {
      await syncEngine.syncBoardNow(boardId)
    } finally {
      setBusy(false)
    }
  }

  if (state === 'deleting') {
    return (
      <span
        className="inline-flex items-center text-muted-foreground"
        title="Removed here — deleting from your cloud account"
      >
        <Loader2 size={13} className="animate-spin" />
      </span>
    )
  }

  if (state === 'synced') {
    return (
      <span
        className="inline-flex items-center text-success"
        title="Backed up to your cloud account"
      >
        <Cloud size={13} />
        <Check size={9} className="-ml-1" />
      </span>
    )
  }

  const isPending = state === 'pending'
  const canSync = isOnline && !syncingNow && !busy

  return (
    <button
      onClick={onSync}
      disabled={!canSync}
      aria-label={isPending ? 'This board is not on your cloud account yet' : 'Upload this board'}
      title={
        !isOnline
          ? 'Offline — this board will upload when you reconnect'
          : isPending
          ? 'Saved on this device only. Click to upload now.'
          : 'Local changes are waiting to upload. Click to upload now.'
      }
      className={`inline-flex items-center transition-colors disabled:cursor-default ${
        isPending
          ? canSync ? 'text-warning hover:text-warning/80' : 'text-warning'
          : 'text-primary'
      }`}
    >
      {busy || syncingNow ? (
        <Loader2 size={13} className="animate-spin" />
      ) : isPending ? (
        <CloudOff size={13} />
      ) : (
        <CloudUpload size={13} className="animate-pulse" />
      )}
    </button>
  )
}
