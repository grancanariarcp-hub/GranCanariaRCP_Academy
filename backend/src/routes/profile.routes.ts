import { Router } from 'express';
import multer from 'multer';
import { getProfile, changePassword, changeEmail, getConsents, updateConsents, deleteMyAccount, uploadProfilePhoto, generateLegajo, getCv, addCvItem, deleteCvItem } from '../controllers/profile.controller.js';
import { myPendingGroups, markJoined } from '../controllers/whatsapp.controller.js';
import { heartbeat, myLearningTime } from '../controllers/learningTime.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });

router.use(requireAuth); // any authenticated role

router.get('/', asyncHandler(getProfile));
router.post('/password', asyncHandler(changePassword));
router.post('/email', asyncHandler(changeEmail));
router.post('/heartbeat', asyncHandler(heartbeat));
router.get('/time', asyncHandler(myLearningTime));
router.get('/whatsapp', asyncHandler(myPendingGroups));
router.post('/whatsapp/joined', asyncHandler(markJoined));
router.delete('/', asyncHandler(deleteMyAccount));
router.get('/consents', asyncHandler(getConsents));
router.post('/consents', asyncHandler(updateConsents));
router.post('/photo', upload.single('file'), asyncHandler(uploadProfilePhoto));
router.get('/legajo', asyncHandler(generateLegajo));

// CV del profesor
router.get('/cv', asyncHandler(getCv));
router.post('/cv', asyncHandler(addCvItem));
router.delete('/cv/:itemId', asyncHandler(deleteCvItem));

export default router;
