import { useBoardStore } from '../store/boardStore'
import { useUIStore } from '../store/uiStore'
import { TEMPLATES } from './assets/templates'
import { adaptObjectForTheme, resolveMarkColor } from './colors'
import { insertIcon, insertSticker, insertStickyAt, insertTextAt, insertPresetShape, clientToCanvas } from './insertAssets'

export function toast(msg: string) {
  useUIStore.getState().setToast(msg)
  window.setTimeout(() => {
    if (useUIStore.getState().toast === msg) useUIStore.getState().setToast(null)
  }, 2200)
}

export function copySelection() {
  const ui = useUIStore.getState()
  const board = useBoardStore.getState()
  if (!ui.selectedIds.length) return
  ui.setClipboard(ui.selectedIds.map((id) => board.objects[id]).filter(Boolean))
  toast('Copied')
}

export function cutSelection() {
  const ui = useUIStore.getState()
  const board = useBoardStore.getState()
  if (!ui.selectedIds.length) return
  ui.setClipboard(ui.selectedIds.map((id) => board.objects[id]).filter(Boolean))
  board.deleteObjects(ui.selectedIds)
  ui.setSelectedIds([])
}

export function pasteClipboard(offset = 24) {
  const ui = useUIStore.getState()
  const board = useBoardStore.getState()
  if (!ui.clipboard.length) return
  const newIds: string[] = []
  ui.clipboard.forEach((obj) => {
    const newId = crypto.randomUUID()
    newIds.push(newId)
    board.addObject({ ...obj, id: newId, x: (obj.x || 0) + offset, y: (obj.y || 0) + offset } as any)
  })
  ui.setSelectedIds(newIds)
}

export function duplicateSelection() {
  const ids = useUIStore.getState().selectedIds
  if (!ids.length) return
  useBoardStore.getState().duplicateObjects(ids)
}

export function selectAll() {
  const { objectIds, objects } = useBoardStore.getState()
  const ids = objectIds.filter((id) => {
    const o = objects[id]
    return o && !o.locked && !o.hidden && o.type !== 'group'
  })
  useUIStore.getState().setSelectedIds(ids.length ? objectIds.filter((id) => objects[id] && !objects[id].hidden) : [])
}

export function deleteSelection() {
  const ui = useUIStore.getState()
  if (!ui.selectedIds.length) return
  useBoardStore.getState().deleteObjects(ui.selectedIds)
  ui.setSelectedIds([])
}

export function applyTemplate(id: string) {
  const t = TEMPLATES.find((x) => x.id === id)
  if (!t) return
  const built = t.build()
  // Templates are authored against a light board; retarget them so they stay
  // legible when dropped onto a dark one.
  const toDark = useUIStore.getState().theme === 'dark'
  const objects: Record<string, any> = {}
  for (const objId in built.objects) {
    objects[objId] = adaptObjectForTheme(built.objects[objId] as any, toDark)
  }
  useBoardStore.setState({
    objects,
    objectIds: built.objectIds,
    past: [],
    future: [],
  })
  useUIStore.getState().setSelectedIds([])
  useUIStore.getState().setHomeOpen(false)
  useUIStore.getState().setRightPanel('none')
  toast(`Applied “${t.name}”`)
}

export function zoomBy(factor: number) {
  const board = useBoardStore.getState()
  const next = Math.max(0.1, Math.min(10, board.scale * factor))
  board.setScale(next)
}

export function setZoomPercent(pct: number) {
  useBoardStore.getState().setScale(Math.max(0.1, Math.min(10, pct / 100)))
}

export function fitToScreen() {
  useBoardStore.getState().setScale(1)
  useBoardStore.getState().setPosition({ x: 0, y: 0 })
}

