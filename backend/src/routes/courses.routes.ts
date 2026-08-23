import { Router } from 'express';
import { createCourse, listCourses, getCourse, listCourseStudents, courseDuration, courseTaxonomy } from '../controllers/course.controller.js';
import { getCourseExtras, updateCourseExtras } from '../controllers/academia.controller.js';
import multer from 'multer';
import {
  updateCourse, deleteCourse, cambiarTipoCurso, solicitarCfc, cambiosCfc, uploadCourseThumbnail, addModule, updateModule, deleteModule,
  addActivity, addImageActivity, deleteActivity, inviteStaff, removeStaff,
  addCourseImage, deleteCourseImage, setActivityDuration, auditoriaCurso,
  setActivityEval, listActivityGrades, setActivityGrade,
} from '../controllers/courseContent.controller.js';
import {
  createExam, getExam, updateExam, addExamQuestion, importExamQuestions, addExamQuestionsFromBank, addExamQuestionsFromBankByIds, createExamWizard, addExamQuestionWithImage, deleteExamQuestion, listExamAttempts,
} from '../controllers/exam.controller.js';
import { previewCertificate, uploadCertBackground, uploadCfcImage } from '../controllers/certificate.controller.js';
import { directorResetStudentPassword } from '../controllers/credentials.controller.js';
import { courseDashboard } from '../controllers/dashboard.controller.js';
import { examQuality, setQuestionGrading } from '../controllers/questionQuality.controller.js';
import { cfcAssistant } from '../controllers/cfc.controller.js';
import { surveyResults, setSurveyOpen } from '../controllers/survey.controller.js';
import {
  createAttendanceSession, listAttendanceSessions, updateAttendanceSession, deleteAttendanceSession,
  attendanceQrToken, listAttendanceRecords, markAttendanceManually, attendanceListPdf,
} from '../controllers/attendance.controller.js';
import { coursePayments } from '../controllers/payment.controller.js';
import { previewActa, cerrarActa, listActas, actaPdf } from '../controllers/acta.controller.js';
import { listarSubgrupos, repartirSubgrupos, crearSubgrupo, asignarAlumno, eliminarSubgrupo } from '../controllers/subgrupo.controller.js';
import { exportarCurso, importarResultados } from '../controllers/pulsar.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
// Images kept in memory then streamed to R2. 10 MB ceiling.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.use(requireAuth, requireRole('super_admin', 'profesor'));

router.get('/', asyncHandler(listCourses));
router.get('/taxonomia', asyncHandler(courseTaxonomy));
router.post('/', asyncHandler(createCourse));
router.get('/:id', asyncHandler(getCourse));
router.patch('/:id', asyncHandler(updateCourse));
router.delete('/:id', asyncHandler(deleteCourse));
router.patch('/:id/tipo', asyncHandler(cambiarTipoCurso));
router.get('/:id/extras', asyncHandler(getCourseExtras));
router.put('/:id/extras', asyncHandler(updateCourseExtras));
router.post('/:id/solicitar-cfc', asyncHandler(solicitarCfc));
router.get('/:id/cambios-cfc', asyncHandler(cambiosCfc));
router.get('/:id/auditoria', asyncHandler(auditoriaCurso));
router.post('/:id/thumbnail', upload.single('file'), asyncHandler(uploadCourseThumbnail));
router.post('/:id/gallery', upload.single('file'), asyncHandler(addCourseImage));
router.delete('/:id/gallery/:imageId', asyncHandler(deleteCourseImage));

// Modules
router.post('/:id/modules', asyncHandler(addModule));
router.patch('/:id/modules/:moduleId', asyncHandler(updateModule));
router.delete('/:id/modules/:moduleId', asyncHandler(deleteModule));

// Activities
router.post('/:id/modules/:moduleId/activities', asyncHandler(addActivity));
router.post('/:id/modules/:moduleId/activities/image', upload.single('file'), asyncHandler(addImageActivity));
router.delete('/:id/activities/:activityId', asyncHandler(deleteActivity));
router.patch('/:id/activities/:activityId/duration', asyncHandler(setActivityDuration));
router.patch('/:id/activities/:activityId/eval', asyncHandler(setActivityEval));
router.get('/:id/activities/:activityId/grades', asyncHandler(listActivityGrades));
router.put('/:id/activities/:activityId/grades/:studentId', asyncHandler(setActivityGrade));

