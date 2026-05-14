'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Loader2, ChevronDown, ChevronUp,
  Play, Download, MoreHorizontal, Search, Tv2,
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

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { MediaPlayer } from '@/components/ui/media-player'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const seriesSchema = z.object({
  title:       z.string().min(1, 'Título requerido').max(200),
  description: z.string().max(1000).optional(),
  synopsis:    z.string().max(2000).optional(),
  year:        z.number().int().min(1900).max(2100).optional(),
})
type SeriesForm = z.infer<typeof seriesSchema>

const seasonSchema = z.object({
  number:      z.number().int().min(1, 'Número requerido'),
  title:       z.string().min(1, 'Título requerido').max(200),
  description: z.string().max(1000).optional(),
  year:        z.number().int().min(1900).max(2100).optional(),
})
type SeasonForm = z.infer<typeof seasonSchema>

const epSchema = z.object({ title: z.string().min(1, 'Título requerido').max(200) })
type EpForm = z.infer<typeof epSchema>

// ─── Shared number input helper ───────────────────────────────────────────────

const toInt = (v: string) => (v ? parseInt(v) : undefined)

// ─── Episode row ──────────────────────────────────────────────────────────────

interface EpisodeRowProps {
  episode:     Episode
  seriesTitle: string
  onPlay:      (ep: Episode) => void
  onEdit:      (ep: Episode) => void
  onDelete:    (ep: Episode) => void
}

