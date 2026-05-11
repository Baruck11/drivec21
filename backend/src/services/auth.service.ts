import bcrypt from 'bcryptjs'
import { prisma } from '../config/database'
import { AppError } from '../middleware/error.middleware'
import { signAccessToken, signRefreshToken, verifyRefreshToken, getRefreshTokenExpiryDate } from '../utils/jwt'
import { logger } from '../config/logger'

export interface LoginDto {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}

export interface AuthUser {
  id: string
  email: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: string
}

export class AuthService {
  async login(dto: LoginDto): Promise<{ user: AuthUser; tokens: AuthTokens }> {
    const user = await prisma.user.findUnique({
      where: { email: dto.email.toLowerCase().trim() },
    })

    if (!user || !user.isActive) {
      throw new AppError('Invalid credentials', 401)
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash)

    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401)
    }

    const tokens = await this.generateAndStoreTokens(user.id, user.email, user.role)

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    })

    await prisma.activityLog.create({
      data: {
        userId: user.id,
        action: 'LOGIN',
        description: 'User logged in',
      },
    })

    logger.info(`User ${user.email} logged in`)

    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
      tokens,
    }
  }

  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    let payload: { sub: string }

    try {
      payload = verifyRefreshToken(refreshToken)
    } catch {
      throw new AppError('Invalid refresh token', 401)
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    })

    if (!storedToken || storedToken.revokedAt || storedToken.expiresAt < new Date()) {
      throw new AppError('Refresh token expired or revoked', 401)
    }

    if (storedToken.userId !== payload.sub) {
      throw new AppError('Token mismatch', 401)
    }

    // Rotate the token
    await prisma.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date() },
    })

    return this.generateAndStoreTokens(
      storedToken.user.id,
      storedToken.user.email,
      storedToken.user.role,
    )
  }

  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: { userId, token: refreshToken },
        data: { revokedAt: new Date() },
      })
    } else {
      // Revoke all tokens for user
      await prisma.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      })
    }

    await prisma.activityLog.create({
      data: { userId, action: 'LOGOUT', description: 'User logged out' },
    })
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
      },
    })

    if (!user) throw new AppError('User not found', 404)
    return user
  }

  private async generateAndStoreTokens(
    userId: string,
    email: string,
    role: string,
  ): Promise<AuthTokens> {
    const accessToken = signAccessToken({ id: userId, email, role: role as never })
    const refreshToken = signRefreshToken({ id: userId })

    await prisma.refreshToken.deleteMany({
      where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    })

    await prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        expiresAt: getRefreshTokenExpiryDate(),
      },
    })

    return { accessToken, refreshToken }
  }
}

export const authService = new AuthService()
