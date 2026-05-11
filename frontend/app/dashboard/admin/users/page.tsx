'use client'

import { useEffect, useState, useCallback } from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { MoreHorizontal, Plus, ArrowUpDown, UserCheck, UserX, Pencil, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

import { userService, CreateUserPayload, UpdateUserPayload } from '@/services/user.service'
import type { User } from '@/types'
import { getRoleLabel, getRoleBadgeVariant } from '@/lib/utils'

import { DataTable } from '@/components/ui/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

// Defined at module level so React sees a stable component type across renders
function UserFormFields({ form }: { form: ReturnType<typeof useForm<CreateForm>> }) {
  return (
    <div className="grid gap-4 py-4">
      <div className="grid grid-cols-2 gap-4">
        <FormField control={form.control} name="displayName" render={({ field }) => (
          <FormItem>
            <FormLabel>Nombre</FormLabel>
            <FormControl><Input placeholder="Nombre completo" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="username" render={({ field }) => (
          <FormItem>
            <FormLabel>Usuario</FormLabel>
            <FormControl><Input placeholder="nombre_usuario" {...field} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
      </div>
      <FormField control={form.control} name="email" render={({ field }) => (
        <FormItem>
          <FormLabel>Email</FormLabel>
          <FormControl><Input type="email" placeholder="usuario@capital21.mx" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="password" render={({ field }) => (
        <FormItem>
          <FormLabel>Contraseña</FormLabel>
          <FormControl><Input type="password" placeholder="••••••••" {...field} /></FormControl>
          <FormMessage />
        </FormItem>
      )} />
      <FormField control={form.control} name="role" render={({ field }) => (
        <FormItem>
          <FormLabel>Rol</FormLabel>
          <Select onValueChange={field.onChange} defaultValue={field.value}>
            <FormControl>
              <SelectTrigger><SelectValue placeholder="Seleccionar rol" /></SelectTrigger>
            </FormControl>
            <SelectContent>
              <SelectItem value="ADMIN">Administrador</SelectItem>
              <SelectItem value="CONTENT_MANAGER">Gestor de Contenido</SelectItem>
              <SelectItem value="BROADCASTER_VIEWER">Televisora</SelectItem>
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )} />
    </div>
  )
}

const createUserSchema = z.object({
  email: z.string().email('Email inválido'),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Solo letras minúsculas, números y _'),
  displayName: z.string().min(2).max(60, 'Máximo 60 caracteres'),
  password: z
    .string()
    .min(8)
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Debe contener mayúsculas, minúsculas y números'),
  role: z.enum(['ADMIN', 'CONTENT_MANAGER', 'BROADCASTER_VIEWER']),
})

const updateUserSchema = createUserSchema.partial().omit({ password: true }).extend({
  isActive: z.boolean().optional(),
})

type CreateForm = z.infer<typeof createUserSchema>
type UpdateForm = z.infer<typeof updateUserSchema>

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [deleteUser, setDeleteUser] = useState<User | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const createForm = useForm<CreateForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { role: 'BROADCASTER_VIEWER' },
  })

  const editForm = useForm<UpdateForm>({
    resolver: zodResolver(updateUserSchema),
  })

  const fetchUsers = useCallback(async (p = 1) => {
    setIsLoading(true)
    try {
      const result = await userService.findAll({ page: p, limit: 20 })
      setUsers(result.data)
      setTotalPages(result.meta.totalPages)
      setTotalCount(result.meta.total)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers(page) }, [fetchUsers, page])

  useEffect(() => {
    if (editUser) {
      editForm.reset({
        displayName: editUser.displayName,
        email: editUser.email,
        role: editUser.role,
        isActive: editUser.isActive,
      })
    }
  }, [editUser, editForm])

  const handleCreate = async (values: CreateForm) => {
    setIsSubmitting(true)
    try {
      await userService.create(values as CreateUserPayload)
      toast.success('Usuario creado', { description: `${values.email} ha sido creado.` })
      setCreateOpen(false)
      createForm.reset()
      fetchUsers(page)
    } catch {
      toast.error('Error al crear usuario')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleUpdate = async (values: UpdateForm) => {
    if (!editUser) return
    setIsSubmitting(true)
    try {
      await userService.update(editUser.id, values as UpdateUserPayload)
      toast.success('Usuario actualizado')
      setEditUser(null)
      fetchUsers(page)
    } catch {
      toast.error('Error al actualizar usuario')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!deleteUser) return
    setIsSubmitting(true)
    try {
      await userService.delete(deleteUser.id)
      toast.success('Usuario eliminado')
      setDeleteUser(null)
      fetchUsers(page)
    } catch {
      toast.error('Error al eliminar usuario')
    } finally {
      setIsSubmitting(false)
    }
  }

  const columns: ColumnDef<User>[] = [
    {
      id: 'user',
      header: ({ column }) => (
        <Button variant="ghost" size="sm" onClick={() => column.toggleSorting()}>
          Usuario <ArrowUpDown className="ml-2 h-3 w-3" />
        </Button>
      ),
      cell: ({ row }) => {
        const user = row.original
        const initials = user.displayName
          .split(' ')
          .map((n) => n[0])
          .slice(0, 2)
          .join('')
          .toUpperCase()
        return (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-sm">{user.displayName}</div>
              <div className="text-xs text-muted-foreground">@{user.username}</div>
            </div>
          </div>
        )
      },
    },
    {
      accessorKey: 'email',
      header: 'Email',
      cell: ({ getValue }) => (
        <span className="text-sm text-muted-foreground">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'role',
      header: 'Rol',
      cell: ({ getValue }) => {
        const role = getValue() as string
        return <Badge variant={getRoleBadgeVariant(role)}>{getRoleLabel(role)}</Badge>
      },
    },
    {
      accessorKey: 'isActive',
      header: 'Estado',
      cell: ({ getValue }) => {
        const active = getValue() as boolean
        return (
          <Badge variant={active ? 'success' : 'outline'}>
            {active ? 'Activo' : 'Inactivo'}
          </Badge>
        )
      },
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'Último acceso',
      cell: ({ getValue }) => {
        const date = getValue() as string | null
        return (
          <span className="text-sm text-muted-foreground">
            {date
              ? format(new Date(date), "dd MMM yyyy 'a las' HH:mm", { locale: es })
              : 'Nunca'}
          </span>
        )
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
        const user = row.original
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
              <DropdownMenuItem onClick={() => setEditUser(user)}>
                <Pencil className="mr-2 h-4 w-4" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  userService.update(user.id, { isActive: !user.isActive }).then(() => fetchUsers(page))
                }
              >
                {user.isActive ? (
                  <>
                    <UserX className="mr-2 h-4 w-4" />
                    Desactivar
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Activar
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => setDeleteUser(user)}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Eliminar
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
          <h1 className="text-2xl font-bold tracking-tight">Usuarios</h1>
          <p className="text-muted-foreground text-sm">
            Gestiona los usuarios y sus roles en la plataforma.
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nuevo usuario
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={users}
        isLoading={isLoading}
        searchColumn="email"
        searchPlaceholder="Buscar por email..."
        totalPages={totalPages}
        currentPage={page}
        onPageChange={setPage}
        totalCount={totalCount}
      />

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Crear nuevo usuario</DialogTitle>
            <DialogDescription>
              Completa la información para crear un nuevo usuario en la plataforma.
            </DialogDescription>
          </DialogHeader>
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(handleCreate)}>
              <UserFormFields form={createForm as never} />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Creando...' : 'Crear usuario'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={!!editUser} onOpenChange={(open) => !open && setEditUser(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Modifica la información de {editUser?.displayName}.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(handleUpdate)}>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={editForm.control} name="displayName" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                  <FormField control={editForm.control} name="email" render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )} />
                </div>
                <FormField control={editForm.control} name="role" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rol</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ADMIN">Administrador</SelectItem>
                        <SelectItem value="CONTENT_MANAGER">Gestor de Contenido</SelectItem>
                        <SelectItem value="BROADCASTER_VIEWER">Televisora</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEditUser(null)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? 'Guardando...' : 'Guardar cambios'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm Dialog */}
      <Dialog open={!!deleteUser} onOpenChange={(open) => !open && setDeleteUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Eliminar usuario</DialogTitle>
            <DialogDescription>
              ¿Estás seguro de que deseas eliminar a{' '}
              <strong>{deleteUser?.displayName}</strong>? Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={isSubmitting} onClick={handleDelete}>
              {isSubmitting ? 'Eliminando...' : 'Eliminar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
