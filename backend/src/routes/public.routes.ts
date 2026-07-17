import { Router } from 'express';
import { listOpenCourses } from '../controllers/course.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/** Public endpoints (no auth) — course discovery for the login page. */
const router = Router();
router.get('/courses', asyncHandler(listOpenCourses));

export default router;
