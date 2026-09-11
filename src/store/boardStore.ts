import { create } from 'zustand'
import type { BaseObject } from '../types'

interface BoardState {
  objects: Record<string, BaseObject>;
  objectIds: string[]; 
  scale: number;
  position: { x: number; y: number };
  
  // History
  past: { objects: Record<string, BaseObject>, objectIds: string[] }[];
  future: { objects: Record<string, BaseObject>, objectIds: string[] }[];

  // Actions
  setScale: (scale: number) => void;
  setPosition: (pos: { x: number; y: number }) => void;
  addObject: (obj: BaseObject) => void;
  updateObject: (id: string, updates: Record<string, any>) => void;
  deleteObjects: (ids: string[]) => void;
  duplicateObjects: (ids: string[]) => void;
  groupObjects: (ids: string[]) => void;
  ungroupObjects: (id: string) => void;
  reorderObject: (id: string, direction: 'up' | 'down' | 'front' | 'back') => void;
  toggleLock: (ids: string[]) => void;
  toggleVisibility: (ids: string[]) => void;
  undo: () => void;
  redo: () => void;
}

export const useBoardStore = create<BoardState>((set) => ({
  objects: {},
  objectIds: [],
  scale: 1,
  position: { x: 0, y: 0 },
  past: [],
  future: [],

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
    const newState = {
      objects: {
        ...state.objects,
        [id]: { ...state.objects[id], ...updates }
      }
    }
    return {
      ...newState,
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

  groupObjects: (ids) => set((state) => {
    if (ids.length < 2) return state;
    const newObjects = { ...state.objects }
    const newIds = [...state.objectIds]
    const groupId = crypto.randomUUID()
    
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    ids.forEach(id => {
      const obj = state.objects[id]
      if (obj) {
        newObjects[id] = { ...obj, groupId }
        minX = Math.min(minX, obj.x)
        minY = Math.min(minY, obj.y)
        maxX = Math.max(maxX, obj.x + (obj.width || 0))
        maxY = Math.max(maxY, obj.y + (obj.height || 0))
      }
    })

    const groupObj: BaseObject = {
      id: groupId,
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
    
    newObjects[groupId] = groupObj
    newIds.push(groupId)

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
  })
}))
