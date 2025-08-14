import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface UpdateProfileData {
  displayName?: string;
  bio?: string;
  location?: string;
  website?: string;
  birthDate?: Date;
  phone?: string;
}

export interface UserProfile {
  id: string;
  email: string;
  username: string | null;
  emailVerified: boolean;
  profile: {
    displayName: string | null;
    bio: string | null;
    profilePictureUrl: string | null;
    coverImageUrl: string | null;
    location: string | null;
    website: string | null;
    birthDate: Date | null;
    phone: string | null;
  } | null;
  verifications: Array<{
    verificationType: string;
    verified: boolean;
    verifiedAt: Date | null;
  }>;
}

export class UserService {
  async getUserProfile(userId: string): Promise<UserProfile> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        verifications: {
          select: {
            verificationType: true,
            verified: true,
            verifiedAt: true
          }
        }
      }
    });
    
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    return user as UserProfile;
  }
  
  async updateProfile(userId: string, data: UpdateProfileData): Promise<UserProfile> {
    const existingProfile = await prisma.userProfile.findUnique({
      where: { userId }
    });
    
    if (!existingProfile) {
      throw createError('User profile not found', 404, 'PROFILE_NOT_FOUND');
    }
    
    await prisma.userProfile.update({
      where: { userId },
      data: {
        ...data,
        updatedAt: new Date()
      }
    });
    
    logger.info('User profile updated', { userId, updatedFields: Object.keys(data) });
    
    return this.getUserProfile(userId);
  }
  
  async getUserMedia(userId: string, limit: number = 50, offset: number = 0) {
    const media = await prisma.mediaAsset.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        fileUrl: true,
        fileType: true,
        fileSize: true,
        mimeType: true,
        description: true,
        tags: true,
        createdAt: true
      }
    });
    
    const totalCount = await prisma.mediaAsset.count({
      where: { userId }
    });
    
    return {
      media,
      pagination: {
        limit,
        offset,
        total: totalCount,
        hasMore: offset + limit < totalCount
      }
    };
  }
  
  async deleteMediaAsset(userId: string, mediaId: string): Promise<void> {
    const media = await prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        userId
      }
    });
    
    if (!media) {
      throw createError('Media asset not found', 404, 'MEDIA_NOT_FOUND');
    }
    
    await prisma.mediaAsset.delete({
      where: { id: mediaId }
    });
    
    logger.info('Media asset deleted', { userId, mediaId });
  }
  
  async deactivateAccount(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false }
    });
    
    logger.info('User account deactivated', { userId });
  }
}