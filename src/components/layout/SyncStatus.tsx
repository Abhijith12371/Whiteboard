import { HardDrive, Check, Loader2, TriangleAlert, Cloud, CloudOff, CloudUpload } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useAuthStore } from '../../store/authStore'
import { syncEngine } from '../../lib/syncEngine'

/**
 * Local persistence and cloud sync are separate guarantees, so they get separate
 * indicators. A failed local write is the only state that can lose work, so it
 * takes priority; cloud problems are visible but never alarming.
 */
export function SyncStatus() {
  const saveState = useUIStore((s) => s.saveState)
  const syncStatus = useAuthStore((s) => s.syncStatus)
  const user = useAuthStore((s) => s.user)
  const isOnline = useAuthStore((s) => s.isOnline)

  if (saveState === 'error') {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-danger-muted text-xs font-medium text-danger border border-danger/30"
        title="Could not write to local storage. Your latest changes may not be saved."
      >
        <TriangleAlert size={12} />
        <span>Save failed</span>
      </div>
    )
  }

  if (saveState === 'saving') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground border border-border">
        <Loader2 size={12} className="animate-spin" />
        <span>Saving</span>
      </div>
    )
  }

  // Signed out: local storage is the only destination, so say exactly that.
  if (!user) {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-success-muted text-xs font-medium text-success border border-success/30"
        title="Saved on this device. Sign in to back up and sync across devices."
      >
        <HardDrive size={12} />
        {saveState === 'saved' && <Check size={12} />}
        <span>Saved locally</span>
      </div>
    )
  }

  if (!isOnline || syncStatus === 'offline') {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground border border-border"
        title="Offline. Changes are saved on this device and will sync when you reconnect."
      >
        <CloudOff size={12} />
        <span>Offline</span>
      </div>
    )
  }

  if (syncStatus === 'error') {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-warning-muted text-xs font-medium text-warning border border-warning/30"
        title={`Could not reach the cloud after ${syncEngine.retryCount()} attempts. Your work is safe on this device and will retry automatically.`}
      >
        <TriangleAlert size={12} />
        <span>Sync failed</span>
      </div>
    )
  }

  if (syncStatus === 'syncing') {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-muted text-xs font-medium text-muted-foreground border border-border"
        title="Uploading your latest changes to the cloud."
      >
        <CloudUpload size={12} className="animate-pulse" />
        <span>Syncing</span>
      </div>
    )
  }

  if (syncStatus === 'synced') {
    return (
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-success-muted text-xs font-medium text-success border border-success/30"
        title="Saved on this device and backed up to your cloud account."
      >
        <Cloud size={12} />
        <Check size={12} />
        <span>Synced</span>
      </div>
    )
  }

  return (
    <div
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-success-muted text-xs font-medium text-success border border-success/30"
      title="Saved on this device. Cloud sync starts with your next edit."
    >
      <HardDrive size={12} />
      {saveState === 'saved' && <Check size={12} />}
      <span>Saved locally</span>
    </div>
  )
}
