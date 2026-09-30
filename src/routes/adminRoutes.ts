import { Router } from 'express';
import multer from 'multer';
import os from 'os';
import { adminController } from '../controllers/adminController';
import { adminAuthMiddleware } from '../middlewares/adminAuth';

const upload = multer({
    dest: os.tmpdir(),
    limits: {
        fileSize: 500 * 1024 * 1024 // 500 MB
    }
});

const router = Router();

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

// Public routes (no auth required)
router.get('/login', (req, res) => serveSpa(req, res));
router.post('/login', (req, res) => adminController.processLogin(req, res));
router.get('/api/login-status', (req, res) => adminController.apiGetLoginStatus(req, res));
router.get('/api/session', (req, res) => adminController.apiGetSession(req, res));
router.post('/api/forgot-pin/request-otp', (req, res) => adminController.apiForgotPinRequestOtp(req, res));
router.post('/api/forgot-pin/verify-otp', (req, res) => adminController.apiForgotPinVerifyOtp(req, res));
router.post('/api/forgot-pin/verify-username', (req, res) => adminController.apiForgotPinRequestOtp(req, res));
router.post('/api/forgot-pin/reset', (req, res) => adminController.apiProcessForgotPinReset(req, res));
router.all('/logout', (req, res) => adminController.logout(req, res));

// Webhook route (no auth, but token verified in controller)
router.post('/webhook', (req, res) => adminController.handleWebhook(req, res));

