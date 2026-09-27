import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import morgan from 'morgan';

import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import productRoutes from './routes/productRoutes.js';
import orderRoutes from './routes/orderRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import reviewRoutes from './routes/reviewRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';
import { notFound, errorHandler } from './middleware/error.js';

const app = express();

// Number of proxies in front of the app, so req.ip is the real client (rate limiting) and
// secure cookies work. 1 = Render only (default). 2 = Vercel's /api rewrite + Render.
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY ?? '1', 10);
app.set('trust proxy', Number.isInteger(trustProxyHops) && trustProxyHops >= 0 ? trustProxyHops : 1);

app.use(helmet());
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true, // allow the refresh-token cookie
  })
);
// Razorpay webhooks need the raw request body for signature checks, so they are
// mounted before the JSON parser below
app.use('/api/payments', webhookRoutes);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/reviews', reviewRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
