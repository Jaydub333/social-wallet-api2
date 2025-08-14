import { Request, Response, NextFunction } from 'express';
import { OAuthService } from '../services/oauthService';
import { createError } from './errorHandler';

const oauthService = new OAuthService();

export interface AccessTokenRequest extends Request {
  accessToken?: {
    userId: string;
    clientId: string;
    scopes: string[];
  };
}

export const requireAccessToken = (requiredScopes: string[] = []) => {
  return async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw createError('Access token required', 401, 'MISSING_ACCESS_TOKEN');
      }
      
      const token = authHeader.substring(7);
      const tokenInfo = await oauthService.validateAccessToken(token);
      
      // Check if token has required scopes
      if (requiredScopes.length > 0) {
        const hasRequiredScopes = requiredScopes.every(scope => 
          tokenInfo.scopes.includes(scope)
        );
        
        if (!hasRequiredScopes) {
          throw createError('Insufficient scope', 403, 'INSUFFICIENT_SCOPE', {
            required: requiredScopes,
            granted: tokenInfo.scopes
          });
        }
      }
      
      req.accessToken = tokenInfo;
      next();
      
    } catch (error) {
      next(error);
    }
  };
};