// Protected routes (auth required)
router.get('/dashboard', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/dashboard', adminAuthMiddleware, (req, res) => adminController.apiGetDashboard(req, res));

// Payments API & SSR
router.get('/payments', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/payments', adminAuthMiddleware, (req, res) => adminController.apiGetPayments(req, res));
router.get('/api/payments/detail', adminAuthMiddleware, (req, res) => adminController.apiGetPaymentDetail(req, res));
router.get('/api/payments/detail/:id', adminAuthMiddleware, (req, res) => adminController.apiGetPaymentDetail(req, res));
router.post('/payments/confirm/:id', adminAuthMiddleware, (req, res) => adminController.confirmPaymentManually(req, res));
router.post('/api/payments/confirm/:id', adminAuthMiddleware, (req, res) => adminController.confirmPaymentManually(req, res));
router.post('/payments/update-duration/:id', adminAuthMiddleware, (req, res) => adminController.updateOrderDuration(req, res));
router.post('/api/payments/update-duration/:id', adminAuthMiddleware, (req, res) => adminController.updateOrderDuration(req, res));
router.get('/payment/create', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.post('/payment/create', adminAuthMiddleware, (req, res) => adminController.processCreatePayment(req, res));
router.get('/payment/success', adminAuthMiddleware, (req, res) => serveSpa(req, res));

// Payment Gateway Settings (GoQRIS)
router.get('/api/settings/payment', adminAuthMiddleware, (req, res) => adminController.apiGetPaymentSettings(req, res));
router.post('/api/settings/payment', adminAuthMiddleware, (req, res) => adminController.apiSavePaymentSettings(req, res));

// SMTP & Email Settings
router.get('/api/settings/smtp', adminAuthMiddleware, (req, res) => adminController.apiGetSmtpSettings(req, res));
router.post('/api/settings/smtp', adminAuthMiddleware, (req, res) => adminController.apiSaveSmtpSettings(req, res));
router.post('/api/settings/smtp/test', adminAuthMiddleware, (req, res) => adminController.apiTestSmtpConnection(req, res));

// Trial Generation API & SSR
router.get('/trials/create', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/trials/products', adminAuthMiddleware, (req, res) => adminController.apiGetTrialProducts(req, res));
router.post('/trials/create', adminAuthMiddleware, (req, res) => adminController.processCreateTrial(req, res));
router.post('/api/trials/create', adminAuthMiddleware, (req, res) => adminController.processCreateTrial(req, res));
router.post('/api/trials/delete/:id', adminAuthMiddleware, (req, res) => adminController.processDeleteTrial(req, res));

// Product Management API & SSR
router.get('/products', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/products', adminAuthMiddleware, (req, res) => adminController.apiGetProducts(req, res));
router.post('/products/create', adminAuthMiddleware, (req, res) => adminController.processCreateProduct(req, res));
router.post('/api/products/create', adminAuthMiddleware, (req, res) => adminController.processCreateProduct(req, res));
router.post('/products/edit/:id', adminAuthMiddleware, (req, res) => adminController.processEditProduct(req, res));
router.post('/api/products/edit/:id', adminAuthMiddleware, (req, res) => adminController.processEditProduct(req, res));
router.post('/products/delete/:id', adminAuthMiddleware, (req, res) => adminController.processDeleteProduct(req, res));
router.post('/api/products/delete/:id', adminAuthMiddleware, (req, res) => adminController.processDeleteProduct(req, res));
router.post('/products/toggle-status/:id', adminAuthMiddleware, (req, res) => adminController.processToggleProductStatus(req, res));
router.post('/api/products/toggle-status/:id', adminAuthMiddleware, (req, res) => adminController.processToggleProductStatus(req, res));
router.post('/products/:id/upload-installer', adminAuthMiddleware, upload.any(), (req, res) => adminController.uploadProductInstaller(req, res));
router.post('/api/products/:id/upload-installer', adminAuthMiddleware, upload.any(), (req, res) => adminController.uploadProductInstaller(req, res));
router.post('/products/:id/upload-chunk', adminAuthMiddleware, upload.any(), (req, res) => adminController.uploadProductInstallerChunk(req, res));
router.post('/api/products/:id/upload-chunk', adminAuthMiddleware, upload.any(), (req, res) => adminController.uploadProductInstallerChunk(req, res));
router.post('/products/:id/upload-installer-chunk', adminAuthMiddleware, upload.any(), (req, res) => adminController.uploadProductInstallerChunk(req, res));
router.post('/api/products/:id/upload-installer-chunk', adminAuthMiddleware, upload.any(), (req, res) => adminController.uploadProductInstallerChunk(req, res));
router.post('/products/:id/delete-installer', adminAuthMiddleware, (req, res) => adminController.deleteProductInstaller(req, res));
router.post('/api/products/:id/delete-installer', adminAuthMiddleware, (req, res) => adminController.deleteProductInstaller(req, res));
router.post('/products/upload-image', adminAuthMiddleware, upload.single('image'), (req, res) => adminController.uploadProductImage(req, res));
router.post('/api/products/upload-image', adminAuthMiddleware, upload.single('image'), (req, res) => adminController.uploadProductImage(req, res));
router.post('/products/:id/upload-image', adminAuthMiddleware, upload.single('image'), (req, res) => adminController.uploadProductImage(req, res));
router.post('/api/products/:id/upload-image', adminAuthMiddleware, upload.single('image'), (req, res) => adminController.uploadProductImage(req, res));

// Categories Management API & SSR
router.get('/categories', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/categories', adminAuthMiddleware, (req, res) => adminController.apiGetCategories(req, res));
router.post('/categories/create', adminAuthMiddleware, (req, res) => adminController.processCreateCategory(req, res));
router.post('/api/categories/create', adminAuthMiddleware, (req, res) => adminController.processCreateCategory(req, res));
router.post('/categories/edit/:id', adminAuthMiddleware, (req, res) => adminController.processEditCategory(req, res));
router.post('/api/categories/edit/:id', adminAuthMiddleware, (req, res) => adminController.processEditCategory(req, res));
router.post('/categories/delete/:id', adminAuthMiddleware, (req, res) => adminController.processDeleteCategory(req, res));
router.post('/api/categories/delete/:id', adminAuthMiddleware, (req, res) => adminController.processDeleteCategory(req, res));
router.post('/categories/toggle-status/:id', adminAuthMiddleware, (req, res) => adminController.processToggleCategoryStatus(req, res));
router.post('/api/categories/toggle-status/:id', adminAuthMiddleware, (req, res) => adminController.processToggleCategoryStatus(req, res));
router.post('/categories/upload-icon', adminAuthMiddleware, upload.single('icon'), (req, res) => adminController.uploadCategoryIcon(req, res));
router.post('/api/categories/upload-icon', adminAuthMiddleware, upload.single('icon'), (req, res) => adminController.uploadCategoryIcon(req, res));
router.post('/categories/:id/upload-icon', adminAuthMiddleware, upload.single('icon'), (req, res) => adminController.uploadCategoryIcon(req, res));
router.post('/api/categories/:id/upload-icon', adminAuthMiddleware, upload.single('icon'), (req, res) => adminController.uploadCategoryIcon(req, res));

// Affiliate Management API & SSR
router.get('/affiliate/history', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/affiliate/payout-history', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/affiliate/history', adminAuthMiddleware, (req, res) => adminController.apiGetAffiliateHistory(req, res));
router.get('/api/affiliate/payout-history', adminAuthMiddleware, (req, res) => adminController.apiGetAffiliateHistory(req, res));
router.get('/affiliate', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/affiliate', adminAuthMiddleware, (req, res) => adminController.apiGetAffiliate(req, res));
router.post('/affiliate/mark-paid', adminAuthMiddleware, (req, res) => adminController.markAffiliateAsPaid(req, res));
router.post('/api/affiliate/mark-paid', adminAuthMiddleware, (req, res) => adminController.markAffiliateAsPaid(req, res));
router.post('/api/affiliate/update-bank', adminAuthMiddleware, (req, res) => adminController.apiUpdateAffiliateMemberBank(req, res));

// Admin Profile & Security API
router.get('/profile', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/profile', adminAuthMiddleware, (req, res) => adminController.apiGetProfile(req, res));
router.post('/api/profile/update-pin', adminAuthMiddleware, (req, res) => adminController.apiUpdatePin(req, res));
router.post('/api/profile/update-username', adminAuthMiddleware, (req, res) => adminController.apiUpdateUsername(req, res));

// Admin Multi-Account Management (Super Admin)
router.get('/api/admins', adminAuthMiddleware, (req, res) => adminController.apiGetAdmins(req, res));
router.post('/api/admins/create', adminAuthMiddleware, (req, res) => adminController.apiCreateAdmin(req, res));
router.post('/api/admins/delete/:id', adminAuthMiddleware, (req, res) => adminController.apiDeleteAdmin(req, res));
router.post('/api/admins/reset-pin/:id', adminAuthMiddleware, (req, res) => adminController.apiResetAdminPin(req, res));

// User Management API & Routes
router.get('/users', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/users', adminAuthMiddleware, (req, res) => adminController.apiGetUsers(req, res));
router.get('/api/users/:id', adminAuthMiddleware, (req, res) => adminController.apiGetUserDetail(req, res));
router.post('/api/users/:id/ban', adminAuthMiddleware, (req, res) => adminController.apiToggleUserBan(req, res));
router.post('/api/users/:id/verify', adminAuthMiddleware, (req, res) => adminController.apiToggleUserVerified(req, res));
router.post('/api/users/:id/reset-password', adminAuthMiddleware, (req, res) => adminController.apiResetUserPassword(req, res));
router.post('/api/users/:id/update', adminAuthMiddleware, (req, res) => adminController.apiUpdateUser(req, res));

// System Settings & Database Backup API & Routes
router.get('/settings', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/settings/backups', adminAuthMiddleware, (req, res) => adminController.apiGetBackups(req, res));
router.post('/api/settings/backup/create', adminAuthMiddleware, (req, res) => adminController.apiCreateBackup(req, res));
router.get('/api/settings/backup/status/:id', adminAuthMiddleware, (req, res) => adminController.apiGetBackupStatus(req, res));
router.get('/api/settings/backup/download/:id', adminAuthMiddleware, (req, res) => adminController.apiDownloadBackup(req, res));
router.post('/api/settings/backup/delete/:id', adminAuthMiddleware, (req, res) => adminController.apiDeleteBackup(req, res));

// OAuth 2.0 Clients & SSO Management API & Routes
router.get('/oauth-clients', adminAuthMiddleware, (req, res) => serveSpa(req, res));
router.get('/api/oauth-clients', adminAuthMiddleware, (req, res) => adminController.apiGetOAuthClients(req, res));
router.post('/api/oauth-clients', adminAuthMiddleware, (req, res) => adminController.apiCreateOAuthClient(req, res));
router.put('/api/oauth-clients/:id', adminAuthMiddleware, (req, res) => adminController.apiUpdateOAuthClient(req, res));
router.post('/api/oauth-clients/:id', adminAuthMiddleware, (req, res) => adminController.apiUpdateOAuthClient(req, res));
router.post('/api/oauth-clients/:id/reset-secret', adminAuthMiddleware, (req, res) => adminController.apiResetOAuthClientSecret(req, res));
router.delete('/api/oauth-clients/:id', adminAuthMiddleware, (req, res) => adminController.apiDeleteOAuthClient(req, res));
router.post('/api/oauth-clients/:id/delete', adminAuthMiddleware, (req, res) => adminController.apiDeleteOAuthClient(req, res));

// Default redirect
router.get('/', (req, res) => serveSpa(req, res));

export default router;


