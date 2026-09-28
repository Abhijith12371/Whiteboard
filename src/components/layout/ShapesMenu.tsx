import React, { useState } from 'react'
import { Square, Circle, Triangle, ArrowRight, LineChart, X, Plus } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'

interface ShapeItem {
  id: string
  name: string
  icon: React.ReactNode
  action: () => void
}

export const ShapesMenu: React.FC = () => {
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const libraryPanel = useUIStore((s) => s.libraryPanel)
  const setLibraryPanel = useUIStore((s) => s.setLibraryPanel)
  const [expanded, setExpanded] = useState(false)

  if (libraryPanel !== 'shapes' || !expanded) return null

  const shapes: ShapeItem[] = [
    { id: 'rectangle', name: 'Rectangle', icon: <Square size={20} />, action: () => { setActiveTool('rectangle'); setLibraryPanel('none') } },
    { id: 'circle', name: 'Circle', icon: <Circle size={20} />, action: () => { setActiveTool('circle'); setLibraryPanel('none') } },
    { id: 'triangle', name: 'Triangle', icon: <Triangle size={20} />, action: () => { setActiveTool('triangle'); setLibraryPanel('none') } },
    { id: 'arrow', name: 'Arrow', icon: <ArrowRight size={20} />, action: () => { setActiveTool('arrow'); setLibraryPanel('none') } },
    { id: 'line', name: 'Line', icon: <LineChart size={20} />, action: () => { setActiveTool('line'); setLibraryPanel('none') } },
    { id: 'shape', name: 'More Shapes', icon: <Plus size={20} />, action: () => { setActiveTool('shape'); setLibraryPanel('none') } },
  ]

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 z-30">
      <div className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        <div className="px-4 py-3 bg-accent/10 border-b border-border flex items-center justify-between">
          <h3 className="font-semibold text-sm">Shapes & Connectors</h3>
          <button
            onClick={() => { setExpanded(false); setLibraryPanel('none') }}
            className="p-1 hover:bg-accent rounded transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-1 p-2">
          {shapes.map((shape) => (
            <button
              key={shape.id}
              onClick={shape.action}
              className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-accent transition-colors text-foreground/70 hover:text-foreground"
              title={shape.name}
            >
              {shape.icon}
              <span className="text-xs font-medium text-center">{shape.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
