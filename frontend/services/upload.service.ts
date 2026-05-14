import api from './api'
import { UploadSession, UploadStatus } from '@/types'

const CHUNK_SIZE = 5 * 1024 * 1024 // 5MB per chunk

export interface UploadProgressCallback {
  onProgress: (progress: number) => void
  onStatusChange: (status: UploadStatus) => void
  onComplete: (uploadId: string) => void
  onError: (error: string) => void
}

export const uploadService = {
  async initUpload(file: File): Promise<UploadSession> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)

    const { data } = await api.post('/uploads/init', {
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      totalChunks,
    })

    return data.data
  },

  async uploadFileFromSession(
    file: File,
    session: UploadSession,
    callbacks: UploadProgressCallback,
    signal?: AbortSignal,
  ): Promise<string> {
    return this._uploadChunks(file, session, callbacks, signal)
  },

  async uploadFile(
    file: File,
    callbacks: UploadProgressCallback,
    signal?: AbortSignal,
  ): Promise<string> {
    const session = await this.initUpload(file)
    callbacks.onStatusChange('PENDING')
    return this._uploadChunks(file, session, callbacks, signal)
  },

  async _uploadChunks(
    file: File,
    session: UploadSession,
    callbacks: UploadProgressCallback,
    signal?: AbortSignal,
  ): Promise<string> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    callbacks.onStatusChange('PENDING')

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (signal?.aborted) {
        throw new Error('Upload cancelled')
      }

      const start = chunkIndex * CHUNK_SIZE
      const end = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      const formData = new FormData()
      formData.append('uploadId', session.uploadId)
      formData.append('chunkIndex', String(chunkIndex))
      formData.append('totalChunks', String(totalChunks))
      formData.append('chunk', chunk)

      await api.post('/uploads/chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
      })

      const progress = Math.round(((chunkIndex + 1) / totalChunks) * 100)
      callbacks.onProgress(progress)
    }

    callbacks.onStatusChange('PROCESSING')

    // Poll for processing completion
    await this.pollUploadStatus(session.uploadId, callbacks)

    return session.uploadId
  },

  // Uploads all chunks and returns after triggering assembly — does NOT wait for
  // transcoding to complete. Callers are responsible for polling status separately.
  async uploadChunksOnly(
    file: File,
    session: UploadSession,
    callbacks: Pick<UploadProgressCallback, 'onProgress' | 'onStatusChange'>,
    signal?: AbortSignal,
  ): Promise<string> {
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE)
    callbacks.onStatusChange('PENDING')

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (signal?.aborted) throw new Error('Upload cancelled')

      const start = chunkIndex * CHUNK_SIZE
      const end   = Math.min(start + CHUNK_SIZE, file.size)
      const chunk = file.slice(start, end)

      const formData = new FormData()
      formData.append('uploadId', session.uploadId)
      formData.append('chunkIndex', String(chunkIndex))
      formData.append('totalChunks', String(totalChunks))
      formData.append('chunk', chunk)

      await api.post('/uploads/chunk', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        signal,
      })

      callbacks.onProgress(Math.round(((chunkIndex + 1) / totalChunks) * 100))
    }

    // Assembly is triggered server-side when all chunks arrive.
    // Signal the caller that we're now waiting for transcoding.
    callbacks.onStatusChange('TRANSCODING')
    return session.uploadId
  },

  async pollUploadStatus(
    uploadId: string,
    callbacks: UploadProgressCallback,
    maxAttempts = 360, // 360 × 5s = 30 min max wait for large files
  ): Promise<void> {
    let attempts = 0

    return new Promise((resolve, reject) => {
      const poll = async () => {
        if (attempts >= maxAttempts) {
          reject(new Error('Upload processing timeout'))
          return
        }

        try {
          const { data } = await api.get(`/uploads/${uploadId}/status`)
          const { status, progress, errorMessage } = data.data

          callbacks.onStatusChange(status)
          if (typeof progress === 'number') callbacks.onProgress(progress)

          if (status === 'COMPLETED') {
            callbacks.onProgress(100)
            callbacks.onComplete(uploadId)
            resolve()
            return
          }

          if (status === 'FAILED') {
            callbacks.onError(errorMessage ?? 'Processing failed')
            reject(new Error(errorMessage ?? 'Processing failed'))
            return
          }

          attempts++
          // Use 5s interval — transcoding large files takes minutes to hours
          setTimeout(poll, 5000)
        } catch (err) {
          reject(err)
        }
      }

      setTimeout(poll, 5000)
    })
  },

  async getUploadStatus(uploadId: string): Promise<{ status: UploadStatus; progress?: number; errorMessage?: string }> {
    const { data } = await api.get(`/uploads/${uploadId}/status`)
    return data.data
  },

  async uploadImage(file: File): Promise<{ url: string; filename: string }> {
    const formData = new FormData()
    formData.append('image', file)

    const { data } = await api.post('/uploads/image', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })

    return data.data
  },
}
