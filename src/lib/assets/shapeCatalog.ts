export type ShapeKind =
  | 'rectangle'
  | 'round-rect'
  | 'circle'
  | 'ellipse'
  | 'triangle'
  | 'diamond'
  | 'pentagon'
  | 'hexagon'
  | 'star'
  | 'line'
  | 'arrow'
  | 'double-arrow'
  | 'curved-arrow'
  | 'connector'
  | 'elbow'
  | 'process'
  | 'decision'
  | 'io'
  | 'document'
  | 'database-shape'
  | 'terminator'
  | 'cloud-shape'
  | 'folder-shape'

export interface ShapeAsset {
  id: ShapeKind
  name: string
  category: 'Basic' | 'Lines' | 'Flowchart' | 'Diagram'
  keywords: string[]
  tool?: 'rectangle' | 'circle' | 'triangle' | 'line' | 'arrow'
}

export const SHAPE_CATALOG: ShapeAsset[] = [
  { id: 'rectangle', name: 'Rectangle', category: 'Basic', keywords: ['rect', 'box', 'square'], tool: 'rectangle' },
  { id: 'round-rect', name: 'Rounded Rectangle', category: 'Basic', keywords: ['rounded', 'box'] },
  { id: 'circle', name: 'Circle', category: 'Basic', keywords: ['oval', 'round'], tool: 'circle' },
  { id: 'ellipse', name: 'Ellipse', category: 'Basic', keywords: ['oval'] },
  { id: 'triangle', name: 'Triangle', category: 'Basic', keywords: ['polygon'], tool: 'triangle' },
  { id: 'diamond', name: 'Diamond', category: 'Basic', keywords: ['rhombus', 'decision'] },
  { id: 'pentagon', name: 'Pentagon', category: 'Basic', keywords: ['5', 'polygon'] },
  { id: 'hexagon', name: 'Hexagon', category: 'Basic', keywords: ['6', 'polygon'] },
  { id: 'star', name: 'Star', category: 'Basic', keywords: ['favorite', 'rating'] },
  { id: 'line', name: 'Straight Line', category: 'Lines', keywords: ['stroke'], tool: 'line' },
  { id: 'arrow', name: 'Arrow', category: 'Lines', keywords: ['pointer', 'direction'], tool: 'arrow' },
  { id: 'double-arrow', name: 'Double Arrow', category: 'Lines', keywords: ['bidirectional'] },
  { id: 'curved-arrow', name: 'Curved Arrow', category: 'Lines', keywords: ['curve', 'arc'] },
  { id: 'connector', name: 'Connector', category: 'Lines', keywords: ['link', 'line'] },
  { id: 'elbow', name: 'Elbow Connector', category: 'Lines', keywords: ['orthogonal', 'right angle'] },
  { id: 'process', name: 'Process', category: 'Flowchart', keywords: ['step', 'action', 'rect'] },
  { id: 'decision', name: 'Decision', category: 'Flowchart', keywords: ['if', 'diamond', 'yes no'] },
  { id: 'io', name: 'Input / Output', category: 'Flowchart', keywords: ['parallelogram', 'data'] },
  { id: 'document', name: 'Document', category: 'Flowchart', keywords: ['file', 'page'] },
  { id: 'database-shape', name: 'Database', category: 'Flowchart', keywords: ['cylinder', 'data', 'storage'] },
  { id: 'terminator', name: 'Terminator', category: 'Flowchart', keywords: ['start', 'end', 'capsule'] },
  { id: 'cloud-shape', name: 'Cloud', category: 'Diagram', keywords: ['network', 'internet'] },
  { id: 'folder-shape', name: 'Folder', category: 'Diagram', keywords: ['directory', 'files'] },
]

export function searchShapes(query: string): ShapeAsset[] {
  const q = query.trim().toLowerCase()
  if (!q) return SHAPE_CATALOG
  return SHAPE_CATALOG.filter((s) =>
    s.name.toLowerCase().includes(q) || s.keywords.some((k) => k.includes(q)) || s.category.toLowerCase().includes(q)
  )
}

export function polygonPoints(kind: ShapeKind, w: number, h: number): number[] {
  const cx = w / 2
  const cy = h / 2
  const regular = (sides: number, inner = 1) => {
    const pts: number[] = []
    for (let i = 0; i < sides; i++) {
      const a = (Math.PI * 2 * i) / sides - Math.PI / 2
      pts.push(cx + Math.cos(a) * cx * inner, cy + Math.sin(a) * cy * inner)
    }
    return pts
  }
  switch (kind) {
    case 'diamond':
    case 'decision':
      return [cx, 0, w, cy, cx, h, 0, cy]
    case 'pentagon':
      return regular(5)
    case 'hexagon':
      return regular(6)
    case 'star': {
      const pts: number[] = []
      for (let i = 0; i < 10; i++) {
        const a = (Math.PI * 2 * i) / 10 - Math.PI / 2
        const r = i % 2 === 0 ? 1 : 0.4
        pts.push(cx + Math.cos(a) * cx * r, cy + Math.sin(a) * cy * r)
      }
      return pts
    }
    case 'io':
      return [w * 0.18, 0, w, 0, w * 0.82, h, 0, h]
    case 'triangle':
      return [cx, 0, w, h, 0, h]
    case 'cloud-shape':
      return [
        w * 0.25, h * 0.55, w * 0.18, h * 0.35, w * 0.32, h * 0.18, w * 0.5, h * 0.22,
        w * 0.68, h * 0.12, w * 0.85, h * 0.32, w * 0.9, h * 0.55, w * 0.78, h * 0.82,
        w * 0.22, h * 0.82,
      ]
    case 'document':
      return [0, 0, w, 0, w, h * 0.82, w * 0.75, h, w * 0.5, h * 0.82, w * 0.25, h, 0, h * 0.82]
    case 'folder-shape':
      return [0, h * 0.22, 0, h, w, h, w, h * 0.22, w * 0.45, h * 0.22, w * 0.38, 0, 0, 0]
    case 'database-shape':
      return [
        0, h * 0.18,
        0, h * 0.82,
        w * 0.5, h,
        w, h * 0.82,
        w, h * 0.18,
        w * 0.5, 0,
      ]
    default:
      return [0, 0, w, 0, w, h, 0, h]
  }
}
