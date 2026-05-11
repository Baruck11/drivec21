import { Router } from 'express'
import { permissionController } from '../controllers/permission.controller'
import { authenticate, requireContentManager } from '../middleware/auth.middleware'

const router = Router()

router.use(authenticate)

router.get('/my-content', permissionController.getMyContent.bind(permissionController))
router.get('/user/:userId', requireContentManager, permissionController.getUserPermissions.bind(permissionController))
router.get('/content/:contentType/:contentId', requireContentManager, permissionController.getContentPermissions.bind(permissionController))
router.post('/', requireContentManager, permissionController.grant.bind(permissionController))
router.delete('/:id', requireContentManager, permissionController.revoke.bind(permissionController))

export default router
