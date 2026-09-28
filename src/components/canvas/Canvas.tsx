import { useRef, useEffect, useState, useMemo } from 'react'
import { Stage, Layer, Rect, Circle, Ellipse, Line, Text, Group, Image as KonvaImage, Arrow } from 'react-konva'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { SelectionTransformer } from './SelectionTransformer'
import { LaserPointer } from './LaserPointer'
import { ContextMenu } from './ContextMenu'
import { handleDroppedFiles, handleDroppedPayload } from '../../lib/workspaceActions'
import { polygonPoints } from '../../lib/assets/shapeCatalog'
import { resolveIconSrc } from '../../lib/lucideSvg'
import { resolveBoardSurface, resolveMarkColor, canvasBg } from '../../lib/colors'

const URLImage = (props: any) => {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    const img = new window.Image()
    img.src = props.src
    img.onload = () => {
      setImage(img)
    }
  }, [props.src])

  return <KonvaImage image={image || undefined} {...props} />
}

/**
 * Types whose visible content should grow with the box. Resizing these without
 * scaling the text looks like nothing happened, which reads as "resize is broken".
 */
const FONT_SCALED_TYPES = new Set(['text', 'sticky', 'card', 'frame', 'mindmap'])

/**
 * Bakes a visual scale into real geometry: position, size, polyline points and
 * (for content-bearing shapes) font size, all relative to a fixed origin so the
 * object scales about the right point rather than jumping.
 */
function scaleGeometry(obj: any, scaleX: number, scaleY: number, originX: number, originY: number) {
  const updates: Record<string, any> = {
    x: originX + (obj.x - originX) * scaleX,
    y: originY + (obj.y - originY) * scaleY,
  }
  if (Array.isArray(obj.points) && obj.points.length) {
    updates.points = obj.points.map((v: number, i: number) =>
      i % 2 === 0 ? v * scaleX : v * scaleY
    )
  }
  if (typeof obj.width === 'number') updates.width = Math.max(5, obj.width * scaleX)
  if (typeof obj.height === 'number') updates.height = Math.max(5, obj.height * scaleY)
  if (FONT_SCALED_TYPES.has(obj.type) && typeof obj.fontSize === 'number') {
    updates.fontSize = Math.max(4, obj.fontSize * scaleY)
  }
  return updates
}

