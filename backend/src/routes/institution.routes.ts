import { Router } from 'express';
import { getMyInstitution, createTeacher, deleteTeacher } from '../controllers/institution.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Panel del administrador de institución (gestiona sus maestros). */
const router = Router();
router.use(requireAuth, requireRole('institution_admin'));

router.get('/me', asyncHandler(getMyInstitution));
router.post('/teachers', asyncHandler(createTeacher));
router.delete('/teachers/:id', asyncHandler(deleteTeacher));

export default router;
