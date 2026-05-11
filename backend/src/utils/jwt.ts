import jwt from 'jsonwebtoken'
import { v4 as uuidv4 } from 'uuid'
import { Role } from '@prisma/client'
import { env } from '../config/env'
import { JwtPayload } from '../types'

export function signAccessToken(payload: { id: string; email: string; role: Role }): string {
  return jwt.sign(
    { sub: payload.id, email: payload.email, role: payload.role },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  )
}

export function signRefreshToken(payload: { id: string }): string {
  return jwt.sign(
    { sub: payload.id, jti: uuidv4() },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN },
  )
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload
}

export function verifyRefreshToken(token: string): { sub: string } {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as { sub: string }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload
  } catch {
    return null
  }
}

export function getRefreshTokenExpiryDate(): Date {
  const days = parseInt(env.JWT_REFRESH_EXPIRES_IN.replace('d', ''), 10)
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}
