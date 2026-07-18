import { Router } from 'express';
import { listOpenCourses, getPublicCourse } from '../controllers/course.controller.js';
import { getProfessorCv } from '../controllers/profile.controller.js';
import { listChallenges, getChallengeRanking, getInstitutionRanking } from '../controllers/challenge.controller.js';
import { listBanks, getBankTemas } from '../controllers/bank.controller.js';
import { getPublicCertificate, publicCertificatePdf } from '../controllers/certificate.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Public endpoints (no auth) — course discovery + challenges/rankings. */
const router = Router();
router.get('/courses', asyncHandler(listOpenCourses));
router.get('/courses/:id', asyncHandler(getPublicCourse));
router.get('/professors/:id/cv', asyncHandler(getProfessorCv));
router.get('/challenges', asyncHandler(listChallenges));
router.get('/rankings/institutions', asyncHandler(getInstitutionRanking));
router.get('/challenges/:id/ranking', asyncHandler(getChallengeRanking));
router.get('/banks', asyncHandler(listBanks));
router.get('/banks/:id/temas', asyncHandler(getBankTemas));
router.get('/certificates/:code', asyncHandler(getPublicCertificate));
router.get('/certificates/:code/pdf', asyncHandler(publicCertificatePdf));

export default router;
