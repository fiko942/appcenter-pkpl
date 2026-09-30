import { Router } from 'express';
import { adminController } from '../controllers/adminController';
import { paymentNotificationController } from '../controllers/paymentNotificationController';

const router = Router();

// Handle Xendit Redirect (GET) - Payment Success Page
router.get('/success', (req, res) => adminController.showPublicPaymentSuccess(req, res));

// Handle Xendit Webhook (POST) - Payment Status Update
router.post('/success', (req, res) => adminController.handleWebhook(req, res));

// Handle GoQRIS Webhook (POST) - Callback Notification Update (support both /notification and /webhook/goqris)
router.post('/notification', (req, res) => paymentNotificationController.handleGoqrisWebhook(req, res));
router.post('/webhook/goqris', (req, res) => paymentNotificationController.handleGoqrisWebhook(req, res));

// Handle GoQRIS Status Polling (GET) - Payment Status Check
router.get('/goqris/status/:orderId', (req, res) => paymentNotificationController.checkGoqrisPaymentStatus(req, res));

export default router;
