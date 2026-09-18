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
