import { Router } from 'express';
import { listOpenCourses, getPublicCourse } from '../controllers/course.controller.js';
import { getProfessorCv } from '../controllers/profile.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Public endpoints (no auth) — course discovery for the login page. */
const router = Router();
router.get('/courses', asyncHandler(listOpenCourses));
router.get('/courses/:id', asyncHandler(getPublicCourse));
router.get('/professors/:id/cv', asyncHandler(getProfessorCv));

export default router;
