import { openDB } from 'idb'
import type { DBSchema, IDBPDatabase } from 'idb'
import type { BaseObject } from '../types'

interface WhiteboardDB extends DBSchema {
  boards: {
    key: string;
    value: {
      id: string;
      name: string;
      createdAt: number;
      updatedAt: number;
      preview?: string; // base64 image or similar
      data: {
        objects: Record<string, BaseObject>;
        objectIds: string[];
      }
    };
    indexes: { 'by-updated': number };
  };
}

let dbPromise: Promise<IDBPDatabase<WhiteboardDB>> | null = null;

export const initDB = () => {
  if (!dbPromise) {
    dbPromise = openDB<WhiteboardDB>('whiteboard-app-db', 1, {
      upgrade(db) {
        const store = db.createObjectStore('boards', { keyPath: 'id' })
        store.createIndex('by-updated', 'updatedAt')
      },
    })
  }
  return dbPromise;
}

export const saveBoard = async (
  id: string, 
  name: string, 
  objects: Record<string, BaseObject>, 
  objectIds: string[]
) => {
  const db = await initDB()
  
  const existing = await db.get('boards', id)
  
  await db.put('boards', {
    id,
    name,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now(),
    data: { objects, objectIds }
  })
}

export const loadBoard = async (id: string) => {
  const db = await initDB()
  return await db.get('boards', id)
}

export const listBoards = async () => {
  const db = await initDB()
  return await db.getAllFromIndex('boards', 'by-updated')
}

export const deleteBoard = async (id: string) => {
  const db = await initDB()
  await db.delete('boards', id)
}
