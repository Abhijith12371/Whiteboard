import { supabase, isSupabaseConfigured } from './supabase'
import { useAuthStore } from '../store/authStore'
import { useUIStore } from '../store/uiStore'
import { loadBoard, saveBoard, listBoards, deleteBoard, type BoardEntry } from '../services/db'

/**
 * Per-device sync bookkeeping. `lastSyncedAt` is the watermark that lets us tell
 * "I already pushed this" apart from "this changed while I was away", which is
 * what makes conflict detection possible.
 */
const STATE_KEY = 'digiboard_sync_state'

interface BoardWatermark {
  lastSyncedAt: number
}

function readState(): Record<string, BoardWatermark> {
  try {
    return JSON.parse(localStorage.getItem(STATE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeWatermark(boardId: string, at: number) {
  try {
    const all = readState()
    all[boardId] = { lastSyncedAt: at }
    localStorage.setItem(STATE_KEY, JSON.stringify(all))
  } catch {
    /* ignore */
  }
}

function readWatermark(boardId: string): number {
  return readState()[boardId]?.lastSyncedAt ?? 0
}

/**
 * Board deletions waiting to reach the cloud.
 *
 * A delete issued while offline cannot be sent immediately, and simply skipping
 * it would let the next pull re-download the row and resurrect the board. The
 * tombstone is the durable record of "this id is gone", so the pull step can
 * skip it and the push step never re-uploads it.
 */
const DELETE_KEY = 'digiboard_delete_queue'

interface Tombstone {
  id: string
  at: number
}

function readTombstones(): Tombstone[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(DELETE_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter((t) => typeof t?.id === 'string') : []
  } catch {
    return []
  }
}

function writeTombstones(list: Tombstone[]) {
  try {
    localStorage.setItem(DELETE_KEY, JSON.stringify(list))
  } catch {
    /* ignore */
  }
}

export interface CloudBoardRow {
  id: string
  owner_id: string
  name: string
  data: any
  updated_at: string
}

/**
 * `pending` — on this device, never uploaded.
 * `queued`  — edited since the last successful push.
 * `synced`  — backed up to the cloud.
 * `deleting`— removed locally, delete still in flight to the cloud.
 */
export type BoardSyncState = 'pending' | 'queued' | 'synced' | 'deleting'

const MAX_ATTEMPTS = 5
const BASE_DELAY = 1000
const RECONCILE_INTERVAL = 120_000

/**
 * Distinguishes "this board id is already owned by another account" from a
 * transient failure. Both the unique-violation and the RLS refusal arrive as
 * errors on the same upsert, and both mean the id is unusable as-is.
 */
function isIdCollision(error: { code?: string; message?: string }): boolean {
  const text = `${error.code ?? ''} ${error.message ?? ''}`.toLowerCase()
  return (
    text.includes('row-level security') ||
    text.includes('42501') ||
    text.includes('duplicate key') ||
    text.includes('23505')
  )
}

/**
 * Sync Engine — reconciles local board files with the cloud.
 *
 * Local writes are always immediate and never block on the network. Cloud work
 * happens on a dirty queue plus a periodic reconcile, so going offline only
 * costs a deferral, never a lost edit.
 */
class SyncEngine {
  private timer: ReturnType<typeof setInterval> | null = null
  private running = false
  private queued = false
  private attempts = 0
  private dirty = new Set<string>()

  /** Called by the app after every successful local save. */
  markDirty(boardId: string) {
    this.dirty.add(boardId)
    if (this.isLive()) void this.sync()
  }

  isLive(): boolean {
    const { user, isOnline } = useAuthStore.getState()
    return !!user && isOnline
  }

  startAutoSync() {
    this.stopAutoSync()
    this.timer = setInterval(() => void this.sync(), RECONCILE_INTERVAL)
  }

  stopAutoSync() {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
  }

  /** Consecutive failed attempts in the current sync pass; 0 when healthy. */
  retryCount() {
    return this.attempts
  }

  /** Coalesces overlapping calls so a burst of edits triggers one sync pass. */
  async sync() {
    if (this.queued) return
    if (!isSupabaseConfigured) return
    if (!this.isLive()) {
      useAuthStore.getState().setSyncStatus('offline')
      return
    }

    this.queued = true
    try {
      // Coalesce: let a burst of markDirty calls land before doing network work.
      await new Promise((r) => setTimeout(r, 400))
      await this.runWithRetry()
    } finally {
      this.queued = false
    }
  }

  private async runWithRetry(): Promise<void> {
    const store = useAuthStore.getState()
    if (this.running) return
    this.running = true
    store.setSyncStatus('syncing')

    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        try {
          await this.reconcile()
          this.attempts = 0
          store.setSyncStatus('synced')
          return
        } catch (err) {
          this.attempts = attempt + 1
          const last = attempt === MAX_ATTEMPTS - 1
          if (last) {
            console.error('Sync failed after retries:', err)
            store.setSyncStatus('error')
            return
          }
          // Exponential backoff: 1s, 2s, 4s, 8s.
          const delay = BASE_DELAY * 2 ** attempt
          await new Promise((r) => setTimeout(r, delay))
          if (!this.isLive()) {
            store.setSyncStatus('offline')
            return
          }
        }
      }
    } finally {
      this.running = false
    }
  }

  /**
   * Where a single board stands with the cloud.
   *
   * `pending` is the interesting one: the board exists on this device but has
   * never been uploaded, which is exactly the case a user cannot otherwise see.
   * Connectivity problems are reported globally by `syncStatus`, so they are not
   * repeated per board here.
   */
  boardState(boardId: string): BoardSyncState {
    if (this.dirty.has(boardId)) return 'queued'
    if (readTombstones().some((t) => t.id === boardId)) return 'deleting'
    if (readWatermark(boardId) === 0) return 'pending'
    return 'synced'
  }

  /** Push one board right now instead of waiting for the next pass. */
  async syncBoardNow(boardId: string) {
    if (!this.isLive()) return false
    this.dirty.add(boardId)
    await this.sync()
    return this.boardState(boardId) === 'synced'
  }

  /**
   * Record a board deletion. Call this *after* the local file is gone, so a
   * failed local delete cannot leave a tombstone for a board still on disk.
   *
   * The queue is persisted, so a delete made offline survives an app restart and
   * reaches the cloud on the next authenticated pass.
   */
  markDeleted(boardId: string) {
    const pending = readTombstones()
    if (!pending.some((t) => t.id === boardId)) {
      pending.push({ id: boardId, at: Date.now() })
      writeTombstones(pending)
    }
    // A deleted board must never be pushed back up by a later edit.
    this.dirty.delete(boardId)
    if (this.isLive()) void this.sync()
  }

  /**
   * Push every pending deletion. Failures keep their tombstone for the next
   * attempt rather than silently dropping the delete.
   */
  private async flushDeletions() {
    const pending = readTombstones()
    if (pending.length === 0) return

    const { user } = useAuthStore.getState()
    if (!user) return

    const failed: Tombstone[] = []
    for (const t of pending) {
      try {
        const { error } = await supabase!
          .from('boards')
          .delete()
          .eq('id', t.id)
          .eq('owner_id', user.id)
        if (error) throw error

        // Board row gone. Its board_members / shared_links / file_references
        // rows go with it through ON DELETE CASCADE, so nothing else to do.
        // Forget the board's watermark so a future board reusing the id is
        // treated as never-synced rather than assumed current.
        try {
          const all = readState()
          delete all[t.id]
          localStorage.setItem(STATE_KEY, JSON.stringify(all))
        } catch {
          /* ignore */
        }
      } catch (err) {
        failed.push(t)
        console.error(`Could not delete board ${t.id} from the cloud:`, err)
      }
    }

    writeTombstones(failed)
  }

  /** Push local edits, then pull anything newer from the cloud. */
  private async reconcile() {
    const { user } = useAuthStore.getState()
    if (!user) throw new Error('Not authenticated')

    // Deletions run first so a board removed offline is gone from the cloud
    // before the pull step could otherwise re-adopt it.
    await this.flushDeletions()
    const tombstoned = new Set(readTombstones().map((t) => t.id))

    const locals = await listBoards()
    const localIds = new Set(locals.map((b) => b.id))

    // 1. Push. The dirty set is the fast path for boards edited in this session,
    //    but on its own it strands anything created while the user was offline
    //    or signed out — that board is never in `dirty`, so it would sit in the
    //    cloud queue forever. The watermark scan is the safety net: a board with
    //    no recorded sync has provably never been pushed.
    const pending = new Set(this.dirty)
    this.dirty.clear()
    for (const board of locals) {
      if (tombstoned.has(board.id)) continue
      if (!pending.has(board.id) && readWatermark(board.id) === 0) {
        pending.add(board.id)
      }
    }
    for (const id of pending) await this.pushBoard(id)

    // 2. Pull. Remote rows the user owns that this device has never seen are
    //    adopted, and rows that also exist locally are reconciled.
    const remote = await this.fetchOwnedBoards()
    for (const row of remote) {
      if (tombstoned.has(row.id)) continue
      if (localIds.has(row.id)) {
        const local = await loadBoard(row.id)
        if (local) await this.reconcileOne(row, local)
      } else {
        await this.pullBoard(row)
      }
    }
  }

  /**
   * Resolve one board where both sides changed.
   *
   * Local wins (the user is actively editing on this device) but the cloud copy
   * is preserved as a sibling board, so a concurrent edit from another device is
   * never destroyed.
   */
  private async reconcileOne(remote: CloudBoardRow, local: BoardEntry) {
    const localAt = local.updatedAt ?? 0
    const remoteAt = new Date(remote.updated_at).getTime()
    const watermark = readWatermark(local.id)

    if (remoteAt <= watermark) return // already reconciled this version

    if (localAt > watermark) {
      // Both changed since our last sync. Back up the remote copy, keep local.
      await this.saveRemoteAsBackup(remote)
      useUIStore.getState().setToast('Sync conflict resolved — cloud copy saved as a new board')
      return
    }

    if (remoteAt > localAt) await this.pullBoard(remote)
    else await this.pushBoard(local.id)
  }

  private async saveRemoteAsBackup(remote: CloudBoardRow) {
    const stamp = new Date(remote.updated_at).toLocaleString()
    // Must be a real UUID: the cloud column is `uuid`, so a suffixed string id
    // could never be pushed and would fail every future migration attempt.
    const backupId = crypto.randomUUID()
    await saveBoard(
      backupId,
      `${remote.name} (cloud copy ${stamp})`,
      remote.data?.objects ?? {},
      remote.data?.objectIds ?? [],
      {
        pages: remote.data?.pages,
        activePageId: remote.data?.activePageId,
        pageSnapshots: remote.data?.pageSnapshots,
      },
    )
    // A backup is a local artifact, not something to push back up.
    writeWatermark(backupId, Date.now())
  }

  private async pullBoard(remote: CloudBoardRow) {
    await saveBoard(
      remote.id,
      remote.name,
      remote.data?.objects ?? {},
      remote.data?.objectIds ?? [],
      {
        pages: remote.data?.pages,
        activePageId: remote.data?.activePageId,
        pageSnapshots: remote.data?.pageSnapshots,
      },
    )
    writeWatermark(remote.id, new Date(remote.updated_at).getTime())
  }

  private async pushBoard(boardId: string): Promise<void> {
    const local = await loadBoard(boardId)
    if (!local) return

    const { user } = useAuthStore.getState()
    if (!user) throw new Error('Not authenticated')

    const at = local.updatedAt ?? Date.now()
    const { error } = await supabase!
      .from('boards')
      .upsert({
        id: local.id,
        owner_id: user.id,
        name: local.name,
        created_at: new Date(local.createdAt).toISOString(),
        updated_at: new Date(at).toISOString(),
        data: local.data,
        is_synced: true,
        last_synced_at: new Date().toISOString(),
      })

    if (error) {
      // The seeded board id (DEFAULT_BOARD_ID) is the same constant on every
      // install, so two accounts can collide on the global primary key. RLS
      // correctly refuses the second one, which would otherwise leave that
      // user's board stuck failing to sync forever. Re-key and retry.
      if (isIdCollision(error)) {
        const rekeyed = await this.rekeyLocalBoard(local.id)
        if (rekeyed) return this.pushBoard(rekeyed)
      }
      throw error
    }

    writeWatermark(local.id, at)
  }

  /**
   * Move a board to a fresh id, preserving all content and its creation date.
   * The old row was never written by us, so nothing is deleted from the cloud.
   */
  private async rekeyLocalBoard(oldId: string): Promise<string | null> {
    const local = await loadBoard(oldId)
    if (!local) return null

    const newId = crypto.randomUUID()
    await saveBoard(newId, local.name, local.data.objects, local.data.objectIds, {
      pages: local.data.pages,
      activePageId: local.data.activePageId,
      pageSnapshots: local.data.pageSnapshots,
      createdAt: local.createdAt,
    })
    await deleteBoard(oldId)

    // Keep the editor pointed at the board the user was just working in.
    const ui = useUIStore.getState()
    if (ui.activeBoardId === oldId) ui.setActiveBoard(newId, local.name)

    console.info(
      `Board "${local.name}" was given a new id (${oldId} is already used by another account).`,
    )
    return newId
  }

  async fetchOwnedBoards(): Promise<CloudBoardRow[]> {
    const { user } = useAuthStore.getState()
    if (!user) return []
    const { data, error } = await supabase!
      .from('boards')
      .select('id, owner_id, name, data, updated_at')
      .eq('owner_id', user.id)
      .order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []) as CloudBoardRow[]
  }

  /**
   * Phase 6 migration: upload pre-existing local boards the first time an
   * account signs in. Never deletes or mutates the local copies, and skips ids
   * that already exist in the cloud.
   */
  async migrateLocalBoards(): Promise<{ uploaded: string[]; skipped: number; failed: number }> {
    const { user } = useAuthStore.getState()
    if (!user) return { uploaded: [], skipped: 0, failed: 0 }

    const remote = await this.fetchOwnedBoards()
    const remoteIds = new Set(remote.map((b) => b.id))
    const locals = await listBoards()

    const uploaded: string[] = []
    let failed = 0
    // A board queued for deletion must not be resurrected by a migration.
    const tombstoned = new Set(readTombstones().map((t) => t.id))

    for (const board of locals) {
      if (remoteIds.has(board.id) || tombstoned.has(board.id)) {
        continue
      }
      try {
        await this.pushBoard(board.id)
        uploaded.push(board.name)
      } catch (err) {
        failed++
        console.error(`Migration failed for board ${board.id}:`, err)
      }
    }

    return { uploaded, skipped: locals.length - uploaded.length - failed, failed }
  }
}

export const syncEngine = new SyncEngine()
