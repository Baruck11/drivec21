'use client'

import { useEffect, useState, useCallback } from 'react'
import { Plus, Shield, Trash2, Search, Users } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

import { permissionService } from '@/services/permission.service'
import { userService } from '@/services/user.service'
import { contentService } from '@/services/content.service'
import type { ContentPermission, User, Series, Movie, Program } from '@/types'
import { getRoleLabel } from '@/lib/utils'

import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { ColumnDef } from '@tanstack/react-table'

const grantSchema = z.object({
  userId: z.string().min(1, 'Usuario requerido'),
  contentType: z.enum(['SERIES', 'MOVIE', 'PROGRAM', 'SEASON', 'EPISODE']),
  contentId: z.string().min(1, 'Contenido requerido'),
  canStream: z.boolean().default(true),
  canDownload: z.boolean().default(false),
})

type GrantForm = z.infer<typeof grantSchema>

export default function PermissionsPage() {
  const [selectedUser, setSelectedUser] = useState<string>('')
  const [permissions, setPermissions] = useState<ContentPermission[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [series, setSeries] = useState<Series[]>([])
  const [movies, setMovies] = useState<Movie[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [grantOpen, setGrantOpen] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [search, setSearch] = useState('')

  const form = useForm<GrantForm>({
    resolver: zodResolver(grantSchema),
    defaultValues: { canStream: true, canDownload: false },
  })

  const contentType = form.watch('contentType')

  useEffect(() => {
    Promise.all([
      userService.findAll({ role: 'BROADCASTER_VIEWER' as never, limit: 100 }),
      contentService.getAllSeries({ limit: 100 } as never),
      contentService.getAllMovies({ limit: 100 } as never),
      contentService.getAllPrograms({ limit: 100 } as never),
    ]).then(([u, s, m, p]) => {
      setUsers(u.data)
      setSeries(s.data)
      setMovies(m.data)
      setPrograms(p.data)
    })
  }, [])

  const fetchPermissions = useCallback(async (userId: string) => {
    if (!userId) return
    setIsLoading(true)
    try {
      const perms = await permissionService.getUserPermissions(userId)
      setPermissions(perms)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchPermissions(selectedUser) }, [selectedUser, fetchPermissions])

  const handleGrant = async (values: GrantForm) => {
    setIsSubmitting(true)
    try {
      const contentIdField: Record<string, string> = {
        SERIES: 'seriesId',
        MOVIE: 'movieId',
        PROGRAM: 'programId',
        SEASON: 'seasonId',
        EPISODE: 'episodeId',
      }

      await permissionService.grantPermission({
        userId: values.userId,
        contentType: values.contentType,
        permissionLevel: values.contentType as never,
        [contentIdField[values.contentType]]: values.contentId,
        canStream: values.canStream,
        canDownload: values.canDownload,
      })

      toast.success('Permiso otorgado correctamente')
      setGrantOpen(false)
      form.reset()
      if (selectedUser) fetchPermissions(selectedUser)
    } catch {
      toast.error('Error al otorgar permiso')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      await permissionService.revokePermission(id)
      toast.success('Permiso revocado')
      setPermissions((prev) => prev.filter((p) => p.id !== id))
    } catch {
      toast.error('Error al revocar permiso')
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      search === '' ||
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  )

  const contentOptions: Record<string, { label: string; id: string }[]> = {
    SERIES: series.map((s) => ({ label: s.title, id: s.id })),
    MOVIE: movies.map((m) => ({ label: m.title, id: m.id })),
    PROGRAM: programs.map((p) => ({ label: p.title, id: p.id })),
  }

  const columns: ColumnDef<ContentPermission>[] = [
    {
      id: 'content',
      header: 'Contenido',
      cell: ({ row }) => {
        const p = row.original
        const title =
          p.series?.title ?? p.movie?.title ?? p.program?.title ?? `${p.contentType} ${p.seriesId ?? p.movieId ?? p.programId ?? ''}`
        return (
          <div>
            <div className="font-medium text-sm">{title}</div>
            <div className="text-xs text-muted-foreground capitalize">{p.contentType.toLowerCase()}</div>
          </div>
        )
      },
    },
    {
      id: 'access',
      header: 'Acceso',
      cell: ({ row }) => (
        <div className="flex gap-2">
          {row.original.canStream && <Badge variant="success">Streaming</Badge>}
          {row.original.canDownload && <Badge variant="info">Descarga</Badge>}
        </div>
      ),
    },
    {
      accessorKey: 'expiresAt',
      header: 'Expira',
      cell: ({ getValue }) => {
        const val = getValue() as string | null
        return (
          <span className="text-sm text-muted-foreground">
            {val ? format(new Date(val), 'dd MMM yyyy', { locale: es }) : 'Sin vencimiento'}
          </span>
        )
      },
    },
    {
      accessorKey: 'grantedAt',
      header: 'Otorgado',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">
          {format(new Date(getValue() as string), 'dd MMM yyyy', { locale: es })}
        </span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-destructive hover:text-destructive"
          onClick={() => handleRevoke(row.original.id)}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Permisos</h1>
          <p className="text-muted-foreground text-sm">
            Asigna y revoca acceso al contenido de las televisoras.
          </p>
        </div>
        <Button onClick={() => setGrantOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Otorgar permiso
        </Button>
      </div>

      <div className="grid lg:grid-cols-[280px_1fr] gap-6">
        {/* User list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar televisora..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="rounded-lg border overflow-hidden">
            {filteredUsers.length === 0 ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                No se encontraron televisoras
              </div>
            ) : (
              filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => setSelectedUser(user.id)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-accent border-b last:border-b-0 ${
                    selectedUser === user.id ? 'bg-accent' : ''
                  }`}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="text-xs">
                      {user.displayName.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{user.displayName}</div>
                    <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Permissions table */}
        <div>
          {!selectedUser ? (
            <EmptyState
              icon={Shield}
              title="Selecciona una televisora"
              description="Elige una televisora del panel izquierdo para ver y gestionar sus permisos."
            />
          ) : permissions.length === 0 && !isLoading ? (
            <EmptyState
              icon={Shield}
              title="Sin permisos asignados"
              description="Esta televisora no tiene acceso a ningún contenido."
              action={
                <Button onClick={() => setGrantOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Otorgar acceso
                </Button>
              }
            />
          ) : (
            <DataTable
              columns={columns}
              data={permissions}
              isLoading={isLoading}
            />
          )}
        </div>
      </div>

      {/* Grant Dialog */}
      <Dialog open={grantOpen} onOpenChange={setGrantOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Otorgar permiso</DialogTitle>
            <DialogDescription>
              Asigna acceso a contenido específico para una televisora.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleGrant)}>
              <div className="grid gap-4 py-4">
                <FormField control={form.control} name="userId" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Televisora</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar televisora..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>{u.displayName} — {u.email}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                <FormField control={form.control} name="contentType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo de contenido</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar tipo..." /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="SERIES">Serie completa</SelectItem>
                        <SelectItem value="MOVIE">Película</SelectItem>
                        <SelectItem value="PROGRAM">Programa</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />

                {contentType && (
                  <FormField control={form.control} name="contentId" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Contenido</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar contenido..." /></SelectTrigger></FormControl>
                        <SelectContent>
                          {(contentOptions[contentType] ?? []).map((item) => (
                            <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )} />
                )}

                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="canStream" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Streaming</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />
                  <FormField control={form.control} name="canDownload" render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-0.5">
                        <FormLabel className="text-sm">Descarga</FormLabel>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )} />
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setGrantOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Otorgando...' : 'Otorgar permiso'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
