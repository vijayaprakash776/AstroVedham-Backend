import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import { getFirebaseAuth } from '../config/firebase';

// Helper to mask email address for safe logging
const maskEmail = (email?: string | null): string => {
  if (!email) return 'none';
  const parts = email.split('@');
  if (parts.length !== 2) return 'invalid-email';
  const name = parts[0];
  const domain = parts[1];
  const maskedName = name.length <= 2 ? name[0] + '*' : `${name[0]}***${name[name.length - 1]}`;
  const maskedDomain = domain.length <= 4 ? domain : `${domain[0]}***${domain.slice(-2)}`;
  return `${maskedName}@${maskedDomain}`;
};

// Helper to mask UID for safe logging
const maskUid = (uid?: string | null): string => {
  if (!uid) return 'none';
  if (uid.length <= 6) return '***';
  return `${uid.slice(0, 3)}***${uid.slice(-3)}`;
};

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

/**
 * Google Authentication
 * POST /api/v1/auth/google
 */
export const googleAuth = async (req: Request, res: Response) => {
  console.log('[AUTH GOOGLE] Request received');

  try {
    const body = req.body || {};
    const idToken = body.idToken;

    console.log(`[AUTH GOOGLE] ID token received: ${idToken ? 'yes' : 'no'}`);

    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      console.warn('[AUTH GOOGLE] Validation failed: missing or empty idToken');
      return res.status(400).json({
        success: false,
        message: 'Firebase ID token is required.'
      });
    }

    // 1. Verify Firebase ID token
    console.log('[AUTH GOOGLE] Verifying Firebase ID token');
    let decodedToken: any;
    try {
      const auth = getFirebaseAuth();
      decodedToken = await auth.verifyIdToken(idToken);
      console.log('[AUTH GOOGLE] Firebase token verified successfully');
    } catch (authError: any) {
      console.error('[AUTH GOOGLE] Firebase ID token verification failed:', {
        name: authError?.name,
        message: authError?.message,
        code: authError?.code,
        stack: authError?.stack,
      });
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Invalid Firebase token.'
      });
    }

    if (!decodedToken) {
      console.error('[AUTH GOOGLE] Decoded token is empty after verification');
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Invalid Firebase token.'
      });
    }

    const { uid, email, name: displayName } = decodedToken;

    console.log(`[AUTH GOOGLE] Firebase UID: ${maskUid(uid)}`);
    console.log(`[AUTH GOOGLE] Firebase email present: ${email ? 'yes (' + maskEmail(email) + ')' : 'no'}`);

    if (!uid) {
      console.error('[AUTH GOOGLE] Firebase UID missing from decoded token');
      return res.status(401).json({
        success: false,
        message: 'Authentication failed. Firebase UID missing.'
      });
    }

    // 2. Search customer by firebaseUid
    console.log('[AUTH GOOGLE] Searching customer by firebaseUid');
    let customer: any = null;

    try {
      customer = await prisma.customer.findUnique({
        where: { firebaseUid: uid }
      });
      console.log(`[AUTH GOOGLE] Customer found by firebaseUid: ${customer ? 'yes (ID: ' + customer.id + ')' : 'no'}`);
    } catch (dbError: any) {
      console.error('[AUTH GOOGLE] Database error searching customer by firebaseUid:', {
        name: dbError?.name,
        message: dbError?.message,
        prismaCode: dbError?.code,
        stack: dbError?.stack,
      });
      throw dbError;
    }

    // 3. Search customer by email if not found by firebaseUid
    if (!customer && email) {
      const cleanEmail = email.trim().toLowerCase();
      console.log(`[AUTH GOOGLE] Searching customer by email (${maskEmail(cleanEmail)})`);

      try {
        const existingByEmail = await prisma.customer.findUnique({
          where: { email: cleanEmail }
        });

        if (existingByEmail) {
          console.log(`[AUTH GOOGLE] Customer found by email (ID: ${existingByEmail.id})`);
          if (!existingByEmail.firebaseUid) {
            console.log('[AUTH GOOGLE] Linking firebaseUid to existing customer record');
            customer = await prisma.customer.update({
              where: { id: existingByEmail.id },
              data: { firebaseUid: uid }
            });
            console.log('[AUTH GOOGLE] Successfully linked firebaseUid to customer record');
          } else {
            console.log('[AUTH GOOGLE] Customer already has firebaseUid set');
            customer = existingByEmail;
          }
        } else {
          console.log('[AUTH GOOGLE] Customer not found by email');
        }
      } catch (dbEmailError: any) {
        console.error('[AUTH GOOGLE] Database error searching/linking customer by email:', {
          name: dbEmailError?.name,
          message: dbEmailError?.message,
          prismaCode: dbEmailError?.code,
          stack: dbEmailError?.stack,
        });
        throw dbEmailError;
      }
    }

    // 4. Create new customer if still not found
    if (!customer) {
      console.log('[AUTH GOOGLE] Creating new customer without phone number');
      const cleanEmail = email ? email.trim().toLowerCase() : null;
      const cleanName = displayName
        ? displayName.trim()
        : (cleanEmail ? cleanEmail.split('@')[0] : 'AstroVedham User');

      try {
        customer = await prisma.customer.create({
          data: {
            firebaseUid: uid,
            email: cleanEmail,
            name: cleanName,
            phone: null,
            gender: null,
          }
        });
        console.log(`[AUTH GOOGLE] New customer created successfully (ID: ${customer.id})`);
      } catch (createError: any) {
        console.error('[AUTH GOOGLE] Database error creating new customer:', {
          name: createError?.name,
          message: createError?.message,
          prismaCode: createError?.code,
          stack: createError?.stack,
        });
        throw createError;
      }
    }

    // 5. Generate AstroVedham JWT
    console.log('[AUTH GOOGLE] Generating AstroVedham JWT');
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
    if (!process.env.JWT_SECRET) {
      console.warn('[AUTH GOOGLE] JWT_SECRET environment variable is not configured, using fallback secret');
    }

    let token: string;
    try {
      token = jwt.sign(
        { id: customer.id, phone: customer.phone, role: 'CUSTOMER' },
        jwtSecret,
        { expiresIn: '30d' }
      );
      console.log('[AUTH GOOGLE] AstroVedham JWT generated successfully');
    } catch (jwtError: any) {
      console.error('[AUTH GOOGLE] Error generating JWT token:', {
        name: jwtError?.name,
        message: jwtError?.message,
        stack: jwtError?.stack,
      });
      throw jwtError;
    }

    console.log('[AUTH GOOGLE] Authentication successful');

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
    console.error('[AUTH GOOGLE] Server Error during Google Auth flow:', {
      name: error?.name,
      message: error?.message,
      prismaCode: error?.code || null,
      firebaseCode: error?.code || null,
      stack: error?.stack,
    });

    return res.status(500).json({
      success: false,
      message: 'Authentication failed due to a server error. Please try again.'
    });
  }
};

