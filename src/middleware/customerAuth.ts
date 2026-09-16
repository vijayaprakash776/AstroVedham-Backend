import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';

export interface CustomerAuthRequest extends Request {
  customer?: {
    id: string;
    phone: string;
    email: string | null;
    name: string;
  };
}

export const requireCustomerAuth = async (req: CustomerAuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Authentication token required' });
    }

    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret');

    // Basic role validation to keep customer separated from admin token scopes
    if (decoded.role !== 'CUSTOMER') {
      return res.status(403).json({ success: false, message: 'Access denied: invalid token scope' });
    }

    const customer = await prisma.customer.findUnique({
      where: { id: decoded.id },
      select: { id: true, phone: true, email: true, name: true },
    });

    if (!customer) {
      return res.status(401).json({ success: false, message: 'Customer account not found' });
    }

    req.customer = customer;
    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Invalid or expired authentication token' });
  }
};
