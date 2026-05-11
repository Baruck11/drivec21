import { Response, NextFunction } from 'express'
import { ContentType } from '@prisma/client'
import { prisma } from '../config/database'
import { AuthenticatedRequest } from '../types'
import { sendForbidden, sendNotFound } from '../utils/apiResponse'

export function checkContentPermission(contentType: ContentType, action: 'stream' | 'download') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const { user } = req
    const contentId = req.params.id || req.params.episodeId || req.params.movieId || req.params.programId

    if (user.role === 'ADMIN' || user.role === 'CONTENT_MANAGER') {
      next()
      return
    }

    const permission = await findUserPermission(user.id, contentType, contentId)

    if (!permission) {
      sendForbidden(res, 'You do not have access to this content')
      return
    }

    if (action === 'download' && !permission.canDownload) {
      sendForbidden(res, 'Download not permitted for this content')
      return
    }

    if (action === 'stream' && !permission.canStream) {
      sendForbidden(res, 'Streaming not permitted for this content')
      return
    }

    if (permission.expiresAt && permission.expiresAt < new Date()) {
      sendForbidden(res, 'Your access to this content has expired')
      return
    }

    next()
  }
}

async function findUserPermission(userId: string, contentType: ContentType, contentId: string) {
  return prisma.contentPermission.findFirst({
    where: {
      userId,
      revokedAt: null,
      OR: [
        { contentType, episodeId: contentId },
        { contentType: 'SEASON', seasonId: contentId },
        { contentType: 'SERIES', seriesId: contentId },
        { contentType: 'MOVIE', movieId: contentId },
        { contentType: 'PROGRAM', programId: contentId },
        // Cascade: season permission grants episode access
        {
          contentType: 'SEASON',
          season: { episodes: { some: { id: contentId } } },
        },
        // Cascade: series permission grants all episodes
        {
          contentType: 'SERIES',
          series: { seasons: { some: { episodes: { some: { id: contentId } } } } },
        },
      ],
    },
  })
}

export function checkEpisodeAccess(action: 'stream' | 'download' = 'stream') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const { user } = req

    if (user.role === 'ADMIN' || user.role === 'CONTENT_MANAGER') {
      next()
      return
    }

    const episodeId = req.params.episodeId || req.params.id

    const episode = await prisma.episode.findUnique({
      where: { id: episodeId },
      select: { id: true, seasonId: true, season: { select: { seriesId: true } } },
    })

    if (!episode) {
      sendNotFound(res, 'Episode not found')
      return
    }

    const permission = await prisma.contentPermission.findFirst({
      where: {
        userId: user.id,
        revokedAt: null,
        OR: [
          { contentType: 'EPISODE', episodeId },
          { contentType: 'SEASON', seasonId: episode.seasonId },
          { contentType: 'SERIES', seriesId: episode.season.seriesId },
        ],
      },
    })

    if (!permission) {
      sendForbidden(res, 'Access denied')
      return
    }

    if (action === 'download' && !permission.canDownload) {
      sendForbidden(res, 'Download not permitted')
      return
    }

    if (permission.expiresAt && permission.expiresAt < new Date()) {
      sendForbidden(res, 'Access expired')
      return
    }

    next()
  }
}
