import { Request, Response, NextFunction } from 'express'
import { Role } from '@prisma/client'
import { verifyAccessToken } from '../utils/jwt'
import { sendUnauthorized, sendForbidden } from '../utils/apiResponse'
import { AuthenticatedRequest } from '../types'

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization

  if (!authHeader?.startsWith('Bearer ')) {
    sendUnauthorized(res, 'No token provided')
    return
  }

  const token = authHeader.substring(7)

  try {
    const payload = verifyAccessToken(token)
    ;(req as AuthenticatedRequest).user = {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    }
    next()
  } catch {
    sendUnauthorized(res, 'Invalid or expired token')
  }
}

export function authorize(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as AuthenticatedRequest).user

    if (!user) {
      sendUnauthorized(res)
      return
    }

    if (!roles.includes(user.role)) {
      sendForbidden(res, 'Insufficient permissions')
      return
    }

    next()
  }
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  authorize(Role.ADMIN)(req, res, next)
}

export function requireContentManager(req: Request, res: Response, next: NextFunction): void {
  authorize(Role.ADMIN, Role.CONTENT_MANAGER)(req, res, next)
}
