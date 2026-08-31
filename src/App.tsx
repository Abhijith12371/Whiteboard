import { useEffect, useState } from 'react'
import { TopBar } from './components/layout/TopBar'
import { LeftToolbar } from './components/layout/LeftToolbar'
import { Canvas } from './components/canvas/Canvas'
import { useUIStore } from './store/uiStore'
import { useBoardStore } from './store/boardStore'
import { loadBoard, saveBoard } from './services/db'

const DEFAULT_BOARD_ID = 'default-board-id'

import { ToolOptionsBar } from './components/canvas/ToolOptionsBar'

function App() {
  const setSpacePressed = useUIStore((state) => state.setSpacePressed)
  const setActiveTool = useUIStore((state) => state.setActiveTool)
  // selectedIds used in keyboard handler via getState()
  const setSelectedIds = useUIStore((state) => state.setSelectedIds)
  
  const undo = useBoardStore((state) => state.undo)
  const redo = useBoardStore((state) => state.redo)
  const deleteObjects = useBoardStore((state) => state.deleteObjects)
  
  const objects = useBoardStore((state) => state.objects)
  const objectIds = useBoardStore((state) => state.objectIds)
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [dbAvailable, setDbAvailable] = useState(true)

  // Load persisted board — always resolve, even if IDB is unavailable
  useEffect(() => {
    loadBoard(DEFAULT_BOARD_ID)
      .then(board => {
        if (board) {
          useBoardStore.setState({
            objects: board.data.objects,
            objectIds: board.data.objectIds,
            past: [],
            future: []
          })
        }
      })
      .catch(() => {
        // IndexedDB unavailable (e.g. Electron sandbox restrictions) — just start fresh
        setDbAvailable(false)
      })
      .finally(() => {
        setIsLoaded(true)
      })
  }, [])

  // Auto-save (only when IDB is available)
  useEffect(() => {
    if (!isLoaded || !dbAvailable) return
    const timeoutId = setTimeout(() => {
      saveBoard(DEFAULT_BOARD_ID, 'My Board', objects, objectIds).catch(() => {
        setDbAvailable(false)
      })
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [objects, objectIds, isLoaded, dbAvailable])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Space for panning
      if (e.code === 'Space' && !e.repeat) {
        setSpacePressed(true)
      }

      // Undo/Redo
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          if (e.shiftKey) redo()
          else undo()
        }
      }

      // Delete
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useUIStore.getState()
        if (state.selectedIds.length > 0) {
          deleteObjects(state.selectedIds)
          setSelectedIds([])
        }
      }

      // Tools
      if (!e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
        switch (e.key.toLowerCase()) {
          case 'v': setActiveTool('select'); break;
          case 'h': setActiveTool('pan'); break;
          case 'p': setActiveTool('pen'); break;
          case 'e': setActiveTool('eraser'); break;
          case 't': setActiveTool('text'); break;
          case 'n': setActiveTool('sticky'); break;
          case 'r': setActiveTool('rectangle'); break;
        }
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setSpacePressed(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [setSpacePressed, redo, undo, deleteObjects, setSelectedIds, setActiveTool])

  // Always render — persistence is best-effort

  return (
    <div className="w-full h-full flex flex-col relative bg-background overflow-hidden">
      <TopBar />
      <div className="flex-1 relative overflow-hidden">
        <Canvas />
        <LeftToolbar />
        <ToolOptionsBar />
      </div>
    </div>
  )
}

export default App
