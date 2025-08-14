import { Request, Response, NextFunction } from 'express';
import { OAuthService } from '../services/oauthService';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';

const oauthService = new OAuthService();

export const authorize = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { client_id, redirect_uri, scope, state, response_type } = req.query;
  
  if (response_type !== 'code') {
    throw createError('Unsupported response type', 400, 'UNSUPPORTED_RESPONSE_TYPE');
  }
  
  if (!client_id || !redirect_uri || !scope) {
    throw createError('Missing required parameters', 400, 'MISSING_PARAMETERS');
  }
  
  const scopes = (scope as string).split(' ');
  const userId = (req as any).user?.id; // If user is already logged in
  
  const result = await oauthService.initiateAuthorization({
    clientId: client_id as string,
    redirectUri: redirect_uri as string,
    scope: scopes,
    state: state as string
  }, userId);
  
  if (result.requiresLogin) {
    return res.status(302).render('oauth-login', {
      clientName: result.client.name,
      redirectParams: new URLSearchParams({
        client_id: client_id as string,
        redirect_uri: redirect_uri as string,
        scope: scope as string,
        ...(state && { state: state as string })
      }).toString()
    });
  }
  
  if (result.authorizationUrl) {
    return res.redirect(result.authorizationUrl);
  }
});

export const authorizeWithUser = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const { client_id, redirect_uri, scope, state } = req.body;
  const userId = req.user!.id;
  
  if (!client_id || !redirect_uri || !scope) {
    throw createError('Missing required parameters', 400, 'MISSING_PARAMETERS');
  }
  
  const scopes = Array.isArray(scope) ? scope : scope.split(' ');
  
  const result = await oauthService.initiateAuthorization({
    clientId: client_id,
    redirectUri: redirect_uri,
    scope: scopes,
    state
  }, userId);
  
  res.json({
    success: true,
    data: {
      authorizationUrl: result.authorizationUrl,
      client: result.client
    }
  });
});

export const token = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { 
    grant_type, 
    code, 
    redirect_uri, 
    client_id, 
    client_secret,
    refresh_token 
  } = req.body;
  
  if (!grant_type || !client_id || !client_secret) {
    throw createError('Missing required parameters', 400, 'MISSING_PARAMETERS');
  }
  
  if (grant_type === 'authorization_code' && (!code || !redirect_uri)) {
    throw createError('Missing code or redirect_uri', 400, 'MISSING_CODE_OR_REDIRECT');
  }
  
  if (grant_type === 'refresh_token' && !refresh_token) {
    throw createError('Missing refresh_token', 400, 'MISSING_REFRESH_TOKEN');
  }
  
  const tokenResponse = await oauthService.exchangeCodeForToken({
    grantType: grant_type,
    code,
    redirectUri: redirect_uri,
    clientId: client_id,
    clientSecret: client_secret,
    refreshToken: refresh_token
  });
  
  res.json({
    access_token: tokenResponse.accessToken,
    token_type: tokenResponse.tokenType,
    expires_in: tokenResponse.expiresIn,
    refresh_token: tokenResponse.refreshToken,
    scope: tokenResponse.scope.join(' ')
  });
});

export const revokeToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { token: accessToken } = req.body;
  
  if (!accessToken) {
    throw createError('Missing token parameter', 400, 'MISSING_TOKEN');
  }
  
  await oauthService.revokeToken(accessToken);
  
  res.json({
    success: true,
    message: 'Token revoked successfully'
  });
});

export const introspect = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { token: accessToken } = req.body;
  
  if (!accessToken) {
    throw createError('Missing token parameter', 400, 'MISSING_TOKEN');
  }
  
  try {
    const tokenInfo = await oauthService.validateAccessToken(accessToken);
    
    res.json({
      active: true,
      client_id: tokenInfo.clientId,
      user_id: tokenInfo.userId,
      scope: tokenInfo.scopes.join(' ')
    });
  } catch (error) {
    res.json({
      active: false
    });
  }
});