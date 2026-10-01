export type ObjectType = 'rectangle' | 'ellipse' | 'text' | 'sticky' | 'path' | 'image' | 'arrow' | 'group' | 'triangle' | 'line' | 'polygon' | 'circle' | 'mindmap' | 'frame' | 'card'

/**
 * How a mark's colour was chosen.
 * - `auto`   the user drew with the default pen, or inserted a preset shape;
 *            no colour is stored, so the actual ink is resolved per render from
 *            the active theme.
 * - `custom` the user deliberately picked a colour; the hex is stored and is
 *            never auto-inverted or reassigned.
 * Absent on objects that predate this field (templates, cards, frames) and on
 * marks that are never theme-dependent — those keep their literal colour.
 */
export type ColorMode = 'auto' | 'custom'

export interface BaseObject {
  id: string
  type: ObjectType
  x: number
  y: number
  width: number
  height: number
  rotation: number
  opacity: number
  locked: boolean
  zIndex: number
  groupId?: string
  colorMode?: ColorMode
  hidden?: boolean
  name?: string
  assetKind?: 'icon' | 'sticker' | 'image'
  iconName?: string
  iconColor?: string
  stickerId?: string
  shapeKind?: string
  pointerAtBeginning?: boolean
  dash?: number[]
}

export interface GroupObject extends BaseObject {
  type: 'group'
  childIds: string[]
}

export interface RectangleObject extends BaseObject {
  type: 'rectangle'
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius?: number
}

export interface EllipseObject extends BaseObject {
  type: 'ellipse'
  fill: string
  stroke: string
  strokeWidth: number
}

export interface PathObject extends BaseObject {
  type: 'path'
  points: number[]
  stroke: string
  strokeWidth: number
  tension?: number
}

export interface TextObject extends BaseObject {
  type: 'text'
  text: string
  fontSize: number
  fontFamily: string
  fill: string
  fontWeight: 'normal' | 'bold'
  fontStyle: 'normal' | 'italic'
  align: 'left' | 'center' | 'right'
}

export interface StickyObject extends BaseObject {
  type: 'sticky'
  text: string
  fontSize: number
  fontFamily: string
  color: string
}

export interface MindmapObject extends BaseObject {
  type: 'mindmap'
  text: string
  fontSize: number
  fontFamily: string
  fill: string
  stroke: string
  strokeWidth: number
}

export interface FrameObject extends BaseObject {
  type: 'frame'
  label: string
  fontSize: number
  fontFamily: string
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
  dash: number[]
  labelColor: string
}

/** A shape with an editable label embedded in it — one object, not two. */
export interface CardObject extends BaseObject {
  type: 'card'
  text: string
  fontSize: number
  fontFamily: string
  fill: string
  stroke: string
  strokeWidth: number
  cornerRadius: number
  textColor: string
  align: 'left' | 'center' | 'right'
  valign: 'top' | 'middle' | 'bottom'
  padding: number
  shape: 'rect' | 'ellipse'
}

/**
 * Set when an object's bytes live in cloud storage rather than inline in the
 * board. `src` remains the renderable URL either way, so existing boards and
 * every render path keep working — this only records where the bytes came from
 * so the file can be reconciled and cleaned up later.
 */
export interface AssetRef {
  /** R2 object key: users/{userId}/boards/{boardId}/{fileId}. */
  key: string
  /** `file_references` row id. */
  fileId: string
}

export interface ImageObject extends BaseObject {
  type: 'image'
  src: string
  assetRef?: AssetRef
}

export interface ArrowObject extends BaseObject {
  type: 'arrow'
  points: number[]
  stroke: string
  strokeWidth: number
}

export interface TriangleObject extends BaseObject {
  type: 'triangle'
  fill: string
  stroke: string
  strokeWidth: number
}

export interface LineObject extends BaseObject {
  type: 'line'
  points: number[]
  stroke: string
  strokeWidth: number
}

export interface PolygonObject extends BaseObject {
  type: 'polygon'
  points: number[]
  fill: string
  stroke: string
  strokeWidth: number
}

export interface CircleObject extends BaseObject {
  type: 'circle'
  fill: string
  stroke: string
  strokeWidth: number
}
