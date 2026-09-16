import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { requireCustomerAuth } from '../middleware/customerAuth';

import {
  createOrder,
  getCustomerOrders,
  getOrder,
  getOrderReport,
  createGuestOrder,
  getGuestOrder,
  getGuestOrderReport,
} from '../controllers/orderController';

const router = Router();

// Rate limiters for public guest access
const guestOrderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 orders per hour per IP
  message: { success: false, message: 'Too many order requests from this IP, please try again later' }
});

const guestLookupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 lookups per 15 mins
  message: { success: false, message: 'Too many lookup attempts, please try again later' }
});

/**
 * Public Guest Order Checkout
 */
router.post('/guest', guestOrderLimiter, createGuestOrder);
router.get('/guest/:orderNumber', guestLookupLimiter, getGuestOrder);
router.get('/guest/:orderNumber/report', guestLookupLimiter, getGuestOrderReport);

// Apply the customer auth protection middleware across all subsequent authenticated customer routes
router.use(requireCustomerAuth);

/**
 * Create a new order
 *
 * POST /api/v1/orders
 */
router.post('/', createOrder);

/**
 * Get customer's orders
 *
 * GET /api/v1/orders
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