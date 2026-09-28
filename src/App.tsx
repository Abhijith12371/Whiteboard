import { useCallback, useEffect, useState } from 'react'
import { TopBar } from './components/layout/TopBar'
import { LeftToolbar } from './components/layout/LeftToolbar'
import { Canvas } from './components/canvas/Canvas'
import { useUIStore } from './store/uiStore'
import { useBoardStore } from './store/boardStore'
import { loadBoard, listBoards, saveBoard } from './services/db'
import { runInitEngine } from './services/initEngine'
import { useAuthStore } from './store/authStore'
import { syncEngine } from './lib/syncEngine'

import { HomeDashboard } from './components/layout/HomeDashboard'
import { IntroSequence } from './components/layout/IntroSequence'
import { CommandPalette } from './components/layout/CommandPalette'
import { ShortcutsPanel } from './components/layout/ShortcutsPanel'
import { RightWorkspace } from './components/layout/RightWorkspace'
import { ZoomControls } from './components/layout/ZoomControls'
import { StylePanel } from './components/layout/StylePanel'
import { PresentationChrome, SpotlightOverlay } from './components/layout/PresentationChrome'
import { FloatingObjectBar } from './components/canvas/FloatingObjectBar'
import { ShapesMenu } from './components/layout/ShapesMenu'
import { copySelection, cutSelection, pasteClipboard, duplicateSelection, selectAll, deleteSelection } from './lib/workspaceActions'
import { MigrationPrompt } from './components/auth/MigrationPrompt'
import { onAuthDeepLink, handleAuthCallback } from './lib/authDeepLink'

