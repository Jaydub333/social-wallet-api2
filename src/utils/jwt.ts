import jwt from 'jsonwebtoken';
import { createError } from '../middleware/errorHandler';

export interface JwtPayload {
  userId: string;
  email: string;
  type: 'access' | 'refresh';
}

export const generateAccessToken = (payload: Omit<JwtPayload, 'type'>): string => {
  return jwt.sign(
    { ...payload, type: 'access' },
    process.env.JWT_SECRET!,
    { expiresIn: process.env.JWT_EXPIRES_IN || '1h' }
  );
};

export const generateRefreshToken = (payload: Omit<JwtPayload, 'type'>): string => {
  return jwt.sign(
    { ...payload, type: 'refresh' },
    process.env.REFRESH_TOKEN_SECRET!,
    { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '30d' }
  );
};

export const verifyToken = (token: string, type: 'access' | 'refresh' = 'access'): JwtPayload => {
  try {
    const secret = type === 'access' ? process.env.JWT_SECRET! : process.env.REFRESH_TOKEN_SECRET!;
    const decoded = jwt.verify(token, secret) as JwtPayload;
    
    if (decoded.type !== type) {
      throw createError('Invalid token type', 401, 'INVALID_TOKEN');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw createError('Invalid token', 401, 'INVALID_TOKEN');
    }
    if (error instanceof jwt.TokenExpiredError) {
      throw createError('Token expired', 401, 'TOKEN_EXPIRED');
    }
    throw error;
  }
};