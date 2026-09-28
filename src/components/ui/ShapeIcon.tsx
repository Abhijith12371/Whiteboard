import type { ReactNode } from 'react'
import { polygonPoints, type ShapeKind } from '../../lib/assets/shapeCatalog'

const VIEW = 24
/** Drawable box inside the viewBox, so every glyph shares the same optical size. */
const S = 18
const O = (VIEW - S) / 2

const POLYGON_KINDS: ShapeKind[] = [
  'triangle',
  'diamond',
  'pentagon',
  'hexagon',
  'star',
  'decision',
  'io',
  'document',
  'cloud-shape',
  'folder-shape',
]

function toPoints(kind: ShapeKind): string {
  const raw = polygonPoints(kind, S, S)
  const out: string[] = []
  for (let i = 0; i < raw.length; i += 2) out.push(`${(raw[i] + O).toFixed(2)},${(raw[i + 1] + O).toFixed(2)}`)
  return out.join(' ')
}

function glyph(kind: ShapeKind): ReactNode {
  if (POLYGON_KINDS.includes(kind)) {
    return <polygon points={toPoints(kind)} />
  }

  switch (kind) {
    case 'rectangle':
      return <rect x={O} y={O} width={S} height={S} rx={1.5} />
    case 'process':
      return <rect x={O} y={O} width={S} height={S} rx={0.5} />
    case 'round-rect':
      return <rect x={O} y={O} width={S} height={S} rx={4.5} />
    case 'terminator':
      return <rect x={2} y={8.5} width={20} height={7} rx={3.5} />
    case 'circle':
      return <circle cx={12} cy={12} r={9} />
    case 'ellipse':
      return <ellipse cx={12} cy={12} rx={9} ry={6} />
    case 'database-shape':
      return (
        <>
          <ellipse cx={12} cy={6.5} rx={7} ry={3} />
          <path d="M5 6.5 V17.5 A7 3 0 0 0 19 17.5 V6.5" />
        </>
      )
    case 'line':
      return <line x1={2.5} y1={12} x2={21.5} y2={12} />
    case 'connector':
      return (
        <>
          <line x1={5} y1={12} x2={19} y2={12} />
          <circle cx={4} cy={12} r={1.6} />
          <circle cx={20} cy={12} r={1.6} />
        </>
      )
    case 'arrow':
      return (
        <>
          <line x1={2.5} y1={12} x2={18} y2={12} />
          <polyline points="14.5,8.5 19,12 14.5,15.5" />
        </>
      )
    case 'double-arrow':
      return (
        <>
          <line x1={5} y1={12} x2={19} y2={12} />
          <polyline points="8,8.5 3.5,12 8,15.5" />
          <polyline points="16,8.5 20.5,12 16,15.5" />
        </>
      )
    case 'curved-arrow':
      return (
        <>
          <path d="M5 19 A13 13 0 0 1 18 6" />
          <polyline points="18,10 18,5.5 13.5,5.5" />
        </>
      )
    case 'elbow':
      return <polyline points="5,5 5,19 19,19" />
    default:
      return <rect x={O} y={O} width={S} height={S} rx={1.5} />
  }
}

export function ShapeIcon({ kind, size = 26, className = '' }: { kind: ShapeKind; size?: number; className?: string }) {
  return (
    <svg
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width={size}
      height={size}
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph(kind)}
    </svg>
  )
}
