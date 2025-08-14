import { Response, NextFunction } from 'express';
import { WalletService } from '../services/walletService';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';

const walletService = new WalletService();

export const getWallet = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const wallet = await walletService.getWalletBalance(userId);
  
  res.json({
    success: true,
    data: {
      balance_coins: wallet.balanceCoins,
      balance_usd: wallet.balanceUSD,
      total_spent: wallet.totalSpent,
      total_earned: wallet.totalEarned
    }
  });
});

export const getTransactionHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  
  if (limit > 100) {
    throw createError('Limit cannot exceed 100', 400, 'LIMIT_TOO_HIGH');
  }
  
  const history = await walletService.getTransactionHistory(userId, limit, offset);
  
  res.json({
    success: true,
    data: {
      transactions: history.transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        balance_after: tx.balanceAfter,
        description: tx.description,
        created_at: tx.createdAt,
        metadata: tx.metadata
      })),
      pagination: history.pagination
    }
  });
});

export const transferCoins = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const fromUserId = req.user!.id;
  const { to_user_id, coins, message } = req.body;
  
  if (!to_user_id || !coins) {
    throw createError('to_user_id and coins are required', 400, 'MISSING_PARAMETERS');
  }
  
  if (typeof coins !== 'number' || coins <= 0) {
    throw createError('coins must be a positive number', 400, 'INVALID_COINS');
  }
  
  if (coins > 100000) { // Max transfer limit
    throw createError('Transfer amount too large', 400, 'TRANSFER_LIMIT_EXCEEDED');
  }
  
  const result = await walletService.transferCoins(
    fromUserId,
    to_user_id,
    coins,
    message || 'Peer to peer transfer'
  );
  
  res.json({
    success: true,
    data: result
  });
});

export const addBonusCoins = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const { coins, reason } = req.body;
  
  // In production, this would be an admin-only endpoint
  if (!coins || coins <= 0) {
    throw createError('coins must be a positive number', 400, 'INVALID_COINS');
  }
  
  if (coins > 10000) { // Max bonus limit
    throw createError('Bonus amount too large', 400, 'BONUS_LIMIT_EXCEEDED');
  }
  
  const result = await walletService.addCoins(
    userId,
    coins,
    'BONUS',
    reason || 'Promotional bonus',
    'manual_bonus',
    `bonus_${Date.now()}`
  );
  
  res.json({
    success: true,
    data: {
      new_balance: result.newBalance,
      coins_added: coins,
      message: 'Bonus coins added successfully'
    }
  });
});

export const getWalletStats = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  // This would typically be an admin endpoint
  const stats = await walletService.getWalletStats();
  
  res.json({
    success: true,
    data: {
      total_wallets: stats.totalWallets,
      total_coins_in_circulation: stats.totalCoinsInCirculation,
      total_transactions: stats.totalTransactions,
      average_balance: stats.averageBalance,
      total_value_usd: walletService.convertCoinsToUSD(stats.totalCoinsInCirculation)
    }
  });
});