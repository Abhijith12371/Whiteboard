import { useState, type ReactNode, useEffect, useRef, useMemo } from 'react'
import { X, MoreVertical, Copy, Trash2, ArrowUp, ArrowDown, Pen } from 'lucide-react'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import { LayersPanel } from './LayersPanel'
import { searchTemplates, type BoardTemplate } from '../../lib/assets/templates'
import { resolveBoardSurface, adaptObjectForTheme, resolveMarkColor } from '../../lib/colors'
import { currentBoardInk } from '../../lib/insertAssets'
import { applyTemplate } from '../../lib/workspaceActions'
import { lucideToDataUrl } from '../../lib/lucideSvg'

// Component to render page preview on canvas
function PagePreview({ objectIds, objects }: { objectIds: string[]; objects: Record<string, any> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boardColor = useUIStore((s) => s.boardColor)
  const theme = useUIStore((s) => s.theme)
  const surface = resolveBoardSurface(boardColor, theme)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // Set canvas size
    canvas.width = 280
    canvas.height = 157

    // Draw the board surface so the thumbnail matches the real board
    ctx.fillStyle = surface.bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    if (objectIds.length === 0) {
      ctx.fillStyle = theme === 'dark' ? '#a1a1aa' : '#9ca3af'
      ctx.font = '11px system-ui'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('Empty page', canvas.width / 2, canvas.height / 2)
      return
    }

    // Scale factor: canvas is 280x157, canvas coords go from -1000 to 3000 x and y
    const scaleX = canvas.width / 4000
    const scaleY = canvas.height / 3000
    const scale = Math.min(scaleX, scaleY)
    const offsetX = canvas.width / 2 - 1000 * scale
    const offsetY = canvas.height / 2 - 1000 * scale

    // Draw objects
    objectIds.slice(0, 50).forEach((objId) => {
      const obj = objects[objId] as any
      if (!obj || obj.hidden) return

      const x = obj.x * scale + offsetX
      const y = obj.y * scale + offsetY
      const w = (obj.width || 20) * scale
      const h = (obj.height || 20) * scale

      ctx.globalAlpha = obj.opacity ?? 1

      if (obj.type === 'rectangle') {
        ctx.fillStyle = obj.fill || 'transparent'
        ctx.strokeStyle = obj.stroke || '#000000'
        ctx.lineWidth = (obj.strokeWidth || 1) * scale
        if (obj.fill && obj.fill !== 'transparent') {
          ctx.fillRect(x, y, w, h)
        }
        ctx.strokeRect(x, y, w, h)
      } else if (obj.type === 'circle' || obj.type === 'ellipse') {
        ctx.fillStyle = obj.fill || 'transparent'
        ctx.strokeStyle = obj.stroke || '#000000'
        ctx.lineWidth = (obj.strokeWidth || 1) * scale
        ctx.beginPath()
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
        if (obj.fill && obj.fill !== 'transparent') {
          ctx.fill()
        }
        ctx.stroke()
      } else if (obj.type === 'triangle') {
        ctx.fillStyle = obj.fill || 'transparent'
        ctx.strokeStyle = obj.stroke || '#000000'
        ctx.lineWidth = (obj.strokeWidth || 1) * scale
        ctx.beginPath()
        ctx.moveTo(x + w / 2, y)
        ctx.lineTo(x + w, y + h)
        ctx.lineTo(x, y + h)
        ctx.closePath()
        if (obj.fill && obj.fill !== 'transparent') {
          ctx.fill()
        }
        ctx.stroke()
      } else if (obj.type === 'path' || obj.type === 'line' || obj.type === 'arrow') {
        const points = obj.points || []
        ctx.strokeStyle = obj.stroke || '#000000'
        ctx.lineWidth = (obj.strokeWidth || 2) * scale
        ctx.lineCap = 'round'
        ctx.lineJoin = 'round'
        if (points.length >= 2) {
          ctx.beginPath()
          ctx.moveTo(x + points[0] * scale, y + points[1] * scale)
          for (let i = 2; i < points.length; i += 2) {
            ctx.lineTo(x + points[i] * scale, y + points[i + 1] * scale)
          }
          ctx.stroke()
        }
      } else if (obj.type === 'text' || obj.type === 'sticky' || obj.type === 'mindmap') {
        const fontSize = Math.max(6, (obj.fontSize || 16) * scale)
        ctx.fillStyle = obj.fill || '#000000'
        ctx.font = `${fontSize}px system-ui`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        const text = (obj.text || '').substring(0, 20)
        ctx.fillText(text, x + 2, y + 2)

        // Draw sticky background if applicable
        if (obj.type === 'sticky') {
          ctx.fillStyle = obj.color || '#fef08a'
          ctx.globalAlpha = 0.3 * (obj.opacity ?? 1)
          ctx.fillRect(x, y, w, h)
          ctx.globalAlpha = obj.opacity ?? 1
        }
      }

      ctx.globalAlpha = 1
    })
  }, [objectIds, objects, surface.bg, theme])

  return <canvas ref={canvasRef} className="w-full h-full rounded-lg" />
}

