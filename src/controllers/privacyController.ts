import { Response, NextFunction } from 'express';
import { PrivacyService } from '../services/privacyService';
import { AuthenticatedRequest } from '../middleware/auth';
import { asyncHandler, createError } from '../middleware/errorHandler';

const privacyService = new PrivacyService();

export const getPermissions = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const permissions = await privacyService.getUserPermissions(userId);
  
  res.json({
    success: true,
    data: {
      permissions
    }
  });
});

export const updatePermissions = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const clientId = req.params.clientId;
  const { allowed_fields, expires_at } = req.body;
  
  if (!allowed_fields || !Array.isArray(allowed_fields)) {
    throw createError('allowed_fields must be an array', 400, 'INVALID_FIELDS');
  }
  
  let expiresAt: Date | undefined;
  if (expires_at) {
    expiresAt = new Date(expires_at);
    if (isNaN(expiresAt.getTime())) {
      throw createError('Invalid expires_at date format', 400, 'INVALID_DATE');
    }
    if (expiresAt <= new Date()) {
      throw createError('expires_at must be in the future', 400, 'PAST_DATE');
    }
  }
  
  const result = await privacyService.updatePermissions(userId, clientId, {
    allowedFields: allowed_fields,
    expiresAt
  });
  
  res.json({
    success: true,
    data: result
  });
});

export const revokePermissions = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const clientId = req.params.clientId;
  
  const result = await privacyService.revokePermissions(userId, clientId);
  
  res.json({
    success: true,
    data: result
  });
});

export const exportData = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const exportData = await privacyService.getDataExport(userId);
  
  res.json({
    success: true,
    data: exportData
  });
});

export const deleteAllData = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const { confirmation } = req.body;
  
  if (confirmation !== 'DELETE_ALL_MY_DATA') {
    throw createError(
      'Confirmation text must be exactly: DELETE_ALL_MY_DATA', 
      400, 
      'INVALID_CONFIRMATION'
    );
  }
  
  const result = await privacyService.deleteAllUserData(userId);
  
  res.json({
    success: true,
    data: result
  });
});

export const getPrivacySettings = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const settings = await privacyService.getPrivacySettings(userId);
  
  res.json({
    success: true,
    data: settings
  });
});

export const updatePrivacySettings = asyncHandler(async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const userId = req.user!.id;
  const settings = req.body;
  
  // Validate settings
  if (settings.dataRetentionDays && (settings.dataRetentionDays < 30 || settings.dataRetentionDays > 2555)) {
    throw createError('Data retention must be between 30 and 2555 days', 400, 'INVALID_RETENTION');
  }
  
  const result = await privacyService.updatePrivacySettings(userId, settings);
  
  res.json({
    success: true,
    data: result
  });
});