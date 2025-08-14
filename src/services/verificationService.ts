import { PrismaClient } from '@prisma/client';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const prisma = new PrismaClient();

export interface VerificationData {
  verificationType: 'email' | 'phone' | 'identity' | 'scammer_check';
  data?: any;
}

export class VerificationService {
  async sendEmailVerification(userId: string): Promise<{ message: string }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, emailVerified: true }
    });
    
    if (!user) {
      throw createError('User not found', 404, 'USER_NOT_FOUND');
    }
    
    if (user.emailVerified) {
      throw createError('Email already verified', 400, 'EMAIL_ALREADY_VERIFIED');
    }
    
    const verificationCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
    
    await prisma.userVerification.upsert({
      where: {
        userId_verificationType: {
          userId,
          verificationType: 'email'
        }
      },
      update: {
        verificationData: { code: verificationCode },
        expiresAt,
        verified: false
      },
      create: {
        userId,
        verificationType: 'email',
        verificationData: { code: verificationCode },
        expiresAt
      }
    });
    
    logger.info('Email verification code sent', { userId, email: user.email });
    
    return { message: 'Verification code sent to your email' };
  }
  
  async confirmEmailVerification(userId: string, code: string): Promise<{ message: string }> {
    const verification = await prisma.userVerification.findUnique({
      where: {
        userId_verificationType: {
          userId,
          verificationType: 'email'
        }
      }
    });
    
    if (!verification) {
      throw createError('Verification not found', 404, 'VERIFICATION_NOT_FOUND');
    }
    
    if (verification.verified) {
      throw createError('Email already verified', 400, 'EMAIL_ALREADY_VERIFIED');
    }
    
    if (verification.expiresAt && verification.expiresAt < new Date()) {
      throw createError('Verification code expired', 400, 'CODE_EXPIRED');
    }
    
    const verificationData = verification.verificationData as any;
    if (verificationData?.code !== code) {
      throw createError('Invalid verification code', 400, 'INVALID_CODE');
    }
    
    await prisma.$transaction([
      prisma.userVerification.update({
        where: {
          userId_verificationType: {
            userId,
            verificationType: 'email'
          }
        },
        data: {
          verified: true,
          verifiedAt: new Date()
        }
      }),
      prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true }
      })
    ]);
    
    logger.info('Email verification completed', { userId });
    
    return { message: 'Email verified successfully' };
  }
  
  async submitIdentityVerification(userId: string, documents: any): Promise<{ message: string }> {
    await prisma.userVerification.upsert({
      where: {
        userId_verificationType: {
          userId,
          verificationType: 'identity'
        }
      },
      update: {
        verificationData: documents,
        verified: false
      },
      create: {
        userId,
        verificationType: 'identity',
        verificationData: documents,
        verified: false
      }
    });
    
    logger.info('Identity verification submitted', { userId });
    
    return { message: 'Identity verification documents submitted for review' };
  }
  
  async getVerificationStatus(userId: string) {
    const verifications = await prisma.userVerification.findMany({
      where: { userId },
      select: {
        verificationType: true,
        verified: true,
        verifiedAt: true,
        expiresAt: true
      }
    });
    
    const status = {
      email: false,
      phone: false,
      identity: false,
      scammer_check: false,
      trust_score: 0
    };
    
    verifications.forEach(v => {
      if (v.verified && (!v.expiresAt || v.expiresAt > new Date())) {
        status[v.verificationType as keyof typeof status] = true;
      }
    });
    
    status.trust_score = this.calculateTrustScore(status);
    
    return {
      verifications: status,
      badges: this.getBadges(status)
    };
  }
  
  private calculateTrustScore(verifications: any): number {
    let score = 0;
    if (verifications.email) score += 25;
    if (verifications.phone) score += 25;
    if (verifications.identity) score += 40;
    if (verifications.scammer_check) score += 10;
    return score;
  }
  
  private getBadges(verifications: any): string[] {
    const badges: string[] = [];
    if (verifications.email) badges.push('email_verified');
    if (verifications.identity) badges.push('identity_verified');
    if (verifications.scammer_check) badges.push('not_scammer');
    if (verifications.trust_score >= 80) badges.push('trusted_user');
    return badges;
  }
}