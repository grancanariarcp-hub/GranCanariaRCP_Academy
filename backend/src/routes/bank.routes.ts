import { Router } from 'express';
import {
  createBank, updateBank, deleteBank, exportBank, listBanks, getBankTemas, importBankQuestions,
} from '../controllers/bank.controller.js';
import { bankAvailability } from '../controllers/exam.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Bancos de preguntas para super_admin y profesores.
 * Cada profesor gestiona LOS SUYOS con total libertad; de los públicos solo
 * puede verlos y usarlos como fuente (el propio controller lo comprueba).
 */
const router = Router();
router.use(requireAuth, requireRole('super_admin', 'profesor'));

router.get('/', asyncHandler(listBanks));
router.post('/availability', asyncHandler(bankAvailability));
router.post('/', asyncHandler(createBank));
router.patch('/:id', asyncHandler(updateBank));
router.delete('/:id', asyncHandler(deleteBank));
router.get('/:id/export', asyncHandler(exportBank));
router.get('/:id/temas', asyncHandler(getBankTemas));
router.post('/:id/import', asyncHandler(importBankQuestions));

export default router;
