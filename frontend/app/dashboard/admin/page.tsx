'use client'

import { useEffect, useState } from 'react'
import {
  Users, Film, Tv, Video, Clapperboard,
  CheckCircle2, Clock, AlertTriangle, Loader2,
  HardDrive, Activity, Shield, Upload,
} from 'lucide-react'
import { contentService } from '@/services/content.service'
import { userService } from '@/services/user.service'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { StorageUsageCard } from '@/components/ui/storage-usage'
import type { DashboardStats, UserStats } from '@/types'

// ── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  title, value, sub, icon: Icon, accent, isLoading,
}: {
  title: string
  value: number | string
  sub?: string
  icon: React.ElementType<{ className?: string }>
  accent: string
  isLoading: boolean
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${accent}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        {isLoading
          ? <Skeleton className="h-8 w-16 mb-1" />
          : <div className="text-2xl font-bold">{value}</div>}
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  )
}

// ── Status strip ──────────────────────────────────────────────────────────────

function StatusStrip({
  isLoading, stats,
}: {
  isLoading: boolean
  stats: DashboardStats['uploadStatus']
}) {
  const items = [
    { label: 'Con video',  value: stats?.completed ?? 0,  icon: CheckCircle2, text: 'text-emerald-600', bg: 'bg-emerald-500/10' },
    { label: 'Sin video',  value: stats?.pending ?? 0,    icon: Clock,        text: 'text-muted-foreground', bg: 'bg-muted/60' },
    { label: 'En proceso', value: stats?.processing ?? 0, icon: Loader2,      text: 'text-amber-600', bg: 'bg-amber-500/10' },
    { label: 'Con error',  value: stats?.failed ?? 0,     icon: AlertTriangle, text: 'text-destructive', bg: 'bg-destructive/10' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {items.map(({ label, value, icon: Icon, text, bg }) => (
        <div key={label} className={`rounded-xl border px-4 py-3 flex items-center gap-3 ${bg}`}>
          <Icon className={`h-5 w-5 shrink-0 ${text} ${label === 'En proceso' && (stats?.processing ?? 0) > 0 ? 'animate-spin' : ''}`} />
          <div>
            {isLoading
              ? <Skeleton className="h-6 w-10 mb-0.5" />
              : <p className={`text-xl font-bold ${text}`}>{value}</p>}
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Role bar ──────────────────────────────────────────────────────────────────

function RoleBar({
  label, value, total, color, icon: Icon, isLoading,
}: {
  label: string
  value: number
  total: number
  color: string
  icon: React.ElementType<{ className?: string }>
  isLoading: boolean
}) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="font-medium">{label}</span>
        </div>
        {isLoading
          ? <Skeleton className="h-4 w-12" />
          : <span className="text-muted-foreground">{value} <span className="text-xs">({pct}%)</span></span>}
      </div>
      <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${color.replace('text-', 'bg-')}`}
          style={{ width: isLoading ? '0%' : `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminDashboard() {
  const [contentStats, setContentStats] = useState<DashboardStats | null>(null)
  const [userStats, setUserStats]       = useState<UserStats | null>(null)
  const [isLoading, setIsLoading]       = useState(true)

  useEffect(() => {
    Promise.all([
      contentService.getStats(),
      userService.getStats(),
    ]).then(([cs, us]) => {
      setContentStats(cs)
      setUserStats(us)
    }).finally(() => setIsLoading(false))
  }, [])

  const totalUsers = userStats?.total ?? 0

  return (
    <div className="space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Panel de Administración</h1>
        <p className="text-muted-foreground mt-1">
          {isLoading
            ? 'Cargando estadísticas...'
            : `${totalUsers} usuario${totalUsers !== 1 ? 's' : ''} registrados · ${userStats?.active ?? 0} activos`}
        </p>
      </div>

      {/* Main stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Usuarios"
          value={userStats?.total ?? 0}
          sub={`${userStats?.active ?? 0} activos · ${userStats?.inactive ?? 0} inactivos`}
          icon={Users}
          accent="bg-violet-500/10 text-violet-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Series"
          value={contentStats?.series ?? 0}
          sub={`${contentStats?.seasons ?? 0} temporadas · ${contentStats?.episodes ?? 0} episodios`}
          icon={Tv}
          accent="bg-blue-500/10 text-blue-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Películas"
          value={contentStats?.movies ?? 0}
          icon={Film}
          accent="bg-purple-500/10 text-purple-500"
          isLoading={isLoading}
        />
        <StatCard
          title="Programas"
          value={contentStats?.programs ?? 0}
          icon={Video}
          accent="bg-green-500/10 text-green-500"
          isLoading={isLoading}
        />
      </div>

      {/* Upload status breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Estado de videos
        </h2>
        <StatusStrip isLoading={isLoading} stats={contentStats?.uploadStatus} />
      </div>

      {/* User role distribution */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base">Distribución de usuarios por rol</CardTitle>
          <CardDescription>
            {isLoading ? 'Cargando...' : `${totalUsers} usuarios en total`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <RoleBar
            label="Administradores"
            value={userStats?.byRole?.ADMIN ?? 0}
            total={totalUsers}
            color="text-violet-500"
            icon={Shield}
            isLoading={isLoading}
          />
          <RoleBar
            label="Gestores de Contenido"
            value={userStats?.byRole?.CONTENT_MANAGER ?? 0}
            total={totalUsers}
            color="text-blue-500"
            icon={Clapperboard}
            isLoading={isLoading}
          />
          <RoleBar
            label="Televisoras"
            value={userStats?.byRole?.BROADCASTER_VIEWER ?? 0}
            total={totalUsers}
            color="text-green-500"
            icon={Activity}
            isLoading={isLoading}
          />
        </CardContent>
      </Card>

      {/* Storage usage */}
      <StorageUsageCard />

      {/* Quick actions + system status */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Acciones rápidas</CardTitle>
            <CardDescription>Gestión de usuarios y contenido</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-2">
            {[
              { label: 'Gestionar usuarios',  href: '/dashboard/admin/users',         icon: Users },
              { label: 'Gestionar series',    href: '/dashboard/content/series',       icon: Tv },
              { label: 'Subir contenido',     href: '/dashboard/content/upload',       icon: Upload },
              { label: 'Asignar permisos',    href: '/dashboard/content/permissions',  icon: Shield },
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
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Estado del sistema</CardTitle>
            <CardDescription>Información de la plataforma</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'API',           value: 'En línea',   dot: 'bg-emerald-500' },
              { label: 'Base de datos', value: 'Conectada',  dot: 'bg-emerald-500' },
              { label: 'Almacenamiento', value: 'Disponible', dot: 'bg-emerald-500' },
              { label: 'Versión',       value: '1.0.0',      dot: 'bg-muted-foreground' },
            ].map(({ label, value, dot }) => (
              <div key={label} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{label}</span>
                <div className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${dot}`} />
                  <span className="font-medium">{value}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
