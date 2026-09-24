import { Request, Response } from 'express';
import prisma from '../../config/prisma';
import path from 'path';

export const getDashboardStats = async (req: Request, res: Response) => {
  try {
    const [total, pending, success, cancelled] = await Promise.all([
      prisma.order.count(),
      prisma.order.count({ where: { status: 'PENDING' } }),
      prisma.order.count({ where: { status: 'SUCCESS' } }),
      prisma.order.count({ where: { status: 'CANCELLED' } }),
    ]);

    res.status(200).json({
      success: true,
      data: { total, pending, success, cancelled }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getOrders = async (req: Request, res: Response) => {
  const { status, horoscopeType, search, fromDate, toDate, page = 1, limit = 10 } = req.query;
  const skip = (Number(page) - 1) * Number(limit);

  try {
    const where: any = {};
    if (status) where.status = status;
    if (horoscopeType) where.horoscopeType = horoscopeType;
    if (search) {
      where.OR = [
        { orderNumber: { contains: String(search), mode: 'insensitive' } },
        { customer: { name: { contains: String(search), mode: 'insensitive' } } }
      ];
    }

    // Date range validation and Prisma filtering
    let startDate: Date | undefined;
    let endDateExclusive: Date | undefined;

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

    if (fromDate) {
      const fromStr = String(fromDate).trim();
      if (!dateRegex.test(fromStr)) {
        return res.status(400).json({ success: false, message: 'Invalid date range' });
      }
      const [y, m, d] = fromStr.split('-').map(Number);
      startDate = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      if (isNaN(startDate.getTime()) || startDate.getUTCFullYear() !== y || startDate.getUTCMonth() !== m - 1 || startDate.getUTCDate() !== d) {
        return res.status(400).json({ success: false, message: 'Invalid date range' });
      }
    }

    if (toDate) {
      const toStr = String(toDate).trim();
      if (!dateRegex.test(toStr)) {
        return res.status(400).json({ success: false, message: 'Invalid date range' });
      }
      const [y, m, d] = toStr.split('-').map(Number);
      const endDateInclusive = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
      if (isNaN(endDateInclusive.getTime()) || endDateInclusive.getUTCFullYear() !== y || endDateInclusive.getUTCMonth() !== m - 1 || endDateInclusive.getUTCDate() !== d) {
        return res.status(400).json({ success: false, message: 'Invalid date range' });
      }
      endDateExclusive = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0, 0));
    }

    if (startDate && endDateExclusive) {
      if (startDate >= endDateExclusive) {
        return res.status(400).json({ success: false, message: 'Invalid date range' });
      }
    }

    if (startDate || endDateExclusive) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = startDate;
      if (endDateExclusive) where.createdAt.lt = endDateExclusive;
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take: Number(limit),
      }),
      prisma.order.count({ where })
    ]);

    res.status(200).json({
      success: true,
      data: {
        orders,
        pagination: {
          total,
          page: Number(page),
          pages: Math.ceil(total / Number(limit))
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const getOrderDetails = async (req: Request, res: Response) => {
  const { orderNumber } = req.params;

  try {
    const order = await prisma.order.findUnique({
      where: { orderNumber },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.status(200).json({ success: true, data: order });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const uploadReport = async (req: Request, res: Response) => {
  const { orderNumber } = req.params;
  const file = req.file;

  if (!file) {
    return res.status(400).json({ success: false, message: 'No file uploaded' });
  }

  try {
    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'PENDING' && order.status !== 'SUCCESS') {
      return res.status(400).json({ success: false, message: 'Can only upload reports for PENDING or SUCCESS orders' });
    }

    // Format pdfPath as a clean relative path relative to process.cwd() with POSIX forward slashes
    let relativePdfPath = path.relative(process.cwd(), file.path).replace(/\\/g, '/');
    if (relativePdfPath.startsWith('/')) {
      relativePdfPath = relativePdfPath.substring(1);
    }

    const updatedOrder = await prisma.order.update({
      where: { orderNumber },
      data: {
        status: 'SUCCESS',
        pdfPath: relativePdfPath,
        resultAvailable: true,
        completedAt: new Date()
      }
    });

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

export const cancelOrder = async (req: Request, res: Response) => {
  const { orderNumber } = req.params;

  try {
    const order = await prisma.order.findUnique({ where: { orderNumber } });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Can only cancel PENDING orders' });
    }

    const updatedOrder = await prisma.order.update({
      where: { orderNumber },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date()
      }
    });

    res.status(200).json({ success: true, data: updatedOrder });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
};
