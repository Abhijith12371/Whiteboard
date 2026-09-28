import { useId, useMemo } from 'react'
import { useUIStore } from '../../store/uiStore'
import { resolveBoardSurface, resolveMarkColor } from '../../lib/colors'

/**
 * Board preview for the home grid.
 *
 * Renders the real object data as SVG so a board is recognisable at a glance.
 * Coordinates mirror the Konva stage: every object draws from its own top-left
 * (x, y) and rotates about its own centre, and group children already carry
 * absolute coordinates, so the tree can be flattened without special casing.
 *
 * Kept deliberately cheap — paths are decimated and the object count is capped
 * — because the grid mounts one of these per board and some boards are large.
 */

const MAX_OBJECTS = 500
const MAX_POINTS = 80
const PADDING = 16

interface Box {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

const EMPTY: Box = { minX: 0, minY: 0, maxX: 0, maxY: 0 }

function boxForObject(obj: any): Box {
  const x = Number(obj.x) || 0
  const y = Number(obj.y) || 0
  const w = Math.abs(Number(obj.width) || 0)
  const h = Math.abs(Number(obj.height) || 0)

  // Point-based objects can extend past their stored width/height, so the
  // points are the more truthful measure of the visual extent.
  const pts: number[] | undefined = Array.isArray(obj.points) ? obj.points : undefined
  if (pts && pts.length >= 2) {
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i < pts.length; i += 2) {
      const px = pts[i]
      const py = pts[i + 1]
      if (!Number.isFinite(px) || !Number.isFinite(py)) continue
      if (px < minX) minX = px
      if (px > maxX) maxX = px
      if (py < minY) minY = py
      if (py > maxY) maxY = py
    }
    if (Number.isFinite(minX)) {
      return { minX: x + minX, minY: y + minY, maxX: x + maxX, maxY: y + maxY }
    }
  }

  return { minX: x, minY: y, maxX: x + w, maxY: y + h }
}

/** Thin out dense point lists; the first and last points are always kept. */
function decimate(points: number[]): number[] {
  const count = points.length / 2
  if (count <= MAX_POINTS) return points
  const step = Math.ceil(count / MAX_POINTS)
  const out: number[] = []
  for (let i = 0; i < count; i += step) {
    out.push(points[i * 2], points[i * 2 + 1])
  }
  const last = count - 1
  if ((last % step) !== 0) out.push(points[last * 2], points[last * 2 + 1])
  return out
}

const toPairs = (points: number[]) => {
  const out: string[] = []
  for (let i = 0; i < points.length; i += 2) {
    out.push(`${points[i]},${points[i + 1]}`)
  }
  return out.join(' ')
}

/**
 * Smooth a freehand stroke. SVG has no equivalent of Konva's `tension`, so the
 * stroke is drawn as quadratics through segment midpoints, which reads the same
 * at thumbnail size.
 */
function smoothPath(points: number[]): string {
  const n = points.length / 2
  if (n < 3) return `M ${points[0]},${points[1]} L ${points[points.length - 2]},${points[points.length - 1]}`

  let d = `M ${points[0]},${points[1]}`
  for (let i = 1; i < n - 1; i++) {
    const cx = points[i * 2]
    const cy = points[i * 2 + 1]
    const mx = (cx + points[(i + 1) * 2]) / 2
    const my = (cy + points[(i + 1) * 2 + 1]) / 2
    d += ` Q ${cx},${cy} ${mx},${my}`
  }
  const lx = points[(n - 1) * 2]
  const ly = points[(n - 1) * 2 + 1]
  d += ` L ${lx},${ly}`
  return d
}

/** Arrowhead sized in board units so it stays visible however far we zoom out. */
function arrowHead(ax: number, ay: number, bx: number, by: number, size: number) {
  const angle = Math.atan2(by - ay, bx - ax)
  const spread = Math.PI / 7
  const p1 = [bx - size * Math.cos(angle - spread), by - size * Math.sin(angle - spread)]
  const p2 = [bx - size * Math.cos(angle + spread), by - size * Math.sin(angle + spread)]
  return `${bx},${by} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`
}

interface BoardThumbnailProps {
  objects: Record<string, any>
  objectIds: string[]
}

