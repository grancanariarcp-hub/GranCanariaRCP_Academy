import { Router } from 'express';
import multer from 'multer';
import { createQuestion, createQuestionWithImage, listQuestions } from '../controllers/admin.controller.js';
import { getTemplate, importQuestions } from '../controllers/questionImport.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Preguntas del profesorado.
 *
 * Los mismos manejadores que usaba solo el super admin, pero abiertos también
 * al profesorado: los controladores limitan por propiedad, de modo que cada
 * profesor solo ve y crea preguntas en LOS BANCOS QUE ÉL creó. Los bancos
 * ajenos siguen sirviendo como fuente de exámenes, sin poder inspeccionarlos.
 */
const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

router.use(requireAuth, requireRole('super_admin', 'profesor'));

router.get('/', asyncHandler(listQuestions));
router.post('/', asyncHandler(createQuestion));
router.post('/image', upload.single('file'), asyncHandler(createQuestionWithImage));
router.get('/template', getTemplate);
router.post('/import', upload.single('file'), asyncHandler(importQuestions));

export default router;
