import { Router } from 'express';
import multer from 'multer';
import { getProfile, changePassword, uploadProfilePhoto, generateLegajo, getCv, addCvItem, deleteCvItem } from '../controllers/profile.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.use(requireAuth); // any authenticated role

router.get('/', asyncHandler(getProfile));
router.post('/password', asyncHandler(changePassword));
router.post('/photo', upload.single('file'), asyncHandler(uploadProfilePhoto));
router.get('/legajo', asyncHandler(generateLegajo));

// CV del profesor
router.get('/cv', asyncHandler(getCv));
router.post('/cv', asyncHandler(addCvItem));
router.delete('/cv/:itemId', asyncHandler(deleteCvItem));

export default router;
