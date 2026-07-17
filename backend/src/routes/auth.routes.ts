import { Router } from 'express';
import {
  adminLogin,
  professorRegister,
  studentRegister,
  studentLoginEmail,
  studentLoginCode,
  logout,
  me,
} from '../controllers/auth.controller.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { authLimiter } from '../middleware/rateLimiter.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Admin (super_admin + institution_admin + profesor)
router.post('/admin/login', authLimiter, asyncHandler(adminLogin));

// Professor self-registration (creates a pending account)
router.post('/professor/register', authLimiter, asyncHandler(professorRegister));

// Student - 3 methods
router.post('/student/register', authLimiter, asyncHandler(studentRegister)); // 1
router.post('/student/login-email', authLimiter, asyncHandler(studentLoginEmail)); // 2
router.post('/student/login-code', authLimiter, asyncHandler(studentLoginCode)); // 3

// Session
router.post('/logout', requireAuth, asyncHandler(logout));
router.get('/me', requireAuth, asyncHandler(me));

export default router;
