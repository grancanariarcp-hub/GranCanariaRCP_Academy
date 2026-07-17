import { Router } from 'express';
import {
  getStudentDashboard,
  listAvailableCourses,
  enrollCourse,
  listMyCourses,
  getMyCourseContent,
} from '../controllers/student.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

router.use(requireAuth, requireRole('student'));
router.get('/dashboard', asyncHandler(getStudentDashboard));

// Matrícula y cursos del alumno
router.get('/available-courses', asyncHandler(listAvailableCourses));
router.post('/enroll/:courseId', asyncHandler(enrollCourse));
router.get('/courses', asyncHandler(listMyCourses));
router.get('/courses/:courseId', asyncHandler(getMyCourseContent));

export default router;
