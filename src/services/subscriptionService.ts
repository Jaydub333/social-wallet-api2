import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface SubscriptionTier {
  name: string;
  monthlyFee: number;
  requestLimit: number;
  features: string[];
}

export const SUBSCRIPTION_TIERS: Record<string, SubscriptionTier> = {
  basic: {
    name: 'Basic',
    monthlyFee: 299,
    requestLimit: 10000,
    features: ['profile_access', 'basic_verification']
  },
  premium: {
    name: 'Premium',
    monthlyFee: 999,
    requestLimit: 50000,
    features: ['profile_access', 'media_access', 'advanced_verification', 'trust_scoring']
  },
  enterprise: {
    name: 'Enterprise',
    monthlyFee: 2999,
    requestLimit: -1, // unlimited
    features: ['profile_access', 'media_access', 'advanced_verification', 'trust_scoring', 'custom_integrations', 'priority_support', 'webhooks']
  }
};

export interface ClientRegistrationData {
  clientName: string;
  callbackUrls: string[];
  subscriptionTier: keyof typeof SUBSCRIPTION_TIERS;
  contactEmail: string;
  companyName?: string;
  description?: string;
}

export interface BillingInfo {
  clientId: string;
  subscriptionTier: string;
  currentPeriod: {
    start: Date;
    end: Date;
  };
  nextBillingDate: Date;
  monthlyFee: number;
  usage: {
    totalRequests: number;
    requestLimit: number;
    utilizationPercent: number;
  };
  invoices: Array<{
    id: string;
    amount: number;
    status: string;
    createdAt: Date;
    paidAt: Date | null;
  }>;
}

export class SubscriptionService {
  async registerClient(data: ClientRegistrationData): Promise<{
    clientId: string;
    clientSecret: string;
    subscriptionDetails: any;
  }> {
    const { clientName, callbackUrls, subscriptionTier, contactEmail, companyName, description } = data;
    
    if (!SUBSCRIPTION_TIERS[subscriptionTier]) {
      throw createError('Invalid subscription tier', 400, 'INVALID_SUBSCRIPTION_TIER');
    }
    
    // Validate callback URLs
    for (const url of callbackUrls) {
      try {
        new URL(url);
      } catch {
        throw createError(`Invalid callback URL: ${url}`, 400, 'INVALID_CALLBACK_URL');
      }
    }
    
    const tier = SUBSCRIPTION_TIERS[subscriptionTier];
    const clientId = `sw_${crypto.randomBytes(16).toString('hex')}`;
    const clientSecret = crypto.randomBytes(32).toString('hex');
    
    const currentPeriodStart = new Date();
    const currentPeriodEnd = new Date();
    currentPeriodEnd.setMonth(currentPeriodEnd.getMonth() + 1);
    
    const client = await prisma.$transaction(async (tx) => {
      const newClient = await tx.apiClient.create({
        data: {
          clientName,
          clientKey: clientId,
          clientSecret,
          callbackUrls,
          subscriptionTier,
          monthlyFee: tier.monthlyFee,
          isActive: true
        }
      });
      
      await tx.subscription.create({
        data: {
          clientId: newClient.id,
          subscriptionStatus: 'active',
          currentPeriodStart,
          currentPeriodEnd,
          monthlyFee: tier.monthlyFee,
          nextBillingDate: currentPeriodEnd
        }
      });
      
      return newClient;
    });
    
    logger.info('New client registered', {
      clientId: client.id,
      clientName,
      subscriptionTier,
      monthlyFee: tier.monthlyFee
    });
    
    return {
      clientId: clientId,
      clientSecret: clientSecret,
      subscriptionDetails: {
        tier: tier.name,
        monthlyFee: tier.monthlyFee,
        requestLimit: tier.requestLimit,
        features: tier.features,
        currentPeriod: {
          start: currentPeriodStart,
          end: currentPeriodEnd
        }
      }
    };
  }
  
