import { useBoardStore } from '../store/boardStore'
import { lucideToDataUrl } from './lucideSvg'

type Obj = Record<string, any>

/**
 * Inserted icons are SVG data URLs with the stroke colour baked in, so they
 * cannot follow CSS like the rest of the UI. Recolouring therefore has to
 * rewrite both `iconColor` and the regenerated `src`.
 */
function repaint(obj: Obj, color: string): boolean {
  if (obj.type !== 'image' || obj.assetKind !== 'icon' || !obj.iconName) return false
  if (obj.iconColor === color) return false
  const src = lucideToDataUrl(obj.iconName, color, obj.width || 96)
  if (!src) return false
  obj.iconColor = color
  obj.src = src
  return true
}

function sweep(pick: (obj: Obj) => boolean | undefined): number {
  const store = useBoardStore.getState()
  const objects: Record<string, Obj> = {}
  const snapshots: typeof store.pageSnapshots = {}
  let changed = 0

  for (const id in store.objects) {
    const before = store.objects[id] as Obj
    const copy = { ...before }
    if (pick(copy)) changed++
    objects[id] = copy as any
  }

  for (const pageId in store.pageSnapshots) {
    const snapshot = store.pageSnapshots[pageId]
    const objs: Record<string, Obj> = {}
    for (const id in snapshot.objects) {
      const copy = { ...(snapshot.objects[id] as Obj) }
      if (pick(copy)) changed++
      objs[id] = copy as any
    }
    snapshots[pageId] = { objects: objs as any, objectIds: snapshot.objectIds }
  }

  if (changed === 0) return 0

  useBoardStore.setState({
    objects: objects as any,
    pageSnapshots: snapshots,
    past: [...store.past, { objects: store.objects, objectIds: store.objectIds }],
    future: [],
  })
  return changed
}

/** Repaint every icon with one explicit colour. */
export function recolorIcons(color: string): number {
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return 0
  return sweep((obj) => repaint(obj, color))
}
