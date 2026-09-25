import { Router } from 'express';
import { googleAuth, getMe, updateProfile, setPhone, register, login } from '../controllers/authController';
import { requireCustomerAuth } from '../middleware/customerAuth';

const router = Router();

/**
 * POST /api/v1/auth/google
 * Customer Google Sign-In with Firebase ID Token
 */
router.post('/google', googleAuth);

/**
 * GET /api/v1/auth/me
 * Get currently authenticated customer profile
 */
router.get('/me', requireCustomerAuth, getMe);

/**
 * PATCH /api/v1/auth/profile
 * Update customer profile details (name, gender)
 */
router.patch('/profile', requireCustomerAuth, updateProfile);

/**
 * PATCH /api/v1/auth/phone
 * POST /api/v1/auth/phone
 * Set missing mobile number for Google customer
 */
router.patch('/phone', requireCustomerAuth, setPhone);
router.post('/phone', requireCustomerAuth, setPhone);

/**
 * POST /api/v1/auth/register
 * Customer Registration (Legacy/Password fallback)
 */
router.post('/register', register);

/**
 * POST /api/v1/auth/login
 * Customer Login (Legacy/Password fallback)
 */
router.post('/login', login);

export default router;
