'use client'

import { useEffect, useState, useCallback } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus, Eye, EyeOff, Pencil, Trash2, Layers, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { contentService } from '@/services/content.service'
import type { Series, Season } from '@/types'

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

// ─── Seasons management dialog ────────────────────────────────────────────────

function SeasonsDialog({
  series,
  onClose,
}: {
  series: Series
  onClose: () => void
}) {
  const [seasons, setSeasons] = useState<Season[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [editSeason, setEditSeason] = useState<Season | null>(null)
  const [deleteSeason, setDeleteSeason] = useState<Season | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createForm = useForm<SeasonForm>({
    resolver: zodResolver(seasonSchema),
    defaultValues: { title: '', description: '' },
  })
  const editForm = useForm<SeasonForm>({
    resolver: zodResolver(seasonSchema),
    defaultValues: { title: '', description: '' },
  })

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

  const handleCreate = async (values: SeasonForm) => {
    setIsSubmitting(true)
    try {
      await contentService.createSeason(series.id, values)
      toast.success('Temporada creada')
      setCreateOpen(false)
      createForm.reset({ title: '', description: '' })
      fetchSeasons()
    } catch {
      toast.error('Error al crear la temporada')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (values: SeasonForm) => {
    if (!editSeason) return
    setIsSubmitting(true)
    try {
      await contentService.updateSeason(editSeason.id, values)
      toast.success('Temporada actualizada')
      setEditSeason(null)
      fetchSeasons()
    } catch {
      toast.error('Error al actualizar la temporada')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteSeason) return
    setIsSubmitting(true)
    try {
      await contentService.deleteSeason(deleteSeason.id)
      toast.success('Temporada eliminada')
      setDeleteSeason(null)
      fetchSeasons()
    } catch {
      toast.error('Error al eliminar la temporada')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <>
      {/* Main seasons dialog */}
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="h-4 w-4" />
              Temporadas de {series.title}
            </DialogTitle>
            <DialogDescription>
              Gestiona las temporadas de la serie. Los episodios se añaden desde la sección de Episodios.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 max-h-[55vh] overflow-y-auto">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-6">Cargando temporadas...</p>
            ) : seasons.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Esta serie no tiene temporadas todavía.
              </p>
            ) : (
              seasons.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div>
                    <div className="font-medium text-sm">
                      T{s.number} — {s.title}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {s._count?.episodes ?? 0} episodios
                      {s.year ? ` · ${s.year}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => setEditSeason(s)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => setDeleteSeason(s)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter className="justify-between sm:justify-between">
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva temporada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create season */}
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

      {/* Edit season */}
      <Dialog open={!!editSeason} onOpenChange={(o) => !o && setEditSeason(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar temporada</DialogTitle>
            <DialogDescription>Modifica T{editSeason?.number} — {editSeason?.title}</DialogDescription>
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

      {/* Delete season */}
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
            <Button variant="destructive" disabled={isSubmitting} onClick={handleDelete}>
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
  const [series, setSeries] = useState<Series[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [editSeries, setEditSeries] = useState<Series | null>(null)
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
    } catch {
      toast.error('Error al crear la serie')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (values: SeriesForm) => {
    if (!editSeries) return
    setIsSubmitting(true)
    try {
      await contentService.updateSeries(editSeries.id, values)
      toast.success('Serie actualizada')
      setEditSeries(null)
      fetchSeries(page)
    } catch {
      toast.error('Error al actualizar la serie')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteSeries) return
    setIsSubmitting(true)
    try {
      await contentService.deleteSeries(deleteSeries.id)
      toast.success('Serie eliminada')
      setDeleteSeries(null)
      fetchSeries(page)
    } catch {
      toast.error('Error al eliminar la serie')
    } finally {
      setIsSubmitting(false)
    }
  }

  const togglePublish = async (s: Series) => {
    try {
      await contentService.publishSeries(s.id, !s.isPublished)
      toast.success(`Serie ${!s.isPublished ? 'publicada' : 'despublicada'}`)
      fetchSeries(page)
    } catch {
      toast.error('Error al cambiar estado')
    }
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
      accessorKey: 'isPublished',
      header: 'Estado',
      cell: ({ getValue }) => (
        <Badge variant={getValue() ? 'success' : 'outline'}>
          {getValue() ? 'Publicada' : 'Borrador'}
        </Badge>
      ),
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
              <DropdownMenuItem onClick={() => togglePublish(s)}>
                {s.isPublished ? (
                  <><EyeOff className="mr-2 h-4 w-4" />Despublicar</>
                ) : (
                  <><Eye className="mr-2 h-4 w-4" />Publicar</>
                )}
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
          <p className="text-muted-foreground text-sm">
            Gestiona las series y sus temporadas.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nueva serie
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

      {/* Seasons management */}
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
