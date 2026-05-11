import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { Role } from '@prisma/client'
import { userService } from '../services/user.service'
import { sendSuccess, sendCreated, sendPaginated } from '../utils/apiResponse'
import { AuthenticatedRequest } from '../types'

const createUserSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30).regex(/^[a-z0-9_]+$/, 'Only lowercase letters, numbers, and underscores'),
  displayName: z.string().min(2).max(60),
  password: z.string().min(8).regex(
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
    'Must contain uppercase, lowercase, and number',
  ),
  role: z.nativeEnum(Role),
})

const updateUserSchema = z.object({
  displayName: z.string().min(2).max(60).optional(),
  email: z.string().email().optional(),
  role: z.nativeEnum(Role).optional(),
  isActive: z.boolean().optional(),
})

export class UserController {
  async findAll(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await userService.findAll(req.query as never)
      sendPaginated(res, result)
    } catch (err) {
      next(err)
    }
  }

  async findById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await userService.findById(req.params.id)
      sendSuccess(res, user)
    } catch (err) {
      next(err)
    }
  }

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = createUserSchema.parse(req.body)
      const adminId = (req as AuthenticatedRequest).user.id
      const user = await userService.create(dto, adminId)
      sendCreated(res, user, 'User created successfully')
    } catch (err) {
      next(err)
    }
  }

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = updateUserSchema.parse(req.body)
      const adminId = (req as AuthenticatedRequest).user.id
      const user = await userService.update(req.params.id, dto, adminId)
      sendSuccess(res, user, 'User updated successfully')
    } catch (err) {
      next(err)
    }
  }

  async delete(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const adminId = (req as AuthenticatedRequest).user.id
      await userService.delete(req.params.id, adminId)
      sendSuccess(res, null, 'User deleted successfully')
    } catch (err) {
      next(err)
    }
  }

  async getStats(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const stats = await userService.getStats()
      sendSuccess(res, stats)
    } catch (err) {
      next(err)
    }
  }
}

export const userController = new UserController()
