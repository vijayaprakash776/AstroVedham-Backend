import { Response } from 'express';
import prisma from '../config/prisma';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { CustomerAuthRequest } from '../middleware/customerAuth';
import { generateOrderNumber } from '../utils/order';

/**
 * Create a new customer order
 * POST /api/v1/orders
 */
export const createOrder = async (req: CustomerAuthRequest, res: Response) => {
  const {
    serviceSlug,
    inputDetails
  } = req.body;

  if (!req.customer) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  if (!serviceSlug) {
    return res.status(400).json({ success: false, message: 'serviceSlug is required' });
  }

  if (!inputDetails) {
    return res.status(400).json({ success: false, message: 'Horoscope input details are required' });
  }

  try {
    // Find service from backend dynamic catalog to resolve authoritative price
    const service = await prisma.service.findUnique({
      where: { slug: serviceSlug }
    });

    if (!service || !service.active) {
      return res.status(400).json({ success: false, message: 'The requested service is invalid or inactive' });
    }

    // Generate unique concurrency-safe AstroVedham order number
    const orderNumber = await generateOrderNumber();

    // Create order using authoritative pricing and details from DB
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: req.customer.id,
        serviceId: service.id,
        horoscopeType: service.slug,
        horoscopeTitle: service.title,
        inputDetails,
        amount: service.price,
        currency: 'INR',
        status: 'PENDING',
      },
      include: {
        customer: true,
      },
    });

    return res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          horoscopeType: order.horoscopeType,
          horoscopeTitle: order.horoscopeTitle,
          inputDetails: order.inputDetails,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          resultAvailable: order.resultAvailable,
          pdfPath: order.pdfPath,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          completedAt: order.completedAt,
          cancelledAt: order.cancelledAt,
        },
        customer: {
          id: order.customer.id,
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email,
        },
      },
    });
  } catch (error) {
    console.error('Create order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create order',
    });
  }
};

/**
 * Get authenticated customer's orders
 * GET /api/v1/orders
 */
export const getCustomerOrders = async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  const page = Math.max(Number.parseInt(String(req.query.page || '1'), 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(String(req.query.limit || '10'), 10) || 10, 1), 50);
  const skip = (page - 1) * limit;

  try {
    // Fetch orders scoped STRICTLY by authenticated customer ID (Fixes IDOR vulnerability)
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: { customerId: req.customer.id },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.order.count({
        where: { customerId: req.customer.id },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Customer orders retrieved successfully',
      data: {
        customer: req.customer,
        orders: orders.map((order) => ({
          id: order.id,
          orderNumber: order.orderNumber,
          horoscopeType: order.horoscopeType,
          horoscopeTitle: order.horoscopeTitle,
          inputDetails: order.inputDetails,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          resultAvailable: order.resultAvailable,
          pdfPath: order.pdfPath,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          completedAt: order.completedAt,
          cancelledAt: order.cancelledAt,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages,
          hasNextPage: page < totalPages,
          hasPreviousPage: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Get customer orders error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve customer orders',
    });
  }
};

/**
 * Get a single customer order
 * GET /api/v1/orders/:orderNumber
 */
export const getOrder = async (req: CustomerAuthRequest, res: Response) => {
  const { orderNumber } = req.params;

  if (!req.customer) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  if (!orderNumber) {
    return res.status(400).json({ success: false, message: 'Order number is required' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { customer: true },
    });

    // Enforce ownership check to block multi-tenant IDOR access
    if (!order || order.customerId !== req.customer.id) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Order retrieved successfully',
      data: {
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          horoscopeType: order.horoscopeType,
          horoscopeTitle: order.horoscopeTitle,
          inputDetails: order.inputDetails,
          amount: order.amount,
          currency: order.currency,
          status: order.status,
          resultAvailable: order.resultAvailable,
          pdfPath: order.pdfPath,
          createdAt: order.createdAt,
          updatedAt: order.updatedAt,
          completedAt: order.completedAt,
          cancelledAt: order.cancelledAt,
        },
        customer: {
          id: order.customer.id,
          name: order.customer.name,
          phone: order.customer.phone,
          email: order.customer.email,
        },
      },
    });
  } catch (error) {
    console.error('Get order error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve order',
    });
  }
};

/**
 * Get horoscope report PDF
 * GET /api/v1/orders/:orderNumber/report
 */
export const getOrderReport = async (req: CustomerAuthRequest, res: Response) => {
  const { orderNumber } = req.params;

  if (!req.customer) {
    return res.status(401).json({ success: false, message: 'Unauthenticated' });
  }

  if (!orderNumber) {
    return res.status(400).json({ success: false, message: 'Order number is required' });
  }

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
    });

    // Verify ownership prior to exposing file stream parameters
    if (!order || order.customerId !== req.customer.id) {
      return res.status(404).json({
        success: false,
        message: 'Order report not found',
      });
    }

    // Report is not ready yet
    if (!order.resultAvailable || order.status !== 'SUCCESS') {
      return res.status(400).json({
        success: false,
        message: 'Horoscope report is not available yet',
      });
    }

    if (!order.pdfPath) {
      return res.status(404).json({
        success: false,
        message: 'Horoscope report file not found',
      });
    }

    const reportPath = path.isAbsolute(order.pdfPath)
      ? order.pdfPath
      : path.resolve(process.cwd(), order.pdfPath);

    // Verify the physical file exists
    if (!fs.existsSync(reportPath)) {
      console.error(`Report file does not exist: ${reportPath}`);
      return res.status(404).json({
        success: false,
        message: 'Horoscope report file is missing from disk storage',
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${order.orderNumber}-report.pdf"`);

    return res.sendFile(reportPath);
  } catch (error) {
    console.error('Get order report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve horoscope report',
    });
  }
};

