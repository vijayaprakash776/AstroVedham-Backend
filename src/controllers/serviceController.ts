import { Request, Response } from 'express';
import prisma from '../config/prisma';

/**
 * Get active services catalog
 * GET /api/v1/services
 */
export const getServices = async (req: Request, res: Response) => {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { displayPosition: 'asc' },
    });

    return res.status(200).json({
      success: true,
      message: 'Service catalog retrieved successfully',
      data: services.map(s => ({
        id: s.id,
        slug: s.slug,
        title: s.title,
        description: s.description,
        price: s.price.toString(),
        active: s.active
      }))
    });
  } catch (error) {
    console.error('Get services error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve service catalog'
    });
  }
};
