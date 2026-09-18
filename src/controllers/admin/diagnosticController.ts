import { Request, Response } from 'express';
import prisma from '../../config/prisma';

/**
 * Diagnostic endpoint for service retrieval
 * GET /api/v1/admin/diagnostics/services
 */
export const diagnoseServices = async (req: Request, res: Response) => {
  try {
    const services = await prisma.service.findMany({
      where: { active: true },
      orderBy: { displayPosition: 'asc' },
    });

    return res.status(200).json({
      success: true,
      databaseQuery: 'success',
      count: services.length
    });
  } catch (error: any) {
    return res.status(500).json({
      success: false,
      errorName: error?.name || 'UnknownError',
      errorMessage: error?.message || 'No message available',
      prismaCode: error?.code || null
    });
  }
};
