import express, { Application, Request, Response } from 'express';
import dotenv from 'dotenv';
// Load environment variables immediately
dotenv.config();

import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import adminRoutes from './routes/admin';
import orderRoutes from './routes/orderRoutes';
import serviceRoutes from './routes/serviceRoutes';
import authRoutes from './routes/authRoutes';

const app: Application = express();

// Trust proxy for Railway/Load Balancers
app.set('trust proxy', 1);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve uploaded files securely (optional, but needed for admin to view reports)
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Health check endpoint
app.get('/api/v1/health', (req: Request, res: Response) => {
  res.status(200).json({ success: true, message: 'AstroVedham backend is running' });
});

// Public diagnostic endpoint (Internal use only, no sensitive data exposed)
app.get('/api/v1/public/diagnostics', async (req: Request, res: Response) => {
  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    const adminCount = await prisma.admin.count();
    const serviceCount = await prisma.service.count();

    let dbHost = 'unknown';
    if (process.env.DATABASE_URL) {
      try {
        const parts = process.env.DATABASE_URL.split('@');
        if (parts.length > 1) {
          dbHost = parts[1].split('/')[0].split(':')[0];
        }
      } catch (e) {
        dbHost = 'parse-error';
      }
    }

    res.status(200).json({
      success: true,
      data: {
        nodeEnv: process.env.NODE_ENV,
        dbStatus: 'connected',
        dbHost,
        adminCount,
        serviceCount,
        jwtSecretConfigured: !!process.env.JWT_SECRET,
        mockOtpEnabled: process.env.MOCK_OTP_ENABLED === 'true',
        timestamp: new Date().toISOString(),
        deploymentVersion: '20970ff+'
      }
    });
    await prisma.$disconnect();
  } catch (error: any) {
    res.status(500).json({
      success: false,
      errorName: error.name,
      errorMessage: error.message,
      prismaCode: error.code || null
    });
  }
});

// Routes
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/services', serviceRoutes);
app.use('/api/v1/auth', authRoutes);

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: any) => {
  console.error(err.stack);
  res.status(500).json({ success: false, message: 'Something went wrong!' });
});

export default app;
