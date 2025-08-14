import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  createPaymentIntent,
  handleWebhook,
  getPaymentHistory,
  getPaymentMethods,
  refundPayment,
  getTopUpOptions,
  getStripeConfig
} from '../controllers/stripeController';

export const paymentRoutes = Router();

// Public endpoints
paymentRoutes.get('/config', getStripeConfig);
paymentRoutes.get('/topup-options', getTopUpOptions);

// Webhook endpoint (no auth required, verified by Stripe signature)
paymentRoutes.post('/webhook', handleWebhook);

// User authenticated endpoints
paymentRoutes.use(requireAuth);

paymentRoutes.post('/intent', createPaymentIntent);
paymentRoutes.get('/history', getPaymentHistory);
paymentRoutes.get('/methods', getPaymentMethods);
paymentRoutes.post('/refund', refundPayment); // In production, this would be admin-only