/**
 * Create a new guest order
 * POST /api/v1/orders/guest
 */
export const createGuestOrder = async (req: any, res: any) => {
  const {
    serviceSlug,
    inputDetails,
    fullName,
    name,
    phone,
    email
  } = req.body;

  if (!serviceSlug) {
    return res.status(400).json({ success: false, message: 'serviceSlug is required' });
  }

  // Extract name and phone robustly from body parameters or nested inputDetails
  const finalPhone = String(phone || inputDetails?.phone || inputDetails?.contact?.phone || '').trim();
  const finalName = String(fullName || name || inputDetails?.name || inputDetails?.contact?.name || 'Guest User').trim();
  const finalEmail = String(email || inputDetails?.email || inputDetails?.contact?.email || '').trim();

  if (!finalPhone) {
    return res.status(400).json({ success: false, message: 'Customer phone number is required' });
  }

  // Simple validations
  const phoneRegex = /^\+?[\d\s-]{10,15}$/;
  if (!phoneRegex.test(finalPhone)) {
    return res.status(400).json({ success: false, message: 'Invalid phone number format' });
  }

  if (finalEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(finalEmail)) {
    return res.status(400).json({ success: false, message: 'Invalid email address format' });
  }

  try {
    const service = await prisma.service.findUnique({ where: { slug: serviceSlug } });
    if (!service || !service.active) {
      return res.status(400).json({ success: false, message: 'The requested service is invalid or inactive' });
    }

    // Find or create customer shell based on unique phone
    let customer = await prisma.customer.findUnique({ where: { phone: finalPhone } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          phone: finalPhone,
          name: finalName,
          email: finalEmail || null
        }
      });
    }

    const orderNumber = await generateOrderNumber();
    const guestAccessToken = crypto.randomBytes(32).toString('hex');
    const guestTokenHash = crypto.createHash('sha256').update(guestAccessToken).digest('hex');

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: customer.id,
        serviceId: service.id,
        horoscopeType: service.slug,
        horoscopeTitle: service.title,
        inputDetails: inputDetails || req.body,
        amount: service.price,
        currency: 'INR',
        status: 'PENDING',
        guestTokenHash
      },
      include: { customer: true }
    });

    return res.status(201).json({
      success: true,
      message: 'Guest order created successfully',
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        amount: order.amount,
        currency: order.currency,
        horoscopeTitle: order.horoscopeTitle,
        horoscopeType: order.horoscopeType,
        createdAt: order.createdAt,
        guestAccessToken // Returned exactly once to the client
      }
    });
  } catch (error) {
    console.error('Create guest order error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create guest order' });
  }
};

/**
 * Get guest order status details
 * GET /api/v1/orders/guest/:orderNumber
 */
export const getGuestOrder = async (req: any, res: any) => {
  const { orderNumber } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Guest access token required' });
  }

  const token = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { customer: true }
    });

    if (!order || order.guestTokenHash !== tokenHash) {
      return res.status(404).json({ success: false, message: 'Order not found or invalid access token' });
    }

    return res.status(200).json({
      success: true,
      message: 'Guest order retrieved successfully',
      data: {
        orderNumber: order.orderNumber,
        status: order.status,
        horoscopeTitle: order.horoscopeTitle,
        horoscopeType: order.horoscopeType,
        amount: order.amount,
        currency: order.currency,
        resultAvailable: order.resultAvailable,
        createdAt: order.createdAt,
        completedAt: order.completedAt,
        cancelledAt: order.cancelledAt,
        inputDetails: order.inputDetails
      }
    });
  } catch (error) {
    console.error('Get guest order error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve guest order details' });
  }
};

/**
 * Download report PDF for a guest order
 * GET /api/v1/orders/guest/:orderNumber/report
 */
export const getGuestOrderReport = async (req: any, res: any) => {
  const { orderNumber } = req.params;
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Guest access token required' });
  }

  const token = authHeader.split(' ')[1];
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber }
    });

    if (!order || order.guestTokenHash !== tokenHash) {
      return res.status(404).json({ success: false, message: 'Order not found or invalid access token' });
    }

    if (!order.resultAvailable || order.status !== 'SUCCESS') {
      return res.status(400).json({ success: false, message: 'Horoscope report is not available yet' });
    }

    if (!order.pdfPath) {
      return res.status(404).json({ success: false, message: 'Horoscope report file not found' });
    }

    const reportPath = path.isAbsolute(order.pdfPath)
      ? order.pdfPath
      : path.resolve(process.cwd(), order.pdfPath);

    if (!fs.existsSync(reportPath)) {
      console.error(`Guest report file does not exist: ${reportPath}`);
      return res.status(404).json({ success: false, message: 'Horoscope report file is missing from disk storage' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${order.orderNumber}-report.pdf"`);
    return res.sendFile(reportPath);
  } catch (error) {
    console.error('Get guest order report error:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve horoscope report' });
  }
};
