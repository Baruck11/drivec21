export type Role = 'ADMIN' | 'CONTENT_MANAGER' | 'BROADCASTER_VIEWER'
export type UploadStatus = 'PENDING' | 'PROCESSING' | 'TRANSCODING' | 'GENERATING_THUMBNAILS' | 'COMPLETED' | 'FAILED'
export type ContentType = 'SERIES' | 'SEASON' | 'EPISODE' | 'MOVIE' | 'PROGRAM'
export type PermissionLevel = 'EPISODE' | 'SEASON' | 'SERIES' | 'MOVIE' | 'PROGRAM'

export interface User {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: Role
  isActive: boolean
  lastLoginAt: string | null
  createdAt: string
  updatedAt: string
  _count?: { permissions: number; activityLogs: number }
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface Series {
  id: string
  title: string
  slug: string
  description: string | null
  synopsis: string | null
  genre: string[]
  tags: string[]
  thumbnailUrl: string | null
  bannerUrl: string | null
  year: number | null
  isPublished: boolean
  createdAt: string
  updatedAt: string
  seasons?: Season[]
  _count?: { seasons: number }
}

export interface Season {
  id: string
  seriesId: string
  number: number
  title: string
  description: string | null
  thumbnailUrl: string | null
  year: number | null
  isPublished: boolean
  createdAt: string
  updatedAt: string
  episodes?: Episode[]
  series?: Pick<Series, 'id' | 'title' | 'slug'>
  _count?: { episodes: number }
}

export interface Episode {
  id: string
  seasonId: string
  number: number
  title: string
  description: string | null
  duration: number | null
  thumbnailUrl: string | null
  videoUrl: string | null
  hlsUrl: string | null
  downloadUrl: string | null
  fileSize: number | null
  resolution: string | null
  isPublished: boolean
  uploadStatus: UploadStatus
  createdAt: string
  updatedAt: string
  season?: Pick<Season, 'id' | 'number' | 'title' | 'seriesId'> & {
    series?: Pick<Series, 'id' | 'title' | 'slug'>
  }
}

export interface Movie {
  id: string
  title: string
  slug: string
  description: string | null
  synopsis: string | null
  genre: string[]
  tags: string[]
  director: string | null
  duration: number | null
  year: number | null
  thumbnailUrl: string | null
  bannerUrl: string | null
  videoUrl: string | null
  hlsUrl: string | null
  downloadUrl: string | null
  fileSize: number | null
  isPublished: boolean
  uploadStatus: UploadStatus
  createdAt: string
  updatedAt: string
}

export interface Program {
  id: string
  title: string
  slug: string
  description: string | null
  category: string | null
  tags: string[]
  broadcastDate: string | null
  duration: number | null
  thumbnailUrl: string | null
  videoUrl: string | null
  hlsUrl: string | null
  downloadUrl: string | null
  isPublished: boolean
  uploadStatus: UploadStatus
  createdAt: string
  updatedAt: string
}

export interface ContentPermission {
  id: string
  userId: string
  contentType: ContentType
  permissionLevel: PermissionLevel
  seriesId: string | null
  seasonId: string | null
  episodeId: string | null
  movieId: string | null
  programId: string | null
  canStream: boolean
  canDownload: boolean
  expiresAt: string | null
  grantedAt: string
  user?: Pick<User, 'id' | 'email' | 'displayName' | 'avatarUrl' | 'role'>
  series?: Pick<Series, 'id' | 'title' | 'thumbnailUrl'>
  movie?: Pick<Movie, 'id' | 'title' | 'thumbnailUrl'>
  program?: Pick<Program, 'id' | 'title' | 'thumbnailUrl'>
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
}

export interface DashboardStats {
  series: number
  seasons: number
  episodes: number
  movies: number
  programs: number
}

export interface UserStats {
  total: number
  byRole: Record<Role, number>
  active: number
  inactive: number
}

export interface UploadSession {
  uploadId: string
  totalChunks: number
}

export interface StorageStats {
  totalBytes: number
  byType: {
    episodes: number
    movies: number
    programs: number
  }
}

// Extended types returned by getBroadcasterContent (getMyContent endpoint)
export interface BroadcasterEpisode {
  id: string
  seasonId: string
  number: number
  title: string
  description: string | null
  duration: number | null
  thumbnailUrl: string | null
  videoUrl: string | null
  hlsUrl: string | null
  fileSize: number | null
  uploadStatus: UploadStatus
}

export interface BroadcasterSeason {
  id: string
  number: number
  title: string
  episodes: BroadcasterEpisode[]
}

export interface BroadcasterSeriesData {
  id: string
  title: string
  thumbnailUrl: string | null
  seasons: BroadcasterSeason[]
}

export interface BroadcasterPermission extends Omit<ContentPermission, 'series' | 'movie' | 'program'> {
  series?: BroadcasterSeriesData | null
  movie?: (Movie & { fileSize: number | null }) | null
  program?: (Program & { fileSize: number | null }) | null
}

export interface ChunkUploadState {
  uploadId: string
  fileName: string
  fileSize: number
  progress: number
  status: UploadStatus
  error?: string
}
