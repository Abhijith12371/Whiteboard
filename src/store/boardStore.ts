import { create } from 'zustand'
import type { BaseObject } from '../types'

export interface BoardPageMeta {
  id: string
  name: string
}

/** Object types whose `stroke` is treated as theme ink. */
const STROKE_INK_TYPES = new Set(['path', 'line', 'arrow'])
/** Object types whose `fill` is treated as theme ink. */
const FILL_INK_TYPES = new Set(['text'])

interface BoardState {
  objects: Record<string, BaseObject>;
  objectIds: string[]; 
  scale: number;
  position: { x: number; y: number };
  pages: BoardPageMeta[];
  activePageId: string;
  pageSnapshots: Record<string, { objects: Record<string, BaseObject>; objectIds: string[] }>;
  
  // History
  past: { objects: Record<string, BaseObject>, objectIds: string[] }[];
  future: { objects: Record<string, BaseObject>, objectIds: string[] }[];

  // Actions
  setScale: (scale: number) => void;
  setPosition: (pos: { x: number; y: number }) => void;
  addObject: (obj: BaseObject) => void;
  updateObject: (id: string, updates: Record<string, any>) => void;
  updateMultipleObjects: (updates: { id: string; updates: Record<string, any> }[]) => void;
  deleteObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[]) => void;
  groupObjects: (ids: string[], groupId?: string) => void;
  ungroupObjects: (id: string) => void;
  reorderObject: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void;
  toggleLock: (ids: string[]) => void;
  toggleVisibility: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
  recolorAllInk: (color: string) => void;
  lastRecolorCount: number;
  switchPage: (id: string) => void;
  addPage: (name?: string) => void;
  renamePage: (id: string, name: string) => void;
  deletePage: (id: string) => void;
  duplicatePage: (id: string) => void;
  loadPagesFromBoard: (data: {
    objects: Record<string, BaseObject>
    objectIds: string[]
    pages?: BoardPageMeta[]
    activePageId?: string
    pageSnapshots?: Record<string, { objects: Record<string, BaseObject>; objectIds: string[] }>
  }) => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  objects: {},
  objectIds: [],
  scale: 1,
  position: { x: 0, y: 0 },
  pages: [{ id: 'page-1', name: 'Page 1' }],
  activePageId: 'page-1',
  pageSnapshots: {},
  past: [],
  future: [],
  lastRecolorCount: 0,

  setScale: (scale) => set({ scale }),
  setPosition: (position) => set({ position }),
  
  addObject: (obj) => set((state) => {
    const newState = {
      objects: { ...state.objects, [obj.id]: obj },
      objectIds: [...state.objectIds, obj.id]
    }
    return {
      ...newState,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),
  
  updateObject: (id, updates: Record<string, any>) => set((state) => {
    const obj = state.objects[id]
    if (!obj) return state;

    const newObjects = { ...state.objects }
    
    if (obj.type === 'group') {
      const groupObj = obj as any;
      const dx = updates.x !== undefined ? updates.x - obj.x : 0;
      const dy = updates.y !== undefined ? updates.y - obj.y : 0;
      const scaleX = updates.width !== undefined ? updates.width / obj.width : 1;
      const scaleY = updates.height !== undefined ? updates.height / obj.height : 1;
      
      newObjects[id] = { ...obj, ...updates }
      
      if (dx !== 0 || dy !== 0 || scaleX !== 1 || scaleY !== 1) {
        groupObj.childIds.forEach((childId: string) => {
          const child = newObjects[childId]
          if (child) {
            newObjects[childId] = {
              ...child,
              x: obj.x + (child.x - obj.x) * scaleX + dx,
              y: obj.y + (child.y - obj.y) * scaleY + dy,
              width: child.width * scaleX,
              height: child.height * scaleY
            }
          }
        })
      }
    } else {
      newObjects[id] = { ...obj, ...updates }
    }

    return {
      objects: newObjects,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),

  updateMultipleObjects: (updatesArr) => set((state) => {
    const newObjects = { ...state.objects }
    let hasChanges = false

    updatesArr.forEach(({ id, updates }) => {
      const obj = state.objects[id]
      if (!obj) return

      hasChanges = true
      if (obj.type === 'group') {
        const groupObj = obj as any
        const dx = updates.x !== undefined ? updates.x - obj.x : 0
        const dy = updates.y !== undefined ? updates.y - obj.y : 0
        const scaleX = updates.width !== undefined ? updates.width / obj.width : 1
        const scaleY = updates.height !== undefined ? updates.height / obj.height : 1
        
        newObjects[id] = { ...obj, ...updates }
        
        if (dx !== 0 || dy !== 0 || scaleX !== 1 || scaleY !== 1) {
          groupObj.childIds.forEach((childId: string) => {
            const child = newObjects[childId] || state.objects[childId]
            if (child) {
              newObjects[childId] = {
                ...child,
                x: obj.x + (child.x - obj.x) * scaleX + dx,
                y: obj.y + (child.y - obj.y) * scaleY + dy,
                width: child.width * scaleX,
                height: child.height * scaleY
              }
            }
          })
        }
      } else {
        newObjects[id] = { ...obj, ...updates }
      }
    })

    if (!hasChanges) return state

    return {
      objects: newObjects,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),

  deleteObjects: (ids) => set((state) => {
    const newObjects = { ...state.objects }
    ids.forEach(id => delete newObjects[id])
    const newObjectIds = state.objectIds.filter(id => !ids.includes(id))
    return {
      objects: newObjects,
      objectIds: newObjectIds,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),

  duplicateObjects: (ids) => set((state) => {
    const newObjects = { ...state.objects }
    const newIds = [...state.objectIds]
    ids.forEach(id => {
      const obj = state.objects[id]
      if (obj) {
        const newId = crypto.randomUUID()
        newObjects[newId] = { ...obj, id: newId, x: obj.x + 20, y: obj.y + 20 }
        newIds.push(newId)
      }
    })
    return {
      objects: newObjects,
      objectIds: newIds,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),

  groupObjects: (ids, groupId) => set((state) => {
    if (ids.length < 2) return state;
    const newObjects = { ...state.objects }
    const newIds = [...state.objectIds]
    const resolvedGroupId = groupId || crypto.randomUUID()
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    ids.forEach(id => {
      const obj = state.objects[id]
      if (obj) {
        newObjects[id] = { ...obj, groupId: resolvedGroupId }
        minX = Math.min(minX, obj.x)
        minY = Math.min(minY, obj.y)
        maxX = Math.max(maxX, obj.x + (obj.width || 0))
        maxY = Math.max(maxY, obj.y + (obj.height || 0))
      }
    })

    const groupObj: BaseObject = {
      id: resolvedGroupId,
      type: 'group' as any,
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
      rotation: 0,
      opacity: 1,
      locked: false,
      zIndex: 0,
      childIds: ids
    } as any
    
    newObjects[resolvedGroupId] = groupObj
    newIds.push(resolvedGroupId)

    return {
      objects: newObjects,
      objectIds: newIds,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),

  ungroupObjects: (id) => set((state) => {
    const groupObj = state.objects[id] as any
    if (!groupObj || groupObj.type !== 'group') return state;
    
    const newObjects = { ...state.objects }
    const newIds = state.objectIds.filter(i => i !== id)
    
    delete newObjects[id]
    
    groupObj.childIds.forEach((childId: string) => {
      if (newObjects[childId]) {
        const { groupId, ...rest } = newObjects[childId] as any
        newObjects[childId] = rest
      }
    })

    return {
      objects: newObjects,
      objectIds: newIds,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),

  reorderObject: (id, direction) => set((state) => {
    const newIds = [...state.objectIds]
    const index = newIds.indexOf(id)
    if (index === -1) return state;
    
    newIds.splice(index, 1)
    if (direction === 'up') {
      newIds.splice(Math.min(newIds.length, index + 1), 0, id)
    } else if (direction === 'down') {
      newIds.splice(Math.max(0, index - 1), 0, id)
    } else if (direction === 'front') {
      newIds.push(id)
    } else if (direction === 'back') {
      newIds.unshift(id)
    }
    
    return {
      objectIds: newIds,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),

  toggleLock: (ids) => set((state) => {
    const newObjects = { ...state.objects }
    ids.forEach(id => {
      if (newObjects[id]) {
        newObjects[id] = { ...newObjects[id], locked: !newObjects[id].locked }
      }
    })
    return {
      objects: newObjects,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),

  toggleVisibility: (ids) => set((state) => {
    const newObjects = { ...state.objects }
    ids.forEach(id => {
      if (newObjects[id]) {
        newObjects[id] = { ...newObjects[id], hidden: !newObjects[id].hidden }
      }
    })
    return {
      objects: newObjects,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: []
    }
  }),

  undo: () => set((state) => {
    if (state.past.length === 0) return state;
    
    const previous = state.past[state.past.length - 1];
    const newPast = state.past.slice(0, state.past.length - 1);
    
    return {
      objects: previous.objects,
      objectIds: previous.objectIds,
      past: newPast,
      future: [{ objects: state.objects, objectIds: state.objectIds }, ...state.future]
    }
  }),

  redo: () => set((state) => {
    if (state.future.length === 0) return state;
    
    const next = state.future[0];
    const newFuture = state.future.slice(1);
    
    return {
      objects: next.objects,
      objectIds: next.objectIds,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: newFuture
    }
  }),

  // Repaints every existing stroke and text object with a single colour.
  // Deliberate colour is not consulted here — this is an explicit user action,
  // applied as one undoable step.
  recolorAllInk: (color) => set((state) => {
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { lastRecolorCount: 0 }
    let changed = 0

    const recolor = (obj: BaseObject): BaseObject => {
      // Eraser strokes paint with destination-out; their colour is irrelevant.
      if ((obj as any).tool === 'eraser') return obj
      const type = obj.type as string
      const key = STROKE_INK_TYPES.has(type) ? 'stroke'
        : FILL_INK_TYPES.has(type) ? 'fill'
        : null
      if (!key) return obj
      // Choosing a colour is an explicit act, so the result is always `custom`
      // and will never be re-inverted by a theme change.
      if ((obj as any)[key] === color && obj.colorMode === 'custom') return obj
      return { ...obj, [key]: color, colorMode: 'custom' } as BaseObject
    }

    const run = (source: Record<string, BaseObject>) => {
      const out: Record<string, BaseObject> = {}
      let touched = 0
      for (const id in source) {
        const before = source[id]
        const after = recolor(before)
        if (after !== before) touched++
        out[id] = after
      }
      changed += touched
      return out
    }

    const newObjects = run(state.objects)
    const newSnapshots: BoardState['pageSnapshots'] = {}
    for (const pageId in state.pageSnapshots) {
      const snapshot = state.pageSnapshots[pageId]
      newSnapshots[pageId] = {
        objects: run(snapshot.objects),
        objectIds: snapshot.objectIds,
      }
    }

    if (changed === 0) return { lastRecolorCount: 0 }

    return {
      objects: newObjects,
      pageSnapshots: newSnapshots,
      lastRecolorCount: changed,
      past: [...state.past, { objects: state.objects, objectIds: state.objectIds }],
      future: [],
    }
  }),

  switchPage: (id) => set((state) => {
    if (id === state.activePageId) return state
    const snapshots = {
      ...state.pageSnapshots,
      [state.activePageId]: { objects: state.objects, objectIds: state.objectIds },
    }
    const next = snapshots[id] || { objects: {}, objectIds: [] }
    return {
      pageSnapshots: snapshots,
      activePageId: id,
      objects: next.objects,
      objectIds: next.objectIds,
      past: [],
      future: [],
    }
  }),

  addPage: (name) => set((state) => {
    const id = crypto.randomUUID()
    const snapshots = {
      ...state.pageSnapshots,
      [state.activePageId]: { objects: state.objects, objectIds: state.objectIds },
    }
    return {
      pages: [...state.pages, { id, name: name || `Page ${state.pages.length + 1}` }],
      pageSnapshots: snapshots,
      activePageId: id,
      objects: {},
      objectIds: [],
      past: [],
      future: [],
    }
  }),

  renamePage: (id, name) => set((state) => ({
    pages: state.pages.map((p) => p.id === id ? { ...p, name } : p),
  })),

  deletePage: (id) => set((state) => {
    if (state.pages.length <= 1) return state
    const pages = state.pages.filter((p) => p.id !== id)
    const snapshots = { ...state.pageSnapshots }
    delete snapshots[id]
    if (state.activePageId === id) {
      const next = pages[0]
      const data = snapshots[next.id] || { objects: {}, objectIds: [] }
      return {
        pages,
        pageSnapshots: snapshots,
        activePageId: next.id,
        objects: data.objects,
        objectIds: data.objectIds,
        past: [],
        future: [],
      }
    }
    return { pages, pageSnapshots: snapshots }
  }),

  duplicatePage: (id) => set((state) => {
    const source = id === state.activePageId
      ? { objects: state.objects, objectIds: state.objectIds }
      : state.pageSnapshots[id]
    if (!source) return state
    const newId = crypto.randomUUID()
    const meta = state.pages.find((p) => p.id === id)
    const clonedObjects: Record<string, BaseObject> = {}
    const clonedIds = source.objectIds.map((oid) => {
      const obj = source.objects[oid]
      const nid = crypto.randomUUID()
      if (obj) clonedObjects[nid] = { ...obj, id: nid }
      return nid
    })
    return {
      pages: [...state.pages, { id: newId, name: `${meta?.name || 'Page'} copy` }],
      pageSnapshots: {
        ...state.pageSnapshots,
        [state.activePageId]: { objects: state.objects, objectIds: state.objectIds },
        [newId]: { objects: clonedObjects, objectIds: clonedIds },
      },
    }
  }),

  loadPagesFromBoard: (data) => set(() => {
    const pages = data.pages?.length ? data.pages : [{ id: 'page-1', name: 'Page 1' }]
    const activePageId = data.activePageId && pages.some((p) => p.id === data.activePageId)
      ? data.activePageId
      : pages[0].id
    return {
      pages,
      activePageId,
      pageSnapshots: data.pageSnapshots || {},
      objects: data.objects || {},
      objectIds: data.objectIds || [],
      past: [],
      future: [],
    }
  }),
}))
