import axios from 'axios'
import api from './api'
import { User, AuthTokens } from '@/types'

export interface LoginPayload {
  email: string
  password: string
}

export const authService = {
  async login(payload: LoginPayload): Promise<{ user: User; tokens: AuthTokens }> {
    try {
      const { data } = await api.post('/auth/login', payload)
      const result = data.data as { user: User; tokens: AuthTokens }
      if (!result?.user || !result?.tokens) {
        throw new Error('Respuesta inesperada del servidor')
      }
      return result
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message = error.response?.data?.message ?? 'Credenciales incorrectas'
        throw new Error(message)
      }
      throw error
    }
  },

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const { data } = await api.post('/auth/refresh', { refreshToken })
    return data.data
  },

  async logout(refreshToken?: string): Promise<void> {
    await api.post('/auth/logout', { refreshToken })
  },

  async getMe(): Promise<User> {
    const { data } = await api.get('/auth/me')
    return data.data
  },
}
