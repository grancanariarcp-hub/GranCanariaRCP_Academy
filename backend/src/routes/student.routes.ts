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
import { getSurveyForStudent, submitSurvey } from '../controllers/survey.controller.js';
import { reportQuestion } from '../controllers/questionQuality.controller.js';
import { myAttendance, previewScan, scanAttendance } from '../controllers/attendance.controller.js';
import { createCheckoutSession, myPayments, receiptPdf } from '../controllers/payment.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { suscribirse, miSuscripcion, cancelarRenovacion, reactivarRenovacion } from '../controllers/suscripcion.controller.js';

const router = Router();

router.use(requireAuth, requireRole('student'));
router.get('/dashboard', asyncHandler(getStudentDashboard));

// Matrícula y cursos del alumno
router.get('/available-courses', asyncHandler(listAvailableCourses));
router.post('/enroll/:courseId', asyncHandler(enrollCourse));
router.get('/courses', asyncHandler(listMyCourses));
router.get('/courses/:courseId', asyncHandler(getMyCourseContent));
router.post('/courses/:courseId/activities/:activityId/complete', asyncHandler(setActivityCompleted));
router.get('/courses/:courseId/survey', asyncHandler(getSurveyForStudent));
router.post('/courses/:courseId/survey', asyncHandler(submitSurvey));
router.get('/courses/:courseId/certificate', asyncHandler(studentCertificate));

// Pago de la matrícula
router.post('/courses/:courseId/checkout', asyncHandler(createCheckoutSession));
router.get('/payments', asyncHandler(myPayments));

// Suscripción por periodos
router.post('/courses/:courseId/subscribe', asyncHandler(suscribirse));
router.get('/courses/:courseId/subscription', asyncHandler(miSuscripcion));
router.post('/courses/:courseId/cancel-renewal', asyncHandler(cancelarRenovacion));
router.post('/courses/:courseId/reactivate', asyncHandler(reactivarRenovacion));
router.get('/payments/:id/receipt', asyncHandler(receiptPdf));

// Asistencia presencial: escaneo del QR que muestra el profesor
router.get('/attendance', asyncHandler(myAttendance));
router.get('/attendance/scan', asyncHandler(previewScan));
router.post('/attendance/scan', asyncHandler(scanAttendance));

// Exámenes (realizar / revisar)
router.get('/exams/:examId/attempts', asyncHandler(listMyAttempts));
router.post('/exams/:examId/start', asyncHandler(startExam));
router.post('/exams/:examId/attempts/:attemptId/submit', asyncHandler(submitExam));
router.get('/exams/:examId/attempts/:attemptId', asyncHandler(reviewAttempt));
router.post('/exams/:examId/questions/:questionId/report', asyncHandler(reportQuestion));

export default router;
