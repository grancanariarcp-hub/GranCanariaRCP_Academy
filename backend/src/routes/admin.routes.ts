import { Router } from 'express';
import multer from 'multer';
import {
  getStats,
  listInstitutions,
  createInstitution,
  listAdmins,
  createAdmin,
  createQuestion,
  createQuestionWithImage,
  listQuestions,
  listProfessors,
  setProfessorStatus,
  createProfessor,
  listAuditLogs,
} from '../controllers/admin.controller.js';
import { uploadDocument, listDocuments, getDocumentUrl } from '../controllers/document.controller.js';
import { getTemplate, importQuestions } from '../controllers/questionImport.controller.js';
import { createChallenge, listAllChallenges, updateChallenge, deleteChallenge, exportChallenge, uploadChallengeThumbnail } from '../controllers/challenge.controller.js';
import { createBank, updateBank, deleteBank, exportBank, listBanks, getBankTemas, importBankQuestions, globalFailedStats } from '../controllers/bank.controller.js';
import { setInstitutionStatus } from '../controllers/institution.controller.js';
import { adminResetPassword } from '../controllers/credentials.controller.js';
import { getGlobalWhatsapp, setGlobalWhatsapp } from '../controllers/whatsapp.controller.js';
import { adminDashboard } from '../controllers/dashboard.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { stripeStatus } from '../controllers/payment.controller.js';
import { listLeads } from '../controllers/lead.controller.js';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate, uploadTemplateBackground, previewTemplate } from '../controllers/recognition.controller.js';
import { anonStats } from '../controllers/anonPractice.controller.js';
import { listConvocatorias, createConvocatoria, updateConvocatoria, deleteConvocatoria, setConvocatoriaBanks } from '../controllers/convocatoria.controller.js';
import { listAuditores, crearAuditor, editarAuditor, borrarAuditor, actividadAuditor } from '../controllers/auditor.controller.js';
import { usoCompartido } from '../controllers/sesion.controller.js';

const router = Router();

// PDF uploads are held in memory then streamed to R2. 40 MB ceiling.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

// Everything below requires an authenticated super_admin.
router.use(requireAuth, requireRole('super_admin'));

router.get('/stats', asyncHandler(getStats));
router.get('/stripe-status', asyncHandler(stripeStatus));
router.get('/leads', asyncHandler(listLeads));
router.get('/anon-practice', asyncHandler(anonStats));
router.get('/uso-compartido', asyncHandler(usoCompartido));

// Cuentas de auditoría para la comisión de formación continuada
router.get('/auditores', asyncHandler(listAuditores));
router.post('/auditores', asyncHandler(crearAuditor));
router.patch('/auditores/:id', asyncHandler(editarAuditor));
router.delete('/auditores/:id', asyncHandler(borrarAuditor));
router.get('/auditores/:id/actividad', asyncHandler(actividadAuditor));

// Convocatorias de oposición
router.get('/convocatorias', asyncHandler(listConvocatorias));
router.post('/convocatorias', asyncHandler(createConvocatoria));
router.patch('/convocatorias/:id', asyncHandler(updateConvocatoria));
router.delete('/convocatorias/:id', asyncHandler(deleteConvocatoria));
router.put('/convocatorias/:id/banks', asyncHandler(setConvocatoriaBanks));

// Certificados de reconocimiento (plantillas)
router.get('/recognition-templates', asyncHandler(listTemplates));
router.post('/recognition-templates', asyncHandler(createTemplate));
router.patch('/recognition-templates/:id', asyncHandler(updateTemplate));
router.delete('/recognition-templates/:id', asyncHandler(deleteTemplate));
router.post('/recognition-templates/:id/background', upload.single('file'), asyncHandler(uploadTemplateBackground));
router.get('/recognition-templates/:id/preview.pdf', asyncHandler(previewTemplate));
router.get('/dashboard', asyncHandler(adminDashboard));

router.get('/institutions', asyncHandler(listInstitutions));
router.post('/institutions', asyncHandler(createInstitution));
router.post('/institutions/:id/:action', asyncHandler(setInstitutionStatus));

router.get('/admins', asyncHandler(listAdmins));
router.post('/admins', asyncHandler(createAdmin));

router.get('/professors', asyncHandler(listProfessors));
router.post('/professors', asyncHandler(createProfessor));
router.post('/professors/:id/:action', asyncHandler(setProfessorStatus));

router.get('/questions', asyncHandler(listQuestions));
router.post('/questions', asyncHandler(createQuestion));
router.post('/questions/image', upload.single('file'), asyncHandler(createQuestionWithImage));
router.get('/questions/template', getTemplate);
router.post('/questions/import', upload.single('file'), asyncHandler(importQuestions));

router.get('/documents', asyncHandler(listDocuments));
router.post('/documents', upload.single('file'), asyncHandler(uploadDocument));
router.get('/documents/:id/url', asyncHandler(getDocumentUrl));

router.get('/challenges', asyncHandler(listAllChallenges));
router.post('/challenges', asyncHandler(createChallenge));
router.patch('/challenges/:id', asyncHandler(updateChallenge));
router.delete('/challenges/:id', asyncHandler(deleteChallenge));
router.get('/challenges/:id/export', asyncHandler(exportChallenge));
router.post('/challenges/:id/thumbnail', upload.single('file'), asyncHandler(uploadChallengeThumbnail));

router.get('/banks', asyncHandler(listBanks));
router.post('/banks', asyncHandler(createBank));
router.patch('/banks/:id', asyncHandler(updateBank));
router.delete('/banks/:id', asyncHandler(deleteBank));
router.get('/banks/:id/export', asyncHandler(exportBank));
router.get('/banks/:id/temas', asyncHandler(getBankTemas));
router.post('/banks/:id/import', asyncHandler(importBankQuestions));
router.get('/failed-general', asyncHandler(globalFailedStats));

router.post('/reset-password/:type/:id', asyncHandler(adminResetPassword));
router.get('/whatsapp', asyncHandler(getGlobalWhatsapp));
router.post('/whatsapp', asyncHandler(setGlobalWhatsapp));

router.get('/audit-logs', asyncHandler(listAuditLogs));

export default router;
