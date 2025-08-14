import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface WalletBalance {
  userId: string;
  balanceCoins: number;
  totalSpent: number;
  totalEarned: number;
  balanceUSD: number; // Approximate USD value
}

export interface TransactionHistory {
  transactions: Array<{
    id: string;
    type: string;
    amount: number;
    balanceAfter: number;
    description: string | null;
    createdAt: Date;
    metadata: any;
  }>;
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export class WalletService {
  private readonly COINS_PER_USD = 100; // 100 coins = $1 USD
  private readonly TRANSACTION_FEE_PERCENT = 0.015; // 1.5% transaction fee

  async createWallet(userId: string): Promise<{ message: string }> {
    const existingWallet = await prisma.wallet.findUnique({
      where: { userId }
    });
    
    if (existingWallet) {
      throw createError('Wallet already exists', 409, 'WALLET_EXISTS');
    }
    
    await prisma.wallet.create({
      data: {
        userId,
        balanceCoins: 0,
        totalSpent: 0,
        totalEarned: 0
      }
    });
    
    logger.info('Wallet created', { userId });
    
    return { message: 'Wallet created successfully' };
  }
  
  async getWalletBalance(userId: string): Promise<WalletBalance> {
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });
    
    if (!wallet) {
      // Auto-create wallet if it doesn't exist
      await this.createWallet(userId);
      return {
        userId,
        balanceCoins: 0,
        totalSpent: 0,
        totalEarned: 0,
        balanceUSD: 0
      };
    }
    
