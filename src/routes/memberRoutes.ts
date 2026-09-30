import { Router } from 'express';
import { memberController } from '../controllers/memberController';
import { invoiceController } from '../controllers/invoiceController';

const router = Router();

// Login
router.get('/login', (req, res) => serveSpa(req, res));
router.post('/login', (req, res) => memberController.processLogin(req, res));

// Register
router.get('/register', (req, res) => serveSpa(req, res));
router.post('/register', (req, res) => memberController.processRegister(req, res));

// Forgot Password & OTP APIs
router.get('/forgot-password', (req, res) => serveSpa(req, res));
router.post('/api/register/send-otp', (req, res) => memberController.apiSendRegisterOtp(req, res));
router.post('/api/register/verify-otp', (req, res) => memberController.apiVerifyRegisterOtp(req, res));
router.post('/api/forgot-password/send-otp', (req, res) => memberController.apiSendForgotPasswordOtp(req, res));
router.post('/api/forgot-password/reset', (req, res) => memberController.apiResetPassword(req, res));

// JSON REST APIs for Svelte Frontend
router.get('/api/public-stats', (req, res) => memberController.apiGetPublicStats(req, res));
router.get('/api/session', (req, res) => memberController.apiGetSession(req, res));
router.get('/api/dashboard', (req, res) => memberController.apiGetDashboard(req, res));
router.get('/api/tutorials', (req, res) => memberController.apiGetTutorials(req, res));
router.get('/api/tutorials/:productId', (req, res) => memberController.apiGetProductTutorial(req, res));
router.get('/api/downloads', (req, res) => memberController.apiGetDownloads(req, res));
router.get('/api/products', (req, res) => memberController.apiGetProducts(req, res));
router.get('/api/orders', (req, res) => memberController.apiGetOrders(req, res));
router.get('/api/orders/:orderId/licenses', (req, res) => memberController.apiGetOrderLicenses(req, res));
router.get('/api/invoices', (req, res) => invoiceController.getMemberInvoices(req, res));
router.get('/api/licenses', (req, res) => memberController.apiGetLicenses(req, res));
router.get('/api/licenses/hwid-status', (req, res) => memberController.apiGetHwidStatus(req, res));
router.post('/api/licenses/update-hwid', (req, res) => memberController.apiUpdateMachineId(req, res));
router.get('/api/profile', (req, res) => memberController.apiGetProfile(req, res));
router.post('/api/profile', (req, res) => memberController.apiUpdateProfile(req, res));
router.post('/api/change-password', (req, res) => memberController.apiChangePassword(req, res));
router.post('/api/check-voucher', (req, res) => memberController.apiCheckVoucher(req, res));
router.get('/api/affiliate', (req, res) => memberController.apiGetAffiliate(req, res));
router.post('/api/affiliate/join', (req, res) => memberController.apiJoinAffiliate(req, res));
router.post('/api/affiliate/update-payout', (req, res) => memberController.apiUpdateAffiliatePayout(req, res));
router.post('/api/affiliate/update-coupon', (req, res) => memberController.apiUpdateAffiliateCoupon(req, res));
router.get('/api/affiliate/payouts', (req, res) => memberController.apiGetAffiliatePayouts(req, res));

import path from 'path';
import fs from 'fs';

function serveSpa(req: any, res: any) {
    const distPath = path.join(__dirname, '../client_dist/index.html');
    const localDistPath = path.join(__dirname, '../../client/dist/index.html');
    if (fs.existsSync(distPath)) {
        return res.sendFile(distPath);
    }
    if (fs.existsSync(localDistPath)) {
        return res.sendFile(localDistPath);
    }
    return res.status(404).send('SPA index.html not found');
}

// Dashboard & HTML Views - Serve Svelte SPA
router.get('/dashboard', (req, res) => serveSpa(req, res));
router.get('/tutorials', (req, res) => serveSpa(req, res));
router.get('/downloads', (req, res) => serveSpa(req, res));
router.get('/orders/create', (req, res) => serveSpa(req, res));
router.post('/orders/create', (req, res) => memberController.processCreateOrder(req, res));
router.get('/orders', (req, res) => serveSpa(req, res));
// Licenses & Device Management
router.get('/licenses', (req, res) => serveSpa(req, res));
router.get('/affiliate', (req, res) => serveSpa(req, res));
router.post('/affiliate/join', (req, res) => memberController.processJoinAffiliate(req, res));
router.get('/affiliate/payouts', (req, res) => serveSpa(req, res));
router.post('/affiliate/update-payout', (req, res) => memberController.updateAffiliateProfile(req, res));
router.post('/affiliate/update-coupon', (req, res) => memberController.updateAffiliateCoupon(req, res));
router.get('/device/:deviceId/edit-machine', (req, res) => memberController.showEditMachine(req, res));
router.post('/device/:deviceId/edit-machine', (req, res) => memberController.processEditMachine(req, res));

router.get('/profile', (req, res) => serveSpa(req, res));
router.post('/change-password', (req, res) => memberController.processChangePassword(req, res));

// Payment action for order
router.get('/orders/:orderId/pay', (req, res) => memberController.payOrder(req, res));

// Logout
router.all('/logout', (req, res) => memberController.logout(req, res));

// Redirect root to dashboard or login
router.get('/', (req, res) => {
    serveSpa(req, res);
});

export default router;
