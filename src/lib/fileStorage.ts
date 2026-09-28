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

  const { error } = await supabase!.from('file_references').insert(record)
  if (error) {
    // The object is already in R2; only the metadata write failed. Surface it
    // rather than silently leaving an orphan object with no owning row.
    console.error('File uploaded but metadata insert failed:', error)
    throw new Error('File uploaded, but could not be recorded on the board')
  }

  return {
    key: signed.objectKey,
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
