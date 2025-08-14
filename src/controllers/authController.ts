import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/authService';
import { asyncHandler } from '../middleware/errorHandler';

const authService = new AuthService();

export const register = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await authService.register(req.body);
  
  res.status(201).json({
    success: true,
    data: result
  });
});

export const login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const result = await authService.login(req.body);
  
  res.json({
    success: true,
    data: result
  });
});

export const refresh = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const { refreshToken } = req.body;
  
  if (!refreshToken) {
    return res.status(400).json({
      error: {
        code: 'MISSING_REFRESH_TOKEN',
        message: 'Refresh token is required'
      }
    });
  }
  
  const result = await authService.refreshToken(refreshToken);
  
  res.json({
    success: true,
    data: result
  });
});

export const logout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  res.json({
    success: true,
    message: 'Logged out successfully'
  });
});