import { Router } from 'express'
import { authController } from '../controllers/auth.controller'
import { authenticate } from '../middleware/auth.middleware'

const router = Router()

router.post('/login', authController.login.bind(authController))
router.post('/refresh', authController.refresh.bind(authController))
router.post('/logout', authenticate, authController.logout.bind(authController))
router.get('/me', authenticate, authController.me.bind(authController))

export default router
