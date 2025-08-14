import { PrismaClient, GiftRarity } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { WalletService } from './walletService';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface GiftCatalog {
  gifts: Array<{
    id: string;
    name: string;
    description: string | null;
    priceCoins: number;
    priceUSD: number;
    iconUrl: string | null;
    animationUrl: string | null;
    rarity: GiftRarity;
    category: string;
    isLimited: boolean;
    available: number | null; // null = unlimited
    platform: string | null; // null = universal
  }>;
  categories: string[];
  rarities: GiftRarity[];
}

export interface SendGiftRequest {
  fromUserId: string;
  toUserId: string;
  giftTypeId: string;
  platformId: string;
  quantity?: number;
  message?: string;
}

export interface GiftTransaction {
  id: string;
  transactionId: string;
  gift: {
    name: string;
    iconUrl: string | null;
    rarity: GiftRarity;
  };
  sender: {
    userId: string;
    displayName: string | null;
  };
  receiver: {
    userId: string;
    displayName: string | null;
  };
  quantity: number;
  totalCoins: number;
  message: string | null;
  createdAt: Date;
}

export class GiftService {
  private walletService = new WalletService();

  async createGiftType(data: {
    name: string;
    description?: string;
    platformId?: string; // null for universal gifts
    priceCoins: number;
    iconUrl?: string;
    animationUrl?: string;
    rarity?: GiftRarity;
    category?: string;
    isLimited?: boolean;
    maxQuantity?: number;
  }): Promise<{ id: string; message: string }> {
    const gift = await prisma.giftType.create({
      data: {
        name: data.name,
        description: data.description,
        platformId: data.platformId,
        priceCoins: data.priceCoins,
        iconUrl: data.iconUrl,
        animationUrl: data.animationUrl,
        rarity: data.rarity || 'COMMON',
        category: data.category || 'general',
        isLimited: data.isLimited || false,
        maxQuantity: data.maxQuantity
      }
    });

    logger.info('Gift type created', {
      giftId: gift.id,
      name: gift.name,
      price: gift.priceCoins,
      platformId: data.platformId
    });

    return {
      id: gift.id,
      message: 'Gift type created successfully'
    };
  }

  async getGiftCatalog(
    platformId?: string,
    category?: string,
    rarity?: GiftRarity
  ): Promise<GiftCatalog> {
    const where: any = {
      isActive: true
    };

    if (platformId) {
      where.OR = [
        { platformId: platformId },
        { platformId: null } // Include universal gifts
      ];
    } else {
      where.platformId = null; // Only universal gifts if no platform specified
    }

    if (category) {
      where.category = category;
    }

    if (rarity) {
      where.rarity = rarity;
    }

    const gifts = await prisma.giftType.findMany({
      where,
      include: {
        platform: {
          select: {
            clientName: true
          }
        }
      },
      orderBy: [
        { rarity: 'asc' },
        { priceCoins: 'asc' }
      ]
    });

    // Get unique categories and rarities for filtering
    const [categories, rarities] = await Promise.all([
      prisma.giftType.findMany({
        where: { isActive: true },
        select: { category: true },
        distinct: ['category']
      }).then(results => results.map(r => r.category)),
      
      prisma.giftType.findMany({
        where: { isActive: true },
        select: { rarity: true },
        distinct: ['rarity']
      }).then(results => results.map(r => r.rarity))
    ]);

    return {
      gifts: gifts.map(gift => ({
        id: gift.id,
        name: gift.name,
        description: gift.description,
        priceCoins: gift.priceCoins,
        priceUSD: this.walletService.convertCoinsToUSD(gift.priceCoins),
        iconUrl: gift.iconUrl,
        animationUrl: gift.animationUrl,
        rarity: gift.rarity,
        category: gift.category,
        isLimited: gift.isLimited,
        available: gift.isLimited ? 
          (gift.maxQuantity ? gift.maxQuantity - gift.soldQuantity : null) : 
          null,
        platform: gift.platform?.clientName || null
      })),
      categories,
      rarities
    };
  }

