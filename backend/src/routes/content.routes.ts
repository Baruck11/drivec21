import { Router, Request, Response, NextFunction } from 'express'
import { contentController } from '../controllers/content.controller'
import { authenticate, requireContentManager } from '../middleware/auth.middleware'
import { prisma } from '../config/database'
import { sendSuccess } from '../utils/apiResponse'

const router = Router()

router.use(authenticate)

// Stats (accessible by all authenticated)
router.get('/stats', contentController.getDashboardStats.bind(contentController))

// Storage usage — accessible by CONTENT_MANAGER and ADMIN
router.get('/storage', requireContentManager, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const [episodes, movies, programs] = await Promise.all([
      prisma.episode.aggregate({ _sum: { fileSize: true }, where: { uploadStatus: 'COMPLETED' } }),
      prisma.movie.aggregate({ _sum: { fileSize: true }, where: { uploadStatus: 'COMPLETED' } }),
      prisma.program.aggregate({ _sum: { fileSize: true }, where: { uploadStatus: 'COMPLETED' } }),
    ])

    const episodesBytes  = Number(episodes._sum.fileSize  ?? 0)
    const moviesBytes    = Number(movies._sum.fileSize    ?? 0)
    const programsBytes  = Number(programs._sum.fileSize  ?? 0)
    const totalBytes     = episodesBytes + moviesBytes + programsBytes

    sendSuccess(res, { totalBytes, byType: { episodes: episodesBytes, movies: moviesBytes, programs: programsBytes } })
  } catch (err) { next(err) }
})

// Series
router.get('/series', contentController.getAllSeries.bind(contentController))
router.get('/series/:id', contentController.getSeriesById.bind(contentController))
router.post('/series', requireContentManager, contentController.createSeries.bind(contentController))
router.patch('/series/:id', requireContentManager, contentController.updateSeries.bind(contentController))
router.delete('/series/:id', requireContentManager, contentController.deleteSeries.bind(contentController))
router.patch('/series/:id/publish', requireContentManager, contentController.publishSeries.bind(contentController))

// Seasons
router.get('/series/:seriesId/seasons', contentController.getSeasonsBySeries.bind(contentController))
router.get('/seasons/:id', contentController.getSeasonById.bind(contentController))
router.post('/series/:seriesId/seasons', requireContentManager, contentController.createSeason.bind(contentController))
router.patch('/seasons/:id', requireContentManager, contentController.updateSeason.bind(contentController))
router.delete('/seasons/:id', requireContentManager, contentController.deleteSeason.bind(contentController))

// Episodes
router.get('/seasons/:seasonId/episodes', contentController.getEpisodesBySeason.bind(contentController))
router.get('/episodes/:id', contentController.getEpisodeById.bind(contentController))
router.post('/seasons/:seasonId/episodes', requireContentManager, contentController.createEpisode.bind(contentController))
router.patch('/episodes/:id', requireContentManager, contentController.updateEpisode.bind(contentController))
router.delete('/episodes/:id', requireContentManager, contentController.deleteEpisode.bind(contentController))

// Movies
router.get('/movies', contentController.getAllMovies.bind(contentController))
router.get('/movies/:id', contentController.getMovieById.bind(contentController))
router.post('/movies', requireContentManager, contentController.createMovie.bind(contentController))
router.patch('/movies/:id', requireContentManager, contentController.updateMovie.bind(contentController))
router.delete('/movies/:id', requireContentManager, contentController.deleteMovie.bind(contentController))

// Programs
router.get('/programs', contentController.getAllPrograms.bind(contentController))
router.get('/programs/:id', contentController.getProgramById.bind(contentController))
router.post('/programs', requireContentManager, contentController.createProgram.bind(contentController))
router.patch('/programs/:id', requireContentManager, contentController.updateProgram.bind(contentController))
router.delete('/programs/:id', requireContentManager, contentController.deleteProgram.bind(contentController))

export default router
