import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { contentService } from '../services/content.service'
import { sendSuccess, sendCreated, sendPaginated } from '../utils/apiResponse'
import { AuthenticatedRequest } from '../types'

const createSeriesSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  synopsis: z.string().optional(),
  genre: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  thumbnailUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
})

const createSeasonSchema = z.object({
  number: z.number().int().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  year: z.number().int().optional(),
  thumbnailUrl: z.string().url().optional(),
})

const uploadStatusEnum = z.enum(['PENDING', 'PROCESSING', 'TRANSCODING', 'GENERATING_THUMBNAILS', 'COMPLETED', 'FAILED'])

const createEpisodeSchema = z.object({
  number: z.number().int().min(1),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  duration: z.number().int().min(0).optional(),
  thumbnailUrl: z.string().url().optional(),
})

const updateEpisodeSchema = createEpisodeSchema.partial().extend({
  uploadId: z.string().optional(),
  uploadStatus: uploadStatusEnum.optional(),
  isPublished: z.boolean().optional(),
})

const createMovieSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  synopsis: z.string().optional(),
  genre: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  director: z.string().optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  thumbnailUrl: z.string().url().optional(),
  bannerUrl: z.string().url().optional(),
})

const updateMovieSchema = createMovieSchema.partial().extend({
  uploadId: z.string().optional(),
  uploadStatus: uploadStatusEnum.optional(),
  isPublished: z.boolean().optional(),
})

const createProgramSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  synopsis: z.string().optional(),
  category: z.string().optional(),
  tags: z.array(z.string()).optional(),
  broadcastDate: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
})

const updateProgramSchema = createProgramSchema.partial().extend({
  uploadId: z.string().optional(),
  uploadStatus: uploadStatusEnum.optional(),
  isPublished: z.boolean().optional(),
})

export class ContentController {
  // ── SERIES ──────────────────────────────────────────────────────────────────

