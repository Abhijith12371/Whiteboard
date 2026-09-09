import { useEffect, useState } from 'react'
import { TopBar } from './components/layout/TopBar'
import { LeftToolbar } from './components/layout/LeftToolbar'
import { Canvas } from './components/canvas/Canvas'
import { useUIStore } from './store/uiStore'
import { useBoardStore } from './store/boardStore'
import { loadBoard, saveBoard, listBoards } from './services/db'

import { ToolOptionsBar } from './components/canvas/ToolOptionsBar'
import { HomeDashboard } from './components/layout/HomeDashboard'

function App() {
  const setSpacePressed = useUIStore((state) => state.setSpacePressed)
  const setActiveTool = useUIStore((state) => state.setActiveTool)
  // selectedIds used in keyboard handler via getState()
  const setSelectedIds = useUIStore((state) => state.setSelectedIds)
  
  const activeBoardId = useUIStore((state) => state.activeBoardId)
  const activeBoardName = useUIStore((state) => state.activeBoardName)
  const setActiveBoard = useUIStore((state) => state.setActiveBoard)

  const undo = useBoardStore((state) => state.undo)
  const redo = useBoardStore((state) => state.redo)
  const deleteObjects = useBoardStore((state) => state.deleteObjects)
  
  const objects = useBoardStore((state) => state.objects)
  const objectIds = useBoardStore((state) => state.objectIds)
  
  const [isLoaded, setIsLoaded] = useState(false)
  const [dbAvailable, setDbAvailable] = useState(true)

  // Initial load - try to find latest board, otherwise use default
  useEffect(() => {
    listBoards().then(boards => {
      let targetId = 'default-board-id'
      let targetName = 'Whiteboard'

      if (boards.length > 0) {
        const latest = boards.sort((a, b) => b.updatedAt - a.updatedAt)[0]
        targetId = latest.id
        targetName = latest.name
      }
      
      setActiveBoard(targetId, targetName)
    }).catch(() => {
      setDbAvailable(false)
      setIsLoaded(true)
    })
  }, []) // run once

  // Load persisted board when activeBoardId changes
  useEffect(() => {
    if (!activeBoardId || !dbAvailable) return
    setIsLoaded(false)
    loadBoard(activeBoardId)
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
        setDbAvailable(false)
      })
      .finally(() => {
        setIsLoaded(true)
      })
  }, [activeBoardId, dbAvailable])

  // Auto-save (only when IDB is available)
  useEffect(() => {
    if (!isLoaded || !dbAvailable) return
    const timeoutId = setTimeout(() => {
      saveBoard(activeBoardId, activeBoardName, objects, objectIds).catch(() => {
        setDbAvailable(false)
      })
    }, 1000)
    return () => clearTimeout(timeoutId)
  }, [objects, objectIds, isLoaded, dbAvailable, activeBoardId, activeBoardName])

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
        <HomeDashboard />
      </div>
    </div>
  )
}

export default App
