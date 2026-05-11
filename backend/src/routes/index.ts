import { Router } from 'express'
import authRoutes from './auth.routes'
import userRoutes from './user.routes'
import contentRoutes from './content.routes'
import permissionRoutes from './permission.routes'
import uploadRoutes from './upload.routes'
import downloadRoutes from './download.routes'

const router = Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/content', contentRoutes)
router.use('/permissions', permissionRoutes)
router.use('/uploads', uploadRoutes)
router.use('/downloads', downloadRoutes)

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'capital21play-api', timestamp: new Date().toISOString() })
})

export default router