  async sendGift(request: SendGiftRequest): Promise<{
    transactionId: string;
    message: string;
    totalCost: number;
    fees: {
      platformFee: number;
      socialWalletFee: number;
    };
  }> {
    const { fromUserId, toUserId, giftTypeId, platformId, quantity = 1, message } = request;

    if (fromUserId === toUserId) {
      throw createError('Cannot send gift to yourself', 400, 'INVALID_RECIPIENT');
    }

    if (quantity <= 0 || quantity > 100) {
      throw createError('Invalid quantity', 400, 'INVALID_QUANTITY');
    }

    const giftType = await prisma.giftType.findUnique({
      where: { id: giftTypeId },
      include: { platform: true }
    });

    if (!giftType || !giftType.isActive) {
      throw createError('Gift type not found or inactive', 404, 'GIFT_NOT_FOUND');
    }

    // Check if gift is available for this platform
    if (giftType.platformId && giftType.platformId !== platformId) {
      throw createError('Gift not available on this platform', 403, 'GIFT_NOT_AVAILABLE');
    }

    // Check limited quantity availability
    if (giftType.isLimited && giftType.maxQuantity) {
      const available = giftType.maxQuantity - giftType.soldQuantity;
      if (available < quantity) {
        throw createError(
          'Not enough gifts available', 
          400, 
          'INSUFFICIENT_QUANTITY',
          { available, requested: quantity }
        );
      }
    }

    const totalGiftCost = giftType.priceCoins * quantity;
    
    // Calculate fees
    const marketplace = await prisma.giftMarketplace.findUnique({
      where: { platformId }
    });

    const platformFeeRate = marketplace?.revenueShare || 0.1; // Default 10%
    const socialWalletFeeRate = 0.015; // 1.5%

    const platformFee = Math.round(totalGiftCost * platformFeeRate);
    const socialWalletFee = Math.round(totalGiftCost * socialWalletFeeRate);
    const totalCost = totalGiftCost + socialWalletFee;

    const transactionId = `gift_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;

    await prisma.$transaction(async (tx) => {
      // Deduct coins from sender's wallet
      await this.walletService.deductCoins(
        fromUserId,
        totalCost,
        'GIFT_SENT',
        `Sent ${quantity}x ${giftType.name} to user`,
        'gift_transaction',
        transactionId
      );

      // Add coins to receiver's wallet (gift value minus fees)
      const receiverAmount = totalGiftCost - platformFee - socialWalletFee;
      await this.walletService.addCoins(
        toUserId,
        receiverAmount,
        'GIFT_RECEIVED',
        `Received ${quantity}x ${giftType.name}`,
        'gift_transaction',
        transactionId
      );

      // Create gift transaction record
      await tx.giftTransaction.create({
        data: {
          fromUserId,
          toUserId,
          giftTypeId,
          platformId,
          quantity,
          totalCoins: totalGiftCost,
          message,
          transactionId,
          platformFee,
          socialWalletFee,
          status: 'COMPLETED'
        }
      });

      // Update sold quantity for limited gifts
      if (giftType.isLimited) {
        await tx.giftType.update({
          where: { id: giftTypeId },
          data: {
            soldQuantity: {
              increment: quantity
            }
          }
        });
      }
    });

    logger.info('Gift sent successfully', {
      transactionId,
      fromUserId,
      toUserId,
      giftType: giftType.name,
      quantity,
      totalCost,
      platformFee,
      socialWalletFee
    });

    return {
      transactionId,
      message: 'Gift sent successfully',
      totalCost,
      fees: {
        platformFee,
        socialWalletFee
      }
    };
  }

  async getGiftHistory(
    userId: string,
    type: 'sent' | 'received' | 'all' = 'all',
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    transactions: GiftTransaction[];
    pagination: {
      limit: number;
      offset: number;
      total: number;
      hasMore: boolean;
    };
  }> {
    const where: any = {};
    
    if (type === 'sent') {
      where.fromUserId = userId;
    } else if (type === 'received') {
      where.toUserId = userId;
    } else {
      where.OR = [
        { fromUserId: userId },
        { toUserId: userId }
      ];
    }

    const [transactions, totalCount] = await Promise.all([
      prisma.giftTransaction.findMany({
        where,
        include: {
          giftType: true,
          sender: {
            include: {
              profile: {
                select: {
                  displayName: true
                }
              }
            }
          },
          receiver: {
            include: {
              profile: {
                select: {
                  displayName: true
                }
              }
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.giftTransaction.count({ where })
    ]);

    return {
      transactions: transactions.map(tx => ({
        id: tx.id,
        transactionId: tx.transactionId,
        gift: {
          name: tx.giftType.name,
          iconUrl: tx.giftType.iconUrl,
          rarity: tx.giftType.rarity
        },
        sender: {
          userId: tx.sender.userId,
          displayName: tx.sender.profile?.displayName || null
        },
        receiver: {
          userId: tx.receiver.userId,
          displayName: tx.receiver.profile?.displayName || null
        },
        quantity: tx.quantity,
        totalCoins: tx.totalCoins,
        message: tx.message,
        createdAt: tx.createdAt
      })),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    };
  }

  async getPopularGifts(
    platformId?: string,
    days: number = 7
  ): Promise<Array<{
    gift: {
      id: string;
      name: string;
      iconUrl: string | null;
      priceCoins: number;
    };
    sendCount: number;
    totalRevenue: number;
  }>> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const where: any = {
      createdAt: {
        gte: startDate
      }
    };

    if (platformId) {
      where.platformId = platformId;
    }

    const popularGifts = await prisma.giftTransaction.groupBy({
      by: ['giftTypeId'],
      where,
      _count: {
        id: true
      },
      _sum: {
        totalCoins: true
      },
      orderBy: {
        _count: {
          id: 'desc'
        }
      },
      take: 10
    });

    // Get gift details
    const giftDetails = await prisma.giftType.findMany({
      where: {
        id: {
          in: popularGifts.map(g => g.giftTypeId)
        }
      }
    });

    const giftMap = new Map(giftDetails.map(g => [g.id, g]));

    return popularGifts.map(pg => {
      const gift = giftMap.get(pg.giftTypeId);
      return {
        gift: {
          id: gift!.id,
          name: gift!.name,
          iconUrl: gift!.iconUrl,
          priceCoins: gift!.priceCoins
        },
        sendCount: pg._count.id,
        totalRevenue: pg._sum.totalCoins || 0
      };
    });
  }

  async getGiftAnalytics(platformId: string, days: number = 30): Promise<{
    totalTransactions: number;
    totalRevenue: number;
    platformRevenue: number;
    topGifts: Array<{
      name: string;
      count: number;
      revenue: number;
    }>;
    dailyStats: Array<{
      date: Date;
      transactions: number;
      revenue: number;
    }>;
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const [transactions, dailyStats] = await Promise.all([
      prisma.giftTransaction.findMany({
        where: {
          platformId,
          createdAt: { gte: startDate }
        },
        include: {
          giftType: {
            select: {
              name: true
            }
          }
        }
      }),
      prisma.giftTransaction.groupBy({
        by: ['createdAt'],
        where: {
          platformId,
          createdAt: { gte: startDate }
        },
        _count: { id: true },
        _sum: { totalCoins: true, platformFee: true }
      })
    ]);

    const totalTransactions = transactions.length;
    const totalRevenue = transactions.reduce((sum, tx) => sum + tx.totalCoins, 0);
    const platformRevenue = transactions.reduce((sum, tx) => sum + tx.platformFee, 0);

    // Group by gift type
    const giftStats = transactions.reduce((acc, tx) => {
      const giftName = tx.giftType.name;
      if (!acc[giftName]) {
        acc[giftName] = { name: giftName, count: 0, revenue: 0 };
      }
      acc[giftName].count += tx.quantity;
      acc[giftName].revenue += tx.totalCoins;
      return acc;
    }, {} as Record<string, { name: string; count: number; revenue: number }>);

    const topGifts = Object.values(giftStats)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalTransactions,
      totalRevenue,
      platformRevenue,
      topGifts,
      dailyStats: dailyStats.map(stat => ({
        date: stat.createdAt,
        transactions: stat._count.id,
        revenue: stat._sum.totalCoins || 0
      }))
    };
  }
}