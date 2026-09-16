import { Router } from 'express';
import { getServices } from '../controllers/serviceController';

const router = Router();

/**
 * Get active services catalog
 * GET /api/v1/services
 */
router.get('/', getServices);

export default router;
