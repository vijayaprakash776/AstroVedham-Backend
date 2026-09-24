import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import prisma from '../config/prisma';

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
 * Customer Registration
 * POST /api/v1/auth/register
 */
export const register = async (req: Request, res: Response) => {
  try {
    const { name, email, mobile, password } = req.body;

    // Validate Full Name
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid full name (minimum 2 characters).'
      });
    }

    // Validate Email
    if (!email || typeof email !== 'string' || !isValidEmail(email.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address.'
      });
    }

    // Validate Mobile Number
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

    // Validate Password
    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // Check existing customer by normalized mobile number
    const existingMobileCustomer = await prisma.customer.findUnique({
      where: { phone: normalizedMobile }
    });

    if (existingMobileCustomer) {
      return res.status(400).json({
        success: false,
        message: 'An account already exists with this mobile number. Please log in.'
      });
    }

    // Check existing customer by email
    const existingEmailCustomer = await prisma.customer.findUnique({
      where: { email: cleanEmail }
    });

    if (existingEmailCustomer) {
      return res.status(400).json({
        success: false,
        message: 'An account already exists with this email address. Please log in.'
      });
    }

    // Hash password with bcrypt cost factor 10
    const passwordHash = await bcrypt.hash(password, 10);

    // Create customer record
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
 * Customer Login
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

    // Find customer by mobile number
    const customer = await prisma.customer.findUnique({
      where: { phone: normalizedMobile }
    });

    // Rejection for non-existing customer or customer created via legacy methods without password
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

    // Verify password hash
    const isPasswordValid = await bcrypt.compare(password, customer.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid mobile number or password.'
      });
    }

    // Generate existing AstroVedham JWT
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
