'use client'

import { useState, useCallback, useEffect, useRef, type ElementType } from 'react'
import { useDropzone } from 'react-dropzone'
import {
  Upload, X, CheckCircle2, AlertCircle, Loader2,
  Film, Tv, Video, Plus, List, ChevronRight,
  Layers, Play as PlayIcon, Trash2, Search,
} from 'lucide-react'
import { toast } from 'sonner'

import { uploadService } from '@/services/upload.service'
import { contentService } from '@/services/content.service'
import { toStorageUrl } from '@/services/download.service'
import type { UploadStatus, Series, Season, Episode, Movie, Program } from '@/types'

import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatBytes, formatDuration } from '@/lib/utils'

// ── Status maps ───────────────────────────────────────────────────────────────

const PICKER_STATUS_LABEL: Record<string, string> = {
  PENDING: 'Sin archivo', PROCESSING: 'Procesando',
  TRANSCODING: 'Transcodificando', GENERATING_THUMBNAILS: 'Miniaturas',
  COMPLETED: 'Listo', FAILED: 'Error',
}
const PICKER_STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'success' | 'destructive'> = {
  PENDING: 'outline', PROCESSING: 'secondary',
  TRANSCODING: 'secondary', GENERATING_THUMBNAILS: 'secondary',
  COMPLETED: 'success', FAILED: 'destructive',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function suggestTitle(filename: string): string {
  const noExt = filename.replace(/\.[^.]+$/, '')
  const cleaned = noExt
    .replace(/^[Ss]\d+[Ee]\d+[\s._-]*/, '')
    .replace(/^\d+x\d+[\s._-]*/, '')
    .replace(/^[Ee]p[\s._-]?\d+[\s._-]*/i, '')
  return (cleaned || noExt).replace(/[._-]+/g, ' ').trim()
}

function extractEpisodeNumber(filename: string): number | null {
  const noExt = filename.replace(/\.[^.]+$/, '')
  const sxex = noExt.match(/[Ss]\d+[Ee](\d+)/)
  if (sxex) return parseInt(sxex[1], 10)
  const exx = noExt.match(/[Ee]p?[\s._-]?(\d+)/i)
  if (exx) return parseInt(exx[1], 10)
  const leading = noExt.match(/^(\d+)[\s._-]/)
  if (leading) return parseInt(leading[1], 10)
  return null
}

function nextEpisodeNumber(existing: Episode[], queueLen: number, fileIndex: number): number {
  const max = existing.length > 0 ? Math.max(...existing.map((e) => e.number)) : 0
  return max + queueLen + fileIndex + 1
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadItem {
  id: string
  file: File
  progress: number
  status: UploadStatus | 'QUEUED' | 'CANCELLED'
  error?: string
  uploadId?: string
  abortController?: AbortController
}

type BulkItemStatus = 'ready' | UploadStatus | 'QUEUED' | 'CANCELLED'

interface BulkQueueItem {
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

// ── Constants ─────────────────────────────────────────────────────────────────

const BULK_CONCURRENCY = 2

const ACCEPT = {
  'video/mp4': ['.mp4'],
  'video/quicktime': ['.mov'],
  'video/x-msvideo': ['.avi'],
  'video/x-matroska': ['.mkv'],
  'video/webm': ['.webm'],
}
const MAX_SIZE = 5 * 1024 * 1024 * 1024

const STATUS_CONFIG: Record<UploadItem['status'], { label: string; color: string }> = {
  QUEUED:                { label: 'En cola',          color: 'secondary'   },
  PENDING:               { label: 'Subiendo',         color: 'info'        },
  PROCESSING:            { label: 'Procesando',       color: 'warning'     },
  TRANSCODING:           { label: 'Transcodificando', color: 'warning'     },
  GENERATING_THUMBNAILS: { label: 'Miniaturas',       color: 'warning'     },
  COMPLETED:             { label: 'Completado',       color: 'success'     },
  FAILED:                { label: 'Error',            color: 'destructive' },
  CANCELLED:             { label: 'Cancelado',        color: 'secondary'   },
}

const BULK_STATUS_LABEL: Partial<Record<BulkItemStatus, string>> = {
  ready:                 'Listo',
  QUEUED:                'En cola',
  PENDING:               'Subiendo',
  PROCESSING:            'Procesando',
  TRANSCODING:           'Transcodificando',
  GENERATING_THUMBNAILS: 'Miniaturas',
  COMPLETED:             'Completado',
  FAILED:                'Error',
  CANCELLED:             'Cancelado',
}

const ACTIVE_STATUSES = ['PENDING', 'PROCESSING', 'TRANSCODING', 'GENERATING_THUMBNAILS']

// ── ContentPickerCard ─────────────────────────────────────────────────────────

interface ContentPickerCardProps {
  id: string
  title: string
  subtitle?: string
  thumbnailUrl?: string | null
  uploadStatus: string
  icon: ElementType<{ className?: string }>
  selected: boolean
  onSelect: (id: string) => void
}

function ContentPickerCard({
  id, title, subtitle, thumbnailUrl, uploadStatus, icon: Icon, selected, onSelect,
}: ContentPickerCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(selected ? '' : id)}
      className={`flex items-center gap-3 w-full rounded-xl border px-4 py-3 text-left transition-colors
        ${selected
          ? 'border-primary ring-1 ring-primary bg-primary/5'
          : 'border-border hover:bg-muted/20'}`}
    >
      <div className="h-11 w-20 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={toStorageUrl(thumbnailUrl)} alt={title} className="h-full w-full object-cover" />
        ) : (
          <Icon className="h-5 w-5 text-muted-foreground/40" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{subtitle}</p>}
        <div className="mt-1">
          <Badge variant={PICKER_STATUS_VARIANT[uploadStatus] ?? 'outline'} className="text-xs h-4 px-1.5">
            {PICKER_STATUS_LABEL[uploadStatus] ?? uploadStatus}
          </Badge>
        </div>
      </div>
      {selected && <CheckCircle2 className="shrink-0 h-5 w-5 text-primary" />}
    </button>
  )
}

