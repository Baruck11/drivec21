import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import compression from 'compression'
import morgan from 'morgan'
import rateLimit from 'express-rate-limit'
import path from 'path'

import { env } from './config/env'
import { logger } from './config/logger'
import { connectDatabase, disconnectDatabase } from './config/database'
import { globalErrorHandler, notFoundHandler } from './middleware/error.middleware'
import routes from './routes'

// BigInt fields (e.g. fileSize) are not JSON-serializable by default.
;(BigInt.prototype as unknown as Record<string, unknown>).toJSON = function () {
  return Number(this)
}

const app = express()

// ── Security ───────────────────────────────────────────────────────────────────
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }),
)

app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  }),
)

// ── Rate Limiting ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests, please try again later.' },
  // Upload routes send hundreds of chunk requests per file — exempt them entirely.
  // They are already protected by JWT authentication middleware.
  skip: (req) =>
    req.path === '/users/stats' ||
    req.path.startsWith('/uploads'),
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, message: 'Too many login attempts, please try again in 15 minutes.' },
})

app.use(`${env.API_PREFIX}/auth/login`, authLimiter)
app.use(env.API_PREFIX, limiter)

// ── Parsing ───────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))
app.use(compression({
  filter: (req, res) => {
    // Never compress binary streaming responses (ZIP downloads)
    if (req.path.includes('/downloads/')) return false
    return compression.filter(req, res)
  },
}))

// ── Logging ───────────────────────────────────────────────────────────────────
app.use(
  morgan('combined', {
    stream: { write: (msg) => logger.http(msg.trim()) },
    skip: (req) => req.path === '/health',
  }),
)

// ── Static files (storage) ────────────────────────────────────────────────────
app.use(
  '/storage',
  express.static(path.resolve(env.STORAGE_PATH), {
    maxAge: '1d',
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.m3u8') || filePath.endsWith('.ts')) {
        res.setHeader('Cache-Control', 'no-cache')
      }
    },
  }),
)

// ── API Routes ────────────────────────────────────────────────────────────────
app.use(env.API_PREFIX, routes)

// ── Error Handling ────────────────────────────────────────────────────────────
app.use(notFoundHandler)
app.use(globalErrorHandler)

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  await connectDatabase()

  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Capital 21 Play API running on port ${env.PORT}`)
    logger.info(`   Environment: ${env.NODE_ENV}`)
    logger.info(`   API Prefix: ${env.API_PREFIX}`)
  })

  const gracefulShutdown = async (signal: string) => {
    logger.info(`${signal} received. Shutting down gracefully...`)
    server.close(async () => {
      await disconnectDatabase()
      logger.info('Server closed.')
      process.exit(0)
    })
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'))
  process.on('SIGINT', () => gracefulShutdown('SIGINT'))
}

bootstrap().catch((err) => {
  logger.error('Failed to start server', err)
  process.exit(1)
})

export default app