  async getAllSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await contentService.findAllSeries(req.query as never)
      sendPaginated(res, result)
    } catch (err) { next(err) }
  }

  async getSeriesById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const series = await contentService.findSeriesById(req.params.id)
      sendSuccess(res, series)
    } catch (err) { next(err) }
  }

  async createSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createSeriesSchema.parse(req.body)
      const userId = (req as AuthenticatedRequest).user.id
      const series = await contentService.createSeries(dto, userId)
      sendCreated(res, series, 'Series created')
    } catch (err) { next(err) }
  }

  async updateSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createSeriesSchema.partial().parse(req.body)
      const userId = (req as AuthenticatedRequest).user.id
      const series = await contentService.updateSeries(req.params.id, dto, userId)
      sendSuccess(res, series, 'Series updated')
    } catch (err) { next(err) }
  }

  async deleteSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user.id
      await contentService.deleteSeries(req.params.id, userId)
      sendSuccess(res, null, 'Series deleted')
    } catch (err) { next(err) }
  }

  async publishSeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { isPublished } = z.object({ isPublished: z.boolean() }).parse(req.body)
      const series = await contentService.publishSeries(req.params.id, isPublished)
      sendSuccess(res, series)
    } catch (err) { next(err) }
  }

  // ── SEASONS ──────────────────────────────────────────────────────────────────

  async getSeasonsBySeries(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const seasons = await contentService.findSeasonsBySeriesId(req.params.seriesId)
      sendSuccess(res, seasons)
    } catch (err) { next(err) }
  }

  async getSeasonById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const season = await contentService.findSeasonById(req.params.id)
      sendSuccess(res, season)
    } catch (err) { next(err) }
  }

  async createSeason(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createSeasonSchema.parse(req.body)
      const userId = (req as AuthenticatedRequest).user.id
      const season = await contentService.createSeason(
        { ...dto, seriesId: req.params.seriesId },
        userId,
      )
      sendCreated(res, season, 'Season created')
    } catch (err) { next(err) }
  }

  async updateSeason(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createSeasonSchema.partial().parse(req.body)
      const season = await contentService.updateSeason(req.params.id, dto)
      sendSuccess(res, season, 'Season updated')
    } catch (err) { next(err) }
  }

  async deleteSeason(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await contentService.deleteSeason(req.params.id)
      sendSuccess(res, null, 'Season deleted')
    } catch (err) { next(err) }
  }

  // ── EPISODES ─────────────────────────────────────────────────────────────────

  async getEpisodesBySeason(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const episodes = await contentService.findEpisodesBySeasonId(req.params.seasonId)
      sendSuccess(res, episodes)
    } catch (err) { next(err) }
  }

  async getEpisodeById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const episode = await contentService.findEpisodeById(req.params.id)
      sendSuccess(res, episode)
    } catch (err) { next(err) }
  }

  async createEpisode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createEpisodeSchema.parse(req.body)
      const userId = (req as AuthenticatedRequest).user.id
      const episode = await contentService.createEpisode(
        { ...dto, seasonId: req.params.seasonId },
        userId,
      )
      sendCreated(res, episode, 'Episode created')
    } catch (err) { next(err) }
  }

  async updateEpisode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = updateEpisodeSchema.parse(req.body)
      const episode = await contentService.updateEpisode(req.params.id, dto)
      sendSuccess(res, episode, 'Episode updated')
    } catch (err) { next(err) }
  }

  async deleteEpisode(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await contentService.deleteEpisode(req.params.id)
      sendSuccess(res, null, 'Episode deleted')
    } catch (err) { next(err) }
  }

  // ── MOVIES ───────────────────────────────────────────────────────────────────

  async getAllMovies(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await contentService.findAllMovies(req.query as never)
      sendPaginated(res, result)
    } catch (err) { next(err) }
  }

  async getMovieById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const movie = await contentService.findMovieById(req.params.id)
      sendSuccess(res, movie)
    } catch (err) { next(err) }
  }

  async createMovie(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createMovieSchema.parse(req.body)
      const userId = (req as AuthenticatedRequest).user.id
      const movie = await contentService.createMovie(dto, userId)
      sendCreated(res, movie, 'Movie created')
    } catch (err) { next(err) }
  }

  async updateMovie(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = updateMovieSchema.parse(req.body)
      const movie = await contentService.updateMovie(req.params.id, dto)
      sendSuccess(res, movie, 'Movie updated')
    } catch (err) { next(err) }
  }

  async deleteMovie(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await contentService.deleteMovie(req.params.id)
      sendSuccess(res, null, 'Movie deleted')
    } catch (err) { next(err) }
  }

  // ── PROGRAMS ─────────────────────────────────────────────────────────────────

  async getAllPrograms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await contentService.findAllPrograms(req.query as never)
      sendPaginated(res, result)
    } catch (err) { next(err) }
  }

  async getProgramById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const program = await contentService.findProgramById(req.params.id)
      sendSuccess(res, program)
    } catch (err) { next(err) }
  }

  async createProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createProgramSchema.parse(req.body)
      const userId = (req as AuthenticatedRequest).user.id
      const program = await contentService.createProgram(dto, userId)
      sendCreated(res, program, 'Program created')
    } catch (err) { next(err) }
  }

  async updateProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = updateProgramSchema.parse(req.body)
      const program = await contentService.updateProgram(req.params.id, dto)
      sendSuccess(res, program, 'Program updated')
    } catch (err) { next(err) }
  }

  async deleteProgram(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await contentService.deleteProgram(req.params.id)
      sendSuccess(res, null, 'Program deleted')
    } catch (err) { next(err) }
  }

  // ── STATS ─────────────────────────────────────────────────────────────────────

  async getDashboardStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await contentService.getDashboardStats()
      sendSuccess(res, stats)
    } catch (err) { next(err) }
  }
}

export const contentController = new ContentController()