// ── Step ──────────────────────────────────────────────────────────────────────

function Step({ n, label, done, active }: { n: number; label: string; done: boolean; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors
        ${done ? 'bg-emerald-500 text-white' : active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
        {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : n}
      </div>
      <span className={`text-sm ${active ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>{label}</span>
    </div>
  )
}

// ── SingleQueueCard ───────────────────────────────────────────────────────────

function SingleQueueCard({
  uploads, onCancel, onRemove, onRetry,
}: {
  uploads: UploadItem[]
  onCancel: (item: UploadItem) => void
  onRemove: (id: string) => void
  onRetry: (item: UploadItem) => void
}) {
  const active    = uploads.filter((u) => ACTIVE_STATUSES.includes(u.status))
  const completed = uploads.filter((u) => u.status === 'COMPLETED').length

  if (uploads.length === 0) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">Cola de subida</CardTitle>
            <CardDescription>
              {active.length > 0 ? `${active.length} en proceso` : `${completed} completados`}
            </CardDescription>
          </div>
          <Button variant="ghost" size="sm" onClick={() => uploads.filter((u) => u.status === 'COMPLETED').forEach((u) => onRemove(u.id))}>
            Limpiar completados
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {uploads.map((item) => {
          const config   = STATUS_CONFIG[item.status]
          const isActive = ACTIVE_STATUSES.includes(item.status)
          return (
            <div key={item.id} className="flex items-start gap-3 rounded-lg border p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                {item.status === 'COMPLETED' ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                  : item.status === 'FAILED' ? <AlertCircle className="h-5 w-5 text-destructive" />
                  : isActive                 ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  :                            <Film className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium truncate">{item.file.name}</p>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={config.color as never} className="text-xs">{config.label}</Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7"
                      onClick={() => isActive ? onCancel(item) : onRemove(item.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>{formatBytes(item.file.size)}</span>
                  {item.progress > 0 && item.status !== 'COMPLETED' && <span>{item.progress}%</span>}
                </div>
                {isActive && <Progress value={item.progress} className="h-1.5" />}
                {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                {item.status === 'FAILED' && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onRetry(item)}>Reintentar</Button>
                )}
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

// ── BulkQueueRow ──────────────────────────────────────────────────────────────

function BulkQueueRow({
  item, episodes, onChange, onRemove, isRunning,
}: {
  item: BulkQueueItem
  episodes: Episode[]
  onChange: (id: string, patch: Partial<BulkQueueItem>) => void
  onRemove: (id: string) => void
  isRunning: boolean
}) {
  const isActive = ACTIVE_STATUSES.includes(item.status as string)
  const isReady  = item.status === 'ready'
  const isDone   = item.status === 'COMPLETED'
  const isFailed = item.status === 'FAILED'

  return (
    <div className={`rounded-lg border p-4 transition-colors
      ${isDone ? 'bg-emerald-500/5 border-emerald-500/20' : isFailed ? 'bg-destructive/5 border-destructive/20' : ''}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
          {isDone   ? <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            : isFailed ? <AlertCircle className="h-5 w-5 text-destructive" />
            : isActive ? <Loader2 className="h-5 w-5 animate-spin text-primary" />
            :             <Film className="h-5 w-5 text-muted-foreground" />}
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.file.name}</p>
              <p className="text-xs text-muted-foreground">{formatBytes(item.file.size)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-xs font-medium
                ${isDone ? 'text-emerald-500' : isFailed ? 'text-destructive' : isActive ? 'text-primary' : 'text-muted-foreground'}`}>
                {BULK_STATUS_LABEL[item.status] ?? item.status}
              </span>
              {isReady && !isRunning && (
                <button type="button" onClick={() => onRemove(item.id)}
                  className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {isReady && (
            <div className="flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-[160px] space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {item.episodeMode === 'new' ? 'Título del episodio' : 'Episodio existente'}
                </Label>
                {item.episodeMode === 'new' ? (
                  <Input
                    value={item.episodeTitle}
                    onChange={(e) => onChange(item.id, { episodeTitle: e.target.value })}
                    placeholder="Título del episodio"
                    className="h-8 text-sm"
                    disabled={isRunning}
                  />
                ) : (
                  <Select
                    value={item.selectedEpisodeId}
                    onValueChange={(v) => onChange(item.id, { selectedEpisodeId: v })}
                    disabled={isRunning}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      {episodes.length === 0 && (
                        <SelectItem value="__empty" disabled>Sin episodios</SelectItem>
                      )}
                      {episodes.map((e) => (
                        <SelectItem key={e.id} value={e.id}>Ep. {e.number} — {e.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {item.episodeMode === 'new' && (
                <div className="w-20 space-y-1">
                  <Label className="text-xs text-muted-foreground">Ep. #</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.episodeNumber}
                    onChange={(e) => onChange(item.id, { episodeNumber: e.target.value === '' ? '' : Number(e.target.value) })}
                    className="h-8 text-sm"
                    disabled={isRunning}
                  />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Modo</Label>
                <div className="flex rounded-md border bg-muted p-0.5 gap-0.5">
                  <button type="button" disabled={isRunning}
                    onClick={() => onChange(item.id, { episodeMode: 'new', selectedEpisodeId: '' })}
                    className={`rounded px-2.5 py-1 text-xs transition-colors
                      ${item.episodeMode === 'new' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    Nuevo
                  </button>
                  <button type="button" disabled={isRunning}
                    onClick={() => onChange(item.id, { episodeMode: 'existing', episodeTitle: '', episodeNumber: '' })}
                    className={`rounded px-2.5 py-1 text-xs transition-colors
                      ${item.episodeMode === 'existing' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                    Existente
                  </button>
                </div>
              </div>
            </div>
          )}

          {isActive && <Progress value={item.progress} className="h-1.5" />}
          {isActive && item.progress > 0 && (
            <p className="text-xs text-muted-foreground">{item.progress}%</p>
          )}
          {isFailed && item.error && <p className="text-xs text-destructive">{item.error}</p>}
        </div>
      </div>
    </div>
  )
}

// ── DropZone ──────────────────────────────────────────────────────────────────

function DropZone({
  rootProps, inputProps, isDragActive, canDrop, disabledMessage, multiple,
}: {
  rootProps: ReturnType<ReturnType<typeof useDropzone>['getRootProps']>
  inputProps: ReturnType<ReturnType<typeof useDropzone>['getInputProps']>
  isDragActive: boolean
  canDrop: boolean
  disabledMessage: string
  multiple?: boolean
}) {
  return (
    <div
      {...rootProps}
      className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed
        px-8 py-12 text-center transition-all duration-200
        ${canDrop
          ? isDragActive
            ? 'border-primary bg-primary/5 scale-[1.01]'
            : 'border-muted cursor-pointer hover:border-primary/50 hover:bg-muted/30'
          : 'border-muted cursor-not-allowed opacity-60'}`}
    >
      <input {...inputProps} />
      <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-full transition-colors
        ${canDrop ? 'bg-primary/10' : 'bg-muted'}`}>
        {multiple
          ? <Layers className={`h-7 w-7 ${isDragActive ? 'text-primary' : canDrop ? 'text-primary/70' : 'text-muted-foreground'}`} />
          : <Upload className={`h-7 w-7 ${isDragActive ? 'text-primary' : canDrop ? 'text-primary/70' : 'text-muted-foreground'}`} />}
      </div>
      <h3 className="text-lg font-semibold">
        {isDragActive
          ? (multiple ? 'Suelta los archivos aquí' : 'Suelta el archivo aquí')
          : (multiple ? 'Arrastra múltiples archivos de video' : 'Arrastra el archivo de video')}
      </h3>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-sm">
        {canDrop
          ? `MP4, MOV, AVI, MKV, WebM · Hasta 5 GB${multiple ? ' por archivo' : ''}`
          : disabledMessage}
      </p>
      {canDrop && (
        <Button variant="outline" className="mt-4 gap-2" type="button">
          {multiple ? <><Plus className="h-4 w-4" /> Agregar archivos</> : 'Seleccionar archivo'}
        </Button>
      )}
      {!canDrop && (
        <div className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground/60">
          <AlertCircle className="h-3.5 w-3.5" /> {disabledMessage}
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function UploadPage() {
  const [uploadTarget, setUploadTarget] = useState<'episode' | 'movie' | 'program'>('episode')
  const [episodeUploadMode, setEpisodeUploadMode] = useState<'single' | 'bulk'>('single')

  // Shared episode location
  const [allSeries, setAllSeries]               = useState<Series[]>([])
  const [seasons, setSeasons]                   = useState<Season[]>([])
  const [episodes, setEpisodes]                 = useState<Episode[]>([])
  const [selectedSeries, setSelectedSeries]     = useState('')
  const [selectedSeason, setSelectedSeason]     = useState('')

  // Single episode mode
  const [selectedEpisode, setSelectedEpisode]   = useState('')
  const [episodeMode, setEpisodeMode]           = useState<'existing' | 'new'>('existing')
  const [newEpisodeTitle, setNewEpisodeTitle]   = useState('')
  const [newEpisodeNumber, setNewEpisodeNumber] = useState('')
  const createdEpisodeIdRef                     = useRef<string | null>(null)

  // Bulk episode mode
  const [bulkQueue, setBulkQueue]       = useState<BulkQueueItem[]>([])
  const [isBulkRunning, setIsBulkRunning] = useState(false)

  // Movie / program
  const [movies, setMovies]                   = useState<Movie[]>([])
  const [programs, setPrograms]               = useState<Program[]>([])
  const [selectedMovie, setSelectedMovie]     = useState('')
  const [selectedProgram, setSelectedProgram] = useState('')

  // Search for pickers
  const [movieSearch, setMovieSearch]     = useState('')
  const [programSearch, setProgramSearch] = useState('')

  // Shared single-mode upload queue
  const [uploads, setUploads] = useState<UploadItem[]>([])

  // ── Load catalogs ────────────────────────────────────────────────────────────
  useEffect(() => {
    contentService.getAllSeries({ limit: 200 } as never).then((r) => setAllSeries(r.data))
    contentService.getAllMovies({ limit: 200 } as never).then((r) => setMovies(r.data))
    contentService.getAllPrograms({ limit: 200 } as never).then((r) => setPrograms(r.data))
  }, [])

  useEffect(() => {
    setSelectedSeason('')
    setSelectedEpisode('')
    setSeasons([])
    setEpisodes([])
    setBulkQueue([])
    if (selectedSeries) contentService.getSeasonsBySeriesId(selectedSeries).then(setSeasons)
  }, [selectedSeries])

  useEffect(() => {
    setSelectedEpisode('')
    setEpisodes([])
    setBulkQueue([])
    if (selectedSeason) contentService.getEpisodesBySeasonId(selectedSeason).then(setEpisodes)
  }, [selectedSeason])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const filteredMovies = movieSearch
    ? movies.filter((m) => m.title.toLowerCase().includes(movieSearch.toLowerCase()))
    : movies

  const filteredPrograms = programSearch
    ? programs.filter((p) => p.title.toLowerCase().includes(programSearch.toLowerCase()))
    : programs

  const canUploadSingle =
    uploadTarget === 'episode'
      ? episodeMode === 'existing'
        ? selectedEpisode !== ''
        : selectedSeason !== '' && newEpisodeTitle.trim() !== '' && newEpisodeNumber !== ''
      : uploadTarget === 'movie'
      ? selectedMovie !== ''
      : selectedProgram !== ''

  const canDropBulk = selectedSeason !== ''

  const canStartBulk =
    bulkQueue.length > 0 &&
    !isBulkRunning &&
    bulkQueue.some((i) => i.status === 'ready') &&
    bulkQueue.every((i) => {
      if (i.status !== 'ready') return true
      return i.episodeMode === 'new'
        ? i.episodeTitle.trim() !== '' && i.episodeNumber !== ''
        : i.selectedEpisodeId !== ''
    })

  // ── Update helpers ───────────────────────────────────────────────────────────
  const updateUpload    = useCallback((id: string, patch: Partial<UploadItem>) =>
    setUploads((p) => p.map((u) => (u.id === id ? { ...u, ...patch } : u))), [])
  const updateBulkItem  = useCallback((id: string, patch: Partial<BulkQueueItem>) =>
    setBulkQueue((p) => p.map((i) => (i.id === id ? { ...i, ...patch } : i))), [])
  const removeBulkItem  = useCallback((id: string) =>
    setBulkQueue((p) => p.filter((i) => i.id !== id)), [])

  // ── Single upload ────────────────────────────────────────────────────────────
  const startUpload = useCallback(
    async (item: UploadItem) => {
      const controller = new AbortController()
      updateUpload(item.id, { status: 'PENDING', abortController: controller })

      try {
        let episodeId = selectedEpisode

        if (uploadTarget === 'episode' && episodeMode === 'new') {
          if (createdEpisodeIdRef.current) {
            episodeId = createdEpisodeIdRef.current
          } else {
            const ep = await contentService.createEpisode(selectedSeason, {
              title: newEpisodeTitle.trim(),
              number: parseInt(newEpisodeNumber, 10),
            } as never)
            episodeId = ep.id
            createdEpisodeIdRef.current = ep.id
            setEpisodes((p) => [...p, ep].sort((a, b) => a.number - b.number))
            setSelectedEpisode(ep.id)
            setEpisodeMode('existing')
            setNewEpisodeTitle('')
            setNewEpisodeNumber('')
          }
        }

        const session = await uploadService.initUpload(item.file)

        if (uploadTarget === 'episode' && episodeId) {
          await contentService.updateEpisode(episodeId, { uploadId: session.uploadId, uploadStatus: 'PENDING' } as never)
        } else if (uploadTarget === 'movie' && selectedMovie) {
          await contentService.updateMovie(selectedMovie, { uploadId: session.uploadId, uploadStatus: 'PENDING' } as never)
        } else if (uploadTarget === 'program' && selectedProgram) {
          await contentService.updateProgram(selectedProgram, { uploadId: session.uploadId, uploadStatus: 'PENDING' } as never)
        }

        await uploadService.uploadFileFromSession(item.file, session, {
          onProgress: (progress) => updateUpload(item.id, { progress }),
          onStatusChange: (status) => updateUpload(item.id, { status }),
          onComplete: (uploadId) => {
            updateUpload(item.id, { uploadId, status: 'COMPLETED', progress: 100 })
            toast.success(`${item.file.name} procesado`)
          },
          onError: (error) => updateUpload(item.id, { status: 'FAILED', error }),
        }, controller.signal)
      } catch (err) {
        if ((err as Error).message !== 'Upload cancelled') {
          updateUpload(item.id, { status: 'FAILED', error: (err as Error).message })
          toast.error(`Error al subir ${item.file.name}`)
        }
      }
    },
    [updateUpload, uploadTarget, episodeMode, selectedEpisode, selectedSeason,
      newEpisodeTitle, newEpisodeNumber, selectedMovie, selectedProgram],
  )

  // ── Bulk upload ──────────────────────────────────────────────────────────────
  const processBulkItem = useCallback(
    async (item: BulkQueueItem) => {
      const controller = new AbortController()
      updateBulkItem(item.id, { status: 'PENDING', abortController: controller })

      try {
        let episodeId = item.selectedEpisodeId

        if (item.episodeMode === 'new') {
          const ep = await contentService.createEpisode(selectedSeason, {
            title: item.episodeTitle.trim(),
            number: Number(item.episodeNumber),
          } as never)
          episodeId = ep.id
          updateBulkItem(item.id, { selectedEpisodeId: ep.id })
          setEpisodes((p) => [...p, ep].sort((a, b) => a.number - b.number))
        }

        const session = await uploadService.initUpload(item.file)

        await contentService.updateEpisode(episodeId, {
          uploadId: session.uploadId,
          uploadStatus: 'PENDING',
        } as never)

        await uploadService.uploadChunksOnly(
          item.file,
          session,
          {
            onProgress: (progress) => updateBulkItem(item.id, { progress }),
            onStatusChange: (status) => updateBulkItem(item.id, { status: status as BulkItemStatus }),
          },
          controller.signal,
        )

        updateBulkItem(item.id, { uploadSessionId: session.uploadId, status: 'TRANSCODING', progress: 100 })
      } catch (err) {
        if ((err as Error).message !== 'Upload cancelled') {
          updateBulkItem(item.id, { status: 'FAILED', error: (err as Error).message })
        }
      }
    },
    [updateBulkItem, selectedSeason],
  )

  const startBulkUpload = useCallback(async () => {
    setIsBulkRunning(true)
    const ready = bulkQueue.filter((i) => i.status === 'ready')
    for (let i = 0; i < ready.length; i += BULK_CONCURRENCY) {
      await Promise.all(ready.slice(i, i + BULK_CONCURRENCY).map(processBulkItem))
    }
    setIsBulkRunning(false)
    toast.info(`${ready.length} episodios enviados — transcodificando en segundo plano`)
  }, [bulkQueue, processBulkItem])

  // ── Background polling ───────────────────────────────────────────────────────
  useEffect(() => {
    const transcoding = bulkQueue.filter(
      (i) => i.uploadSessionId && ['PROCESSING', 'TRANSCODING', 'GENERATING_THUMBNAILS'].includes(i.status as string),
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
                status: result.status as BulkItemStatus,
                ...(typeof result.progress === 'number' ? { progress: result.progress } : {}),
              }
            }
          } catch {
            // transient polling error — retry next cycle
          }
        }),
      )

      if (Object.keys(updates).length > 0) {
        setBulkQueue((prev) =>
          prev.map((i) => (updates[i.id] ? { ...i, ...updates[i.id] } : i)),
        )
      }
    }, 8000)

    return () => clearTimeout(timer)
  }, [bulkQueue])

  // ── Dropzone handlers ────────────────────────────────────────────────────────
  const onDropSingle = useCallback((files: File[]) => {
    if (!canUploadSingle) { toast.error('Completa la configuración del destino'); return }
    createdEpisodeIdRef.current = null
    const items: UploadItem[] = files.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      file, progress: 0, status: 'QUEUED',
    }))
    setUploads((p) => [...p, ...items])
    items.reduce((chain, item) => chain.then(() => startUpload(item)), Promise.resolve())
  }, [startUpload, canUploadSingle])

  const onDropBulk = useCallback((files: File[]) => {
    if (!canDropBulk) { toast.error('Selecciona una temporada primero'); return }
    const currentQueueLen = bulkQueue.filter((i) => i.status === 'ready').length
    const items: BulkQueueItem[] = files.map((file, idx) => ({
      id: `bulk_${Date.now()}_${idx}_${Math.random().toString(36).slice(2)}`,
      file,
      episodeMode: 'new',
      episodeTitle: suggestTitle(file.name),
      episodeNumber: extractEpisodeNumber(file.name) ?? nextEpisodeNumber(episodes, currentQueueLen, idx),
      selectedEpisodeId: '',
      status: 'ready',
      progress: 0,
    }))
    setBulkQueue((p) => [...p, ...items])
  }, [canDropBulk, episodes, bulkQueue])

  // ── Dropzones ────────────────────────────────────────────────────────────────
  const epSingle  = useDropzone({ onDrop: onDropSingle, accept: ACCEPT, maxSize: MAX_SIZE })
  const bulkDrop  = useDropzone({ onDrop: onDropBulk,  accept: ACCEPT, maxSize: MAX_SIZE, multiple: true })
  const movieDrop = useDropzone({ onDrop: onDropSingle, accept: ACCEPT, maxSize: MAX_SIZE })
  const progDrop  = useDropzone({ onDrop: onDropSingle, accept: ACCEPT, maxSize: MAX_SIZE })

  // ── Single queue helpers ─────────────────────────────────────────────────────
  const cancelUpload = (item: UploadItem) => { item.abortController?.abort(); updateUpload(item.id, { status: 'CANCELLED' }) }
  const removeUpload = (id: string)        => setUploads((p) => p.filter((u) => u.id !== id))
  const retryUpload  = (item: UploadItem)  => {
    const fresh = { ...item, progress: 0, status: 'QUEUED' as const, error: undefined }
    updateUpload(item.id, fresh)
    startUpload(fresh)
  }

  // ── Step state ───────────────────────────────────────────────────────────────
  const step1Done   = selectedSeries !== ''
  const step2Done   = selectedSeason !== ''
  const step3Active = step2Done
  const step3Done   = canUploadSingle && uploadTarget === 'episode'

  // Bulk stats
  const bulkDone   = bulkQueue.filter((i) => i.status === 'COMPLETED').length
  const bulkFailed = bulkQueue.filter((i) => i.status === 'FAILED').length
  const bulkActive = bulkQueue.filter((i) => ACTIVE_STATUSES.includes(i.status as string)).length
  const bulkReady  = bulkQueue.filter((i) => i.status === 'ready').length

  // ── Location card (episode tab) ──────────────────────────────────────────────
  const LocationCard = (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Ubicación</CardTitle>
        <CardDescription>Serie y temporada destino para los episodios</CardDescription>
      </CardHeader>
      <CardContent className="grid sm:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Serie</Label>
          <Select value={selectedSeries} onValueChange={setSelectedSeries}>
            <SelectTrigger><SelectValue placeholder="Seleccionar serie..." /></SelectTrigger>
            <SelectContent>
              {allSeries.length === 0 && <SelectItem value="__e" disabled>No hay series</SelectItem>}
              {allSeries.map((s) => <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Temporada</Label>
          <Select value={selectedSeason} onValueChange={setSelectedSeason} disabled={!selectedSeries}>
            <SelectTrigger>
              <SelectValue placeholder={selectedSeries ? 'Seleccionar temporada...' : 'Primero elige una serie'} />
            </SelectTrigger>
            <SelectContent>
              {seasons.length === 0 && <SelectItem value="__e" disabled>Sin temporadas</SelectItem>}
              {seasons.map((s) => <SelectItem key={s.id} value={s.id}>T{s.number} — {s.title}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subir Contenido</h1>
        <p className="text-muted-foreground text-sm">
          Sube archivos de video con procesamiento automático HLS multi-bitrate.
        </p>
      </div>

      <Tabs value={uploadTarget} onValueChange={(v) => {
        setUploadTarget(v as typeof uploadTarget)
        setSelectedEpisode(''); setSelectedMovie(''); setSelectedProgram('')
        setEpisodeMode('existing'); setNewEpisodeTitle(''); setNewEpisodeNumber('')
        setBulkQueue([])
      }}>
        <TabsList>
          <TabsTrigger value="episode" className="gap-2"><Tv className="h-4 w-4" /> Episodio</TabsTrigger>
          <TabsTrigger value="movie"   className="gap-2"><Film className="h-4 w-4" /> Película</TabsTrigger>
          <TabsTrigger value="program" className="gap-2"><Video className="h-4 w-4" /> Programa</TabsTrigger>
        </TabsList>

        {/* ══ EPISODE TAB ══ */}
        <TabsContent value="episode" className="mt-4 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex rounded-lg border bg-muted p-1 gap-1">
              <button type="button"
                onClick={() => setEpisodeUploadMode('single')}
                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors
                  ${episodeUploadMode === 'single' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <PlayIcon className="h-3.5 w-3.5" /> Carga individual
              </button>
              <button type="button"
                onClick={() => setEpisodeUploadMode('bulk')}
                className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors
                  ${episodeUploadMode === 'bulk' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                <Layers className="h-3.5 w-3.5" /> Carga masiva
              </button>
            </div>
            {episodeUploadMode === 'bulk' && (
              <p className="text-xs text-muted-foreground">
                Sube múltiples episodios a la vez — configura cada archivo individualmente antes de iniciar
              </p>
            )}
          </div>

          {LocationCard}

          {/* ── Single mode ── */}
          {episodeUploadMode === 'single' && (
            <>
              <div className="flex items-center gap-3 flex-wrap">
                <Step n={1} label="Serie"     done={step1Done}  active={!step1Done} />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <Step n={2} label="Temporada" done={step2Done}  active={step1Done && !step2Done} />
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <Step n={3} label="Episodio"  done={step3Done}  active={step3Active && !step3Done} />
              </div>

              <Card className={!selectedSeason ? 'opacity-50 pointer-events-none' : ''}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">Episodio</CardTitle>
                      <CardDescription>
                        {episodeMode === 'existing' ? 'Elige un episodio ya creado' : 'Crea un nuevo episodio'}
                      </CardDescription>
                    </div>
                    <div className="flex rounded-lg border bg-muted p-1 gap-1 shrink-0">
                      <button type="button"
                        onClick={() => { setEpisodeMode('existing'); setNewEpisodeTitle(''); setNewEpisodeNumber('') }}
                        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors
                          ${episodeMode === 'existing' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        <List className="h-3.5 w-3.5" /> Existente
                      </button>
                      <button type="button"
                        onClick={() => setEpisodeMode('new')}
                        className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium transition-colors
                          ${episodeMode === 'new' ? 'bg-background shadow text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                        <Plus className="h-3.5 w-3.5" /> Nuevo
                      </button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {episodeMode === 'existing' ? (
                    <div className="max-w-xs space-y-2">
                      <Label>Episodio</Label>
                      <Select value={selectedEpisode} onValueChange={setSelectedEpisode} disabled={!selectedSeason}>
                        <SelectTrigger><SelectValue placeholder="Seleccionar episodio..." /></SelectTrigger>
                        <SelectContent>
                          {episodes.length === 0 && <SelectItem value="__e" disabled>Sin episodios — usa «Nuevo»</SelectItem>}
                          {episodes.map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              Ep. {e.number} — {e.title}{e.uploadStatus === 'COMPLETED' ? ' ✓' : ''}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {episodes.length === 0 && selectedSeason && (
                        <p className="text-xs text-muted-foreground">
                          Sin episodios.{' '}
                          <button type="button" className="underline hover:text-foreground" onClick={() => setEpisodeMode('new')}>
                            Crear nuevo
                          </button>
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="grid sm:grid-cols-2 gap-4 max-w-md">
                      <div className="space-y-2">
                        <Label htmlFor="ep-title">Título</Label>
                        <Input id="ep-title" placeholder="Ej. El comienzo" value={newEpisodeTitle}
                          onChange={(e) => setNewEpisodeTitle(e.target.value)} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ep-number">Número</Label>
                        <Input id="ep-number" type="number" min={1} placeholder="1" value={newEpisodeNumber}
                          onChange={(e) => setNewEpisodeNumber(e.target.value)} />
                      </div>
                      <p className="sm:col-span-2 text-xs text-muted-foreground">
                        El episodio se creará automáticamente al iniciar la carga.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <DropZone
                    rootProps={epSingle.getRootProps()}
                    inputProps={epSingle.getInputProps()}
                    isDragActive={epSingle.isDragActive}
                    canDrop={canUploadSingle}
                    disabledMessage={
                      !selectedSeries ? 'Selecciona una serie y temporada' :
                      !selectedSeason ? 'Selecciona una temporada' :
                      episodeMode === 'existing' ? 'Selecciona un episodio o usa el modo «Nuevo»' :
                      'Completa el título y número del episodio'
                    }
                  />
                </CardContent>
              </Card>

              <SingleQueueCard uploads={uploads} onCancel={cancelUpload} onRemove={removeUpload} onRetry={retryUpload} />
            </>
          )}

          {/* ── Bulk mode ── */}
          {episodeUploadMode === 'bulk' && (
            <>
              <Card>
                <CardContent className="pt-6">
                  <DropZone
                    rootProps={bulkDrop.getRootProps()}
                    inputProps={bulkDrop.getInputProps()}
                    isDragActive={bulkDrop.isDragActive}
                    canDrop={canDropBulk && !isBulkRunning}
                    multiple
                    disabledMessage={
                      !selectedSeries ? 'Selecciona una serie primero' :
                      !selectedSeason ? 'Selecciona una temporada para habilitar la carga masiva' :
                      'Carga en curso...'
                    }
                  />
                </CardContent>
              </Card>

              {bulkQueue.length > 0 && (
                <Card>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-4 flex-wrap">
                      <div>
                        <CardTitle className="text-base">
                          Lote · {bulkQueue.length} {bulkQueue.length === 1 ? 'episodio' : 'episodios'}
                        </CardTitle>
                        <div className="flex gap-3 mt-0.5 text-xs">
                          {bulkReady  > 0 && <span className="text-muted-foreground">{bulkReady} listos</span>}
                          {bulkActive > 0 && <span className="text-amber-500">{bulkActive} en proceso</span>}
                          {bulkDone   > 0 && <span className="text-emerald-500">{bulkDone} completados</span>}
                          {bulkFailed > 0 && <span className="text-destructive">{bulkFailed} con error</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {!isBulkRunning && bulkReady > 0 && (
                          <Button variant="ghost" size="sm"
                            onClick={() => setBulkQueue((p) => p.filter((i) => i.status !== 'ready'))}>
                            <Trash2 className="h-4 w-4 mr-1.5" /> Quitar listos
                          </Button>
                        )}
                        {bulkDone > 0 && !isBulkRunning && (
                          <Button variant="ghost" size="sm"
                            onClick={() => setBulkQueue((p) => p.filter((i) => i.status !== 'COMPLETED'))}>
                            Limpiar completados
                          </Button>
                        )}
                        <Button size="sm" disabled={!canStartBulk} onClick={startBulkUpload} className="gap-2">
                          {isBulkRunning
                            ? <><Loader2 className="h-4 w-4 animate-spin" /> Procesando {bulkActive}/{bulkQueue.length}...</>
                            : <><Upload className="h-4 w-4" /> Iniciar carga masiva ({bulkReady})</>}
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {bulkQueue.map((item) => (
                      <BulkQueueRow
                        key={item.id}
                        item={item}
                        episodes={episodes}
                        onChange={updateBulkItem}
                        onRemove={removeBulkItem}
                        isRunning={isBulkRunning}
                      />
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>

        {/* ══ MOVIE TAB ══ */}
        <TabsContent value="movie" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Seleccionar película</CardTitle>
              <CardDescription>Haz clic en la película a la que se vinculará el archivo de video</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar película..."
                  className="pl-9"
                  value={movieSearch}
                  onChange={(e) => setMovieSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {movies.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">No hay películas. Crea una primero.</p>
                ) : filteredMovies.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">Sin resultados para esa búsqueda</p>
                ) : filteredMovies.map((m) => (
                  <ContentPickerCard
                    key={m.id}
                    id={m.id}
                    title={m.title}
                    subtitle={[
                      m.director ? `Dir. ${m.director}` : '',
                      m.year ? String(m.year) : '',
                      m.duration ? formatDuration(m.duration) : '',
                    ].filter(Boolean).join(' · ')}
                    thumbnailUrl={m.thumbnailUrl}
                    uploadStatus={m.uploadStatus}
                    icon={Film}
                    selected={selectedMovie === m.id}
                    onSelect={setSelectedMovie}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <DropZone
                rootProps={movieDrop.getRootProps()}
                inputProps={movieDrop.getInputProps()}
                isDragActive={movieDrop.isDragActive}
                canDrop={selectedMovie !== ''}
                disabledMessage="Selecciona una película de la lista"
              />
            </CardContent>
          </Card>
          <SingleQueueCard uploads={uploads} onCancel={cancelUpload} onRemove={removeUpload} onRetry={retryUpload} />
        </TabsContent>

        {/* ══ PROGRAM TAB ══ */}
        <TabsContent value="program" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Seleccionar programa</CardTitle>
              <CardDescription>Haz clic en el programa al que se vinculará el archivo de video</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar programa..."
                  className="pl-9"
                  value={programSearch}
                  onChange={(e) => setProgramSearch(e.target.value)}
                />
              </div>
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {programs.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">No hay programas. Crea uno primero.</p>
                ) : filteredPrograms.length === 0 ? (
                  <p className="text-center text-sm text-muted-foreground py-10">Sin resultados para esa búsqueda</p>
                ) : filteredPrograms.map((p) => (
                  <ContentPickerCard
                    key={p.id}
                    id={p.id}
                    title={p.title}
                    subtitle={[
                      p.category ?? '',
                      p.duration ? formatDuration(p.duration) : '',
                    ].filter(Boolean).join(' · ')}
                    thumbnailUrl={p.thumbnailUrl}
                    uploadStatus={p.uploadStatus}
                    icon={Video}
                    selected={selectedProgram === p.id}
                    onSelect={setSelectedProgram}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <DropZone
                rootProps={progDrop.getRootProps()}
                inputProps={progDrop.getInputProps()}
                isDragActive={progDrop.isDragActive}
                canDrop={selectedProgram !== ''}
                disabledMessage="Selecciona un programa de la lista"
              />
            </CardContent>
          </Card>
          <SingleQueueCard uploads={uploads} onCancel={cancelUpload} onRemove={removeUpload} onRetry={retryUpload} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
