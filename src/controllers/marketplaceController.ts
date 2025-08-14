import { Request, Response, NextFunction } from 'express';
import { MarketplaceService } from '../services/marketplaceService';
import { AccessTokenRequest } from '../middleware/accessToken';
import { asyncHandler, createError } from '../middleware/errorHandler';

const marketplaceService = new MarketplaceService();

export const enableMarketplace = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const platformId = req.accessToken!.clientId;
  const { revenue_share, custom_branding } = req.body;

  if (!revenue_share || typeof revenue_share !== 'number') {
    throw createError('revenue_share is required and must be a number', 400, 'MISSING_REVENUE_SHARE');
  }

  if (revenue_share < 0 || revenue_share > 100) {
    throw createError('revenue_share must be between 0 and 100 (percentage)', 400, 'INVALID_REVENUE_SHARE');
  }

  const result = await marketplaceService.enableMarketplace({
    platformId,
    revenueShare: revenue_share / 100, // Convert percentage to decimal
    isEnabled: true,
    customBranding: custom_branding
  });

  res.json({
    success: true,
    data: result
  });
});

export const disableMarketplace = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const platformId = req.accessToken!.clientId;

  const result = await marketplaceService.enableMarketplace({
    platformId,
    revenueShare: 0,
    isEnabled: false
  });

  res.json({
    success: true,
    data: result
  });
});

export const getPlatformRevenue = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const platformId = req.accessToken!.clientId;
  const days = parseInt(req.query.days as string) || 30;

  if (days > 365) {
    throw createError('Days parameter cannot exceed 365', 400, 'DAYS_TOO_HIGH');
  }

  const revenue = await marketplaceService.getPlatformRevenue(platformId, days);

  res.json({
    success: true,
    data: {
      total_revenue_coins: revenue.totalRevenue,
      total_revenue_usd: revenue.totalRevenue / 100,
      platform_share_coins: revenue.platformShare,
      platform_share_usd: revenue.platformShare / 100,
      social_wallet_share_coins: revenue.socialWalletShare,
      social_wallet_share_usd: revenue.socialWalletShare / 100,
      transaction_count: revenue.transactionCount,
      average_transaction_value: revenue.averageTransactionValue,
      top_gifts: revenue.topGifts,
      period_days: days
    }
  });
});

export const updateRevenueShare = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const platformId = req.accessToken!.clientId;
  const { revenue_share } = req.body;

  if (!revenue_share || typeof revenue_share !== 'number') {
    throw createError('revenue_share is required and must be a number', 400, 'MISSING_REVENUE_SHARE');
  }

  if (revenue_share < 0 || revenue_share > 100) {
    throw createError('revenue_share must be between 0 and 100 (percentage)', 400, 'INVALID_REVENUE_SHARE');
  }

  const result = await marketplaceService.updateRevenueShare(
    platformId,
    revenue_share / 100 // Convert percentage to decimal
  );

  res.json({
    success: true,
    data: result
  });
});

// Admin endpoints
export const getMarketplaceAnalytics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    throw createError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const days = parseInt(req.query.days as string) || 30;

  if (days > 365) {
    throw createError('Days parameter cannot exceed 365', 400, 'DAYS_TOO_HIGH');
  }

  const analytics = await marketplaceService.getMarketplaceAnalytics(days);

  res.json({
    success: true,
    data: {
      platforms: analytics.platforms.map(p => ({
        platform_id: p.platformId,
        platform_name: p.platformName,
        revenue_coins: p.revenue,
        revenue_usd: p.revenue / 100,
        transaction_count: p.transactionCount,
        revenue_share_percent: p.revenueShare * 100
      })),
      total_revenue_coins: analytics.totalRevenue,
      total_revenue_usd: analytics.totalRevenue / 100,
      total_transactions: analytics.totalTransactions,
      average_revenue_share_percent: analytics.averageRevenueShare * 100,
      period_days: days
    }
  });
});

export const getTopPerformingPlatforms = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    throw createError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const days = parseInt(req.query.days as string) || 30;
  const limit = parseInt(req.query.limit as string) || 10;

  if (days > 365) {
    throw createError('Days parameter cannot exceed 365', 400, 'DAYS_TOO_HIGH');
  }

  if (limit > 50) {
    throw createError('Limit cannot exceed 50', 400, 'LIMIT_TOO_HIGH');
  }

  const platforms = await marketplaceService.getTopPerformingPlatforms(days, limit);

  res.json({
    success: true,
    data: {
      platforms: platforms.map(p => ({
        platform_id: p.platformId,
        platform_name: p.platformName,
        total_revenue_coins: p.totalRevenue,
        total_revenue_usd: p.totalRevenue / 100,
        transaction_count: p.transactionCount,
        average_transaction_value: p.averageTransactionValue,
        revenue_share_percent: p.revenueShare * 100,
        platform_earnings_coins: p.platformEarnings,
        platform_earnings_usd: p.platformEarnings / 100,
        social_wallet_earnings_coins: p.socialWalletEarnings,
        social_wallet_earnings_usd: p.socialWalletEarnings / 100
      })),
      period_days: days
    }
  });
});

export const getRevenueProjections = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    throw createError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const currentRevenue = parseFloat(req.query.current_revenue as string) || 100000; // Default $1000 in coins
  const growthRate = parseFloat(req.query.growth_rate as string) || 0.1; // Default 10% monthly growth
  const months = parseInt(req.query.months as string) || 12;

  if (growthRate < -0.5 || growthRate > 2) {
    throw createError('Growth rate must be between -50% and 200%', 400, 'INVALID_GROWTH_RATE');
  }

  if (months < 1 || months > 36) {
    throw createError('Months must be between 1 and 36', 400, 'INVALID_MONTHS');
  }

  const projections = await marketplaceService.calculateProjectedRevenue(
    currentRevenue,
    growthRate,
    months
  );

  res.json({
    success: true,
    data: {
      projections: projections.map(p => ({
        month: p.month,
        projected_revenue_coins: p.projectedRevenue,
        projected_revenue_usd: p.projectedRevenue / 100,
        social_wallet_share_coins: p.socialWalletShare,
        social_wallet_share_usd: p.socialWalletShare / 100,
        platforms_share_coins: p.platformsShare,
        platforms_share_usd: p.platformsShare / 100
      })),
      parameters: {
        current_revenue_coins: currentRevenue,
        current_revenue_usd: currentRevenue / 100,
        growth_rate_percent: growthRate * 100,
        months
      }
    }
  });
});

export const getMarketplaceMetrics = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    throw createError('Unauthorized', 401, 'UNAUTHORIZED');
  }

  const metrics = await marketplaceService.getMarketplaceMetrics();

  res.json({
    success: true,
    data: {
      total_platforms: metrics.totalPlatforms,
      active_platforms: metrics.activePlatforms,
      average_revenue_share_percent: metrics.averageRevenueShare * 100,
      total_gift_types: metrics.totalGiftTypes,
      total_transactions_today: metrics.totalTransactionsToday,
      total_revenue_today_coins: metrics.totalRevenueToday,
      total_revenue_today_usd: metrics.totalRevenueToday / 100
    }
  });
});