/**
 * Set missing mobile number for customer (Profile completion)
 * PATCH /api/v1/auth/phone or POST /api/v1/auth/phone
 */
export const setPhone = async (req: any, res: Response) => {
  try {
    const customerId = req.customer?.id;
    if (!customerId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    const { phone, mobile } = req.body || {};
    const rawPhone = phone || mobile;

    if (!rawPhone || typeof rawPhone !== 'string' || rawPhone.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid mobile number.'
      });
    }

    const normalizedMobile = normalizePhone(rawPhone.trim());
    const phoneRegex = /^[6-9][0-9]{9}$/;

    if (!phoneRegex.test(normalizedMobile)) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number must be exactly 10 digits starting with 6, 7, 8, or 9.'
      });
    }

    const currentCustomer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!currentCustomer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    if (currentCustomer.phone) {
      return res.status(400).json({
        success: false,
        message: 'Mobile number has already been set and cannot be modified.'
      });
    }

    const existingPhoneCustomer = await prisma.customer.findUnique({
      where: { phone: normalizedMobile }
    });

    if (existingPhoneCustomer) {
      return res.status(400).json({
        success: false,
        message: 'This mobile number is already registered with another account.'
      });
    }

    const updatedCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: { phone: normalizedMobile },
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
      message: 'Mobile number updated successfully.',
      data: { customer: updatedCustomer }
    });
  } catch (error: any) {
    console.error('Error setting phone number:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update mobile number. Please try again.'
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
