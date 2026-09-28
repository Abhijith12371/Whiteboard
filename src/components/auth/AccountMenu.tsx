import { useEffect, useState } from 'react'
import {
  User, LogOut, Cloud, CloudOff, Loader2, Settings, Keyboard, RefreshCw, HardDrive,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { useUIStore } from '../../store/uiStore'
import { AuthModal } from './AuthModal'
import { syncEngine } from '../../lib/syncEngine'
import { listBoards } from '../../services/db'

function AccountSettings({ onClose }: { onClose: () => void }) {
  const user = useAuthStore((s) => s.user)
  const isOnline = useAuthStore((s) => s.isOnline)
  const setShortcutsOpen = useUIStore((s) => s.setShortcutsOpen)
  const [stats, setStats] = useState<{ count: number; bytes: number } | null>(null)
  const [syncing, setSyncing] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const boards = await listBoards()
      if (cancelled) return
      const bytes = boards.reduce((sum, b) => sum + JSON.stringify(b.data ?? {}).length, 0)
      setStats({ count: boards.length, bytes })
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const runSync = async () => {
    setSyncing(true)
    await syncEngine.sync()
    setSyncing(false)
  }

  return (
    <>
      <div className="px-3 py-2 mb-2 border-b border-border">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">Signed in as</p>
        <p className="font-medium text-sm truncate mt-0.5">{user?.email}</p>
      </div>

      {stats && (
        <div className="px-3 py-2 mb-2 border-b border-border flex items-center gap-2 text-sm text-muted-foreground">
          <HardDrive size={14} />
          <span>
            {stats.count} board{stats.count === 1 ? '' : 's'} ·{' '}
            {(stats.bytes / 1024).toFixed(0)} KB on this device
          </span>
        </div>
      )}

      <div className="space-y-1">
        <button
          onClick={runSync}
          disabled={!isOnline || syncing}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-lg transition-colors text-left disabled:opacity-50"
        >
          {syncing ? (
            <Loader2 size={16} className="animate-spin" />
          ) : isOnline ? (
            <Cloud size={16} />
          ) : (
            <CloudOff size={16} />
          )}
          <span>{isOnline ? 'Sync now' : 'Offline — cannot sync'}</span>
        </button>

        <button
          onClick={() => {
            setShortcutsOpen(true)
            onClose()
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-lg transition-colors text-left"
        >
          <Keyboard size={16} />
          <span>Keyboard shortcuts</span>
        </button>

        <button
          onClick={() => {
            localStorage.removeItem('digiboard_intro_done')
            window.location.reload()
          }}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-lg transition-colors text-left"
        >
          <RefreshCw size={16} />
          <span>Replay intro</span>
        </button>
      </div>

      {!isOnline && (
        <div className="mt-2 p-2 rounded-lg bg-muted/50 border border-border">
          <p className="text-xs text-muted-foreground">
            You&rsquo;re offline. Changes are saved here and will sync when you reconnect.
          </p>
        </div>
      )}
    </>
  )
}

export const AccountMenu = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  const { user, signOut, syncStatus, isOnline, loading } = useAuthStore()

  const syncIcon = !isOnline ? (
    <CloudOff size={14} className="text-muted-foreground" />
  ) : syncStatus === 'syncing' ? (
    <Loader2 size={14} className="animate-spin text-primary" />
  ) : syncStatus === 'error' ? (
    <CloudOff size={14} className="text-destructive" />
  ) : (
    <Cloud size={14} className="text-muted-foreground" />
  )

  if (!user) {
    return (
      <>
        <button
          onClick={() => setShowAuthModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors"
        >
          <User size={16} />
          <span>Sign In</span>
        </button>
        <AuthModal isOpen={showAuthModal} onClose={() => setShowAuthModal(false)} />
      </>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium hover:bg-accent rounded-md transition-colors"
        title={user.email}
      >
        <div className="w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-semibold">
          {user.email?.[0]?.toUpperCase() || 'U'}
        </div>
        <span className="hidden sm:inline max-w-[120px] truncate">
          {user.email?.split('@')[0]}
        </span>
        {syncIcon}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setIsOpen(false)} />

          <div
            className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-border shadow-2xl z-40 p-2"
            style={{ background: 'var(--card)' }}
          >
            {showSettings ? (
              <AccountSettings onClose={() => setShowSettings(false)} />
            ) : (
              <>
                <div className="px-3 py-2 mb-2 border-b border-border flex items-center gap-2">
                  <button
                    onClick={() => setShowSettings(true)}
                    aria-label="Back to account menu"
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    &larr; Back
                  </button>
                </div>

                <button
                  onClick={() => setShowSettings(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-lg transition-colors text-left"
                >
                  <Settings size={16} />
                  <span>Account settings</span>
                </button>

                <div className="border-t border-border my-1" />

                <button
                  onClick={async () => {
                    await signOut()
                    setIsOpen(false)
                  }}
                  disabled={loading}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-accent rounded-lg transition-colors text-left text-destructive disabled:opacity-50"
                >
                  <LogOut size={16} />
                  <span>Sign out</span>
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
