import { Router } from 'express';
import { startPractice, submitPractice, getPracticeStats } from '../controllers/practice.controller.js';
import { globalFailedStats } from '../controllers/bank.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Practice engine — any authenticated user. */
const router = Router();
router.use(requireAuth);
router.post('/start', asyncHandler(startPractice));
router.post('/submit', asyncHandler(submitPractice));
router.get('/stats', asyncHandler(getPracticeStats));
router.get('/failed-general', asyncHandler(globalFailedStats)); // preguntas más falladas por todos (opcional ?bankId=)

export default router;
