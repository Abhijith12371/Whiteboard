import { useBoardStore } from '../store/boardStore'
import { useUIStore } from '../store/uiStore'
import { lucideToDataUrl, stickerToDataUrl } from './lucideSvg'
import type { ShapeKind } from './assets/shapeCatalog'
import { polygonPoints } from './assets/shapeCatalog'
import type { BaseObject } from '../types'
import { DARK_INK, inkForSurface, resolveBoardSurface } from './colors'

/**
 * Ink that stays readable on the current board surface, so newly created text
 * is visible regardless of the active theme.
 */
export function currentBoardInk(): string {
  const { boardColor, theme } = useUIStore.getState()
  return inkForSurface(DARK_INK, resolveBoardSurface(boardColor, theme).bg)
}

/** Measured rect of the canvas viewport, in client coordinates. */
function canvasRect() {
  if (typeof document === 'undefined') return null
  const el = document.querySelector('[data-canvas-root]')
  if (!el) return null
  return el.getBoundingClientRect()
}

/**
 * Top-left board coordinate for an object of the given size, centered in the
 * visible canvas area. Measuring the real container keeps inserts centered
 * regardless of top-bar height, zoom, or pan.
 */
export function getViewportTopLeft(width: number, height: number): { x: number; y: number } {  const { scale, position } = useBoardStore.getState()
  const rect = canvasRect()
  const left = rect ? rect.left : 0
  const top = rect ? rect.top : 56
  const w = rect ? rect.width : window.innerWidth
  const h = rect ? rect.height : window.innerHeight - 56
  return {
    x: (left + w / 2 - position.x) / scale - width / 2,
    y: (top + h / 2 - position.y) / scale - height / 2,
  }
}

export function clientToCanvas(clientX: number, clientY: number): { x: number; y: number } {
  const { scale, position } = useBoardStore.getState()
  const rect = canvasRect()
  const top = rect ? rect.top : 56
  const left = rect ? rect.left : 0
  return {
    x: (clientX - left - position.x) / scale,
    y: (clientY - top - position.y) / scale,
  }
}

function pushRecent(key: string, id: string) {
  try {
    const raw = localStorage.getItem(key)
    const list: string[] = raw ? JSON.parse(raw) : []
    const next = [id, ...list.filter((x) => x !== id)].slice(0, 24)
    localStorage.setItem(key, JSON.stringify(next))
  } catch { /* ignore */ }
}

export function insertIcon(lucideName: string, at?: { x: number; y: number }, color?: string) {
  // Icons are baked into an SVG data URL, so an "auto" icon stores no colour and
  // is re-rendered per frame instead.
  const isAuto = color === undefined
  const ink = color ?? currentBoardInk()
  const src = lucideToDataUrl(lucideName, ink)
  if (!src) return
  const pos = at || getViewportTopLeft(96, 96)
  const id = crypto.randomUUID()
  useBoardStore.getState().addObject({
    id,
    type: 'image',
    x: pos.x,
    y: pos.y,
    width: 96,
    height: 96,
    src,
    rotation: 0,
    opacity: 1,
    locked: false,
    zIndex: 0,
    assetKind: 'icon',
    iconName: lucideName,
    iconColor: isAuto ? '' : ink,
    colorMode: isAuto ? 'auto' : 'custom',
  } as BaseObject)
  useUIStore.getState().setSelectedIds([id])
  useUIStore.getState().setActiveTool('select')
  pushRecent('digiboard_icon_recent', lucideName)
}

export function insertSticker(label: string, bg: string, fg: string, stickerId: string, at?: { x: number; y: number }) {
  const src = stickerToDataUrl(label, bg, fg)
  const pos = at || getViewportTopLeft(180, 44)
  const id = crypto.randomUUID()
  useBoardStore.getState().addObject({
    id,
    type: 'image',
    x: pos.x,
    y: pos.y,
    width: 180,
    height: 44,
    src,
    rotation: 0,
    opacity: 1,
    locked: false,
    zIndex: 0,
    assetKind: 'sticker',
    stickerId,
  } as BaseObject)
  useUIStore.getState().setSelectedIds([id])
  useUIStore.getState().setActiveTool('select')
  pushRecent('digiboard_sticker_recent', stickerId)
}

