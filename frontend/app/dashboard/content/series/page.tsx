'use client'

import { useEffect, useState, useCallback } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import {
  MoreHorizontal, Plus, Pencil, Trash2, Layers, ChevronRight,
  ChevronDown, ChevronUp, Play, Download, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { contentService } from '@/services/content.service'
import { downloadService, toStorageUrl } from '@/services/download.service'
import { formatDuration } from '@/lib/utils'
import type { Series, Season, Episode } from '@/types'

import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { MediaPlayer } from '@/components/ui/media-player'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

// ─── Series form ──────────────────────────────────────────────────────────────

const seriesSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(200),
  description: z.string().max(1000).optional(),
  synopsis: z.string().max(2000).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
})
type SeriesForm = z.infer<typeof seriesSchema>

function SeriesFormFields({ f }: { f: ReturnType<typeof useForm<SeriesForm>> }) {
  return (
    <div className="grid gap-4 py-4">
      <FormField control={f.control} name="title" render={({ field }) => (
        <FormItem>
          <FormLabel>Título *</FormLabel>
          <FormControl><Input placeholder="Título de la serie" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={f.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel>Descripción</FormLabel>
          <FormControl><Textarea placeholder="Descripción breve..." rows={3} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={f.control} name="synopsis" render={({ field }) => (
        <FormItem>
          <FormLabel>Sinopsis</FormLabel>
          <FormControl><Textarea placeholder="Sinopsis completa..." rows={4} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={f.control} name="year" render={({ field }) => (
        <FormItem>
          <FormLabel>Año</FormLabel>
          <FormControl>
            <Input
              type="number"
              placeholder="2024"
              {...field}
              onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}

// ─── Season form ──────────────────────────────────────────────────────────────

const seasonSchema = z.object({
  number: z.number().int().min(1, 'Número requerido'),
  title: z.string().min(1, 'Título requerido').max(200),
  description: z.string().max(1000).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
})
type SeasonForm = z.infer<typeof seasonSchema>

function SeasonFormFields({ f }: { f: ReturnType<typeof useForm<SeasonForm>> }) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={f.control} name="number" render={({ field }) => (
          <FormItem>
            <FormLabel>Número *</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="1"
                {...field}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={f.control} name="year" render={({ field }) => (
          <FormItem>
            <FormLabel>Año</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="2024"
                {...field}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <FormField control={f.control} name="title" render={({ field }) => (
        <FormItem>
          <FormLabel>Título *</FormLabel>
          <FormControl><Input placeholder="Ej: Temporada 1 - 2024" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={f.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel>Descripción</FormLabel>
          <FormControl><Textarea placeholder="Descripción de la temporada..." rows={3} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}

// ─── Episode title schema ─────────────────────────────────────────────────────

const epTitleSchema = z.object({ title: z.string().min(1, 'Título requerido').max(200) })
type EpTitleForm = z.infer<typeof epTitleSchema>

// ─── Episode row ──────────────────────────────────────────────────────────────

interface EpisodeRowProps {
  episode: Episode
  seriesTitle: string
  onPlay: (ep: Episode) => void
  onEdit: (ep: Episode) => void
  onDelete: (ep: Episode) => void
}

function EpisodeRow({ episode, seriesTitle, onPlay, onEdit, onDelete }: EpisodeRowProps) {
  const ready   = episode.uploadStatus === 'COMPLETED'
  const canPlay = ready && !!(episode.hlsUrl ?? episode.videoUrl)
  const canDl   = ready && !!episode.videoUrl

  const handleDownload = () => {
    if (!episode.videoUrl) return
    downloadService.downloadFile(episode.videoUrl, `${seriesTitle} - ${episode.title}.mp4`)
  }

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-muted/40 transition-colors rounded-md">
      <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 text-right">
        {String(episode.number).padStart(2, '0')}
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${!ready ? 'text-muted-foreground' : 'font-medium'}`}>
          {episode.title}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          {episode.duration && (
            <span className="text-xs text-muted-foreground">{formatDuration(episode.duration)}</span>
          )}
          {!ready && (
            <Badge variant="outline" className="text-xs h-4 px-1">
              {episode.uploadStatus === 'FAILED' ? 'Error' : 'Procesando'}
            </Badge>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          disabled={!canPlay}
          title="Ver episodio"
          onClick={() => canPlay && onPlay(episode)}
        >
          <Play className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          disabled={!canDl}
          title="Descargar episodio"
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          title="Renombrar episodio"
          onClick={() => onEdit(episode)}
        >
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-destructive hover:text-destructive"
          title="Eliminar episodio"
          onClick={() => onDelete(episode)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Season row (expandable with episodes) ────────────────────────────────────

interface SeasonRowProps {
  season: Season
  seriesTitle: string
  onEdit: (s: Season) => void
  onDelete: (s: Season) => void
  onPlayEpisode: (ep: Episode) => void
  onEditEpisode: (ep: Episode) => void
  onDeleteEpisode: (ep: Episode) => void
}

function SeasonRow({ season, seriesTitle, onEdit, onDelete, onPlayEpisode, onEditEpisode, onDeleteEpisode }: SeasonRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [episodes, setEpisodes] = useState<Episode[] | null>(null)
  const [loading, setLoading] = useState(false)

  const toggle = async () => {
    if (!expanded && episodes === null) {
      setLoading(true)
      try {
        const data = await contentService.getEpisodesBySeasonId(season.id)
        setEpisodes(data)
      } finally {
        setLoading(false)
      }
    }
    setExpanded((v) => !v)
  }

  // Refresh after an episode is deleted
  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await contentService.getEpisodesBySeasonId(season.id)
      setEpisodes(data)
    } finally {
      setLoading(false)
    }
  }, [season.id])

  // Expose refresh via a custom event so parent can trigger it
  useEffect(() => {
    const handler = ((e: CustomEvent) => {
      if (e.detail === season.id) refresh()
    }) as EventListener
    window.addEventListener('episode-changed', handler)
    return () => window.removeEventListener('episode-changed', handler)
  }, [season.id, refresh])

  return (
    <div className="border rounded-lg overflow-hidden">
      {/* Season header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/20 hover:bg-muted/30 transition-colors">
        <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={toggle}>
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
          ) : expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            T{String(season.number).padStart(2, '0')}
          </span>
          <span className="text-sm font-medium truncate">{season.title}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            · {season._count?.episodes ?? 0} ep.{season.year ? ` · ${season.year}` : ''}
          </span>
        </button>

        <div className="flex items-center gap-1 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(season)}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={() => onDelete(season)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Episodes */}
      {expanded && (
        <div className="divide-y divide-border/50 px-2 py-1">
          {episodes === null || loading ? (
            <div className="py-6 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : episodes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-5">
              Esta temporada no tiene episodios todavía.
            </p>
          ) : (
            episodes.map((ep) => (
              <EpisodeRow
                key={ep.id}
                episode={ep}
                seriesTitle={seriesTitle}
                onPlay={onPlayEpisode}
                onEdit={onEditEpisode}
                onDelete={onDeleteEpisode}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Seasons management dialog ────────────────────────────────────────────────

function SeasonsDialog({ series, onClose }: { series: Series; onClose: () => void }) {
  const [seasons, setSeasons]       = useState<Season[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editSeason, setEditSeason] = useState<Season | null>(null)
  const [deleteSeason, setDeleteSeason] = useState<Season | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Episode actions
  const [player, setPlayer]           = useState<{ title: string; src: string; hlsSrc?: string; poster?: string } | null>(null)
  const [editEpisode, setEditEpisode] = useState<Episode | null>(null)
  const [deleteEpisode, setDeleteEpisode] = useState<Episode | null>(null)
  const [epSubmitting, setEpSubmitting]   = useState(false)

  const epForm = useForm<EpTitleForm>({
    resolver: zodResolver(epTitleSchema),
    defaultValues: { title: '' },
  })
  useEffect(() => {
    if (editEpisode) epForm.reset({ title: editEpisode.title })
  }, [editEpisode, epForm])

  const createForm = useForm<SeasonForm>({ resolver: zodResolver(seasonSchema), defaultValues: { title: '', description: '' } })
  const editForm   = useForm<SeasonForm>({ resolver: zodResolver(seasonSchema), defaultValues: { title: '', description: '' } })

  const fetchSeasons = useCallback(async () => {
    setIsLoading(true)
    try {
      const data = await contentService.getSeasonsBySeriesId(series.id)
      setSeasons(data)
    } finally {
      setIsLoading(false)
    }
  }, [series.id])

  useEffect(() => { fetchSeasons() }, [fetchSeasons])
  useEffect(() => {
    if (editSeason) {
      editForm.reset({
        number: editSeason.number,
        title: editSeason.title,
        description: editSeason.description ?? '',
        year: editSeason.year ?? undefined,
      })
    }
  }, [editSeason, editForm])

  // Season handlers
  const handleCreate = async (values: SeasonForm) => {
    setIsSubmitting(true)
    try {
      await contentService.createSeason(series.id, values)
      toast.success('Temporada creada')
      setCreateOpen(false)
      createForm.reset({ title: '', description: '' })
      fetchSeasons()
    } catch { toast.error('Error al crear la temporada') }
    finally { setIsSubmitting(false) }
  }

  const handleUpdate = async (values: SeasonForm) => {
    if (!editSeason) return
    setIsSubmitting(true)
    try {
      await contentService.updateSeason(editSeason.id, values)
      toast.success('Temporada actualizada')
      setEditSeason(null)
      fetchSeasons()
    } catch { toast.error('Error al actualizar la temporada') }
    finally { setIsSubmitting(false) }
  }

  const handleDeleteSeason = async () => {
    if (!deleteSeason) return
    setIsSubmitting(true)
    try {
      await contentService.deleteSeason(deleteSeason.id)
      toast.success('Temporada eliminada')
      setDeleteSeason(null)
      fetchSeasons()
    } catch { toast.error('Error al eliminar la temporada') }
    finally { setIsSubmitting(false) }
  }

  // Episode handlers
  const handlePlayEpisode = (ep: Episode) => {
    setPlayer({
      title: ep.title,
      src:    toStorageUrl(ep.videoUrl) ?? '',
      hlsSrc: toStorageUrl(ep.hlsUrl),
      poster: toStorageUrl(ep.thumbnailUrl) ?? undefined,
    })
  }

  const handleEditEpisode = async (values: EpTitleForm) => {
    if (!editEpisode) return
    setEpSubmitting(true)
    try {
      await contentService.updateEpisode(editEpisode.id, { title: values.title })
      toast.success('Episodio renombrado')
      window.dispatchEvent(new CustomEvent('episode-changed', { detail: editEpisode.seasonId }))
      setEditEpisode(null)
    } catch { toast.error('Error al renombrar el episodio') }
    finally { setEpSubmitting(false) }
  }

  const handleDeleteEpisode = async () => {
    if (!deleteEpisode) return
    setEpSubmitting(true)
    try {
      await contentService.deleteEpisode(deleteEpisode.id)
      toast.success('Episodio eliminado')
      window.dispatchEvent(new CustomEvent('episode-changed', { detail: deleteEpisode.seasonId }))
      setDeleteEpisode(null)
    } catch { toast.error('Error al eliminar el episodio') }
    finally { setEpSubmitting(false) }
  }

  return (
    <>
      {/* ── Main dialog ── */}
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Temporadas — {series.title}
            </DialogTitle>
            <DialogDescription>
              Expande una temporada para ver y gestionar sus episodios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 max-h-[60vh] overflow-y-auto pr-1">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-lg" />
              ))
            ) : seasons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Esta serie no tiene temporadas todavía.
              </p>
            ) : (
              seasons.map((s) => (
                <SeasonRow
                  key={s.id}
                  season={s}
                  seriesTitle={series.title}
                  onEdit={setEditSeason}
                  onDelete={setDeleteSeason}
                  onPlayEpisode={handlePlayEpisode}
                  onEditEpisode={setEditEpisode}
                  onDeleteEpisode={setDeleteEpisode}
                />
              ))
            )}
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Nueva temporada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Player ── */}
      <Dialog open={!!player} onOpenChange={(o) => !o && setPlayer(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="truncate">{player?.title}</DialogTitle>
          </DialogHeader>
          {player && (
            <div className="p-4 pt-2">
              <MediaPlayer
                src={player.src}
                hlsSrc={player.hlsSrc}
                title={player.title}
                poster={player.poster}
                autoPlay
                className="w-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Rename episode ── */}
      <Dialog open={!!editEpisode} onOpenChange={(o) => !o && setEditEpisode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renombrar episodio</DialogTitle>
            <DialogDescription>
              Ep. {editEpisode?.number} — nuevo título
            </DialogDescription>
          </DialogHeader>
          <Form {...epForm}>
            <form onSubmit={epForm.handleSubmit(handleEditEpisode)}>
              <div className="py-4">
                <FormField control={epForm.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título</FormLabel>
                    <FormControl><Input placeholder="Nuevo título..." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditEpisode(null)}>Cancelar</Button>
                <Button type="submit" disabled={epSubmitting}>
                  {epSubmitting ? 'Guardando...' : 'Guardar'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete episode ── */}
      <Dialog open={!!deleteEpisode} onOpenChange={(o) => !o && setDeleteEpisode(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar episodio</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deleteEpisode?.title}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEpisode(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={epSubmitting} onClick={handleDeleteEpisode}>
              {epSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create season ── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva temporada</DialogTitle>
            <DialogDescription>Añade una temporada a {series.title}.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)}>
              <SeasonFormFields f={createForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear temporada'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Edit season ── */}
      <Dialog open={!!editSeason} onOpenChange={(o) => !o && setEditSeason(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar temporada</DialogTitle>
            <DialogDescription>T{editSeason?.number} — {editSeason?.title}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)}>
              <SeasonFormFields f={editForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditSeason(null)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* ── Delete season ── */}
      <Dialog open={!!deleteSeason} onOpenChange={(o) => !o && setDeleteSeason(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar temporada</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>T{deleteSeason?.number} — {deleteSeason?.title}</strong>?
              Se eliminarán todos sus episodios.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSeason(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={isSubmitting} onClick={handleDeleteSeason}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SeriesPage() {
  const [series, setSeries]       = useState<Series[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [createOpen, setCreateOpen]     = useState(false)
  const [editSeries, setEditSeries]     = useState<Series | null>(null)
  const [deleteSeries, setDeleteSeries] = useState<Series | null>(null)
  const [manageSeries, setManageSeries] = useState<Series | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<SeriesForm>({
    resolver: zodResolver(seriesSchema),
    defaultValues: { title: '', description: '', synopsis: '' },
  })
  const editForm = useForm<SeriesForm>({
    resolver: zodResolver(seriesSchema),
    defaultValues: { title: '', description: '', synopsis: '' },
  })

  const fetchSeries = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const result = await contentService.getAllSeries({ page: p, limit: 20 } as never)
      setSeries(result.data)
      setTotalPages(result.meta.totalPages)
      setTotalCount(result.meta.total)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchSeries(page) }, [fetchSeries, page])

  useEffect(() => {
    if (editSeries) {
      editForm.reset({
        title: editSeries.title,
        description: editSeries.description ?? '',
        synopsis: editSeries.synopsis ?? '',
        year: editSeries.year ?? undefined,
      })
    }
  }, [editSeries, editForm])

  const handleCreate = async (values: SeriesForm) => {
    setIsSubmitting(true)
    try {
      await contentService.createSeries(values)
      toast.success('Serie creada correctamente')
      setCreateOpen(false)
      form.reset({ title: '', description: '', synopsis: '' })
      fetchSeries(page)
    } catch { toast.error('Error al crear la serie') }
    finally { setIsSubmitting(false) }
  }

  const handleUpdate = async (values: SeriesForm) => {
    if (!editSeries) return
    setIsSubmitting(true)
    try {
      await contentService.updateSeries(editSeries.id, values)
      toast.success('Serie actualizada')
      setEditSeries(null)
      fetchSeries(page)
    } catch { toast.error('Error al actualizar la serie') }
    finally { setIsSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!deleteSeries) return
    setIsSubmitting(true)
    try {
      await contentService.deleteSeries(deleteSeries.id)
      toast.success('Serie eliminada')
      setDeleteSeries(null)
      fetchSeries(page)
    } catch { toast.error('Error al eliminar la serie') }
    finally { setIsSubmitting(false) }
  }

  const columns: ColumnDef<Series>[] = [
    {
      accessorKey: 'title',
      header: 'Título',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title}</div>
          {row.original.year && (
            <div className="text-xs text-muted-foreground">{row.original.year}</div>
          )}
        </div>
      ),
    },
    {
      id: 'seasons',
      header: 'Temporadas',
      cell: ({ row }) => (
        <button
          className="flex items-center gap-1.5 hover:underline text-left"
          onClick={() => setManageSeries(row.original)}
        >
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-sm">{row.original._count?.seasons ?? 0}</span>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        </button>
      ),
    },
    {
      accessorKey: 'genre',
      header: 'Géneros',
      cell: ({ getValue }) => {
        const genres = getValue() as string[]
        return (
          <div className="flex flex-wrap gap-1">
            {genres.slice(0, 2).map((g) => (
              <Badge key={g} variant="outline" className="text-xs">{g}</Badge>
            ))}
          </div>
        )
      },
    },
    {
      accessorKey: 'createdAt',
      header: 'Creada',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(getValue() as string), 'dd MMM yyyy', { locale: es })}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const s = row.original
        return (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Acciones</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setManageSeries(s)}>
                <Layers className="mr-2 h-4 w-4" />Gestionar temporadas
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setEditSeries(s)}>
                <Pencil className="mr-2 h-4 w-4" />Editar serie
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteSeries(s)}>
                <Trash2 className="mr-2 h-4 w-4" />Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Series</h1>
          <p className="text-muted-foreground text-sm">Gestiona las series y sus temporadas.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />Nueva serie
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={series}
        isLoading={isLoading}
        searchColumn="title"
        searchPlaceholder="Buscar series..."
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        totalCount={totalCount}
      />

      {manageSeries && (
        <SeasonsDialog
          series={manageSeries}
          onClose={() => { setManageSeries(null); fetchSeries(page) }}
        />
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva serie</DialogTitle>
            <DialogDescription>Completa la información para crear una nueva serie.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)}>
              <SeriesFormFields f={form} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear serie'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editSeries} onOpenChange={(o) => !o && setEditSeries(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar serie</DialogTitle>
            <DialogDescription>Modifica la información de {editSeries?.title}.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)}>
              <SeriesFormFields f={editForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditSeries(null)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteSeries} onOpenChange={(o) => !o && setDeleteSeries(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar serie</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deleteSeries?.title}</strong>? Se eliminarán todas sus temporadas y episodios.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSeries(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={isSubmitting} onClick={handleDelete}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
