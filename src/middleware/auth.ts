import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { verifyToken } from '../utils/jwt';
import { createError } from './errorHandler';

const prisma = new PrismaClient();

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
  };
}

export const requireAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createError('Access token required', 401, 'MISSING_TOKEN');
    }
    
    const token = authHeader.substring(7);
    const decoded = verifyToken(token, 'access');
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, isActive: true }
    });
    
    if (!user) {
      throw createError('User not found', 401, 'USER_NOT_FOUND');
    }
    
    if (!user.isActive) {
      throw createError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    }
    
    req.user = { id: user.id, email: user.email };
    next();
    
  } catch (error) {
    next(error);
  }
};

export const requireClientAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const clientId = req.headers['x-client-id'] as string;
    const clientSecret = req.headers['x-client-secret'] as string;
    
    if (!clientId || !clientSecret) {
      throw createError('Client credentials required', 401, 'MISSING_CLIENT_CREDENTIALS');
    }
    
    const client = await prisma.apiClient.findFirst({
      where: {
        clientKey: clientId,
        clientSecret: clientSecret,
        isActive: true
      }
    });
    
    if (!client) {
      throw createError('Invalid client credentials', 401, 'INVALID_CLIENT_CREDENTIALS');
    }
    
    (req as any).client = client;
    next();
    
  } catch (error) {
    next(error);
  }
};