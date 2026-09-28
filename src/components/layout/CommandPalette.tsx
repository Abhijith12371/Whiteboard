import { useEffect, useMemo, useRef, useState } from 'react'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { ICON_CATALOG } from '../../lib/assets/iconCatalog'
import { SHAPE_CATALOG } from '../../lib/assets/shapeCatalog'
import { STICKER_CATALOG } from '../../lib/assets/stickerCatalog'
import { TEMPLATES } from '../../lib/assets/templates'
import { insertIcon, insertSticker, insertPresetShape, insertTable, insertMindMap, insertEquation, insertFrame } from '../../lib/insertAssets'
import {
  applyTemplate, exportJSON, exportStageImage, exportSVG, importJSONFile,
  fitToContent, fitToScreen, toast,
} from '../../lib/workspaceActions'

interface Cmd {
  id: string
  label: string
  hint: string
  keywords: string
  run: () => void
}

function buildCommands(): Cmd[] {
  const ui = useUIStore.getState()
  const tools: Cmd[] = [
    { id: 't-select', label: 'Select', hint: 'Tool · V', keywords: 'select pointer v', run: () => ui.setActiveTool('select') },
    { id: 't-pan', label: 'Hand / Pan', hint: 'Tool · H', keywords: 'hand pan h', run: () => ui.setActiveTool('pan') },
    { id: 't-pen', label: 'Pen', hint: 'Tool · P', keywords: 'pen draw ink', run: () => ui.setActiveTool('pen') },
    { id: 't-pencil', label: 'Pencil', hint: 'Tool', keywords: 'pencil sketch', run: () => ui.setActiveTool('pencil') },
    { id: 't-high', label: 'Highlighter', hint: 'Tool', keywords: 'highlight marker', run: () => ui.setActiveTool('highlighter') },
    { id: 't-eraser', label: 'Eraser', hint: 'Tool · E', keywords: 'eraser erase', run: () => ui.setActiveTool('eraser') },
    { id: 't-laser', label: 'Laser Pointer', hint: 'Teaching', keywords: 'laser pointer teaching', run: () => ui.setActiveTool('laser') },
    { id: 't-text', label: 'Text', hint: 'Tool · T', keywords: 'text type heading', run: () => ui.setActiveTool('text') },
    { id: 't-sticky', label: 'Sticky Note', hint: 'Tool · N', keywords: 'sticky note', run: () => ui.setActiveTool('sticky') },
    { id: 't-arrow', label: 'Arrow Tool', hint: 'Tool · A', keywords: 'arrow line connector', run: () => ui.setActiveTool('arrow') },
    { id: 't-line', label: 'Line Tool', hint: 'Tool · L', keywords: 'line stroke', run: () => ui.setActiveTool('line') },
    { id: 'lib-shapes', label: 'Shapes', hint: 'Library · S', keywords: 'shapes geometry flowchart', run: () => ui.setLibraryPanel('shapes') },
    { id: 'lib-icons', label: 'Insert Icons', hint: 'Library', keywords: 'icons symbols assets', run: () => ui.setLibraryPanel('icons') },
    { id: 'lib-stickers', label: 'Stickers & Labels', hint: 'Library', keywords: 'stickers labels teaching', run: () => ui.setLibraryPanel('stickers') },
    { id: 'lib-media', label: 'Images & Files', hint: 'Library', keywords: 'image media file pdf', run: () => ui.setLibraryPanel('media') },
    { id: 'more', label: 'More Tools', hint: 'Library', keywords: 'more table equation mind map frame', run: () => ui.setLibraryPanel('more') },
    { id: 'new-page', label: 'Create Page', hint: 'Pages', keywords: 'new page section', run: () => { useBoardStore.getState().addPage(); ui.setRightPanel('pages') } },
    { id: 'pages', label: 'Pages', hint: 'Panel', keywords: 'pages sections lesson', run: () => ui.setRightPanel('pages') },
    { id: 'layers', label: 'Layers', hint: 'Panel', keywords: 'layers order', run: () => ui.setRightPanel('layers') },
    { id: 'props', label: 'Properties', hint: 'Panel', keywords: 'properties settings object', run: () => ui.setRightPanel('properties') },
    { id: 'templates', label: 'Templates', hint: 'Panel', keywords: 'templates lesson study', run: () => ui.setRightPanel('templates') },
    { id: 'ai', label: 'AI Assistant', hint: 'Optional', keywords: 'ai assistant generate quiz', run: () => ui.setRightPanel('ai') },
    { id: 'present', label: 'Presentation Mode', hint: 'Teaching', keywords: 'present fullscreen teaching', run: () => ui.setPresenting(true) },
    { id: 'spotlight', label: 'Spotlight', hint: 'Teaching', keywords: 'spotlight focus teaching', run: () => ui.setSpotlightOn(!ui.spotlightOn) },
    { id: 'dark', label: 'Toggle Theme', hint: 'Settings', keywords: 'dark mode light theme', run: () => ui.setTheme(ui.theme === 'dark' ? 'light' : 'dark') },
    { id: 'home', label: 'All Boards', hint: 'Dashboard', keywords: 'home boards dashboard', run: () => ui.setHomeOpen(true) },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', hint: 'Help', keywords: 'shortcuts keyboard help', run: () => ui.setShortcutsOpen(true) },
    { id: 'export-png', label: 'Export PNG', hint: 'Export', keywords: 'export png image', run: () => exportStageImage('png') },
    { id: 'export-jpg', label: 'Export JPG', hint: 'Export', keywords: 'export jpg jpeg', run: () => exportStageImage('jpeg') },
    { id: 'export-svg', label: 'Export SVG', hint: 'Export', keywords: 'export svg', run: () => exportSVG() },
    { id: 'export-json', label: 'Export Board JSON', hint: 'Export', keywords: 'export json backup', run: () => exportJSON() },
    { id: 'import', label: 'Import JSON', hint: 'Import', keywords: 'import json', run: () => importJSONFile() },
    { id: 'fit', label: 'Fit to Screen', hint: 'View', keywords: 'fit screen zoom', run: () => fitToScreen() },
    { id: 'fitc', label: 'Fit to Content', hint: 'View', keywords: 'fit content zoom', run: () => fitToContent() },
    { id: 'table', label: 'Insert Table', hint: 'Notes', keywords: 'table grid', run: () => insertTable() },
    { id: 'eq', label: 'Insert Equation', hint: 'Notes', keywords: 'equation math formula', run: () => insertEquation() },
    { id: 'mm', label: 'Insert Mind Map', hint: 'Diagram', keywords: 'mind map brainstorm', run: () => insertMindMap() },
    { id: 'frame', label: 'Insert Frame', hint: 'Slides', keywords: 'frame slide presentation', run: () => insertFrame() },
  ]

  const shapes = SHAPE_CATALOG.map((s) => ({
    id: `shape-${s.id}`,
    label: s.name,
    hint: `Shape · ${s.category}`,
    keywords: `shape ${s.name} ${s.keywords.join(' ')} ${s.category}`,
    run: () => {
      if (s.tool) ui.setActiveTool(s.tool)
      else insertPresetShape(s.id)
      ui.setShapeKind(s.id)
      ui.setLibraryPanel('none')
    },
  }))

  const icons = ICON_CATALOG.map((icon) => ({
    id: `icon-${icon.id}`,
    label: icon.name,
    hint: `Icon · ${icon.category}`,
    keywords: `icon ${icon.keywords.join(' ')}`,
    run: () => { insertIcon(icon.lucide); ui.setLibraryPanel('none') },
  }))

  const stickers = STICKER_CATALOG.map((s) => ({
    id: `sticker-${s.id}`,
    label: s.label,
    hint: `Sticker · ${s.category}`,
    keywords: `sticker ${s.keywords.join(' ')}`,
    run: () => { insertSticker(s.label, s.bg, s.fg, s.id); ui.setLibraryPanel('none') },
  }))

  const templates = TEMPLATES.map((t) => ({
    id: `tpl-${t.id}`,
    label: t.name,
    hint: `Template · ${t.category}`,
    keywords: `template ${t.keywords.join(' ')} ${t.description}`,
    run: () => applyTemplate(t.id),
  }))

  const pages = useBoardStore.getState().pages.map((p) => ({
    id: `page-${p.id}`,
    label: p.name,
    hint: 'Page',
    keywords: `page ${p.name}`,
    run: () => useBoardStore.getState().switchPage(p.id),
  }))

  return [...tools, ...shapes, ...icons, ...stickers, ...templates, ...pages]
}

