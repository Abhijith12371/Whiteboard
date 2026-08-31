import React from 'react'
import { MousePointer2, Hand, Pen, Eraser, Type, Square, Circle, Triangle, Image as ImageIcon, StickyNote, Minus, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'

const TOOL_ICONS = [
  { id: 'select', icon: MousePointer2, tooltip: 'Select (V)' },
  { id: 'pan', icon: Hand, tooltip: 'Pan (H)' },
  { id: 'pen', icon: Pen, tooltip: 'Pen (P)' },
  { id: 'eraser', icon: Eraser, tooltip: 'Eraser (E)' },
  { id: 'text', icon: Type, tooltip: 'Text (T)' },
  { id: 'sticky', icon: StickyNote, tooltip: 'Sticky Note (N)' },
  { id: 'rectangle', icon: Square, tooltip: 'Rectangle (R)' },
  { id: 'circle', icon: Circle, tooltip: 'Circle' },
  { id: 'triangle', icon: Triangle, tooltip: 'Triangle' },
  { id: 'line', icon: Minus, tooltip: 'Line' },
  { id: 'arrow', icon: ArrowRight, tooltip: 'Arrow' },
  { id: 'image', icon: ImageIcon, tooltip: 'Image' },
]

export const LeftToolbar: React.FC = () => {
  const activeTool = useUIStore((state) => state.activeTool)
  const setActiveTool = useUIStore((state) => state.setActiveTool)
  
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = (event) => {
        const src = event.target?.result as string
        const img = new Image()
        img.onload = () => {
          // Add to board store
          const id = crypto.randomUUID()
          useBoardStore.getState().addObject({
            id,
            type: 'image',
            x: window.innerWidth / 2 - img.width / 2,
            y: window.innerHeight / 2 - img.height / 2,
            width: img.width,
            height: img.height,
            src,
            rotation: 0,
            opacity: 1,
            locked: false,
            zIndex: 0
          } as any)
          useUIStore.getState().setSelectedIds([id])
          setActiveTool('select')
        }
        img.src = src
      }
      reader.readAsDataURL(file)
    }
  }

  return (
    <div className="absolute left-4 top-1/2 -translate-y-1/2 flex flex-col gap-1 p-2 bg-card rounded-xl shadow-lg border border-border z-10">
      <input type="file" id="image-upload" accept="image/*" className="hidden" onChange={handleImageUpload} />
      {TOOL_ICONS.map((tool) => {
        if (tool.id === 'image') {
          return (
            <button
              key={tool.id}
              onClick={() => document.getElementById('image-upload')?.click()}
              className={clsx(
                "p-2 rounded-lg transition-colors hover:bg-accent text-muted-foreground"
              )}
              title={tool.tooltip}
            >
              <tool.icon size={20} />
            </button>
          )
        }
        return (
          <button
            key={tool.id}
            onClick={() => setActiveTool(tool.id as any)}
            className={clsx(
              "p-2 rounded-lg transition-colors hover:bg-accent",
              activeTool === tool.id ? "bg-accent text-accent-foreground" : "text-muted-foreground"
            )}
            title={tool.tooltip}
          >
            <tool.icon size={20} />
          </button>
        )
      })}
    </div>
  )
}
