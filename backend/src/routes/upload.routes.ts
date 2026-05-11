import { Router, Request, Response, NextFunction } from 'express'
import path from 'path'
import fs from 'fs'
import { authenticate, requireContentManager } from '../middleware/auth.middleware'
import { uploadChunk, uploadImage } from '../middleware/upload.middleware'
import { prisma } from '../config/database'
import { sendSuccess, sendCreated, sendError } from '../utils/apiResponse'
import { AuthenticatedRequest } from '../types'
import { env } from '../config/env'
import { logger } from '../config/logger'
import { processUpload } from '../workers/mediaProcessor'

const router = Router()

router.use(authenticate, requireContentManager)

// Initialize a new chunked upload session
router.post('/init', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { fileName, fileSize, mimeType, totalChunks } = req.body
    const userId = (req as AuthenticatedRequest).user.id

    const upload = await prisma.upload.create({
      data: {
        uploadedById: userId,
        originalName: fileName,
        storedName: `${Date.now()}_${fileName}`,
        mimeType,
        fileSize: BigInt(fileSize),
        storagePath: '',
        status: 'PENDING',
        metadata: { totalChunks, chunksReceived: 0 },
      },
    })

    sendCreated(res, { uploadId: upload.id, totalChunks })
  } catch (err) { next(err) }
})

// Upload a single chunk
router.post('/chunk', uploadChunk.single('chunk'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { uploadId, chunkIndex, totalChunks } = req.body

    if (!req.file) {
      sendError(res, 'No chunk file received', 400)
      return
    }

    const upload = await prisma.upload.findUnique({ where: { id: uploadId } })
    if (!upload) {
      sendError(res, 'Upload session not found', 404)
      return
    }

    const meta = upload.metadata as { totalChunks: number; chunksReceived: number }
    const chunksReceived = (meta?.chunksReceived ?? 0) + 1
    const progress = Math.floor((chunksReceived / Number(totalChunks)) * 100)

    await prisma.upload.update({
      where: { id: uploadId },
      data: {
        status: progress < 100 ? 'PENDING' : 'PROCESSING',
        progress,
        metadata: { ...meta, chunksReceived },
      },
    })

    // If all chunks received, trigger assembly
    if (chunksReceived >= Number(totalChunks)) {
      assembleChunks(uploadId, upload.storedName).catch(err => {
        logger.error('Chunk assembly failed', { uploadId, err })
      })
    }

    sendSuccess(res, { chunkIndex, progress, chunksReceived })
  } catch (err) { next(err) }
})

// Get upload status
router.get('/:uploadId/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const upload = await prisma.upload.findUnique({
      where: { id: req.params.uploadId },
      select: { id: true, status: true, progress: true, errorMessage: true, processedAt: true },
    })

    if (!upload) {
      sendError(res, 'Upload not found', 404)
      return
    }

    sendSuccess(res, upload)
  } catch (err) { next(err) }
})

// Upload thumbnail/image
router.post('/image', uploadImage.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      sendError(res, 'No image received', 400)
      return
    }

    const imageUrl = `/storage/images/${req.file.filename}`
    sendCreated(res, { url: imageUrl, filename: req.file.filename })
  } catch (err) { next(err) }
})

async function assembleChunks(uploadId: string, storedName: string): Promise<void> {
  const chunkDir = path.join(env.STORAGE_PATH, 'chunks', uploadId)
  const outputDir = path.join(env.STORAGE_PATH, 'videos')

  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true })

  const outputPath = path.join(outputDir, storedName)
  const chunkFiles = fs.readdirSync(chunkDir).sort()

  const writeStream = fs.createWriteStream(outputPath)

  for (const chunkFile of chunkFiles) {
    const chunkPath = path.join(chunkDir, chunkFile)
    const data = fs.readFileSync(chunkPath)
    writeStream.write(data)
  }

  writeStream.end()

  await new Promise<void>((resolve, reject) => {
    writeStream.on('finish', resolve)
    writeStream.on('error', reject)
  })

  // Cleanup chunks
  fs.rmSync(chunkDir, { recursive: true, force: true })

  await prisma.upload.update({
    where: { id: uploadId },
    data: {
      storagePath: outputPath,
      status: 'TRANSCODING',
      progress: 100,
    },
  })

  logger.info(`Upload assembled: ${uploadId} — starting media processing`)

  // Trigger async transcoding (non-blocking; status polling handles completion)
  processUpload(uploadId).catch(err => {
    logger.error('Media processing failed', { uploadId, err })
  })
}

export default router
