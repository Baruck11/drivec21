import { Response } from 'express'
import { ApiResponse, PaginatedResponse } from '../types'

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message?: string,
  statusCode = 200,
): Response => {
  const response: ApiResponse<T> = { success: true, data, message }
  return res.status(statusCode).json(response)
}

export const sendCreated = <T>(res: Response, data: T, message?: string): Response =>
  sendSuccess(res, data, message, 201)

export const sendPaginated = <T>(
  res: Response,
  paginatedData: PaginatedResponse<T>,
  message?: string,
): Response => {
  return res.status(200).json({ success: true, ...paginatedData, message })
}

export const sendError = (
  res: Response,
  message: string,
  statusCode = 400,
  errors?: Record<string, string[]>,
): Response => {
  const response: ApiResponse = { success: false, message, errors }
  return res.status(statusCode).json(response)
}

export const sendUnauthorized = (res: Response, message = 'Unauthorized'): Response =>
  sendError(res, message, 401)

export const sendForbidden = (res: Response, message = 'Forbidden'): Response =>
  sendError(res, message, 403)

export const sendNotFound = (res: Response, message = 'Resource not found'): Response =>
  sendError(res, message, 404)

export const sendServerError = (res: Response, message = 'Internal server error'): Response =>
  sendError(res, message, 500)
