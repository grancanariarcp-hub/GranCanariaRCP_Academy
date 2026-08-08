import { Router } from 'express';
import { videoToken, videoHeartbeat, videoAsistencia } from '../controllers/video.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Videoconferencia dentro del campus. Abierto a cualquier sesión iniciada
 * (alumno o staff); el controlador comprueba matrícula o pertenencia al curso.
 */
const router = Router();

router.use(requireAuth);
router.post('/:activityId/token', asyncHandler(videoToken));
router.post('/:activityId/heartbeat', asyncHandler(videoHeartbeat));
router.get('/:activityId/asistencia', asyncHandler(videoAsistencia));

export default router;
