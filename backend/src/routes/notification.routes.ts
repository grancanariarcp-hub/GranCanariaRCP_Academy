import { Router } from 'express';
import { listNotifications, markAllRead } from '../controllers/notification.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Notificaciones in-app — cualquier usuario autenticado (staff o alumno). */
const router = Router();
router.use(requireAuth);
router.get('/', asyncHandler(listNotifications));
router.post('/read-all', asyncHandler(markAllRead));

export default router;
