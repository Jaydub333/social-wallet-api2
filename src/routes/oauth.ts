import { Router } from 'express';
import { requireAuth, requireClientAuth } from '../middleware/auth';
import { authorize, authorizeWithUser, token, revokeToken, introspect } from '../controllers/oauthController';

export const oauthRoutes = Router();

oauthRoutes.get('/authorize', authorize);
oauthRoutes.post('/authorize', requireAuth, authorizeWithUser);
oauthRoutes.post('/token', token);
oauthRoutes.post('/revoke', requireClientAuth, revokeToken);
oauthRoutes.post('/introspect', requireClientAuth, introspect);