export function insertPresetShape(kind: ShapeKind, at?: { x: number; y: number }) {
  const w = 160
  const h = 100
  const pos = at || getViewportTopLeft(kind === 'terminator' ? 180 : w, kind === 'terminator' ? 64 : h)
  const id = crypto.randomUUID()
  const base = {
    id,
    x: pos.x,
    y: pos.y,
    width: w,
    height: h,
    rotation: 0,
    opacity: 1,
    locked: false,
    zIndex: 0,
    fill: 'transparent',
    // A preset outline is default ink, not a chosen colour: store no hex and let
    // `resolveMarkColor` pick it per render, or the outline vanishes on a dark
    // board. Same convention as the freehand pen in Canvas.
    stroke: '',
    colorMode: 'auto',
    strokeWidth: 2,
  }

  if (kind === 'rectangle' || kind === 'process') {
    useBoardStore.getState().addObject({ ...base, type: 'rectangle', cornerRadius: 2 } as any)
  } else if (kind === 'round-rect' || kind === 'terminator') {
    useBoardStore.getState().addObject({ ...base, type: 'rectangle', width: kind === 'terminator' ? 180 : w, height: kind === 'terminator' ? 64 : h, cornerRadius: kind === 'terminator' ? 32 : 16 } as any)
  } else if (kind === 'circle') {
    useBoardStore.getState().addObject({ ...base, type: 'circle', width: 120, height: 120 } as any)
  } else if (kind === 'ellipse') {
    useBoardStore.getState().addObject({ ...base, type: 'ellipse', width: 180, height: 100 } as any)
  } else if (kind === 'triangle') {
    useBoardStore.getState().addObject({ ...base, type: 'triangle' } as any)
  } else if (kind === 'line' || kind === 'connector') {
    useBoardStore.getState().addObject({
      ...base, type: 'line', width: 160, height: 8,
      points: [0, 4, 160, 4],
    } as any)
  } else if (kind === 'arrow' || kind === 'curved-arrow') {
    useBoardStore.getState().addObject({
      ...base, type: 'arrow', width: 160, height: 8,
      points: [0, 4, 160, 4],
      tension: kind === 'curved-arrow' ? 0.5 : 0,
    } as any)
  } else if (kind === 'double-arrow') {
    useBoardStore.getState().addObject({
      ...base, type: 'arrow', width: 160, height: 8,
      points: [0, 4, 160, 4],
      pointerAtBeginning: true,
    } as any)
  } else if (kind === 'elbow') {
    useBoardStore.getState().addObject({
      ...base, type: 'line', width: 160, height: 80,
      points: [0, 0, 0, 80, 160, 80],
    } as any)
  } else if (kind === 'database-shape') {
    useBoardStore.getState().addObject({
      ...base,
      type: 'polygon',
      width: 140,
      height: 160,
      shapeKind: 'database-shape',
      points: polygonPoints('database-shape', 140, 160),
    } as any)
  } else {
    useBoardStore.getState().addObject({
      ...base,
      type: 'polygon',
      shapeKind: kind,
      points: polygonPoints(kind, w, h),
    } as any)
  }

  useUIStore.getState().setSelectedIds([id])
  useUIStore.getState().setActiveTool('select')
}

export function insertTextAt(text: string, at?: { x: number; y: number }, fontSize = 24) {
  const pos = at || getViewportTopLeft(280, 48)
  const id = crypto.randomUUID()
  useBoardStore.getState().addObject({
    id, type: 'text', x: pos.x, y: pos.y, width: 280, height: 48,
    text, fontSize, fontFamily: 'sans-serif', fill: '', colorMode: 'auto',
    fontWeight: 'normal', fontStyle: 'normal', align: 'left',
    rotation: 0, opacity: 1, locked: false, zIndex: 0,
  } as any)
  useUIStore.getState().setSelectedIds([id])
}

export function insertStickyAt(at?: { x: number; y: number }) {
  const pos = at || getViewportTopLeft(200, 200)
  const id = crypto.randomUUID()
  useBoardStore.getState().addObject({
    id, type: 'sticky', x: pos.x, y: pos.y, width: 200, height: 200,
    text: 'Note', fontSize: 20, fontFamily: 'sans-serif', fill: currentBoardInk(), color: '#fef08a',
    rotation: 0, opacity: 1, locked: false, zIndex: 0,
  } as any)
  useUIStore.getState().setSelectedIds([id])
}

