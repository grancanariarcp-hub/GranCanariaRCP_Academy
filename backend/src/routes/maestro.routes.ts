import { Router } from 'express';
import { listClasses, createClass, getClass, generateCodes, deleteClass, deleteCode } from '../controllers/class.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Panel del maestro (institution_teacher): clases y códigos de menores. */
const router = Router();
router.use(requireAuth, requireRole('institution_teacher'));

router.get('/classes', asyncHandler(listClasses));
router.post('/classes', asyncHandler(createClass));
router.get('/classes/:id', asyncHandler(getClass));
router.post('/classes/:id/codes', asyncHandler(generateCodes));
router.delete('/classes/:id', asyncHandler(deleteClass));
router.delete('/classes/:id/codes/:studentId', asyncHandler(deleteCode));

export default router;
