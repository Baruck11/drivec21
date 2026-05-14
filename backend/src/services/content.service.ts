import { prisma } from '../config/database'
import { UploadStatus } from '@prisma/client'
import { AppError } from '../middleware/error.middleware'
import { generateSlug } from '../utils/slug'
import { buildPaginatedResponse, getPrismaSkipTake, parsePaginationQuery } from '../utils/pagination'
import { PaginationQuery } from '../types'

export interface CreateSeriesDto {
  title: string
  description?: string
  synopsis?: string
  genre?: string[]
  tags?: string[]
  year?: number
  thumbnailUrl?: string
  bannerUrl?: string
}

export interface CreateSeasonDto {
  seriesId: string
  number: number
  title: string
  description?: string
  year?: number
  thumbnailUrl?: string
}

export interface CreateEpisodeDto {
  seasonId: string
  number: number
  title: string
  description?: string
  duration?: number
  thumbnailUrl?: string
}

export interface CreateMovieDto {
  title: string
  description?: string
  synopsis?: string
  genre?: string[]
  tags?: string[]
  director?: string
  year?: number
  thumbnailUrl?: string
  bannerUrl?: string
}

export interface CreateProgramDto {
  title: string
  description?: string
  synopsis?: string
  category?: string
  tags?: string[]
  broadcastDate?: Date
}

export class ContentService {
  // ── SERIES ──────────────────────────────────────────────────────────────────

  async findAllSeries(query: PaginationQuery) {
    const { page, limit, search, sortBy, sortOrder } = parsePaginationQuery(query as Record<string, unknown>)
    const { skip, take } = getPrismaSkipTake(page, limit)

    const where = search
      ? {
          OR: [
            { title: { contains: search, mode: 'insensitive' as const } },
            { description: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [data, total] = await Promise.all([
      prisma.series.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: { select: { seasons: true } },
        },
      }),
      prisma.series.count({ where }),
    ])

    return buildPaginatedResponse(data, total, page, limit)
  }

  async findSeriesById(id: string) {
    const series = await prisma.series.findUnique({
      where: { id },
      include: {
        seasons: {
          orderBy: { number: 'asc' },
          include: {
            _count: { select: { episodes: true } },
          },
        },
        _count: { select: { seasons: true } },
      },
    })

    if (!series) throw new AppError('Series not found', 404)
    return series
  }

  async createSeries(dto: CreateSeriesDto, createdById: string) {
    const slug = generateSlug(dto.title)
    const existing = await prisma.series.findUnique({ where: { slug } })

    const finalSlug = existing ? `${slug}-${Date.now()}` : slug

    const series = await prisma.series.create({
      data: { ...dto, slug: finalSlug },
    })

    await prisma.activityLog.create({
      data: {
        userId: createdById,
        action: 'CREATE',
        entityType: 'SERIES',
        seriesId: series.id,
        description: `Created series "${series.title}"`,
      },
    })

    return series
  }

  async updateSeries(id: string, dto: Partial<CreateSeriesDto>, updatedById: string) {
    const series = await prisma.series.update({
      where: { id },
      data: dto,
    })

    await prisma.activityLog.create({
      data: {
        userId: updatedById,
        action: 'UPDATE',
        entityType: 'SERIES',
        seriesId: id,
        description: `Updated series "${series.title}"`,
      },
    })

    return series
  }

  async deleteSeries(id: string, deletedById: string) {
    await prisma.series.delete({ where: { id } })

    await prisma.activityLog.create({
      data: {
        userId: deletedById,
        action: 'DELETE',
        entityType: 'SERIES',
        description: `Deleted series ${id}`,
      },
    })
  }

  async publishSeries(id: string, isPublished: boolean) {
    return prisma.series.update({ where: { id }, data: { isPublished } })
  }

  // ── SEASONS ──────────────────────────────────────────────────────────────────

