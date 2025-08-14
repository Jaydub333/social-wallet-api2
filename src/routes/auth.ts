import { Router } from 'express';
import { register, login, refresh, logout } from '../controllers/authController';
import { validateRequest, registerSchema, loginSchema } from '../utils/validation';

export const authRoutes = Router();

authRoutes.post('/register', validateRequest(registerSchema), register);
authRoutes.post('/login', validateRequest(loginSchema), login);
authRoutes.post('/refresh', refresh);
authRoutes.post('/logout', logout);