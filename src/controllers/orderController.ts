import { Request, Response } from 'express';
import prisma from '../config/prisma';
import fs from 'fs';
import path from 'path';
import {
  generateOrderNumber,
  isValidHoroscopeType,
} from '../utils/order';

/**
 * Get horoscope report PDF
 *
 * GET /api/v1/orders/:orderNumber/report
 */
export const getOrderReport = async (
  req: Request,
  res: Response
) => {
  const { orderNumber } = req.params;

  if (!orderNumber) {
    return res.status(400).json({
      success: false,
      message: 'Order number is required',
    });
  }

  try {
    const order = await prisma.order.findUnique({
      where: {
        orderNumber,
      },
      select: {
        orderNumber: true,
        status: true,
        pdfPath: true,
        resultAvailable: true,
        horoscopeTitle: true,
      },
    });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    // Report is not ready yet
    if (!order.resultAvailable || order.status !== 'SUCCESS') {
      return res.status(404).json({
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

    // Convert stored path into an absolute path
    const reportPath = path.isAbsolute(order.pdfPath)
      ? order.pdfPath
      : path.resolve(process.cwd(), order.pdfPath);

    // Verify the physical file exists
    if (!fs.existsSync(reportPath)) {
      console.error(`Report file does not exist: ${reportPath}`);

      return res.status(404).json({
        success: false,
        message: 'Horoscope report file is missing',
      });
    }

    // Tell client this is a PDF
    res.setHeader('Content-Type', 'application/pdf');

    res.setHeader(
      'Content-Disposition',
      `inline; filename="${order.orderNumber}-report.pdf"`
    );

    // Send PDF to client
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
 * Create a new customer order
 * POST /api/v1/orders
 */
export const createOrder = async (req: Request, res: Response) => {
  const {
    customer,
    horoscopeType,
    horoscopeTitle,
    inputDetails,
    amount,
    currency = 'INR',
  } = req.body;

  // Basic validation
  if (!customer?.name || !customer?.phone) {
    return res.status(400).json({
      success: false,
      message: 'Customer name and phone are required',
    });
  }

  if (!isValidHoroscopeType(horoscopeType)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid horoscope type',
    });
  }

  if (!horoscopeTitle) {
    return res.status(400).json({
      success: false,
      message: 'Horoscope title is required',
    });
  }

  if (!inputDetails) {
    return res.status(400).json({
      success: false,
      message: 'Horoscope input details are required',
    });
  }

  if (amount === undefined || amount === null || Number(amount) < 0) {
    return res.status(400).json({
      success: false,
      message: 'Valid amount is required',
    });
  }

  try {
    // Find existing customer using unique phone number
    let dbCustomer = await prisma.customer.findUnique({
      where: {
        phone: customer.phone,
      },
    });

    // Create customer if not found
    if (!dbCustomer) {
      dbCustomer = await prisma.customer.create({
        data: {
          name: customer.name,
          phone: customer.phone,
          email: customer.email || null,
        },
      });
    } else {
      // Update customer information if it has changed
      dbCustomer = await prisma.customer.update({
        where: {
          id: dbCustomer.id,
        },
        data: {
          name: customer.name,
          email: customer.email || null,
        },
      });
    }

    // Generate unique AstroVedham order number
    const orderNumber = await generateOrderNumber();

    // Create order
    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerId: dbCustomer.id,
        horoscopeType,
        horoscopeTitle,
        inputDetails,
        amount: Number(amount),
        currency,
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
 * Get customer's orders
 *
 * GET /api/v1/orders?phone=9876543210&page=1&limit=10
 */
export const getCustomerOrders = async (
  req: Request,
  res: Response
) => {
  const phone = String(req.query.phone || '').trim();

  const page = Math.max(
    Number.parseInt(String(req.query.page || '1'), 10) || 1,
    1
  );

  const limit = Math.min(
    Math.max(
      Number.parseInt(String(req.query.limit || '10'), 10) || 10,
      1
    ),
    50
  );

  if (!phone) {
    return res.status(400).json({
      success: false,
      message: 'Phone number is required',
    });
  }

  try {
    // Find customer
    const customer = await prisma.customer.findUnique({
      where: {
        phone,
      },
    });

    if (!customer) {
      return res.status(200).json({
        success: true,
        message: 'No customer found',
        data: {
          customer: null,
          orders: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
            hasNextPage: false,
            hasPreviousPage: false,
          },
        },
      });
    }

    const skip = (page - 1) * limit;

    // Fetch orders + total count simultaneously
    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where: {
          customerId: customer.id,
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: limit,
      }),

      prisma.order.count({
        where: {
          customerId: customer.id,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return res.status(200).json({
      success: true,
      message: 'Customer orders retrieved successfully',
      data: {
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        },

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
 *
 * GET /api/v1/orders/:orderNumber
 */
export const getOrder = async (
  req: Request,
  res: Response
) => {
  const { orderNumber } = req.params;

  if (!orderNumber) {
    return res.status(400).json({
      success: false,
      message: 'Order number is required',
    });
  }

  try {
    const order = await prisma.order.findUnique({
      where: {
        orderNumber,
      },
      include: {
        customer: true,
      },
    });

    if (!order) {
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