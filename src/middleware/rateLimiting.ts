import { Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { createError } from './errorHandler';
import { redisClient } from '../index';

const prisma = new PrismaClient();

export interface RateLimitRequest extends Request {
  client?: any;
  accessToken?: {
    clientId: string;
    scopes: string[];
  };
}

export const enforceSubscriptionLimits = async (
  req: RateLimitRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    let clientId = req.client?.id || req.accessToken?.clientId;
    
    if (!clientId) {
      return next();
    }
    
    const client = await prisma.apiClient.findUnique({
      where: { id: clientId },
      include: {
        subscriptions: {
          where: { subscriptionStatus: 'active' },
          take: 1
        }
      }
    });
    
    if (!client) {
      throw createError('Client not found', 404, 'CLIENT_NOT_FOUND');
    }
    
    const subscription = client.subscriptions[0];
    if (!subscription) {
      throw createError('No active subscription', 403, 'NO_ACTIVE_SUBSCRIPTION');
    }
    
    // Check if subscription is within current period
    const now = new Date();
    if (now > subscription.currentPeriodEnd) {
      throw createError('Subscription period expired', 403, 'SUBSCRIPTION_EXPIRED');
    }
    
    // Get subscription limits
    const limits = getSubscriptionLimits(client.subscriptionTier);
    
    // Check monthly request limit (if not unlimited)
    if (limits.monthlyLimit !== -1) {
      const monthlyUsage = await prisma.apiUsage.aggregate({
        where: {
          clientId,
          date: {
            gte: subscription.currentPeriodStart,
            lte: subscription.currentPeriodEnd
          }
        },
        _sum: {
          requestCount: true
        }
      });
      
      const currentUsage = monthlyUsage._sum.requestCount || 0;
      
      if (currentUsage >= limits.monthlyLimit) {
        throw createError(
          'Monthly request limit exceeded', 
          429, 
          'MONTHLY_LIMIT_EXCEEDED',
          {
            limit: limits.monthlyLimit,
            used: currentUsage,
            resetDate: subscription.currentPeriodEnd
          }
        );
      }
    }
    
    // Check rate limiting (requests per minute)
    const rateLimitKey = `rate_limit:${clientId}`;
    const currentMinute = Math.floor(Date.now() / 60000);
    const key = `${rateLimitKey}:${currentMinute}`;
    
    const currentCount = await redisClient.get(key);
    const count = parseInt(currentCount || '0') + 1;
    
    if (count > limits.rateLimitPerMinute) {
      throw createError(
        'Rate limit exceeded', 
        429, 
        'RATE_LIMIT_EXCEEDED',
        {
          limit: limits.rateLimitPerMinute,
          used: count - 1,
          resetTime: (currentMinute + 1) * 60000
        }
      );
    }
    
    // Update rate limiting counter
    await redisClient.setEx(key, 60, count.toString());
    
    // Track usage for billing
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await prisma.apiUsage.upsert({
      where: {
        clientId_endpoint_date: {
          clientId,
          endpoint: req.route?.path || req.path,
          date: today
        }
      },
      update: {
        requestCount: {
          increment: 1
        }
      },
      create: {
        clientId,
        endpoint: req.route?.path || req.path,
        date: today,
        requestCount: 1
      }
    });
    
    // Add usage headers to response
    res.set({
      'X-RateLimit-Limit': limits.rateLimitPerMinute.toString(),
      'X-RateLimit-Remaining': (limits.rateLimitPerMinute - count).toString(),
      'X-RateLimit-Reset': ((currentMinute + 1) * 60000).toString(),
      ...(limits.monthlyLimit !== -1 && {
        'X-Monthly-Limit': limits.monthlyLimit.toString(),
        'X-Monthly-Remaining': (limits.monthlyLimit - (monthlyUsage?._sum.requestCount || 0) - 1).toString()
      })
    });
    
    next();
    
  } catch (error) {
    next(error);
  }
};

function getSubscriptionLimits(tier: string): {
  monthlyLimit: number;
  rateLimitPerMinute: number;
} {
  switch (tier) {
    case 'basic':
      return {
        monthlyLimit: 10000,
        rateLimitPerMinute: 100
      };
    case 'premium':
      return {
        monthlyLimit: 50000,
        rateLimitPerMinute: 500
      };
    case 'enterprise':
      return {
        monthlyLimit: -1, // unlimited
        rateLimitPerMinute: 1000
      };
    default:
      return {
        monthlyLimit: 1000,
        rateLimitPerMinute: 10
      };
  }
}