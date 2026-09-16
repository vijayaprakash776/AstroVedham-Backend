import { Router } from 'express';
import { sendOtp, verifyOtp } from '../controllers/authController';

const router = Router();

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
