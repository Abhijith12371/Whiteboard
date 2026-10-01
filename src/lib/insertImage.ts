import { useBoardStore } from '../store/boardStore'
import { useUIStore } from '../store/uiStore'
import { useAuthStore } from '../store/authStore'
import { uploadBoardFile } from './fileStorage'
import type { ImageObject } from '../types'

/** Longest edge a dropped image is scaled to on insert. */
const MAX_EDGE = 480

/**
 * SVG is kept inline as a data URL rather than uploaded. It is markup, not a
 * bitmap: small as text, and serving user-authored SVG from storage is a stored
 * XSS vector that a raster-only bucket removes entirely.
 */
function shouldUpload(file: File): boolean {
  return file.type.startsWith('image/') && file.type !== 'image/svg+xml'
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function measure(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth || 1, height: img.naturalHeight || 1 })
    img.onerror = () => resolve({ width: MAX_EDGE, height: MAX_EDGE })
    img.src = src
  })
}

export interface InsertImageOptions {
  /** Top-left position, or the point to centre on when `anchor` is 'center'. */
  at: { x: number; y: number }
  /** Dropped images sit at the cursor; toolbar inserts sit centred on screen. */
  anchor?: 'top-left' | 'center'
  boardId?: string
}

/**
 * Insert an image file onto the canvas.
 *
 * The object is always created from a data URL, so the insert is instant and
 * works with no account and no network. When the user is signed in and the file
 * is a raster, the bytes are then uploaded to R2 and the object's `src` is
 * swapped for the stored URL, which keeps large binaries out of the Postgres
 * row. If that upload fails the data URL simply stays, so the image is never
 * lost and the failure is not the user's problem to solve.
 *
 * Returns the new object's id so the caller can select it.
 */
export async function insertImageFile(
  file: File,
  { at, anchor = 'top-left', boardId }: InsertImageOptions,
): Promise<string> {
  const dataUrl = await readAsDataUrl(file)
  const { width: naturalW, height: naturalH } = await measure(dataUrl)
  const scale = Math.min(1, MAX_EDGE / Math.max(naturalW, naturalH))
  const width = naturalW * scale
  const height = naturalH * scale

  const id = crypto.randomUUID()
  const origin =
    anchor === 'center'
      ? { x: at.x - width / 2, y: at.y - height / 2 }
      : { x: at.x, y: at.y }

  useBoardStore.getState().addObject({
    id,
    type: 'image',
    x: origin.x,
    y: origin.y,
    width,
    height,
    src: dataUrl,
    rotation: 0,
    opacity: 1,
    locked: false,
    zIndex: 0,
    assetKind: 'image',
  } as ImageObject)

  const { user, isOnline } = useAuthStore.getState()
  if (!user || !isOnline || !shouldUpload(file)) return id

  try {
    const stored = await uploadBoardFile(boardId ?? useUIStore.getState().activeBoardId, file)
    // The object may have been moved or deleted while the upload was in flight.
    const current = useBoardStore.getState().objects[id]
    if (!current) {
      console.warn(`Image ${id} was removed while uploading; leaving its stored file to be pruned.`)
      return id
    }
    useBoardStore.getState().updateObject(id, {
      src: stored.url,
      assetRef: { key: stored.key, fileId: stored.fileId },
    })
  } catch (err) {
    // The local copy stands in. The board syncs with the data URL and a later
    // upload can be retried; nothing is lost either way.
    console.warn('Cloud image upload failed; keeping the local copy:', err)
  }

  return id
}
