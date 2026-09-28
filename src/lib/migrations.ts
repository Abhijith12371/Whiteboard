import { initDB, listBoards, saveBoard } from '../services/db'

interface BoardRecord {
  id: string
  name: string
  data: any
}

/**
 * One-time data migration: mark every theme-dependent mark as `auto` or `custom`.
 *
 * Before this existed the app baked a concrete hex into each stroke, and the
 * theme toggle rewrote stored colours to compensate. Now the colour is decided
 * at render time, so every pre-existing mark needs an explicit mode.
 *
 * The rule the old app could never distinguish, and which this recovers:
 *   - a colour equal to one of the hardcoded theme-ink values (#09090b, #fafafa,
 *     #000000, #ffffff) could only have come from the default pen, from a preset
 *     shape outline, or from the theme guard, never from a deliberate pick -> `auto`
 *   - anything else was explicitly chosen by the user -> `custom`, hex preserved
 */

const MIGRATION_KEY = 'digiboard_stroke_colormode'
const MIGRATION_VERSION = '2'

/** Colours the old build would write on its own. */
const IMPLICIT_INK = new Set(['#09090b', '#fafafa', '#000000', '#ffffff'])

const STROKE_TYPES = new Set(['path', 'line', 'arrow'])
const FILL_TYPES = new Set(['text'])
/**
 * Preset shapes outline themselves in default ink, so a shape stroke sitting on
 * one of the implicit inks is default ink too and has to follow the theme —
 * otherwise a shape inserted in light mode is invisible once the board is dark.
 * A shape with any other stroke is template/table content and is left alone.
 */
const SHAPE_STROKE_TYPES = new Set(['rectangle', 'ellipse', 'circle', 'triangle', 'polygon'])
const NORMALISE = (v: unknown) => String(v ?? '').trim().toLowerCase()

/** The field on this object that holds theme ink, if any. */
function inkKey(type: unknown): 'stroke' | 'fill' | null {
  if (STROKE_TYPES.has(type as string) || SHAPE_STROKE_TYPES.has(type as string)) return 'stroke'
  if (FILL_TYPES.has(type as string)) return 'fill'
  return null
}

function classify(obj: any): 'auto' | 'custom' | null {
  if (obj.colorMode === 'auto' || obj.colorMode === 'custom') return null
  const key = inkKey(obj.type)
  if (!key) return null
  // Eraser strokes paint with destination-out; their colour is meaningless.
  if (obj.tool === 'eraser') return null

  const value = obj[key]
  if (typeof value !== 'string' || value.length === 0) return 'auto'
  if (NORMALISE(value) === 'transparent') return 'auto'
  return IMPLICIT_INK.has(NORMALISE(value)) ? 'auto' : 'custom'
}

function migrateObjects(objects: Record<string, any>): { objects: Record<string, any>; changed: number } {
  const out: Record<string, any> = {}
  let changed = 0
  for (const id in objects) {
    const obj = objects[id]
    const mode = classify(obj)
    if (mode) {
      const next: any = { ...obj, colorMode: mode }
      // Auto marks carry no colour; drop the stale literal so nothing can
      // resurrect it. Render-time resolution supplies the actual ink.
      if (mode === 'auto') {
        const key = inkKey(obj.type)
        if (key) next[key] = ''
      }
      out[id] = next
      changed++
    } else {
      out[id] = obj
    }
  }
  return { objects: out, changed }
}

function migrateData(data: any): { data: any; changed: number } {
  if (!data) return { data, changed: 0 }
  let changed = 0

  let objects = data.objects
  let objectIds = data.objectIds
  if (objects) {
    const result = migrateObjects(objects)
    objects = result.objects
    changed += result.changed
  }

  let pageSnapshots = data.pageSnapshots
  if (pageSnapshots) {
    const next: Record<string, any> = {}
    for (const pageId in pageSnapshots) {
      const snap = pageSnapshots[pageId]
      const result = migrateObjects(snap.objects || {})
      next[pageId] = { ...snap, objects: result.objects }
      changed += result.changed
    }
    pageSnapshots = next
  }

  return { data: { ...data, objects, objectIds, pageSnapshots }, changed }
}

/** True when the migration still needs to run. */
export function needsStrokeColorModeMigration(): boolean {
  try {
    return localStorage.getItem(MIGRATION_KEY) !== MIGRATION_VERSION
  } catch {
    return false
  }
}

/**
 * Runs once per install. Safe to call on every boot: it is a no-op once the
 * version stamp matches. Returns how many marks were reclassified.
 */
export async function runStrokeColorModeMigration(): Promise<number> {
  if (!needsStrokeColorModeMigration()) return 0

  let total = 0
  try {
    await initDB()
    const boards = (await listBoards()) as unknown as BoardRecord[]
    for (const board of boards) {
      const result = migrateData(board.data)
      if (result.changed === 0) continue
      total += result.changed
      await saveBoard(
        board.id,
        board.name,
        result.data.objects ?? {},
        result.data.objectIds ?? [],
        {
          pages: result.data.pages,
          activePageId: result.data.activePageId,
          pageSnapshots: result.data.pageSnapshots,
        }
      )
    }
  } catch (err) {
    // Leave the stamp unset so the migration is retried next launch.
    console.error('Stroke colorMode migration failed:', err)
    return 0
  }

  try { localStorage.setItem(MIGRATION_KEY, MIGRATION_VERSION) } catch { /* ignore */ }
  return total
}
