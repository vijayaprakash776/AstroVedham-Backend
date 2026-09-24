import { Router } from 'express';
import { register, login } from '../controllers/authController';

const router = Router();

/**
 * POST /api/v1/auth/register
 * Customer Registration with Mobile Number + Password
 */
router.post('/register', register);

/**
 * POST /api/v1/auth/login
 * Customer Login with Mobile Number + Password
 */
router.post('/login', login);

export default router;
