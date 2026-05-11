import { PaginationQuery, PaginatedResponse } from '../types'

export const DEFAULT_PAGE = 1
export const DEFAULT_LIMIT = 20
export const MAX_LIMIT = 100

export function parsePaginationQuery(query: Record<string, unknown>): Required<PaginationQuery> {
  const page = Math.max(1, parseInt(String(query.page ?? DEFAULT_PAGE), 10))
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(String(query.limit ?? DEFAULT_LIMIT), 10)))
  const search = String(query.search ?? '').trim() || undefined
  const sortBy = String(query.sortBy ?? 'createdAt')
  const sortOrder = query.sortOrder === 'asc' ? 'asc' : 'desc'

  return { page, limit, search: search ?? '', sortBy, sortOrder }
}

export function buildPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / limit)
  return {
    data,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    },
  }
}

export function getPrismaSkipTake(page: number, limit: number) {
  return {
    skip: (page - 1) * limit,
    take: limit,
  }
}
