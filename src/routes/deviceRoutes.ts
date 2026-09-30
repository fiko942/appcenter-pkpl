import { Router } from 'express';
import { checkDeviceStatus, activateLicense } from '../controllers/deviceController';

const router = Router();

// Route: POST /api/v1/device/status
// Note: Client sends query params even with POST
router.post('/status', checkDeviceStatus);

// Route: POST /api/v1/device/activation
router.post('/activation', activateLicense);

export default router;
