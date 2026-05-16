'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { Loader2, X, Upload, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'

import { useUploadStore } from '@/store/upload.store'
import { uploadService } from '@/services/upload.service'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import type { BulkQueueItem } from '@/store/upload.store'

const ACTIVE_STATUSES = ['PENDING', 'PROCESSING', 'TRANSCODING', 'GENERATING_THUMBNAILS', 'QUEUED']
const TRANSCODING_STATUSES = ['PROCESSING', 'TRANSCODING', 'GENERATING_THUMBNAILS']

export function UploadIndicator() {
  const router = useRouter()
  const { uploads, bulkQueue, setBulkQueue } = useUploadStore()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const activeUploads = uploads.filter((u) => ACTIVE_STATUSES.includes(u.status))
  const activeBulk    = bulkQueue.filter((i) => ACTIVE_STATUSES.includes(i.status as string))
  const totalActive   = activeUploads.length + activeBulk.length

  const completedUploads = uploads.filter((u) => u.status === 'COMPLETED').length
  const completedBulk    = bulkQueue.filter((i) => i.status === 'COMPLETED').length
  const failedUploads    = uploads.filter((u) => u.status === 'FAILED').length
  const failedBulk       = bulkQueue.filter((i) => i.status === 'FAILED').length
  const totalFailed      = failedUploads + failedBulk

  const allItems = [...activeUploads, ...activeBulk]
  const avgProgress = allItems.length > 0
    ? Math.round(allItems.reduce((sum, i) => sum + (i.progress ?? 0), 0) / allItems.length)
    : 0

  // Persistent background polling for transcoding bulk items
  useEffect(() => {
    const transcoding = bulkQueue.filter(
      (i) => i.uploadSessionId && TRANSCODING_STATUSES.includes(i.status as string),
    )
    if (transcoding.length === 0) return

    const timer = setTimeout(async () => {
      const updates: Record<string, Partial<BulkQueueItem>> = {}

      await Promise.all(
        transcoding.map(async (item) => {
          try {
            const result = await uploadService.getUploadStatus(item.uploadSessionId!)
            if (result.status === 'COMPLETED') {
              updates[item.id] = { status: 'COMPLETED', progress: 100 }
              toast.success(`Episodio listo: ${item.file.name}`)
            } else if (result.status === 'FAILED') {
              updates[item.id] = { status: 'FAILED', error: result.errorMessage ?? 'Error en procesamiento' }
            } else {
              updates[item.id] = {
                status: result.status as BulkQueueItem['status'],
                ...(typeof result.progress === 'number' ? { progress: result.progress } : {}),
              }
            }
          } catch {
            // transient polling error — retry next cycle
          }
        }),
      )

      if (Object.keys(updates).length > 0) {
        setBulkQueue((prev) => prev.map((i) => (updates[i.id] ? { ...i, ...updates[i.id] } : i)))
      }
    }, 8000)

    return () => clearTimeout(timer)
  }, [bulkQueue, setBulkQueue])

  // Only show when there's something active, completed, or failed in the queue
  const hasAnything = totalActive > 0 || completedUploads > 0 || completedBulk > 0 || totalFailed > 0
  if (!mounted || !hasAnything) return null

  const panel = (
    <div className="fixed bottom-4 right-4 z-[9999] w-72 rounded-xl border bg-background shadow-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          {totalActive > 0
            ? <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            : totalFailed > 0
            ? <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />}
          <span className="text-sm font-semibold leading-none">
            {totalActive > 0
              ? `${totalActive} ${totalActive === 1 ? 'archivo' : 'archivos'} en proceso`
              : totalFailed > 0
              ? `${totalFailed} con error`
              : 'Cargas completadas'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={() => {
            const done = ['COMPLETED', 'FAILED', 'CANCELLED']
            useUploadStore.getState().setUploads((p) => p.filter((u) => !done.includes(u.status)))
            setBulkQueue((p) => p.filter((i) => !done.includes(i.status as string)))
          }}
          title="Descartar"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Stats row */}
      <div className="px-4 py-2 flex gap-4 text-xs text-muted-foreground">
        {(completedUploads + completedBulk) > 0 && (
          <span className="text-emerald-500">{completedUploads + completedBulk} completados</span>
        )}
        {totalFailed > 0 && (
          <span className="text-destructive">{totalFailed} con error</span>
        )}
        {totalActive > 0 && (
          <span className="text-primary">{totalActive} en proceso</span>
        )}
      </div>

      {/* Progress bar (only when actively uploading) */}
      {totalActive > 0 && (
        <div className="px-4 pb-3 space-y-1.5">
          <Progress value={avgProgress} className="h-1.5" />
          <p className="text-xs text-muted-foreground">{avgProgress}% promedio</p>
        </div>
      )}

      {/* Go to upload page */}
      <button
        type="button"
        onClick={() => router.push('/dashboard/content/upload')}
        className="w-full flex items-center gap-2 px-4 py-2.5 border-t text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
      >
        <Upload className="h-3.5 w-3.5" />
        Ver detalles de carga
      </button>
    </div>
  )

  return createPortal(panel, document.body)
}
