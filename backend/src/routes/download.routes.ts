import { Router, Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import archiver = require('archiver')
import { authenticate } from '../middleware/auth.middleware'
import { prisma } from '../config/database'
import { sendError } from '../utils/apiResponse'
import { AuthenticatedRequest } from '../types'
import { env } from '../config/env'
import { logger } from '../config/logger'

const router = Router()

router.use(authenticate)

function videoPathFromUrl(videoUrl: string): string {
  // videoUrl = "/storage/videos/{storedName}"
  const storedName = videoUrl.split('/').pop() ?? ''
  return path.join(env.STORAGE_PATH, 'videos', storedName)
}

// POST /api/v1/downloads/zip
// body: { type: 'season' | 'series', id: string, filename?: string }
router.post('/zip', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId   = (req as AuthenticatedRequest).user.id
    const { type, id, filename } = req.body

    if (!type || !id) {
      sendError(res, 'type and id are required', 400)
      return
    }

    type FileEntry = { diskPath: string; name: string }
    const files: FileEntry[] = []
    let zipName = (filename as string | undefined) ?? 'descarga'

    if (type === 'season') {
      const season = await prisma.season.findUnique({
        where: { id },
        include: {
          series: { select: { id: true, title: true } },
          episodes: { where: { uploadStatus: 'COMPLETED' }, orderBy: { number: 'asc' } },
        },
      })
      if (!season) { sendError(res, 'Temporada no encontrada', 404); return }

      const perm = await prisma.contentPermission.findFirst({
        where: {
          userId, revokedAt: null, canDownload: true,
          OR: [{ seriesId: season.seriesId }, { seasonId: id }],
        },
      })
      if (!perm) { sendError(res, 'Sin permiso de descarga', 403); return }

      zipName = `${season.series.title} - T${String(season.number).padStart(2,'0')} ${season.title}`

      for (const ep of season.episodes) {
        if (!ep.videoUrl) continue
        const diskPath = videoPathFromUrl(ep.videoUrl)
        if (!fs.existsSync(diskPath)) continue
        const ext = path.extname(diskPath)
        files.push({ diskPath, name: `${String(ep.number).padStart(2,'0')}. ${ep.title}${ext}` })
      }

    } else if (type === 'series') {
      const series = await prisma.series.findUnique({
        where: { id },
        include: {
          seasons: {
            orderBy: { number: 'asc' },
            include: { episodes: { where: { uploadStatus: 'COMPLETED' }, orderBy: { number: 'asc' } } },
          },
        },
      })
      if (!series) { sendError(res, 'Serie no encontrada', 404); return }

      const perm = await prisma.contentPermission.findFirst({
        where: { userId, seriesId: id, revokedAt: null, canDownload: true },
      })
      if (!perm) { sendError(res, 'Sin permiso de descarga', 403); return }

      zipName = series.title

      for (const season of series.seasons) {
        const seasonDir = `T${String(season.number).padStart(2,'0')} - ${season.title}`
        for (const ep of season.episodes) {
          if (!ep.videoUrl) continue
          const diskPath = videoPathFromUrl(ep.videoUrl)
          if (!fs.existsSync(diskPath)) continue
          const ext = path.extname(diskPath)
          files.push({
            diskPath,
            name: `${seasonDir}/${String(ep.number).padStart(2,'0')}. ${ep.title}${ext}`,
          })
        }
      }

    } else {
      sendError(res, 'Tipo de descarga no válido (season | series)', 400)
      return
    }

    if (files.length === 0) {
      sendError(res, 'No hay archivos disponibles para descargar', 404)
      return
    }

    const safeZipName = zipName.replace(/[/\\?%*:|"<>]/g, '-')
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(safeZipName)}.zip`)

    // Level 0 = store only (no compression) — video files are already compressed
    const archive = archiver('zip', { zlib: { level: 0 } })

    archive.on('error', (err: Error) => {
      logger.error('ZIP archive error', err)
      if (!res.headersSent) next(err)
    })

    archive.pipe(res)

    for (const f of files) {
      archive.file(f.diskPath, { name: f.name })
    }

    await archive.finalize()
    logger.info(`ZIP download: ${files.length} files → ${safeZipName} (user: ${userId})`)
  } catch (err) { next(err) }
})

export default router
