import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  sendEmailVerification,
  confirmEmailVerification,
  submitIdentityVerification,
  getVerificationStatus
} from '../controllers/verificationController';

export const verificationRoutes = Router();

verificationRoutes.use(requireAuth);

verificationRoutes.post('/email', sendEmailVerification);
verificationRoutes.post('/email/confirm', confirmEmailVerification);
verificationRoutes.post('/identity', submitIdentityVerification);
verificationRoutes.get('/status', getVerificationStatus);