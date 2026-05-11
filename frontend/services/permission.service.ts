import api from './api'
import { ContentPermission, ContentType, PermissionLevel } from '@/types'

export interface GrantPermissionPayload {
  userId: string
  contentType: ContentType
  permissionLevel: PermissionLevel
  seriesId?: string
  seasonId?: string
  episodeId?: string
  movieId?: string
  programId?: string
  canStream?: boolean
  canDownload?: boolean
  expiresAt?: string
}

export const permissionService = {
  async grantPermission(payload: GrantPermissionPayload): Promise<ContentPermission> {
    const { data } = await api.post('/permissions', payload)
    return data.data
  },

  async revokePermission(id: string): Promise<void> {
    await api.delete(`/permissions/${id}`)
  },

  async getUserPermissions(userId: string): Promise<ContentPermission[]> {
    const { data } = await api.get(`/permissions/user/${userId}`)
    return data.data
  },

  async getContentPermissions(
    contentType: ContentType,
    contentId: string,
  ): Promise<ContentPermission[]> {
    const { data } = await api.get(`/permissions/content/${contentType}/${contentId}`)
    return data.data
  },

  async getMyContent(): Promise<ContentPermission[]> {
    const { data } = await api.get('/permissions/my-content')
    return data.data
  },
}
