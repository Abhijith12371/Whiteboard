import { useState, useEffect } from 'react'
import { Trash2, Home, Download, Upload, Image as ImageIcon } from 'lucide-react'
import { useBoardStore } from '../../store/boardStore'
import { useUIStore } from '../../store/uiStore'
import { BoardSettingsPanel } from './BoardSettingsPanel'

export const TopBar = () => {
  const activeBoardId = useUIStore(s => s.activeBoardId)
  const activeBoardName = useUIStore(s => s.activeBoardName)
  const setActiveBoard = useUIStore(s => s.setActiveBoard)
  const setHomeOpen = useUIStore(s => s.setHomeOpen)
  
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleValue, setTitleValue] = useState(activeBoardName)

  useEffect(() => {
    setTitleValue(activeBoardName)
  }, [activeBoardName])

  const handleTitleSubmit = () => {
    const newTitle = titleValue.trim() || 'Untitled Board'
    setActiveBoard(activeBoardId, newTitle)
    setEditingTitle(false)
  }

  const handleClearCanvas = () => {
    if (window.confirm('Clear all objects from the canvas? This cannot be undone.')) {
      const { objectIds } = useBoardStore.getState()
      useBoardStore.getState().deleteObjects(objectIds)
      useUIStore.getState().setSelectedIds([])
    }
  }

  const handleExportPNG = () => {
    const canvasEls = document.querySelectorAll('.konvajs-content canvas')
    const stage = canvasEls[0] as HTMLCanvasElement
    if (stage) {
      const dataUrl = stage.toDataURL('image/png')
      const link = document.createElement('a')
      link.download = `${activeBoardName.replace(/\s+/g, '_')}.png`
      link.href = dataUrl
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    }
  }

  const handleExportJSON = () => {
    const objects = useBoardStore.getState().objects
    const objectIds = useBoardStore.getState().objectIds
    const data = JSON.stringify({ objects, objectIds }, null, 2)
    const blob = new Blob([data], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.download = `${activeBoardName.replace(/\s+/g, '_')}.json`
    link.href = url
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  const handleImportJSON = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json'
    input.onchange = (e: any) => {
      const file = e.target.files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (ev) => {
          try {
            const data = JSON.parse(ev.target?.result as string)
            if (data.objects && data.objectIds) {
              useBoardStore.setState({
                objects: data.objects,
                objectIds: data.objectIds,
                past: [],
                future: []
              })
              useUIStore.getState().setSelectedIds([])
            }
          } catch {
            console.error('Failed to parse board file')
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }

  return (
    <div
      className="h-12 border-b border-border flex items-center justify-between px-4 pr-[140px] z-10 shrink-0"
      style={{ background: 'var(--card)', WebkitAppRegion: 'drag' } as any}
    >
      {/* Left side: Home & Title */}
      <div className="flex items-center gap-3" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <button 
          onClick={() => setHomeOpen(true)}
          className="p-1.5 hover:bg-accent rounded-md text-muted-foreground transition-colors"
          title="Home / All Boards"
        >
          <Home size={18} />
        </button>
        
        <div className="w-px h-5 bg-border" />

        {editingTitle ? (
          <input
            autoFocus
            value={titleValue}
            onChange={e => setTitleValue(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={e => e.key === 'Enter' && handleTitleSubmit()}
            className="font-semibold text-sm bg-accent px-2 py-0.5 rounded outline-none border border-primary/50"
          />
        ) : (
          <button 
            onClick={() => setEditingTitle(true)}
            className="font-semibold text-sm px-2 py-0.5 hover:bg-accent rounded outline-none text-left truncate max-w-[200px]"
          >
            {activeBoardName}
          </button>
        )}
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <BoardSettingsPanel />

        <div className="w-px h-5 bg-border mx-1" />

        <button
          onClick={handleClearCanvas}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-500 hover:bg-red-50 rounded-md transition-colors"
          title="Clear Canvas"
        >
          <Trash2 size={14} />
          <span>Clear</span>
        </button>

        <div className="w-px h-5 bg-border mx-1" />

        <button onClick={handleImportJSON} className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground" title="Import JSON">
          <Upload size={16} />
        </button>
        <button onClick={handleExportPNG} className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground" title="Export PNG">
          <ImageIcon size={16} />
        </button>
        <button onClick={handleExportJSON} className="p-1.5 hover:bg-accent rounded-md transition-colors text-muted-foreground" title="Export JSON">
          <Download size={16} />
        </button>
      </div>
    </div>
  )
}
