import { Router } from 'express';
import { createCourse, listCourses, getCourse } from '../controllers/course.controller.js';
import {
  updateCourse, addModule, updateModule, deleteModule,
  addActivity, deleteActivity, inviteStaff, removeStaff,
} from '../controllers/courseContent.controller.js';
import {
  createExam, getExam, updateExam, addExamQuestion, deleteExamQuestion,
} from '../controllers/exam.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'profesor'));

router.get('/', asyncHandler(listCourses));
router.post('/', asyncHandler(createCourse));
router.get('/:id', asyncHandler(getCourse));
router.patch('/:id', asyncHandler(updateCourse));

// Modules
router.post('/:id/modules', asyncHandler(addModule));
router.patch('/:id/modules/:moduleId', asyncHandler(updateModule));
router.delete('/:id/modules/:moduleId', asyncHandler(deleteModule));

// Activities
router.post('/:id/modules/:moduleId/activities', asyncHandler(addActivity));
router.delete('/:id/activities/:activityId', asyncHandler(deleteActivity));

// Staff (directores / instructores)
router.post('/:id/staff', asyncHandler(inviteStaff));
router.delete('/:id/staff/:userId', asyncHandler(removeStaff));

// Exámenes
router.post('/:id/modules/:moduleId/exams', asyncHandler(createExam));
router.get('/:id/exams/:examId', asyncHandler(getExam));
router.patch('/:id/exams/:examId', asyncHandler(updateExam));
router.post('/:id/exams/:examId/questions', asyncHandler(addExamQuestion));
router.delete('/:id/exams/:examId/questions/:questionId', asyncHandler(deleteExamQuestion));

export default router;
