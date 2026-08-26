import { Router } from 'express';

import {
  createOrder,
  getCustomerOrders,
  getOrder,
  getOrderReport,
} from '../controllers/orderController';

const router = Router();

/**
 * Create a new order
 *
 * POST /api/v1/orders
 */
router.post('/', createOrder);

/**
 * Get customer's orders
 *
 * GET /api/v1/orders?phone=9876543210&page=1&limit=10
 */
router.get('/', getCustomerOrders);

/**
 * Get horoscope report PDF
 *
 * GET /api/v1/orders/:orderNumber/report
 */
router.get('/:orderNumber/report', getOrderReport);

/**
 * Get single order
 *
 * GET /api/v1/orders/:orderNumber
 */
router.get('/:orderNumber', getOrder);

export default router;