// Staff (directores / instructores)
router.post('/:id/staff', asyncHandler(inviteStaff));
router.delete('/:id/staff/:userId', asyncHandler(removeStaff));

// Exámenes
router.post('/:id/modules/:moduleId/exams', asyncHandler(createExam));
router.post('/:id/modules/:moduleId/exams/wizard', asyncHandler(createExamWizard));
router.get('/:id/exams/:examId', asyncHandler(getExam));
router.patch('/:id/exams/:examId', asyncHandler(updateExam));
router.post('/:id/exams/:examId/questions', asyncHandler(addExamQuestion));
router.post('/:id/exams/:examId/questions/image', upload.single('file'), asyncHandler(addExamQuestionWithImage));
router.post('/:id/exams/:examId/questions/import', asyncHandler(importExamQuestions));
router.post('/:id/exams/:examId/questions/from-bank', asyncHandler(addExamQuestionsFromBank));
router.post('/:id/exams/:examId/questions/from-bank/select', asyncHandler(addExamQuestionsFromBankByIds));
router.delete('/:id/exams/:examId/questions/:questionId', asyncHandler(deleteExamQuestion));
router.get('/:id/exams/:examId/attempts', asyncHandler(listExamAttempts));
router.get('/:id/exams/:examId/quality', asyncHandler(examQuality));
router.patch('/:id/exams/:examId/questions/:questionId/grading', asyncHandler(setQuestionGrading));

router.get('/:id/students', asyncHandler(listCourseStudents));
router.get('/:id/duration', asyncHandler(courseDuration));
router.get('/:id/dashboard', asyncHandler(courseDashboard));
router.get('/:id/cfc', asyncHandler(cfcAssistant));
router.get('/:id/survey/results', asyncHandler(surveyResults));
router.patch('/:id/survey', asyncHandler(setSurveyOpen));
router.post('/:id/students/:studentId/reset-password', asyncHandler(directorResetStudentPassword));

// Asistencia presencial
router.get('/:id/payments', asyncHandler(coursePayments));

// Acta del curso
router.get('/:id/acta/preview.pdf', asyncHandler(previewActa));
router.post('/:id/acta', asyncHandler(cerrarActa));
router.get('/:id/actas', asyncHandler(listActas));
router.get('/:id/actas/:code.pdf', asyncHandler(actaPdf));
router.get('/:id/attendance/list.pdf', asyncHandler(attendanceListPdf));
router.get('/:id/attendance/sessions', asyncHandler(listAttendanceSessions));
router.post('/:id/attendance/sessions', asyncHandler(createAttendanceSession));
router.patch('/:id/attendance/sessions/:sessionId', asyncHandler(updateAttendanceSession));
router.delete('/:id/attendance/sessions/:sessionId', asyncHandler(deleteAttendanceSession));
router.get('/:id/attendance/sessions/:sessionId/qr', asyncHandler(attendanceQrToken));
router.get('/:id/attendance/sessions/:sessionId/records', asyncHandler(listAttendanceRecords));
router.post('/:id/attendance/sessions/:sessionId/records/:studentId', asyncHandler(markAttendanceManually));

// Subgrupos de alumnos (para la práctica en PÚLSAR)
router.get('/:id/subgrupos', listarSubgrupos);
router.post('/:id/subgrupos/auto', repartirSubgrupos);
router.post('/:id/subgrupos', crearSubgrupo);
router.patch('/:id/subgrupos/asignar', asignarAlumno);
router.delete('/:id/subgrupos/:subgroupId', eliminarSubgrupo);

// Puente con PÚLSAR (simulación clínica)
router.get('/:id/pulsar/export', asyncHandler(exportarCurso));
router.post('/:id/pulsar/import', asyncHandler(importarResultados));

// Certificado (director / super_admin)
router.get('/:id/certificate/preview', asyncHandler(previewCertificate));
router.post('/:id/certificate/background', upload.single('file'), asyncHandler(uploadCertBackground));
router.post('/:id/certificate/cfc-image', upload.single('file'), asyncHandler(uploadCfcImage));

export default router;