export function insertTable(rows = 3, cols = 3, at?: { x: number; y: number }) {
  const cellW = 110
  const cellH = 44
  const pos = at || getViewportTopLeft(cellW * cols, cellH * rows)
  const ids: string[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const id = crypto.randomUUID()
      ids.push(id)
      useBoardStore.getState().addObject({
        id,
        type: 'rectangle',
        x: pos.x + c * cellW,
        y: pos.y + r * cellH,
        width: cellW,
        height: cellH,
        fill: r === 0 ? '#eef2ff' : '#ffffff',
        stroke: '#94a3b8',
        strokeWidth: 1,
        cornerRadius: 0,
        rotation: 0, opacity: 1, locked: false, zIndex: 0,
      } as any)
      const tid = crypto.randomUUID()
      ids.push(tid)
      useBoardStore.getState().addObject({
        id: tid, type: 'text',
        x: pos.x + c * cellW + 8,
        y: pos.y + r * cellH + 10,
        width: cellW - 16, height: 24,
        text: r === 0 ? `Col ${c + 1}` : '',
        fontSize: 14, fontFamily: 'sans-serif', fill: '#0f172a',
        fontWeight: r === 0 ? 'bold' : 'normal', fontStyle: 'normal', align: 'left',
        rotation: 0, opacity: 1, locked: false, zIndex: 1,
      } as any)
    }
  }
  const groupId = crypto.randomUUID()
  useBoardStore.getState().groupObjects(ids, groupId)
  useUIStore.getState().setSelectedIds([groupId])
  useUIStore.getState().setActiveTool('select')
}

export function insertMindMap(at?: { x: number; y: number }) {
  const pos = at || getViewportTopLeft(140, 140)
  const id = crypto.randomUUID()

  // A single mind-map node: the label lives inside the shape, so it can never
  // drift out of position, and double-click still edits it in place.
  useBoardStore.getState().addObject({
    id,
    type: 'mindmap',
    x: pos.x,
    y: pos.y,
    width: 140,
    height: 140,
    text: 'Main Idea',
    fontSize: 16,
    fontFamily: 'sans-serif',
    fill: '#4f46e5',
    stroke: '#4338ca',
    strokeWidth: 2,
    textColor: '#ffffff',
    fontWeight: 'bold',
    fontStyle: 'normal',
    align: 'center',
    name: 'Mind Map Node',
    rotation: 0,
    opacity: 1,
    locked: false,
    zIndex: 1,
  } as any)

  useUIStore.getState().setSelectedIds([id])
  useUIStore.getState().setActiveTool('select')

  useUIStore.getState().setToast('Double-click the node to edit it. Ctrl+D duplicates it for new branches.')
  setTimeout(() => {
    if (useUIStore.getState().toast === 'Double-click the node to edit it. Ctrl+D duplicates it for new branches.') {
      useUIStore.getState().setToast(null)
    }
  }, 4000)
}

export function insertEquation(at?: { x: number; y: number }) {
  insertTextAt('E = mc²', at, 28)
}

export function insertFrame(at?: { x: number; y: number }) {
  const W = 640
  const H = 360
  const pos = at || getViewportTopLeft(W, H)
  const id = crypto.randomUUID()
  // One object: the caption is part of the frame, so it can never separate.
  useBoardStore.getState().addObject({
    id,
    type: 'frame',
    x: pos.x,
    y: pos.y,
    width: W,
    height: H,
    label: 'Slide frame',
    fontSize: 14,
    fontFamily: 'sans-serif',
    fill: 'transparent',
    stroke: '#6366f1',
    strokeWidth: 2,
    cornerRadius: 8,
    dash: [8, 6],
    labelColor: '#6366f1',
    name: 'Frame',
    rotation: 0,
    opacity: 1,
    locked: false,
    zIndex: 0,
  } as any)
  useUIStore.getState().setSelectedIds([id])
  useUIStore.getState().setActiveTool('select')
}
