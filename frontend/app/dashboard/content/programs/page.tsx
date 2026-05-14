'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Plus, Pencil, Trash2, Play, Download, Search, Video,
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
import type { Program } from '@/types'

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

const programSchema = z.object({
  title:         z.string().min(1, 'Título requerido').max(200),
  category:      z.string().max(100).optional(),
  duration:      z.number().int().min(1).optional(),
  broadcastDate: z.string().optional(),
  description:   z.string().max(1000).optional(),
})
type ProgramForm = z.infer<typeof programSchema>

// ─── Form fields (module-level — never remounts on parent re-render) ──────────

function ProgramFormFields({ f }: { f: ReturnType<typeof useForm<ProgramForm>> }) {
  return (
    <div className="grid gap-4 py-4">
      <FormField control={f.control} name="title" render={({ field }) => (
        <FormItem>
          <FormLabel>Título *</FormLabel>
          <FormControl><Input placeholder="Título del programa" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <div className="grid grid-cols-2 gap-4">
        <FormField control={f.control} name="category" render={({ field }) => (
          <FormItem>
            <FormLabel>Categoría</FormLabel>
            <FormControl><Input placeholder="Ej: Noticias, Deportes..." {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={f.control} name="duration" render={({ field }) => (
          <FormItem>
            <FormLabel>Duración (seg)</FormLabel>
            <FormControl>
              <Input type="number" placeholder="3600" {...field}
                value={field.value ?? ''}
                onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <FormField control={f.control} name="broadcastDate" render={({ field }) => (
        <FormItem>
          <FormLabel>Fecha de transmisión</FormLabel>
          <FormControl>
            <Input type="datetime-local" {...field} value={field.value ?? ''} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={f.control} name="description" render={({ field }) => (
        <FormItem>
          <FormLabel>Descripción</FormLabel>
          <FormControl><Textarea placeholder="Descripción del programa..." rows={3} {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}

// ─── Program card ─────────────────────────────────────────────────────────────

interface ProgramCardProps {
  program:  Program
  onEdit:   (p: Program) => void
  onDelete: (p: Program) => void
  onPlay:   (p: Program) => void
}

function ProgramCard({ program, onEdit, onDelete, onPlay }: ProgramCardProps) {
  const ready   = program.uploadStatus === 'COMPLETED'
  const canPlay = ready && !!(program.hlsUrl ?? program.videoUrl)
  const canDl   = ready && !!program.videoUrl

  const handleDownload = () => {
    if (!program.videoUrl) return
    downloadService.downloadFile(program.videoUrl, `${program.title}.mp4`)
  }

  return (
    <div className="flex items-center gap-4 border rounded-xl px-4 py-3.5 hover:bg-muted/20 transition-colors">
      {/* Thumbnail */}
      <div className="h-14 w-24 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center">
        {program.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={toStorageUrl(program.thumbnailUrl)} alt={program.title}
            className="h-full w-full object-cover" />
        ) : (
          <Video className="h-6 w-6 text-muted-foreground/40" />
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-sm truncate">{program.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          {program.category ?? ''}
          {program.category && program.broadcastDate ? ' · ' : ''}
          {program.broadcastDate
            ? format(new Date(program.broadcastDate), "dd MMM yyyy 'a las' HH:mm", { locale: es })
            : ''}
          {program.duration ? ` · ${formatDuration(program.duration)}` : ''}
        </p>
        <div className="flex items-center gap-2 mt-1.5">
          <Badge variant={STATUS_VARIANT[program.uploadStatus] ?? 'outline'} className="text-xs h-4 px-1.5">
            {STATUS_LABEL[program.uploadStatus] ?? program.uploadStatus}
          </Badge>
          <span className="text-xs text-muted-foreground">
            {format(new Date(program.createdAt), 'dd MMM yyyy', { locale: es })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 shrink-0">
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!canPlay}
          title="Ver programa" onClick={() => canPlay && onPlay(program)}>
          <Play className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8" disabled={!canDl}
          title="Descargar programa" onClick={handleDownload}>
          <Download className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8"
          title="Editar programa" onClick={() => onEdit(program)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive"
          title="Eliminar programa" onClick={() => onDelete(program)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgramsPage() {
  const [programs, setPrograms]   = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [search, setSearch]       = useState('')

  const [createOpen, setCreateOpen]       = useState(false)
  const [editProgram, setEditProgram]     = useState<Program | null>(null)
  const [deleteProgram, setDeleteProgram] = useState<Program | null>(null)
  const [player, setPlayer]               = useState<{ title: string; src: string; hlsSrc?: string; poster?: string } | null>(null)
  const [isSubmitting, setIsSubmitting]   = useState(false)

  const createForm = useForm<ProgramForm>({
    resolver: zodResolver(programSchema),
    defaultValues: { title: '', category: '', description: '' },
  })
  const editForm = useForm<ProgramForm>({
    resolver: zodResolver(programSchema),
    defaultValues: { title: '', category: '', description: '' },
  })
  useEffect(() => {
    if (editProgram) editForm.reset({
      title: editProgram.title, category: editProgram.category ?? '',
      duration: editProgram.duration ?? undefined,
      broadcastDate: editProgram.broadcastDate ? editProgram.broadcastDate.slice(0, 16) : '',
      description: editProgram.description ?? '',
    })
  }, [editProgram, editForm])

  const fetchPrograms = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const result = await contentService.getAllPrograms({ page: p, limit: 20 } as never)
      setPrograms(result.data)
      setTotalPages(result.meta.totalPages)
      setTotalCount(result.meta.total)
    } finally { setIsLoading(false) }
  }, [])

  useEffect(() => { fetchPrograms(page) }, [fetchPrograms, page])

  const displayed = search
    ? programs.filter(p => p.title.toLowerCase().includes(search.toLowerCase()))
    : programs

  const handleCreate = async (values: ProgramForm) => {
    setIsSubmitting(true)
    try {
      await contentService.createProgram(values)
      toast.success('Programa creado')
      setCreateOpen(false)
      createForm.reset()
      fetchPrograms(page)
    } catch { toast.error('Error al crear el programa') }
    finally { setIsSubmitting(false) }
  }

  const handleUpdate = async (values: ProgramForm) => {
    if (!editProgram) return
    setIsSubmitting(true)
    try {
      await contentService.updateProgram(editProgram.id, values)
      toast.success('Programa actualizado')
      setEditProgram(null)
      fetchPrograms(page)
    } catch { toast.error('Error al actualizar el programa') }
    finally { setIsSubmitting(false) }
  }

  const handleDelete = async () => {
    if (!deleteProgram) return
    setIsSubmitting(true)
    try {
      await contentService.deleteProgram(deleteProgram.id)
      toast.success('Programa eliminado')
      setDeleteProgram(null)
      fetchPrograms(page)
    } catch { toast.error('Error al eliminar el programa') }
    finally { setIsSubmitting(false) }
  }

  const handlePlay = (p: Program) => setPlayer({
    title: p.title, src: toStorageUrl(p.videoUrl) ?? '',
    hlsSrc: toStorageUrl(p.hlsUrl), poster: toStorageUrl(p.thumbnailUrl) ?? undefined,
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Programas</h1>
          <p className="text-muted-foreground text-sm">
            {isLoading ? 'Cargando...' : `${totalCount} programa${totalCount !== 1 ? 's' : ''} en total`}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo programa
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Buscar programas..." className="pl-9"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)
        ) : displayed.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Video className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {search ? 'Sin resultados para esa búsqueda' : 'No hay programas todavía'}
            </p>
            {!search && (
              <Button className="mt-4" size="sm" onClick={() => setCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Crear el primer programa
              </Button>
            )}
          </div>
        ) : (
          displayed.map(p => (
            <ProgramCard key={p.id} program={p}
              onEdit={setEditProgram} onDelete={setDeleteProgram} onPlay={handlePlay} />
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
            <DialogTitle>Nuevo programa</DialogTitle>
            <DialogDescription>Completa la información para registrar un nuevo programa.</DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)}>
              <ProgramFormFields f={createForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear programa'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editProgram} onOpenChange={o => !o && setEditProgram(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar programa</DialogTitle>
            <DialogDescription>{editProgram?.title}</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)}>
              <ProgramFormFields f={editForm} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setEditProgram(null)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Guardando...' : 'Guardar'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <Dialog open={!!deleteProgram} onOpenChange={o => !o && setDeleteProgram(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar programa</DialogTitle>
            <DialogDescription>
              ¿Eliminar <strong>{deleteProgram?.title}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteProgram(null)}>Cancelar</Button>
            <Button variant="destructive" disabled={isSubmitting} onClick={handleDelete}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
