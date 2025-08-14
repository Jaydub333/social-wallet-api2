import { Response, NextFunction } from 'express';
import { GiftService } from '../services/giftService';
import { AuthenticatedRequest } from '../middleware/auth';
import { AccessTokenRequest } from '../middleware/accessToken';
import { asyncHandler, createError } from '../middleware/errorHandler';

const giftService = new GiftService();

export const getGiftCatalog = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const platformId = req.accessToken?.clientId;
  const { category, rarity } = req.query;
  
  const catalog = await giftService.getGiftCatalog(
    platformId,
    category as string,
    rarity as any
  );
  
  res.json({
    success: true,
    data: {
      gifts: catalog.gifts.map(gift => ({
        id: gift.id,
        name: gift.name,
        description: gift.description,
        price_coins: gift.priceCoins,
        price_usd: gift.priceUSD,
        icon_url: gift.iconUrl,
        animation_url: gift.animationUrl,
        rarity: gift.rarity,
        category: gift.category,
        is_limited: gift.isLimited,
        available: gift.available,
        platform: gift.platform
      })),
      categories: catalog.categories,
      rarities: catalog.rarities
    }
  });
});

export const sendGift = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const { userId, clientId, scopes } = req.accessToken!;
  const { to_user_id, gift_type_id, quantity, message } = req.body;
  
  if (!scopes.includes('gifts')) {
    throw createError('Gifts scope required', 403, 'MISSING_GIFTS_SCOPE');
  }
  
  if (!to_user_id || !gift_type_id) {
    throw createError('to_user_id and gift_type_id are required', 400, 'MISSING_PARAMETERS');
  }
  
  const result = await giftService.sendGift({
    fromUserId: userId,
    toUserId: to_user_id,
    giftTypeId: gift_type_id,
    platformId: clientId,
    quantity: quantity || 1,
    message
  });
  
  res.json({
    success: true,
    data: {
      transaction_id: result.transactionId,
      message: result.message,
      total_cost: result.totalCost,
      fees: result.fees
    }
  });
});

export const getGiftHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const type = req.query.type as 'sent' | 'received' | 'all' || 'all';
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  
  if (limit > 100) {
    throw createError('Limit cannot exceed 100', 400, 'LIMIT_TOO_HIGH');
  }
  
  const history = await giftService.getGiftHistory(userId, type, limit, offset);
  
  res.json({
    success: true,
    data: {
      transactions: history.transactions.map(tx => ({
        id: tx.id,
        transaction_id: tx.transactionId,
        gift: tx.gift,
        sender: tx.sender,
        receiver: tx.receiver,
        quantity: tx.quantity,
        total_coins: tx.totalCoins,
        message: tx.message,
        created_at: tx.createdAt
      })),
      pagination: history.pagination
    }
  });
});

export const getPopularGifts = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const platformId = req.accessToken?.clientId;
  const days = parseInt(req.query.days as string) || 7;
  
  if (days > 365) {
    throw createError('Days parameter cannot exceed 365', 400, 'DAYS_TOO_HIGH');
  }
  
  const popularGifts = await giftService.getPopularGifts(platformId, days);
  
  res.json({
    success: true,
    data: {
      popular_gifts: popularGifts.map(pg => ({
        gift: {
          id: pg.gift.id,
          name: pg.gift.name,
          icon_url: pg.gift.iconUrl,
          price_coins: pg.gift.priceCoins
        },
        send_count: pg.sendCount,
        total_revenue: pg.totalRevenue
      })),
      period_days: days
    }
  });
});

export const createGiftType = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const platformId = req.accessToken?.clientId;
  const {
    name,
    description,
    price_coins,
    icon_url,
    animation_url,
    rarity,
    category,
    is_limited,
    max_quantity
  } = req.body;
  
  if (!name || !price_coins) {
    throw createError('name and price_coins are required', 400, 'MISSING_PARAMETERS');
  }
  
  if (price_coins <= 0 || price_coins > 1000000) {
    throw createError('price_coins must be between 1 and 1,000,000', 400, 'INVALID_PRICE');
  }
  
  const result = await giftService.createGiftType({
    name,
    description,
    platformId,
    priceCoins: price_coins,
    iconUrl: icon_url,
    animationUrl: animation_url,
    rarity,
    category,
    isLimited: is_limited,
    maxQuantity: max_quantity
  });
  
  res.status(201).json({
    success: true,
    data: result
  });
});

export const getGiftAnalytics = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const platformId = req.accessToken!.clientId;
  const days = parseInt(req.query.days as string) || 30;
  
  if (days > 365) {
    throw createError('Days parameter cannot exceed 365', 400, 'DAYS_TOO_HIGH');
  }
  
  const analytics = await giftService.getGiftAnalytics(platformId, days);
  
  res.json({
    success: true,
    data: {
      total_transactions: analytics.totalTransactions,
      total_revenue: analytics.totalRevenue,
      platform_revenue: analytics.platformRevenue,
      top_gifts: analytics.topGifts,
      daily_stats: analytics.dailyStats.map(stat => ({
        date: stat.date,
        transactions: stat.transactions,
        revenue: stat.revenue
      })),
      period_days: days
    }
  });
});