export const Canvas: React.FC = () => {
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [size, setSize] = useState({ width: 0, height: 0 })
  
  const isSpacePressed = useUIStore((state) => state.isSpacePressed)
  const activeTool = useUIStore((state) => state.activeTool)
  const selectedIds = useUIStore((state) => state.selectedIds)
  const setSelectedIds = useUIStore((state) => state.setSelectedIds)
  const penColor = useUIStore((state) => state.penColor)
  const penColorMode = useUIStore((state) => state.penColorMode)
  const penSize = useUIStore((state) => state.penSize)
  const penOpacity = useUIStore((state) => state.penOpacity)
  const eraserSize = useUIStore((state) => state.eraserSize)
  const shapeKind = useUIStore((state) => state.shapeKind)
  const boardBackground = useUIStore((state) => state.boardBackground)
  const boardColor = useUIStore((state) => state.boardColor)
  const theme = useUIStore((state) => state.theme)
  
  const setStoreScale = useBoardStore((state) => state.setScale)
  const setStorePosition = useBoardStore((state) => state.setPosition)
  const updateObject = useBoardStore((state) => state.updateObject)
  const updateMultipleObjects = useBoardStore((state) => state.updateMultipleObjects)
  const objects = useBoardStore((state) => state.objects)
  const objectIds = useBoardStore((state) => state.objectIds)

  // Derive ordered array stably — avoids infinite loop from inline .map() in selector
  const boardObjects = useMemo(
    () => objectIds.map(id => objects[id]).filter(Boolean),
    [objectIds, objects]
  )

  // Bounding box of a multi-selection. Doubles as a drag handle so the whole
  // selection can be moved by grabbing it, without grouping first.
  const selectionBounds = useMemo(() => {
    if (selectedIds.length < 2) return null
    const selObjs = selectedIds.map(id => objects[id]).filter(Boolean) as any[]
    if (!selObjs.length) return null
    const minX = Math.min(...selObjs.map(o => o.x))
    const minY = Math.min(...selObjs.map(o => o.y))
    const maxX = Math.max(...selObjs.map(o => o.x + (o.width || 0)))
    const maxY = Math.max(...selObjs.map(o => o.y + (o.height || 0)))
    return {
      x: minX,
      y: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    }
  }, [selectedIds, objects])

  const handleSelectionDragMove = (e: KonvaEventObject<DragEvent>) => {
    if (!selectionBounds) return
    const node = e.target
    const stage = node.getStage()
    const boardState = useBoardStore.getState()
    const dx = node.x() - selectionBounds.x
    const dy = node.y() - selectionBounds.y

    selectedIds.forEach((sid) => {
      const selObj = boardState.objects[sid]
      if (!selObj) return
      const selNode = stage?.findOne(`#${sid}`)
      if (selNode) selNode.position({ x: selObj.x + dx, y: selObj.y + dy })

      if (selObj.type === 'group') {
        const childIds = (selObj as any).childIds as string[] | undefined
        childIds?.forEach((childId) => {
          const childNode = stage?.findOne(`#${childId}`)
          const childObj = boardState.objects[childId]
          if (childNode && childObj) {
            childNode.position({ x: childObj.x + dx, y: childObj.y + dy })
          }
        })
      }
    })
  }

  const handleSelectionDragEnd = (e: KonvaEventObject<DragEvent>) => {
    if (!selectionBounds) return
    const node = e.target
    const boardState = useBoardStore.getState()
    const dx = node.x() - selectionBounds.x
    const dy = node.y() - selectionBounds.y

    const updates = selectedIds
      .map((sid) => {
        const selObj = boardState.objects[sid]
        if (!selObj) return null
        return { id: sid, updates: { x: selObj.x + dx, y: selObj.y + dy } }
      })
      .filter(Boolean) as { id: string; updates: any }[]

    if (updates.length) updateMultipleObjects(updates)
    node.position({ x: selectionBounds.x + dx, y: selectionBounds.y + dy })
  }

  const [isMiddleClickPan, setIsMiddleClickPan] = useState(false)
  const [drawingObject, setDrawingObject] = useState<any>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
  const [snapLines, setSnapLines] = useState<{ x?: number, y?: number }[]>([])
  const [laserTrail, setLaserTrail] = useState<number[]>([])
  const [laserActive, setLaserActive] = useState(false)

  const isPanActive = isSpacePressed || activeTool === 'pan' || isMiddleClickPan

  useEffect(() => {
    const handleGlobalMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        setIsMiddleClickPan(false)
      }
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setSize({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        })
      }
    }
    
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [])

  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault()
    
    const stage = stageRef.current
    if (!stage) return

    const scaleBy = 1.05
    const oldScale = stage.scaleX()
    const pointer = stage.getPointerPosition()
    if (!pointer) return

    const mousePointTo = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    }

    const isTouchpad = Math.abs((e.evt as any).wheelDeltaY) !== 120
    
    if (e.evt.ctrlKey || !isTouchpad) {
      // Zoom
      const newScale = e.evt.deltaY < 0 ? oldScale * scaleBy : oldScale / scaleBy
      const clampedScale = Math.max(0.1, Math.min(newScale, 10))

      stage.scale({ x: clampedScale, y: clampedScale })
      
      const newPos = {
        x: pointer.x - mousePointTo.x * clampedScale,
        y: pointer.y - mousePointTo.y * clampedScale,
      }
      stage.position(newPos)
      
      setStoreScale(clampedScale)
      setStorePosition(newPos)
    } else {
      // Pan with trackpad
      const newPos = {
        x: stage.x() - e.evt.deltaX,
        y: stage.y() - e.evt.deltaY,
      }
      stage.position(newPos)
      setStorePosition(newPos)
    }
  }

  const handleDragEnd = () => {
    if (stageRef.current) {
      setStorePosition({
        x: stageRef.current.x(),
        y: stageRef.current.y(),
      })
    }
  }

  const getRelativePointerPosition = (stage: Konva.Stage) => {
    const pointer = stage.getPointerPosition()
    if (!pointer) return null
    return {
      x: (pointer.x - stage.x()) / stage.scaleX(),
      y: (pointer.y - stage.y()) / stage.scaleY(),
    }
  }

  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (e.evt.button === 1) {
      setIsMiddleClickPan(true)
      return
    }

    if (isPanActive) return

    const stage = e.target.getStage()
    if (!stage) return

    const clickedOnEmpty = e.target === stage

    const pos = getRelativePointerPosition(stage)
    if (!pos) return

    if (clickedOnEmpty) {
      setSelectedIds([])
      if (activeTool === 'select') {
        setSelectionRect({ x: pos.x, y: pos.y, width: 0, height: 0 })
      }
    }
    setEditingTextId(null)

    if (activeTool === 'rectangle' || activeTool === 'circle') {
      setSelectedIds([])
      setDrawingObject({
        id: crypto.randomUUID(),
        type: activeTool,
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: '',
        colorMode: 'auto',
        strokeWidth: 2,
        rotation: 0,
        opacity: 1,
        locked: false,
        zIndex: 0
      })
    } else if (activeTool === 'triangle') {
      setSelectedIds([])
      setDrawingObject({
        id: crypto.randomUUID(),
        type: 'triangle',
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: '',
        colorMode: 'auto',
        strokeWidth: 2,
        rotation: 0,
        opacity: 1,
        locked: false,
        zIndex: 0
      })
    } else if (activeTool === 'line') {
      setSelectedIds([])
      setDrawingObject({
        id: crypto.randomUUID(),
        type: 'line',
        x: 0,
        y: 0,
        points: [pos.x, pos.y, pos.x, pos.y],
        width: 0,
        height: 0,
        stroke: '',
        colorMode: 'auto',
        strokeWidth: 2,
        rotation: 0,
        opacity: 1,
        locked: false,
        zIndex: 0
      })
    } else if (activeTool === 'laser') {
      setLaserActive(true)
      setLaserTrail([pos.x, pos.y])
    } else if (activeTool === 'shape') {
      setSelectedIds([])
      const base = {
        id: crypto.randomUUID(),
        x: pos.x,
        y: pos.y,
        width: 0,
        height: 0,
        rotation: 0,
        opacity: 1,
        locked: false,
        zIndex: 0,
        fill: 'transparent',
        stroke: '',
        colorMode: 'auto',
        strokeWidth: 2,
      } as any
      
      if (shapeKind === 'rectangle' || shapeKind === 'process') {
        Object.assign(base, { type: 'rectangle', cornerRadius: 2 })
      } else if (shapeKind === 'round-rect' || shapeKind === 'terminator') {
        Object.assign(base, { type: 'rectangle', cornerRadius: shapeKind === 'terminator' ? 32 : 16 })
      } else if (shapeKind === 'circle') {
        Object.assign(base, { type: 'circle' })
      } else if (shapeKind === 'ellipse') {
        Object.assign(base, { type: 'ellipse' })
      } else if (shapeKind === 'triangle') {
        Object.assign(base, { type: 'triangle' })
      } else if (shapeKind === 'line' || shapeKind === 'connector') {
        Object.assign(base, { type: 'line', x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y] })
      } else if (shapeKind === 'arrow' || shapeKind === 'curved-arrow') {
        Object.assign(base, { type: 'arrow', x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], tension: shapeKind === 'curved-arrow' ? 0.5 : 0 })
      } else if (shapeKind === 'double-arrow') {
        Object.assign(base, { type: 'arrow', x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], pointerAtBeginning: true })
      } else if (shapeKind === 'elbow') {
        Object.assign(base, { type: 'line', x: 0, y: 0, points: [pos.x, pos.y, pos.x, pos.y], shapeKind: 'elbow' })
      } else if (shapeKind === 'database-shape') {
        Object.assign(base, { type: 'polygon', shapeKind: 'database-shape' })
      } else {
        Object.assign(base, { type: 'polygon', shapeKind })
      }
      
      setDrawingObject(base)
    } else if (activeTool === 'pen' || activeTool === 'pencil' || activeTool === 'highlighter' || activeTool === 'eraser') {
      const isHighlighter = activeTool === 'highlighter'
      const isPencil = activeTool === 'pencil'
      const isEraser = activeTool === 'eraser'
      setSelectedIds([])
      setDrawingObject({
        id: crypto.randomUUID(),
        type: 'path',
        x: 0,
        y: 0,
        points: [pos.x, pos.y],
        width: 0,
        height: 0,
        fill: 'transparent',
        // Auto strokes store no colour; `stroke` is filled in at render time.
        stroke: isEraser ? '#000000' : (isHighlighter ? '#facc15' : (penColorMode === 'auto' ? '' : penColor)),
        colorMode: isEraser || isHighlighter ? 'custom' : penColorMode,
        strokeWidth: isEraser ? eraserSize : (isHighlighter ? Math.max(14, penSize * 3) : isPencil ? Math.max(1, penSize * 0.7) : penSize),
        tension: isPencil ? 0.2 : 0.5,
        rotation: 0,
        opacity: isEraser ? 1 : isHighlighter ? 0.35 : isPencil ? 0.75 : penOpacity,
        locked: false,
        zIndex: 0,
        tool: activeTool
      })
    } else if (activeTool === 'arrow') {
      setSelectedIds([])
      setDrawingObject({
        id: crypto.randomUUID(),
        type: 'arrow',
        x: 0,
        y: 0,
        points: [pos.x, pos.y, pos.x, pos.y],
        width: 0,
        height: 0,
        fill: 'transparent',
        stroke: '',
        colorMode: 'auto',
        strokeWidth: 2,
        rotation: 0,
        opacity: 1,
        locked: false,
        zIndex: 0
      })
    } else if (activeTool === 'text' || activeTool === 'sticky') {
      const id = crypto.randomUUID()
      const newObj = {
        id,
        type: activeTool,
        x: pos.x,
        y: pos.y,
        width: activeTool === 'sticky' ? 200 : 150,
        height: activeTool === 'sticky' ? 200 : 50,
        text: activeTool === 'sticky' ? 'Note' : 'Text',
        fontSize: activeTool === 'sticky' ? 20 : 24,
        fontFamily: 'sans-serif',
        fill: activeTool === 'sticky' ? '#0f172a' : (penColorMode === 'auto' ? '' : penColor),
        colorMode: activeTool === 'sticky' ? 'custom' : penColorMode,
        color: activeTool === 'sticky' ? '#fef08a' : 'transparent', // yellow-200
        fontWeight: 'normal',
        fontStyle: 'normal',
        align: 'left',
        rotation: 0,
        opacity: 1,
        locked: false,
        zIndex: 0
      }
      
      useBoardStore.getState().addObject(newObj as any)
      setSelectedIds([id])
      useUIStore.getState().setActiveTool('select')
      setEditingTextId(id)
    }
  }

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return

    const pos = getRelativePointerPosition(stage)
    if (!pos) return

    if (activeTool === 'laser' && e.evt.buttons === 1) {
      setLaserTrail((pts) => [...pts, pos.x, pos.y].slice(-80))
    }

    if (selectionRect && activeTool === 'select') {
      setSelectionRect({
        ...selectionRect,
        width: pos.x - selectionRect.x,
        height: pos.y - selectionRect.y
      })
      return
    }

    if (!drawingObject) return

    if (drawingObject.type === 'rectangle' || drawingObject.type === 'circle' || drawingObject.type === 'ellipse' || drawingObject.type === 'triangle' || drawingObject.type === 'polygon') {
      setDrawingObject({
        ...drawingObject,
        width: pos.x - drawingObject.x,
        height: pos.y - drawingObject.y,
      })
    } else if (drawingObject.type === 'path') {
      const points = drawingObject.points
      const lastX = points[points.length - 2]
      const lastY = points[points.length - 1]
      
      const dx = pos.x - lastX
      const dy = pos.y - lastY
      
      if (dx * dx + dy * dy > 9) {
        setDrawingObject({
          ...drawingObject,
          points: [...points, pos.x, pos.y]
        })
      }
    } else if (drawingObject.type === 'arrow') {
      setDrawingObject({
        ...drawingObject,
        points: [drawingObject.points[0], drawingObject.points[1], pos.x, pos.y]
      })
    } else if (drawingObject.type === 'line') {
      setDrawingObject({
        ...drawingObject,
        points: [drawingObject.points[0], drawingObject.points[1], pos.x, pos.y]
      })
    }
  }

  const handleMouseUp = (_e: KonvaEventObject<MouseEvent>) => {
    if (laserTrail.length) {
      setLaserActive(false)
      // Trail cleared by LaserPointer's onFadeComplete callback
    }
    if (selectionRect && activeTool === 'select') {
      const box = {
        x: Math.min(selectionRect.x, selectionRect.x + selectionRect.width),
        y: Math.min(selectionRect.y, selectionRect.y + selectionRect.height),
        width: Math.abs(selectionRect.width),
        height: Math.abs(selectionRect.height)
      }
      
      if (box.width > 5 || box.height > 5) {
        const newSelectedIds = boardObjects.filter((obj: any) => {
          const objBox = {
            x: obj.x,
            y: obj.y,
            width: obj.width || 0,
            height: obj.height || 0
          }
          return (
            box.x < objBox.x + objBox.width &&
            box.x + box.width > objBox.x &&
            box.y < objBox.y + objBox.height &&
            box.y + box.height > objBox.y &&
            !obj.locked && !obj.hidden
          )
        }).map(o => o.groupId || o.id)
        setSelectedIds(Array.from(new Set(newSelectedIds)))
      }
      setSelectionRect(null)
      return
    }

    if (!drawingObject) return

    if (drawingObject.type === 'path') {
      let finalPoints = drawingObject.points;
      if (finalPoints.length === 2) {
        finalPoints = [...finalPoints, finalPoints[0], finalPoints[1]];
      }
      
      if (finalPoints.length > 2) {
        // Calculate actual bounding box for selection/transform later
        const xs = finalPoints.filter((_: number, i: number) => i % 2 === 0)
        const ys = finalPoints.filter((_: number, i: number) => i % 2 !== 0)
        const minX = Math.min(...xs)
        const maxX = Math.max(...xs)
        const minY = Math.min(...ys)
        const maxY = Math.max(...ys)
        
        let finalObj = {
          ...drawingObject,
          x: minX,
          y: minY,
          width: Math.max(5, maxX - minX),
          height: Math.max(5, maxY - minY),
          // Convert global points to local points relative to x,y
          points: finalPoints.map((val: number, i: number) => i % 2 === 0 ? val - minX : val - minY)
        }
        
        useBoardStore.getState().addObject(finalObj)
      }
    } else if (drawingObject.type === 'arrow') {
      const dx = drawingObject.points[2] - drawingObject.points[0]
      const dy = drawingObject.points[3] - drawingObject.points[1]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 5) {
        const minX = Math.min(drawingObject.points[0], drawingObject.points[2])
        const maxX = Math.max(drawingObject.points[0], drawingObject.points[2])
        const minY = Math.min(drawingObject.points[1], drawingObject.points[3])
        const maxY = Math.max(drawingObject.points[1], drawingObject.points[3])

        let finalObj = {
          ...drawingObject,
          x: minX,
          y: minY,
          width: Math.max(5, maxX - minX),
          height: Math.max(5, maxY - minY),
          points: [
            drawingObject.points[0] - minX,
            drawingObject.points[1] - minY,
            drawingObject.points[2] - minX,
            drawingObject.points[3] - minY
          ]
        }
        useBoardStore.getState().addObject(finalObj)
        setSelectedIds([finalObj.id])
        useUIStore.getState().setActiveTool('select')
      }
    } else if (drawingObject.type === 'line') {
      const dx = drawingObject.points[2] - drawingObject.points[0]
      const dy = drawingObject.points[3] - drawingObject.points[1]
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist > 5) {
        const minX = Math.min(drawingObject.points[0], drawingObject.points[2])
        const maxX = Math.max(drawingObject.points[0], drawingObject.points[2])
        const minY = Math.min(drawingObject.points[1], drawingObject.points[3])
        const maxY = Math.max(drawingObject.points[1], drawingObject.points[3])

        const finalObj = {
          ...drawingObject,
          x: minX,
          y: minY,
          width: Math.max(5, maxX - minX),
          height: Math.max(5, maxY - minY),
          points: [
            drawingObject.points[0] - minX,
            drawingObject.points[1] - minY,
            drawingObject.points[2] - minX,
            drawingObject.points[3] - minY
          ]
        }
        if (finalObj.shapeKind === 'elbow') {
          finalObj.points = [
            drawingObject.points[0] - minX,
            drawingObject.points[1] - minY,
            drawingObject.points[0] - minX,
            drawingObject.points[3] - minY,
            drawingObject.points[2] - minX,
            drawingObject.points[3] - minY
          ]
        }
        useBoardStore.getState().addObject(finalObj)
        setSelectedIds([finalObj.id])
        useUIStore.getState().setActiveTool('select')
      }
    } else if (Math.abs(drawingObject.width) > 5 || Math.abs(drawingObject.height) > 5) {
      // Normalize negative width/height for shapes
      let finalObj = { ...drawingObject }
      if (finalObj.width < 0) {
        finalObj.x += finalObj.width
        finalObj.width = Math.abs(finalObj.width)
      }
      if (finalObj.height < 0) {
        finalObj.y += finalObj.height
        finalObj.height = Math.abs(finalObj.height)
      }
      
      if (finalObj.type === 'polygon') {
        finalObj.points = polygonPoints(finalObj.shapeKind, finalObj.width, finalObj.height)
      }

      useBoardStore.getState().addObject(finalObj)
      
      setSelectedIds([finalObj.id])
      useUIStore.getState().setActiveTool('select')
    }
    
    setDrawingObject(null)
  }

  const handleObjectDblClick = (e: KonvaEventObject<MouseEvent>, id: string) => {
    if (activeTool !== 'select') return
    e.cancelBubble = true
    
    const obj = useBoardStore.getState().objects[id]
    if (obj && (obj.type === 'text' || obj.type === 'sticky' || obj.type === 'mindmap' || obj.type === 'frame' || obj.type === 'card')) {
      setEditingTextId(obj.id)
    }
  }

  const handleObjectClick = (e: KonvaEventObject<MouseEvent>, id: string) => {
    if (activeTool !== 'select') return
    e.cancelBubble = true
    
    const obj = useBoardStore.getState().objects[id]
    const targetId = obj?.groupId || id
    
    if (e.evt.shiftKey) {
      if (selectedIds.includes(targetId)) {
        setSelectedIds(selectedIds.filter(selectedId => selectedId !== targetId))
      } else {
        setSelectedIds([...selectedIds, targetId])
      }
    } else {
      setSelectedIds([targetId])
    }
  }

  const handleObjectDragMove = (e: KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target
    const stage = node.getStage()
    const SNAP_DIST = 5
    const guideLines: { x?: number, y?: number }[] = []
    
    // Always read live selection state — closure value can be stale
    const liveSelectedIds = useUIStore.getState().selectedIds

    let snappedX = false
    let snappedY = false
    let newX = node.x()
    let newY = node.y()

    for (const obj of boardObjects) {
      if (obj.id === id || obj.hidden || liveSelectedIds.includes(obj.id)) continue
      
      if (!snappedX && Math.abs(node.x() - obj.x) < SNAP_DIST) {
        newX = obj.x; snappedX = true; guideLines.push({ x: obj.x })
      }
      
      if (!snappedY && Math.abs(node.y() - obj.y) < SNAP_DIST) {
        newY = obj.y; snappedY = true; guideLines.push({ y: obj.y })
      }
    }

    node.position({ x: newX, y: newY })
    setSnapLines((prev) => (prev.length === guideLines.length ? prev : guideLines))

    const storeSelf = useBoardStore.getState().objects[id]
    if (!storeSelf) return

    // Konva's Transformer only nudges sibling nodes on the first dragmove, so
    // recompute the whole selection from the stored baseline every frame. That
    // makes a multi-selection travel as one unit without grouping it first.
    const dragTargets = liveSelectedIds.includes(id) && liveSelectedIds.length > 1
      ? liveSelectedIds
      : [id]

    const boardState = useBoardStore.getState()
    const dx = node.x() - storeSelf.x
    const dy = node.y() - storeSelf.y

    dragTargets.forEach(targetId => {
      const selObj = boardState.objects[targetId]
      if (!selObj) return

      // Konva owns the grabbed node's position while it is being dragged.
      if (targetId !== id) {
        const selNode = stage?.findOne(`#${targetId}`)
        if (selNode) {
          selNode.position({
            x: selObj.x + dx,
            y: selObj.y + dy
          })
        }
      }

      // Group children are separate nodes the Transformer does not manage.
      if (selObj.type === 'group') {
        const childIds = (selObj as any).childIds as string[] | undefined
        childIds?.forEach((childId: string) => {
          const childNode = stage?.findOne(`#${childId}`)
          const childObj = boardState.objects[childId]
          if (childNode && childObj) {
            childNode.position({ x: childObj.x + dx, y: childObj.y + dy })
          }
        })
      }
    })
  }

  const handleObjectDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    setSnapLines([])
    
    // Always read live selection state — closure value can be stale
    const liveSelectedIds = useUIStore.getState().selectedIds
    
    if (liveSelectedIds.includes(id) && liveSelectedIds.length > 1) {
      // Multi-selection drag: move all selected objects by the same delta
      const storeObj = useBoardStore.getState().objects[id]
      if (!storeObj) {
        updateObject(id, { x: e.target.x(), y: e.target.y() })
        return
      }
      
      const dx = e.target.x() - storeObj.x
      const dy = e.target.y() - storeObj.y
      
      const updates = liveSelectedIds.map(selectedId => {
        const selObj = useBoardStore.getState().objects[selectedId]
        if (!selObj) return null
        return {
          id: selectedId,
          updates: { x: selObj.x + dx, y: selObj.y + dy }
        }
      }).filter(Boolean) as { id: string, updates: any }[]
      
      updateMultipleObjects(updates)
    } else {
      // Single object drag — just update its position directly
      updateObject(id, {
        x: e.target.x(),
        y: e.target.y()
      })
    }
  }

  const handleTransformEnd = (e: KonvaEventObject<Event>, id: string) => {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    
    // Reset scale to 1 and apply to width/height to avoid weird scaling issues down the line
    node.scaleX(1)
    node.scaleY(1)

    const obj = useBoardStore.getState().objects[id]
    if (!obj) return

    const next: Record<string, unknown> = {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      ...scaleGeometry(
        { ...obj, x: obj.x, y: obj.y },
        Math.abs(scaleX),
        Math.abs(scaleY),
        obj.x,
        obj.y
      ),
    }
    // scaleGeometry re-derives position from the origin; the transformer's
    // post-drag x/y (which accounts for the flipped corner) is authoritative.
    next.x = node.x()
    next.y = node.y()
    updateObject(id, next)
  }

  // Board background CSS
  const stageNode = stageRef.current
  const bgSize = 20 * (stageNode?.scaleX() || 1)
  const bgPos = {
    x: (stageNode?.x() || 0) % bgSize,
    y: (stageNode?.y() || 0) % bgSize
  }

  // The canvas surface is its own token and is never derived from any stroke.
  // The board *tint* only decorates it (grid/ruled lines and dot colour).
  const surface = resolveBoardSurface(boardColor, theme)
  const bgColorHex = canvasBg(theme)
  const lineColor = surface.line
  const dotColor = surface.dot

  const getBgStyle = (): React.CSSProperties => {
    const base: React.CSSProperties = { background: bgColorHex }
    if (boardBackground === 'blank') return base
    if (boardBackground === 'dots') return {
      ...base,
      backgroundImage: `radial-gradient(circle, ${dotColor} 1.2px, transparent 1.2px)`,
      backgroundSize: `${bgSize}px ${bgSize}px`,
      backgroundPosition: `${bgPos.x}px ${bgPos.y}px`,
    }
    const lineSpacing = 32 * (stageNode?.scaleX() || 1)
    if (boardBackground === 'ruled') return {
      ...base,
      backgroundImage: `linear-gradient(transparent calc(${lineSpacing}px - 1px), ${lineColor} calc(${lineSpacing}px - 1px), ${lineColor} ${lineSpacing}px, transparent ${lineSpacing}px)`,
      backgroundSize: `100% ${lineSpacing}px`,
      backgroundPosition: `0 ${(stageNode?.y() || 0) % lineSpacing}px`,
    }
    if (boardBackground === 'grid') return {
      ...base,
      backgroundImage: [
        `linear-gradient(transparent calc(${bgSize}px - 1px), ${lineColor} calc(${bgSize}px - 1px), ${lineColor} ${bgSize}px, transparent ${bgSize}px)`,
        `linear-gradient(90deg, transparent calc(${bgSize}px - 1px), ${lineColor} calc(${bgSize}px - 1px), ${lineColor} ${bgSize}px, transparent ${bgSize}px)`,
      ].join(','),
      backgroundSize: `${bgSize}px ${bgSize}px`,
      backgroundPosition: `${bgPos.x}px ${bgPos.y}px`,
    }
    return base
  }

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  return (
    <div 
      ref={containerRef} 
      data-canvas-root
      className="w-full h-full relative outline-none"
      onContextMenu={handleContextMenu}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }}
      onDrop={(e) => {
        e.preventDefault()
        const payload = e.dataTransfer.getData('application/x-digiboard')
        if (payload) handleDroppedPayload(payload, e.clientX, e.clientY)
        if (e.dataTransfer.files?.length) handleDroppedFiles(e.dataTransfer.files, e.clientX, e.clientY)
      }}
