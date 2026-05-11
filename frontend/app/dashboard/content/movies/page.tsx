'use client'

import { useEffect, useState, useCallback } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus, Eye, EyeOff, Pencil, Trash2, Film } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { contentService } from '@/services/content.service'
import type { Movie } from '@/types'

import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

// Defined at module level so React sees a stable component type across renders
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
        <FormField control={f.control} name="duration" render={({ field }) => (
          <FormItem>
            <FormLabel>Duración (seg)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="5400"
                {...field}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
              />
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

const movieSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(200),
  director: z.string().max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  duration: z.number().int().min(1).optional(),
  description: z.string().max(1000).optional(),
  synopsis: z.string().max(2000).optional(),
})

type MovieForm = z.infer<typeof movieSchema>

export default function MoviesPage() {
  const [movies, setMovies] = useState<Movie[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [editMovie, setEditMovie] = useState<Movie | null>(null)
  const [deleteMovie, setDeleteMovie] = useState<Movie | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<MovieForm>({
    resolver: zodResolver(movieSchema),
    defaultValues: { title: '', director: '', description: '', synopsis: '' },
  })
  const editForm = useForm<MovieForm>({
    resolver: zodResolver(movieSchema),
    defaultValues: { title: '', director: '', description: '', synopsis: '' },
  })

  const fetchMovies = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const result = await contentService.getAllMovies({ page: p, limit: 20 } as never)
      setMovies(result.data)
      setTotalPages(result.meta.totalPages)
      setTotalCount(result.meta.total)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchMovies(page) }, [fetchMovies, page])

  useEffect(() => {
    if (editMovie) {
      editForm.reset({
        title: editMovie.title,
        director: editMovie.director ?? '',
        year: editMovie.year ?? undefined,
        duration: editMovie.duration ?? undefined,
        description: editMovie.description ?? '',
        synopsis: editMovie.synopsis ?? '',
      })
    }
  }, [editMovie, editForm])

  const handleCreate = async (values: MovieForm) => {
    setIsSubmitting(true)
    try {
      await contentService.createMovie(values)
      toast.success('Película creada correctamente')
      setCreateOpen(false)
      form.reset()
      fetchMovies(page)
    } catch {
      toast.error('Error al crear la película')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (values: MovieForm) => {
    if (!editMovie) return
    setIsSubmitting(true)
    try {
      await contentService.updateMovie(editMovie.id, values)
      toast.success('Película actualizada')
      setEditMovie(null)
      fetchMovies(page)
    } catch {
      toast.error('Error al actualizar la película')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteMovie) return
    setIsSubmitting(true)
    try {
      await contentService.deleteMovie(deleteMovie.id)
      toast.success('Película eliminada')
      setDeleteMovie(null)
      fetchMovies(page)
    } catch {
      toast.error('Error al eliminar la película')
    } finally {
      setIsSubmitting(false)
    }
  }

  const togglePublish = async (m: Movie) => {
    try {
      await contentService.updateMovie(m.id, { isPublished: !m.isPublished })
      toast.success(`Película ${!m.isPublished ? 'publicada' : 'despublicada'}`)
      fetchMovies(page)
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  const columns: ColumnDef<Movie>[] = [
    {
      accessorKey: 'title',
      header: 'Título',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title}</div>
          {row.original.director && (
            <div className="text-xs text-muted-foreground">Dir. {row.original.director}</div>
          )}
        </div>
      ),
    },
    {
      id: 'year',
      header: 'Año',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">{row.original.year ?? '—'}</span>
      ),
    },
    {
      id: 'duration',
      header: 'Duración',
      cell: ({ row }) => {
        const secs = row.original.duration
        if (!secs) return <span className="text-sm text-muted-foreground">—</span>
        const h = Math.floor(secs / 3600)
        const m = Math.floor((secs % 3600) / 60)
        return (
          <span className="text-sm text-muted-foreground">
            {h > 0 ? `${h}h ${m}m` : `${m}m`}
          </span>
        )
      },
    },
    {
      accessorKey: 'isPublished',
      header: 'Estado',
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? 'success' : 'outline'}>
          {getValue() ? 'Publicada' : 'Borrador'}
        </Badge>
      ),
    },
    {
      accessorKey: 'uploadStatus',
      header: 'Archivo',
      cell: ({ getValue }) => {
        const status = getValue() as string
        const labels: Record<string, string> = {
          PENDING: 'Sin archivo',
          PROCESSING: 'Procesando',
          TRANSCODING: 'Transcodificando',
          GENERATING_THUMBNAILS: 'Miniaturas',
          COMPLETED: 'Listo',
          FAILED: 'Error',
        }
        const variants: Record<string, 'outline' | 'secondary' | 'success' | 'destructive'> = {
          PENDING: 'outline',
          PROCESSING: 'secondary',
          TRANSCODING: 'secondary',
          GENERATING_THUMBNAILS: 'secondary',
          COMPLETED: 'success',
          FAILED: 'destructive',
        }
        return <Badge variant={variants[status] ?? 'outline'}>{labels[status] ?? status}</Badge>
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
        const m = row.original
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
              <DropdownMenuItem onClick={() => setEditMovie(m)}>
                <Pencil className="mr-2 h-4 w-4" />Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePublish(m)}>
                {m.isPublished ? (
                  <><EyeOff className="mr-2 h-4 w-4" />Despublicar</>
                ) : (
                  <><Eye className="mr-2 h-4 w-4" />Publicar</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteMovie(m)}>
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
          <h1 className="text-2xl font-bold tracking-tight">Películas</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona el catálogo de películas de la plataforma.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva película
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={movies}
        isLoading={isLoading}
        searchColumn="title"
        searchPlaceholder="Buscar películas..."
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        totalCount={totalCount}
      />

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nueva película</DialogTitle>
            <DialogDescription>Completa la información para registrar una nueva película.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)}>
              <MovieFormFields f={form} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear película'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editMovie} onOpenChange={(o) => !o && setEditMovie(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar película</DialogTitle>
            <DialogDescription>Modifica la información de {editMovie?.title}.</DialogDescription>
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
      <Dialog open={!!deleteMovie} onOpenChange={(o) => !o && setDeleteMovie(null)}>
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