export function RightWorkspace() {
  const panel = useUIStore((s) => s.rightPanel)
  const setPanel = useUIStore((s) => s.setRightPanel)
  const isPresenting = useUIStore((s) => s.isPresenting)
  if (isPresenting || panel === 'none') return null
  if (panel === 'layers') return <LayersPanel />

  return (
    <div className="absolute right-0 top-0 bottom-0 w-80 bg-card border-l border-border shadow-xl flex flex-col z-20 animate-in fade-in slide-in-from-right-2 duration-200">
      <div className="p-4 border-b border-border/50 flex items-center justify-between shrink-0">
        <h2 className="font-semibold text-sm capitalize text-foreground">{panel === 'ai' ? 'AI Assistant' : panel}</h2>
        <button aria-label="Close panel" onClick={() => setPanel('none')} className="text-muted-foreground hover:text-foreground hover:bg-accent/50 p-1.5 rounded-lg transition-colors">
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {panel === 'properties' && <PropertiesPane />}
        {panel === 'pages' && <PagesPane />}
        {panel === 'templates' && <TemplatesPane />}
        {panel === 'ai' && <AiPane />}
      </div>
    </div>
  )
}

function PropertiesPane() {
  const selectedIds = useUIStore((s) => s.selectedIds)
  const objects = useBoardStore((s) => s.objects)
  const updateObject = useBoardStore((s) => s.updateObject)
  const toggleLock = useBoardStore((s) => s.toggleLock)
  const obj = selectedIds.length === 1 ? objects[selectedIds[0]] as any : null
  const theme = useUIStore((s) => s.theme)
  if (!obj) {
    return <p className="p-4 text-sm text-muted-foreground">Select an object to edit fill, stroke, text, size, opacity, and lock.</p>
  }

  const set = (updates: Record<string, any>) => updateObject(obj.id, updates)
  // An `auto` mark stores no hex, so the swatch has to show the ink it resolves
  // to right now, and editing it counts as an explicit choice.
  const inkFor = (field: 'stroke' | 'fill') => resolveMarkColor(obj, theme, field) ?? ''
  const pick = (field: 'stroke' | 'fill', value: string) => set({ [field]: value, colorMode: 'custom' })

  return (
    <div className="p-4 space-y-4 text-sm">
      <Row label="Type">{obj.assetKind === 'icon' ? 'Icon' : obj.assetKind === 'sticker' ? 'Sticker' : obj.type}</Row>
      <Row label="Position">
        <Num value={Math.round(obj.x)} onChange={(x) => set({ x })} />
        <Num value={Math.round(obj.y)} onChange={(y) => set({ y })} />
      </Row>
      <Row label="Size">
        <Num value={Math.round(obj.width || 0)} onChange={(width) => set({ width })} />
        <Num value={Math.round(obj.height || 0)} onChange={(height) => set({ height })} />
      </Row>
      <Row label="Rotation">
        <input type="range" min={0} max={360} value={obj.rotation || 0} onChange={(e) => set({ rotation: Number(e.target.value) })} className="w-full" />
      </Row>
      <Row label="Opacity">
        <input type="range" min={0.1} max={1} step={0.05} value={obj.opacity ?? 1} onChange={(e) => set({ opacity: Number(e.target.value) })} className="w-full" />
      </Row>
      {(obj.stroke !== undefined) && (
        <Row label="Border">
          <input type="color" value={toHex(inkFor('stroke'))} onChange={(e) => pick('stroke', e.target.value)} />
          <Num value={obj.strokeWidth || 1} onChange={(strokeWidth) => set({ strokeWidth })} />
        </Row>
      )}
      {(obj.fill !== undefined && obj.type !== 'path') && (
        <Row label="Fill">
          <input type="color" value={toHex(obj.fill === 'transparent' ? '#ffffff' : obj.fill)} onChange={(e) => set({ fill: e.target.value })} />
        </Row>
      )}
      {obj.cornerRadius !== undefined && (
        <Row label="Corners">
          <Num value={obj.cornerRadius || 0} onChange={(cornerRadius) => set({ cornerRadius })} />
        </Row>
      )}
      {(obj.type === 'text' || obj.type === 'sticky' || obj.type === 'mindmap') && (
        <>
          <Row label="Font size"><Num value={obj.fontSize || 16} onChange={(fontSize) => set({ fontSize })} /></Row>
          <Row label="Color"><input type="color" value={toHex(inkFor('fill'))} onChange={(e) => pick('fill', e.target.value)} /></Row>
          {obj.type === 'sticky' && (
            <Row label="Note"><input type="color" value={toHex(obj.color || '#fef08a')} onChange={(e) => set({ color: e.target.value })} /></Row>
          )}
          <div className="flex gap-1">
            <button className="px-2 py-1 border border-border rounded" onClick={() => set({ fontWeight: obj.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</button>
            <button className="px-2 py-1 border border-border rounded italic" onClick={() => set({ fontStyle: obj.fontStyle === 'italic' ? 'normal' : 'italic' })}>I</button>
            <button className="px-2 py-1 border border-border rounded" onClick={() => set({ align: 'left' })}>Left</button>
            <button className="px-2 py-1 border border-border rounded" onClick={() => set({ align: 'center' })}>Center</button>
            <button className="px-2 py-1 border border-border rounded" onClick={() => set({ align: 'right' })}>Right</button>
          </div>
        </>
      )}
      {obj.type === 'card' && (
        <>
          <Row label="Font size"><Num value={obj.fontSize || 16} onChange={(fontSize) => set({ fontSize })} /></Row>
          <Row label="Text color"><input type="color" value={toHex(obj.textColor || '#0f172a')} onChange={(e) => set({ textColor: e.target.value })} /></Row>
          <Row label="Shape">
            <select
              value={obj.shape || 'rect'}
              onChange={(e) => set({ shape: e.target.value })}
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm"
            >
              <option value="rect">Rectangle</option>
              <option value="ellipse">Ellipse</option>
            </select>
          </Row>
          <div className="flex gap-1">
            <button className="px-2 py-1 border border-border rounded" onClick={() => set({ fontWeight: obj.fontWeight === 'bold' ? 'normal' : 'bold' })}>B</button>
            <button className="px-2 py-1 border border-border rounded" onClick={() => set({ align: 'left' })}>Left</button>
            <button className="px-2 py-1 border border-border rounded" onClick={() => set({ align: 'center' })}>Center</button>
            <button className="px-2 py-1 border border-border rounded" onClick={() => set({ align: 'right' })}>Right</button>
          </div>
        </>
      )}
      {obj.type === 'frame' && (
        <>
          <Row label="Caption">
            <input
              value={obj.label || ''}
              onChange={(e) => set({ label: e.target.value })}
              className="w-full rounded border border-border bg-transparent px-2 py-1 text-sm"
            />
          </Row>
          <Row label="Font size"><Num value={obj.fontSize || 14} onChange={(fontSize) => set({ fontSize })} /></Row>
          <Row label="Label color"><input type="color" value={toHex(obj.labelColor || '#6366f1')} onChange={(e) => set({ labelColor: e.target.value })} /></Row>
        </>
      )}
      {obj.assetKind === 'icon' && obj.iconName && (
        <Row label="Icon color">
          <input
            type="color"
            value={toHex(obj.iconColor || currentBoardInk())}
            onChange={(e) => set({ iconColor: e.target.value, src: lucideToDataUrl(obj.iconName, e.target.value) })}
          />
        </Row>
      )}
      <button className="w-full rounded-lg border border-border py-2 font-medium hover:bg-accent transition-colors" onClick={() => toggleLock([obj.id])}>
        {obj.locked ? 'Unlock' : 'Lock'}
      </button>
    </div>
  )
}

function PagesPane() {
  const pages = useBoardStore((s) => s.pages)
  const activePageId = useBoardStore((s) => s.activePageId)
  const objects = useBoardStore((s) => s.objects)
  const objectIds = useBoardStore((s) => s.objectIds)
  const pageSnapshots = useBoardStore((s) => s.pageSnapshots)
  const { switchPage, addPage, renamePage, deletePage, duplicatePage } = useBoardStore.getState()
  const [renameId, setRenameId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  const handleRename = (pageId: string, pageName: string) => {
    setRenameId(pageId)
    setName(pageName)
    setOpenMenu(null)
  }

  const submitRename = (pageId: string) => {
    renamePage(pageId, name.trim() || 'Untitled Page')
    setRenameId(null)
  }

  const getPagePreviewObjects = (pageId: string) => {
    const isActive = pageId === activePageId
    const snapshot = isActive ? { objects, objectIds } : pageSnapshots[pageId]
    if (!snapshot) return { objects: {}, objectIds: [] }
    return snapshot
  }

  const canMoveUp = (idx: number) => idx > 0
  const canMoveDown = (idx: number) => idx < pages.length - 1

  const movePageUp = (idx: number) => {
    if (!canMoveUp(idx)) return
    const newPages = [...pages]
    ;[newPages[idx], newPages[idx - 1]] = [newPages[idx - 1], newPages[idx]]
    useBoardStore.setState({ pages: newPages })
    setOpenMenu(null)
  }

  const movePageDown = (idx: number) => {
    if (!canMoveDown(idx)) return
    const newPages = [...pages]
    ;[newPages[idx], newPages[idx + 1]] = [newPages[idx + 1], newPages[idx]]
    useBoardStore.setState({ pages: newPages })
    setOpenMenu(null)
  }

  return (
    <div className="p-4 space-y-3 flex flex-col h-full">
      <button 
        onClick={() => addPage()} 
        className="w-full rounded-lg bg-primary text-primary-foreground hover:opacity-90 text-sm font-medium py-2.5 transition-all shadow-sm hover:shadow-md"
      >
        + Add Page
      </button>

      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {pages.map((p, idx) => {
          const preview = getPagePreviewObjects(p.id)
          const isActive = p.id === activePageId

          return (
            <div
              key={p.id}
              className={`group rounded-xl border-2 transition-all ${
                isActive
                  ? 'border-info bg-info-muted shadow-md'
                  : 'border-border/60 hover:border-border bg-card hover:bg-accent/20'
              }`}
            >
              {/* Page Thumbnail */}
              <button
                onClick={() => switchPage(p.id)}
                className="w-full p-2 flex flex-col items-center justify-center cursor-pointer"
              >
                <div className="w-full aspect-video bg-background rounded-lg border border-border/50 mb-2 overflow-hidden">
                  <PagePreview objectIds={preview.objectIds} objects={preview.objects} />
                </div>

                {/* Page Name */}
                {renameId === p.id ? (
                  <input
                    autoFocus
                    className="w-full text-xs font-medium border border-border rounded px-2 py-1 bg-background text-foreground"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onBlur={() => submitRename(p.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') submitRename(p.id)
                      if (e.key === 'Escape') setRenameId(null)
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="text-xs font-medium text-foreground line-clamp-1">
                    {idx + 1}. {p.name}
                  </span>
                )}
              </button>

              {/* Menu Button */}
              <div className="relative px-2 pb-2">
                <button
                  onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent/70 transition-colors opacity-0 group-hover:opacity-100"
                >
                  <MoreVertical size={14} />
                </button>

                {/* Three-dot Menu */}
                {openMenu === p.id && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setOpenMenu(null)} />
                    <div className="absolute right-0 top-full mt-1 w-40 bg-card border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                      <button
                        onClick={() => handleRename(p.id, p.name)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2 text-foreground"
                      >
                        <Pen size={13} /> Rename
                      </button>
                      <button
                        onClick={() => { duplicatePage(p.id); setOpenMenu(null) }}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2 text-foreground"
                      >
                        <Copy size={13} /> Duplicate
                      </button>
                      {canMoveUp(idx) && (
                        <button
                          onClick={() => movePageUp(idx)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2 text-foreground"
                        >
                          <ArrowUp size={13} /> Move Up
                        </button>
                      )}
                      {canMoveDown(idx) && (
                        <button
                          onClick={() => movePageDown(idx)}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-accent transition-colors flex items-center gap-2 text-foreground"
                        >
                          <ArrowDown size={13} /> Move Down
                        </button>
                      )}
                      {pages.length > 1 && (
                        <>
                          <div className="h-px bg-border/30 my-1" />
                          <button
                            onClick={() => {
                              if (confirm('Delete this page? This cannot be undone.')) {
                                deletePage(p.id)
                                setOpenMenu(null)
                              }
                            }}
                            className="w-full text-left px-3 py-2 text-xs hover:bg-danger-muted transition-colors flex items-center gap-2 text-danger"
                          >
                            <Trash2 size={13} /> Delete
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TemplatesPane() {
  const [q, setQ] = useState('')
  const list = searchTemplates(q)
  const cats = ['Education', 'Business', 'Design', 'Development'] as const
  return (
    <div className="p-4 space-y-4">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search templates" className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/40" />
      {cats.map((cat) => {
        const items = list.filter((t) => t.category === cat)
        if (!items.length) return null
        return (
          <div key={cat}>
            <p className="text-xs uppercase font-semibold text-muted-foreground mb-2">{cat}</p>
            <div className="grid grid-cols-2 gap-2">
              {items.map((t) => (
                <button
                  key={t.id}
                  title={`${t.name} — ${t.description}`}
                  onClick={() => {
                    if (useBoardStore.getState().objectIds.length && !confirm('Replace the current page with this template?')) return
                    applyTemplate(t.id)
                  }}
                  className="overflow-hidden rounded-lg border border-border text-left hover:border-ring/60 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring/40 transition-all"
                >
                  <TemplatePreview template={t} />
                  <div className="px-2 py-1.5">
                    <div className="text-xs font-medium text-foreground truncate">{t.name}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{t.description}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {!list.length && (
        <p className="text-sm text-muted-foreground text-center py-6">No templates match “{q}”.</p>
      )}
    </div>
  )
}

/** Text laid out to approximate Konva's align/verticalAlign for a thumbnail. */
function previewText(o: any, color: string, align: string, valign: string) {
  const lines = String(o.text ?? '').split('\n')
  const fs = o.fontSize || 14
  const lh = fs * 1.25
  const blockH = lines.length * lh
  const h = o.height || blockH
  const firstBaseline = valign === 'middle' ? o.y + (h - blockH) / 2 + fs
    : valign === 'bottom' ? o.y + h - blockH + fs
    : o.y + fs
  const anchor = align === 'center' ? 'middle' : align === 'right' ? 'end' : 'start'
  const tx = align === 'center' ? o.x + (o.width || 0) / 2 : align === 'right' ? o.x + (o.width || 0) : o.x
  return (
    <text
      x={tx}
      y={firstBaseline}
      fontSize={fs}
      fill={color}
      textAnchor={anchor}
      fontWeight={o.fontWeight || 'bold'}
      fontFamily="sans-serif"
    >
      {lines.map((ln, i) => (
        <tspan key={i} x={tx} dy={i === 0 ? 0 : lh}>{ln}</tspan>
      ))}
    </text>
  )
}

function previewShape(o: any, key: string) {
  if (o.type === 'rectangle') {
    return (
      <rect
        key={key}
        x={o.x} y={o.y} width={o.width} height={o.height}
        rx={o.cornerRadius || 0}
        fill={o.fill || 'none'}
        stroke={o.stroke || 'none'}
        strokeWidth={o.strokeWidth || 0}
      />
    )
  }
  if (o.type === 'card') {
    const pad = o.padding ?? 10
    return (
      <g key={key}>
        {o.shape === 'ellipse' ? (
          <ellipse
            cx={o.x + o.width / 2} cy={o.y + o.height / 2}
            rx={o.width / 2} ry={o.height / 2}
            fill={o.fill || 'none'} stroke={o.stroke || 'none'} strokeWidth={o.strokeWidth || 0}
          />
        ) : (
          <rect
            x={o.x} y={o.y} width={o.width} height={o.height}
            rx={o.cornerRadius || 0}
            fill={o.fill || 'none'} stroke={o.stroke || 'none'} strokeWidth={o.strokeWidth || 0}
          />
        )}
        <g transform={`translate(${pad}, ${pad})`}>
          {previewText({ ...o, x: o.x, y: o.y, width: o.width - pad * 2, height: o.height - pad * 2 }, o.textColor || '#0f172a', o.align || 'center', o.valign || 'middle')}
        </g>
      </g>
    )
  }
  if (o.type === 'sticky') {
    return (
      <g key={key}>
        <rect x={o.x} y={o.y} width={o.width} height={o.height} rx={2} fill={o.color || '#fef08a'} />
        {previewText(o, o.fill || '#0f172a', 'center', 'middle')}
      </g>
    )
  }
  if (o.type === 'text') {
    return previewText(o, o.fill || '#0f172a', o.align || 'left', 'top')
  }
  return null
}

/**
 * Thumbnail drawn from the template's own objects, so it always matches what
 * applying the template actually produces.
 */
function TemplatePreview({ template }: { template: BoardTemplate }) {
  const theme = useUIStore((s) => s.theme)
  const built = useMemo(() => template.build(), [template])

  const { objs, viewBox } = useMemo(() => {
    const toDark = theme === 'dark'
    const list = built.objectIds
      .map((id) => built.objects[id])
      .filter(Boolean)
      .map((o) => adaptObjectForTheme(o as any, toDark)) as any[]
    if (!list.length) return { objs: list, viewBox: '0 0 1 1' }
    const pad = 16
    const minX = Math.min(...list.map((o) => o.x)) - pad
    const minY = Math.min(...list.map((o) => o.y)) - pad
    const maxX = Math.max(...list.map((o) => o.x + (o.width || 0))) + pad
    const maxY = Math.max(...list.map((o) => o.y + (o.height || 0))) + pad
    return {
      objs: list,
      viewBox: `${minX} ${minY} ${Math.max(1, maxX - minX)} ${Math.max(1, maxY - minY)}`,
    }
  }, [built, theme])

  return (
    <div className="aspect-[4/3] w-full bg-muted/40 border-b border-border overflow-hidden">
      <svg
        viewBox={viewBox}
        preserveAspectRatio="xMidYMid meet"
        className="h-full w-full"
        role="img"
        aria-label={`${template.name} template preview`}
      >
        {objs.map((o) => previewShape(o, o.id))}
      </svg>
    </div>
  )
}

function AiPane() {
  return (
    <div className="p-4 text-sm text-muted-foreground space-y-4">
      <p>AI stays optional and offline-safe. Connect a provider later without changing the canvas.</p>
      <ul className="list-disc pl-5 space-y-2">
        <li>Handwriting to text</li>
        <li>Summarize this board</li>
        <li>Generate quiz / flashcards</li>
        <li>Turn notes into slides</li>
      </ul>
      <button disabled className="w-full rounded-lg border border-border py-2.5 opacity-50 font-medium">Coming soon</button>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs font-medium">{label}</span>
      <div className="flex items-center gap-2">{children}</div>
    </label>
  )
}

function Num({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  // Held as a draft string so the field can be cleared and retyped. Committing
  // on every keystroke against a controlled numeric value snaps the field back
  // the moment you select-all, which makes the value impossible to change.
  const [draft, setDraft] = useState<string | null>(null)
  const shown = draft ?? String(Math.round(value * 100) / 100)

  const commit = (raw: string) => {
    setDraft(null)
    const n = Number(raw)
    if (raw.trim() !== '' && Number.isFinite(n)) onChange(n)
  }

  return (
    <input
      type="number"
      className="w-16 rounded border border-border px-2 py-1 text-xs bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      value={shown}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          ;(e.target as HTMLInputElement).blur()
        } else if (e.key === 'Escape') {
          setDraft(null)
          ;(e.target as HTMLInputElement).blur()
        }
        e.stopPropagation()
      }}
    />
  )
}

function toHex(c: string) {
  if (!c || c === 'transparent') return '#ffffff'
  return c
}
