import api from './api'
import { Series, Season, Episode, Movie, Program, PaginatedResponse, DashboardStats, StorageStats } from '@/types'

export const contentService = {
  // Stats
  async getStats(): Promise<DashboardStats> {
    const { data } = await api.get('/content/stats')
    return data.data
  },

  async getStorageStats(): Promise<StorageStats> {
    const { data } = await api.get('/content/storage')
    return data.data
  },

  // Series
  async getAllSeries(params?: Record<string, unknown>): Promise<PaginatedResponse<Series>> {
    const { data } = await api.get('/content/series', { params })
    return { data: data.data, meta: data.meta }
  },

  async getSeriesById(id: string): Promise<Series> {
    const { data } = await api.get(`/content/series/${id}`)
    return data.data
  },

  async createSeries(payload: Partial<Series>): Promise<Series> {
    const { data } = await api.post('/content/series', payload)
    return data.data
  },

  async updateSeries(id: string, payload: Partial<Series>): Promise<Series> {
    const { data } = await api.patch(`/content/series/${id}`, payload)
    return data.data
  },

  async deleteSeries(id: string): Promise<void> {
    await api.delete(`/content/series/${id}`)
  },

  async publishSeries(id: string, isPublished: boolean): Promise<Series> {
    const { data } = await api.patch(`/content/series/${id}/publish`, { isPublished })
    return data.data
  },

  // Seasons
  async getSeasonsBySeriesId(seriesId: string): Promise<Season[]> {
    const { data } = await api.get(`/content/series/${seriesId}/seasons`)
    return data.data
  },

  async getSeasonById(id: string): Promise<Season> {
    const { data } = await api.get(`/content/seasons/${id}`)
    return data.data
  },

  async createSeason(seriesId: string, payload: Partial<Season>): Promise<Season> {
    const { data } = await api.post(`/content/series/${seriesId}/seasons`, payload)
    return data.data
  },

  async updateSeason(id: string, payload: Partial<Season>): Promise<Season> {
    const { data } = await api.patch(`/content/seasons/${id}`, payload)
    return data.data
  },

  async deleteSeason(id: string): Promise<void> {
    await api.delete(`/content/seasons/${id}`)
  },

  // Episodes
  async getEpisodesBySeasonId(seasonId: string): Promise<Episode[]> {
    const { data } = await api.get(`/content/seasons/${seasonId}/episodes`)
    return data.data
  },

  async getEpisodeById(id: string): Promise<Episode> {
    const { data } = await api.get(`/content/episodes/${id}`)
    return data.data
  },

  async createEpisode(seasonId: string, payload: Partial<Episode>): Promise<Episode> {
    const { data } = await api.post(`/content/seasons/${seasonId}/episodes`, payload)
    return data.data
  },

  async updateEpisode(id: string, payload: Partial<Episode>): Promise<Episode> {
    const { data } = await api.patch(`/content/episodes/${id}`, payload)
    return data.data
  },

  async deleteEpisode(id: string): Promise<void> {
    await api.delete(`/content/episodes/${id}`)
  },

  // Movies
  async getAllMovies(params?: Record<string, unknown>): Promise<PaginatedResponse<Movie>> {
    const { data } = await api.get('/content/movies', { params })
    return { data: data.data, meta: data.meta }
  },

  async getMovieById(id: string): Promise<Movie> {
    const { data } = await api.get(`/content/movies/${id}`)
    return data.data
  },

  async createMovie(payload: Partial<Movie>): Promise<Movie> {
    const { data } = await api.post('/content/movies', payload)
    return data.data
  },

  async updateMovie(id: string, payload: Partial<Movie>): Promise<Movie> {
    const { data } = await api.patch(`/content/movies/${id}`, payload)
    return data.data
  },

  async deleteMovie(id: string): Promise<void> {
    await api.delete(`/content/movies/${id}`)
  },

  // Programs
  async getAllPrograms(params?: Record<string, unknown>): Promise<PaginatedResponse<Program>> {
    const { data } = await api.get('/content/programs', { params })
    return { data: data.data, meta: data.meta }
  },

  async createProgram(payload: Partial<Program>): Promise<Program> {
    const { data } = await api.post('/content/programs', payload)
    return data.data
  },

  async updateProgram(id: string, payload: Partial<Program>): Promise<Program> {
    const { data } = await api.patch(`/content/programs/${id}`, payload)
    return data.data
  },

  async deleteProgram(id: string): Promise<void> {
    await api.delete(`/content/programs/${id}`)
  },
}