    return {
      userId: wallet.userId,
      balanceCoins: wallet.balanceCoins,
      totalSpent: wallet.totalSpent,
      totalEarned: wallet.totalEarned,
      balanceUSD: wallet.balanceCoins / this.COINS_PER_USD
    };
  }
  
  async addCoins(
    userId: string, 
    coins: number, 
    type: 'DEPOSIT' | 'GIFT_RECEIVED' | 'BONUS' | 'REFUND',
    description: string,
    referenceType?: string,
    referenceId?: string,
    metadata?: any
  ): Promise<{ newBalance: number }> {
    if (coins <= 0) {
      throw createError('Amount must be positive', 400, 'INVALID_AMOUNT');
    }
    
    return await prisma.$transaction(async (tx) => {
      // Get or create wallet
      let wallet = await tx.wallet.findUnique({
        where: { userId }
      });
      
      if (!wallet) {
        wallet = await tx.wallet.create({
          data: {
            userId,
            balanceCoins: 0,
            totalSpent: 0,
            totalEarned: 0
          }
        });
      }
      
      const newBalance = wallet.balanceCoins + coins;
      
      // Update wallet balance
      await tx.wallet.update({
        where: { userId },
        data: {
          balanceCoins: newBalance,
          totalEarned: wallet.totalEarned + coins
        }
      });
      
      // Record transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount: coins,
          balanceAfter: newBalance,
          description,
          referenceType,
          referenceId,
          metadata
        }
      });
      
      logger.info('Coins added to wallet', {
        userId,
        coins,
        newBalance,
        type
      });
      
      return { newBalance };
    });
  }
  
  async deductCoins(
    userId: string,
    coins: number,
    type: 'GIFT_SENT' | 'WITHDRAWAL' | 'PENALTY',
    description: string,
    referenceType?: string,
    referenceId?: string,
    metadata?: any
  ): Promise<{ newBalance: number }> {
    if (coins <= 0) {
      throw createError('Amount must be positive', 400, 'INVALID_AMOUNT');
    }
    
    return await prisma.$transaction(async (tx) => {
      const wallet = await tx.wallet.findUnique({
        where: { userId }
      });
      
      if (!wallet) {
        throw createError('Wallet not found', 404, 'WALLET_NOT_FOUND');
      }
      
      if (wallet.isLocked) {
        throw createError('Wallet is locked', 403, 'WALLET_LOCKED');
      }
      
      if (wallet.balanceCoins < coins) {
        throw createError('Insufficient balance', 400, 'INSUFFICIENT_BALANCE', {
          required: coins,
          available: wallet.balanceCoins
        });
      }
      
      const newBalance = wallet.balanceCoins - coins;
      
      // Update wallet balance
      await tx.wallet.update({
        where: { userId },
        data: {
          balanceCoins: newBalance,
          totalSpent: wallet.totalSpent + coins
        }
      });
      
      // Record transaction
      await tx.walletTransaction.create({
        data: {
          walletId: wallet.id,
          type,
          amount: -coins, // Negative for deduction
          balanceAfter: newBalance,
          description,
          referenceType,
          referenceId,
          metadata
        }
      });
      
      logger.info('Coins deducted from wallet', {
        userId,
        coins,
        newBalance,
        type
      });
      
      return { newBalance };
    });
  }
  
  async getTransactionHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<TransactionHistory> {
    const wallet = await prisma.wallet.findUnique({
      where: { userId }
    });
    
    if (!wallet) {
      return {
        transactions: [],
        pagination: {
          limit,
          offset,
          total: 0,
          hasMore: false
        }
      };
    }
    
    const [transactions, totalCount] = await Promise.all([
      prisma.walletTransaction.findMany({
        where: { walletId: wallet.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.walletTransaction.count({
        where: { walletId: wallet.id }
      })
    ]);
    
    return {
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        balanceAfter: tx.balanceAfter,
        description: tx.description,
        createdAt: tx.createdAt,
        metadata: tx.metadata
      })),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    };
  }
  
  async lockWallet(userId: string, reason: string): Promise<{ message: string }> {
    await prisma.wallet.update({
      where: { userId },
      data: { isLocked: true }
    });
    
    logger.warn('Wallet locked', { userId, reason });
    
    return { message: 'Wallet locked successfully' };
  }
  
  async unlockWallet(userId: string): Promise<{ message: string }> {
    await prisma.wallet.update({
      where: { userId },
      data: { isLocked: false }
    });
    
    logger.info('Wallet unlocked', { userId });
    
    return { message: 'Wallet unlocked successfully' };
  }
  
  async transferCoins(
    fromUserId: string,
    toUserId: string,
    coins: number,
    description: string = 'Peer to peer transfer'
  ): Promise<{ message: string }> {
    if (fromUserId === toUserId) {
      throw createError('Cannot transfer to yourself', 400, 'INVALID_TRANSFER');
    }
    
    if (coins <= 0) {
      throw createError('Amount must be positive', 400, 'INVALID_AMOUNT');
    }
    
    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    await prisma.$transaction(async (tx) => {
      // Deduct from sender
      await this.deductCoins(
        fromUserId,
        coins,
        'GIFT_SENT',
        description,
        'peer_transfer',
        transferId
      );
      
      // Add to receiver
      await this.addCoins(
        toUserId,
        coins,
        'GIFT_RECEIVED',
        description,
        'peer_transfer',
        transferId
      );
    });
    
    logger.info('Coins transferred', {
      fromUserId,
      toUserId,
      coins,
      transferId
    });
    
    return { message: 'Transfer completed successfully' };
  }
  
  async getWalletStats(): Promise<{
    totalWallets: number;
    totalCoinsInCirculation: number;
    totalTransactions: number;
    averageBalance: number;
  }> {
    const [
      walletCount,
      balanceSum,
      transactionCount
    ] = await Promise.all([
      prisma.wallet.count(),
      prisma.wallet.aggregate({
        _sum: { balanceCoins: true }
      }),
      prisma.walletTransaction.count()
    ]);
    
    return {
      totalWallets: walletCount,
      totalCoinsInCirculation: balanceSum._sum.balanceCoins || 0,
      totalTransactions: transactionCount,
      averageBalance: walletCount > 0 ? Math.round((balanceSum._sum.balanceCoins || 0) / walletCount) : 0
    };
  }
  
  convertCoinsToUSD(coins: number): number {
    return coins / this.COINS_PER_USD;
  }
  
  convertUSDToCoins(usd: number): number {
    return Math.round(usd * this.COINS_PER_USD);
  }
  
  calculateTransactionFee(amount: number): number {
    return Math.round(amount * this.TRANSACTION_FEE_PERCENT);
  }
}