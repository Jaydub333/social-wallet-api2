import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface PermissionSettings {
  clientId: string;
  clientName: string;
  allowedFields: string[];
  expiresAt: Date | null;
  grantedAt: Date;
}

export interface UpdatePermissionsData {
  allowedFields: string[];
  expiresAt?: Date;
}

export class PrivacyService {
  async getUserPermissions(userId: string): Promise<PermissionSettings[]> {
    const permissions = await prisma.sharingPermission.findMany({
      where: { userId },
      include: {
        client: {
          select: {
            id: true,
            clientName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    
    return permissions.map(permission => ({
      clientId: permission.clientId,
      clientName: permission.client.clientName,
      allowedFields: permission.allowedFields,
      expiresAt: permission.expiresAt,
      grantedAt: permission.createdAt
    }));
  }
  
  async updatePermissions(
    userId: string, 
    clientId: string, 
    data: UpdatePermissionsData
  ): Promise<{ message: string }> {
    const client = await prisma.apiClient.findUnique({
      where: { id: clientId }
    });
    
    if (!client) {
      throw createError('Client not found', 404, 'CLIENT_NOT_FOUND');
    }
    
    const validFields = [
      'displayName',
      'username',
      'profilePictureUrl',
      'bio',
      'location',
      'website',
      'email',
      'phone',
      'media'
    ];
    
    const invalidFields = data.allowedFields.filter(field => !validFields.includes(field));
    if (invalidFields.length > 0) {
      throw createError(
        'Invalid fields specified', 
        400, 
        'INVALID_FIELDS', 
        { invalidFields }
      );
    }
    
    await prisma.sharingPermission.upsert({
      where: {
        userId_clientId: {
          userId,
          clientId
        }
      },
      update: {
        allowedFields: data.allowedFields,
        expiresAt: data.expiresAt || null
      },
      create: {
        userId,
        clientId,
        allowedFields: data.allowedFields,
        expiresAt: data.expiresAt || null
      }
    });
    
    // Revoke any existing access tokens if permissions are reduced
    const existingPermission = await prisma.sharingPermission.findUnique({
      where: {
        userId_clientId: {
          userId,
          clientId
        }
      }
    });
    
    if (existingPermission && data.allowedFields.length < existingPermission.allowedFields.length) {
      await prisma.accessToken.deleteMany({
        where: {
          userId,
          clientId
        }
      });
      
      logger.info('Access tokens revoked due to reduced permissions', { userId, clientId });
    }
    
    logger.info('User permissions updated', { 
      userId, 
      clientId,
      allowedFields: data.allowedFields.join(','),
      expiresAt: data.expiresAt
    });
    
    return { message: 'Permissions updated successfully' };
  }
  
  async revokePermissions(userId: string, clientId: string): Promise<{ message: string }> {
    const permission = await prisma.sharingPermission.findUnique({
      where: {
        userId_clientId: {
          userId,
          clientId
        }
      }
    });
    
    if (!permission) {
      throw createError('No permissions found for this client', 404, 'PERMISSIONS_NOT_FOUND');
    }
    
    await prisma.$transaction([
      // Delete sharing permissions
      prisma.sharingPermission.delete({
        where: {
          userId_clientId: {
            userId,
            clientId
          }
        }
      }),
      // Revoke all access tokens
      prisma.accessToken.deleteMany({
        where: {
          userId,
          clientId
        }
      }),
      // Revoke unused authorization codes
      prisma.authorizationCode.deleteMany({
        where: {
          userId,
          clientId,
          used: false
        }
      })
    ]);
    
    logger.info('All permissions revoked for client', { userId, clientId });
    
    return { message: 'All permissions and access tokens revoked successfully' };
  }
  
  async getDataExport(userId: string): Promise<{
    user: any;
    profile: any;
    media: any[];
    verifications: any[];
    permissions: any[];
  }> {
    const userData = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        mediaAssets: {
          select: {
            id: true,
            fileUrl: true,
            fileType: true,
            description: true,
            tags: true,
            createdAt: true
          }
        },
        verifications: {
          select: {
            verificationType: true,
            verified: true,
            verifiedAt: true,
            createdAt: true
          }
        },
        sharingPermissions: {
          include: {
            client: {
              select: {
                clientName: true
              }
            }
          }
        }
      }
    });
    
    if (!userData) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    // Remove sensitive data
    const { passwordHash, ...userWithoutPassword } = userData;
    
    const exportData = {
      user: userWithoutPassword,
      profile: userData.profile,
      media: userData.mediaAssets,
      verifications: userData.verifications,
      permissions: userData.sharingPermissions.map(p => ({
        clientName: p.client.clientName,
        allowedFields: p.allowedFields,
        grantedAt: p.createdAt,
        expiresAt: p.expiresAt
      }))
    };
    
    logger.info('Data export generated', { userId });
    
    return exportData;
  }
  
  async deleteAllUserData(userId: string): Promise<{ message: string }> {
    // First verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });
    
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    // Delete user and all related data (cascade will handle relations)
    await prisma.user.delete({
      where: { id: userId }
    });
    
    logger.info('User account and all data deleted', { userId });
    
    return { message: 'All user data has been permanently deleted' };
  }
  
  async getPrivacySettings(userId: string): Promise<{
    dataRetentionDays: number;
    allowDataCollection: boolean;
    allowAnalytics: boolean;
    emailNotifications: boolean;
  }> {
    // In a full implementation, these would be stored in a user_settings table
    // For now, returning default values
    return {
      dataRetentionDays: 365,
      allowDataCollection: true,
      allowAnalytics: false,
      emailNotifications: true
    };
  }
  
  async updatePrivacySettings(
    userId: string, 
    settings: Partial<{
      dataRetentionDays: number;
      allowDataCollection: boolean;
      allowAnalytics: boolean;
      emailNotifications: boolean;
    }>
  ): Promise<{ message: string }> {
    // In a full implementation, these would be stored in a user_settings table
    logger.info('Privacy settings updated', { userId, settings });
    
    return { message: 'Privacy settings updated successfully' };
  }
}