export function fitToContent() {
  const { objects, objectIds, setScale, setPosition } = useBoardStore.getState()
  const boxes = objectIds.map((id) => objects[id]).filter(Boolean)
  if (!boxes.length) {
    fitToScreen()
    return
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  boxes.forEach((o) => {
    minX = Math.min(minX, o.x)
    minY = Math.min(minY, o.y)
    maxX = Math.max(maxX, o.x + (o.width || 0))
    maxY = Math.max(maxY, o.y + (o.height || 0))
  })
  const w = window.innerWidth
  const h = window.innerHeight - 96
  const contentW = Math.max(1, maxX - minX)
  const contentH = Math.max(1, maxY - minY)
  const scale = Math.max(0.15, Math.min(2, 0.85 * Math.min(w / contentW, h / contentH)))
  setScale(scale)
  setPosition({
    x: (w - contentW * scale) / 2 - minX * scale,
    y: (h - contentH * scale) / 2 - minY * scale,
  })
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a')
  link.download = filename
  link.href = dataUrl
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

export function exportStageImage(type: 'png' | 'jpeg' = 'png') {
  const canvasEls = document.querySelectorAll('.konvajs-content canvas')
  const stage = canvasEls[canvasEls.length - 1] as HTMLCanvasElement | undefined
  if (!stage) {
    toast('Nothing to export')
    return
  }
  const name = useUIStore.getState().activeBoardName.replace(/\s+/g, '_')
  downloadDataUrl(stage.toDataURL(type === 'jpeg' ? 'image/jpeg' : 'image/png', 0.92), `${name}.${type === 'jpeg' ? 'jpg' : 'png'}`)
}

export function exportJSON() {
  const { objects, objectIds, pages, activePageId, pageSnapshots } = useBoardStore.getState()
  const name = useUIStore.getState().activeBoardName.replace(/\s+/g, '_')
  const data = JSON.stringify({ objects, objectIds, pages, activePageId, pageSnapshots }, null, 2)
  const blob = new Blob([data], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, `${name}.json`)
  URL.revokeObjectURL(url)
}

export function exportSVG() {
  const { objects, objectIds } = useBoardStore.getState()
  const { activeBoardName, theme } = useUIStore.getState()
  const name = activeBoardName.replace(/\s+/g, '_')
  // An `auto` mark stores no hex, so resolve it here too — otherwise a preset
  // shape exports with no outline at all.
  const strokeOf = (o: any, fallback = 'none') => resolveMarkColor(o, theme, 'stroke') ?? fallback
  const parts = objectIds.map((id) => objects[id]).filter(Boolean).map((o: any) => {
    const op = o.opacity ?? 1
    if (o.type === 'rectangle') {
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="${o.cornerRadius || 0}" fill="${o.fill || 'none'}" stroke="${strokeOf(o)}" stroke-width="${o.strokeWidth || 0}" opacity="${op}"/>`
    }
    if (o.type === 'card') {
      const label = String(o.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      const shape = o.shape === 'ellipse'
        ? `<ellipse cx="${o.x + (o.width || 0) / 2}" cy="${o.y + (o.height || 0) / 2}" rx="${(o.width || 0) / 2}" ry="${(o.height || 0) / 2}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.strokeWidth || 0}" opacity="${op}"/>`
        : `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="${o.cornerRadius || 0}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.strokeWidth || 0}" opacity="${op}"/>`
      return `${shape}<text x="${o.x + (o.padding || 10)}" y="${o.y + (o.fontSize || 16) + (o.padding || 10)}" font-size="${o.fontSize || 16}" fill="${o.textColor || '#111'}" text-anchor="${o.align === 'center' ? 'middle' : o.align === 'right' ? 'end' : 'start'}">${label.replace(/\n/g, ' ')}</text>`
    }
    if (o.type === 'frame') {
      const label = String(o.label || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      return `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" rx="${o.cornerRadius || 0}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.strokeWidth || 0}" stroke-dasharray="${(o.dash || []).join(' ')}" opacity="${op}"/><text x="${o.x}" y="${o.y - 10}" font-size="${o.fontSize || 14}" fill="${o.labelColor || o.stroke}">${label}</text>`
    }
    if (o.type === 'mindmap') {
      const r = Math.max(o.width || 0, o.height || 0) / 2
      const label = String(o.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
      return `<circle cx="${o.x + r}" cy="${o.y + r}" r="${r}" fill="${o.fill || 'none'}" stroke="${o.stroke || 'none'}" stroke-width="${o.strokeWidth || 0}" opacity="${op}"/><text x="${o.x + r}" y="${o.y + r}" font-size="${o.fontSize || 16}" fill="${o.textColor || '#fff'}" text-anchor="middle" dominant-baseline="middle">${label}</text>`
    }
    if (o.type === 'text' || o.type === 'sticky') {
      const fill = o.type === 'sticky' ? (o.color || '#fef08a') : 'none'
      const bg = o.type === 'sticky' ? `<rect x="${o.x}" y="${o.y}" width="${o.width}" height="${o.height}" fill="${fill}"/>` : ''
      return `${bg}<text x="${o.x + 8}" y="${o.y + (o.fontSize || 16)}" font-size="${o.fontSize || 16}" fill="${resolveMarkColor(o, theme, 'fill') || o.fill || '#111'}">${String(o.text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')}</text>`
    }
    if (o.type === 'line' || o.type === 'path' || o.type === 'arrow') {
      const pts = (o.points || []).reduce((acc: string, n: number, i: number) => acc + (i % 2 ? `,${n + o.y} ` : `${n + o.x},`), '')
      return `<polyline points="${pts.trim()}" fill="none" stroke="${strokeOf(o, '#111')}" stroke-width="${o.strokeWidth || 2}" opacity="${op}"/>`
    }
    return ''
  })
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080">${parts.join('')}</svg>`
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  const url = URL.createObjectURL(blob)
  downloadDataUrl(url, `${name}.svg`)
  URL.revokeObjectURL(url)
}

export function importJSONFile() {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'application/json'
  input.onchange = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(String(ev.target?.result))
        if (data.objects && data.objectIds) {
          useBoardStore.getState().loadPagesFromBoard(data)
          useUIStore.getState().setSelectedIds([])
          toast('Board imported')
        }
      } catch {
        toast('Could not import that file')
      }
    }
    reader.readAsText(file)
  }
  input.click()
}

