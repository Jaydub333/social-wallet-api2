import { Request, Response, NextFunction } from 'express';
import { IntegrationService } from '../services/integrationService';
import { AccessTokenRequest } from '../middleware/accessToken';
import { asyncHandler, createError } from '../middleware/errorHandler';

const integrationService = new IntegrationService();

export const getProfile = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const { userId, clientId, scopes } = req.accessToken!;
  
  const profile = await integrationService.getUserProfileForIntegration(
    userId,
    clientId,
    scopes
  );
  
  res.json({
    success: true,
    data: {
      user_id: profile.userId,
      display_name: profile.displayName,
      username: profile.username,
      profile_picture_url: profile.profilePictureUrl,
      bio: profile.bio,
      location: profile.location,
      website: profile.website,
      verified: profile.verified,
      verification_badges: profile.verificationBadges,
      trust_score: profile.trustScore
    }
  });
});

export const getMedia = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const { userId, clientId, scopes } = req.accessToken!;
  const limit = parseInt(req.query.limit as string) || 20;
  const offset = parseInt(req.query.offset as string) || 0;
  
  if (limit > 100) {
    throw createError('Limit cannot exceed 100', 400, 'LIMIT_TOO_HIGH');
  }
  
  const result = await integrationService.getUserMediaForIntegration(
    userId,
    clientId,
    scopes,
    limit,
    offset
  );
  
  res.json({
    success: true,
    data: {
      media: result.media.map(item => ({
        id: item.id,
        file_url: item.fileUrl,
        file_type: item.fileType,
        mime_type: item.mimeType,
        description: item.description,
        tags: item.tags,
        created_at: item.createdAt
      })),
      pagination: {
        limit,
        offset,
        total: result.total,
        has_more: result.hasMore
      }
    }
  });
});

export const requestPermissions = asyncHandler(async (req: AccessTokenRequest, res: Response, next: NextFunction) => {
  const { userId, clientId } = req.accessToken!;
  const { additional_scopes } = req.body;
  
  if (!additional_scopes || !Array.isArray(additional_scopes)) {
    throw createError('additional_scopes must be an array', 400, 'INVALID_SCOPES');
  }
  
  const result = await integrationService.requestAdditionalPermissions(
    userId,
    clientId,
    additional_scopes
  );
  
  res.json({
    success: true,
    data: result
  });
});

export const getUsageStats = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const clientId = (req as any).client?.id;
  const days = parseInt(req.query.days as string) || 30;
  
  if (!clientId) {
    throw createError('Client authentication required', 401, 'CLIENT_AUTH_REQUIRED');
  }
  
  if (days > 365) {
    throw createError('Days parameter cannot exceed 365', 400, 'DAYS_TOO_HIGH');
  }
  
  const stats = await integrationService.getClientUsageStats(clientId, days);
  
  res.json({
    success: true,
    data: {
      total_requests: stats.totalRequests,
      endpoint_breakdown: stats.endpointBreakdown,
      daily_usage: stats.dailyUsage
    }
  });
});