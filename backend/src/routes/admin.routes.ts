import { Router } from 'express';
import multer from 'multer';
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
import { uploadDocument, listDocuments, getDocumentUrl } from '../controllers/document.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// PDF uploads are held in memory then streamed to R2. 40 MB ceiling.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

// Everything below requires an authenticated super_admin.
router.use(requireAuth, requireRole('super_admin'));

router.get('/stats', asyncHandler(getStats));

router.get('/institutions', asyncHandler(listInstitutions));
router.post('/institutions', asyncHandler(createInstitution));

router.get('/admins', asyncHandler(listAdmins));
router.post('/admins', asyncHandler(createAdmin));

router.get('/questions', asyncHandler(listQuestions));
router.post('/questions', asyncHandler(createQuestion));

router.get('/documents', asyncHandler(listDocuments));
router.post('/documents', upload.single('file'), asyncHandler(uploadDocument));
router.get('/documents/:id/url', asyncHandler(getDocumentUrl));

router.get('/audit-logs', asyncHandler(listAuditLogs));

export default router;
