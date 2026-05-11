import { ContentType, PermissionLevel } from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/error.middleware'

export interface GrantPermissionDto {
  userId: string
  contentType: ContentType
  permissionLevel: PermissionLevel
  seriesId?: string
  seasonId?: string
  episodeId?: string
  movieId?: string
  programId?: string
  canStream?: boolean
  canDownload?: boolean
  expiresAt?: Date
}

export class PermissionService {
  async grantPermission(dto: GrantPermissionDto, grantedById: string) {
    // Check if permission already exists (and not revoked)
    const existing = await prisma.contentPermission.findFirst({
      where: {
        userId: dto.userId,
        contentType: dto.contentType,
        seriesId: dto.seriesId,
        seasonId: dto.seasonId,
        episodeId: dto.episodeId,
        movieId: dto.movieId,
        programId: dto.programId,
        revokedAt: null,
      },
    })

    if (existing) {
      // Update existing permission
      return prisma.contentPermission.update({
        where: { id: existing.id },
        data: {
          canStream: dto.canStream ?? existing.canStream,
          canDownload: dto.canDownload ?? existing.canDownload,
          expiresAt: dto.expiresAt,
        },
        include: { user: { select: { email: true, displayName: true } } },
      })
    }

    const permission = await prisma.contentPermission.create({
      data: { ...dto, grantedById },
      include: { user: { select: { email: true, displayName: true } } },
    })

    await prisma.activityLog.create({
      data: {
        userId: grantedById,
        action: 'PERMISSION_GRANTED',
        entityType: dto.contentType,
        seriesId: dto.seriesId,
        movieId: dto.movieId,
        programId: dto.programId,
        description: `Granted ${dto.contentType} permission to user ${dto.userId}`,
      },
    })

    return permission
  }

  async revokePermission(permissionId: string, revokedById: string) {
    const permission = await prisma.contentPermission.findUnique({
      where: { id: permissionId },
    })

    if (!permission) throw new AppError('Permission not found', 404)
    if (permission.revokedAt) throw new AppError('Permission already revoked', 400)

    await prisma.contentPermission.update({
      where: { id: permissionId },
      data: { revokedAt: new Date() },
    })

    await prisma.activityLog.create({
      data: {
        userId: revokedById,
        action: 'PERMISSION_REVOKED',
        entityType: permission.contentType,
        description: `Revoked permission ${permissionId} from user ${permission.userId}`,
      },
    })
  }

  async getUserPermissions(userId: string) {
    return prisma.contentPermission.findMany({
      where: { userId, revokedAt: null },
      include: {
        series: { select: { id: true, title: true, thumbnailUrl: true } },
        season: { select: { id: true, title: true, number: true } },
        episode: { select: { id: true, title: true, number: true } },
        movie: { select: { id: true, title: true, thumbnailUrl: true } },
        program: { select: { id: true, title: true, thumbnailUrl: true } },
      },
      orderBy: { grantedAt: 'desc' },
    })
  }

  async getPermissionsForContent(contentType: ContentType, contentId: string) {
    const fieldMap: Record<string, Record<string, string>> = {
      SERIES: { seriesId: contentId },
      SEASON: { seasonId: contentId },
      EPISODE: { episodeId: contentId },
      MOVIE: { movieId: contentId },
      PROGRAM: { programId: contentId },
    }

    return prisma.contentPermission.findMany({
      where: { ...fieldMap[contentType], revokedAt: null },
      include: {
        user: { select: { id: true, email: true, displayName: true, avatarUrl: true, role: true } },
      },
      orderBy: { grantedAt: 'desc' },
    })
  }

  async getBroadcasterContent(userId: string) {
    const permissions = await prisma.contentPermission.findMany({
      where: { userId, revokedAt: null },
      include: {
        series: {
          include: {
            seasons: {
              orderBy: { number: 'asc' },
              include: {
                episodes: {
                  orderBy: { number: 'asc' },
                  select: {
                    id: true, seasonId: true, number: true, title: true,
                    description: true, duration: true, thumbnailUrl: true,
                    videoUrl: true, hlsUrl: true, fileSize: true, uploadStatus: true,
                  },
                },
              },
            },
          },
        },
        movie: true,
        program: true,
      },
    })

    // Convert BigInt fileSize to number for JSON serialization
    return permissions.map((p) => ({
      ...p,
      series: p.series
        ? {
            ...p.series,
            seasons: p.series.seasons.map((s) => ({
              ...s,
              episodes: s.episodes.map((e) => ({
                ...e,
                fileSize: e.fileSize != null ? Number(e.fileSize) : null,
              })),
            })),
          }
        : null,
      movie: p.movie
        ? { ...p.movie, fileSize: p.movie.fileSize != null ? Number(p.movie.fileSize) : null }
        : null,
      program: p.program
        ? { ...p.program, fileSize: p.program.fileSize != null ? Number(p.program.fileSize) : null }
        : null,
    }))
  }
}

export const permissionService = new PermissionService()
