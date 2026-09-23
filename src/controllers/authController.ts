import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { smsService } from '../services/smsService';

// Phone normalization function
export const normalizePhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(-10);
  }
  return digits;
};

// Hash function for OTP
const hashOtp = (otp: string): string => {
  return crypto.createHash('sha256').update(otp).digest('hex');
};

/**
 * Check if customer mobile number already exists
 * POST /api/v1/auth/check-phone
 */
export const checkPhone = async (req: Request, res: Response) => {
  const { phone } = req.body;

  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Valid phone number is required' });
  }

  const cleanedPhone = normalizePhone(phone);
  if (cleanedPhone.length !== 10) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number' });
  }

  try {
    const customer = await prisma.customer.findUnique({ where: { phone: cleanedPhone } });
    return res.status(200).json({
      success: true,
      data: {
        exists: !!customer
      }
    });
  } catch (error) {
    console.error('Check phone error:', error);
    return res.status(500).json({ success: false, message: 'Failed to check phone number' });
  }
};

/**
 * Send OTP to customer phone
 * POST /api/v1/auth/send-otp
 */
export const sendOtp = async (req: Request, res: Response) => {
  const { phone, name } = req.body;

  if (!phone || typeof phone !== 'string' || phone.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Valid phone number is required' });
  }

  const cleanedPhone = normalizePhone(phone);
  if (cleanedPhone.length !== 10) {
    return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number' });
  }

  try {
    // Generate a secure 6 digit numeric code
    const isMockEnabled = process.env.MOCK_OTP_ENABLED === 'true';
    const otp = isMockEnabled
      ? (process.env.MOCK_OTP || '123456')
      : Math.floor(100000 + Math.random() * 900000).toString();

    const otpHash = hashOtp(otp);
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiration

    // Check if customer exists, if not create a shell or update existing
    let customer = await prisma.customer.findUnique({ where: { phone: cleanedPhone } });

    const customerName = (name && typeof name === 'string' && name.trim().length > 0)
      ? name.trim()
      : 'User';

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone: cleanedPhone,
          name: customerName,
          otpHash,
          otpExpiresAt
        }
      });
    } else {
      const updateData: any = { otpHash, otpExpiresAt };
      if (name && typeof name === 'string' && name.trim().length > 0) {
        updateData.name = name.trim();
      }
      await prisma.customer.update({
        where: { id: customer.id },
        data: updateData
      });
    }

    // Trigger SMS dispatch
    await smsService.sendOtp(cleanedPhone, otp);

    return res.status(200).json({
      success: true,
      message: 'Verification code sent successfully'
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    return res.status(500).json({ success: false, message: 'Failed to dispatch verification code' });
  }
};

/**
 * Verify OTP code and return signed Customer JWT
 * POST /api/v1/auth/verify-otp
 */
export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, otp, name, email } = req.body;

  if (!phone || !otp) {
    return res.status(400).json({ success: false, message: 'Phone number and verification code are required' });
  }

  const cleanedPhone = normalizePhone(phone);

  try {
    const customer = await prisma.customer.findUnique({ where: { phone: cleanedPhone } });

    if (!customer || !customer.otpHash || !customer.otpExpiresAt) {
      return res.status(401).json({ success: false, message: 'Invalid verification session or expired' });
    }

    // Check expiration
    if (new Date() > customer.otpExpiresAt) {
      return res.status(401).json({ success: false, message: 'Verification code has expired' });
    }

    // Validate hash match
    const isMockEnabled = process.env.MOCK_OTP_ENABLED === 'true';
    const mockOtp = process.env.MOCK_OTP || '123456';
    const isMockOtp = isMockEnabled && otp === mockOtp;

    if (hashOtp(otp) !== customer.otpHash && !isMockOtp) {
      console.warn(`[AUTH] OTP Verification failed for phone ${cleanedPhone}. MockEnabled: ${isMockEnabled}`);
      return res.status(401).json({ success: false, message: 'Incorrect verification code' });
    }

    // Consume the OTP code (one-time use)
    const updateData: any = {
      otpHash: null,
      otpExpiresAt: null
    };

    // If profile variables are provided during initial registration/onboarding, update them
    if (name && typeof name === 'string' && name.trim().length > 0) {
      updateData.name = name.trim();
    }
    if (email && typeof email === 'string' && email.trim().length > 0) {
      updateData.email = email.trim();
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customer.id },
      data: updateData
    });

    // Generate secure customer JWT
    const token = jwt.sign(
      { id: updatedCustomer.id, phone: updatedCustomer.phone, role: 'CUSTOMER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' } // Customer stay logged in longer for mobile convenience
    );

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token,
        customer: {
          id: updatedCustomer.id,
          name: updatedCustomer.name,
          phone: updatedCustomer.phone,
          email: updatedCustomer.email
        }
      }
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    return res.status(500).json({ success: false, message: 'Authentication failed' });
  }
};