  async updateSubscription(
    clientId: string, 
    newTier: keyof typeof SUBSCRIPTION_TIERS
  ): Promise<{ message: string; newDetails: any }> {
    if (!SUBSCRIPTION_TIERS[newTier]) {
      throw createError('Invalid subscription tier', 400, 'INVALID_SUBSCRIPTION_TIER');
    }
    
    const client = await prisma.apiClient.findUnique({
      where: { id: clientId },
      include: { subscriptions: { where: { subscriptionStatus: 'active' } } }
    });
    
    if (!client) {
      throw createError('Client not found', 404, 'CLIENT_NOT_FOUND');
    }
    
    const currentSubscription = client.subscriptions[0];
    if (!currentSubscription) {
      throw createError('No active subscription found', 404, 'NO_ACTIVE_SUBSCRIPTION');
    }
    
    const tier = SUBSCRIPTION_TIERS[newTier];
    const currentDate = new Date();
    
    // Calculate prorated billing
    const daysRemaining = Math.ceil(
      (currentSubscription.currentPeriodEnd.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const totalDaysInPeriod = Math.ceil(
      (currentSubscription.currentPeriodEnd.getTime() - currentSubscription.currentPeriodStart.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    const proratedAmount = (tier.monthlyFee * daysRemaining) / totalDaysInPeriod;
    
    await prisma.$transaction([
      prisma.apiClient.update({
        where: { id: clientId },
        data: {
          subscriptionTier: newTier,
          monthlyFee: tier.monthlyFee
        }
      }),
      prisma.subscription.update({
        where: { id: currentSubscription.id },
        data: {
          monthlyFee: tier.monthlyFee
        }
      })
    ]);
    
    logger.info('Subscription updated', {
      clientId,
      oldTier: client.subscriptionTier,
      newTier,
      proratedAmount
    });
    
    return {
      message: 'Subscription updated successfully',
      newDetails: {
        tier: tier.name,
        monthlyFee: tier.monthlyFee,
        requestLimit: tier.requestLimit,
        features: tier.features,
        proratedCharge: proratedAmount
      }
    };
  }
  
  async suspendSubscription(clientId: string, reason?: string): Promise<{ message: string }> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        clientId,
        subscriptionStatus: 'active'
      }
    });
    
    if (!subscription) {
      throw createError('No active subscription found', 404, 'NO_ACTIVE_SUBSCRIPTION');
    }
    
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: { subscriptionStatus: 'suspended' }
      }),
      prisma.apiClient.update({
        where: { id: clientId },
        data: { isActive: false }
      }),
      // Revoke all active tokens
      prisma.accessToken.deleteMany({
        where: { clientId }
      })
    ]);
    
    logger.warn('Subscription suspended', { clientId, reason });
    
    return { message: 'Subscription suspended successfully' };
  }
  
  async reactivateSubscription(clientId: string): Promise<{ message: string }> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        clientId,
        subscriptionStatus: 'suspended'
      }
    });
    
    if (!subscription) {
      throw createError('No suspended subscription found', 404, 'NO_SUSPENDED_SUBSCRIPTION');
    }
    
    const newPeriodEnd = new Date();
    newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
    
    await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscription.id },
        data: {
          subscriptionStatus: 'active',
          currentPeriodStart: new Date(),
          currentPeriodEnd: newPeriodEnd,
          nextBillingDate: newPeriodEnd
        }
      }),
      prisma.apiClient.update({
        where: { id: clientId },
        data: { isActive: true }
      })
    ]);
    
    logger.info('Subscription reactivated', { clientId });
    
    return { message: 'Subscription reactivated successfully' };
  }
  
  async getBillingInfo(clientId: string): Promise<BillingInfo> {
    const client = await prisma.apiClient.findUnique({
      where: { id: clientId },
      include: {
        subscriptions: {
          where: { subscriptionStatus: { in: ['active', 'suspended'] } },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!client) {
      throw createError('Client not found', 404, 'CLIENT_NOT_FOUND');
    }
    
    const subscription = client.subscriptions[0];
    if (!subscription) {
      throw createError('No subscription found', 404, 'NO_SUBSCRIPTION');
    }
    
    // Get current period usage
    const currentPeriodUsage = await prisma.apiUsage.aggregate({
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
    
    const tier = SUBSCRIPTION_TIERS[client.subscriptionTier];
    const totalRequests = currentPeriodUsage._sum.requestCount || 0;
    
    // Mock invoice data (in a real implementation, this would come from a billing system)
    const mockInvoices = [
      {
        id: `inv_${crypto.randomBytes(8).toString('hex')}`,
        amount: subscription.monthlyFee.toNumber(),
        status: 'paid',
        createdAt: subscription.currentPeriodStart,
        paidAt: subscription.currentPeriodStart
      }
    ];
    
    return {
      clientId: client.id,
      subscriptionTier: client.subscriptionTier,
      currentPeriod: {
        start: subscription.currentPeriodStart,
        end: subscription.currentPeriodEnd
      },
      nextBillingDate: subscription.nextBillingDate!,
      monthlyFee: subscription.monthlyFee.toNumber(),
      usage: {
        totalRequests,
        requestLimit: tier.requestLimit,
        utilizationPercent: tier.requestLimit === -1 ? 0 : Math.round((totalRequests / tier.requestLimit) * 100)
      },
      invoices: mockInvoices
    };
  }
  
  async generateApiKey(clientId: string): Promise<{ apiKey: string; message: string }> {
    const client = await prisma.apiClient.findUnique({
      where: { id: clientId }
    });
    
    if (!client) {
      throw createError('Client not found', 404, 'CLIENT_NOT_FOUND');
    }
    
    const newApiKey = crypto.randomBytes(32).toString('hex');
    
    await prisma.apiClient.update({
      where: { id: clientId },
      data: { clientSecret: newApiKey }
    });
    
    logger.info('API key regenerated', { clientId });
    
    return {
      apiKey: newApiKey,
      message: 'New API key generated successfully. Please update your integration immediately.'
    };
  }
  
  async getSubscriptionLimits(clientId: string): Promise<{
    tier: string;
    limits: {
      requestsPerMonth: number;
      features: string[];
      rateLimitPerMinute: number;
    };
    usage: {
      currentMonthRequests: number;
      remainingRequests: number;
    };
  }> {
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
    
    const tier = SUBSCRIPTION_TIERS[client.subscriptionTier];
    const subscription = client.subscriptions[0];
    
    if (!subscription) {
      throw createError('No active subscription', 404, 'NO_ACTIVE_SUBSCRIPTION');
    }
    
    const currentUsage = await prisma.apiUsage.aggregate({
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
    
    const currentRequests = currentUsage._sum.requestCount || 0;
    
    return {
      tier: tier.name,
      limits: {
        requestsPerMonth: tier.requestLimit,
        features: tier.features,
        rateLimitPerMinute: client.subscriptionTier === 'enterprise' ? 1000 : 
                           client.subscriptionTier === 'premium' ? 500 : 100
      },
      usage: {
        currentMonthRequests: currentRequests,
        remainingRequests: tier.requestLimit === -1 ? -1 : tier.requestLimit - currentRequests
      }
    };
  }
  
  async processMonthlyBilling(): Promise<{ processed: number; failed: number }> {
    const activeSubscriptions = await prisma.subscription.findMany({
      where: {
        subscriptionStatus: 'active',
        nextBillingDate: {
          lte: new Date()
        }
      },
      include: {
        client: true
      }
    });
    
    let processed = 0;
    let failed = 0;
    
    for (const subscription of activeSubscriptions) {
      try {
        const nextBillingDate = new Date(subscription.nextBillingDate!);
        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
        
        const newPeriodStart = subscription.nextBillingDate!;
        const newPeriodEnd = new Date(newPeriodStart);
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: {
            currentPeriodStart: newPeriodStart,
            currentPeriodEnd: newPeriodEnd,
            nextBillingDate: nextBillingDate,
            lastPaymentDate: new Date()
          }
        });
        
        logger.info('Monthly billing processed', {
          clientId: subscription.clientId,
          amount: subscription.monthlyFee.toNumber(),
          nextBilling: nextBillingDate
        });
        
        processed++;
      } catch (error) {
        logger.error('Failed to process billing', {
          clientId: subscription.clientId,
          error: (error as Error).message
        });
        failed++;
      }
    }
    
    return { processed, failed };
  }
}