import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authService } from '../services/auth.service'
import { sendSuccess, sendCreated } from '../utils/apiResponse'
import { AuthenticatedRequest } from '../types'

const loginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export class AuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = loginSchema.parse(req.body)
      const result = await authService.login(dto)
      sendCreated(res, result, 'Login successful')
    } catch (err) {
      next(err)
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = refreshSchema.parse(req.body)
      const tokens = await authService.refreshTokens(refreshToken)
      sendSuccess(res, tokens, 'Tokens refreshed')
    } catch (err) {
      next(err)
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user
      const { refreshToken } = req.body
      await authService.logout(user.id, refreshToken)
      sendSuccess(res, null, 'Logged out successfully')
    } catch (err) {
      next(err)
    }
  }

  async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = (req as AuthenticatedRequest).user
      const profile = await authService.getMe(user.id)
      sendSuccess(res, profile)
    } catch (err) {
      next(err)
    }
  }
}

export const authController = new AuthController()
