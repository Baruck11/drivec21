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
  async downloadFile(videoUrl: string, filename: string): Promise<void> {
    const href = toStorageUrl(videoUrl)
    if (!href) return
    // Fetch as blob so the browser creates a same-origin object URL;
    // <a download> is silently ignored on cross-origin URLs in Chrome.
    const response = await fetch(href)
    if (!response.ok) throw new Error(`Download failed: ${response.status}`)
    const blob = await response.blob()
    const objectUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(objectUrl), 15_000)
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
