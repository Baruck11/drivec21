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
import type { Program } from '@/types'

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
              <Input
                type="number"
                placeholder="3600"
                {...field}
                onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
              />
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

const programSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(200),
  category: z.string().max(100).optional(),
  duration: z.number().int().min(1).optional(),
  broadcastDate: z.string().optional(),
  description: z.string().max(1000).optional(),
})

type ProgramForm = z.infer<typeof programSchema>

export default function ProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [editProgram, setEditProgram] = useState<Program | null>(null)
  const [deleteProgram, setDeleteProgram] = useState<Program | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<ProgramForm>({
    resolver: zodResolver(programSchema),
    defaultValues: { title: '', category: '', description: '' },
  })
  const editForm = useForm<ProgramForm>({
    resolver: zodResolver(programSchema),
    defaultValues: { title: '', category: '', description: '' },
  })

  const fetchPrograms = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const result = await contentService.getAllPrograms({ page: p, limit: 20 } as never)
      setPrograms(result.data)
      setTotalPages(result.meta.totalPages)
      setTotalCount(result.meta.total)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPrograms(page) }, [fetchPrograms, page])

  useEffect(() => {
    if (editProgram) {
      editForm.reset({
        title: editProgram.title,
        category: editProgram.category ?? '',
        duration: editProgram.duration ?? undefined,
        broadcastDate: editProgram.broadcastDate
          ? editProgram.broadcastDate.slice(0, 16)
          : '',
        description: editProgram.description ?? '',
      })
    }
  }, [editProgram, editForm])

  const handleCreate = async (values: ProgramForm) => {
    setIsSubmitting(true)
    try {
      await contentService.createProgram(values)
      toast.success('Programa creado correctamente')
      setCreateOpen(false)
      form.reset()
      fetchPrograms(page)
    } catch {
      toast.error('Error al crear el programa')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (values: ProgramForm) => {
    if (!editProgram) return
    setIsSubmitting(true)
    try {
      await contentService.updateProgram(editProgram.id, values)
      toast.success('Programa actualizado')
      setEditProgram(null)
      fetchPrograms(page)
    } catch {
      toast.error('Error al actualizar el programa')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteProgram) return
    setIsSubmitting(true)
    try {
      await contentService.deleteProgram(deleteProgram.id)
      toast.success('Programa eliminado')
      setDeleteProgram(null)
      fetchPrograms(page)
    } catch {
      toast.error('Error al eliminar el programa')
    } finally {
      setIsSubmitting(false)
    }
  }

  const togglePublish = async (p: Program) => {
    try {
      await contentService.updateProgram(p.id, { isPublished: !p.isPublished })
      toast.success(`Programa ${!p.isPublished ? 'publicado' : 'despublicado'}`)
      fetchPrograms(page)
    } catch {
      toast.error('Error al cambiar estado')
    }
  }

  const columns: ColumnDef<Program>[] = [
    {
      accessorKey: 'title',
      header: 'Título',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.title}</div>
          {row.original.category && (
            <div className="text-xs text-muted-foreground">{row.original.category}</div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'broadcastDate',
      header: 'Transmisión',
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        return (
          <span className="text-sm text-muted-foreground">
            {val
              ? format(new Date(val), "dd MMM yyyy 'a las' HH:mm", { locale: es })
              : '—'}
          </span>
        )
      },
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
        const prog = row.original
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
              <DropdownMenuItem onClick={() => setEditProgram(prog)}>
                <Pencil className="mr-2 h-4 w-4" />Editar
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => togglePublish(prog)}>
                {prog.isPublished ? (
                  <><EyeOff className="mr-2 h-4 w-4" />Despublicar</>
                ) : (
                  <><Eye className="mr-2 h-4 w-4" />Publicar</>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setDeleteProgram(prog)}>
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
          <h1 className="text-2xl font-bold tracking-tight">Programas</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los programas y transmisiones de la plataforma.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo programa
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={programs}
        isLoading={isLoading}
        searchColumn="title"
        searchPlaceholder="Buscar programas..."
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        totalCount={totalCount}
      />

      {/* Create */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Nuevo programa</DialogTitle>
            <DialogDescription>Completa la información para registrar un nuevo programa.</DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleCreate)}>
              <ProgramFormFields f={form} />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>{isSubmitting ? 'Creando...' : 'Crear programa'}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit */}
      <Dialog open={!!editProgram} onOpenChange={(o) => !o && setEditProgram(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar programa</DialogTitle>
            <DialogDescription>Modifica la información de {editProgram?.title}.</DialogDescription>
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
      <Dialog open={!!deleteProgram} onOpenChange={(o) => !o && setDeleteProgram(null)}>
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
