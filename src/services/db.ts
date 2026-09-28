import type { BaseObject } from '../types'

/**
 * The canonical board id. Single source of truth: the init engine seeds and
 * migrates to this, and the UI store defaults to it. They must agree or the app
 * looks for a board that no longer exists and shows an empty canvas.
 */
export const DEFAULT_BOARD_ID = '11111111-1111-1111-1111-111111111111'
/** Pre-migration id, kept only so the init engine can rename it in place. */
export const LEGACY_BOARD_ID = 'default-board-id'

// --- Board data shape ---------------------------------------------------------

export interface BoardEntry {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  data: {
    objects: Record<string, BaseObject>
    objectIds: string[]
    pages?: { id: string; name: string }[]
    activePageId?: string
    pageSnapshots?: Record<string, { objects: Record<string, BaseObject>; objectIds: string[] }>
  }
}

// --- Electron IPC filesystem layer -------------------------------------------
// Uses the main process to write JSON files to app.getPath('userData')/boards/.
// This bypasses IndexedDB and quota-database entirely -- always works on Windows.

const ipc = (window as any).ipcRenderer as {
  invoke: (channel: string, ...args: any[]) => Promise<any>
} | undefined

const isElectron = typeof ipc !== 'undefined'

async function fsSave(entry: BoardEntry): Promise<boolean> {
  if (!isElectron) return false
  try {
    const res = await ipc!.invoke('fs-save-board', { id: entry.id, data: entry })
    return res?.ok === true
  } catch { return false }
}

async function fsLoad(id: string): Promise<BoardEntry | null> {
  if (!isElectron) return null
  try {
    const res = await ipc!.invoke('fs-load-board', id)
    return res?.ok && res.data ? res.data as BoardEntry : null
  } catch { return null }
}

async function fsList(): Promise<BoardEntry[]> {
  if (!isElectron) return []
  try {
    const res = await ipc!.invoke('fs-list-boards')
    return res?.ok && Array.isArray(res.data) ? res.data as BoardEntry[] : []
  } catch { return [] }
}

async function fsDelete(id: string): Promise<void> {
  if (!isElectron) return
  try { await ipc!.invoke('fs-delete-board', id) } catch { /* ignore */ }
}

// --- localStorage fallback ---------------------------------------------------

const LS_IDS = 'digiboard_board_ids'
const lsKey = (id: string) => `digiboard_board_${id}`

function lsSave(entry: BoardEntry) {
  try {
    localStorage.setItem(lsKey(entry.id), JSON.stringify(entry))
    const ids: string[] = JSON.parse(localStorage.getItem(LS_IDS) || '[]')
    if (!ids.includes(entry.id)) {
      localStorage.setItem(LS_IDS, JSON.stringify([...ids, entry.id]))
    }
  } catch { /* ignore */ }
}

function lsLoad(id: string): BoardEntry | null {
  try {
    const raw = localStorage.getItem(lsKey(id))
    return raw ? JSON.parse(raw) as BoardEntry : null
  } catch { return null }
}

function lsList(): BoardEntry[] {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(LS_IDS) || '[]')
    return ids
      .map(id => lsLoad(id))
      .filter((b): b is BoardEntry => b !== null)
      .sort((a, b) => a.updatedAt - b.updatedAt)
  } catch { return [] }
}

function lsDelete(id: string) {
  try {
    localStorage.removeItem(lsKey(id))
    const ids: string[] = JSON.parse(localStorage.getItem(LS_IDS) || '[]')
    localStorage.setItem(LS_IDS, JSON.stringify(ids.filter(i => i !== id)))
  } catch { /* ignore */ }
}

// --- Public API --------------------------------------------------------------

/** No-op: DB is now file-based and needs no IndexedDB setup. */
export const initDB = async () => {}

export const saveBoard = async (
  id: string,
  name: string,
  objects: Record<string, BaseObject>,
  objectIds: string[],
  metadata?: {
    pages?: { id: string; name: string }[]
    activePageId?: string
    pageSnapshots?: Record<string, { objects: Record<string, any>; objectIds: string[] }>
    /** Overrides the creation stamp. Used when a board is re-keyed, so the
     *  original creation date survives the id change. */
    createdAt?: number
  }
) => {
  const existing = (await fsLoad(id)) ?? lsLoad(id)
  const entry: BoardEntry = {
    id,
    name,
    createdAt: metadata?.createdAt ?? existing?.createdAt ?? Date.now(),
    updatedAt: Date.now(),
    data: {
      objects,
      objectIds,
      pages: metadata?.pages ?? existing?.data?.pages,
      activePageId: metadata?.activePageId ?? existing?.data?.activePageId,
      pageSnapshots: metadata?.pageSnapshots ?? existing?.data?.pageSnapshots,
    },
  }
  await fsSave(entry)
  lsSave(entry)
}

export const loadBoard = async (id: string): Promise<BoardEntry | undefined> => {
  const fsResult = await fsLoad(id)
  if (fsResult) return fsResult
  return lsLoad(id) ?? undefined
}

export const listBoards = async (): Promise<BoardEntry[]> => {
  const fsResults = await fsList()
  if (fsResults.length > 0) return fsResults
  return lsList()
}

export const deleteBoard = async (id: string) => {
  await fsDelete(id)
  lsDelete(id)
}
