import { Router } from 'express';
import { listOpenCourses, getPublicCourse } from '../controllers/course.controller.js';
import { getProfessorCv, listPublicProfessors } from '../controllers/profile.controller.js';
import { listChallenges, getChallengeRanking, getInstitutionRanking, getIndividualRanking } from '../controllers/challenge.controller.js';
import { listBanks, getBankTemas } from '../controllers/bank.controller.js';
import { getPublicCertificate, publicCertificatePdf } from '../controllers/certificate.controller.js';
import { listPublicInstitutions } from '../controllers/institution.controller.js';
import { qrImage } from '../controllers/qr.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { subscribeLead, unsubscribeLead } from '../controllers/lead.controller.js';
import { verificarActa } from '../controllers/acta.controller.js';
import { verifyRecognition, recognitionPdf } from '../controllers/recognition.controller.js';

/** Public endpoints (no auth) — course discovery + challenges/rankings. */
const router = Router();
router.get('/courses', asyncHandler(listOpenCourses));
router.get('/courses/:id', asyncHandler(getPublicCourse));
router.get('/professors', asyncHandler(listPublicProfessors));
router.get('/professors/:id/cv', asyncHandler(getProfessorCv));
router.get('/challenges', asyncHandler(listChallenges));
router.get('/rankings/institutions', asyncHandler(getInstitutionRanking));
router.get('/rankings/individuals', asyncHandler(getIndividualRanking));
router.get('/challenges/:id/ranking', asyncHandler(getChallengeRanking));
router.get('/banks', asyncHandler(listBanks));
router.get('/banks/:id/temas', asyncHandler(getBankTemas));
router.get('/institutions', asyncHandler(listPublicInstitutions));
router.get('/qr', asyncHandler(qrImage));

// Aviso de apertura de matrícula
router.post('/leads', asyncHandler(subscribeLead));
router.delete('/leads/:email', asyncHandler(unsubscribeLead));
router.get('/actas/:code', asyncHandler(verificarActa));
router.get('/recognitions/:code', asyncHandler(verifyRecognition));
router.get('/recognitions/:code/pdf', asyncHandler(recognitionPdf));
router.get('/certificates/:code', asyncHandler(getPublicCertificate));
router.get('/certificates/:code/pdf', asyncHandler(publicCertificatePdf));

export default router;