function EpisodeRow({ episode, seriesTitle, onPlay, onEdit, onDelete }: EpisodeRowProps) {
  const ready  = episode.uploadStatus === 'COMPLETED'
  const canPlay = ready && !!(episode.hlsUrl ?? episode.videoUrl)
  const canDl   = ready && !!episode.videoUrl

  const handleDownload = () => {
    if (!episode.videoUrl) return
    downloadService.downloadFile(episode.videoUrl, `${seriesTitle} - ${episode.title}.mp4`)
  }

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
      <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 text-right">
        {String(episode.number).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${ready ? 'font-medium' : 'text-muted-foreground'}`}>
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
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canPlay}
          title="Ver episodio" onClick={() => canPlay && onPlay(episode)}>
          <Play className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7" disabled={!canDl}
          title="Descargar episodio" onClick={handleDownload}>
          <Download className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7"
          title="Renombrar episodio" onClick={() => onEdit(episode)}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive"
          title="Eliminar episodio" onClick={() => onDelete(episode)}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

// ─── Season row (manages its own episodes + episode dialogs) ──────────────────

interface SeasonRowProps {
  season:       Season
  seriesTitle:  string
  onEdit:       (s: Season) => void
  onDelete:     (s: Season) => void
}

function SeasonRow({ season, seriesTitle, onEdit, onDelete }: SeasonRowProps) {
  const [expanded, setExpanded]   = useState(false)
  const [episodes, setEpisodes]   = useState<Episode[] | null>(null)
  const [loading, setLoading]     = useState(false)
  const [player, setPlayer]       = useState<{ title: string; src: string; hlsSrc?: string; poster?: string } | null>(null)
  const [editEp, setEditEp]       = useState<Episode | null>(null)
  const [deleteEp, setDeleteEp]   = useState<Episode | null>(null)
  const [epBusy, setEpBusy]       = useState(false)

  const epForm = useForm<EpForm>({ resolver: zodResolver(epSchema), defaultValues: { title: '' } })
  useEffect(() => { if (editEp) epForm.reset({ title: editEp.title }) }, [editEp, epForm])

  const loadEpisodes = useCallback(async () => {
    setLoading(true)
    try {
      const data = await contentService.getEpisodesBySeasonId(season.id)
      setEpisodes(data)
    } finally { setLoading(false) }
  }, [season.id])

  const toggle = () => {
    if (!expanded && episodes === null) loadEpisodes()
    setExpanded(v => !v)
  }

  const handlePlayEp = (ep: Episode) => setPlayer({
    title:  ep.title,
    src:    toStorageUrl(ep.videoUrl) ?? '',
    hlsSrc: toStorageUrl(ep.hlsUrl),
    poster: toStorageUrl(ep.thumbnailUrl) ?? undefined,
  })

  const handleRenameEp = async (values: EpForm) => {
    if (!editEp) return
    setEpBusy(true)
    try {
      await contentService.updateEpisode(editEp.id, { title: values.title })
      toast.success('Episodio renombrado')
      setEditEp(null)
      loadEpisodes()
    } catch { toast.error('Error al renombrar') }
    finally { setEpBusy(false) }
  }

  const handleDeleteEp = async () => {
    if (!deleteEp) return
    setEpBusy(true)
    try {
      await contentService.deleteEpisode(deleteEp.id)
      toast.success('Episodio eliminado')
      setDeleteEp(null)
      loadEpisodes()
    } catch { toast.error('Error al eliminar') }
    finally { setEpBusy(false) }
  }

  return (
    <>
      <div className="border-t border-border/50">
        {/* Season header — clickable to expand */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/10 hover:bg-muted/20 transition-colors">
          <button
            className="flex items-center gap-2 flex-1 min-w-0 text-left"
            onClick={toggle}
          >
            {loading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
              : expanded
                ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            }
            <span className="text-xs font-mono text-muted-foreground shrink-0">
              T{String(season.number).padStart(2, '0')}
            </span>
            <span className="text-sm font-medium truncate">{season.title}</span>
            <span className="text-xs text-muted-foreground shrink-0">
              · {season._count?.episodes ?? 0} episodios{season.year ? ` · ${season.year}` : ''}
            </span>
          </button>
          <div className="flex items-center gap-1 shrink-0">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onEdit(season)}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={() => onDelete(season)}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Episode list */}
        {expanded && (
          <div className="divide-y divide-border/30 bg-background">
            {episodes === null || loading ? (
              <div className="py-6 flex justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : episodes.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-5">
                Sin episodios en esta temporada.
              </p>
            ) : (
              episodes.map(ep => (
                <EpisodeRow
                  key={ep.id}
                  episode={ep}
                  seriesTitle={seriesTitle}
                  onPlay={handlePlayEp}
                  onEdit={setEditEp}
                  onDelete={setDeleteEp}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Player */}
      <Dialog open={!!player} onOpenChange={o => !o && setPlayer(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="truncate">{player?.title}</DialogTitle>
          </DialogHeader>
          {player && (
            <div className="p-4 pt-2">
              <MediaPlayer src={player.src} hlsSrc={player.hlsSrc}
                title={player.title} poster={player.poster} autoPlay className="w-full" />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Rename episode */}
      <Dialog open={!!editEp} onOpenChange={o => !o && setEditEp(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Renombrar episodio</DialogTitle>
            <DialogDescription>Ep. {editEp?.number} — nuevo título</DialogDescription>
          </DialogHeader>
          <Form {...epForm}>
            <form onSubmit={epForm.handleSubmit(handleRenameEp)}>
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
                <Button variant="outline" type="button" onClick={() => setEditEp(null)}>Cancelar</Button>
                <Button type="submit" disabled={epBusy}>{epBusy ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete episode */}
      <Dialog open={!!deleteEp} onOpenChange={o => !o && setDeleteEp(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar episodio</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deleteEp?.title}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteEp(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={epBusy} onClick={handleDeleteEp}>
              {epBusy ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Series card (manages its own seasons + season dialogs) ──────────────────

interface SeriesCardProps {
  series:    Series
  onEdit:    (s: Series) => void
  onDelete:  (s: Series) => void
  onRefresh: () => void
}

function SeriesCard({ series, onEdit, onDelete, onRefresh }: SeriesCardProps) {
  const [expanded, setExpanded]       = useState(false)
  const [seasons, setSeasons]         = useState<Season[] | null>(null)
  const [loadingSeasons, setLoadingSeasons] = useState(false)
  const [createOpen, setCreateOpen]   = useState(false)
  const [editSeason, setEditSeason]   = useState<Season | null>(null)
  const [deleteSeason, setDeleteSeason] = useState<Season | null>(null)
  const [seasonBusy, setSeasonBusy]   = useState(false)

  const createForm = useForm<SeasonForm>({ resolver: zodResolver(seasonSchema), defaultValues: { title: '', description: '' } })
  const editForm   = useForm<SeasonForm>({ resolver: zodResolver(seasonSchema), defaultValues: { title: '', description: '' } })
  useEffect(() => {
    if (editSeason) editForm.reset({
      number: editSeason.number, title: editSeason.title,
      description: editSeason.description ?? '', year: editSeason.year ?? undefined,
    })
  }, [editSeason, editForm])

  const loadSeasons = useCallback(async () => {
    setLoadingSeasons(true)
    try {
      const data = await contentService.getSeasonsBySeriesId(series.id)
      setSeasons(data)
    } finally { setLoadingSeasons(false) }
  }, [series.id])

  const toggle = () => {
    if (!expanded && seasons === null) loadSeasons()
    setExpanded(v => !v)
  }

  const handleCreateSeason = async (values: SeasonForm) => {
    setSeasonBusy(true)
    try {
      await contentService.createSeason(series.id, values)
      toast.success('Temporada creada')
      setCreateOpen(false)
      createForm.reset({ title: '', description: '' })
      loadSeasons()
      onRefresh()
    } catch { toast.error('Error al crear la temporada') }
    finally { setSeasonBusy(false) }
  }

  const handleUpdateSeason = async (values: SeasonForm) => {
    if (!editSeason) return
    setSeasonBusy(true)
    try {
      await contentService.updateSeason(editSeason.id, values)
      toast.success('Temporada actualizada')
      setEditSeason(null)
      loadSeasons()
    } catch { toast.error('Error al actualizar la temporada') }
    finally { setSeasonBusy(false) }
  }

  const handleDeleteSeason = async () => {
    if (!deleteSeason) return
    setSeasonBusy(true)
    try {
      await contentService.deleteSeason(deleteSeason.id)
      toast.success('Temporada eliminada')
      setDeleteSeason(null)
      loadSeasons()
      onRefresh()
    } catch { toast.error('Error al eliminar la temporada') }
    finally { setSeasonBusy(false) }
  }

  const seasonCount = series._count?.seasons ?? 0

  return (
    <>
      <div className="border rounded-xl overflow-hidden">
        {/* Series header */}
        <div className="flex items-center gap-3 px-4 py-3.5">
          {/* Expand toggle */}
          <button
            className="flex items-center gap-3 flex-1 min-w-0 text-left"
            onClick={toggle}
          >
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-muted shrink-0">
              {loadingSeasons
                ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                : expanded
                  ? <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  : <ChevronDown className="h-4 w-4 text-muted-foreground" />
              }
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{series.title}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {series.year ? `${series.year} · ` : ''}
                {seasonCount} temporada{seasonCount !== 1 ? 's' : ''}
                {series.genre?.length ? ` · ${series.genre.slice(0, 2).join(', ')}` : ''}
              </p>
            </div>
          </button>

          {/* Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-xs text-muted-foreground hidden sm:block">
              {format(new Date(series.createdAt), 'dd MMM yyyy', { locale: es })}
            </span>
            <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
              onClick={() => { setCreateOpen(true) }}>
              <Plus className="h-3 w-3" /> Temporada
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuLabel>Serie</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onEdit(series)}>
                  <Pencil className="mr-2 h-4 w-4" /> Editar serie
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive" onClick={() => onDelete(series)}>
                  <Trash2 className="mr-2 h-4 w-4" /> Eliminar serie
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Seasons list (expanded) */}
        {expanded && (
          <div>
            {seasons === null || loadingSeasons ? (
              <div className="py-6 flex justify-center border-t">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : seasons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6 border-t">
                Sin temporadas. Usa el botón <strong>+ Temporada</strong> para añadir una.
              </p>
            ) : (
              seasons.map(s => (
                <SeasonRow
                  key={s.id}
                  season={s}
                  seriesTitle={series.title}
                  onEdit={setEditSeason}
                  onDelete={setDeleteSeason}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Create season */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva temporada</DialogTitle>
            <DialogDescription>Añade una temporada a «{series.title}».</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreateSeason)}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={createForm.control} name="number" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="1" {...field}
                          value={field.value ?? ''}
                          onChange={e => field.onChange(toInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={createForm.control} name="year" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Año</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="2024" {...field}
                          value={field.value ?? ''}
                          onChange={e => field.onChange(toInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={createForm.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título *</FormLabel>
                    <FormControl><Input placeholder="Temporada 1 · 2024" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={createForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl><Textarea placeholder="Descripción..." rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={seasonBusy}>{seasonBusy ? 'Creando...' : 'Crear temporada'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit season */}
      <Dialog open={!!editSeason} onOpenChange={o => !o && setEditSeason(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar temporada</DialogTitle>
            <DialogDescription>T{editSeason?.number} — {editSeason?.title}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdateSeason)}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editForm.control} name="number" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número *</FormLabel>
                      <FormControl>
                        <Input type="number" {...field}
                          value={field.value ?? ''}
                          onChange={e => field.onChange(toInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="year" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Año</FormLabel>
                      <FormControl>
                        <Input type="number" {...field}
                          value={field.value ?? ''}
                          onChange={e => field.onChange(toInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={editForm.control} name="title" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Título *</FormLabel>
                    <FormControl><Input {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={editForm.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Descripción</FormLabel>
                    <FormControl><Textarea rows={3} {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditSeason(null)}>Cancelar</Button>
                <Button type="submit" disabled={seasonBusy}>{seasonBusy ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete season */}
      <Dialog open={!!deleteSeason} onOpenChange={o => !o && setDeleteSeason(null)}>
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
            <Button variant="destructive" disabled={seasonBusy} onClick={handleDeleteSeason}>
              {seasonBusy ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const seriesFormSchema = z.object({
  title:       z.string().min(1, 'Título requerido').max(200),
  description: z.string().max(1000).optional(),
  synopsis:    z.string().max(2000).optional(),
  year:        z.number().int().min(1900).max(2100).optional(),
})

// Defined at module level so React never remounts it on parent re-renders
function SeriesFields({ f }: { f: ReturnType<typeof useForm<SeriesForm>> }) {
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
            <Input type="number" placeholder="2024" {...field}
              value={field.value ?? ''}
              onChange={e => field.onChange(toInt(e.target.value))} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}

export default function SeriesPage() {
  const [allSeries, setAllSeries]   = useState<Series[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch]         = useState('')

  const [createOpen, setCreateOpen]     = useState(false)
  const [editSeries, setEditSeries]     = useState<Series | null>(null)
  const [deleteSeries, setDeleteSeries] = useState<Series | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createForm = useForm<SeriesForm>({ resolver: zodResolver(seriesFormSchema), defaultValues: { title: '', description: '', synopsis: '' } })
  const editForm   = useForm<SeriesForm>({ resolver: zodResolver(seriesFormSchema), defaultValues: { title: '', description: '', synopsis: '' } })
  useEffect(() => {
    if (editSeries) editForm.reset({
      title: editSeries.title,
      description: editSeries.description ?? '',
      synopsis:    editSeries.synopsis ?? '',
      year:        editSeries.year ?? undefined,
    })
  }, [editSeries, editForm])

  const fetchSeries = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const result = await contentService.getAllSeries({ page: p, limit: 20 } as never)
      setAllSeries(result.data)
      setTotalPages(result.meta.totalPages)
      setTotalCount(result.meta.total)
    } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchSeries(page) }, [fetchSeries, page])

  const displayed = search
    ? allSeries.filter(s => s.title.toLowerCase().includes(search.toLowerCase()))
    : allSeries

  const handleCreate = async (values: SeriesForm) => {
    setIsSubmitting(true)
    try {
      await contentService.createSeries(values)
      toast.success('Serie creada')
      setCreateOpen(false)
      createForm.reset({ title: '', description: '', synopsis: '' })
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Series</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? 'Cargando...' : `${totalCount} serie${totalCount !== 1 ? 's' : ''} en total`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva serie
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar series..."
          className="pl-9"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Tree list */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Tv2 className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Sin resultados para esa búsqueda' : 'No hay series todavía'}
            </p>
            {!search && (
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Crear la primera serie
              </Button>
            )}
          </div>
        ) : (
          displayed.map(s => (
            <SeriesCard
              key={s.id}
              series={s}
              onEdit={setEditSeries}
              onDelete={setDeleteSeries}
              onRefresh={() => fetchSeries(page)}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              Anterior
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
              Siguiente
            </Button>
          </div>
        </div>
      )}

      {/* Create series */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva serie</DialogTitle>
            <DialogDescription>Completa la información para crear una nueva serie.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)}>
              <SeriesFields f={createForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear serie'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit series */}
      <Dialog open={!!editSeries} onOpenChange={o => !o && setEditSeries(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar serie</DialogTitle>
            <DialogDescription>{editSeries?.title}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)}>
              <SeriesFields f={editForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditSeries(null)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete series */}
      <Dialog open={!!deleteSeries} onOpenChange={o => !o && setDeleteSeries(null)}>
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
