import { Router } from 'express';
import {
  getStudentDashboard,
  listAvailableCourses,
  enrollCourse,
  listMyCourses,
  getMyCourseContent,
  setActivityCompleted,
} from '../controllers/student.controller.js';
import {
  startExam, submitExam, reviewAttempt, listMyAttempts,
} from '../controllers/examAttempt.controller.js';
import { studentCertificate } from '../controllers/certificate.controller.js';
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
router.post('/courses/:courseId/activities/:activityId/complete', asyncHandler(setActivityCompleted));
router.get('/courses/:courseId/certificate', asyncHandler(studentCertificate));

// Exámenes (realizar / revisar)
router.get('/exams/:examId/attempts', asyncHandler(listMyAttempts));
router.post('/exams/:examId/start', asyncHandler(startExam));
router.post('/exams/:examId/attempts/:attemptId/submit', asyncHandler(submitExam));
router.get('/exams/:examId/attempts/:attemptId', asyncHandler(reviewAttempt));

export default router;
