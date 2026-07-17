import { Router } from 'express';
import { listOpenCourses, getPublicCourse } from '../controllers/course.controller.js';
import { getProfessorCv } from '../controllers/profile.controller.js';
import { listChallenges, getChallengeRanking } from '../controllers/challenge.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Public endpoints (no auth) — course discovery + challenges/rankings. */
const router = Router();
router.get('/courses', asyncHandler(listOpenCourses));
router.get('/courses/:id', asyncHandler(getPublicCourse));
router.get('/professors/:id/cv', asyncHandler(getProfessorCv));
router.get('/challenges', asyncHandler(listChallenges));
router.get('/challenges/:id/ranking', asyncHandler(getChallengeRanking));

export default router;
