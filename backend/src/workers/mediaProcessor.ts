import { spawn } from 'child_process'
import path from 'path'
import fs from 'fs'
import { prisma } from '../config/database'
import { env } from '../config/env'
import { logger } from '../config/logger'

export interface MediaMetadata {
  duration: number
  width: number
  height: number
  codec: string
  bitrate: number
  fps: number
  fileSize: number
}

export async function processUpload(uploadId: string): Promise<void> {
  const upload = await prisma.upload.findUnique({ where: { id: uploadId } })

  if (!upload || !upload.storagePath) {
    throw new Error(`Upload ${uploadId} not found or missing storage path`)
  }

  logger.info(`Processing upload: ${uploadId}`)

  try {
    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'TRANSCODING', progress: 0 },
    })

    const metadata = await extractMetadata(upload.storagePath)

    const hlsOutputDir = path.join(env.STORAGE_PATH, 'hls', uploadId)
    fs.mkdirSync(hlsOutputDir, { recursive: true })

    await transcodeToHLS(upload.storagePath, hlsOutputDir, uploadId, metadata.duration)

    await prisma.upload.update({
      where: { id: uploadId },
      data: { status: 'GENERATING_THUMBNAILS', progress: 99 },
    })

    const thumbnailPath = await generateThumbnail(upload.storagePath, uploadId, metadata.duration)

    const hlsUrl = `/storage/hls/${uploadId}/master.m3u8`
    const thumbnailUrl = `/storage/thumbnails/${uploadId}.jpg`

    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: 'COMPLETED',
        progress: 100,
        processedAt: new Date(),
        metadata: {
          ...metadata,
          hlsUrl,
          thumbnailUrl,
          hlsDir: hlsOutputDir,
          thumbnailPath,
        },
      },
    })

    // Back-fill URLs and technical metadata onto the linked content row
    await updateLinkedContent(uploadId, upload.storedName, metadata)

    logger.info(`Upload processed successfully: ${uploadId}`)
  } catch (err) {
    logger.error(`Upload processing failed: ${uploadId}`, err)
    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: 'FAILED',
        errorMessage: err instanceof Error ? err.message : 'Unknown error',
      },
    })
    // Mark linked content as failed too
    await markLinkedContentFailed(uploadId)
    throw err
  }
}

async function updateLinkedContent(
  uploadId: string,
  storedName: string,
  metadata: MediaMetadata,
): Promise<void> {
  const hlsUrl = `/storage/hls/${uploadId}/master.m3u8`
  const videoUrl = `/storage/videos/${storedName}`
  const thumbnailUrl = `/storage/thumbnails/${uploadId}.jpg`
  const resolution = `${metadata.width}x${metadata.height}`

  const [episode, movie, program] = await Promise.all([
    prisma.episode.findFirst({ where: { uploadId } }),
    prisma.movie.findFirst({ where: { uploadId } }),
    prisma.program.findFirst({ where: { uploadId } }),
  ])

  await Promise.all([
    episode && prisma.episode.update({
      where: { id: episode.id },
      data: {
        hlsUrl, videoUrl, thumbnailUrl, resolution,
        duration: metadata.duration,
        codec: metadata.codec,
        bitrate: metadata.bitrate,
        fileSize: BigInt(metadata.fileSize),
        uploadStatus: 'COMPLETED',
      },
    }),
    movie && prisma.movie.update({
      where: { id: movie.id },
      data: {
        hlsUrl, videoUrl, thumbnailUrl, resolution,
        duration: metadata.duration,
        codec: metadata.codec,
        bitrate: metadata.bitrate,
        fileSize: BigInt(metadata.fileSize),
        uploadStatus: 'COMPLETED',
      },
    }),
    program && prisma.program.update({
      where: { id: program.id },
      data: {
        hlsUrl, videoUrl, thumbnailUrl, resolution,
        duration: metadata.duration,
        fileSize: BigInt(metadata.fileSize),
        uploadStatus: 'COMPLETED',
      },
    }),
  ].filter(Boolean))
}

async function markLinkedContentFailed(uploadId: string): Promise<void> {
  const [episode, movie, program] = await Promise.all([
    prisma.episode.findFirst({ where: { uploadId } }),
    prisma.movie.findFirst({ where: { uploadId } }),
    prisma.program.findFirst({ where: { uploadId } }),
  ])

  await Promise.all([
    episode && prisma.episode.update({ where: { id: episode.id }, data: { uploadStatus: 'FAILED' } }),
    movie && prisma.movie.update({ where: { id: movie.id }, data: { uploadStatus: 'FAILED' } }),
    program && prisma.program.update({ where: { id: program.id }, data: { uploadStatus: 'FAILED' } }),
  ].filter(Boolean))
}

export function extractMetadata(filePath: string): Promise<MediaMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_streams',
      '-show_format',
      filePath,
    ]

    const ffprobe = spawn(env.FFPROBE_PATH, args)
    let output = ''
    let errorOutput = ''

    ffprobe.on('error', (err) => reject(new Error(`ffprobe not found or failed to start: ${err.message}`)))
    ffprobe.stdout.on('data', (data: Buffer) => { output += data.toString() })
    ffprobe.stderr.on('data', (data: Buffer) => { errorOutput += data.toString() })

    ffprobe.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`ffprobe failed: ${errorOutput}`))
        return
      }

      try {
        const info = JSON.parse(output)
        const videoStream = info.streams?.find((s: Record<string, unknown>) => s.codec_type === 'video')
        const format = info.format

        const [fpsNum, fpsDen] = (videoStream?.r_frame_rate ?? '24/1').split('/').map(Number)

        resolve({
          duration: Math.round(parseFloat(format?.duration ?? '0')),
          width: videoStream?.width ?? 0,
          height: videoStream?.height ?? 0,
          codec: videoStream?.codec_name ?? 'unknown',
          bitrate: Math.round(parseInt(format?.bit_rate ?? '0', 10) / 1000),
          fps: Math.round(fpsNum / fpsDen),
          fileSize: parseInt(format?.size ?? '0', 10),
        })
      } catch (parseErr) {
        reject(new Error(`Failed to parse ffprobe output: ${parseErr}`))
      }
    })
  })
}

