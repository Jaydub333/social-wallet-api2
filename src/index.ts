import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { RedisStore } from 'rate-limit-redis';
import dotenv from 'dotenv';

import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import { authRoutes } from './routes/auth';
import { userRoutes } from './routes/users';
import { oauthRoutes } from './routes/oauth';
import { integrationRoutes } from './routes/integration';
import { privacyRoutes } from './routes/privacy';
import { verificationRoutes } from './routes/verification';
import { subscriptionRoutes } from './routes/subscription';
import { walletRoutes } from './routes/wallet';
import { giftRoutes } from './routes/gifts';
import { paymentRoutes } from './routes/payments';
import { marketplaceRoutes } from './routes/marketplace';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));

async function startServer() {
  try {
    await redisClient.connect();
    logger.info('Connected to Redis');

    const limiter = rateLimit({
      store: new RedisStore({
        sendCommand: (...args: string[]) => redisClient.sendCommand(args),
      }),
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: {
        error: {
          code: 'TOO_MANY_REQUESTS',
          message: 'Too many requests from this IP, please try again later.'
        }
      },
      standardHeaders: true,
      legacyHeaders: false,
    });

    app.use(helmet());
    app.use(cors({
      origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
      credentials: true,
    }));
    app.use(limiter);
    
    // Raw body for Stripe webhooks
    app.use('/v1/payments/webhook', express.raw({ type: 'application/json' }));
    
    // JSON parsing for other routes
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    app.get('/health', (req, res) => {
      res.json({ status: 'OK', timestamp: new Date().toISOString() });
    });

    app.use('/v1/auth', authRoutes);
    app.use('/v1/users', userRoutes);
    app.use('/v1/oauth', oauthRoutes);
    app.use('/v1/integration', integrationRoutes);
    app.use('/v1/privacy', privacyRoutes);
    app.use('/v1/verify', verificationRoutes);
    app.use('/v1/subscription', subscriptionRoutes);
    app.use('/v1/wallet', walletRoutes);
    app.use('/v1/gifts', giftRoutes);
    app.use('/v1/payments', paymentRoutes);
    app.use('/v1/marketplace', marketplaceRoutes);

    app.use(errorHandler);

    app.listen(PORT, () => {
      logger.info(`Social Wallet API server running on port ${PORT}`);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export { redisClient };