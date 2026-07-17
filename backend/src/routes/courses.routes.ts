import { Router } from 'express';
import { createCourse, listCourses, getCourse } from '../controllers/course.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'profesor'));

router.get('/', asyncHandler(listCourses));
router.post('/', asyncHandler(createCourse));
router.get('/:id', asyncHandler(getCourse));

export default router;
