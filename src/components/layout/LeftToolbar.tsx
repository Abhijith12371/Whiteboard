import React, { useEffect, useRef, useState } from 'react'
import {
  MousePointer2, Hand, Pen, Pencil, Highlighter, Eraser, Type, StickyNote,
  Shapes, Smile, Sticker, Image as ImageIcon, Ellipsis, Crosshair, ArrowRight,
  GripVertical,
} from 'lucide-react'
import { clsx } from 'clsx'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { ToolbarTip } from '../ui/ToolbarTip'
import { AssetLibrary, MediaMenu, MoreToolsMenu } from './AssetLibrary'

const LAYOUT_KEY = 'digiboard_toolbar_layout'
const MIN_ITEM = 14
const MAX_ITEM = 30
const DEFAULT_ITEM = 18

interface ToolbarLayout {
  /** null keeps the toolbar at its default slot. */
  x: number | null
  y: number | null
  itemSize: number
}

const DEFAULT_LAYOUT: ToolbarLayout = { x: null, y: null, itemSize: DEFAULT_ITEM }

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function loadLayout(): ToolbarLayout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY)
    if (!raw) return DEFAULT_LAYOUT
    const parsed = JSON.parse(raw) || {}
    return {
      x: typeof parsed.x === 'number' ? parsed.x : null,
      y: typeof parsed.y === 'number' ? parsed.y : null,
      itemSize: clamp(Number(parsed.itemSize) || DEFAULT_ITEM, MIN_ITEM, MAX_ITEM),
    }
  } catch {
    return DEFAULT_LAYOUT
  }
}

