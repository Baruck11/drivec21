'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Play,
  LayoutDashboard,
  Users,
  Film,
  Tv,
  Video,
  Settings,
  LogOut,
  ChevronRight,
  Shield,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/auth.store'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { getRoleLabel } from '@/lib/utils'
import type { Role } from '@/types'

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  badge?: string
  roles: Role[]
}

const navItems: NavItem[] = [
  {
    label: 'Panel Principal',
    href: '/dashboard',
    icon: LayoutDashboard,
    roles: ['ADMIN', 'CONTENT_MANAGER', 'BROADCASTER_VIEWER'],
  },
  {
    label: 'Usuarios',
    href: '/dashboard/admin/users',
    icon: Users,
    roles: ['ADMIN'],
  },
  {
    label: 'Series',
    href: '/dashboard/content/series',
    icon: Tv,
    roles: ['ADMIN', 'CONTENT_MANAGER'],
  },
  {
    label: 'Películas',
    href: '/dashboard/content/movies',
    icon: Film,
    roles: ['ADMIN', 'CONTENT_MANAGER'],
  },
  {
    label: 'Programas',
    href: '/dashboard/content/programs',
    icon: Video,
    roles: ['ADMIN', 'CONTENT_MANAGER'],
  },
  {
    label: 'Subir Contenido',
    href: '/dashboard/content/upload',
    icon: Upload,
    roles: ['ADMIN', 'CONTENT_MANAGER'],
  },
  {
    label: 'Permisos',
    href: '/dashboard/content/permissions',
    icon: Shield,
    roles: ['ADMIN', 'CONTENT_MANAGER'],
  },
  {
    label: 'Mi Contenido',
    href: '/dashboard/viewer',
    icon: Play,
    roles: ['BROADCASTER_VIEWER'],
  },
]

export function AppSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuthStore()

  const filteredItems = navItems.filter(
    (item) => user?.role && item.roles.includes(user.role as Role),
  )

  const initials = user?.displayName
    ? user.displayName
        .split(' ')
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'U'

  return (
    <aside className="flex h-full w-[240px] flex-col border-r bg-sidebar">
      {/* Brand */}
      <div className="flex h-16 items-center gap-3 border-b px-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
          <Play className="h-4 w-4 fill-primary-foreground text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-none">Capital 21 Play</p>
          <p className="truncate text-xs text-muted-foreground">Medios Públicos CDMX</p>
        </div>
      </div>

      {/* Nav */}
      <ScrollArea className="flex-1 px-3 py-4">
        <nav className="space-y-1">
          {filteredItems.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : pathname.startsWith(item.href)

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                    : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
                )}
              >
                <item.icon
                  className={cn(
                    'h-4 w-4 shrink-0 transition-colors',
                    isActive ? 'text-sidebar-primary' : 'text-sidebar-foreground/60 group-hover:text-sidebar-foreground',
                  )}
                />
                <span className="flex-1 truncate">{item.label}</span>
                {item.badge && (
                  <Badge variant="secondary" className="text-xs h-5 px-1.5">
                    {item.badge}
                  </Badge>
                )}
                {isActive && <ChevronRight className="h-3.5 w-3.5 text-sidebar-foreground/40" />}
              </Link>
            )
          })}
        </nav>
      </ScrollArea>

      {/* User footer */}
      <div className="border-t p-3">
        <div className="flex items-center gap-3 rounded-md p-2">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarImage src={user?.avatarUrl ?? undefined} />
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium leading-none">{user?.displayName}</p>
            <p className="truncate text-xs text-muted-foreground mt-0.5">
              {getRoleLabel(user?.role ?? '')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => logout()}
            title="Cerrar sesión"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  )
}
