import { Request, Response, NextFunction } from 'express';
import { SubscriptionService, SUBSCRIPTION_TIERS } from '../services/subscriptionService';
import { asyncHandler, createError } from '../middleware/errorHandler';

const subscriptionService = new SubscriptionService();

export const registerClient = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const {
    client_name,
    callback_urls,
    subscription_tier,
    contact_email,
    company_name,
    description
  } = req.body;
  
  if (!client_name || !callback_urls || !subscription_tier || !contact_email) {
    throw createError('Missing required fields', 400, 'MISSING_REQUIRED_FIELDS');
  }
  
  if (!Array.isArray(callback_urls) || callback_urls.length === 0) {
    throw createError('callback_urls must be a non-empty array', 400, 'INVALID_CALLBACK_URLS');
  }
  
  const result = await subscriptionService.registerClient({
    clientName: client_name,
    callbackUrls: callback_urls,
    subscriptionTier: subscription_tier,
    contactEmail: contact_email,
    companyName: company_name,
    description
  });
  
  res.status(201).json({
    success: true,
    data: {
      client_id: result.clientId,
      client_secret: result.clientSecret,
      subscription_details: result.subscriptionDetails,
      message: 'Client registered successfully. Please store your client_secret securely as it cannot be retrieved later.'
    }
  });
});

export const updateSubscription = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req as any).client?.id;
  const { subscription_tier } = req.body;
  
  if (!subscription_tier) {
    throw createError('subscription_tier is required', 400, 'MISSING_SUBSCRIPTION_TIER');
  }
  
  const result = await subscriptionService.updateSubscription(clientId, subscription_tier);
  
  res.json({
    success: true,
    data: result
  });
});

export const suspendSubscription = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req as any).client?.id;
  const { reason } = req.body;
  
  const result = await subscriptionService.suspendSubscription(clientId, reason);
  
  res.json({
    success: true,
    data: result
  });
});

export const reactivateSubscription = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req as any).client?.id;
  
  const result = await subscriptionService.reactivateSubscription(clientId);
  
  res.json({
    success: true,
    data: result
  });
});

export const getBilling = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req as any).client?.id;
  
  const billingInfo = await subscriptionService.getBillingInfo(clientId);
  
  res.json({
    success: true,
    data: {
      client_id: billingInfo.clientId,
      subscription_tier: billingInfo.subscriptionTier,
      current_period: billingInfo.currentPeriod,
      next_billing_date: billingInfo.nextBillingDate,
      monthly_fee: billingInfo.monthlyFee,
      usage: billingInfo.usage,
      invoices: billingInfo.invoices
    }
  });
});

export const generateApiKey = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req as any).client?.id;
  
  const result = await subscriptionService.generateApiKey(clientId);
  
  res.json({
    success: true,
    data: {
      client_secret: result.apiKey,
      message: result.message
    }
  });
});

export const getLimits = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req as any).client?.id;
  
  const limits = await subscriptionService.getSubscriptionLimits(clientId);
  
  res.json({
    success: true,
    data: limits
  });
});

export const getSubscriptionTiers = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const tiers = Object.entries(SUBSCRIPTION_TIERS).map(([key, tier]) => ({
    id: key,
    name: tier.name,
    monthly_fee: tier.monthlyFee,
    request_limit: tier.requestLimit,
    features: tier.features
  }));
  
  res.json({
    success: true,
    data: {
      tiers
    }
  });
});

// Admin endpoint for processing monthly billing
export const processMonthlyBilling = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  // In production, this would be protected with admin authentication
  const adminKey = req.headers['x-admin-key'];
  
  if (adminKey !== process.env.ADMIN_SECRET_KEY) {
    throw createError('Unauthorized', 401, 'UNAUTHORIZED');
  }
  
  const result = await subscriptionService.processMonthlyBilling();
  
  res.json({
    success: true,
    data: {
      processed: result.processed,
      failed: result.failed,
      message: `Processed ${result.processed} subscriptions, ${result.failed} failed`
    }
  });
});

export const getClientInfo = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const client = (req as any).client;
  
  if (!client) {
    throw createError('Client authentication required', 401, 'CLIENT_AUTH_REQUIRED');
  }
  
  res.json({
    success: true,
    data: {
      client_id: client.clientKey,
      client_name: client.clientName,
      subscription_tier: client.subscriptionTier,
      monthly_fee: client.monthlyFee.toNumber(),
      callback_urls: client.callbackUrls,
      is_active: client.isActive,
      created_at: client.createdAt
    }
  });
});