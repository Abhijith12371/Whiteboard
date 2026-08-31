export type ObjectType = 'rectangle' | 'ellipse' | 'text' | 'sticky' | 'path' | 'image' | 'arrow'

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

export interface ImageObject extends BaseObject {
  type: 'image'
  src: string
}

export interface ArrowObject extends BaseObject {
  type: 'arrow'
  points: number[]
  stroke: string
  strokeWidth: number
}
