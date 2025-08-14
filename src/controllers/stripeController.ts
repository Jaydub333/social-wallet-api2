import { Request, Response, NextFunction } from 'express';
import { StripeService } from '../services/stripeService';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const stripeService = new StripeService();

export const createPaymentIntent = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const { amount, currency, payment_method_id, return_url } = req.body;

  if (!amount || typeof amount !== 'number') {
    throw createError('amount is required and must be a number', 400, 'MISSING_AMOUNT');
  }

  if (amount < 1 || amount > 1000) {
    throw createError('amount must be between $1 and $1000', 400, 'INVALID_AMOUNT');
  }

  const paymentIntent = await stripeService.createPaymentIntent({
    userId,
    amount,
    currency,
    paymentMethodId: payment_method_id,
    returnUrl: return_url
  });

  res.json({
    success: true,
    data: {
      payment_intent_id: paymentIntent.id,
      client_secret: paymentIntent.clientSecret,
      amount_cents: paymentIntent.amount,
      coins: paymentIntent.coins,
      status: paymentIntent.status
    }
  });
});

export const handleWebhook = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const signature = req.headers['stripe-signature'] as string;
  
  if (!signature) {
    throw createError('Missing stripe-signature header', 400, 'MISSING_SIGNATURE');
  }

  try {
    await stripeService.handleWebhook(req.body, signature);
    
    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook processing failed', {
      error: (error as Error).message,
      signature
    });
    throw error;
  }
});

export const getPaymentHistory = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;

  if (limit > 100) {
    throw createError('Limit cannot exceed 100', 400, 'LIMIT_TOO_HIGH');
  }

  const history = await stripeService.getPaymentHistory(userId, limit, offset);

  res.json({
    success: true,
    data: {
      payments: history.payments.map(payment => ({
        id: payment.id,
        amount_cents: payment.amount,
        amount_usd: payment.amount / 100,
        coins: payment.coins,
        status: payment.status,
        currency: payment.currency,
        created_at: payment.createdAt,
        completed_at: payment.completedAt
      })),
      pagination: history.pagination
    }
  });
});

export const getPaymentMethods = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const paymentMethods = await stripeService.getPaymentMethods(userId);

  res.json({
    success: true,
    data: {
      payment_methods: paymentMethods
    }
  });
});

export const refundPayment = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { payment_intent_id, reason } = req.body;

  if (!payment_intent_id) {
    throw createError('payment_intent_id is required', 400, 'MISSING_PAYMENT_INTENT_ID');
  }

  const refund = await stripeService.refundPayment(payment_intent_id, reason);

  res.json({
    success: true,
    data: {
      refund_id: refund.refundId,
      amount_cents: refund.amount,
      amount_usd: refund.amount / 100,
      status: refund.status,
      message: 'Payment refunded successfully'
    }
  });
});

export const getTopUpOptions = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const options = stripeService.getTopUpOptions();

  res.json({
    success: true,
    data: {
      options: options.map(option => ({
        amount_usd: option.usd,
        coins: option.coins,
        bonus_coins: option.bonus || 0,
        total_coins: option.coins + (option.bonus || 0),
        value_per_dollar: (option.coins + (option.bonus || 0)) / option.usd
      }))
    }
  });
});

export const getStripeConfig = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const publishableKey = process.env.STRIPE_PUBLISHABLE_KEY;

  if (!publishableKey) {
    throw createError('Stripe not configured', 500, 'STRIPE_NOT_CONFIGURED');
  }

  res.json({
    success: true,
    data: {
      publishable_key: publishableKey,
      currency: 'usd',
      coins_per_usd: 100,
      min_amount_usd: 1,
      max_amount_usd: 1000
    }
  });
});