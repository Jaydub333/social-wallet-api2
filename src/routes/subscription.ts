import { Router } from 'express';
import { requireClientAuth } from '../middleware/auth';
import {
  registerClient,
  updateSubscription,
  suspendSubscription,
  reactivateSubscription,
  getBilling,
  generateApiKey,
  getLimits,
  getSubscriptionTiers,
  processMonthlyBilling,
  getClientInfo
} from '../controllers/subscriptionController';

export const subscriptionRoutes = Router();

// Public endpoints
subscriptionRoutes.post('/register', registerClient);
subscriptionRoutes.get('/tiers', getSubscriptionTiers);

// Client authenticated endpoints
subscriptionRoutes.use(requireClientAuth);
subscriptionRoutes.get('/me', getClientInfo);
subscriptionRoutes.put('/tier', updateSubscription);
subscriptionRoutes.post('/suspend', suspendSubscription);
subscriptionRoutes.post('/reactivate', reactivateSubscription);
subscriptionRoutes.get('/billing', getBilling);
subscriptionRoutes.post('/regenerate-key', generateApiKey);
subscriptionRoutes.get('/limits', getLimits);

// Admin endpoints
subscriptionRoutes.post('/admin/process-billing', processMonthlyBilling);