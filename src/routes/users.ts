import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { validateRequest, updateProfileSchema } from '../utils/validation';
import { 
  getMe, 
  updateProfile, 
  getMedia, 
  uploadMedia, 
  deleteMedia, 
  deactivateAccount 
} from '../controllers/userController';

export const userRoutes = Router();

userRoutes.use(requireAuth);

userRoutes.get('/me', getMe);
userRoutes.put('/me/profile', validateRequest(updateProfileSchema), updateProfile);
userRoutes.get('/me/media', getMedia);
userRoutes.post('/me/media', uploadMedia);
userRoutes.delete('/me/media/:mediaId', deleteMedia);
userRoutes.delete('/me/account', deactivateAccount);