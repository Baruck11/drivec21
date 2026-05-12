'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Shield, Play, ChevronDown, ChevronUp, Tv, Film, Video,
  Search, UserCheck, UserX, Loader2, Check, X as XIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { permissionService } from '@/services/permission.service'
import { userService } from '@/services/user.service'
import { contentService } from '@/services/content.service'
import { toStorageUrl } from '@/services/download.service'
import { formatDuration } from '@/lib/utils'
import type { ContentPermission, ContentType, User, Series, Season, Episode, Movie, Program } from '@/types'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { EmptyState } from '@/components/ui/empty-state'
import { MediaPlayer } from '@/components/ui/media-player'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet'

// ─── Types ───────────────────────────────────────────────────────────────────

interface PermTarget {
  contentType: ContentType
  contentId: string
  title: string
}

interface PlayerState {
  title: string
  src: string
  hlsSrc?: string
  poster?: string
}

interface GrantConfig {
  canStream: boolean
  canDownload: boolean
}

// ─── Permission Sheet ────────────────────────────────────────────────────────

interface PermissionSheetProps {
  target: PermTarget | null
  users: User[]
  onClose: () => void
}

function PermissionSheet({ target, users, onClose }: PermissionSheetProps) {
  const [perms, setPerms] = useState<ContentPermission[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [grantConfig, setGrantConfig] = useState<Record<string, GrantConfig>>({})
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    if (!target) return
    setIsLoading(true)
    try {
      const data = await permissionService.getContentPermissions(target.contentType, target.contentId)
      setPerms(data)
    } finally {
      setIsLoading(false)
    }
  }, [target])

  useEffect(() => {
    setPerms([])
    setGrantConfig({})
    setSearch('')
    if (target) load()
  }, [target, load])

  const permByUser = Object.fromEntries(perms.map((p) => [p.user?.id ?? '', p]))

  const handleGrant = async (user: User) => {
    if (!target) return
    const cfg = grantConfig[user.id] ?? { canStream: true, canDownload: false }
    setPending((p) => ({ ...p, [user.id]: true }))
    try {
      const contentIdField: Record<string, string> = {
        SERIES: 'seriesId', SEASON: 'seasonId', EPISODE: 'episodeId',
        MOVIE: 'movieId', PROGRAM: 'programId',
      }
      await permissionService.grantPermission({
        userId: user.id,
        contentType: target.contentType,
        permissionLevel: target.contentType as never,
        [contentIdField[target.contentType]]: target.contentId,
        canStream: cfg.canStream,
        canDownload: cfg.canDownload,
      })
      toast.success(`Acceso otorgado a ${user.displayName}`)
      await load()
    } catch {
      toast.error('Error al otorgar permiso')
    } finally {
      setPending((p) => ({ ...p, [user.id]: false }))
    }
  }

  const handleRevoke = async (permId: string, userId: string, name: string) => {
    setPending((p) => ({ ...p, [userId]: true }))
    try {
      await permissionService.revokePermission(permId)
      toast.success(`Acceso revocado a ${name}`)
      await load()
    } catch {
      toast.error('Error al revocar permiso')
    } finally {
      setPending((p) => ({ ...p, [userId]: false }))
    }
  }

  const handleModify = async (perm: ContentPermission, patch: Partial<GrantConfig>) => {
    if (!target || !perm.user) return
    const userId = perm.user.id
    setPending((p) => ({ ...p, [userId]: true }))
    try {
      const contentIdField: Record<string, string> = {
        SERIES: 'seriesId', SEASON: 'seasonId', EPISODE: 'episodeId',
        MOVIE: 'movieId', PROGRAM: 'programId',
      }
      await permissionService.grantPermission({
        userId,
        contentType: target.contentType,
        permissionLevel: target.contentType as never,
        [contentIdField[target.contentType]]: target.contentId,
        canStream: patch.canStream ?? perm.canStream,
        canDownload: patch.canDownload ?? perm.canDownload,
      })
      await load()
    } catch {
      toast.error('Error al modificar permiso')
    } finally {
      setPending((p) => ({ ...p, [userId]: false }))
    }
  }

  const filteredUsers = users.filter(
    (u) =>
      search === '' ||
      u.displayName.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  )

  const withAccess    = filteredUsers.filter((u) => permByUser[u.id])
  const withoutAccess = filteredUsers.filter((u) => !permByUser[u.id])

  const contentTypeLabel: Record<string, string> = {
    SERIES: 'Serie', SEASON: 'Temporada', EPISODE: 'Episodio',
    MOVIE: 'Película', PROGRAM: 'Programa',
  }

  return (
    <Sheet open={!!target} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto flex flex-col gap-0 p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center gap-2 mb-1">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              {target ? contentTypeLabel[target.contentType] : ''}
            </span>
          </div>
          <SheetTitle className="leading-snug line-clamp-2">{target?.title}</SheetTitle>
          <SheetDescription>
            Gestiona qué televisoras tienen acceso a este contenido.
          </SheetDescription>
        </SheetHeader>

        <div className="px-6 py-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar televisora…"
              className="pl-9 h-8 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
            </div>
          ) : (
            <>
              {/* With access */}
              {withAccess.length > 0 && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <UserCheck className="h-3.5 w-3.5" /> Con acceso ({withAccess.length})
                  </p>
                  {withAccess.map((user) => {
                    const perm = permByUser[user.id]
                    const isBusy = pending[user.id]
                    return (
                      <div key={user.id} className="rounded-lg border p-3 space-y-2.5">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs">
                              {user.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{user.displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-destructive hover:text-destructive gap-1.5 shrink-0"
                            disabled={isBusy}
                            onClick={() => handleRevoke(perm.id, user.id, user.displayName)}
                          >
                            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <XIcon className="h-3 w-3" />}
                            Revocar
                          </Button>
                        </div>

                        <div className="flex items-center gap-4 pl-10">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <Switch
                              className="h-4 w-7"
                              checked={perm.canStream}
                              disabled={isBusy}
                              onCheckedChange={(v) => handleModify(perm, { canStream: v })}
                            />
                            Streaming
                          </label>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <Switch
                              className="h-4 w-7"
                              checked={perm.canDownload}
                              disabled={isBusy}
                              onCheckedChange={(v) => handleModify(perm, { canDownload: v })}
                            />
                            Descarga
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </section>
              )}

              {/* Without access */}
              {withoutAccess.length > 0 && (
                <section className="space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                    <UserX className="h-3.5 w-3.5" /> Sin acceso ({withoutAccess.length})
                  </p>
                  {withoutAccess.map((user) => {
                    const cfg = grantConfig[user.id] ?? { canStream: true, canDownload: false }
                    const isBusy = pending[user.id]
                    const setConfig = (patch: Partial<GrantConfig>) =>
                      setGrantConfig((prev) => ({ ...prev, [user.id]: { ...cfg, ...patch } }))

                    return (
                      <div key={user.id} className="rounded-lg border p-3 space-y-2.5 bg-muted/30">
                        <div className="flex items-center gap-2.5">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarFallback className="text-xs bg-muted">
                              {user.displayName.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-muted-foreground">{user.displayName}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                          </div>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1.5 shrink-0"
                            disabled={isBusy}
                            onClick={() => handleGrant(user)}
                          >
                            {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                            Otorgar
                          </Button>
                        </div>

                        <div className="flex items-center gap-4 pl-10">
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <Switch
                              className="h-4 w-7"
                              checked={cfg.canStream}
                              onCheckedChange={(v) => setConfig({ canStream: v })}
                            />
                            Streaming
                          </label>
                          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                            <Switch
                              className="h-4 w-7"
                              checked={cfg.canDownload}
                              onCheckedChange={(v) => setConfig({ canDownload: v })}
                            />
                            Descarga
                          </label>
                        </div>
                      </div>
                    )
                  })}
                </section>
              )}

              {filteredUsers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No se encontraron televisoras
                </p>
              )}
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Episode row ─────────────────────────────────────────────────────────────

interface EpRowProps {
  episode: Episode
  onPlay: (ep: Episode) => void
  onPerms: (ep: Episode) => void
}

function EpisodeRow({ episode, onPlay, onPerms }: EpRowProps) {
  const ready = episode.uploadStatus === 'COMPLETED'
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted/40 transition-colors rounded-md">
      <span className="text-xs font-mono text-muted-foreground w-6 shrink-0 text-right">
        {String(episode.number).padStart(2, '0')}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${!ready ? 'text-muted-foreground' : ''}`}>{episode.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {episode.duration && (
            <span className="text-xs text-muted-foreground">{formatDuration(episode.duration)}</span>
          )}
          {!ready && (
            <Badge variant="outline" className="text-xs h-4 px-1">{episode.uploadStatus === 'FAILED' ? 'Error' : 'Procesando'}</Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {ready && (episode.hlsUrl ?? episode.videoUrl) && (
          <Button size="sm" variant="secondary" className="h-7 gap-1 text-xs" onClick={() => onPlay(episode)}>
            <Play className="h-3 w-3 fill-current" /> Ver
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => onPerms(episode)}>
          <Shield className="h-3 w-3" /> Permisos
        </Button>
      </div>
    </div>
  )
}

// ─── Season row ───────────────────────────────────────────────────────────────

interface SeasonRowProps {
  season: Season
  onPerms: (season: Season) => void
  onPlayEpisode: (ep: Episode) => void
  onEpisodePerms: (ep: Episode) => void
}

function SeasonRow({ season, onPerms, onPlayEpisode, onEpisodePerms }: SeasonRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [episodes, setEpisodes] = useState<Episode[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const expand = async () => {
    if (!expanded && episodes === null) {
      setIsLoading(true)
      try {
        const data = await contentService.getEpisodesBySeasonId(season.id)
        setEpisodes(data)
      } finally {
        setIsLoading(false)
      }
    }
    setExpanded((v) => !v)
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 px-3 py-2.5 bg-muted/20 hover:bg-muted/40 transition-colors">
        <button className="flex items-center gap-2 flex-1 min-w-0 text-left" onClick={expand}>
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
          ) : expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          )}
          <span className="text-xs font-mono text-muted-foreground shrink-0">
            T{String(season.number).padStart(2, '0')}
          </span>
          <span className="text-sm font-medium truncate">{season.title}</span>
          {season._count && (
            <span className="text-xs text-muted-foreground shrink-0">
              · {season._count.episodes} ep.
            </span>
          )}
        </button>
        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs shrink-0" onClick={() => onPerms(season)}>
          <Shield className="h-3 w-3" /> Permisos temporada
        </Button>
      </div>

      {expanded && (
        <div className="divide-y divide-border/50 px-2 py-1">
          {episodes === null || isLoading ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : episodes.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Sin episodios</p>
          ) : (
            episodes.map((ep) => (
              <EpisodeRow
                key={ep.id}
                episode={ep}
                onPlay={onPlayEpisode}
                onPerms={onEpisodePerms}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Series card ──────────────────────────────────────────────────────────────

interface SeriesCardProps {
  series: Series
  onPerms: (series: Series) => void
  onPlayEpisode: (ep: Episode, seriesTitle: string) => void
  onSeasonPerms: (season: Season, seriesTitle: string) => void
  onEpisodePerms: (ep: Episode, seriesTitle: string) => void
}

function SeriesCard({ series, onPerms, onPlayEpisode, onSeasonPerms, onEpisodePerms }: SeriesCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [seasons, setSeasons] = useState<Season[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const expand = async () => {
    if (!expanded && seasons === null) {
      setIsLoading(true)
      try {
        const data = await contentService.getSeasonsBySeriesId(series.id)
        setSeasons(data)
      } finally {
        setIsLoading(false)
      }
    }
    setExpanded((v) => !v)
  }

  return (
    <div className="border rounded-xl overflow-hidden">
      {/* Series header */}
      <div className="flex items-center gap-4 p-4">
        {series.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toStorageUrl(series.thumbnailUrl)}
            alt={series.title}
            className="h-14 w-24 rounded-md object-cover shrink-0"
          />
        ) : (
          <div className="h-14 w-24 rounded-md bg-muted flex items-center justify-center shrink-0">
            <Tv className="h-6 w-6 text-muted-foreground/40" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-sm truncate">{series.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {series._count?.seasons ?? '?'} temporadas
            {series.isPublished
              ? <span className="ml-2 text-emerald-500">● Publicada</span>
              : <span className="ml-2 text-muted-foreground">● Borrador</span>}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button size="sm" variant="outline" className="gap-1.5 text-xs h-8" onClick={() => onPerms(series)}>
            <Shield className="h-3.5 w-3.5" /> Permisos serie
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={expand}>
            {isLoading
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : expanded
              ? <ChevronUp className="h-4 w-4" />
              : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {/* Seasons */}
      {expanded && (
        <div className="border-t px-4 py-3 space-y-2 bg-muted/10">
          {seasons === null || isLoading ? (
            <div className="py-4 flex justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : seasons.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Sin temporadas</p>
          ) : (
            seasons.map((season) => (
              <SeasonRow
                key={season.id}
                season={season}
                onPerms={(s) => onSeasonPerms(s, series.title)}
                onPlayEpisode={(ep) => onPlayEpisode(ep, series.title)}
                onEpisodePerms={(ep) => onEpisodePerms(ep, series.title)}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

// ─── Movie/Program card ───────────────────────────────────────────────────────

interface MediaCardProps {
  title: string
  thumbnailUrl?: string | null
  duration?: number | null
  videoUrl?: string | null
  hlsUrl?: string | null
  uploadStatus?: string
  type: 'movie' | 'program'
  onPlay: () => void
  onPerms: () => void
}

function MediaCard({ title, thumbnailUrl, duration, videoUrl, hlsUrl, uploadStatus, type, onPlay, onPerms }: MediaCardProps) {
  const Icon = type === 'movie' ? Film : Video
  const ready = uploadStatus === 'COMPLETED'
  const canPlay = ready && !!(hlsUrl ?? videoUrl)

  return (
    <div className="border rounded-xl overflow-hidden group">
      <div className="relative aspect-video bg-muted overflow-hidden">
        {thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={toStorageUrl(thumbnailUrl)}
            alt={title}
            className="h-full w-full object-cover transition-transform group-hover:scale-105 duration-300"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Icon className="h-10 w-10 text-muted-foreground/40" />
          </div>
        )}
        {duration && (
          <div className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-xs text-white font-mono">
            {formatDuration(duration)}
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="font-medium text-sm truncate">{title}</p>
        <div className="flex items-center gap-1.5 mt-2">
          {canPlay && (
            <Button size="sm" variant="secondary" className="h-7 gap-1 text-xs flex-1" onClick={onPlay}>
              <Play className="h-3 w-3 fill-current" /> Ver
            </Button>
          )}
          <Button size="sm" variant="outline" className="h-7 gap-1 text-xs flex-1" onClick={onPerms}>
            <Shield className="h-3 w-3" /> Permisos
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PermissionsPage() {
  const [allSeries, setAllSeries]   = useState<Series[]>([])
  const [allMovies, setAllMovies]   = useState<Movie[]>([])
  const [allPrograms, setAllPrograms] = useState<Program[]>([])
  const [users, setUsers]           = useState<User[]>([])
  const [isLoading, setIsLoading]   = useState(true)
  const [search, setSearch]         = useState('')

  const [player, setPlayer]         = useState<PlayerState | null>(null)
  const [permTarget, setPermTarget] = useState<PermTarget | null>(null)

  useEffect(() => {
    Promise.all([
      userService.findAll({ role: 'BROADCASTER_VIEWER', limit: 200 }),
      contentService.getAllSeries({ limit: 200 } as never),
      contentService.getAllMovies({ limit: 200 } as never),
      contentService.getAllPrograms({ limit: 200 } as never),
    ]).then(([u, s, m, p]) => {
      setUsers(u.data)
      setAllSeries(s.data)
      setAllMovies(m.data)
      setAllPrograms(p.data)
    }).finally(() => setIsLoading(false))
  }, [])

  const searchLC = search.toLowerCase()

  const filteredSeries   = searchLC ? allSeries.filter((s) => s.title.toLowerCase().includes(searchLC)) : allSeries
  const filteredMovies   = searchLC ? allMovies.filter((m) => m.title.toLowerCase().includes(searchLC)) : allMovies
  const filteredPrograms = searchLC ? allPrograms.filter((p) => p.title.toLowerCase().includes(searchLC)) : allPrograms

  const openPlayer = (title: string, videoUrl: string | null, hlsUrl: string | null, poster?: string | null) => {
    setPlayer({
      title,
      src: toStorageUrl(videoUrl) ?? '',
      hlsSrc: toStorageUrl(hlsUrl),
      poster: toStorageUrl(poster) ?? undefined,
    })
  }

  const openPerms = (contentType: ContentType, contentId: string, title: string) => {
    setPermTarget({ contentType, contentId, title })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de permisos</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visualiza y administra quién tiene acceso a cada contenido.
          </p>
        </div>
        <Badge variant="secondary" className="gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          {users.length} televisoras registradas
        </Badge>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar contenido…"
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Tabs defaultValue="series">
        <TabsList>
          <TabsTrigger value="series" className="gap-1.5">
            <Tv className="h-3.5 w-3.5" />
            Series {!isLoading && `(${allSeries.length})`}
          </TabsTrigger>
          <TabsTrigger value="movies" className="gap-1.5">
            <Film className="h-3.5 w-3.5" />
            Películas {!isLoading && `(${allMovies.length})`}
          </TabsTrigger>
          <TabsTrigger value="programs" className="gap-1.5">
            <Video className="h-3.5 w-3.5" />
            Programas {!isLoading && `(${allPrograms.length})`}
          </TabsTrigger>
        </TabsList>

        {/* ── Series ── */}
        <TabsContent value="series" className="mt-4 space-y-3">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
          ) : filteredSeries.length === 0 ? (
            <EmptyState icon={Tv} title="Sin series" description="No hay series registradas." />
          ) : (
            filteredSeries.map((series) => (
              <SeriesCard
                key={series.id}
                series={series}
                onPerms={(s) => openPerms('SERIES', s.id, s.title)}
                onPlayEpisode={(ep, seriesTitle) =>
                  openPlayer(`${seriesTitle} — ${ep.title}`, ep.videoUrl, ep.hlsUrl, ep.thumbnailUrl)
                }
                onSeasonPerms={(season, seriesTitle) =>
                  openPerms('SEASON', season.id, `${seriesTitle} · T${String(season.number).padStart(2, '0')} ${season.title}`)
                }
                onEpisodePerms={(ep, seriesTitle) =>
                  openPerms('EPISODE', ep.id, `${seriesTitle} — ${ep.title}`)
                }
              />
            ))
          )}
        </TabsContent>

        {/* ── Movies ── */}
        <TabsContent value="movies" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}
            </div>
          ) : filteredMovies.length === 0 ? (
            <EmptyState icon={Film} title="Sin películas" description="No hay películas registradas." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredMovies.map((movie) => (
                <MediaCard
                  key={movie.id}
                  title={movie.title}
                  thumbnailUrl={movie.thumbnailUrl}
                  duration={movie.duration}
                  videoUrl={movie.videoUrl}
                  hlsUrl={movie.hlsUrl}
                  uploadStatus={movie.uploadStatus}
                  type="movie"
                  onPlay={() => openPlayer(movie.title, movie.videoUrl, movie.hlsUrl, movie.thumbnailUrl)}
                  onPerms={() => openPerms('MOVIE', movie.id, movie.title)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Programs ── */}
        <TabsContent value="programs" className="mt-4">
          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="aspect-video rounded-xl" />)}
            </div>
          ) : filteredPrograms.length === 0 ? (
            <EmptyState icon={Video} title="Sin programas" description="No hay programas registrados." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredPrograms.map((prog) => (
                <MediaCard
                  key={prog.id}
                  title={prog.title}
                  thumbnailUrl={prog.thumbnailUrl}
                  duration={prog.duration}
                  videoUrl={prog.videoUrl}
                  hlsUrl={prog.hlsUrl}
                  uploadStatus={prog.uploadStatus}
                  type="program"
                  onPlay={() => openPlayer(prog.title, prog.videoUrl, prog.hlsUrl, prog.thumbnailUrl)}
                  onPerms={() => openPerms('PROGRAM', prog.id, prog.title)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Player dialog ── */}
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

      {/* ── Permission sheet ── */}
      <PermissionSheet
        target={permTarget}
        users={users}
        onClose={() => setPermTarget(null)}
      />
    </div>
  )
}
