import api from './api'

// NEXT_PUBLIC_STORAGE_URL = 'http://localhost:4000/storage'
// DB paths start with '/storage/videos/...' or '/storage/hls/...'
// Strip the leading '/storage' to avoid doubling it.
const STORAGE_BASE = process.env.NEXT_PUBLIC_STORAGE_URL ?? 'http://localhost:4000/storage'

export function toStorageUrl(dbPath: string | null | undefined): string | undefined {
  if (!dbPath) return undefined
  // Already an absolute URL — return as-is
  if (dbPath.startsWith('http://') || dbPath.startsWith('https://')) return dbPath
  // DB paths start with '/storage/...' — strip that prefix since STORAGE_BASE already includes it
  const relative = dbPath.replace(/^\/storage/, '')
  return `${STORAGE_BASE}${relative}`
}

export const downloadService = {
  downloadFile(videoUrl: string, filename: string) {
    const href = toStorageUrl(videoUrl)
    if (!href) return
    const link = document.createElement('a')
    link.href = href
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  },

  async downloadZip(type: 'season' | 'series', id: string, suggestedName?: string): Promise<void> {
    const response = await api.post(
      '/downloads/zip',
      { type, id },
      { responseType: 'blob', timeout: 0 },
    )

    let name = suggestedName ?? type
    const disposition = response.headers['content-disposition'] as string | undefined
    if (disposition) {
      const match = disposition.match(/filename\*=UTF-8''(.+)/)
      if (match) name = decodeURIComponent(match[1])
    }
    if (!name.endsWith('.zip')) name += '.zip'

    const url = URL.createObjectURL(response.data as Blob)
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 15000)
  },
}
