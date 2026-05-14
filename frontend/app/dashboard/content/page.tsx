'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  Tv, Film, Video, Upload, Shield, Plus,
  Layers, CheckCircle2, Clock, AlertTriangle, Loader2,
  Clapperboard,
} from 'lucide-react'
import { contentService } from '@/services/content.service'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StorageUsageCard } from '@/components/ui/storage-usage'
import type { DashboardStats } from '@/types'

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

// ── Status strip card ─────────────────────────────────────────────────────────

function StatusStrip({
  isLoading, stats,
}: {
  isLoading: boolean
  stats: DashboardStats['uploadStatus']
}) {
  const items = [
    {
      label: 'Con video',
      value: stats?.completed ?? 0,
      icon: CheckCircle2,
      text: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Sin video',
      value: stats?.pending ?? 0,
      icon: Clock,
      text: 'text-muted-foreground',
      bg: 'bg-muted/60',
    },
    {
      label: 'En proceso',
      value: stats?.processing ?? 0,
      icon: Loader2,
      text: 'text-amber-600',
      bg: 'bg-amber-500/10',
    },
    {
      label: 'Con error',
      value: stats?.failed ?? 0,
      icon: AlertTriangle,
      text: 'text-destructive',
      bg: 'bg-destructive/10',
    },
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ContentManagerPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    contentService.getStats().then(setStats).finally(() => setIsLoading(false))
  }, [])

  const quickLinks = [
    { label: 'Nueva Serie',         href: '/dashboard/content/series',      icon: Tv,          color: 'text-blue-500',   bg: 'bg-blue-500/10' },
    { label: 'Nueva Película',      href: '/dashboard/content/movies',      icon: Film,        color: 'text-purple-500', bg: 'bg-purple-500/10' },
    { label: 'Nuevo Programa',      href: '/dashboard/content/programs',    icon: Video,       color: 'text-green-500',  bg: 'bg-green-500/10' },
    { label: 'Subir Contenido',     href: '/dashboard/content/upload',      icon: Upload,      color: 'text-amber-500',  bg: 'bg-amber-500/10' },
    { label: 'Gestionar Permisos',  href: '/dashboard/content/permissions', icon: Shield,      color: 'text-rose-500',   bg: 'bg-rose-500/10' },
    { label: 'Gestionar Episodios', href: '/dashboard/content/episodes',    icon: Clapperboard, color: 'text-cyan-500',  bg: 'bg-cyan-500/10' },
  ]

  return (
    <div className="space-y-8">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Contenido</h1>
          <p className="text-muted-foreground mt-1">
            {isLoading
              ? 'Cargando estadísticas...'
              : `${(stats?.uploadStatus?.total ?? 0)} elementos en catálogo · ${stats?.series ?? 0} serie${stats?.series !== 1 ? 's' : ''}`}
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/content/series">
            <Plus className="mr-2 h-4 w-4" />
            Nueva serie
          </Link>
        </Button>
      </div>

      {/* Content counts */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard title="Series"     value={stats?.series ?? 0}   sub={`${stats?.seasons ?? 0} temporadas`} icon={Tv}     accent="bg-blue-500/10 text-blue-500"   isLoading={isLoading} />
        <StatCard title="Temporadas" value={stats?.seasons ?? 0}  icon={Layers}  accent="bg-indigo-500/10 text-indigo-500" isLoading={isLoading} />
        <StatCard title="Episodios"  value={stats?.episodes ?? 0} icon={Tv}      accent="bg-sky-500/10 text-sky-500"       isLoading={isLoading} />
        <StatCard title="Películas"  value={stats?.movies ?? 0}   icon={Film}    accent="bg-purple-500/10 text-purple-500" isLoading={isLoading} />
        <StatCard title="Programas"  value={stats?.programs ?? 0} icon={Video}   accent="bg-green-500/10 text-green-500"   isLoading={isLoading} />
      </div>

      {/* Upload status breakdown */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
          Estado de videos
        </h2>
        <StatusStrip isLoading={isLoading} stats={stats?.uploadStatus} />
      </div>

      {/* Storage usage */}
      <StorageUsageCard />

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Acciones rápidas</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <div className="flex items-center gap-3 rounded-xl border px-4 py-3.5 hover:bg-muted/20 transition-colors cursor-pointer">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${link.bg}`}>
                  <link.icon className={`h-4 w-4 ${link.color}`} />
                </div>
                <span className="text-sm font-medium">{link.label}</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
