import { create } from 'zustand'
import type { UploadStatus } from '@/types'

export interface UploadItem {
  id: string
  file: File
  progress: number
  status: UploadStatus | 'QUEUED' | 'CANCELLED'
  error?: string
  uploadId?: string
  abortController?: AbortController
}

export type BulkItemStatus = 'ready' | UploadStatus | 'QUEUED' | 'CANCELLED'

export interface BulkQueueItem {
  id: string
  file: File
  episodeMode: 'existing' | 'new'
  episodeTitle: string
  episodeNumber: number | ''
  selectedEpisodeId: string
  status: BulkItemStatus
  progress: number
  error?: string
  uploadSessionId?: string
  abortController?: AbortController
}

interface UploadStore {
  uploads: UploadItem[]
  bulkQueue: BulkQueueItem[]
  isBulkRunning: boolean

  addUploads: (items: UploadItem[]) => void
  updateUpload: (id: string, patch: Partial<UploadItem>) => void
  removeUpload: (id: string) => void
  setUploads: (fn: (prev: UploadItem[]) => UploadItem[]) => void

  addBulkItems: (items: BulkQueueItem[]) => void
  updateBulkItem: (id: string, patch: Partial<BulkQueueItem>) => void
  removeBulkItem: (id: string) => void
  setBulkQueue: (fn: (prev: BulkQueueItem[]) => BulkQueueItem[]) => void
  setIsBulkRunning: (v: boolean) => void
}

export const useUploadStore = create<UploadStore>((set) => ({
  uploads: [],
  bulkQueue: [],
  isBulkRunning: false,

  addUploads: (items) => set((s) => ({ uploads: [...s.uploads, ...items] })),
  updateUpload: (id, patch) =>
    set((s) => ({ uploads: s.uploads.map((u) => (u.id === id ? { ...u, ...patch } : u)) })),
  removeUpload: (id) => set((s) => ({ uploads: s.uploads.filter((u) => u.id !== id) })),
  setUploads: (fn) => set((s) => ({ uploads: fn(s.uploads) })),

  addBulkItems: (items) => set((s) => ({ bulkQueue: [...s.bulkQueue, ...items] })),
  updateBulkItem: (id, patch) =>
    set((s) => ({ bulkQueue: s.bulkQueue.map((i) => (i.id === id ? { ...i, ...patch } : i)) })),
  removeBulkItem: (id) => set((s) => ({ bulkQueue: s.bulkQueue.filter((i) => i.id !== id) })),
  setBulkQueue: (fn) => set((s) => ({ bulkQueue: fn(s.bulkQueue) })),
  setIsBulkRunning: (v) => set({ isBulkRunning: v }),
}))
