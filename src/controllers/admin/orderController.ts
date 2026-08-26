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
  const { status, horoscopeType, search, page = 1, limit = 10 } = req.query;
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

    if (order.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Can only upload reports for PENDING orders' });
    }

    const updatedOrder = await prisma.order.update({
      where: { orderNumber },
      data: {
        status: 'SUCCESS',
        pdfPath: file.path,
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
