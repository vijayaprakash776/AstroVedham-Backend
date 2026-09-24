import { Router } from 'express';
import { googleAuth, checkPhone, sendOtp, verifyOtp } from '../controllers/authController';

const router = Router();

/**
 * Authenticate customer with Google (Firebase ID Token)
 * POST /api/v1/auth/google
 */
router.post('/google', googleAuth);

/**
 * Check if customer mobile number exists
 * POST /api/v1/auth/check-phone
 */
router.post('/check-phone', checkPhone);

/**
 * Request passwordless phone verification code
 * POST /api/v1/auth/send-otp
 */
router.post('/send-otp', sendOtp);

/**
 * Verify code and authenticate customer
 * POST /api/v1/auth/verify-otp
 */
router.post('/verify-otp', verifyOtp);

export default router;
