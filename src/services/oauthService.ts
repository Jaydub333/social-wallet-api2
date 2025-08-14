import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

export interface AuthorizeParams {
  clientId: string;
  redirectUri: string;
  scope: string[];
  state?: string;
}

export interface TokenParams {
  grantType: 'authorization_code' | 'refresh_token';
  code?: string;
  redirectUri?: string;
  clientId: string;
  clientSecret: string;
  refreshToken?: string;
}

export interface TokenResponse {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken?: string;
  scope: string[];
}

export class OAuthService {
  async initiateAuthorization(params: AuthorizeParams, userId?: string): Promise<{
    authorizationUrl?: string;
    requiresLogin?: boolean;
    client: any;
  }> {
    const { clientId, redirectUri, scope, state } = params;
    
    const client = await prisma.apiClient.findFirst({
      where: {
        clientKey: clientId,
        isActive: true
      }
    });
    
    if (!client) {
      throw createError('Invalid client ID', 400, 'INVALID_CLIENT');
    }
    
    if (!client.callbackUrls.includes(redirectUri)) {
      throw createError('Invalid redirect URI', 400, 'INVALID_REDIRECT_URI');
    }
    
    if (!userId) {
      return {
        requiresLogin: true,
        client: {
          id: client.id,
          name: client.clientName
        }
      };
    }
    
    const authorizationCode = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    await prisma.authorizationCode.create({
      data: {
        userId,
        clientId: client.id,
        code: authorizationCode,
        redirectUri,
        scopes: scope,
        expiresAt
      }
    });
    
    const authUrl = new URL(redirectUri);
    authUrl.searchParams.append('code', authorizationCode);
    if (state) authUrl.searchParams.append('state', state);
    
    logger.info('Authorization code generated', { 
      userId, 
      clientId: client.id, 
      scope: scope.join(',') 
    });
    
    return {
      authorizationUrl: authUrl.toString(),
      client: {
        id: client.id,
        name: client.clientName
      }
    };
  }
  
  async exchangeCodeForToken(params: TokenParams): Promise<TokenResponse> {
    const { grantType, code, redirectUri, clientId, clientSecret, refreshToken } = params;
    
    const client = await this.validateClient(clientId, clientSecret);
    
    if (grantType === 'authorization_code') {
      return this.handleAuthorizationCodeGrant(client.id, code!, redirectUri!);
    } else if (grantType === 'refresh_token') {
      return this.handleRefreshTokenGrant(client.id, refreshToken!);
    } else {
      throw createError('Unsupported grant type', 400, 'UNSUPPORTED_GRANT_TYPE');
    }
  }
  
  private async validateClient(clientId: string, clientSecret: string) {
    const client = await prisma.apiClient.findFirst({
      where: {
        clientKey: clientId,
        clientSecret: clientSecret,
        isActive: true
      }
    });
    
    if (!client) {
      throw createError('Invalid client credentials', 401, 'INVALID_CLIENT_CREDENTIALS');
    }
    
    const subscription = await prisma.subscription.findFirst({
      where: {
        clientId: client.id,
        subscriptionStatus: 'active'
      }
    });
    
    if (!subscription) {
      throw createError('Client subscription is not active', 403, 'SUBSCRIPTION_INACTIVE');
    }
    
    return client;
  }
  
  private async handleAuthorizationCodeGrant(clientId: string, code: string, redirectUri: string): Promise<TokenResponse> {
    const authCode = await prisma.authorizationCode.findUnique({
      where: { code },
      include: { user: true }
    });
    
    if (!authCode) {
      throw createError('Invalid authorization code', 400, 'INVALID_CODE');
    }
    
    if (authCode.used) {
      throw createError('Authorization code already used', 400, 'CODE_ALREADY_USED');
    }
    
    if (authCode.expiresAt < new Date()) {
      throw createError('Authorization code expired', 400, 'CODE_EXPIRED');
    }
    
    if (authCode.clientId !== clientId || authCode.redirectUri !== redirectUri) {
      throw createError('Code validation failed', 400, 'CODE_VALIDATION_FAILED');
    }
    
    const accessToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenValue = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await prisma.$transaction([
      prisma.authorizationCode.update({
        where: { code },
        data: { used: true }
      }),
      prisma.accessToken.create({
        data: {
          userId: authCode.userId,
          clientId: authCode.clientId,
          token: accessToken,
          refreshToken: refreshTokenValue,
          scopes: authCode.scopes,
          expiresAt
        }
      })
    ]);
    
    logger.info('Access token issued', { 
      userId: authCode.userId, 
      clientId: authCode.clientId,
      scopes: authCode.scopes.join(',')
    });
    
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshToken: refreshTokenValue,
      scope: authCode.scopes
    };
  }
  
  private async handleRefreshTokenGrant(clientId: string, refreshToken: string): Promise<TokenResponse> {
    const token = await prisma.accessToken.findUnique({
      where: { refreshToken },
      include: { user: true }
    });
    
    if (!token || token.clientId !== clientId) {
      throw createError('Invalid refresh token', 400, 'INVALID_REFRESH_TOKEN');
    }
    
    const newAccessToken = crypto.randomBytes(32).toString('hex');
    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    
    await prisma.accessToken.update({
      where: { id: token.id },
      data: {
        token: newAccessToken,
        refreshToken: newRefreshToken,
        expiresAt
      }
    });
    
    logger.info('Token refreshed', { 
      userId: token.userId, 
      clientId: token.clientId 
    });
    
    return {
      accessToken: newAccessToken,
      tokenType: 'Bearer',
      expiresIn: 3600,
      refreshToken: newRefreshToken,
      scope: token.scopes
    };
  }
  
  async validateAccessToken(accessToken: string): Promise<{
    userId: string;
    clientId: string;
    scopes: string[];
  }> {
    const token = await prisma.accessToken.findUnique({
      where: { token: accessToken },
      include: { 
        user: { select: { id: true, isActive: true } },
        client: { select: { id: true, isActive: true } }
      }
    });
    
    if (!token) {
      throw createError('Invalid access token', 401, 'INVALID_ACCESS_TOKEN');
    }
    
    if (token.expiresAt < new Date()) {
      throw createError('Access token expired', 401, 'TOKEN_EXPIRED');
    }
    
    if (!token.user.isActive || !token.client.isActive) {
      throw createError('Token associated with inactive account', 401, 'INACTIVE_ACCOUNT');
    }
    
    return {
      userId: token.userId,
      clientId: token.clientId,
      scopes: token.scopes
    };
  }
  
  async revokeToken(accessToken: string): Promise<void> {
    const token = await prisma.accessToken.findUnique({
      where: { token: accessToken }
    });
    
    if (token) {
      await prisma.accessToken.delete({
        where: { id: token.id }
      });
      
      logger.info('Access token revoked', { 
        userId: token.userId, 
        clientId: token.clientId 
      });
    }
  }
  
  async getUserPermissions(userId: string, clientId: string): Promise<{
    hasPermission: boolean;
    allowedFields: string[];
    expiresAt: Date | null;
  }> {
    const permission = await prisma.sharingPermission.findUnique({
      where: {
        userId_clientId: {
          userId,
          clientId
        }
      }
    });
    
    if (!permission) {
      return {
        hasPermission: false,
        allowedFields: [],
        expiresAt: null
      };
    }
    
    const isExpired = permission.expiresAt && permission.expiresAt < new Date();
    
    return {
      hasPermission: !isExpired,
      allowedFields: isExpired ? [] : permission.allowedFields,
      expiresAt: permission.expiresAt
    };
  }
}