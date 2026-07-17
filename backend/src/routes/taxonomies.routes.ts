import { Router } from 'express';
import { listTaxonomies, createTaxonomy, updateTaxonomy } from '../controllers/taxonomy.controller.js';
import { requireAuth } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();
router.use(requireAuth, requireRole('super_admin', 'profesor'));

router.get('/', asyncHandler(listTaxonomies));               // leer: staff
router.post('/', requireRole('super_admin'), asyncHandler(createTaxonomy));   // editar: solo super_admin
router.patch('/:id', requireRole('super_admin'), asyncHandler(updateTaxonomy));

export default router;
