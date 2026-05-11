import bcrypt from 'bcryptjs'
import { Role } from '@prisma/client'
import { prisma } from '../config/database'
import { AppError } from '../middleware/error.middleware'
import { buildPaginatedResponse, getPrismaSkipTake, parsePaginationQuery } from '../utils/pagination'
import { PaginationQuery, PaginatedResponse } from '../types'

export interface CreateUserDto {
  email: string
  username: string
  displayName: string
  password: string
  role: Role
}

export interface UpdateUserDto {
  displayName?: string
  email?: string
  role?: Role
  isActive?: boolean
  avatarUrl?: string
}

export interface UserRecord {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: Role
  isActive: boolean
  lastLoginAt: Date | null
  createdAt: Date
  updatedAt: Date
  _count?: {
    permissions: number
    activityLogs: number
  }
}

export class UserService {
  async findAll(query: PaginationQuery): Promise<PaginatedResponse<UserRecord>> {
    const { page, limit, search, sortBy, sortOrder } = parsePaginationQuery(query as Record<string, unknown>)
    const { skip, take } = getPrismaSkipTake(page, limit)

    const where = search
      ? {
          OR: [
            { email: { contains: search, mode: 'insensitive' as const } },
            { username: { contains: search, mode: 'insensitive' as const } },
            { displayName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {}

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          isActive: true,
          lastLoginAt: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { permissions: true, activityLogs: true } },
        },
      }),
      prisma.user.count({ where }),
    ])

    return buildPaginatedResponse(users as UserRecord[], total, page, limit)
  }

  async findById(id: string): Promise<UserRecord> {
    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { permissions: true, activityLogs: true } },
      },
    })

    if (!user) throw new AppError('User not found', 404)
    return user as UserRecord
  }

  async create(dto: CreateUserDto, createdById: string): Promise<UserRecord> {
    const exists = await prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    })

    if (exists) {
      throw new AppError('Email or username already in use', 409)
    }

    const passwordHash = await bcrypt.hash(dto.password, 12)

    const user = await prisma.user.create({
      data: {
        email: dto.email.toLowerCase().trim(),
        username: dto.username.toLowerCase().trim(),
        displayName: dto.displayName,
        passwordHash,
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: createdById,
        action: 'CREATE',
        description: `Created user ${user.email}`,
      },
    })

    return user as UserRecord
  }

  async update(id: string, dto: UpdateUserDto, updatedById: string): Promise<UserRecord> {
    await this.findById(id)

    const user = await prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    await prisma.activityLog.create({
      data: {
        userId: updatedById,
        action: 'UPDATE',
        description: `Updated user ${user.email}`,
      },
    })

    return user as UserRecord
  }

  async delete(id: string, deletedById: string): Promise<void> {
    const user = await this.findById(id)

    if (id === deletedById) {
      throw new AppError('Cannot delete your own account', 400)
    }

    await prisma.user.delete({ where: { id } })

    await prisma.activityLog.create({
      data: {
        userId: deletedById,
        action: 'DELETE',
        description: `Deleted user ${user.email}`,
      },
    })
  }

  async getStats(): Promise<{
    total: number
    byRole: Record<Role, number>
    active: number
    inactive: number
  }> {
    const [total, active, adminCount, cmCount, bvCount] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { isActive: true } }),
      prisma.user.count({ where: { role: Role.ADMIN } }),
      prisma.user.count({ where: { role: Role.CONTENT_MANAGER } }),
      prisma.user.count({ where: { role: Role.BROADCASTER_VIEWER } }),
    ])

    return {
      total,
      byRole: {
        ADMIN: adminCount,
        CONTENT_MANAGER: cmCount,
        BROADCASTER_VIEWER: bvCount,
      },
      active,
      inactive: total - active,
    }
  }
}

export const userService = new UserService()
