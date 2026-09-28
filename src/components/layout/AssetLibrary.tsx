import { useMemo, useState } from 'react'
import { Heart, Search, Star } from 'lucide-react'
import { ICON_CATEGORIES, searchIcons } from '../../lib/assets/iconCatalog'
import { searchStickers } from '../../lib/assets/stickerCatalog'
import { searchShapes, type ShapeKind } from '../../lib/assets/shapeCatalog'
import { getLucideIcon } from '../../lib/lucideSvg'
import { insertIcon, insertSticker } from '../../lib/insertAssets'
import { useUIStore } from '../../store/uiStore'
import { ShapeIcon } from '../ui/ShapeIcon'

function useLocalList(key: string) {
  const [list, setList] = useState<string[]>(() => {
    try { 
      const parsed = JSON.parse(localStorage.getItem(key) || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch { 
      return [] 
    }
  })
  const toggle = (id: string) => {
    setList((prev) => {
      // Ensure prev is an array
      const prevArray = Array.isArray(prev) ? prev : []
      const next = prevArray.includes(id) ? prevArray.filter((x) => x !== id) : [id, ...prevArray]
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }
  return { list, toggle, setList }
}

export function AssetLibrary() {
  const panel = useUIStore((s) => s.libraryPanel)
  const setLibraryPanel = useUIStore((s) => s.setLibraryPanel)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const setShapeKind = useUIStore((s) => s.setShapeKind)

  if (panel === 'none' || panel === 'media' || panel === 'more') return null

  return (
    <div className="absolute left-[72px] top-1/2 z-30 w-[340px] max-h-[min(72vh,640px)] -translate-y-1/2 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <h3 className="text-sm font-semibold">
          {panel === 'icons' && 'Insert Icons'}
          {panel === 'stickers' && 'Stickers & Labels'}
          {panel === 'shapes' && 'Shapes'}
        </h3>
        <button className="text-xs text-muted-foreground hover:text-foreground px-2 py-1" onClick={() => setLibraryPanel('none')}>Close</button>
      </div>
      {panel === 'icons' && <IconsPane />}
      {panel === 'stickers' && <StickersPane />}
      {panel === 'shapes' && (
        <ShapesPane
          onPick={(kind, tool) => {
            setShapeKind(kind)
            if (tool) setActiveTool(tool)
            else setActiveTool('shape')
            setLibraryPanel('none')
          }}
        />
      )}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <div className="relative px-3 py-2">
      <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-muted-foreground" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-border bg-background pl-8 pr-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring/40"
      />
    </div>
  )
}

function IconsPane() {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('All')
  const fav = useLocalList('digiboard_icon_favorites')
  const recent = useLocalList('digiboard_icon_recent')
  const filtered = useMemo(() => {
    try {
      let list = searchIcons(q)
      if (cat === 'Favorites') list = list.filter((i) => fav.list.includes(i.id))
      else if (cat === 'Recent') list = list.filter((i) => recent.list.includes(i.id))
      else if (cat !== 'All') list = list.filter((i) => i.category === cat)
      return list
    } catch (error) {
      console.error('Error filtering icons:', error)
      return searchIcons(q) // Fallback to basic search
    }
  }, [q, cat, fav.list, recent.list])

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SearchBox value={q} onChange={setQ} placeholder="Search icons — try brain, python, student" />
      <div className="flex gap-1 overflow-x-auto px-3 pb-2 shrink-0">
        {['All', 'Recent', 'Favorites', ...ICON_CATEGORIES].map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] border ${cat === c ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:bg-accent'}`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto p-2 grid grid-cols-5 gap-1">
        {filtered.map((icon) => {
          const Icon = getLucideIcon(icon.lucide)
          if (!Icon) return null
          return (
            <div key={icon.id} className="relative group">
              <button
                title={icon.name}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('application/x-digiboard', JSON.stringify({ kind: 'icon', lucide: icon.lucide }))
                  e.dataTransfer.effectAllowed = 'copy'
                }}
                onClick={() => insertIcon(icon.lucide)}
                className="flex h-14 w-full flex-col items-center justify-center rounded-lg hover:bg-accent text-foreground"
              >
                <Icon size={22} />
                <span className="mt-1 max-w-full truncate px-0.5 text-[9px] text-muted-foreground">{icon.name}</span>
              </button>
              <button
                className="absolute right-0.5 top-0.5 opacity-0 group-hover:opacity-100 p-0.5"
                onClick={(e) => { e.stopPropagation(); fav.toggle(icon.id) }}
                title={fav.list.includes(icon.id) ? 'Unfavorite' : 'Favorite'}
              >
                <Heart size={11} className={fav.list.includes(icon.id) ? 'fill-danger text-danger' : 'text-muted-foreground'} />
              </button>
            </div>
          )
        })}
        {filtered.length === 0 && <p className="col-span-5 text-center text-xs text-muted-foreground py-8">No icons match that search.</p>}
      </div>
    </div>
  )
}

function StickersPane() {
  const [q, setQ] = useState('')
  const fav = useLocalList('digiboard_sticker_favorites')
  const list = useMemo(() => searchStickers(q), [q])
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SearchBox value={q} onChange={setQ} placeholder="Search stickers — try important, exam" />
      <div className="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-2">
        {list.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <button
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('application/x-digiboard', JSON.stringify({ kind: 'sticker', ...s }))
              }}
              onClick={() => insertSticker(s.label, s.bg, s.fg, s.id)}
              className="flex-1 rounded-full py-2 text-sm font-semibold shadow-sm"
              style={{ background: s.bg, color: s.fg }}
            >
              {s.label}
            </button>
            <button onClick={() => fav.toggle(s.id)} title="Favorite">
              <Star size={14} className={fav.list.includes(s.id) ? 'fill-warning text-warning' : 'text-muted-foreground'} />
            </button>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">No stickers match that search.</p>}
      </div>
    </div>
  )
}

