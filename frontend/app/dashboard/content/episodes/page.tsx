'use client'

import { useEffect, useState, useCallback } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus, Eye, EyeOff, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { contentService } from '@/services/content.service'
import type { Series, Season, Episode } from '@/types'

import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty-state'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Layers } from 'lucide-react'

const episodeSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(200),
  number: z.number().int().min(1, 'Número requerido'),
  description: z.string().max(1000).optional(),
  duration: z.number().int().min(1).optional(),
})

type EpisodeForm = z.infer<typeof episodeSchema>

// Defined at module level so React sees a stable component type across renders
function EpisodeFormFields({ f }: { f: ReturnType<typeof useForm<EpisodeForm>> }) {
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
        <FormField control={f.control} name="duration" render={({ field }) => (
          <FormItem>
            <FormLabel>Duración (seg)</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="2700"
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
          <FormControl><Input placeholder="Título del episodio" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={f.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel>Descripción</FormLabel>
          <FormControl><Textarea placeholder="Descripción del episodio..." rows={3} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}

export default function EpisodesPage() {
  const [allSeries, setAllSeries] = useState<Series[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [selectedSeriesId, setSelectedSeriesId] = useState<string>('')
  const [selectedSeasonId, setSelectedSeasonId] = useState<string>('')
  const [isLoadingSeasons, setIsLoadingSeasons] = useState(false)
  const [isLoadingEpisodes, setIsLoadingEpisodes] = useState(false)

  const [createOpen, setCreateOpen] = useState(false)
  const [editEpisode, setEditEpisode] = useState<Episode | null>(null)
  const [deleteEpisode, setDeleteEpisode] = useState<Episode | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<EpisodeForm>({
    resolver: zodResolver(episodeSchema),
    defaultValues: { title: '', description: '' },
  })
  const editForm = useForm<EpisodeForm>({
    resolver: zodResolver(episodeSchema),
    defaultValues: { title: '', description: '' },
  })

  useEffect(() => {
    contentService.getAllSeries({ limit: 100 } as never).then((r) => setAllSeries(r.data))
  }, [])

  useEffect(() => {
    if (!selectedSeriesId) { setSeasons([]); setSelectedSeasonId(''); return }
    setIsLoadingSeasons(true)
    contentService.getSeasonsBySeriesId(selectedSeriesId)
      .then(setSeasons)
      .finally(() => setIsLoadingSeasons(false))
  }, [selectedSeriesId])

  const fetchEpisodes = useCallback(async (seasonId: string) => {
    if (!seasonId) { setEpisodes([]); return }
    setIsLoadingEpisodes(true)
    try {
      const data = await contentService.getEpisodesBySeasonId(seasonId)
      setEpisodes(data)
    } finally {
      setIsLoadingEpisodes(false)
    }
  }, [])

  useEffect(() => { fetchEpisodes(selectedSeasonId) }, [fetchEpisodes, selectedSeasonId])

  useEffect(() => {
    if (editEpisode) {
      editForm.reset({
        title: editEpisode.title,
        number: editEpisode.number,
        description: editEpisode.description ?? '',
        duration: editEpisode.duration ?? undefined,
      })
    }
  }, [editEpisode, editForm])

  const handleCreate = async (values: EpisodeForm) => {
    if (!selectedSeasonId) return
    setIsSubmitting(true)
    try {
      await contentService.createEpisode(selectedSeasonId, values)
      toast.success('Episodio creado correctamente')
      setCreateOpen(false)
      form.reset({ title: '', description: '' })
      fetchEpisodes(selectedSeasonId)
    } catch {
      toast.error('Error al crear el episodio')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (values: EpisodeForm) => {
    if (!editEpisode) return
    setIsSubmitting(true)
    try {
      await contentService.updateEpisode(editEpisode.id, values)
      toast.success('Episodio actualizado')
      setEditEpisode(null)
      fetchEpisodes(selectedSeasonId)
    } catch {
      toast.error('Error al actualizar el episodio')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteEpisode) return
    setIsSubmitting(true)
    try {
      await contentService.deleteEpisode(deleteEpisode.id)
      toast.success('Episodio eliminado')
      setDeleteEpisode(null)
      fetchEpisodes(selectedSeasonId)
    } catch {
      toast.error('Error al eliminar el episodio')
    } finally {
      setIsSubmitting(false)
    }
  }

  const togglePublish = async (ep: Episode) => {
    try {
      await contentService.updateEpisode(ep.id, { isPublished: !ep.isPublished })
      toast.success(`Episodio ${!ep.isPublished ? 'publicado' : 'despublicado'}`)
      fetchEpisodes(selectedSeasonId)
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  const columns: ColumnDef<Episode>[] = [
    {
      id: 'episode',
      header: 'Episodio',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">
            {row.original.number}. {row.original.title}
          </div>
          {row.original.description && (
            <div className="text-xs text-muted-foreground line-clamp-1">{row.original.description}</div>
          )}
        </div>
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
          {getValue() ? 'Publicado' : 'Borrador'}
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
      header: 'Creado',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(getValue() as string), 'dd MMM yyyy', { locale: es })}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => {
        const ep = row.original
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
              <DropdownMenuItem onClick={() => setEditEpisode(ep)}>
                <Pencil className="mr-2 h-4 w-4" />Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePublish(ep)}>
                {ep.isPublished ? (
                  <><EyeOff className="mr-2 h-4 w-4" />Despublicar</>
                ) : (
                  <><Eye className="mr-2 h-4 w-4" />Publicar</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteEpisode(ep)}>
                <Trash2 className="mr-2 h-4 w-4" />Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  const selectedSeries = allSeries.find((s) => s.id === selectedSeriesId)
  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Episodios</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los episodios por serie y temporada.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          disabled={!selectedSeasonId}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nuevo episodio
        </Button>
      </div>

      {/* Series / Season selectors */}
      <div className="flex gap-4">
        <div className="w-64">
          <Select
            value={selectedSeriesId}
            onValueChange={(val) => { setSelectedSeriesId(val); setSelectedSeasonId('') }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar serie..." />
            </SelectTrigger>
            <SelectContent>
              {allSeries.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-64">
          <Select
            value={selectedSeasonId}
            onValueChange={setSelectedSeasonId}
            disabled={!selectedSeriesId || isLoadingSeasons}
          >
            <SelectTrigger>
              <SelectValue placeholder={isLoadingSeasons ? 'Cargando...' : 'Seleccionar temporada...'} />
            </SelectTrigger>
            <SelectContent>
              {seasons.map((s) => (
                <SelectItem key={s.id} value={s.id}>T{s.number} — {s.title}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {!selectedSeasonId ? (
        <EmptyState
          icon={Layers}
          title="Selecciona una temporada"
          description={
            selectedSeriesId
              ? 'Elige una temporada para ver sus episodios.'
              : 'Primero selecciona una serie y luego una temporada.'
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={episodes}
          isLoading={isLoadingEpisodes}
          searchColumn="title"
          searchPlaceholder="Buscar episodios..."
        />
      )}

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo episodio</DialogTitle>
            <DialogDescription>
              {selectedSeries && selectedSeason
                ? `${selectedSeries.title} — T${selectedSeason.number}: ${selectedSeason.title}`
                : 'Completa la información del episodio.'}
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)}>
              <EpisodeFormFields f={form} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear episodio'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editEpisode} onOpenChange={(o) => !o && setEditEpisode(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar episodio</DialogTitle>
            <DialogDescription>Modifica la información de {editEpisode?.title}.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)}>
              <EpisodeFormFields f={editForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditEpisode(null)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
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
            <Button variant="destructive" disabled={isSubmitting} onClick={handleDelete}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