export function CommandPalette() {
  const open = useUIStore((s) => s.isCommandPaletteOpen)
  const setOpen = useUIStore((s) => s.setCommandPaletteOpen)
  const [q, setQ] = useState('')
  const [i, setI] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const commands = useMemo(() => (open ? buildCommands() : []), [open])

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase()
    if (!query) return commands.slice(0, 40)
    return commands
      .filter((c) => c.label.toLowerCase().includes(query) || c.keywords.includes(query) || c.hint.toLowerCase().includes(query))
      .slice(0, 50)
  }, [q, commands])

  useEffect(() => {
    if (open) {
      setQ('')
      setI(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  useEffect(() => { setI(0) }, [q])

  if (!open) return null

  const run = (cmd: Cmd) => {
    cmd.run()
    setOpen(false)
    toast(cmd.label)
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] bg-scrim/30" onClick={() => setOpen(false)}>
      <div
        className="w-[min(560px,92vw)] rounded-2xl border border-border bg-card shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Command palette"
      >
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search tools, icons, stickers, templates…"
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm outline-none"
          onKeyDown={(e) => {
            if (e.key === 'Escape') setOpen(false)
            if (e.key === 'ArrowDown') { e.preventDefault(); setI((n) => Math.min(filtered.length - 1, n + 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setI((n) => Math.max(0, n - 1)) }
            if (e.key === 'Enter' && filtered[i]) run(filtered[i])
          }}
        />
        <div className="max-h-[50vh] overflow-y-auto py-1">
          {filtered.map((cmd, idx) => (
            <button
              key={cmd.id}
              onClick={() => run(cmd)}
              className={`w-full flex items-center justify-between px-4 py-2 text-sm text-left ${idx === i ? 'bg-accent' : 'hover:bg-accent/60'}`}
            >
              <span>{cmd.label}</span>
              <span className="text-[11px] text-muted-foreground ml-4">{cmd.hint}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">No matches. Try “brain”, “arrow”, or “study notes”.</p>
          )}
        </div>
        <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground">↑↓ to move · Enter to run · Esc to close</p>
      </div>
    </div>
  )
}