function App() {
  const setSpacePressed = useUIStore((state) => state.setSpacePressed)
  const setActiveTool = useUIStore((state) => state.setActiveTool)
  const setSelectedIds = useUIStore((state) => state.setSelectedIds)

  const activeBoardId = useUIStore((state) => state.activeBoardId)
  const activeBoardName = useUIStore((state) => state.activeBoardName)
  const toast = useUIStore((state) => state.toast)
  const theme = useUIStore((state) => state.theme)
  const setSaveState = useUIStore((state) => state.setSaveState)
  const setActiveBoard = useUIStore((state) => state.setActiveBoard)

  const undo = useBoardStore((state) => state.undo)
  const redo = useBoardStore((state) => state.redo)
  const objects = useBoardStore((state) => state.objects)
  const objectIds = useBoardStore((state) => state.objectIds)
  const pages = useBoardStore((state) => state.pages)
  const activePageId = useBoardStore((state) => state.activePageId)
  const pageSnapshots = useBoardStore((state) => state.pageSnapshots)

  // The intro is dismissed by the user (completion or skip) only.
  // We persist the flag to localStorage so it survives full app restarts.
  // IntroSequence itself writes the flag when it completes.
  // Check URL param ?intro=1 to force show intro for testing
  const [showIntro, setShowIntro] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const forceIntro = urlParams.get('intro') === '1'
    const introDone = localStorage.getItem('digiboard_intro_done') === 'true'
    return forceIntro || !introDone
  })
  // `booted` is separate: it tracks DB/migrations, and must never hide the intro.
  const [booted, setBooted] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const [dbAvailable, setDbAvailable] = useState(true)
  const [migrationPrompt, setMigrationPrompt] = useState({ open: false, boards: [] as string[] })

  // Stable identity: the prompt runs this inside an effect, and an inline
  // arrow would re-trigger it on every render.
  const closeMigration = useCallback(
    () => setMigrationPrompt((p) => ({ ...p, open: false })),
    [],
  )

  useEffect(() => {
    if (!booted || !dbAvailable) return
    let cancelled = false

    const load = async () => {
      try {
        let board = await loadBoard(activeBoardId)
        if (!board) {
          // The active id can be stale — migrated to the canonical UUID, or the
          // board was deleted. Fall back to a real board so existing work is
          // never shown as an empty canvas.
          const boards = await listBoards()
          if (!boards.length) return
          board = boards[0]
          setActiveBoard(board.id, board.name)
        }
        useBoardStore.getState().loadPagesFromBoard(board.data)
      } catch {
        if (!cancelled) setDbAvailable(false)
      } finally {
        if (!cancelled) setIsLoaded(true)
      }
    }

    load()
    return () => { cancelled = true }
  }, [activeBoardId, dbAvailable, booted])

  // Boot: open the DB, seed a default board, and run one-time data migrations
  // (e.g. assigning colorMode to legacy strokes) before any board is loaded.
  useEffect(() => {
    let cancelled = false
    runInitEngine(() => {})
      .catch(() => { /* initEngine handles its own errors */ })
      .finally(() => {
        if (!cancelled) setBooted(true)
      })
    return () => { cancelled = true }
  }, [])

  // Initialize authentication and sync engine
  useEffect(() => {
    const initAuth = async () => {
      await useAuthStore.getState().initAuth()
    }
    initAuth()
  }, [])

  // Complete password-reset / confirmation links that return via digiboard://
  useEffect(() => {
    let cancelled = false
    const off = onAuthDeepLink(async (url) => {
      const error = await handleAuthCallback(url)
      if (cancelled) return
      useUIStore.getState().setToast(error ?? 'Signed in')
    })
    return () => {
      cancelled = true
      off()
    }
  }, [])

  // Start/stop sync based on identity and connectivity only.
  //
  // This must not react to the whole auth store: the sync engine writes
  // `syncStatus` back into that store, so a broad subscription re-enters sync
  // on its own status write and spins forever. We compare the two values that
  // actually gate the engine and ignore everything else.
  useEffect(() => {
    const apply = (userId: string | null, online: boolean) => {
      if (userId && online) {
        syncEngine.startAutoSync()
        void syncEngine.sync()
      } else {
        syncEngine.stopAutoSync()
        useAuthStore.getState().setSyncStatus(online ? 'idle' : 'offline')
      }
    }

    const read = () => {
      const { user, isOnline } = useAuthStore.getState()
      return { userId: user?.id ?? null, online: isOnline }
    }

    let last = read()
    apply(last.userId, last.online)

    const unsubscribe = useAuthStore.subscribe((state) => {
      const next = { userId: state.user?.id ?? null, online: state.isOnline }
      if (next.userId === last.userId && next.online === last.online) return
      const firstSignIn = !last.userId && next.userId
      last = next
      apply(next.userId, next.online)
      if (firstSignIn) setMigrationPrompt({ open: true, boards: [] })
    })

    return () => {
      unsubscribe()
      syncEngine.stopAutoSync()
    }
  }, [])

  // Keep the native Windows caption buttons in step with the app theme.
  useEffect(() => {
    window.__electron_setTitleBarOverlay?.(
      theme === 'dark'
        ? { color: '#09090b', symbolColor: '#fafafa' }
        : { color: '#ffffff', symbolColor: '#09090b' }
    )
  }, [theme])

  useEffect(() => {
    if (!isLoaded || !dbAvailable || !activeBoardId) return
    const timeoutId = setTimeout(() => {
      setSaveState('saving')
      saveBoard(activeBoardId, activeBoardName, objects, objectIds, {
        pages,
        activePageId,
        pageSnapshots,
      })
        .then(() => {
          setSaveState('saved')
          // Local write is the source of truth; cloud push is a background
          // concern, so the board is queued rather than awaited here.
          syncEngine.markDirty(activeBoardId)
        })
        .catch(() => {
          setDbAvailable(false)
          setSaveState('error')
        })
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [objects, objectIds, isLoaded, dbAvailable, activeBoardId, activeBoardName, pages, activePageId, pageSnapshots])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const typing = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      const ui = useUIStore.getState()

      if (e.code === 'Space' && !e.repeat && !typing) setSpacePressed(true)

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        ui.setCommandPaletteOpen(!ui.isCommandPaletteOpen)
        return
      }

      if (typing) return

      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault()
        ui.setShortcutsOpen(true)
        return
      }

      if (e.key === 'Escape') {
        ui.setLibraryPanel('none')
        ui.setCommandPaletteOpen(false)
        ui.setShortcutsOpen(false)
        if (ui.isPresenting) ui.setPresenting(false)
        return
      }

      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase()
        if (key === 'z') {
          e.preventDefault()
          e.shiftKey ? redo() : undo()
        } else if (key === 'y') {
          e.preventDefault()
          redo()
        } else if (key === 'c') {
          e.preventDefault()
          copySelection()
        } else if (key === 'x') {
          e.preventDefault()
          cutSelection()
        } else if (key === 'v') {
          e.preventDefault()
          pasteClipboard()
        } else if (key === 'd') {
          e.preventDefault()
          duplicateSelection()
        } else if (key === 'a') {
          e.preventDefault()
          selectAll()
        } else if (key === 's') {
          e.preventDefault()
          ui.setToast('Saved automatically')
          window.setTimeout(() => { if (useUIStore.getState().toast === 'Saved automatically') ui.setToast(null) }, 1600)
        } else if (key === 'g') {
          e.preventDefault()
          const boardState = useBoardStore.getState()
          if (e.shiftKey) {
            if (ui.selectedIds.length === 1) {
              const groupObj = boardState.objects[ui.selectedIds[0]] as any
              if (groupObj && groupObj.type === 'group') {
                boardState.ungroupObjects(ui.selectedIds[0])
                ui.setSelectedIds(groupObj.childIds || [])
              }
            }
          } else if (ui.selectedIds.length > 1) {
            const newGroupId = crypto.randomUUID()
            boardState.groupObjects(ui.selectedIds, newGroupId)
            ui.setSelectedIds([newGroupId])
          }
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        deleteSelection()
        return
      }

      if (!e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v': setActiveTool('select'); ui.setLibraryPanel('none'); break
          case 'h': setActiveTool('pan'); ui.setLibraryPanel('none'); break
          case 'p': setActiveTool('pen'); ui.setLibraryPanel('none'); break
          case 'e': setActiveTool('eraser'); ui.setLibraryPanel('none'); break
          case 't': setActiveTool('text'); ui.setLibraryPanel('none'); break
          case 'n': setActiveTool('sticky'); ui.setLibraryPanel('none'); break
          case 's': ui.setLibraryPanel(ui.libraryPanel === 'shapes' ? 'none' : 'shapes'); break
          case 'a': setActiveTool('arrow'); ui.setLibraryPanel('none'); break
          case 'l': setActiveTool('line'); ui.setLibraryPanel('none'); break
        }
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false)
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setSpacePressed, redo, undo, setSelectedIds, setActiveTool])

  useEffect(() => {
    const move = (e: MouseEvent) => {
      document.documentElement.style.setProperty('--spot-x', `${e.clientX}px`)
      document.documentElement.style.setProperty('--spot-y', `${e.clientY}px`)
    }
    window.addEventListener('mousemove', move)
    return () => window.removeEventListener('mousemove', move)
  }, [])

  return (
    <div className="w-full h-full flex flex-col relative bg-background overflow-hidden">
      {showIntro && (
      <IntroSequence onComplete={() => setShowIntro(false)} />
      )}
      <TopBar />
      <div className="flex-1 relative overflow-hidden">
        <Canvas />
        <LeftToolbar />
        <ShapesMenu />
        <RightWorkspace />
        <StylePanel />
        <FloatingObjectBar />
        <ZoomControls />
        <PresentationChrome />
        <SpotlightOverlay />
        <HomeDashboard />
      </div>
      <CommandPalette />
      <ShortcutsPanel />
      <MigrationPrompt
        open={migrationPrompt.open}
        onClose={closeMigration}
        onDone={(names) => {
          setMigrationPrompt({ open: false, boards: [] })
          if (names.length) {
            useUIStore
              .getState()
              .setToast(`Uploaded ${names.length} board${names.length > 1 ? 's' : ''} to cloud`)
          }
        }}
      />
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[90] rounded-full border border-border bg-card px-4 py-2 text-sm shadow-lg">
          {toast}
        </div>
      )}
    </div>
  )
}

export default App
