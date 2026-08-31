import { Trash2 } from 'lucide-react'
import { useBoardStore } from '../../store/boardStore'
import { useUIStore } from '../../store/uiStore'
import { BoardSettingsPanel } from './BoardSettingsPanel'

export const TopBar = () => {
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
      link.download = 'whiteboard.png'
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
    link.download = 'whiteboard.json'
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
      className="h-12 border-b border-border flex items-center justify-between px-4 z-10 shrink-0"
      style={{ background: 'var(--card)', WebkitAppRegion: 'drag' } as any}
    >
      {/* Logo */}
      <div className="flex items-center gap-2" style={{ WebkitAppRegion: 'no-drag' } as any}>
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}
        >
          W
        </div>
        <span className="font-semibold text-sm">Whiteboard</span>
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

        <button onClick={handleImportJSON} className="px-3 py-1.5 text-sm hover:bg-accent rounded-md transition-colors">
          Import
        </button>
        <button onClick={handleExportPNG} className="px-3 py-1.5 text-sm hover:bg-accent rounded-md transition-colors">
          PNG
        </button>
        <button onClick={handleExportJSON} className="px-3 py-1.5 text-sm hover:bg-accent rounded-md transition-colors">
          JSON
        </button>
      </div>
    </div>
  )
}