style={{ 
          cursor: isPanActive ? (isMiddleClickPan ? 'grabbing' : 'grab') : (activeTool === 'laser' ? 'crosshair' : activeTool === 'select' ? 'default' : 'crosshair'),
        ...getBgStyle()
      }}
    >
      {size.width > 0 && (
        <Stage 
          ref={stageRef}
          width={size.width} 
          height={size.height}
          draggable={isPanActive}
          onWheel={handleWheel}
          onDragEnd={handleDragEnd}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
        >
          <Layer>
            {selectionBounds && !selectionRect && (
              <Rect
                x={selectionBounds.x}
                y={selectionBounds.y}
                width={selectionBounds.width}
                height={selectionBounds.height}
                fill="rgba(0,0,0,0.001)"
                draggable={activeTool === 'select'}
                onMouseDown={(e) => {
                  e.cancelBubble = true
                  setSelectedIds(selectedIds)
                }}
                onDragMove={handleSelectionDragMove}
                onDragEnd={handleSelectionDragEnd}
              />
            )}
            {boardObjects.map((obj) => {
              if (obj.hidden) return null
              if (obj.type === 'rectangle') {
                const rectObj = obj as any
                return (
                  <Rect 
                    key={obj.id} 
                    id={obj.id}
                    {...rectObj} 
                    cornerRadius={rectObj.cornerRadius ?? 4}
                    dash={rectObj.dash}
                    fill={rectObj.fill}
                    stroke={resolveMarkColor(rectObj, theme, 'stroke') ?? 'transparent'}
                    opacity={rectObj.opacity ?? 1}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if ((obj.type as string) === 'ellipse') {
                const ell = obj as any
                const w = Math.abs(ell.width || 1)
                const h = Math.abs(ell.height || 1)
                return (
                  <Group
                    key={obj.id}
                    id={obj.id}
                    x={ell.x}
                    y={ell.y}
                    rotation={ell.rotation}
                    opacity={ell.opacity ?? 1}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  >
                    <Ellipse
                      x={w / 2}
                      y={h / 2}
                      radiusX={w / 2}
                      radiusY={h / 2}
                      fill={ell.fill}
                      stroke={resolveMarkColor(ell, theme, 'stroke') ?? 'transparent'}
                      strokeWidth={ell.strokeWidth}
                    />
                  </Group>
                )
              }
              if ((obj.type as string) === 'polygon') {
                const poly = obj as any
                const pts = poly.points?.length ? poly.points : polygonPoints(poly.shapeKind || 'hexagon', poly.width, poly.height)
                return (
                  <Line
                    key={obj.id}
                    id={obj.id}
                    x={poly.x}
                    y={poly.y}
                    points={pts}
                    closed
                    fill={poly.fill}
                    stroke={resolveMarkColor(poly, theme, 'stroke') ?? 'transparent'}
                    strokeWidth={poly.strokeWidth}
                    rotation={poly.rotation}
                    opacity={poly.opacity}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if (obj.type === 'circle') {
                const circObj = obj as any
                const w = Math.abs(circObj.width || 1)
                const h = Math.abs(circObj.height || 1)
                return (
                  <Group
                    key={obj.id}
                    id={obj.id}
                    x={circObj.x}
                    y={circObj.y}
                    rotation={circObj.rotation}
                    opacity={circObj.opacity ?? 1}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  >
                    <Circle
                      x={w / 2}
                      y={h / 2}
                      radius={Math.max(w, h) / 2}
                      fill={circObj.fill}
                      stroke={resolveMarkColor(circObj, theme, 'stroke') ?? 'transparent'}
                      strokeWidth={circObj.strokeWidth}
                    />
                  </Group>
                )
              }
              if (obj.type === 'path') {
                const pathObj = obj as any
                return (
                  <Line
                    key={obj.id}
                    id={obj.id}
                    x={pathObj.x}
                    y={pathObj.y}
                    points={pathObj.points}
                    stroke={resolveMarkColor(pathObj, theme, 'stroke') ?? 'transparent'}
                    strokeWidth={pathObj.strokeWidth}
                    hitStrokeWidth={10}
                    tension={pathObj.tension}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={
                      pathObj.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                    rotation={pathObj.rotation}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if (obj.type === 'text') {
                const textObj = obj as any
                return (
                  <Text
                    key={obj.id}
                    id={obj.id}
                    x={textObj.x}
                    y={textObj.y}
                    width={textObj.width}
                    height={textObj.height}
                    text={textObj.text}
                    opacity={editingTextId === obj.id ? 0 : textObj.opacity}
                    fontSize={textObj.fontSize}
                    fontFamily={textObj.fontFamily}
                    fill={resolveMarkColor(textObj, theme, 'fill') ?? 'transparent'}
                    fontStyle={textObj.fontStyle}
                    align={textObj.align}
                    rotation={textObj.rotation}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDblClick={(e) => handleObjectDblClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if (obj.type === 'sticky') {
                const stickyObj = obj as any
                return (
                  <Group
                    key={obj.id}
                    id={obj.id}
                    x={stickyObj.x}
                    y={stickyObj.y}
                    width={stickyObj.width}
                    height={stickyObj.height}
                    rotation={stickyObj.rotation}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDblClick={(e) => handleObjectDblClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  >
                    <Rect
                      width={stickyObj.width}
                      height={stickyObj.height}
                      fill={stickyObj.color}
                      shadowColor="black"
                      shadowBlur={10}
                      shadowOpacity={0.1}
                      shadowOffset={{ x: 0, y: 4 }}
                      cornerRadius={2}
                    />
                    <Text
                      width={stickyObj.width}
                      height={stickyObj.height}
                      text={stickyObj.text}
                      opacity={editingTextId === obj.id ? 0 : 1}
                      fontSize={stickyObj.fontSize}
                      fontFamily={stickyObj.fontFamily}
                      fill={stickyObj.fill}
                      fontStyle={stickyObj.fontStyle}
                      align="center"
                      verticalAlign="middle"
                      padding={10}
                    />
                  </Group>
                )
              }
              if (obj.type === 'mindmap') {
                const mmObj = obj as any
                const w = Math.max(1, mmObj.width || 120)
                const h = Math.max(1, mmObj.height || 120)
                return (
                  <Group
                    key={obj.id}
                    id={obj.id}
                    x={mmObj.x}
                    y={mmObj.y}
                    width={w}
                    height={h}
                    rotation={mmObj.rotation}
                    opacity={mmObj.opacity ?? 1}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDblClick={(e) => handleObjectDblClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  >
                    <Circle
                      x={w / 2}
                      y={h / 2}
                      radius={Math.max(w, h) / 2}
                      fill={mmObj.fill}
                      stroke={mmObj.stroke}
                      strokeWidth={mmObj.strokeWidth}
                    />
                    <Text
                      width={w}
                      height={h}
                      text={mmObj.text}
                      opacity={editingTextId === obj.id ? 0 : (mmObj.opacity ?? 1)}
                      fontSize={mmObj.fontSize}
                      fontFamily={mmObj.fontFamily}
                      fill={mmObj.textColor || '#ffffff'}
                      fontStyle={mmObj.fontStyle}
                      align="center"
                      verticalAlign="middle"
                      padding={Math.min(w, h) * 0.18}
                      listening={false}
                    />
                  </Group>
                )
              }
              if (obj.type === 'frame') {
                const fObj = obj as any
                const w = Math.max(1, fObj.width || 640)
                const h = Math.max(1, fObj.height || 360)
                return (
                  <Group
                    key={obj.id}
                    id={obj.id}
                    x={fObj.x}
                    y={fObj.y}
                    width={w}
                    height={h}
                    rotation={fObj.rotation}
                    opacity={fObj.opacity ?? 1}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDblClick={(e) => handleObjectDblClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  >
                    <Rect
                      width={w}
                      height={h}
                      fill={fObj.fill}
                      stroke={fObj.stroke}
                      strokeWidth={fObj.strokeWidth}
                      cornerRadius={fObj.cornerRadius ?? 8}
                      dash={fObj.dash}
                    />
                    <Text
                      x={0}
                      y={-28}
                      width={w}
                      height={24}
                      text={fObj.label || ''}
                      opacity={editingTextId === obj.id ? 0 : 1}
                      fontSize={fObj.fontSize || 14}
                      fontFamily={fObj.fontFamily}
                      fill={fObj.labelColor || fObj.stroke}
                      fontStyle="bold"
                      align="left"
                    />
                  </Group>
                )
              }
              if (obj.type === 'card') {
                const cObj = obj as any
                const w = Math.max(1, cObj.width || 160)
                const h = Math.max(1, cObj.height || 80)
                const pad = cObj.padding ?? 10
                return (
                  <Group
                    key={obj.id}
                    id={obj.id}
                    x={cObj.x}
                    y={cObj.y}
                    width={w}
                    height={h}
                    rotation={cObj.rotation}
                    opacity={cObj.opacity ?? 1}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDblClick={(e) => handleObjectDblClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  >
                    {cObj.shape === 'ellipse' ? (
                      <Ellipse
                        x={w / 2}
                        y={h / 2}
                        radiusX={w / 2}
                        radiusY={h / 2}
                        fill={cObj.fill}
                        stroke={cObj.stroke}
                        strokeWidth={cObj.strokeWidth}
                      />
                    ) : (
                      <Rect
                        width={w}
                        height={h}
                        fill={cObj.fill}
                        stroke={cObj.stroke}
                        strokeWidth={cObj.strokeWidth}
                        cornerRadius={cObj.cornerRadius ?? 0}
                        dash={cObj.dash}
                      />
                    )}
                    <Text
                      width={w}
                      height={h}
                      text={cObj.text}
                      opacity={editingTextId === obj.id ? 0 : 1}
                      fontSize={cObj.fontSize}
                      fontFamily={cObj.fontFamily}
                      fill={cObj.textColor || '#0f172a'}
                      fontStyle={cObj.fontStyle}
                      align={cObj.align || 'center'}
                      verticalAlign={cObj.valign || 'middle'}
                      padding={pad}
                      listening={false}
                    />
                  </Group>
                )
              }
              if (obj.type === 'image') {
                const imgObj = obj as any
                // Icons are baked SVG data URLs, so an "auto" icon is regenerated
                // per render (memoised in lucideSvg) rather than rewritten in
                // stored data.
                const iconSrc = resolveIconSrc(imgObj, theme)
                return (
                  <URLImage
                    key={obj.id}
                    id={obj.id}
                    src={iconSrc ?? imgObj.src}
                    x={imgObj.x}
                    y={imgObj.y}
                    width={imgObj.width}
                    height={imgObj.height}
                    rotation={imgObj.rotation}
                    opacity={imgObj.opacity ?? 1}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e: KonvaEventObject<MouseEvent>) => handleObjectClick(e, obj.id)}
                    onDragMove={(e: KonvaEventObject<DragEvent>) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e: KonvaEventObject<DragEvent>) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e: KonvaEventObject<Event>) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if (obj.type === 'arrow') {
                const arrowObj = obj as any
                const arrowColor = resolveMarkColor(arrowObj, theme, 'stroke') ?? 'transparent'
                return (
                  <Arrow
                    key={obj.id}
                    id={obj.id}
                    x={arrowObj.x}
                    y={arrowObj.y}
                    points={arrowObj.points}
                    stroke={arrowColor}
                    strokeWidth={arrowObj.strokeWidth}
                    fill={arrowColor}
                    pointerAtBeginning={arrowObj.pointerAtBeginning}
                    dash={arrowObj.dash}
                    opacity={arrowObj.opacity ?? 1}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if ((obj.type as string) === 'triangle') {
                const triObj = obj as any
                const w = triObj.width
                const h = triObj.height
                return (
                  <Line
                    key={obj.id}
                    id={obj.id}
                    x={triObj.x}
                    y={triObj.y}
                    points={[w / 2, 0, w, h, 0, h]}
                    closed
                    fill={triObj.fill}
                    stroke={resolveMarkColor(triObj, theme, 'stroke') ?? 'transparent'}
                    strokeWidth={triObj.strokeWidth}
                    rotation={triObj.rotation}
                    opacity={triObj.opacity}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if ((obj.type as string) === 'line') {
                const lineObj = obj as any
                return (
                  <Line
                    key={obj.id}
                    id={obj.id}
                    x={lineObj.x}
                    y={lineObj.y}
                    points={lineObj.points}
                    stroke={resolveMarkColor(lineObj, theme, 'stroke') ?? 'transparent'}
                    strokeWidth={lineObj.strokeWidth}
                    lineCap="round"
                    rotation={lineObj.rotation}
                    opacity={lineObj.opacity}
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if (obj.type === 'group') {
                const groupObj = obj as any
                return (
                  <Rect
                    key={obj.id}
                    id={obj.id}
                    x={groupObj.x}
                    y={groupObj.y}
                    width={groupObj.width}
                    height={groupObj.height}
                    fill="rgba(0,0,0,0.001)"
                    draggable={activeTool === 'select' && !obj.locked}
                    onMouseDown={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => {
                      handleObjectDragMove(e, obj.id)
                      const stage = e.target.getStage()
                      const dx = e.target.x() - groupObj.x
                      const dy = e.target.y() - groupObj.y
                      groupObj.childIds.forEach((childId: string) => {
                        const childNode = stage?.findOne(`#${childId}`)
                        const childObj = useBoardStore.getState().objects[childId]
                        if (childNode && childObj) {
                          childNode.position({
                            x: childObj.x + dx,
                            y: childObj.y + dy
                          })
                        }
                      })
                    }}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransform={(e) => {
                      const stage = e.target.getStage()
                      const scaleX = e.target.scaleX()
                      const scaleY = e.target.scaleY()
                      const dx = e.target.x() - groupObj.x
                      const dy = e.target.y() - groupObj.y
                      groupObj.childIds.forEach((childId: string) => {
                        const childNode = stage?.findOne(`#${childId}`)
                        const childObj = useBoardStore.getState().objects[childId]
                        if (childNode && childObj) {
                          childNode.position({
                            x: groupObj.x + (childObj.x - groupObj.x) * scaleX + dx,
                            y: groupObj.y + (childObj.y - groupObj.y) * scaleY + dy
                          })
                          childNode.scale({ x: scaleX, y: scaleY })
                        }
                      })
                    }}
                    onTransformEnd={(e) => {
                      // Bake the visual child scaling into real geometry,
                      // otherwise resetting scale to 1 snaps the children back
                      // to their original size and resizing a group is a no-op.
                      const stage = e.target.getStage()
                      const sx = e.target.scaleX()
                      const sy = e.target.scaleY()
                      const gx = groupObj.x
                      const gy = groupObj.y
                      const state = useBoardStore.getState()
                      const childUpdates = groupObj.childIds
                        .map((childId: string) => {
                          const childObj = state.objects[childId] as any
                          if (!childObj) return null
                          return {
                            id: childId,
                            updates: scaleGeometry(childObj, sx, sy, gx, gy),
                          }
                        })
                        .filter(Boolean) as { id: string; updates: Record<string, any> }[]
                      if (childUpdates.length) updateMultipleObjects(childUpdates)

                      handleTransformEnd(e, obj.id)
                      groupObj.childIds.forEach((childId: string) => {
                        const childNode = stage?.findOne(`#${childId}`)
                        if (childNode) childNode.scale({ x: 1, y: 1 })
                      })
                    }}
                  />
                )
              }
              return null
            })}
            
            {/* Drawing Object. Auto ink stores no colour, so the in-progress
                preview must resolve it exactly like the committed render or the
                pen appears dead until you release the mouse. */}
            {drawingObject && drawingObject.type === 'rectangle' && (
              <Rect
                x={drawingObject.x}
                y={drawingObject.y}
                width={drawingObject.width}
                height={drawingObject.height}
                fill={drawingObject.fill}
                stroke={resolveMarkColor(drawingObject, theme, 'stroke') ?? 'transparent'}
                strokeWidth={drawingObject.strokeWidth}
                rotation={drawingObject.rotation}
                cornerRadius={4}
              />
            )}
            {drawingObject && drawingObject.type === 'circle' && (
              <Circle 
                x={drawingObject.x + drawingObject.width / 2} 
                y={drawingObject.y + drawingObject.height / 2} 
                radius={Math.abs(Math.max(drawingObject.width, drawingObject.height) / 2)} 
                fill={drawingObject.fill}
                stroke={resolveMarkColor(drawingObject, theme, 'stroke') ?? 'transparent'}
                strokeWidth={drawingObject.strokeWidth}
              />
            )}
            {drawingObject && drawingObject.type === 'ellipse' && (
              <Ellipse 
                x={drawingObject.x + drawingObject.width / 2} 
                y={drawingObject.y + drawingObject.height / 2} 
                radiusX={Math.abs(drawingObject.width / 2)} 
                radiusY={Math.abs(drawingObject.height / 2)}
                fill={drawingObject.fill}
                stroke={resolveMarkColor(drawingObject, theme, 'stroke') ?? 'transparent'}
                strokeWidth={drawingObject.strokeWidth}
              />
            )}
            {drawingObject && drawingObject.type === 'polygon' && (
              <Line
                points={polygonPoints(drawingObject.shapeKind || 'hexagon', drawingObject.width, drawingObject.height)}
                x={drawingObject.x}
                y={drawingObject.y}
                closed
                fill={drawingObject.fill}
                stroke={resolveMarkColor(drawingObject, theme, 'stroke') ?? 'transparent'}
                strokeWidth={drawingObject.strokeWidth}
              />
            )}
            {drawingObject && drawingObject.type === 'path' && (
              <Line
                points={drawingObject.points}
                stroke={resolveMarkColor(drawingObject, theme, 'stroke') ?? 'transparent'}
                strokeWidth={drawingObject.strokeWidth}
                tension={drawingObject.tension}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={
                  drawingObject.tool === 'eraser' ? 'destination-out' : 'source-over'
                }
              />
            )}
            {drawingObject && drawingObject.type === 'arrow' && (
              <Arrow
                points={drawingObject.points}
                stroke={resolveMarkColor(drawingObject, theme, 'stroke') ?? 'transparent'}
                strokeWidth={drawingObject.strokeWidth}
                fill={resolveMarkColor(drawingObject, theme, 'stroke') ?? 'transparent'}
                pointerLength={10}
                pointerWidth={10}
                tension={drawingObject.tension}
                pointerAtBeginning={drawingObject.pointerAtBeginning}
              />
            )}
            {drawingObject && drawingObject.type === 'triangle' && (() => {
              const w = drawingObject.width
              const h = drawingObject.height
              return (
                <Line
                  points={[w / 2, 0, w, h, 0, h]}
                  x={drawingObject.x}
                  y={drawingObject.y}
                  closed
                  fill={drawingObject.fill}
                  stroke={resolveMarkColor(drawingObject, theme, 'stroke') ?? 'transparent'}
                  strokeWidth={drawingObject.strokeWidth}
                />
              )
            })()}
            {drawingObject && drawingObject.type === 'line' && (
              <Line
                points={
                  drawingObject.shapeKind === 'elbow'
                    ? [
                        drawingObject.points[0],
                        drawingObject.points[1],
                        drawingObject.points[0],
                        drawingObject.points[3],
                        drawingObject.points[2],
                        drawingObject.points[3],
                      ]
                    : drawingObject.points
                }
                stroke={resolveMarkColor(drawingObject, theme, 'stroke') ?? 'transparent'}
                strokeWidth={drawingObject.strokeWidth}
                lineCap="round"
              />
            )}

            <LaserPointer
              trail={laserTrail}
              active={laserActive}
              onFadeComplete={() => setLaserTrail([])}
            />
            
            {snapLines.map((line, i) => (
              line.x !== undefined ? (
                <Line key={`snap-x-${i}`} points={[line.x, -9999, line.x, 9999]} stroke="#0ea5e9" strokeWidth={1 / (stageRef.current?.scaleX() || 1)} dash={[4, 4]} />
              ) : (
                <Line key={`snap-y-${i}`} points={[-9999, line.y!, 9999, line.y!]} stroke="#0ea5e9" strokeWidth={1 / (stageRef.current?.scaleX() || 1)} dash={[4, 4]} />
              )
            ))}

            {selectionRect && (
              <Rect
                x={selectionRect.x}
                y={selectionRect.y}
                width={selectionRect.width}
                height={selectionRect.height}
                fill="rgba(14, 165, 233, 0.1)"
                stroke="#0ea5e9"
                strokeWidth={1 / (stageRef.current?.scaleX() || 1)}
              />
            )}
            
            <SelectionTransformer selectedIds={selectedIds} />
          </Layer>
        </Stage>
      )}

      {/* HTML Overlay for Text Editing */}
      {editingTextId && (() => {
        const obj = boardObjects.find(o => o.id === editingTextId) as any
        if (!obj) return null
        
        const stage = stageRef.current
        if (!stage) return null
        
        const scale = stage.scaleX()
        const node = stage.findOne(`#${obj.id}`)
        if (!node) return null
        
        // Frames store their caption in `label`; other text types use `text`.
        const field = obj.type === 'frame' ? 'label' : 'text'
        const textNode = ((obj.type === 'sticky' || obj.type === 'mindmap' || obj.type === 'frame' || obj.type === 'card')
          ? (node as Konva.Group).findOne('Text')
          : node) as Konva.Text
        if (!textNode) return null
        
        const absolutePos = textNode.absolutePosition()
        
        // Mirror Konva's text layout: the shape's padding insets the content
        // box, and verticalAlign positions the text inside it. Without this the
        // textarea renders top-aligned and the text jumps on blur.
        const padBase = obj.type === 'sticky' ? 10
          : obj.type === 'mindmap' ? Math.min(obj.width || 120, obj.height || 120) * 0.18
          : obj.type === 'card' ? (obj.padding ?? 10)
          : 0
        const pad = padBase * scale
        const boxW = Math.max(0, textNode.width() * scale * node.scaleX() - pad * 2)
        const boxH = Math.max(0, textNode.height() * scale * node.scaleY() - pad * 2)
        const valign = textNode.verticalAlign() || 'top'
        
        const wrapperStyle: React.CSSProperties = {
          position: 'absolute',
          top: absolutePos.y + pad + 'px',
          left: absolutePos.x + pad + 'px',
          width: boxW + 'px',
          height: boxH + 'px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: valign === 'middle' ? 'center' : valign === 'bottom' ? 'flex-end' : 'flex-start',
          transformOrigin: 'top left',
          transform: `rotate(${node.rotation()}deg)`,
          zIndex: 1000,
        }
        
        const textStyle: React.CSSProperties = {
          width: '100%',
          height: 'auto',
          margin: 0,
          padding: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          display: 'block',
          fontSize: textNode.fontSize() * scale * node.scaleY() + 'px',
          fontFamily: textNode.fontFamily(),
          fontStyle: textNode.fontStyle(),
          fontWeight: obj.type === 'frame' ? 'bold' : (obj.fontWeight || 'normal'),
          color: String(textNode.fill()),
          lineHeight: String(textNode.lineHeight()),
          textAlign: textNode.align() as any,
        }
        
        return (
          <div style={wrapperStyle}>
            <textarea
              value={obj[field] ?? ''}
              onChange={(e) => updateObject(editingTextId, { [field]: e.target.value })}
              onBlur={() => setEditingTextId(null)}
              autoFocus
              rows={Math.max(1, String(obj[field] ?? '').split('\n').length)}
              style={textStyle}
              onKeyDown={(e) => {
                e.stopPropagation()
              }}
            />
          </div>
        )
      })()}

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={() => setContextMenu(null)} 
        />
      )}

      {/* Empty State Overlay */}
      {objectIds.length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10">
          <div className="max-w-sm text-center space-y-4">
            <div className="text-5xl opacity-20">✏️</div>
            <h2 className="text-xl font-semibold text-foreground/60">Start Creating</h2>
            <p className="text-sm text-muted-foreground/70 leading-relaxed">
              Pick a tool from the left toolbar to draw, add text, shapes, or insert media. 
              Use <kbd className="px-2 py-1 bg-accent/50 rounded text-xs font-mono">Ctrl+K</kbd> for quick access.
            </p>
            <div className="flex justify-center gap-4 pt-2 text-xs text-muted-foreground/60">
              <span>✏️ Draw</span>
              <span>•</span>
              <span>📝 Text</span>
              <span>•</span>
              <span>⬛ Shapes</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

