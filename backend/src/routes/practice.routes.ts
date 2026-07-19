import { Router } from 'express';
import { startPractice, submitPractice, getPracticeStats } from '../controllers/practice.controller.js';
import { globalFailedStats } from '../controllers/bank.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { myOpeBanks, opeBankDetail } from '../controllers/ope.controller.js';

/** Practice engine — any authenticated user. */
const router = Router();
router.use(requireAuth);
router.post('/start', asyncHandler(startPractice));
router.post('/submit', asyncHandler(submitPractice));
router.get('/stats', asyncHandler(getPracticeStats));

// Preparación de oposiciones: panel propio
router.get('/ope-banks', asyncHandler(myOpeBanks));
router.get('/ope-banks/:id', asyncHandler(opeBankDetail));
router.get('/failed-general', asyncHandler(globalFailedStats)); // preguntas más falladas por todos (opcional ?bankId=)

export default router;
