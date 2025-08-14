import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getPermissions,
  updatePermissions,
  revokePermissions,
  exportData,
  deleteAllData,
  getPrivacySettings,
  updatePrivacySettings
} from '../controllers/privacyController';

export const privacyRoutes = Router();

privacyRoutes.use(requireAuth);

privacyRoutes.get('/permissions', getPermissions);
privacyRoutes.put('/permissions/:clientId', updatePermissions);
privacyRoutes.delete('/permissions/:clientId', revokePermissions);
privacyRoutes.get('/export', exportData);
privacyRoutes.delete('/delete-all', deleteAllData);
privacyRoutes.get('/settings', getPrivacySettings);
privacyRoutes.put('/settings', updatePrivacySettings);