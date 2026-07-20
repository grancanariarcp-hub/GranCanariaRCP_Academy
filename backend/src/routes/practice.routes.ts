import { Router } from 'express';
import { startPractice, submitPractice, getPracticeStats } from '../controllers/practice.controller.js';
import { globalFailedStats } from '../controllers/bank.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { myOpeBanks, opeBankDetail } from '../controllers/ope.controller.js';
import { myConvocatorias } from '../controllers/convocatoria.controller.js';
import { generarTest, respuestaInmediata, enviarTest, misTests, repetirTest } from '../controllers/practiceTest.controller.js';
import { estadisticaPreguntas, estadisticaMaterias, estadisticaComunidad } from '../controllers/opeStats.controller.js';

/** Practice engine — any authenticated user. */
const router = Router();
router.use(requireAuth);
router.post('/start', asyncHandler(startPractice));
router.post('/submit', asyncHandler(submitPractice));
router.get('/stats', asyncHandler(getPracticeStats));

// Preparación de oposiciones: panel propio
router.get('/ope-banks', asyncHandler(myOpeBanks));
router.get('/ope-banks/:id', asyncHandler(opeBankDetail));
router.get('/convocatorias', asyncHandler(myConvocatorias));
router.get('/ope-banks/:id/questions', asyncHandler(estadisticaPreguntas));
router.get('/ope-banks/:id/materias', asyncHandler(estadisticaMaterias));
router.get('/community-stats', asyncHandler(estadisticaComunidad));

// Generador de tests configurable
router.get('/tests', asyncHandler(misTests));
router.post('/tests', asyncHandler(generarTest));
router.get('/tests/:id/answer/:questionId', asyncHandler(respuestaInmediata));
router.post('/tests/:id/submit', asyncHandler(enviarTest));
router.post('/tests/:id/repeat', asyncHandler(repetirTest));
router.get('/failed-general', asyncHandler(globalFailedStats)); // preguntas más falladas por todos (opcional ?bankId=)

export default router;
