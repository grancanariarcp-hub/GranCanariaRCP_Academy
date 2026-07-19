import { Router } from 'express';
import multer from 'multer';
import { uploadDocument, listDocuments, getDocumentUrl, deleteDocument } from '../controllers/document.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

/**
 * Biblioteca de documentos de referencia (guías ERC, PNRCP…) que se enlazan
 * como actividades de los cursos.
 *
 * Vivía solo bajo /api/admin, reservado a super_admin, de modo que un profesor
 * no podía subir el material de su propio curso. Se expone aquí para todo el
 * profesorado; las rutas antiguas se mantienen para no romper nada.
 */
const router = Router();

// Los PDF se retienen en memoria y se envían a R2. Tope de 40 MB.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 40 * 1024 * 1024 } });

router.use(requireAuth, requireRole('super_admin', 'profesor'));

router.get('/', asyncHandler(listDocuments));
router.post('/', upload.single('file'), asyncHandler(uploadDocument));
router.get('/:id/url', asyncHandler(getDocumentUrl));
router.delete('/:id', asyncHandler(deleteDocument));

export default router;
