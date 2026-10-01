import { supabase, isSupabaseConfigured } from './supabase'
import { useAuthStore } from '../store/authStore'

/**
 * Cloud file/image storage on Cloudflare R2.
 *
 * The client never holds R2 credentials. It asks a Supabase Edge Function for a
 * short-lived presigned URL and PUTs the bytes straight to R2, so large payloads
 * bypass the app server and Supabase row limits. Only file metadata is written
 * to Postgres.
 */

const MAX_BYTES = 25 * 1024 * 1024

export interface StoredFile {
  key: string
  fileId: string
  url: string
  name: string
  contentType: string
  size: number
}

interface UploadUrlResponse {
  uploadUrl: string
  objectKey: string
  publicUrl: string
  expiresIn: number
}

async function requestUploadUrl(params: {
  boardId: string
  fileName: string
  contentType: string
  size: number
}): Promise<UploadUrlResponse> {
  if (!isSupabaseConfigured) throw new Error('Cloud storage needs a configured Supabase project')

  const { data, error } = await supabase!.functions.invoke('r2-upload-url', {
    body: params,
  })

  if (error) throw new Error(error.message || 'Could not authorise the upload')
  if (!data?.uploadUrl) throw new Error('Could not authorise the upload')
  return data as UploadUrlResponse
}

/**
 * Upload one file and register its metadata. Offline this throws, and callers
 * are expected to keep the local copy — R2 is a backup/sync target, not a
 * prerequisite for editing.
 */
export async function uploadBoardFile(
  boardId: string,
  file: File,
): Promise<StoredFile> {
  const { user } = useAuthStore.getState()
  if (!user) throw new Error('Sign in to upload to the cloud')
  if (file.size > MAX_BYTES) {
    throw new Error(`File is larger than ${Math.round(MAX_BYTES / 1024 / 1024)} MB`)
  }

  const signed = await requestUploadUrl({
    boardId,
    fileName: file.name,
    contentType: file.type || 'application/octet-stream',
    size: file.size,
  })

  const put = await fetch(signed.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    body: file,
  })

  if (!put.ok) {
    throw new Error(`Upload failed (${put.status}). Check your connection and retry.`)
  }

  const record = {
    board_id: boardId,
    owner_id: user.id,
    file_key: signed.objectKey,
    file_name: file.name,
    file_type: file.type || 'application/octet-stream',
    file_size: file.size,
    file_url: signed.publicUrl,
  }

  const { data, error } = await supabase!
    .from('file_references')
    .insert(record)
    .select('id')
    .single()

  if (error) {
    // The object is already in R2; only the metadata write failed. Surface it
    // rather than silently leaving an orphan object with no owning row.
    console.error('File uploaded but metadata insert failed:', error)
    throw new Error('File uploaded, but could not be recorded on the board')
  }

  return {
    key: signed.objectKey,
    fileId: data.id as string,
    url: signed.publicUrl,
    name: file.name,
    contentType: file.type,
    size: file.size,
  }
}

/** Drop the metadata row. The R2 object is removed by the server-side cleanup job. */
export async function deleteBoardFile(fileId: string) {
  const { error } = await supabase!.from('file_references').delete().eq('id', fileId)
  if (error) throw new Error(error.message)
}

export async function listBoardFiles(boardId: string) {
  const { data, error } = await supabase!
    .from('file_references')
    .select('*')
    .eq('board_id', boardId)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

async function requestDeleteUrl(fileKey: string): Promise<string | null> {
  const { data, error } = await supabase!.functions.invoke('r2-delete', {
    body: { fileKey },
  })
  if (error) return null
  return (data as { deleteUrl?: string } | null)?.deleteUrl ?? null
}

/**
 * Remove stored files that no longer belong to the board.
 *
 * `liveKeys` is the set of R2 keys still referenced by the board's objects. A
 * metadata row outside that set is an orphan: the object was deleted, undone, or
 * grouped away. Reconciling here rather than at each delete call site means every
 * deletion path is covered — including undo, group deletes and imports — without
 * any of them needing to know about storage.
 */
export async function pruneOrphanedFiles(
  boardId: string,
  liveKeys: Set<string>,
): Promise<number> {
  const rows = await listBoardFiles(boardId)
  const orphans = rows.filter((r) => !liveKeys.has(r.file_key))
  if (orphans.length === 0) return 0

  let removed = 0
  for (const row of orphans) {
    try {
      const url = await requestDeleteUrl(row.file_key)
      // Without a presigned URL the row is still removed: an orphaned R2 object
      // costs storage, whereas an orphaned row would keep reappearing here.
      if (url) {
        const res = await fetch(url, { method: 'DELETE' })
        if (!res.ok && res.status !== 404) {
          console.warn(`R2 delete for ${row.file_key} returned ${res.status}`)
        }
      }
      const { error } = await supabase!
        .from('file_references')
        .delete()
        .eq('id', row.id)
      if (error) throw error
      removed++
    } catch (err) {
      console.error(`Could not prune file ${row.id}:`, err)
    }
  }

  return removed
}
