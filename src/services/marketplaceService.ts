import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface MarketplaceConfig {
  platformId: string;
  revenueShare: number; // 0.0 to 1.0 (e.g., 0.1 = 10%)
  isEnabled: boolean;
  customBranding?: {
    primaryColor?: string;
    logoUrl?: string;
    brandName?: string;
  };
}

export interface PlatformRevenue {
  totalRevenue: number;
  platformShare: number;
  socialWalletShare: number;
  transactionCount: number;
  averageTransactionValue: number;
  topGifts: Array<{
    giftName: string;
    revenue: number;
    count: number;
  }>;
}

export interface MarketplaceAnalytics {
  platforms: Array<{
    platformId: string;
    platformName: string;
    revenue: number;
    transactionCount: number;
    revenueShare: number;
  }>;
  totalRevenue: number;
  totalTransactions: number;
  averageRevenueShare: number;
}

export class MarketplaceService {
  async enableMarketplace(config: MarketplaceConfig): Promise<{ message: string }> {
    const { platformId, revenueShare, isEnabled, customBranding } = config;

    if (revenueShare < 0 || revenueShare > 1) {
      throw createError('Revenue share must be between 0 and 1', 400, 'INVALID_REVENUE_SHARE');
    }

    // Verify platform exists
    const platform = await prisma.apiClient.findUnique({
      where: { id: platformId }
    });

    if (!platform) {
      throw createError('Platform not found', 404, 'PLATFORM_NOT_FOUND');
    }

    await prisma.giftMarketplace.upsert({
      where: { platformId },
      update: {
        revenueShare,
        isEnabled,
        customBranding
      },
      create: {
        platformId,
        revenueShare,
        isEnabled,
        customBranding
      }
    });

    logger.info('Marketplace configuration updated', {
      platformId,
      platformName: platform.clientName,
      revenueShare: revenueShare * 100,
      isEnabled
    });

    return {
      message: `Marketplace ${isEnabled ? 'enabled' : 'disabled'} for ${platform.clientName} with ${(revenueShare * 100).toFixed(1)}% revenue share`
    };
  }

  async getPlatformRevenue(
    platformId: string,
    days: number = 30
  ): Promise<PlatformRevenue> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get marketplace config
    const marketplace = await prisma.giftMarketplace.findUnique({
      where: { platformId }
    });

    if (!marketplace) {
      throw createError('Marketplace not enabled for this platform', 404, 'MARKETPLACE_NOT_FOUND');
    }