export function transcodeToHLS(
  inputPath: string,
  outputDir: string,
  uploadId: string,
  totalDuration: number,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const masterPlaylist = path.join(outputDir, 'master.m3u8')

    // Multi-bitrate HLS ladder
    const args = [
      '-i', inputPath,
      '-filter_complex',
      '[v:0]split=3[v1][v2][v3];[v1]scale=1920:1080[v1out];[v2]scale=1280:720[v2out];[v3]scale=854:480[v3out]',
      // 1080p
      '-map', '[v1out]', '-map', 'a:0',
      '-c:v:0', 'libx264', '-crf', '23', '-preset', 'fast', '-profile:v', 'high',
      '-c:a:0', 'aac', '-b:a:0', '128k',
      // 720p
      '-map', '[v2out]', '-map', 'a:0',
      '-c:v:1', 'libx264', '-crf', '25', '-preset', 'fast', '-profile:v', 'main',
      '-c:a:1', 'aac', '-b:a:1', '128k',
      // 480p
      '-map', '[v3out]', '-map', 'a:0',
      '-c:v:2', 'libx264', '-crf', '28', '-preset', 'fast', '-profile:v', 'baseline',
      '-c:a:2', 'aac', '-b:a:2', '96k',
      // HLS output
      '-f', 'hls',
      '-hls_time', String(env.HLS_SEGMENT_DURATION),
      '-hls_playlist_type', 'vod',
      '-hls_flags', 'independent_segments',
      '-hls_segment_type', 'mpegts',
      '-hls_segment_filename', path.join(outputDir, 'stream_%v/seg_%03d.ts'),
      '-master_pl_name', 'master.m3u8',
      '-var_stream_map', 'v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p',
      path.join(outputDir, 'stream_%v/index.m3u8'),
    ]

    const ffmpeg = spawn(env.FFMPEG_PATH, args)
    let errorOutput = ''
    let lastWrittenPct = 0

    ffmpeg.on('error', (err) => reject(new Error(`ffmpeg not found or failed to start: ${err.message}`)))
    ffmpeg.stderr.on('data', (data: Buffer) => {
      const chunk = data.toString()
      errorOutput += chunk

      if (totalDuration > 0) {
        const match = chunk.match(/time=(\d{2}):(\d{2}):(\d{2})/)
        if (match) {
          const currentSec = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3])
          const pct = Math.min(98, Math.round((currentSec / totalDuration) * 100))
          if (pct > lastWrittenPct) {
            lastWrittenPct = pct
            prisma.upload.update({
              where: { id: uploadId },
              data: { progress: pct },
            }).catch(() => {})
          }
          logger.debug(`[FFmpeg ${uploadId}] ${pct}%`)
        }
      }
    })

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`FFmpeg transcoding failed (code ${code}): ${errorOutput.slice(-500)}`))
        return
      }

      // Write master playlist
      const masterContent = `#EXTM3U
#EXT-X-VERSION:3
#EXT-X-STREAM-INF:BANDWIDTH=4000000,RESOLUTION=1920x1080,NAME="1080p"
stream_1080p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=2000000,RESOLUTION=1280x720,NAME="720p"
stream_720p/index.m3u8
#EXT-X-STREAM-INF:BANDWIDTH=800000,RESOLUTION=854x480,NAME="480p"
stream_480p/index.m3u8
`
      fs.writeFileSync(masterPlaylist, masterContent)
      resolve()
    })
  })
}

export function generateThumbnail(
  inputPath: string,
  uploadId: string,
  duration: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const thumbnailDir = path.join(env.STORAGE_PATH, 'thumbnails')
    fs.mkdirSync(thumbnailDir, { recursive: true })

    const outputPath = path.join(thumbnailDir, `${uploadId}.jpg`)
    const seekTime = Math.floor(duration * 0.1)

    const args = [
      '-ss', String(seekTime),
      '-i', inputPath,
      '-vframes', '1',
      '-vf', `scale=${env.THUMBNAIL_WIDTH}:${env.THUMBNAIL_HEIGHT}:force_original_aspect_ratio=decrease,pad=${env.THUMBNAIL_WIDTH}:${env.THUMBNAIL_HEIGHT}:(ow-iw)/2:(oh-ih)/2`,
      '-q:v', '2',
      '-y',
      outputPath,
    ]

    const ffmpeg = spawn(env.FFMPEG_PATH, args)
    let errorOutput = ''

    ffmpeg.on('error', (err) => reject(new Error(`ffmpeg not found or failed to start: ${err.message}`)))
    ffmpeg.stderr.on('data', (data: Buffer) => { errorOutput += data.toString() })

    ffmpeg.on('close', (code) => {
      if (code !== 0) {
        logger.warn(`Thumbnail generation failed for ${uploadId}: ${errorOutput.slice(-200)}`)
        reject(new Error('Thumbnail generation failed'))
        return
      }
      resolve(outputPath)
    })
  })
}
