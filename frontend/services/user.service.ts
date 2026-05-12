import api from './api'
import { User, PaginatedResponse, UserStats } from '@/types'

export interface CreateUserPayload {
  email: string
  username: string
  displayName: string
  password: string
  role: string
}

export interface UpdateUserPayload {
  displayName?: string
  email?: string
  role?: string
  isActive?: boolean
}

export interface UserQueryParams {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  role?: string
}

export const userService = {
  async findAll(params?: UserQueryParams): Promise<PaginatedResponse<User>> {
    const { data } = await api.get('/users', { params })
    return { data: data.data, meta: data.meta }
  },

  async findById(id: string): Promise<User> {
    const { data } = await api.get(`/users/${id}`)
    return data.data
  },

  async create(payload: CreateUserPayload): Promise<User> {
    const { data } = await api.post('/users', payload)
    return data.data
  },

  async update(id: string, payload: UpdateUserPayload): Promise<User> {
    const { data } = await api.patch(`/users/${id}`, payload)
    return data.data
  },

  async delete(id: string): Promise<void> {
    await api.delete(`/users/${id}`)
  },

  async getStats(): Promise<UserStats> {
    const { data } = await api.get('/users/stats')
    return data.data
  },
}
