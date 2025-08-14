import Stripe from 'stripe';
import { PrismaClient, PaymentStatus } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { WalletService } from './walletService';

const prisma = new PrismaClient();

export interface PaymentIntent {
  id: string;
  clientSecret: string;
  amount: number; // in cents
  coins: number;
  status: string;
}

export interface TopUpRequest {
  userId: string;
  amount: number; // in USD
  currency?: string;
  paymentMethodId?: string;
  returnUrl?: string;
}

export interface PaymentHistory {
  payments: Array<{
    id: string;
    amount: number; // in cents
    coins: number;
    status: PaymentStatus;
    currency: string;
    createdAt: Date;
    completedAt: Date | null;
  }>;
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
}

export class StripeService {
  private stripe: Stripe;
  private walletService = new WalletService();
  private readonly COINS_PER_USD = 100;
  private readonly MIN_AMOUNT_USD = 1; // $1 minimum
  private readonly MAX_AMOUNT_USD = 1000; // $1000 maximum per transaction

  constructor() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    
    if (!stripeSecretKey) {
      throw new Error('STRIPE_SECRET_KEY environment variable is required');
    }
    
    this.stripe = new Stripe(stripeSecretKey, {
      apiVersion: '2023-10-16'
    });
  }

  async createPaymentIntent(request: TopUpRequest): Promise<PaymentIntent> {
    const { userId, amount, currency = 'usd', paymentMethodId } = request;

    // Validate amount
    if (amount < this.MIN_AMOUNT_USD || amount > this.MAX_AMOUNT_USD) {
      throw createError(
        `Amount must be between $${this.MIN_AMOUNT_USD} and $${this.MAX_AMOUNT_USD}`,
        400,
        'INVALID_AMOUNT'
      );
    }

    // Get or create Stripe customer
    const customer = await this.getOrCreateStripeCustomer(userId);
    
    const amountCents = Math.round(amount * 100);
    const coins = Math.round(amount * this.COINS_PER_USD);

    try {
      const paymentIntentData: Stripe.PaymentIntentCreateParams = {
        amount: amountCents,
        currency,
        customer: customer.id,
        metadata: {
          userId,
          coins: coins.toString(),
          type: 'wallet_topup'
        },
        description: `Social Wallet top-up: ${coins} coins`,
        automatic_payment_methods: {
          enabled: true
        }
      };

      if (paymentMethodId) {
        paymentIntentData.payment_method = paymentMethodId;
        paymentIntentData.confirm = true;
        paymentIntentData.return_url = request.returnUrl || `${process.env.FRONTEND_URL}/wallet/success`;
      }

      const paymentIntent = await this.stripe.paymentIntents.create(paymentIntentData);

      // Store payment record in database
      await prisma.stripePayment.create({
        data: {
          userId,
          stripePaymentId: paymentIntent.id,
          stripeCustomerId: customer.id,
          amount: amountCents,
          coins,
          status: this.mapStripeStatusToPaymentStatus(paymentIntent.status),
          currency,
          description: `Wallet top-up: ${coins} coins`,
          metadata: {
            paymentMethodId,
            returnUrl: request.returnUrl
          }
        }
      });

      logger.info('Payment intent created', {
        userId,
        paymentIntentId: paymentIntent.id,
        amount: amountCents,
        coins
      });

      return {
        id: paymentIntent.id,
        clientSecret: paymentIntent.client_secret!,
        amount: amountCents,
        coins,
        status: paymentIntent.status
      };

    } catch (error) {
      logger.error('Failed to create payment intent', {
        userId,
        amount,
        error: (error as Error).message
      });
      
      if (error instanceof Stripe.errors.StripeError) {
        throw createError(
          'Payment processing error',
          400,
          'STRIPE_ERROR',
          { stripeError: error.message }
        );
      }
      
      throw error;
    }
  }

  async handleWebhook(payload: string, signature: string): Promise<void> {
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    
    if (!webhookSecret) {
      throw new Error('STRIPE_WEBHOOK_SECRET environment variable is required');
    }

    let event: Stripe.Event;

    try {
      event = this.stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (error) {
      logger.error('Webhook signature verification failed', { error: (error as Error).message });
      throw createError('Invalid webhook signature', 400, 'INVALID_WEBHOOK_SIGNATURE');
    }

    logger.info('Processing Stripe webhook', { 
      eventType: event.type, 
      eventId: event.id 
    });

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.payment_failed':
        await this.handlePaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      case 'payment_intent.canceled':
        await this.handlePaymentCanceled(event.data.object as Stripe.PaymentIntent);
        break;

      case 'charge.dispute.created':
        await this.handleChargeDispute(event.data.object as Stripe.Dispute);
        break;

      default:
        logger.info('Unhandled webhook event type', { eventType: event.type });
    }
  }

  private async handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    const { userId, coins } = paymentIntent.metadata;
    
    if (!userId || !coins) {
      logger.error('Missing metadata in payment intent', { paymentIntentId: paymentIntent.id });
      return;
    }

    await prisma.$transaction(async (tx) => {
      // Update payment record
      await tx.stripePayment.update({
        where: { stripePaymentId: paymentIntent.id },
        data: {
          status: 'SUCCEEDED',
          completedAt: new Date()
        }
      });

      // Add coins to user's wallet
      await this.walletService.addCoins(
        userId,
        parseInt(coins),
        'DEPOSIT',
        `Stripe payment: $${(paymentIntent.amount / 100).toFixed(2)}`,
        'stripe_payment',
        paymentIntent.id,
        {
          stripePaymentId: paymentIntent.id,
          stripeChargeId: paymentIntent.latest_charge
        }
      );
    });

    logger.info('Payment processed successfully', {
      userId,
      paymentIntentId: paymentIntent.id,
      coins: parseInt(coins),
      amount: paymentIntent.amount
    });
  }

  private async handlePaymentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await prisma.stripePayment.update({
      where: { stripePaymentId: paymentIntent.id },
      data: {
        status: 'FAILED'
      }
    });

    logger.warn('Payment failed', {
      paymentIntentId: paymentIntent.id,
      lastPaymentError: paymentIntent.last_payment_error?.message
    });
  }

  private async handlePaymentCanceled(paymentIntent: Stripe.PaymentIntent): Promise<void> {
    await prisma.stripePayment.update({
      where: { stripePaymentId: paymentIntent.id },
      data: {
        status: 'CANCELED'
      }
    });

    logger.info('Payment canceled', { paymentIntentId: paymentIntent.id });
  }

  private async handleChargeDispute(dispute: Stripe.Dispute): Promise<void> {
    const charge = await this.stripe.charges.retrieve(dispute.charge as string);
    const paymentIntent = await this.stripe.paymentIntents.retrieve(charge.payment_intent as string);
    
    logger.warn('Charge dispute created', {
      disputeId: dispute.id,
      paymentIntentId: paymentIntent.id,
      amount: dispute.amount,
      reason: dispute.reason
    });

    // In a production system, you might want to:
    // 1. Lock the user's wallet
    // 2. Send notification to admin team
    // 3. Potentially reverse the coin transaction
  }

  private async getOrCreateStripeCustomer(userId: string): Promise<Stripe.Customer> {
    // Check if customer exists in our database
    const existingPayment = await prisma.stripePayment.findFirst({
      where: { userId, stripeCustomerId: { not: null } }
    });

    if (existingPayment?.stripeCustomerId) {
      try {
        return await this.stripe.customers.retrieve(existingPayment.stripeCustomerId) as Stripe.Customer;
      } catch (error) {
        // Customer might have been deleted in Stripe, create a new one
        logger.warn('Stripe customer not found, creating new one', { 
          userId, 
          stripeCustomerId: existingPayment.stripeCustomerId 
        });
      }
    }

    // Get user details for customer creation
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true }
    });

    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }

    const customer = await this.stripe.customers.create({
      email: user.email,
      name: user.profile?.displayName || user.username || undefined,
      metadata: {
        userId: user.id
      }
    });

    logger.info('Stripe customer created', {
      userId,
      stripeCustomerId: customer.id
    });

    return customer;
  }

  async getPaymentHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PaymentHistory> {
    const [payments, totalCount] = await Promise.all([
      prisma.stripePayment.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset
      }),
      prisma.stripePayment.count({ where: { userId } })
    ]);

    return {
      payments: payments.map(payment => ({
        id: payment.id,
        amount: payment.amount,
        coins: payment.coins,
        status: payment.status,
        currency: payment.currency,
        createdAt: payment.createdAt,
        completedAt: payment.completedAt
      })),
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    };
  }

  async refundPayment(paymentIntentId: string, reason?: string): Promise<{
    refundId: string;
    amount: number;
    status: string;
  }> {
    const payment = await prisma.stripePayment.findUnique({
      where: { stripePaymentId: paymentIntentId }
    });

    if (!payment) {
      throw createError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.status !== 'SUCCEEDED') {
      throw createError('Can only refund successful payments', 400, 'INVALID_PAYMENT_STATUS');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      const refund = await this.stripe.refunds.create({
        payment_intent: paymentIntentId,
        reason: reason as any || 'requested_by_customer',
        metadata: {
          userId: payment.userId
        }
      });

      // Update payment status
      await prisma.stripePayment.update({
        where: { stripePaymentId: paymentIntentId },
        data: { status: 'REFUNDED' }
      });

      // Deduct coins from wallet
      await this.walletService.deductCoins(
        payment.userId,
        payment.coins,
        'REFUND',
        `Refund for payment ${paymentIntentId}`,
        'stripe_refund',
        refund.id
      );

      logger.info('Payment refunded', {
        paymentIntentId,
        refundId: refund.id,
        userId: payment.userId,
        amount: refund.amount,
        coins: payment.coins
      });

      return {
        refundId: refund.id,
        amount: refund.amount || 0,
        status: refund.status || 'unknown'
      };

    } catch (error) {
      logger.error('Failed to refund payment', {
        paymentIntentId,
        error: (error as Error).message
      });

      if (error instanceof Stripe.errors.StripeError) {
        throw createError(
          'Refund processing error',
          400,
          'STRIPE_REFUND_ERROR',
          { stripeError: error.message }
        );
      }

      throw error;
    }
  }

  async getPaymentMethods(userId: string): Promise<Array<{
    id: string;
    type: string;
    card?: {
      brand: string;
      last4: string;
      expMonth: number;
      expYear: number;
    };
  }>> {
    const existingPayment = await prisma.stripePayment.findFirst({
      where: { userId, stripeCustomerId: { not: null } }
    });

    if (!existingPayment?.stripeCustomerId) {
      return [];
    }

    try {
      const paymentMethods = await this.stripe.paymentMethods.list({
        customer: existingPayment.stripeCustomerId,
        type: 'card'
      });

      return paymentMethods.data.map(pm => ({
        id: pm.id,
        type: pm.type,
        card: pm.card ? {
          brand: pm.card.brand,
          last4: pm.card.last4,
          expMonth: pm.card.exp_month,
          expYear: pm.card.exp_year
        } : undefined
      }));

    } catch (error) {
      logger.error('Failed to retrieve payment methods', {
        userId,
        stripeCustomerId: existingPayment.stripeCustomerId,
        error: (error as Error).message
      });
      return [];
    }
  }

  private mapStripeStatusToPaymentStatus(stripeStatus: string): PaymentStatus {
    switch (stripeStatus) {
      case 'succeeded':
        return 'SUCCEEDED';
      case 'processing':
      case 'requires_payment_method':
      case 'requires_confirmation':
      case 'requires_action':
        return 'PENDING';
      case 'canceled':
        return 'CANCELED';
      case 'requires_capture':
        return 'PENDING';
      default:
        return 'FAILED';
    }
  }

  // Utility methods for coin conversion
  convertUSDToCoins(usd: number): number {
    return Math.round(usd * this.COINS_PER_USD);
  }

  convertCoinsToUSD(coins: number): number {
    return coins / this.COINS_PER_USD;
  }

  // Get popular top-up amounts
  getTopUpOptions(): Array<{ usd: number; coins: number; bonus?: number }> {
    return [
      { usd: 5, coins: 500 },
      { usd: 10, coins: 1000 },
      { usd: 25, coins: 2500, bonus: 100 }, // 4% bonus
      { usd: 50, coins: 5000, bonus: 250 }, // 5% bonus
      { usd: 100, coins: 10000, bonus: 750 }, // 7.5% bonus
      { usd: 200, coins: 20000, bonus: 2000 }, // 10% bonus
    ];
  }
}