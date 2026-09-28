import { useState } from 'react'
import { Minus, Plus, Maximize2, MoreVertical, Grid3x3, Map } from 'lucide-react'
import { useBoardStore } from '../../store/boardStore'
import { useUIStore } from '../../store/uiStore'
import { fitToScreen, setZoomPercent } from '../../lib/workspaceActions'
import { ToolbarTip } from '../ui/ToolbarTip'

export function ZoomControls() {
  const scale = useBoardStore((s) => s.scale)
  const setScale = useBoardStore((s) => s.setScale)
  const isPresenting = useUIStore((s) => s.isPresenting)
  const boardBackground = useUIStore((s) => s.boardBackground)
  const setBoardBackground = useUIStore((s) => s.setBoardBackground)
  const [showViewMenu, setShowViewMenu] = useState(false)
  const [minimap, setMinimap] = useState(false)
  
  if (isPresenting) return null

  const pct = Math.round(scale * 100)

  return (
    <>
      <div 
        className="absolute bottom-5 right-4 z-20 flex items-center gap-0.5 rounded-lg border backdrop-blur-md px-2 py-1.5 shadow-sm"
        style={{ 
          background: 'var(--card)', 
          borderColor: 'var(--border)',
          boxShadow: 'var(--shadow-sm, 0 1px 2px 0 rgba(0, 0, 0, 0.05))'
        }}
      >
        {/* Zoom Out */}
        <ToolbarTip label="Zoom out" shortcut="Scroll">
          <button 
            aria-label="Zoom out" 
            className="w-[26px] h-[26px] rounded flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" 
            onClick={() => setScale(Math.max(0.1, scale / 1.15))}
          >
            <Minus size={14} />
          </button>
        </ToolbarTip>

        {/* Zoom Percentage Display */}
        <button
          className="min-w-[44px] text-xs font-medium text-foreground hover:bg-accent/50 px-2 py-0.5 rounded transition-colors text-center"
          onClick={() => setZoomPercent(100)}
          title="Reset zoom to 100%"
          aria-label={`Current zoom: ${pct}%. Click to reset to 100%`}
        >
          {pct}%
        </button>

        {/* Zoom In */}
        <ToolbarTip label="Zoom in" shortcut="Scroll">
          <button 
            aria-label="Zoom in" 
            className="w-[26px] h-[26px] rounded flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" 
            onClick={() => setScale(Math.min(10, scale * 1.15))}
          >
            <Plus size={14} />
          </button>
        </ToolbarTip>

        {/* Divider */}
        <div className="w-px h-7 bg-border mx-0.5" />

        {/* Fit to Screen */}
        <ToolbarTip label="Fit to screen">
          <button 
            aria-label="Fit to screen" 
            className="w-[26px] h-[26px] rounded flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" 
            onClick={fitToScreen}
          >
            <Maximize2 size={14} />
          </button>
        </ToolbarTip>

        {/* Divider */}
        <div className="w-px h-7 bg-border mx-0.5" />

        {/* View Options Menu */}
        <div className="relative">
          <ToolbarTip label="View options">
            <button 
              aria-label="View options" 
              aria-expanded={showViewMenu}
              className="w-[26px] h-[26px] rounded flex items-center justify-center hover:bg-accent transition-colors text-muted-foreground hover:text-foreground" 
              onClick={() => setShowViewMenu(!showViewMenu)}
            >
              <MoreVertical size={14} />
            </button>
          </ToolbarTip>

          {showViewMenu && (
            <>
              <div 
                className="fixed inset-0 z-10" 
                onClick={() => setShowViewMenu(false)}
                aria-hidden="true"
              />
              <div 
                className="absolute bottom-full right-0 mb-2 w-40 rounded-lg border backdrop-blur-md shadow-lg py-1 z-20"
                style={{ 
                  background: 'var(--card)', 
                  borderColor: 'var(--border)',
                }}
                role="menu"
              >
                <button
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent transition-colors"
                  onClick={() => {
                    setBoardBackground(boardBackground === 'grid' ? 'blank' : 'grid')
                    setShowViewMenu(false)
                  }}
                  role="menuitem"
                  aria-label={`Toggle grid: currently ${boardBackground === 'grid' ? 'on' : 'off'}`}
                >
                  <Grid3x3 size={14} />
                  <span style={{ color: 'var(--foreground)' }}>
                    {boardBackground === 'grid' ? 'Hide Grid' : 'Show Grid'}
                  </span>
                </button>
                <button
                  className="w-full px-3 py-2 text-left text-sm flex items-center gap-2 hover:bg-accent transition-colors"
                  onClick={() => {
                    setMinimap(!minimap)
                    setShowViewMenu(false)
                  }}
                  role="menuitem"
                  aria-label={`Toggle minimap: currently ${minimap ? 'on' : 'off'}`}
                >
                  <Map size={14} />
                  <span style={{ color: 'var(--foreground)' }}>
                    {minimap ? 'Hide Minimap' : 'Show Minimap'}
                  </span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {minimap && <MiniMap />}
    </>
  )
}

function MiniMap() {
  const objects = useBoardStore((s) => s.objects)
  const objectIds = useBoardStore((s) => s.objectIds)
  
  return (
    <div 
      className="absolute bottom-20 right-4 w-48 h-32 rounded-lg border backdrop-blur-sm overflow-hidden shadow-xl z-20"
      style={{
        background: 'var(--card)',
        borderColor: 'var(--border)',
      }}
    >
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
