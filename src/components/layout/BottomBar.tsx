import { useState } from 'react'
import { Minus, Plus, Maximize2, Grid3x3, Map } from 'lucide-react'
import { useBoardStore } from '../../store/boardStore'
import { useUIStore } from '../../store/uiStore'
import { fitToContent, fitToScreen, setZoomPercent } from '../../lib/workspaceActions'
import { ToolbarTip } from '../ui/ToolbarTip'

export function BottomBar() {
  const scale = useBoardStore((s) => s.scale)
  const setScale = useBoardStore((s) => s.setScale)
  const isPresenting = useUIStore((s) => s.isPresenting)
  const boardBackground = useUIStore((s) => s.boardBackground)
  const setBoardBackground = useUIStore((s) => s.setBoardBackground)
  const [minimap, setMinimap] = useState(false)
  
  if (isPresenting) return null

  const pct = Math.round(scale * 100)

  return (
    <div className="absolute bottom-6 left-1/2 z-20 -translate-x-1/2 flex items-center gap-2 rounded-xl border border-border/50 bg-card/90 backdrop-blur-md px-4 py-2 shadow-xl">
      {/* Zoom Controls */}
      <div className="flex items-center gap-2">
        <ToolbarTip label="Zoom out" shortcut="Scroll">
          <button 
            aria-label="Zoom out" 
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" 
            onClick={() => setScale(Math.max(0.1, scale / 1.15))}
          >
            <Minus size={16} />
          </button>
        </ToolbarTip>

        {/* Zoom Percentage Display */}
        <button
          className="min-w-[56px] text-xs font-medium text-foreground hover:bg-accent/50 px-2 py-1 rounded-lg transition-colors text-center"
          onClick={() => setZoomPercent(100)}
          title="Reset zoom to 100%"
        >
          {pct}%
        </button>

        <ToolbarTip label="Zoom in" shortcut="Scroll">
          <button 
            aria-label="Zoom in" 
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" 
            onClick={() => setScale(Math.min(10, scale * 1.15))}
          >
            <Plus size={16} />
          </button>
        </ToolbarTip>
      </div>

      <div className="w-px h-5 bg-border/30" />

      {/* Fit Controls */}
      <div className="flex items-center gap-1">
        <ToolbarTip label="Fit to screen">
          <button 
            aria-label="Fit to screen" 
            className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" 
            onClick={fitToScreen}
          >
            <Maximize2 size={16} />
          </button>
        </ToolbarTip>
        <ToolbarTip label="Fit to content">
          <button 
            className="px-2 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/50 rounded-lg transition-colors" 
            onClick={fitToContent}
          >
            Fit
          </button>
        </ToolbarTip>
      </div>

      <div className="w-px h-5 bg-border/30" />

      {/* Canvas Settings */}
      <div className="flex items-center gap-1">
        <ToolbarTip label={`Canvas: ${boardBackground === 'grid' ? 'Grid' : 'Blank'}`}>
          <button
            aria-label="Toggle grid"
            className={`p-1.5 rounded-lg transition-all ${boardBackground === 'grid' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`}
            onClick={() => setBoardBackground(boardBackground === 'grid' ? 'blank' : 'grid')}
          >
            <Grid3x3 size={16} />
          </button>
        </ToolbarTip>
        <ToolbarTip label="Minimap">
          <button 
            aria-label="Minimap" 
            className={`p-1.5 rounded-lg transition-all ${minimap ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'}`} 
            onClick={() => setMinimap((v) => !v)}
          >
            <Map size={16} />
          </button>
        </ToolbarTip>
      </div>

      {minimap && <MiniMap />}
    </div>
  )
}

function MiniMap() {
  const objects = useBoardStore((s) => s.objects)
  const objectIds = useBoardStore((s) => s.objectIds)
  
  return (
    <div className="absolute bottom-14 right-0 w-48 h-32 rounded-lg border border-border bg-card/95 backdrop-blur-sm overflow-hidden shadow-xl">
      {objectIds.slice(0, 80).map((id) => {
        const o = objects[id]
        if (!o) return null
        return (
          <div
            key={id}
            className="absolute bg-info/60 hover:bg-info/80 transition-colors rounded-sm"
            style={{
              left: `${((o.x + 2000) / 6000) * 100}%`,
              top: `${((o.y + 2000) / 4000) * 100}%`,
              width: Math.max(2, (o.width || 20) / 40),
              height: Math.max(2, (o.height || 20) / 40),
            }}
          />
        )
      })}
    </div>
  )
}
