import { initDB, listBoards, saveBoard, deleteBoard, DEFAULT_BOARD_ID, LEGACY_BOARD_ID } from './db'
import { runStrokeColorModeMigration } from '../lib/migrations'

export type InitStage =
  | 'INITIALIZING'
  | 'RESTORING_LOCAL'
  | 'LOADING_WORKSPACE'
  | 'READY'
  | 'ERROR'

export const STAGE_LABELS: Record<InitStage, string> = {
  INITIALIZING: 'Starting DigiBoard...',
  RESTORING_LOCAL: 'Restoring your workspace...',
  LOADING_WORKSPACE: 'Loading boards...',
  READY: 'Opening DigiBoard...',
  ERROR: 'Starting in offline mode...',
}

export async function runInitEngine(onStage: (stage: InitStage) => void) {
  try {
    onStage('INITIALIZING')

    // 1. Init DB
    onStage('RESTORING_LOCAL')
    await initDB()

    // UUID migration
    let boards = await listBoards()
    const oldBoard = boards.find(b => b.id === LEGACY_BOARD_ID)
    if (oldBoard) {
      await saveBoard(DEFAULT_BOARD_ID, oldBoard.name, oldBoard.data.objects, oldBoard.data.objectIds)
      await deleteBoard(LEGACY_BOARD_ID)
      boards = await listBoards()
    }

    if (boards.length === 0) {
      await saveBoard(DEFAULT_BOARD_ID, 'Untitled Board', {}, [])
    }

    // Reclassify legacy strokes as auto/custom before any board is rendered,
    // so nothing paints with a stale baked-in colour.
    await runStrokeColorModeMigration()

    onStage('LOADING_WORKSPACE')
    onStage('READY')
  } catch (err) {
    console.error('Init Engine Error:', err)
    onStage('ERROR')
  }
}
