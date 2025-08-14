import { Router } from 'express';
import { requireAccessToken } from '../middleware/accessToken';
import {
  enableMarketplace,
  disableMarketplace,
  getPlatformRevenue,
  updateRevenueShare,
  getMarketplaceAnalytics,
  getTopPerformingPlatforms,
  getRevenueProjections,
  getMarketplaceMetrics
} from '../controllers/marketplaceController';

export const marketplaceRoutes = Router();

// Platform endpoints (require access token with marketplace scope)
marketplaceRoutes.post('/enable', requireAccessToken(['marketplace']), enableMarketplace);
marketplaceRoutes.post('/disable', requireAccessToken(['marketplace']), disableMarketplace);
marketplaceRoutes.get('/revenue', requireAccessToken(['analytics']), getPlatformRevenue);
marketplaceRoutes.put('/revenue-share', requireAccessToken(['marketplace']), updateRevenueShare);

// Admin endpoints (require admin key)
marketplaceRoutes.get('/admin/analytics', getMarketplaceAnalytics);
marketplaceRoutes.get('/admin/top-platforms', getTopPerformingPlatforms);
marketplaceRoutes.get('/admin/projections', getRevenueProjections);
marketplaceRoutes.get('/admin/metrics', getMarketplaceMetrics);