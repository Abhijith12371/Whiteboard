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
