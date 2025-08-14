import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getWallet,
  getTransactionHistory,
  transferCoins,
  addBonusCoins,
  getWalletStats
} from '../controllers/walletController';

export const walletRoutes = Router();

walletRoutes.use(requireAuth);

walletRoutes.get('/balance', getWallet);
walletRoutes.get('/transactions', getTransactionHistory);
walletRoutes.post('/transfer', transferCoins);
walletRoutes.post('/bonus', addBonusCoins); // In production, this would be admin-only
walletRoutes.get('/stats', getWalletStats); // In production, this would be admin-only