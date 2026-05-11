import { Role } from '@prisma/client'
import { Request } from 'express'

export interface JwtPayload {
  sub: string
  email: string
  role: Role
  iat?: number
  exp?: number
}

export interface AuthenticatedRequest extends Request {
  user: {
    id: string
    email: string
    role: Role
  }
}

export interface PaginationQuery {
  page?: number
  limit?: number
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  message?: string
  errors?: Record<string, string[]>
}

export interface UploadChunkMetadata {
  uploadId: string
  chunkIndex: number
  totalChunks: number
  fileName: string
  fileSize: number
  mimeType: string
}

export interface ContentFilterQuery extends PaginationQuery {
  genre?: string
  year?: number
  isPublished?: boolean
  tags?: string[]
}

export interface StreamTokenPayload {
  contentId: string
  contentType: string
  userId: string
  exp: number
}
