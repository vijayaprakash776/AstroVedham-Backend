import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';
import { getFirebaseAuth } from '../config/firebase';

// Canonical phone normalization for Indian mobile numbers
export const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  if (digits.length === 11 && digits.startsWith('0')) {
    return digits.slice(-10);
  }
  return digits;
};

// Simple email regex validation
const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/;
  return emailRegex.test(email);
};

/**
 * Google Authentication
 * POST /api/v1/auth/google
 */
export const googleAuth = async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;

    if (!idToken || typeof idToken !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required.'
      });
    }

    // Verify Firebase ID token cryptographically
    let decodedToken;
    try {
      decodedToken = await getFirebaseAuth().verifyIdToken(idToken);
    } catch (authError: any) {
      console.error('Firebase ID token verification failed:', authError);
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Invalid Firebase token.'
      });
    }

    const { uid, email, name: displayName } = decodedToken;

    if (!uid) {
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Firebase UID missing.'
      });
    }

    // 1. Search for customer by firebaseUid
    let customer = await prisma.customer.findUnique({
      where: { firebaseUid: uid }
    });

    // 2. If not found by firebaseUid, check by email if available
    if (!customer && email) {
      const cleanEmail = email.trim().toLowerCase();
      const existingByEmail = await prisma.customer.findUnique({
        where: { email: cleanEmail }
      });

      if (existingByEmail) {
        // Link firebaseUid to existing customer record
        customer = await prisma.customer.update({
          where: { id: existingByEmail.id },
          data: { firebaseUid: uid }
        });
      }
    }

    // 3. If still not found, create new customer
    if (!customer) {
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanName = displayName
        ? displayName.trim()
        : (cleanEmail ? cleanEmail.split('@')[0] : 'AstroVedham User');

      customer = await prisma.customer.create({
        data: {
          firebaseUid: uid,
          email: cleanEmail,
          name: cleanName,
        }
      });
    }

    // Generate AstroVedham JWT
    const token = jwt.sign(
      { id: customer.id, phone: customer.phone, role: 'CUSTOMER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Authentication successful',
      data: {
        token,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          gender: customer.gender,
          firebaseUid: customer.firebaseUid,
        }
      }
    });
  } catch (error: any) {
    console.error('Google auth error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to a server error. Please try again.'
    });
  }
};

/**
 * Get current customer profile
 * GET /api/v1/auth/me
 */
export const getMe = async (req: any, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gender: true,
        firebaseUid: true,
        createdAt: true,
      }
    });

    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    return res.status(200).json({
      success: true,
      data: { customer }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to fetch customer profile' });
  }
};

/**
 * Update customer profile
 * PATCH /api/v1/auth/profile
 */
export const updateProfile = async (req: any, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { name, gender } = req.body;
    const updateData: any = {};

    if (name && typeof name === 'string' && name.trim().length >= 2) {
      updateData.name = name.trim();
    }

    if (gender && typeof gender === 'string') {
      updateData.gender = gender.trim();
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        gender: true,
        firebaseUid: true,
      }
    });

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: { customer: updatedCustomer }
    });
  } catch (error: any) {
    return res.status(500).json({ success: false, message: 'Failed to update profile' });
  }
};

/**
 * Customer Registration (Legacy/Password fallback)
 * POST /api/v1/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, mobile, password } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid full name (minimum 2 characters).'
      });
    }

    if (!email || typeof email !== 'string' || !isValidEmail(email.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    if (!mobile || typeof mobile !== 'string' || mobile.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid mobile number.'
      });
    }

    const normalizedMobile = normalizePhone(mobile.trim());
    if (normalizedMobile.length !== 10) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number must be exactly 10 digits.'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    const existingMobileCustomer = await prisma.customer.findUnique({
      where: { phone: normalizedMobile }
    });

    if (existingMobileCustomer) {
      return res.status(400).json({
        success: false,
        message: 'An account already exists with this mobile number. Please log in.'
      });
    }

    const existingEmailCustomer = await prisma.customer.findUnique({
      where: { email: cleanEmail }
    });

    if (existingEmailCustomer) {
      return res.status(400).json({
        success: false,
        message: 'An account already exists with this email address. Please log in.'
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newCustomer = await prisma.customer.create({
      data: {
        name: cleanName,
        email: cleanEmail,
        phone: normalizedMobile,
        passwordHash
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please log in.',
      data: {
        customer: {
          id: newCustomer.id,
          name: newCustomer.name,
          phone: newCustomer.phone,
          email: newCustomer.email
        }
      }
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Registration failed due to a server error. Please try again.'
    });
  }
};

/**
 * Customer Login (Legacy/Password fallback)
 * POST /api/v1/auth/login
 */
export const login = async (req: Request, res: Response) => {
  try {
    const { mobile, password } = req.body;

    if (!mobile || typeof mobile !== 'string' || mobile.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your mobile number.'
      });
    }

    if (!password || typeof password !== 'string' || password.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter your password.'
      });
    }

    const normalizedMobile = normalizePhone(mobile.trim());
    if (normalizedMobile.length !== 10) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.'
      });
    }

    const customer = await prisma.customer.findUnique({
      where: { phone: normalizedMobile }
    });

    if (!customer) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.'
      });
    }

    if (!customer.passwordHash) {
      return res.status(401).json({
        success: false,
        message: 'Account setup required. Please register your password or contact support.'
      });
    }

    const isPasswordValid = await bcrypt.compare(password, customer.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.'
      });
    }

    const token = jwt.sign(
      { id: customer.id, phone: customer.phone, role: 'CUSTOMER' },
      process.env.JWT_SECRET || 'fallback_secret',
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email
        }
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed due to a server error. Please try again.'
    });
  }
};
