import { Router } from 'express';
import authRoutes from './auth';
import orderRoutes from './orders';
import { requireAdminAuth } from '../../middleware/auth';

const router = Router();

router.use('/auth', authRoutes);
router.use('/orders', requireAdminAuth, orderRoutes);

// Dashboard route
import { getDashboardStats } from '../../controllers/admin/orderController';
router.get('/dashboard', requireAdminAuth, getDashboardStats);

export default router;