  async findSeasonsBySeriesId(seriesId: string) {
    return prisma.season.findMany({
      where: { seriesId },
      orderBy: { number: 'asc' },
      include: {
        _count: { select: { episodes: true } },
      },
    })
  }

  async findSeasonById(id: string) {
    const season = await prisma.season.findUnique({
      where: { id },
      include: {
        series: { select: { id: true, title: true, slug: true } },
        episodes: { orderBy: { number: 'asc' } },
        _count: { select: { episodes: true } },
      },
    })

    if (!season) throw new AppError('Season not found', 404)
    return season
  }

  async createSeason(dto: CreateSeasonDto, createdById: string) {
    const season = await prisma.season.create({ data: dto })

    await prisma.activityLog.create({
      data: {
        userId: createdById,
        action: 'CREATE',
        description: `Created season ${season.number} for series ${dto.seriesId}`,
      },
    })

    return season
  }

  async updateSeason(id: string, dto: Partial<CreateSeasonDto>) {
    return prisma.season.update({ where: { id }, data: dto })
  }

  async deleteSeason(id: string) {
    return prisma.season.delete({ where: { id } })
  }

  // ── EPISODES ─────────────────────────────────────────────────────────────────

  async findEpisodesBySeasonId(seasonId: string) {
    return prisma.episode.findMany({
      where: { seasonId },
      orderBy: { number: 'asc' },
    })
  }

  async findEpisodeById(id: string) {
    const episode = await prisma.episode.findUnique({
      where: { id },
      include: {
        season: {
          select: {
            id: true,
            number: true,
            title: true,
            seriesId: true,
            series: { select: { id: true, title: true, slug: true } },
          },
        },
      },
    })

    if (!episode) throw new AppError('Episode not found', 404)
    return episode
  }

  async createEpisode(dto: CreateEpisodeDto, createdById: string) {
    const episode = await prisma.episode.create({ data: dto })

    await prisma.activityLog.create({
      data: {
        userId: createdById,
        action: 'CREATE',
        description: `Created episode ${episode.number} for season ${dto.seasonId}`,
      },
    })

    return episode
  }

  async updateEpisode(id: string, dto: Partial<CreateEpisodeDto & { isPublished?: boolean; uploadStatus?: string; uploadId?: string }>) {
    return prisma.episode.update({ where: { id }, data: dto as never })
  }

  async deleteEpisode(id: string) {
    return prisma.episode.delete({ where: { id } })
  }

  // ── MOVIES ───────────────────────────────────────────────────────────────────