/** A fit-to-content preview of a single board, or null when it is empty. */
export function BoardThumbnail({ objects, objectIds }: BoardThumbnailProps) {
  const theme = useUIStore((s) => s.theme)
  const boardColor = useUIStore((s) => s.boardColor)
  const boardBackground = useUIStore((s) => s.boardBackground)

  const surface = useMemo(() => resolveBoardSurface(boardColor, theme), [boardColor, theme])
  // One instance per board, so the clip path id must be unique — a shared id
  // would make every thumbnail resolve to whichever board mounted first.
  // Declared before any early return so the hook order stays stable.
  const clipId = useId()

  const model = useMemo(() => {
    const visible: any[] = []
    for (const id of objectIds) {
      const obj = objects[id]
      // A group is a container, not a mark — its children are separate objects
      // with absolute coordinates and appear on their own.
      if (!obj || obj.hidden || obj.type === 'group') continue
      visible.push(obj)
      if (visible.length >= MAX_OBJECTS) break
    }

    let bounds = EMPTY
    let hasContent = false
    for (const obj of visible) {
      const b = boxForObject(obj)
      if (!Number.isFinite(b.minX) || !Number.isFinite(b.maxX)) continue
      bounds = hasContent
        ? {
            minX: Math.min(bounds.minX, b.minX),
            minY: Math.min(bounds.minY, b.minY),
            maxX: Math.max(bounds.maxX, b.maxX),
            maxY: Math.max(bounds.maxY, b.maxY),
          }
        : b
      hasContent = true
    }

    if (!hasContent) return null

    const w = Math.max(1, bounds.maxX - bounds.minX)
    const h = Math.max(1, bounds.maxY - bounds.minY)
    // Square the box so the mapping below is a uniform scale: a non-uniform
    // one would distort strokes and text.
    const side = Math.max(w, h) + PADDING * 2

    return { visible, bounds, side }
  }, [objects, objectIds])

  if (!model) return null

  const { visible, bounds, side } = model
  // Tile is 4:3, so the uniform content square is centred inside it.
  const scale = 1 / side
  const offsetX = -(bounds.minX - PADDING)
  const offsetY = -(bounds.minY - PADDING)

  const bgImage =
    boardBackground === 'dots'
      ? `radial-gradient(circle, ${surface.dot} 1.2px, transparent 1.2px)`
      : undefined

  return (
    <svg
      className="absolute inset-0 h-full w-full"
      viewBox={`0 0 ${side * (4 / 3)} ${side}`}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <rect x="0" y="0" width={side * (4 / 3)} height={side} />
        </clipPath>
      </defs>

      <rect
        x="0"
        y="0"
        width={side * (4 / 3)}
        height={side}
        fill={surface.bg}
        style={bgImage ? { backgroundImage: bgImage, backgroundSize: '8px 8px' } : undefined}
      />

      <g clipPath={`url(#${clipId})`}>
        <g
          transform={`translate(${(side * (4 / 3) - side) / 2} 0) scale(${scale}) translate(${offsetX} ${offsetY})`}
        >
          {visible.map(obj => (
            <Mark key={obj.id} obj={obj} theme={theme} />
          ))}
        </g>
      </g>
    </svg>
  )
}

