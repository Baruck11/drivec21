'use client'

import { useEffect, useState } from 'react'
import {
  Play, Download, Search, Tv, Film, Video, ChevronDown, ChevronUp,
  PackageOpen, Layers, Archive, AlertTriangle, Loader2,
} from 'lucide-react'
import { toast } from 'sonner'

import { permissionService } from '@/services/permission.service'
import { downloadService, toStorageUrl } from '@/services/download.service'
import { formatDuration, formatBytes } from '@/lib/utils'
import type { BroadcasterPermission, BroadcasterEpisode, BroadcasterSeason } from '@/types'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { MediaPlayer } from '@/components/ui/media-player'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

// ─── Episode row ────────────────────────────────────────────────────────────

interface EpisodeRowProps {
  episode: BroadcasterEpisode
  canDownload: boolean
  onPlay: (ep: BroadcasterEpisode) => void
  onDownload: (ep: BroadcasterEpisode) => void
}

function EpisodeRow({ episode, canDownload, onPlay, onDownload }: EpisodeRowProps) {
  const ready = episode.uploadStatus === 'COMPLETED'
  const canPlay = ready && !!(episode.hlsUrl ?? episode.videoUrl)
  const canDl   = canDownload && ready && !!episode.videoUrl

  return (
    <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-muted/50 transition-colors">
      <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 text-right">
        {String(episode.number).padStart(2, '0')}
      </span>

      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${!ready ? 'text-muted-foreground' : ''}`}>
          {episode.title}
        </p>
        {episode.duration && (
          <p className="text-xs text-muted-foreground">{formatDuration(episode.duration)}</p>
        )}
      </div>

      {episode.fileSize && (
        <span className="text-xs text-muted-foreground hidden md:block shrink-0">
          {formatBytes(episode.fileSize)}
        </span>
      )}

      <div className="flex items-center gap-1.5 shrink-0">
        {!ready && (
          <Badge variant="outline" className="text-xs">Procesando</Badge>
        )}

        {canPlay && (
          <Button
            size="sm"
            variant="secondary"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onPlay(episode)}
          >
            <Play className="h-3 w-3 fill-current" />
            Ver
          </Button>
        )}

        {canDl && (
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={() => onDownload(episode)}
            title="Descargar episodio"
          >
            <Download className="h-3 w-3" />
            Bajar
          </Button>
        )}
      </div>
    </div>
  )
}

// ─── Season panel ────────────────────────────────────────────────────────────

interface SeasonPanelProps {
  season: BroadcasterSeason
  seriesId: string
  canDownload: boolean
  onPlay: (ep: BroadcasterEpisode) => void
  onDownloadEpisode: (ep: BroadcasterEpisode) => void
}

function SeasonPanel({ season, canDownload, onPlay, onDownloadEpisode }: SeasonPanelProps) {
  const [downloading, setDownloading] = useState(false)
  const totalSize = season.episodes.reduce((acc, ep) => acc + (ep.fileSize ?? 0), 0)
  const bigDownload = totalSize > 5 * 1024 * 1024 * 1024

  const handleSeasonZip = async () => {
    if (bigDownload) {
      const ok = window.confirm(
        `Esta temporada pesa aprox. ${formatBytes(totalSize)}. El archivo ZIP se preparará en el servidor y tardará unos momentos. ¿Continuar?`,
      )
      if (!ok) return
    }
    setDownloading(true)
    toast.info('Preparando ZIP de temporada…')
    try {
      await downloadService.downloadZip('season', season.id)
      toast.success('Descarga iniciada')
    } catch {
      toast.error('Error al generar el ZIP')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-1">
      {canDownload && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            {season.episodes.length} episodios{totalSize > 0 ? ` · ${formatBytes(totalSize)}` : ''}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={handleSeasonZip}
            disabled={downloading}
          >
            {downloading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Archive className="h-3 w-3" />
            )}
            {bigDownload && <AlertTriangle className="h-3 w-3 text-amber-500" />}
            Descargar temporada
          </Button>
        </div>
      )}

      {season.episodes.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Sin episodios disponibles</p>
      ) : (
        season.episodes.map((ep) => (
          <EpisodeRow
            key={ep.id}
            episode={ep}
            canDownload={canDownload}
            onPlay={onPlay}
            onDownload={onDownloadEpisode}
          />
        ))
      )}
    </div>
  )
}

// ─── Series card (expandable) ─────────────────────────────────────────────

interface SeriesCardProps {
  perm: BroadcasterPermission
  onPlay: (ep: BroadcasterEpisode, seriesTitle: string) => void
}

function SeriesCard({ perm, onPlay }: SeriesCardProps) {
  const series = perm.series!
  const [expanded, setExpanded] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const totalSize = series.seasons.flatMap((s) => s.episodes).reduce(
    (acc, ep) => acc + (ep.fileSize ?? 0), 0,
  )
  const bigDownload = totalSize > 10 * 1024 * 1024 * 1024

  const handleSeriesZip = async () => {
    if (bigDownload) {
      const ok = window.confirm(
        `Esta serie pesa aprox. ${formatBytes(totalSize)}. ¿Continuar con la descarga completa?`,
      )
      if (!ok) return
    }
    setDownloading(true)
    toast.info('Preparando ZIP de serie completa…')
    try {
      await downloadService.downloadZip('series', series.id)
      toast.success('Descarga iniciada')
    } catch {
      toast.error('Error al generar el ZIP')
    } finally {
      setDownloading(false)
    }
  }

  const handleDownloadEpisode = (ep: BroadcasterEpisode) => {
    if (!ep.videoUrl) return
    downloadService.downloadFile(ep.videoUrl, `${String(ep.number).padStart(2, '0')}. ${ep.title}`)
    toast.info(`Descargando ${ep.title}…`)
  }

  const defaultSeason = series.seasons[0]?.id ?? ''

  return (
    <Card className="overflow-hidden">
      {/* Series header */}
      <CardHeader className="p-0">
        <div className="flex items-center gap-4 p-4">
          {series.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={toStorageUrl(series.thumbnailUrl)}
              alt={series.title}
              className="h-16 w-28 rounded-md object-cover shrink-0"
            />
          ) : (
            <div className="h-16 w-28 rounded-md bg-muted flex items-center justify-center shrink-0">
              <Tv className="h-6 w-6 text-muted-foreground/40" />
            </div>
          )}

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{series.title}</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {series.seasons.length} temporada{series.seasons.length !== 1 ? 's' : ''} ·{' '}
              {series.seasons.reduce((a, s) => a + s.episodes.length, 0)} episodios
              {totalSize > 0 ? ` · ${formatBytes(totalSize)}` : ''}
            </p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs gap-1">
                <Tv className="h-3 w-3" /> Serie
              </Badge>
              {perm.canDownload && (
                <Badge variant="secondary" className="text-xs">Descargable</Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {perm.canDownload && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-xs hidden sm:flex"
                onClick={handleSeriesZip}
                disabled={downloading}
              >
                {downloading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Archive className="h-3.5 w-3.5" />
                )}
                {bigDownload && <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />}
                Descargar serie
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8"
              onClick={() => setExpanded((v) => !v)}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Expandable season/episode list */}
      {expanded && (
        <CardContent className="pt-0 px-4 pb-4 border-t">
          {series.seasons.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Sin temporadas disponibles</p>
          ) : series.seasons.length === 1 ? (
            <div className="pt-3">
              <SeasonPanel
                season={series.seasons[0]}
                seriesId={series.id}
                canDownload={perm.canDownload}
                onPlay={(ep) => onPlay(ep, series.title)}
                onDownloadEpisode={handleDownloadEpisode}
              />
            </div>
          ) : (
            <Tabs defaultValue={defaultSeason} className="pt-3">
              <TabsList className="flex-wrap h-auto gap-1 mb-3">
                {series.seasons.map((season) => (
                  <TabsTrigger key={season.id} value={season.id} className="text-xs">
                    T{String(season.number).padStart(2, '0')} {season.title}
                  </TabsTrigger>
                ))}
              </TabsList>
              {series.seasons.map((season) => (
                <TabsContent key={season.id} value={season.id}>
                  <SeasonPanel
                    season={season}
                    seriesId={series.id}
                    canDownload={perm.canDownload}
                    onPlay={(ep) => onPlay(ep, series.title)}
                    onDownloadEpisode={handleDownloadEpisode}
                  />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </CardContent>
      )}
    </Card>
  )
}

// ─── Movie / Program card ─────────────────────────────────────────────────

interface MediaCardProps {
  title: string
  thumbnailUrl?: string | null
  duration?: number | null
  fileSize?: number | null
  canDownload?: boolean
  canStream?: boolean
  contentType: 'movie' | 'program'
  onPlay: () => void
  onDownload?: () => void
}

function MediaCard({
  title, thumbnailUrl, duration, fileSize, canDownload, canStream, contentType, onPlay, onDownload,
}: MediaCardProps) {
  const Icon = contentType === 'movie' ? Film : Video

  return (
    <Card className="group overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
      <div className="relative aspect-video bg-muted overflow-hidden">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toStorageUrl(thumbnailUrl)}
            alt={title}
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}

        <div className="absolute inset-0 flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50">
          {canStream && (
            <Button size="icon" className="h-11 w-11 rounded-full" onClick={onPlay}>
              <Play className="h-5 w-5 fill-current ml-0.5" />
            </Button>
          )}
          {canDownload && (
            <Button size="icon" variant="secondary" className="h-9 w-9 rounded-full" onClick={onDownload}>
              <Download className="h-4 w-4" />
            </Button>
          )}
        </div>

        {duration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white font-mono">
            {formatDuration(duration)}
          </div>
        )}
      </div>

      <CardContent className="p-3">
        <h3 className="font-medium text-sm leading-tight line-clamp-2">{title}</h3>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <Badge variant="outline" className="text-xs gap-1">
            <Icon className="h-3 w-3" />
            {contentType === 'movie' ? 'Película' : 'Programa'}
          </Badge>
          {fileSize && (
            <span className="text-xs text-muted-foreground">{formatBytes(fileSize)}</span>
          )}
          {canDownload && (
            <Badge variant="secondary" className="text-xs">Descargable</Badge>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function SkeletonGrid() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-video rounded-lg" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────

interface PlayerState {
  title: string
  src: string
  hlsSrc?: string
  poster?: string
}

export default function ViewerDashboard() {
  const [permissions, setPermissions] = useState<BroadcasterPermission[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [player, setPlayer] = useState<PlayerState | null>(null)

  useEffect(() => {
    permissionService
      .getMyContent()
      .then((data) => setPermissions(data as BroadcasterPermission[]))
      .finally(() => setIsLoading(false))
  }, [])

  const seriesPerms  = permissions.filter((p) => p.contentType === 'SERIES' && p.series)
  const moviePerms   = permissions.filter((p) => p.contentType === 'MOVIE'  && p.movie)
  const programPerms = permissions.filter((p) => p.contentType === 'PROGRAM' && p.program)

  const searchLC = search.toLowerCase()
  const filteredSeries  = searchLC
    ? seriesPerms.filter((p) => p.series!.title.toLowerCase().includes(searchLC))
    : seriesPerms
  const filteredMovies  = searchLC
    ? moviePerms.filter((p) => p.movie!.title.toLowerCase().includes(searchLC))
    : moviePerms
  const filteredPrograms = searchLC
    ? programPerms.filter((p) => p.program!.title.toLowerCase().includes(searchLC))
    : programPerms

  const totalCount = seriesPerms.length + moviePerms.length + programPerms.length

  const handlePlayEpisode = (ep: BroadcasterEpisode, seriesTitle: string) => {
    setPlayer({
      title: `${seriesTitle} — ${ep.title}`,
      src: toStorageUrl(ep.videoUrl) ?? '',
      hlsSrc: toStorageUrl(ep.hlsUrl),
    })
  }

  const handlePlayMedia = (title: string, videoUrl: string | null, hlsUrl: string | null, poster?: string | null) => {
    setPlayer({
      title,
      src: toStorageUrl(videoUrl) ?? '',
      hlsSrc: toStorageUrl(hlsUrl),
      poster: toStorageUrl(poster),
    })
  }

  const handleDownloadMedia = (videoUrl: string | null, title: string) => {
    if (!videoUrl) return
    downloadService.downloadFile(videoUrl, title)
    toast.info(`Descargando ${title}…`)
  }

  const isEmpty = totalCount === 0

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Mi Contenido</h1>
        <p className="text-muted-foreground mt-1">
          Accede a todo el contenido multimedia asignado a tu cuenta.
        </p>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar contenido…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {isLoading ? (
        <div className="space-y-8">
          <div className="space-y-3">
            <Skeleton className="h-5 w-24" />
            {[1, 2].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          <SkeletonGrid />
        </div>
      ) : isEmpty ? (
        <EmptyState
          icon={PackageOpen}
          title="Sin contenido asignado"
          description="No tienes acceso a ningún contenido aún. Contacta a tu gestor de contenido."
        />
      ) : (
        <div className="space-y-10">

          {/* ── Series ─────────────────────────────────────────────── */}
          {filteredSeries.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Tv className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">
                  Series <span className="text-muted-foreground font-normal text-sm">({filteredSeries.length})</span>
                </h2>
              </div>
              <div className="space-y-3">
                {filteredSeries.map((perm) => (
                  <SeriesCard key={perm.id} perm={perm} onPlay={handlePlayEpisode} />
                ))}
              </div>
            </section>
          )}

          {/* ── Movies ─────────────────────────────────────────────── */}
          {filteredMovies.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Film className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">
                  Películas <span className="text-muted-foreground font-normal text-sm">({filteredMovies.length})</span>
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredMovies.map((perm) => (
                  <MediaCard
                    key={perm.id}
                    title={perm.movie!.title}
                    thumbnailUrl={perm.movie!.thumbnailUrl}
                    duration={perm.movie!.duration}
                    fileSize={perm.movie!.fileSize}
                    contentType="movie"
                    canStream={perm.canStream}
                    canDownload={perm.canDownload}
                    onPlay={() => handlePlayMedia(
                      perm.movie!.title,
                      perm.movie!.videoUrl,
                      perm.movie!.hlsUrl,
                      perm.movie!.thumbnailUrl,
                    )}
                    onDownload={() => handleDownloadMedia(perm.movie!.videoUrl, perm.movie!.title)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* ── Programs ───────────────────────────────────────────── */}
          {filteredPrograms.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <Video className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-base font-semibold">
                  Programas <span className="text-muted-foreground font-normal text-sm">({filteredPrograms.length})</span>
                </h2>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredPrograms.map((perm) => (
                  <MediaCard
                    key={perm.id}
                    title={perm.program!.title}
                    thumbnailUrl={perm.program!.thumbnailUrl}
                    duration={perm.program!.duration}
                    fileSize={perm.program!.fileSize ?? undefined}
                    contentType="program"
                    canStream={perm.canStream}
                    canDownload={perm.canDownload}
                    onPlay={() => handlePlayMedia(
                      perm.program!.title,
                      perm.program!.videoUrl,
                      perm.program!.hlsUrl,
                      perm.program!.thumbnailUrl,
                    )}
                    onDownload={() => handleDownloadMedia(perm.program!.videoUrl, perm.program!.title)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty search state */}
          {search && filteredSeries.length === 0 && filteredMovies.length === 0 && filteredPrograms.length === 0 && (
            <EmptyState
              icon={Layers}
              title="Sin resultados"
              description={`No se encontró contenido que coincida con "${search}".`}
            />
          )}
        </div>
      )}

      {/* Player Dialog */}
      <Dialog open={!!player} onOpenChange={(open) => !open && setPlayer(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle className="truncate">{player?.title}</DialogTitle>
          </DialogHeader>
          {player && (
            <div className="p-4 pt-2">
              <MediaPlayer
                src={player.src}
                hlsSrc={player.hlsSrc}
                title={player.title}
                poster={player.poster}
                autoPlay
                className="w-full"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