  async findAllMovies(query: PaginationQuery) {
    const { page, limit, search, sortBy, sortOrder } = parsePaginationQuery(query as Record<string, unknown>)
    const { skip, take } = getPrismaSkipTake(page, limit)

    const where = search
      ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }] }
      : {}

    const [data, total] = await Promise.all([
      prisma.movie.findMany({ where, skip, take, orderBy: { [sortBy]: sortOrder } }),
      prisma.movie.count({ where }),
    ])

    return buildPaginatedResponse(data, total, page, limit)
  }

  async findMovieById(id: string) {
    const movie = await prisma.movie.findUnique({ where: { id } })
    if (!movie) throw new AppError('Movie not found', 404)
    return movie
  }

  async createMovie(dto: CreateMovieDto, createdById: string) {
    const slug = generateSlug(dto.title)
    const existing = await prisma.movie.findUnique({ where: { slug } })
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug

    const movie = await prisma.movie.create({ data: { ...dto, slug: finalSlug } })

    await prisma.activityLog.create({
      data: {
        userId: createdById,
        action: 'CREATE',
        entityType: 'MOVIE',
        movieId: movie.id,
        description: `Created movie "${movie.title}"`,
      },
    })

    return movie
  }

  async updateMovie(id: string, dto: Partial<CreateMovieDto & { isPublished?: boolean; uploadStatus?: string; uploadId?: string }>) {
    return prisma.movie.update({ where: { id }, data: dto as never })
  }

  async deleteMovie(id: string) {
    return prisma.movie.delete({ where: { id } })
  }

  // ── PROGRAMS ─────────────────────────────────────────────────────────────────

  async findAllPrograms(query: PaginationQuery) {
    const { page, limit, search, sortBy, sortOrder } = parsePaginationQuery(query as Record<string, unknown>)
    const { skip, take } = getPrismaSkipTake(page, limit)

    const where = search
      ? { OR: [{ title: { contains: search, mode: 'insensitive' as const } }] }
      : {}

    const [data, total] = await Promise.all([
      prisma.program.findMany({ where, skip, take, orderBy: { [sortBy]: sortOrder } }),
      prisma.program.count({ where }),
    ])

    return buildPaginatedResponse(data, total, page, limit)
  }

  async findProgramById(id: string) {
    const program = await prisma.program.findUnique({ where: { id } })
    if (!program) throw new AppError('Program not found', 404)
    return program
  }

  async createProgram(dto: CreateProgramDto, createdById: string) {
    const slug = generateSlug(dto.title)
    const existing = await prisma.program.findUnique({ where: { slug } })
    const finalSlug = existing ? `${slug}-${Date.now()}` : slug

    const program = await prisma.program.create({ data: { ...dto, slug: finalSlug } })

    await prisma.activityLog.create({
      data: {
        userId: createdById,
        action: 'CREATE',
        entityType: 'PROGRAM',
        programId: program.id,
        description: `Created program "${program.title}"`,
      },
    })

    return program
  }

  async updateProgram(id: string, dto: Partial<CreateProgramDto & { isPublished?: boolean; uploadStatus?: string; uploadId?: string }>) {
    return prisma.program.update({ where: { id }, data: dto as never })
  }

  async deleteProgram(id: string) {
    return prisma.program.delete({ where: { id } })
  }

  // ── STATS ─────────────────────────────────────────────────────────────────────

  async getDashboardStats() {
    const PROCESSING_STATUSES = [
      UploadStatus.PROCESSING,
      UploadStatus.TRANSCODING,
      UploadStatus.GENERATING_THUMBNAILS,
    ]

    const [
      series, seasons, episodes, movies, programs,
      epDone, epPending, epProc, epFailed,
      movDone, movPending, movProc, movFailed,
      progDone, progPending, progProc, progFailed,
    ] = await Promise.all([
      prisma.series.count(),
      prisma.season.count(),
      prisma.episode.count(),
      prisma.movie.count(),
      prisma.program.count(),
      prisma.episode.count({ where: { uploadStatus: UploadStatus.COMPLETED } }),
      prisma.episode.count({ where: { uploadStatus: UploadStatus.PENDING } }),
      prisma.episode.count({ where: { uploadStatus: { in: PROCESSING_STATUSES } } }),
      prisma.episode.count({ where: { uploadStatus: UploadStatus.FAILED } }),
      prisma.movie.count({ where: { uploadStatus: UploadStatus.COMPLETED } }),
      prisma.movie.count({ where: { uploadStatus: UploadStatus.PENDING } }),
      prisma.movie.count({ where: { uploadStatus: { in: PROCESSING_STATUSES } } }),
      prisma.movie.count({ where: { uploadStatus: UploadStatus.FAILED } }),
      prisma.program.count({ where: { uploadStatus: UploadStatus.COMPLETED } }),
      prisma.program.count({ where: { uploadStatus: UploadStatus.PENDING } }),
      prisma.program.count({ where: { uploadStatus: { in: PROCESSING_STATUSES } } }),
      prisma.program.count({ where: { uploadStatus: UploadStatus.FAILED } }),
    ])

    const total = episodes + movies + programs
    return {
      series, seasons, episodes, movies, programs,
      uploadStatus: {
        total,
        completed:  epDone   + movDone   + progDone,
        pending:    epPending + movPending + progPending,
        processing: epProc   + movProc   + progProc,
        failed:     epFailed + movFailed + progFailed,
      },
    }
  }
}

export const contentService = new ContentService()
