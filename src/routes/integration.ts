import { Router } from 'express';
import { requireAccessToken } from '../middleware/accessToken';
import { requireClientAuth } from '../middleware/auth';
import { enforceSubscriptionLimits } from '../middleware/rateLimiting';
import { getProfile, getMedia, requestPermissions, getUsageStats } from '../controllers/integrationController';

export const integrationRoutes = Router();

integrationRoutes.use(enforceSubscriptionLimits);

integrationRoutes.get('/profile', requireAccessToken(['profile']), getProfile);
integrationRoutes.get('/media', requireAccessToken(['media']), getMedia);
integrationRoutes.post('/permissions', requireAccessToken(), requestPermissions);
integrationRoutes.get('/usage', requireClientAuth, getUsageStats);