'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Play, Download, Search, Film, Loader2,
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
import type { Movie } from '@/types'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { MediaPlayer } from '@/components/ui/media-player'
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Textarea } from '@/components/ui/textarea'

// ─── Shared helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Sin archivo', PROCESSING: 'Procesando',
  TRANSCODING: 'Transcodificando', GENERATING_THUMBNAILS: 'Miniaturas',
  COMPLETED: 'Listo', FAILED: 'Error',
}
const STATUS_VARIANT: Record<string, 'outline' | 'secondary' | 'success' | 'destructive'> = {
  PENDING: 'outline', PROCESSING: 'secondary',
  TRANSCODING: 'secondary', GENERATING_THUMBNAILS: 'secondary',
  COMPLETED: 'success', FAILED: 'destructive',
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const movieSchema = z.object({
  title:       z.string().min(1, 'Título requerido').max(200),
  director:    z.string().max(100).optional(),
  year:        z.number().int().min(1900).max(2100).optional(),
  duration:    z.number().int().min(1).optional(),
  description: z.string().max(1000).optional(),
  synopsis:    z.string().max(2000).optional(),
})
type MovieForm = z.infer<typeof movieSchema>

// ─── Form fields (module-level — never remounts on parent re-render) ──────────

function MovieFormFields({ f }: { f: ReturnType<typeof useForm<MovieForm>> }) {
  return (
    <div className="grid gap-4 py-4">
      <FormField control={f.control} name="title" render={({ field }) => (
        <FormItem>
          <FormLabel>Título *</FormLabel>
          <FormControl><Input placeholder="Título de la película" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={f.control} name="director" render={({ field }) => (
        <FormItem>
          <FormLabel>Director</FormLabel>
          <FormControl><Input placeholder="Nombre del director" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={f.control} name="year" render={({ field }) => (
          <FormItem>
            <FormLabel>Año</FormLabel>
            <FormControl>
              <Input type="number" placeholder="2024" {...field}
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={f.control} name="duration" render={({ field }) => (
          <FormItem>
            <FormLabel>Duración (seg)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="5400" {...field}
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
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
    </div>
  )
}

// ─── Movie card ───────────────────────────────────────────────────────────────

interface MovieCardProps {
  movie:    Movie
  onEdit:   (m: Movie) => void
  onDelete: (m: Movie) => void
  onPlay:   (m: Movie) => void
}

function MovieCard({ movie, onEdit, onDelete, onPlay }: MovieCardProps) {
  const ready  = movie.uploadStatus === 'COMPLETED'
  const canPlay = ready && !!(movie.hlsUrl ?? movie.videoUrl)
  const canDl   = ready && !!movie.videoUrl

  const handleDownload = () => {
    if (!movie.videoUrl) return
    downloadService.downloadFile(movie.videoUrl, `${movie.title}.mp4`)
  }

  return (
    <div className="flex items-center gap-4 border rounded-xl px-4 py-3.5 hover:bg-muted/20 transition-colors">
      {/* Thumbnail */}
      <div className="h-14 w-24 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center">
        {movie.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={toStorageUrl(movie.thumbnailUrl)} alt={movie.title}
            className="h-full w-full object-cover" />
        ) : (
          <Film className="h-6 w-6 text-muted-foreground/40" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{movie.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {movie.director ? `Dir. ${movie.director}` : ''}
          {movie.director && movie.year ? ' · ' : ''}
          {movie.year ?? ''}
          {movie.duration ? ` · ${formatDuration(movie.duration)}` : ''}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge variant={STATUS_VARIANT[movie.uploadStatus] ?? 'outline'} className="text-xs h-4 px-1.5">
            {STATUS_LABEL[movie.uploadStatus] ?? movie.uploadStatus}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(movie.createdAt), 'dd MMM yyyy', { locale: es })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!canPlay}
          title="Ver película" onClick={() => canPlay && onPlay(movie)}>
          <Play className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!canDl}
          title="Descargar película" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8"
          title="Editar película" onClick={() => onEdit(movie)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
          title="Eliminar película" onClick={() => onDelete(movie)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function MoviesPage() {
  const [movies, setMovies]       = useState<Movie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch]       = useState('')

  const [createOpen, setCreateOpen]     = useState(false)
  const [editMovie, setEditMovie]       = useState<Movie | null>(null)
  const [deleteMovie, setDeleteMovie]   = useState<Movie | null>(null)
  const [player, setPlayer]             = useState<{ title: string; src: string; hlsSrc?: string; poster?: string } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createForm = useForm<MovieForm>({
    resolver: zodResolver(movieSchema),
    defaultValues: { title: '', director: '', description: '', synopsis: '' },
  })
  const editForm = useForm<MovieForm>({
    resolver: zodResolver(movieSchema),
    defaultValues: { title: '', director: '', description: '', synopsis: '' },
  })
  useEffect(() => {
    if (editMovie) editForm.reset({
      title: editMovie.title, director: editMovie.director ?? '',
      year: editMovie.year ?? undefined, duration: editMovie.duration ?? undefined,
      description: editMovie.description ?? '', synopsis: editMovie.synopsis ?? '',
    })
  }, [editMovie, editForm])

  const fetchMovies = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const result = await contentService.getAllMovies({ page: p, limit: 20 } as never)
      setMovies(result.data)
      setTotalPages(result.meta.totalPages)
      setTotalCount(result.meta.total)
    } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchMovies(page) }, [fetchMovies, page])

  const displayed = search
    ? movies.filter(m => m.title.toLowerCase().includes(search.toLowerCase()))
    : movies

  const handleCreate = async (values: MovieForm) => {
    setIsSubmitting(true)
    try {
      await contentService.createMovie(values)
      toast.success('Película creada')
      setCreateOpen(false)
      createForm.reset()
      fetchMovies(page)
    } catch { toast.error('Error al crear la película') }
    finally { setIsSubmitting(false) }
  }

  const handleUpdate = async (values: MovieForm) => {
    if (!editMovie) return
    setIsSubmitting(true)
    try {
      await contentService.updateMovie(editMovie.id, values)
      toast.success('Película actualizada')
      setEditMovie(null)
      fetchMovies(page)
    } catch { toast.error('Error al actualizar la película') }
    finally { setIsSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!deleteMovie) return
    setIsSubmitting(true)
    try {
      await contentService.deleteMovie(deleteMovie.id)
      toast.success('Película eliminada')
      setDeleteMovie(null)
      fetchMovies(page)
    } catch { toast.error('Error al eliminar la película') }
    finally { setIsSubmitting(false) }
  }

  const handlePlay = (m: Movie) => setPlayer({
    title: m.title, src: toStorageUrl(m.videoUrl) ?? '',
    hlsSrc: toStorageUrl(m.hlsUrl), poster: toStorageUrl(m.thumbnailUrl) ?? undefined,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Películas</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? 'Cargando...' : `${totalCount} película${totalCount !== 1 ? 's' : ''} en total`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva película
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar películas..." className="pl-9"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Film className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Sin resultados para esa búsqueda' : 'No hay películas todavía'}
            </p>
            {!search && (
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Crear la primera película
              </Button>
            )}
          </div>
        ) : (
          displayed.map(m => (
            <MovieCard key={m.id} movie={m}
              onEdit={setEditMovie} onDelete={setDeleteMovie} onPlay={handlePlay} />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-sm text-muted-foreground">Página {page} de {totalPages}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Anterior</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Siguiente</Button>
          </div>
        </div>
      )}

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

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva película</DialogTitle>
            <DialogDescription>Completa la información para registrar una nueva película.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)}>
              <MovieFormFields f={createForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear película'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editMovie} onOpenChange={o => !o && setEditMovie(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar película</DialogTitle>
            <DialogDescription>{editMovie?.title}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)}>
              <MovieFormFields f={editForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditMovie(null)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteMovie} onOpenChange={o => !o && setDeleteMovie(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar película</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deleteMovie?.title}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteMovie(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={isSubmitting} onClick={handleDelete}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
