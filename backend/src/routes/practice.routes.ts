import { Router } from 'express';
import { startPractice, submitPractice, getPracticeStats } from '../controllers/practice.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Practice engine — any authenticated user. */
const router = Router();
router.use(requireAuth);
router.post('/start', asyncHandler(startPractice));
router.post('/submit', asyncHandler(submitPractice));
router.get('/stats', asyncHandler(getPracticeStats));

export default router;
