import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface IntegrationProfileData {
  userId: string;
  displayName: string | null;
  username: string | null;
  profilePictureUrl: string | null;
  bio: string | null;
  location: string | null;
  website: string | null;
  verified: boolean;
  verificationBadges: string[];
  trustScore: number;
}

export interface MediaData {
  id: string;
  fileUrl: string;
  fileType: string;
  mimeType: string | null;
  description: string | null;
  tags: string[];
  createdAt: Date;
}

export class IntegrationService {
  async getUserProfileForIntegration(
    userId: string, 
    clientId: string, 
    requestedScopes: string[]
  ): Promise<IntegrationProfileData> {
    // Check user permissions
    const permission = await prisma.sharingPermission.findUnique({
      where: {
        userId_clientId: {
          userId,
          clientId
        }
      }
    });
    
    if (!permission || (permission.expiresAt && permission.expiresAt < new Date())) {
      throw createError('No active permission to access user data', 403, 'NO_PERMISSION');
    }
    
    // Verify scopes
    if (!requestedScopes.includes('profile')) {
      throw createError('Profile scope required', 403, 'MISSING_PROFILE_SCOPE');
    }
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        verifications: {
          where: { verified: true },
          select: {
            verificationType: true,
            verifiedAt: true
          }
        }
      }
    });
    
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    // Filter data based on allowed fields
    const allowedFields = permission.allowedFields;
    
    const verificationStatus = this.calculateVerificationStatus(user.verifications);
    
    const profileData: IntegrationProfileData = {
      userId: user.id,
      displayName: allowedFields.includes('displayName') ? user.profile?.displayName || null : null,
      username: allowedFields.includes('username') ? user.username : null,
      profilePictureUrl: allowedFields.includes('profilePictureUrl') ? user.profile?.profilePictureUrl || null : null,
      bio: allowedFields.includes('bio') ? user.profile?.bio || null : null,
      location: allowedFields.includes('location') ? user.profile?.location || null : null,
      website: allowedFields.includes('website') ? user.profile?.website || null : null,
      verified: verificationStatus.verified,
      verificationBadges: verificationStatus.badges,
      trustScore: verificationStatus.trustScore
    };
    
    // Track API usage
    await this.trackApiUsage(clientId, 'profile');
    
    logger.info('Profile data accessed', { 
      userId, 
      clientId, 
      allowedFields: allowedFields.join(',') 
    });
    
    return profileData;
  }
  
  async getUserMediaForIntegration(
    userId: string,
    clientId: string,
    requestedScopes: string[],
    limit: number = 20,
    offset: number = 0
  ): Promise<{ media: MediaData[]; total: number; hasMore: boolean }> {
    // Check permissions
    const permission = await prisma.sharingPermission.findUnique({
      where: {
        userId_clientId: {
          userId,
          clientId
        }
      }
    });
    
    if (!permission || (permission.expiresAt && permission.expiresAt < new Date())) {
      throw createError('No active permission to access user data', 403, 'NO_PERMISSION');
    }
    
    if (!requestedScopes.includes('media')) {
      throw createError('Media scope required', 403, 'MISSING_MEDIA_SCOPE');
    }
    
    if (!permission.allowedFields.includes('media')) {
      throw createError('Media access not permitted', 403, 'MEDIA_ACCESS_DENIED');
    }
    
    const media = await prisma.mediaAsset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        fileUrl: true,
        fileType: true,
        mimeType: true,
        description: true,
        tags: true,
        createdAt: true
      }
    });
    
    const total = await prisma.mediaAsset.count({
      where: { userId }
    });
    
    // Track API usage
    await this.trackApiUsage(clientId, 'media');
    
    logger.info('Media data accessed', { 
      userId, 
      clientId, 
      count: media.length 
    });
    
    return {
      media,
      total,
      hasMore: offset + limit < total
    };
  }
  
  async requestAdditionalPermissions(
    userId: string,
    clientId: string,
    additionalScopes: string[]
  ): Promise<{ message: string; pendingApproval: boolean }> {
    const client = await prisma.apiClient.findUnique({
      where: { id: clientId }
    });
    
    if (!client) {
      throw createError('Client not found', 404, 'CLIENT_NOT_FOUND');
    }
    
    // In a real implementation, this would trigger a notification to the user
    // For now, we'll just log the request
    logger.info('Additional permissions requested', {
      userId,
      clientId,
      clientName: client.clientName,
      requestedScopes: additionalScopes.join(',')
    });
    
    return {
      message: 'Permission request sent to user for approval',
      pendingApproval: true
    };
  }
  
  private calculateVerificationStatus(verifications: any[]): {
    verified: boolean;
    badges: string[];
    trustScore: number;
  } {
    const badges: string[] = [];
    let trustScore = 0;
    
    const verificationTypes = verifications.map(v => v.verificationType);
    
    if (verificationTypes.includes('email')) {
      badges.push('email_verified');
      trustScore += 25;
    }
    
    if (verificationTypes.includes('phone')) {
      badges.push('phone_verified');
      trustScore += 25;
    }
    
    if (verificationTypes.includes('identity')) {
      badges.push('identity_verified');
      trustScore += 40;
    }
    
    if (verificationTypes.includes('scammer_check')) {
      badges.push('not_scammer');
      trustScore += 10;
    }
    
    if (trustScore >= 80) {
      badges.push('trusted_user');
    }
    
    return {
      verified: trustScore >= 50,
      badges,
      trustScore
    };
  }
  
  private async trackApiUsage(clientId: string, endpoint: string): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    await prisma.apiUsage.upsert({
      where: {
        clientId_endpoint_date: {
          clientId,
          endpoint,
          date: today
        }
      },
      update: {
        requestCount: {
          increment: 1
        }
      },
      create: {
        clientId,
        endpoint,
        date: today,
        requestCount: 1
      }
    });
  }
  
  async getClientUsageStats(clientId: string, days: number = 30): Promise<{
    totalRequests: number;
    endpointBreakdown: { endpoint: string; count: number }[];
    dailyUsage: { date: Date; requests: number }[];
  }> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    const usage = await prisma.apiUsage.findMany({
      where: {
        clientId,
        date: {
          gte: startDate
        }
      },
      orderBy: { date: 'desc' }
    });
    
    const totalRequests = usage.reduce((sum, u) => sum + u.requestCount, 0);
    
    const endpointBreakdown = usage.reduce((acc, u) => {
      const existing = acc.find(item => item.endpoint === u.endpoint);
      if (existing) {
        existing.count += u.requestCount;
      } else {
        acc.push({ endpoint: u.endpoint, count: u.requestCount });
      }
      return acc;
    }, [] as { endpoint: string; count: number }[]);
    
    const dailyUsage = usage.map(u => ({
      date: u.date,
      requests: u.requestCount
    }));
    
    return {
      totalRequests,
      endpointBreakdown,
      dailyUsage
    };
  }
}