import multer, { FileFilterCallback } from 'multer'
import path from 'path'
import fs from 'fs'
import { Request } from 'express'
import { env } from '../config/env'
import { AppError } from './error.middleware'

const ALLOWED_VIDEO_TYPES = [
  'video/mp4',
  'video/quicktime',
  'video/x-msvideo',
  'video/x-matroska',
  'video/webm',
  'video/mpeg',
  'video/x-m4v',
]

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

const videoStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dest = path.join(env.STORAGE_PATH, 'temp')
    ensureDir(dest)
    cb(null, dest)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`
    cb(null, name)
  },
})

const imageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const dest = path.join(env.STORAGE_PATH, 'images')
    ensureDir(dest)
    cb(null, dest)
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname)
    const name = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}${ext}`
    cb(null, name)
  },
})

function videoFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  if (!ALLOWED_VIDEO_TYPES.includes(file.mimetype)) {
    cb(new AppError('Invalid file type. Only video files are allowed.', 400))
    return
  }
  cb(null, true)
}

function imageFileFilter(_req: Request, file: Express.Multer.File, cb: FileFilterCallback): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.mimetype)) {
    cb(new AppError('Invalid file type. Only JPEG, PNG, and WebP images are allowed.', 400))
    return
  }
  cb(null, true)
}

export const uploadVideo = multer({
  storage: videoStorage,
  fileFilter: videoFileFilter,
  limits: {
    fileSize: env.STORAGE_MAX_FILE_SIZE_MB * 1024 * 1024,
  },
})

export const uploadImage = multer({
  storage: imageStorage,
  fileFilter: imageFileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
})

// Chunk-based upload (stores raw chunks in temp dir)
const chunkStorage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const { uploadId } = req.body
    if (!uploadId) {
      cb(new Error('uploadId must appear before the chunk file in the multipart form'), '')
      return
    }
    const dest = path.join(env.STORAGE_PATH, 'chunks', uploadId)
    ensureDir(dest)
    cb(null, dest)
  },
  filename: (req, _file, cb) => {
    const { chunkIndex } = req.body
    cb(null, `chunk_${String(chunkIndex ?? 0).padStart(5, '0')}`)
  },
})

export const uploadChunk = multer({
  storage: chunkStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
})