    // Get all gift transactions for this platform
    const transactions = await prisma.giftTransaction.findMany({
      where: {
        platformId,
        createdAt: { gte: startDate },
        status: 'COMPLETED'
      },
      include: {
        giftType: {
          select: { name: true }
        }
      }
    });

    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.totalCoins, 0);
    const platformShare = transactions.reduce((sum, tx) => sum + tx.platformFee, 0);
    const socialWalletShare = transactions.reduce((sum, tx) => sum + tx.socialWalletFee, 0);

    // Calculate top gifts
    const giftStats = transactions.reduce((acc, tx) => {
      const giftName = tx.giftType.name;
      if (!acc[giftName]) {
        acc[giftName] = { giftName, revenue: 0, count: 0 };
      }
      acc[giftName].revenue += tx.totalCoins;
      acc[giftName].count += tx.quantity;
      return acc;
    }, {} as Record<string, { giftName: string; revenue: number; count: number }>);

    const topGifts = Object.values(giftStats)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    return {
      totalRevenue,
      platformShare,
      socialWalletShare,
      transactionCount: transactions.length,
      averageTransactionValue: transactions.length > 0 ? totalRevenue / transactions.length : 0,
      topGifts
    };
  }

  async getMarketplaceAnalytics(days: number = 30): Promise<MarketplaceAnalytics> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get all platforms with marketplaces
    const marketplaces = await prisma.giftMarketplace.findMany({
      where: { isEnabled: true },
      include: {
        platform: {
          select: {
            id: true,
            clientName: true
          }
        }
      }
    });

    const platformAnalytics = await Promise.all(
      marketplaces.map(async (marketplace) => {
        const transactions = await prisma.giftTransaction.aggregate({
          where: {
            platformId: marketplace.platformId,
            createdAt: { gte: startDate },
            status: 'COMPLETED'
          },
          _sum: {
            totalCoins: true
          },
          _count: {
            id: true
          }
        });

        return {
          platformId: marketplace.platformId,
          platformName: marketplace.platform.clientName,
          revenue: transactions._sum.totalCoins || 0,
          transactionCount: transactions._count.id,
          revenueShare: marketplace.revenueShare
        };
      })
    );

    const totalRevenue = platformAnalytics.reduce((sum, p) => sum + p.revenue, 0);
    const totalTransactions = platformAnalytics.reduce((sum, p) => sum + p.transactionCount, 0);
    const averageRevenueShare = marketplaces.length > 0 
      ? marketplaces.reduce((sum, m) => sum + m.revenueShare, 0) / marketplaces.length 
      : 0;

    return {
      platforms: platformAnalytics,
      totalRevenue,
      totalTransactions,
      averageRevenueShare
    };
  }

  async updateRevenueShare(
    platformId: string,
    newRevenueShare: number
  ): Promise<{ message: string; oldShare: number; newShare: number }> {
    if (newRevenueShare < 0 || newRevenueShare > 1) {
      throw createError('Revenue share must be between 0 and 1', 400, 'INVALID_REVENUE_SHARE');
    }

    const marketplace = await prisma.giftMarketplace.findUnique({
      where: { platformId }
    });

    if (!marketplace) {
      throw createError('Marketplace not found', 404, 'MARKETPLACE_NOT_FOUND');
    }

    const oldShare = marketplace.revenueShare;

    await prisma.giftMarketplace.update({
      where: { platformId },
      data: { revenueShare: newRevenueShare }
    });

    logger.info('Revenue share updated', {
      platformId,
      oldShare: oldShare * 100,
      newShare: newRevenueShare * 100
    });

    return {
      message: 'Revenue share updated successfully',
      oldShare: oldShare * 100,
      newShare: newRevenueShare * 100
    };
  }

  async getTopPerformingPlatforms(days: number = 30, limit: number = 10): Promise<Array<{
    platformId: string;
    platformName: string;
    totalRevenue: number;
    transactionCount: number;
    averageTransactionValue: number;
    revenueShare: number;
    platformEarnings: number;
    socialWalletEarnings: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const platformStats = await prisma.giftTransaction.groupBy({
      by: ['platformId'],
      where: {
        createdAt: { gte: startDate },
        status: 'COMPLETED'
      },
      _sum: {
        totalCoins: true,
        platformFee: true,
        socialWalletFee: true
      },
      _count: {
        id: true
      },
      orderBy: {
        _sum: {
          totalCoins: 'desc'
        }
      },
      take: limit
    });

    // Get platform names and marketplace configs
    const platforms = await prisma.apiClient.findMany({
      where: {
        id: { in: platformStats.map(s => s.platformId) }
      },
      include: {
        marketplace: true
      }
    });

    const platformMap = new Map(platforms.map(p => [p.id, p]));

    return platformStats.map(stat => {
      const platform = platformMap.get(stat.platformId);
      const totalRevenue = stat._sum.totalCoins || 0;
      const transactionCount = stat._count.id;

      return {
        platformId: stat.platformId,
        platformName: platform?.clientName || 'Unknown',
        totalRevenue,
        transactionCount,
        averageTransactionValue: transactionCount > 0 ? totalRevenue / transactionCount : 0,
        revenueShare: platform?.marketplace?.revenueShare || 0,
        platformEarnings: stat._sum.platformFee || 0,
        socialWalletEarnings: stat._sum.socialWalletFee || 0
      };
    });
  }

  async calculateProjectedRevenue(
    currentMonthlyRevenue: number,
    growthRate: number = 0.1,
    months: number = 12
  ): Promise<Array<{
    month: number;
    projectedRevenue: number;
    socialWalletShare: number;
    platformsShare: number;
  }>> {
    const averageSocialWalletFeeRate = 0.015; // 1.5%
    const averagePlatformFeeRate = 0.1; // 10%

    const projections = [];
    let currentRevenue = currentMonthlyRevenue;

    for (let month = 1; month <= months; month++) {
      currentRevenue *= (1 + growthRate);

      const socialWalletShare = currentRevenue * averageSocialWalletFeeRate;
      const platformsShare = currentRevenue * averagePlatformFeeRate;

      projections.push({
        month,
        projectedRevenue: Math.round(currentRevenue),
        socialWalletShare: Math.round(socialWalletShare),
        platformsShare: Math.round(platformsShare)
      });
    }

    return projections;
  }

  async getMarketplaceMetrics(): Promise<{
    totalPlatforms: number;
    activePlatforms: number;
    averageRevenueShare: number;
    totalGiftTypes: number;
    totalTransactionsToday: number;
    totalRevenueToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const [
      totalPlatforms,
      activePlatforms,
      avgRevenueShare,
      totalGiftTypes,
      todayStats
    ] = await Promise.all([
      prisma.giftMarketplace.count(),
      prisma.giftMarketplace.count({ where: { isEnabled: true } }),
      prisma.giftMarketplace.aggregate({
        _avg: { revenueShare: true },
        where: { isEnabled: true }
      }),
      prisma.giftType.count({ where: { isActive: true } }),
      prisma.giftTransaction.aggregate({
        where: {
          createdAt: {
            gte: today,
            lt: tomorrow
          },
          status: 'COMPLETED'
        },
        _count: { id: true },
        _sum: { totalCoins: true }
      })
    ]);

    return {
      totalPlatforms,
      activePlatforms,
      averageRevenueShare: avgRevenueShare._avg.revenueShare || 0,
      totalGiftTypes,
      totalTransactionsToday: todayStats._count.id,
      totalRevenueToday: todayStats._sum.totalCoins || 0
    };
  }
}