function Mark({ obj, theme }: { obj: any; theme: 'light' | 'dark' }) {
  const x = Number(obj.x) || 0
  const y = Number(obj.y) || 0
  const w = Math.abs(Number(obj.width) || 0)
  const h = Math.abs(Number(obj.height) || 0)
  const rotation = Number(obj.rotation) || 0
  const opacity = obj.opacity ?? 1

  const ink = resolveMarkColor(obj, theme, 'stroke') ?? 'transparent'
  const fill = obj.fill && obj.fill !== 'transparent' ? obj.fill : 'transparent'
  const strokeWidth = Number(obj.strokeWidth) || 0
  // Object-relative text, so the font scales with the fitted viewBox.
  const fontSize = Number(obj.fontSize) || 16

  // Konva rotates about the node's own centre.
  const transform =
    `translate(${x} ${y})` + (rotation ? ` rotate(${rotation} ${w / 2} ${h / 2})` : '')

  const common = { opacity, transform } as const

  switch (obj.type) {
    case 'rectangle':
    case 'frame': {
      const dash = obj.type === 'frame' && Array.isArray(obj.dash) ? obj.dash.join(' ') : undefined
      return (
        <rect
          {...common}
          width={w}
          height={h}
          rx={obj.cornerRadius ?? 4}
          fill={obj.type === 'frame' ? 'none' : fill}
          stroke={obj.type === 'frame' ? obj.stroke || ink : ink}
          strokeWidth={strokeWidth}
          strokeDasharray={dash}
        />
      )
    }

    case 'ellipse':
      return (
        <ellipse {...common} cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={ink} strokeWidth={strokeWidth} />
      )

    case 'circle':
      return (
        <circle {...common} cx={w / 2} cy={h / 2} r={Math.min(w, h) / 2} fill={fill} stroke={ink} strokeWidth={strokeWidth} />
      )

    case 'triangle':
      return (
        <polygon
          {...common}
          points={`${w / 2},0 ${w},${h} 0,${h}`}
          fill={fill}
          stroke={ink}
          strokeWidth={strokeWidth}
        />
      )

    case 'polygon':
      return (
        <polygon {...common} points={toPairs(decimate(obj.points ?? []))} fill={fill} stroke={ink} strokeWidth={strokeWidth} />
      )

    case 'path': {
      const pts = decimate(Array.isArray(obj.points) ? obj.points : [])
      if (pts.length < 2) return null
      return (
        <path
          {...common}
          d={smoothPath(pts)}
          fill="none"
          stroke={ink}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )
    }

    case 'line': {
      const pts = decimate(Array.isArray(obj.points) ? obj.points : [])
      if (pts.length < 4) return null
      return (
        <polyline
          {...common}
          points={toPairs(pts)}
          fill="none"
          stroke={ink}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
      )
    }

    case 'arrow': {
      const pts = Array.isArray(obj.points) ? obj.points : []
      if (pts.length < 4) return null
      const ax = pts[pts.length - 4]
      const ay = pts[pts.length - 3]
      const bx = pts[pts.length - 2]
      const by = pts[pts.length - 1]
      return (
        <g {...common}>
          <polyline points={toPairs(pts)} fill="none" stroke={ink} strokeWidth={strokeWidth} strokeLinecap="round" />
          <polygon points={arrowHead(ax, ay, bx, by, Math.max(10, strokeWidth * 3.5))} fill={ink} />
        </g>
      )
    }

    case 'image':
      return <image {...common} width={w} height={h} href={obj.src} preserveAspectRatio="xMidYMid slice" />

    case 'text':
      return (
        <text
          {...common}
          fill={obj.fill || ink}
          fontSize={fontSize}
          fontFamily={obj.fontFamily || 'sans-serif'}
          fontWeight={obj.fontWeight || 'normal'}
          fontStyle={obj.fontStyle || 'normal'}
          textAnchor={obj.align === 'center' ? 'middle' : obj.align === 'right' ? 'end' : 'start'}
        >
          {obj.text}
        </text>
      )

    case 'sticky':
    case 'mindmap':
    case 'card': {
      // A card can be an ellipse; everything else is a rounded rectangle.
      const isEllipse = obj.type === 'card' && obj.shape === 'ellipse'
      const textColor =
        obj.type === 'sticky' ? 'rgba(0,0,0,0.82)' : obj.textColor || resolveMarkColor(obj, theme, 'fill') || ink

      return (
        <g {...common}>
          {isEllipse ? (
            <ellipse cx={w / 2} cy={h / 2} rx={w / 2} ry={h / 2} fill={fill} stroke={ink} strokeWidth={strokeWidth} />
          ) : (
            <rect width={w} height={h} rx={obj.cornerRadius ?? 8} fill={fill} stroke={obj.type === 'card' ? ink : 'none'} strokeWidth={strokeWidth} />
          )}
          <text
            x={obj.type === 'card' ? (obj.padding ?? 12) : w / 2}
            y={obj.type === 'card' ? (obj.padding ?? 12) + fontSize : h / 2}
            fill={textColor}
            fontSize={fontSize}
            fontFamily={obj.fontFamily || 'sans-serif'}
            textAnchor={obj.type === 'card' ? 'start' : 'middle'}
            dominantBaseline={obj.type === 'card' ? 'auto' : 'middle'}
          >
            {obj.text}
          </text>
        </g>
      )
    }

    default:
      return null
  }
}