export const LeftToolbar: React.FC = () => {
  const activeTool = useUIStore((s) => s.activeTool)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const libraryPanel = useUIStore((s) => s.libraryPanel)
  const setLibraryPanel = useUIStore((s) => s.setLibraryPanel)
  const isPresenting = useUIStore((s) => s.isPresenting)

  const barRef = useRef<HTMLDivElement>(null)
  const [layout, setLayout] = useState<ToolbarLayout>(loadLayout)
  const dragRef = useRef<{
    mode: 'move' | 'resize'
    startX: number
    startY: number
    start: ToolbarLayout & { x: number; y: number }
  } | null>(null)

  // Persist only when a drag finishes, not on every pointer move.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current
      const bar = barRef.current
      if (!drag || !bar) return

      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY

      if (drag.mode === 'move') {
        const parent = bar.parentElement
        const bounds = parent?.getBoundingClientRect()
        const rect = bar.getBoundingClientRect()
        const maxX = (bounds?.width ?? window.innerWidth) - rect.width
        const maxY = (bounds?.height ?? window.innerHeight) - rect.height
        setLayout({
          ...drag.start,
          x: clamp(drag.start.x + dx, 0, Math.max(0, maxX)),
          y: clamp(drag.start.y + dy, 0, Math.max(0, maxY)),
        })
      } else {
        setLayout({ ...drag.start, itemSize: clamp(drag.start.itemSize + dy, MIN_ITEM, MAX_ITEM) })
      }
    }

    const onUp = () => {
      if (!dragRef.current) return
      dragRef.current = null
      setLayout((current) => {
        try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(current)) } catch { /* ignore */ }
        return current
      })
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [])

  const startDrag = (mode: 'move' | 'resize') => (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const bar = barRef.current
    if (!bar) return
    const bounds = bar.parentElement?.getBoundingClientRect()
    const rect = bar.getBoundingClientRect()
    dragRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      start: {
        ...layout,
        x: layout.x ?? 16,
        y: layout.y ?? Math.round(((bounds?.height ?? window.innerHeight) - rect.height) / 2),
      },
    }
  }

  const resetLayout = () => {
    try { localStorage.removeItem(LAYOUT_KEY) } catch { /* ignore */ }
    setLayout(DEFAULT_LAYOUT)
  }

  const toggleLib = (panel: typeof libraryPanel) => {
    setLibraryPanel(libraryPanel === panel ? 'none' : panel)
  }

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const src = event.target?.result as string
      const img = new Image()
      img.onload = () => {
        const id = crypto.randomUUID()
        const max = 480
        const scale = Math.min(1, max / Math.max(img.width, img.height))
        useBoardStore.getState().addObject({
          id, type: 'image',
          x: window.innerWidth / 2 - (img.width * scale) / 2,
          y: window.innerHeight / 2 - (img.height * scale) / 2,
          width: img.width * scale, height: img.height * scale,
          src, rotation: 0, opacity: 1, locked: false, zIndex: 0, assetKind: 'image',
        } as any)
        useUIStore.getState().setSelectedIds([id])
        setActiveTool('select')
        setLibraryPanel('none')
      }
      img.src = src
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  if (isPresenting) return null

  const tools: { id: string; icon: any; label: string; description?: string; shortcut?: string; action: () => void; active?: boolean }[] = [
    { id: 'select', icon: MousePointer2, label: 'Select', shortcut: 'V', action: () => { setActiveTool('select'); setLibraryPanel('none') }, active: activeTool === 'select' },
    { id: 'pan', icon: Hand, label: 'Pan', shortcut: 'H', action: () => { setActiveTool('pan'); setLibraryPanel('none') }, active: activeTool === 'pan' },
    { id: 'pen', icon: Pen, label: 'Pen', shortcut: 'P', description: 'Smooth, fluid strokes', action: () => { setActiveTool('pen'); setLibraryPanel('none') }, active: activeTool === 'pen' },
    { id: 'pencil', icon: Pencil, label: 'Pencil', description: 'Sketchy, hand-drawn', action: () => { setActiveTool('pencil'); setLibraryPanel('none') }, active: activeTool === 'pencil' },
    { id: 'highlighter', icon: Highlighter, label: 'Highlighter', description: 'Thick, transparent marker', action: () => { setActiveTool('highlighter'); setLibraryPanel('none') }, active: activeTool === 'highlighter' },
    { id: 'eraser', icon: Eraser, label: 'Eraser', shortcut: 'E', action: () => { setActiveTool('eraser'); setLibraryPanel('none') }, active: activeTool === 'eraser' },
    { id: 'laser', icon: Crosshair, label: 'Laser', action: () => { setActiveTool('laser'); setLibraryPanel('none') }, active: activeTool === 'laser' },
    { id: 'text', icon: Type, label: 'Text', shortcut: 'T', action: () => { setActiveTool('text'); setLibraryPanel('none') }, active: activeTool === 'text' },
    { id: 'sticky', icon: StickyNote, label: 'Note', shortcut: 'N', action: () => { setActiveTool('sticky'); setLibraryPanel('none') }, active: activeTool === 'sticky' },
    { id: 'shapes', icon: Shapes, label: 'Shapes', shortcut: 'S', action: () => toggleLib('shapes'), active: libraryPanel === 'shapes' || ['rectangle', 'circle', 'triangle', 'line', 'arrow', 'shape'].includes(activeTool) },
    { id: 'arrow', icon: ArrowRight, label: 'Arrow', shortcut: 'A', action: () => { setActiveTool('arrow'); setLibraryPanel('none') }, active: activeTool === 'arrow' },
    { id: 'icons', icon: Smile, label: 'Icons', action: () => toggleLib('icons'), active: libraryPanel === 'icons' },
    { id: 'stickers', icon: Sticker, label: 'Stickers', action: () => toggleLib('stickers'), active: libraryPanel === 'stickers' },
    { id: 'media', icon: ImageIcon, label: 'Media', action: () => toggleLib('media'), active: libraryPanel === 'media' },
    { id: 'more', icon: Ellipsis, label: 'More', action: () => toggleLib('more'), active: libraryPanel === 'more' },
  ]

  const itemPad = Math.round(layout.itemSize * 0.55)
  const itemGap = Math.max(2, Math.round(layout.itemSize * 0.22))
  const mobileItemSize = 16 // Fixed size for mobile

  return (
    <>
      <div
        ref={barRef}
        className="absolute z-20 flex flex-col sm:flex-col rounded-xl shadow-lg border border-border bg-card max-h-[calc(100vh-8rem)] sm:max-h-none overflow-y-auto sm:overflow-visible"
        style={{
          left: layout.x ?? 8,
          top: layout.y ?? '50%',
          transform: layout.y === null ? 'translateY(-50%)' : undefined,
          padding: 6,
          gap: itemGap,
        }}
      >
        <div
          onPointerDown={startDrag('move')}
          onDoubleClick={resetLayout}
          role="separator"
          aria-label="Move toolbar. Drag to reposition, double-click to reset."
          title="Drag to move · double-click to reset"
          className="hidden sm:flex cursor-grab touch-none select-none items-center justify-center rounded-lg py-0.5 text-muted-foreground/60 hover:bg-accent/60 hover:text-foreground active:cursor-grabbing"
        >
          <GripVertical size={14} />
        </div>

        <input type="file" id="image-upload" accept="image/*,.svg" className="hidden" onChange={handleImageUpload} />
        <input
          type="file"
          id="file-upload"
          accept=".pdf,.json,.txt,.png,.jpg,.jpeg,.svg"
          className="hidden"
          onChange={handleImageUpload}
        />
        {tools.map((tool) => (
          <ToolbarTip key={tool.id} label={tool.label} shortcut={tool.shortcut}>
            <button
              aria-label={tool.label}
              onClick={tool.action}
              className={clsx(
                'rounded-lg transition-all hover:bg-accent p-2 sm:p-[var(--item-pad)]',
                tool.active ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
              style={{
                '--item-pad': `${itemPad}px`,
              } as React.CSSProperties}
              title={tool.description}
            >
              <tool.icon size={mobileItemSize} className="sm:hidden" />
              <tool.icon size={layout.itemSize} className="hidden sm:block" />
            </button>
          </ToolbarTip>
        ))}

        <div
          onPointerDown={startDrag('resize')}
          role="separator"
          aria-label="Resize toolbar. Drag to change button size."
          title="Drag to resize"
          className="hidden sm:flex cursor-nwse-resize touch-none select-none items-center justify-end rounded-lg py-0.5 text-muted-foreground/60 hover:bg-accent/60 hover:text-foreground"
        >
          <GripVertical size={12} className="-rotate-45" />
        </div>
      </div>
      <AssetLibrary />
      <MediaMenu />
      <MoreToolsMenu />
    </>
  )
}
