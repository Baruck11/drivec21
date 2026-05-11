'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { User } from '@/types'
import { authService } from '@/services/auth.service'

interface AuthStore {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  isAuthenticated: boolean
  isLoading: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  setUser: (user: User) => void
  initialize: () => Promise<void>
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      login: async (email, password) => {
        set({ isLoading: true })
        try {
          const { user, tokens } = await authService.login({ email, password })
          localStorage.setItem('accessToken', tokens.accessToken)
          localStorage.setItem('refreshToken', tokens.refreshToken)
          // Cookie needed so Next.js middleware can detect the session on navigation
          document.cookie = `accessToken=${tokens.accessToken}; path=/; SameSite=Lax`
          set({
            user,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          })
        } catch (err) {
          set({ isLoading: false })
          throw err
        }
      },

      logout: async () => {
        const { refreshToken } = get()
        try {
          await authService.logout(refreshToken ?? undefined)
        } catch {
          // Ignore logout errors
        } finally {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            isAuthenticated: false,
          })
        }
      },

      refreshAuth: async () => {
        const { refreshToken } = get()
        if (!refreshToken) return

        try {
          const tokens = await authService.refresh(refreshToken)
          localStorage.setItem('accessToken', tokens.accessToken)
          localStorage.setItem('refreshToken', tokens.refreshToken)
          document.cookie = `accessToken=${tokens.accessToken}; path=/; SameSite=Lax`
          set({ accessToken: tokens.accessToken, refreshToken: tokens.refreshToken })
        } catch {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          document.cookie = 'accessToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
          set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
        }
      },

      setUser: (user) => set({ user }),

      initialize: async () => {
        const accessToken = localStorage.getItem('accessToken')
        if (!accessToken) return

        set({ isLoading: true })
        try {
          const user = await authService.getMe()
          set({ user, isAuthenticated: true, isLoading: false })
        } catch {
          localStorage.removeItem('accessToken')
          localStorage.removeItem('refreshToken')
          set({ user: null, isAuthenticated: false, isLoading: false })
        }
      },
    }),
    {
      name: 'capital21-auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
