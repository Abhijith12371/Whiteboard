import { useRef, useEffect, useState, useMemo } from 'react'
import { Stage, Layer, Rect, Circle, Line, Text, Group, Image as KonvaImage, Arrow } from 'react-konva'
import { useUIStore } from '../../store/uiStore'
import { useBoardStore } from '../../store/boardStore'
import Konva from 'konva'
import type { KonvaEventObject } from 'konva/lib/Node'
import { SelectionTransformer } from './SelectionTransformer'
import { ContextMenu } from './ContextMenu'

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

export const Canvas: React.FC = () => {
  const stageRef = useRef<Konva.Stage>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  
  const [size, setSize] = useState({ width: 0, height: 0 })
  
  const isSpacePressed = useUIStore((state) => state.isSpacePressed)
  const activeTool = useUIStore((state) => state.activeTool)
  const selectedIds = useUIStore((state) => state.selectedIds)
  const setSelectedIds = useUIStore((state) => state.setSelectedIds)
  const penColor = useUIStore((state) => state.penColor)
  const penSize = useUIStore((state) => state.penSize)
  const eraserSize = useUIStore((state) => state.eraserSize)
  const boardBackground = useUIStore((state) => state.boardBackground)
  const boardColor = useUIStore((state) => state.boardColor)
  
  const setStoreScale = useBoardStore((state) => state.setScale)
  const setStorePosition = useBoardStore((state) => state.setPosition)
  const updateObject = useBoardStore((state) => state.updateObject)
  const objects = useBoardStore((state) => state.objects)
  const objectIds = useBoardStore((state) => state.objectIds)

  // Derive ordered array stably — avoids infinite loop from inline .map() in selector
  const boardObjects = useMemo(
    () => objectIds.map(id => objects[id]).filter(Boolean),
    [objectIds, objects]
  )

  const [isMiddleClickPan, setIsMiddleClickPan] = useState(false)
  const [drawingObject, setDrawingObject] = useState<any>(null)
  const [editingTextId, setEditingTextId] = useState<string | null>(null)
  const [selectionRect, setSelectionRect] = useState<{ x: number, y: number, width: number, height: number } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number } | null>(null)
  const [snapLines, setSnapLines] = useState<{ x?: number, y?: number }[]>([])

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
        stroke: '#09090b',
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
        stroke: '#09090b',
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
        stroke: '#09090b',
        strokeWidth: 2,
        rotation: 0,
        opacity: 1,
        locked: false,
        zIndex: 0
      })
    } else if (activeTool === 'pen' || activeTool === 'eraser') {
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
        stroke: activeTool === 'eraser' ? '#000000' : penColor,
        strokeWidth: activeTool === 'eraser' ? eraserSize : penSize,
        tension: 0.5,
        rotation: 0,
        opacity: 1,
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
        stroke: '#09090b',
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
        fill: '#09090b',
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
    }
  }

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const stage = e.target.getStage()
    if (!stage) return

    const pos = getRelativePointerPosition(stage)
    if (!pos) return

    if (selectionRect && activeTool === 'select') {
      setSelectionRect({
        ...selectionRect,
        width: pos.x - selectionRect.x,
        height: pos.y - selectionRect.y
      })
      return
    }

    if (!drawingObject) return

    if (drawingObject.type === 'rectangle' || drawingObject.type === 'circle') {
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
    } else if (drawingObject.type === 'triangle') {
      setDrawingObject({
        ...drawingObject,
        width: pos.x - drawingObject.x,
        height: pos.y - drawingObject.y,
      })
    } else if (drawingObject.type === 'line') {
      setDrawingObject({
        ...drawingObject,
        points: [drawingObject.points[0], drawingObject.points[1], pos.x, pos.y]
      })
    }
  }

  const handleMouseUp = (_e: KonvaEventObject<MouseEvent>) => {
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
        }).map(o => o.id)
        setSelectedIds(newSelectedIds)
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
    if (obj && (obj.type === 'text' || obj.type === 'sticky')) {
      setEditingTextId(id)
    }
  }

  const handleObjectClick = (e: KonvaEventObject<MouseEvent>, id: string) => {
    if (activeTool !== 'select') return
    e.cancelBubble = true
    
    if (e.evt.shiftKey) {
      if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(selectedId => selectedId !== id))
      } else {
        setSelectedIds([...selectedIds, id])
      }
    } else {
      setSelectedIds([id])
    }
  }

  const handleObjectDragMove = (e: KonvaEventObject<DragEvent>, id: string) => {
    const node = e.target
    const SNAP_DIST = 5
    const guideLines: { x?: number, y?: number }[] = []
    
    let snappedX = false
    let snappedY = false
    let newX = node.x()
    let newY = node.y()

    for (const obj of boardObjects) {
      if (obj.id === id || obj.hidden) continue
      
      if (!snappedX && Math.abs(node.x() - obj.x) < SNAP_DIST) {
        newX = obj.x; snappedX = true; guideLines.push({ x: obj.x })
      }
      
      if (!snappedY && Math.abs(node.y() - obj.y) < SNAP_DIST) {
        newY = obj.y; snappedY = true; guideLines.push({ y: obj.y })
      }
    }

    node.position({ x: newX, y: newY })
    setSnapLines(guideLines)
  }

  const handleObjectDragEnd = (e: KonvaEventObject<DragEvent>, id: string) => {
    setSnapLines([])
    updateObject(id, {
      x: e.target.x(),
      y: e.target.y()
    })
  }

  const handleTransformEnd = (e: KonvaEventObject<Event>, id: string) => {
    const node = e.target
    const scaleX = node.scaleX()
    const scaleY = node.scaleY()
    
    // Reset scale to 1 and apply to width/height to avoid weird scaling issues down the line
    node.scaleX(1)
    node.scaleY(1)

    const obj = useBoardStore.getState().objects[id]
    
    updateObject(id, {
      x: node.x(),
      y: node.y(),
      rotation: node.rotation(),
      width: Math.max(5, obj.width * scaleX),
      height: Math.max(5, obj.height * scaleY),
    })
  }

  // Board background CSS
  const stageNode = stageRef.current
  const bgSize = 20 * (stageNode?.scaleX() || 1)
  const bgPos = {
    x: (stageNode?.x() || 0) % bgSize,
    y: (stageNode?.y() || 0) % bgSize
  }

  const BOARD_COLOR_MAP: Record<string, string> = {
    white: '#ffffff',
    cream: '#fefce8',
    sky: '#f0f9ff',
    mint: '#f0fdf4',
    lavender: '#faf5ff',
    dark: '#18181b',
  }
  const LINE_COLOR_MAP: Record<string, string> = {
    white: '#e5e7eb',
    cream: '#d9f099',
    sky: '#bae6fd',
    mint: '#bbf7d0',
    lavender: '#ddd6fe',
    dark: '#3f3f46',
  }
  const bgColorHex = BOARD_COLOR_MAP[boardColor] || '#ffffff'
  const lineColor = LINE_COLOR_MAP[boardColor] || '#e5e7eb'
  const dotColor = boardColor === 'dark' ? '#52525b' : '#d1d5db'

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
      className="w-full h-full relative outline-none"
      onContextMenu={handleContextMenu}
      style={{ 
        cursor: isPanActive ? (isMiddleClickPan ? 'grabbing' : 'grab') : (activeTool === 'select' ? 'default' : 'crosshair'),
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
            {boardObjects.map((obj) => {
              if (obj.hidden) return null
              if (obj.type === 'rectangle') {
                const rectObj = obj as any
                return (
                  <Rect 
                    key={obj.id} 
                    id={obj.id}
                    {...rectObj} 
                    cornerRadius={4}
                    draggable={activeTool === 'select' && !obj.locked}
                    onClick={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if ((obj.type as string) === 'circle') {
                const circObj = obj as any
                return (
                  <Circle 
                    key={obj.id}
                    id={obj.id}
                    x={circObj.x + circObj.width / 2} 
                    y={circObj.y + circObj.height / 2} 
                    radius={Math.abs(Math.max(circObj.width, circObj.height) / 2)} 
                    fill={circObj.fill}
                    stroke={circObj.stroke}
                    strokeWidth={circObj.strokeWidth}
                    rotation={circObj.rotation}
                    draggable={activeTool === 'select' && !obj.locked}
                    onClick={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
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
                    stroke={pathObj.stroke}
                    strokeWidth={pathObj.strokeWidth}
                    tension={pathObj.tension}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation={
                      pathObj.tool === 'eraser' ? 'destination-out' : 'source-over'
                    }
                    rotation={pathObj.rotation}
                    draggable={activeTool === 'select' && !obj.locked}
                    onClick={(e) => handleObjectClick(e, obj.id)}
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
                    fill={textObj.fill}
                    fontStyle={textObj.fontStyle}
                    align={textObj.align}
                    rotation={textObj.rotation}
                    draggable={activeTool === 'select' && !obj.locked}
                    onClick={(e) => handleObjectClick(e, obj.id)}
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
                    onClick={(e) => handleObjectClick(e, obj.id)}
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
              if (obj.type === 'image') {
                const imgObj = obj as any
                return (
                  <URLImage
                    key={obj.id}
                    id={obj.id}
                    src={imgObj.src}
                    x={imgObj.x}
                    y={imgObj.y}
                    width={imgObj.width}
                    height={imgObj.height}
                    rotation={imgObj.rotation}
                    draggable={activeTool === 'select' && !obj.locked}
                    onClick={(e: KonvaEventObject<MouseEvent>) => handleObjectClick(e, obj.id)}
                    onDragMove={(e: KonvaEventObject<DragEvent>) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e: KonvaEventObject<DragEvent>) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e: KonvaEventObject<Event>) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              if (obj.type === 'arrow') {
                const arrowObj = obj as any
                return (
                  <Arrow
                    key={obj.id}
                    id={obj.id}
                    x={arrowObj.x}
                    y={arrowObj.y}
                    points={arrowObj.points}
                    stroke={arrowObj.stroke}
                    strokeWidth={arrowObj.strokeWidth}
                    fill={arrowObj.stroke}
                    pointerLength={10}
                    pointerWidth={10}
                    rotation={arrowObj.rotation}
                    draggable={activeTool === 'select' && !obj.locked}
                    onClick={(e) => handleObjectClick(e, obj.id)}
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
                    stroke={triObj.stroke}
                    strokeWidth={triObj.strokeWidth}
                    rotation={triObj.rotation}
                    opacity={triObj.opacity}
                    draggable={activeTool === 'select' && !obj.locked}
                    onClick={(e) => handleObjectClick(e, obj.id)}
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
                    stroke={lineObj.stroke}
                    strokeWidth={lineObj.strokeWidth}
                    lineCap="round"
                    rotation={lineObj.rotation}
                    opacity={lineObj.opacity}
                    draggable={activeTool === 'select' && !obj.locked}
                    onClick={(e) => handleObjectClick(e, obj.id)}
                    onDragMove={(e) => handleObjectDragMove(e, obj.id)}
                    onDragEnd={(e) => handleObjectDragEnd(e, obj.id)}
                    onTransformEnd={(e) => handleTransformEnd(e, obj.id)}
                  />
                )
              }
              return null
            })}
            
            {/* Drawing Object */}
            {drawingObject && drawingObject.type === 'rectangle' && (
              <Rect {...drawingObject} cornerRadius={4} />
            )}
            {drawingObject && drawingObject.type === 'circle' && (
              <Circle 
                x={drawingObject.x + drawingObject.width / 2} 
                y={drawingObject.y + drawingObject.height / 2} 
                radius={Math.abs(Math.max(drawingObject.width, drawingObject.height) / 2)} 
                fill={drawingObject.fill}
                stroke={drawingObject.stroke}
                strokeWidth={drawingObject.strokeWidth}
              />
            )}
            {drawingObject && drawingObject.type === 'path' && (
              <Line
                points={drawingObject.points}
                stroke={drawingObject.stroke}
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
                stroke={drawingObject.stroke}
                strokeWidth={drawingObject.strokeWidth}
                fill={drawingObject.stroke}
                pointerLength={10}
                pointerWidth={10}
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
                  stroke={drawingObject.stroke}
                  strokeWidth={drawingObject.strokeWidth}
                />
              )
            })()}
            {drawingObject && drawingObject.type === 'line' && (
              <Line
                points={drawingObject.points}
                stroke={drawingObject.stroke}
                strokeWidth={drawingObject.strokeWidth}
                lineCap="round"
              />
            )}
            
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
        
        const textNode = (obj.type === 'sticky' ? (node as Konva.Group).findOne('Text') : node) as Konva.Text
        if (!textNode) return null
        
        const absolutePos = textNode.absolutePosition()
        
        const style: React.CSSProperties = {
          position: 'absolute',
          top: absolutePos.y + 'px',
          left: absolutePos.x + 'px',
          width: textNode.width() * scale * node.scaleX() + 'px',
          height: textNode.height() * scale * node.scaleY() + 'px',
          fontSize: textNode.fontSize() * scale * node.scaleY() + 'px',
          fontFamily: textNode.fontFamily(),
          fontStyle: textNode.fontStyle(),
          fontWeight: obj.fontWeight || 'normal',
          color: String(textNode.fill()),
          padding: obj.type === 'sticky' ? `${10 * scale}px` : '0px',
          margin: 0,
          background: 'transparent',
          border: 'none',
          outline: 'none',
          resize: 'none',
          overflow: 'hidden',
          lineHeight: String(textNode.lineHeight()),
          textAlign: textNode.align() as any,
          transformOrigin: 'top left',
          transform: `rotate(${node.rotation()}deg)`,
          zIndex: 1000,
        }
        
        return (
          <textarea
            value={obj.text}
            onChange={(e) => updateObject(editingTextId, { text: e.target.value })}
            onBlur={() => setEditingTextId(null)}
            autoFocus
            style={style}
            onKeyDown={(e) => {
              e.stopPropagation()
            }}
          />
        )
      })()}

      {contextMenu && (
        <ContextMenu 
          x={contextMenu.x} 
          y={contextMenu.y} 
          onClose={() => setContextMenu(null)} 
        />
      )}
    </div>
  )
}

