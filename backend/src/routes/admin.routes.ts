import { Router } from 'express';
import {
  getStats,
  listInstitutions,
  createInstitution,
  listAdmins,
  createAdmin,
  createQuestion,
  listQuestions,
  listAuditLogs,
} from '../controllers/admin.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// Everything below requires an authenticated super_admin.
router.use(requireAuth, requireRole('super_admin'));

router.get('/stats', asyncHandler(getStats));

router.get('/institutions', asyncHandler(listInstitutions));
router.post('/institutions', asyncHandler(createInstitution));

router.get('/admins', asyncHandler(listAdmins));
router.post('/admins', asyncHandler(createAdmin));

router.get('/questions', asyncHandler(listQuestions));
router.post('/questions', asyncHandler(createQuestion));

router.get('/audit-logs', asyncHandler(listAuditLogs));

export default router;
