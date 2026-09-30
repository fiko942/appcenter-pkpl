import { Router } from 'express';
import productRoutes from './productRoutes';
import deviceRoutes from './deviceRoutes';
import { invoiceController } from '../controllers/invoiceController';

const router = Router();

router.get('/', (req, res) => {
    res.json({ message: 'Welcome to AppCenterV2 API v1' });
});

// GoQRIS Status Polling Route
// router.get('/payment/goqris/status/:orderId', (req, res) => paymentNotificationController.checkGoqrisPaymentStatus(req, res));

// Invoice public APIs
router.get('/invoice/:token', (req, res) => invoiceController.getInvoiceDataByToken(req, res));
router.get('/invoice/:token/pdf', (req, res) => invoiceController.getInvoicePdfStream(req, res));
router.get('/invoice/:token/download', (req, res) => invoiceController.getInvoicePdfStream(req, res));

router.use('/products', productRoutes);
router.use('/device', deviceRoutes);

export default router;