function ShapesPane({ onPick }: { onPick: (kind: ShapeKind, tool?: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow') => void }) {
  const [q, setQ] = useState('')
  const list = useMemo(() => searchShapes(q), [q])
  const cats = ['Basic', 'Lines', 'Flowchart', 'Diagram'] as const
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <SearchBox value={q} onChange={setQ} placeholder="Search shapes — rectangle, arrow, database" />
      <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
        {cats.map((cat) => {
          const items = list.filter((s) => s.category === cat)
          if (!items.length) return null
          return (
            <div key={cat}>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1.5">{cat}</p>
              <div className="grid grid-cols-4 gap-1.5">
                {items.map((s) => (
                  <button
                    key={s.id}
                    title={s.name}
                    aria-label={s.name}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('application/x-digiboard', JSON.stringify({ kind: 'shape', shapeKind: s.id }))
                      e.dataTransfer.effectAllowed = 'copy'
                    }}
                    onClick={() => onPick(s.id, s.tool)}
                    className="flex h-14 items-center justify-center rounded-lg border border-border text-foreground hover:bg-accent"
                  >
                    <ShapeIcon kind={s.id} />
                  </button>
                ))}
              </div>
            </div>
          )
        })}
        {list.length === 0 && <p className="text-center text-xs text-muted-foreground py-8">No shapes match that search.</p>}
      </div>
    </div>
  )
}

export function MoreToolsMenu() {
  const panel = useUIStore((s) => s.libraryPanel)
  const setLibraryPanel = useUIStore((s) => s.setLibraryPanel)
  const setActiveTool = useUIStore((s) => s.setActiveTool)
  const setPresenting = useUIStore((s) => s.setPresenting)
  const setSpotlightOn = useUIStore((s) => s.setSpotlightOn)
  const setRightPanel = useUIStore((s) => s.setRightPanel)
  if (panel !== 'more') return null

  const items = [
    { label: 'Laser Pointer', hint: 'Teaching', run: () => { setActiveTool('laser'); setLibraryPanel('none') } },
    { label: 'Spotlight', hint: 'Teaching', run: () => { setSpotlightOn(true); setLibraryPanel('none') } },
    { label: 'Presentation Mode', hint: 'Teaching', run: () => { setPresenting(true); setLibraryPanel('none') } },
    { label: 'Frame', hint: 'Slides', run: () => { import('../../lib/insertAssets').then((m) => m.insertFrame()); setLibraryPanel('none') } },
    { label: 'Table', hint: 'Notes', run: () => { import('../../lib/insertAssets').then((m) => m.insertTable()); setLibraryPanel('none') } },
    { label: 'Equation', hint: 'Notes', run: () => { import('../../lib/insertAssets').then((m) => m.insertEquation()); setLibraryPanel('none') } },
    { label: 'Mind Map', hint: 'Diagram', run: () => { import('../../lib/insertAssets').then((m) => m.insertMindMap()); setLibraryPanel('none') } },
    { label: 'Comment', hint: 'Review', run: () => { setActiveTool('sticky'); setLibraryPanel('none') } },
    { label: 'AI Assistant', hint: 'Optional', run: () => { setRightPanel('ai'); setLibraryPanel('none') } },
    { label: 'Keyboard Shortcuts', hint: 'Help', run: () => { useUIStore.getState().setShortcutsOpen(true); setLibraryPanel('none') } },
  ]

  return (
    <div className="absolute left-[72px] top-1/2 z-30 w-64 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl p-2">
      {items.map((item) => (
        <button key={item.label} onClick={item.run} className="w-full flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-accent">
          <span>{item.label}</span>
          <span className="text-[11px] text-muted-foreground">{item.hint}</span>
        </button>
      ))}
    </div>
  )
}

export function MediaMenu() {
  const panel = useUIStore((s) => s.libraryPanel)
  const setLibraryPanel = useUIStore((s) => s.setLibraryPanel)
  if (panel !== 'media') return null

  const handleImage = () => document.getElementById('image-upload')?.click()
  const handleFile = () => document.getElementById('file-upload')?.click()

  return (
    <div className="absolute left-[72px] top-1/2 z-30 w-56 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl p-2">
      <button onClick={handleImage} className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-accent">Insert image</button>
      <button onClick={handleFile} className="w-full text-left rounded-lg px-3 py-2 text-sm hover:bg-accent">Attach file / PDF</button>
      <p className="px-3 py-2 text-[11px] text-muted-foreground">You can also drag files onto the canvas.</p>
      <button onClick={() => setLibraryPanel('none')} className="w-full text-left rounded-lg px-3 py-2 text-xs text-muted-foreground">Close</button>
    </div>
  )
}