export function handleDroppedPayload(raw: string, clientX: number, clientY: number) {
  try {
    const data = JSON.parse(raw)
    const at = clientToCanvas(clientX, clientY)
    if (data.kind === 'icon' && data.lucide) insertIcon(data.lucide, at)
    if (data.kind === 'sticker') insertSticker(data.label, data.bg, data.fg, data.id, at)
    if (data.kind === 'shape' && data.shapeKind) insertPresetShape(data.shapeKind, at)
  } catch { /* ignore */ }
}

export function handleDroppedFiles(files: FileList, clientX: number, clientY: number) {
  Array.from(files).forEach((file, i) => {
    const at = clientToCanvas(clientX + i * 24, clientY + i * 24)
    if (file.type.startsWith('image/') || file.name.endsWith('.svg')) {
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
            x: at.x, y: at.y,
            width: img.width * scale, height: img.height * scale,
            src, rotation: 0, opacity: 1, locked: false, zIndex: 0, assetKind: 'image',
          } as any)
        }
        img.src = src
      }
      reader.readAsDataURL(file)
    } else if (file.type === 'application/json' || file.name.endsWith('.json')) {
      file.text().then((text) => {
        try {
          const data = JSON.parse(text)
          if (data.objects && data.objectIds) useBoardStore.getState().loadPagesFromBoard(data)
        } catch { toast('Could not import JSON') }
      })
    } else if (file.type === 'text/plain') {
      file.text().then((text) => insertTextAt(text.slice(0, 2000), at, 16))
    } else {
      insertTextAt(`📎 ${file.name}`, at, 16)
    }
  })
}

export function insertAtCanvas(kind: 'text' | 'sticky', clientX?: number, clientY?: number) {
  const at = clientX != null && clientY != null ? clientToCanvas(clientX, clientY) : undefined
  if (kind === 'text') insertTextAt('Text', at)
  else insertStickyAt(at)
}
