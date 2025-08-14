import { PrismaClient } from '@prisma/client';
import { hashPassword, comparePassword, validatePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface RegisterData {
  email: string;
  password: string;
  username?: string;
}

export interface LoginData {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: {
    id: string;
    email: string;
    username: string | null;
    emailVerified: boolean;
  };
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  async register(data: RegisterData): Promise<AuthResponse> {
    const { email, password, username } = data;
    
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      throw createError(
        'Password does not meet requirements',
        400,
        'INVALID_PASSWORD',
        { errors: passwordValidation.errors }
      );
    }
    
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email },
          ...(username ? [{ username }] : [])
        ]
      }
    });
    
    if (existingUser) {
      if (existingUser.email === email) {
        throw createError('Email already registered', 409, 'EMAIL_EXISTS');
      }
      if (existingUser.username === username) {
        throw createError('Username already taken', 409, 'USERNAME_EXISTS');
      }
    }
    
    const passwordHash = await hashPassword(password);
    
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        username,
        profile: {
          create: {}
        }
      },
      select: {
        id: true,
        email: true,
        username: true,
        emailVerified: true
      }
    });
    
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email
    });
    
    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email
    });
    
    logger.info('User registered successfully', { userId: user.id, email: user.email });
    
    return {
      user,
      accessToken,
      refreshToken
    };
  }
  
  async login(data: LoginData): Promise<AuthResponse> {
    const { email, password } = data;
    
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        username: true,
        passwordHash: true,
        emailVerified: true,
        isActive: true
      }
    });
    
    if (!user) {
      throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    
    if (!user.isActive) {
      throw createError('Account is deactivated', 401, 'ACCOUNT_DEACTIVATED');
    }
    
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      throw createError('Invalid email or password', 401, 'INVALID_CREDENTIALS');
    }
    
    const accessToken = generateAccessToken({
      userId: user.id,
      email: user.email
    });
    
    const refreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email
    });
    
    logger.info('User logged in successfully', { userId: user.id, email: user.email });
    
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        emailVerified: user.emailVerified
      },
      accessToken,
      refreshToken
    };
  }
  
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    const decoded = verifyToken(refreshToken, 'refresh');
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, isActive: true }
    });
    
    if (!user || !user.isActive) {
      throw createError('Invalid refresh token', 401, 'INVALID_REFRESH_TOKEN');
    }
    
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email
    });
    
    const newRefreshToken = generateRefreshToken({
      userId: user.id,
      email: user.email
    });
    
    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  }
}