'use client'

import { useEffect, useState } from 'react'
import { HardDrive, Film, Tv, Video } from 'lucide-react'
import { contentService } from '@/services/content.service'
import { formatBytes } from '@/lib/utils'
import type { StorageStats } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from './card'
import { Skeleton } from './skeleton'

const MAX_STORAGE_BYTES = 50 * 1024 * 1024 * 1024 * 1024 // 50 TB display cap

const SEGMENTS = [
  { key: 'episodes' as const, label: 'Episodios', color: 'bg-blue-500', icon: Tv },
  { key: 'movies'   as const, label: 'Películas', color: 'bg-purple-500', icon: Film },
  { key: 'programs' as const, label: 'Programas', color: 'bg-green-500', icon: Video },
]

export function StorageUsageCard() {
  const [stats, setStats] = useState<StorageStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    contentService.getStorageStats().then(setStats).finally(() => setIsLoading(false))
  }, [])

  const totalBytes = stats?.totalBytes ?? 0
  const capBytes = Math.max(totalBytes * 1.25, MAX_STORAGE_BYTES)
  const usedPct = totalBytes > 0 ? (totalBytes / capBytes) * 100 : 0

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Almacenamiento utilizado
        </CardTitle>
        <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
          <HardDrive className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <>
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-3 w-full rounded-full" />
            <div className="grid grid-cols-3 gap-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10" />)}
            </div>
          </>
        ) : (
          <>
            <div className="text-2xl font-bold">{formatBytes(totalBytes)}</div>

            {/* Segmented progress bar */}
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {SEGMENTS.map((seg) => {
                const bytes = stats?.byType[seg.key] ?? 0
                const pct = totalBytes > 0 ? (bytes / capBytes) * 100 : 0
                return pct > 0 ? (
                  <div
                    key={seg.key}
                    className={`${seg.color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                    title={`${seg.label}: ${formatBytes(bytes)}`}
                  />
                ) : null
              })}
            </div>
            <p className="text-xs text-muted-foreground">{usedPct.toFixed(1)}% del espacio disponible</p>

            {/* Per-type breakdown */}
            <div className="grid grid-cols-3 gap-2">
              {SEGMENTS.map((seg) => {
                const bytes = stats?.byType[seg.key] ?? 0
                const Icon = seg.icon
                return (
                  <div key={seg.key} className="rounded-lg bg-muted/50 p-2 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`h-2 w-2 rounded-full ${seg.color}`} />
                      <span className="text-xs text-muted-foreground">{seg.label}</span>
                      <Icon className="h-3 w-3 text-muted-foreground ml-auto" />
                    </div>
                    <p className="text-xs font-semibold">{formatBytes(bytes)}</p>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  )
}
