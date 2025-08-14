import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { requireAccessToken } from '../middleware/accessToken';
import { enforceSubscriptionLimits } from '../middleware/rateLimiting';
import {
  getGiftCatalog,
  sendGift,
  getGiftHistory,
  getPopularGifts,
  createGiftType,
  getGiftAnalytics
} from '../controllers/giftController';

export const giftRoutes = Router();

// Public gift catalog (requires access token)
giftRoutes.get('/catalog', requireAccessToken(), getGiftCatalog);
giftRoutes.get('/popular', requireAccessToken(), getPopularGifts);

// Gift transactions (requires gifts scope + rate limiting)
giftRoutes.use(enforceSubscriptionLimits);
giftRoutes.post('/send', requireAccessToken(['gifts']), sendGift);

// User gift history (requires user authentication)
giftRoutes.get('/history', requireAuth, getGiftHistory);

// Platform management endpoints (requires access token)
giftRoutes.post('/create', requireAccessToken(['gift_management']), createGiftType);
giftRoutes.get('/analytics', requireAccessToken(['analytics']), getGiftAnalytics);