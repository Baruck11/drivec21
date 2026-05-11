'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Tv, Film, Video, Upload, Shield, Plus, TrendingUp } from 'lucide-react'
import { contentService } from '@/services/content.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { StorageUsageCard } from '@/components/ui/storage-usage'
import type { DashboardStats } from '@/types'

export default function ContentManagerPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    contentService.getStats().then(setStats).finally(() => setIsLoading(false))
  }, [])

  const quickLinks = [
    { label: 'Nueva Serie', href: '/dashboard/content/series', icon: Tv, color: 'text-blue-500' },
    { label: 'Nueva Película', href: '/dashboard/content/movies', icon: Film, color: 'text-purple-500' },
    { label: 'Nuevo Programa', href: '/dashboard/content/programs', icon: Video, color: 'text-green-500' },
    { label: 'Subir Contenido', href: '/dashboard/content/upload', icon: Upload, color: 'text-amber-500' },
    { label: 'Gestionar Permisos', href: '/dashboard/content/permissions', icon: Shield, color: 'text-rose-500' },
  ]

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Contenido</h1>
          <p className="text-muted-foreground mt-1">
            Administra todo el contenido multimedia de la plataforma.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/content/series">
            <Plus className="mr-2 h-4 w-4" />
            Nueva serie
          </Link>
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {[
          { label: 'Series', value: stats?.series, icon: Tv },
          { label: 'Temporadas', value: stats?.seasons, icon: TrendingUp },
          { label: 'Episodios', value: stats?.episodes, icon: TrendingUp },
          { label: 'Películas', value: stats?.movies, icon: Film },
          { label: 'Programas', value: stats?.programs, icon: Video },
        ].map((item) => (
          <Card key={item.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{item.label}</CardTitle>
              <item.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-7 w-12" />
              ) : (
                <span className="text-2xl font-bold">{item.value ?? 0}</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Storage usage */}
      <StorageUsageCard />

      {/* Quick links */}
      <div>
        <h2 className="text-lg font-semibold mb-4">Acciones rápidas</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                      <link.icon className={`h-5 w-5 ${link.color}`} />
                    </div>
                    <div>
                      <CardTitle className="text-base">{link.label}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
