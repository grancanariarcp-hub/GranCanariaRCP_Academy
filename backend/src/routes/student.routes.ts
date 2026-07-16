import { Router } from 'express';
import { getStudentDashboard } from '../controllers/student.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth, requireRole('student'));
router.get('/dashboard', asyncHandler(getStudentDashboard));

export default router;
