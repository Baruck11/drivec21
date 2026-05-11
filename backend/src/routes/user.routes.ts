import { Router } from 'express'
import { userController } from '../controllers/user.controller'
import { authenticate, requireAdmin, requireContentManager } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/stats', requireAdmin, userController.getStats.bind(userController))
router.get('/', requireContentManager, userController.findAll.bind(userController))
router.get('/:id', requireContentManager, userController.findById.bind(userController))
router.post('/', requireAdmin, userController.create.bind(userController))
router.patch('/:id', requireAdmin, userController.update.bind(userController))
router.delete('/:id', requireAdmin, userController.delete.bind(userController))

export default router
