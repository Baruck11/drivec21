import { Request, Response, NextFunction } from 'express'
import { z } from 'zod'
import { ContentType, PermissionLevel } from '@prisma/client'
import { permissionService } from '../services/permission.service'
import { sendSuccess, sendCreated } from '../utils/apiResponse'
import { AuthenticatedRequest } from '../types'

const grantPermissionSchema = z.object({
  userId: z.string().cuid(),
  contentType: z.nativeEnum(ContentType),
  permissionLevel: z.nativeEnum(PermissionLevel),
  seriesId: z.string().cuid().optional(),
  seasonId: z.string().cuid().optional(),
  episodeId: z.string().cuid().optional(),
  movieId: z.string().cuid().optional(),
  programId: z.string().cuid().optional(),
  canStream: z.boolean().default(true),
  canDownload: z.boolean().default(false),
  expiresAt: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
})

export class PermissionController {
  async grant(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = grantPermissionSchema.parse(req.body)
      const grantedById = (req as AuthenticatedRequest).user.id
      const permission = await permissionService.grantPermission(dto, grantedById)
      sendCreated(res, permission, 'Permission granted')
    } catch (err) { next(err) }
  }

  async revoke(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const revokedById = (req as AuthenticatedRequest).user.id
      await permissionService.revokePermission(req.params.id, revokedById)
      sendSuccess(res, null, 'Permission revoked')
    } catch (err) { next(err) }
  }

  async getUserPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const permissions = await permissionService.getUserPermissions(req.params.userId)
      sendSuccess(res, permissions)
    } catch (err) { next(err) }
  }

  async getContentPermissions(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { contentType, contentId } = req.params
      const permissions = await permissionService.getPermissionsForContent(
        contentType as ContentType,
        contentId,
      )
      sendSuccess(res, permissions)
    } catch (err) { next(err) }
  }

  async getMyContent(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = (req as AuthenticatedRequest).user.id
      const content = await permissionService.getBroadcasterContent(userId)
      sendSuccess(res, content)
    } catch (err) { next(err) }
  }
}

export const permissionController = new PermissionController()
