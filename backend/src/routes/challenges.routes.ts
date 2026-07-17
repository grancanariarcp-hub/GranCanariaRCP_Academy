import { Router } from 'express';
import { startChallenge, submitChallenge } from '../controllers/challenge.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Participate in a challenge — any authenticated user. */
const router = Router();
router.use(requireAuth);
router.post('/:id/start', asyncHandler(startChallenge));
router.post('/:id/attempts/:attemptId/submit', asyncHandler(submitChallenge));

export default router;
