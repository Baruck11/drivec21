'use client'

import { useEffect, useState } from 'react'
import { Users, Film, Tv, Video, Clapperboard, HardDrive, TrendingUp, Activity } from 'lucide-react'
import { contentService } from '@/services/content.service'
import { userService } from '@/services/user.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StorageUsageCard } from '@/components/ui/storage-usage'
import type { DashboardStats, UserStats } from '@/types'

interface StatCardProps {
  title: string
  value: string | number
  description?: string
  icon: React.ElementType
  trend?: string
  isLoading?: boolean
}

function StatCard({ title, value, description, icon: Icon, trend, isLoading }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-20 mb-1" />
        ) : (
          <div className="text-2xl font-bold">{value}</div>
        )}
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
        {trend && (
          <p className="text-xs text-emerald-500 flex items-center gap-1 mt-1">
            <TrendingUp className="h-3 w-3" />
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

export default function AdminDashboard() {
  const [contentStats, setContentStats] = useState<DashboardStats | null>(null)
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      try {
        const [cs, us] = await Promise.all([
          contentService.getStats(),
          userService.getStats(),
        ])
        setContentStats(cs)
        setUserStats(us)
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel de Administración</h1>
        <p className="text-muted-foreground mt-1">
          Resumen general de la plataforma Capital 21 Play.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Usuarios"
          value={userStats?.total ?? 0}
          description={`${userStats?.active ?? 0} activos · ${userStats?.inactive ?? 0} inactivos`}
          icon={Users}
          isLoading={isLoading}
        />
        <StatCard
          title="Series"
          value={contentStats?.series ?? 0}
          description={`${contentStats?.seasons ?? 0} temporadas · ${contentStats?.episodes ?? 0} episodios`}
          icon={Tv}
          isLoading={isLoading}
        />
        <StatCard
          title="Películas"
          value={contentStats?.movies ?? 0}
          icon={Film}
          isLoading={isLoading}
        />
        <StatCard
          title="Programas"
          value={contentStats?.programs ?? 0}
          icon={Video}
          isLoading={isLoading}
        />
      </div>

      {/* Secondary stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Administradores"
          value={userStats?.byRole?.ADMIN ?? 0}
          icon={Users}
          isLoading={isLoading}
        />
        <StatCard
          title="Gestores de Contenido"
          value={userStats?.byRole?.CONTENT_MANAGER ?? 0}
          icon={Clapperboard}
          isLoading={isLoading}
        />
        <StatCard
          title="Televisoras"
          value={userStats?.byRole?.BROADCASTER_VIEWER ?? 0}
          icon={Activity}
          isLoading={isLoading}
        />
      </div>

      {/* Storage usage */}
      <StorageUsageCard />

      {/* Quick access */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
            <CardDescription>Gestión de usuarios y permisos</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { label: 'Crear usuario', href: '/dashboard/admin/users', icon: Users },
              { label: 'Gestionar series', href: '/dashboard/content/series', icon: Tv },
              { label: 'Subir contenido', href: '/dashboard/content/upload', icon: HardDrive },
              { label: 'Asignar permisos', href: '/dashboard/content/permissions', icon: Activity },
            ].map((action) => (
              <a
                key={action.href}
                href={action.href}
                className="flex items-center gap-2 rounded-lg border p-3 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <action.icon className="h-4 w-4 text-muted-foreground" />
                {action.label}
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Estado del sistema</CardTitle>
            <CardDescription>Información de la plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Versión', value: '1.0.0' },
              { label: 'Entorno', value: 'Producción' },
              { label: 'API', value: 'En línea' },
              { label: 'Base de datos', value: 'Conectada' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
