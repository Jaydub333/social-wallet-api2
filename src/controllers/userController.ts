import { Response, NextFunction } from 'express';
import { UserService } from '../services/userService';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler } from '../middleware/errorHandler';

const userService = new UserService();

export const getMe = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const profile = await userService.getUserProfile(userId);
  
  res.json({
    success: true,
    data: profile
  });
});

export const updateProfile = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const profile = await userService.updateProfile(userId, req.body);
  
  res.json({
    success: true,
    data: profile
  });
});

export const getMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = parseInt(req.query.offset as string) || 0;
  
  const result = await userService.getUserMedia(userId, limit, offset);
  
  res.json({
    success: true,
    data: result
  });
});

export const uploadMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  res.status(501).json({
    error: {
      code: 'NOT_IMPLEMENTED',
      message: 'Media upload functionality will be implemented with S3 integration'
    }
  });
});

export const deleteMedia = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const mediaId = req.params.mediaId;
  
  await userService.deleteMediaAsset(userId, mediaId);
  
  res.json({
    success: true,
    message: 'Media asset deleted successfully'
  });
});

export const deactivateAccount = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  await userService.deactivateAccount(userId);
  
  res.json({
    success: true,
    message: 'Account deactivated successfully'
  });
});