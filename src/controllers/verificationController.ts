import { Response, NextFunction } from 'express';
import { VerificationService } from '../services/verificationService';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const verificationService = new VerificationService();

export const sendEmailVerification = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const result = await verificationService.sendEmailVerification(userId);
  
  res.json({
    success: true,
    data: result
  });
});

export const confirmEmailVerification = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({
      error: {
        code: 'MISSING_CODE',
        message: 'Verification code is required'
      }
    });
  }
  
  const result = await verificationService.confirmEmailVerification(userId, code);
  
  res.json({
    success: true,
    data: result
  });
});

export const submitIdentityVerification = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const documents = req.body;
  
  const result = await verificationService.submitIdentityVerification(userId, documents);
  
  res.json({
    success: true,
    data: result
  });
});

export const getVerificationStatus = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const result = await verificationService.getVerificationStatus(userId);
  
  res.json({
    success: true,
    data: result
  });
});