import { Router } from 'express';
import {
  listThreads,
  createThread,
  getThread,
  createPost,
  setThreadClosed,
  deletePost,
} from '../controllers/forum.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Foro por curso — cualquier usuario autenticado; el permiso concreto (staff o
 * alumno matriculado) se comprueba por-curso dentro del controller, porque los
 * routers de courses/student tienen guards de rol que excluirían a unos u otros.
 */
const router = Router();
router.use(requireAuth);

router.get('/:courseId/threads', asyncHandler(listThreads));
router.post('/:courseId/threads', asyncHandler(createThread));
router.get('/:courseId/threads/:threadId', asyncHandler(getThread));
router.post('/:courseId/threads/:threadId/posts', asyncHandler(createPost));
router.patch('/:courseId/threads/:threadId/close', asyncHandler(setThreadClosed));
router.delete('/:courseId/posts/:postId', asyncHandler(deletePost));

export default router;
