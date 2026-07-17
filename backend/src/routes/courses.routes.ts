import { Router } from 'express';
import { createCourse, listCourses, getCourse } from '../controllers/course.controller.js';
import multer from 'multer';
import {
  updateCourse, uploadCourseThumbnail, addModule, updateModule, deleteModule,
  addActivity, addImageActivity, deleteActivity, inviteStaff, removeStaff,
} from '../controllers/courseContent.controller.js';
import {
  createExam, getExam, updateExam, addExamQuestion, importExamQuestions, deleteExamQuestion, listExamAttempts,
} from '../controllers/exam.controller.js';
import { previewCertificate, uploadCertBackground, uploadCfcImage } from '../controllers/certificate.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
// Images kept in memory then streamed to R2. 10 MB ceiling.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth, requireRole('super_admin', 'profesor'));

router.get('/', asyncHandler(listCourses));
router.post('/', asyncHandler(createCourse));
router.get('/:id', asyncHandler(getCourse));
router.patch('/:id', asyncHandler(updateCourse));
router.post('/:id/thumbnail', upload.single('file'), asyncHandler(uploadCourseThumbnail));

// Modules
router.post('/:id/modules', asyncHandler(addModule));
router.patch('/:id/modules/:moduleId', asyncHandler(updateModule));
router.delete('/:id/modules/:moduleId', asyncHandler(deleteModule));

// Activities
router.post('/:id/modules/:moduleId/activities', asyncHandler(addActivity));
router.post('/:id/modules/:moduleId/activities/image', upload.single('file'), asyncHandler(addImageActivity));
router.delete('/:id/activities/:activityId', asyncHandler(deleteActivity));

// Staff (directores / instructores)
router.post('/:id/staff', asyncHandler(inviteStaff));
router.delete('/:id/staff/:userId', asyncHandler(removeStaff));

// Exámenes
router.post('/:id/modules/:moduleId/exams', asyncHandler(createExam));
router.get('/:id/exams/:examId', asyncHandler(getExam));
router.patch('/:id/exams/:examId', asyncHandler(updateExam));
router.post('/:id/exams/:examId/questions', asyncHandler(addExamQuestion));
router.post('/:id/exams/:examId/questions/import', asyncHandler(importExamQuestions));
router.delete('/:id/exams/:examId/questions/:questionId', asyncHandler(deleteExamQuestion));
router.get('/:id/exams/:examId/attempts', asyncHandler(listExamAttempts));

// Certificado (director / super_admin)
router.get('/:id/certificate/preview', asyncHandler(previewCertificate));
router.post('/:id/certificate/background', upload.single('file'), asyncHandler(uploadCertBackground));
router.post('/:id/certificate/cfc-image', upload.single('file'), asyncHandler(uploadCfcImage));

export default router;
