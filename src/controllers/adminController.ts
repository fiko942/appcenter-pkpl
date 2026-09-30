import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { adminPayoutHistoryPage } from '../views/admin-payout-history';
import { loginPage } from '../views/login';
import { dashboardPage } from '../views/dashboard';
import { createPaymentPage } from '../views/payment-create';
import { createTrialPage } from '../views/admin-create-trial';
import { createGoqrisOrder, getGoqrisConfig } from '../services/goqrisService';
import { ensureOrderInvoiceToken } from '../utils/invoiceToken';
import { sanitizeTutorials, expandTutorialsWithPlaylists } from '../utils/youtube';
import { sftpService, ProductInstallerFiles } from '../services/sftpService';
import { BackupService } from '../services/backupService';
import { adminRateLimiter } from '../services/adminRateLimiter';
import { securityRateLimiter } from '../services/securityRateLimiter';
import { getSmtpConfig, testSmtpConnection, SmtpConfig, sendEmail, getAdminResetPinOtpTemplate } from '../services/emailService';
import OAuthService from '../services/oauthService';
import { getClientIp } from '../utils/ipHelper';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import os from 'os';

interface AdminOtpSession {
    adminId: number;
    username: string;
    otp: string;
    expiresAt: number;
    verified: boolean;
    resetToken?: string;
    resetTokenExpiresAt?: number;
    attempts: number;
}

const adminOtpStore = new Map<string, AdminOtpSession>();

export function sanitizeProductImage(img?: string | null): string | null {
    if (!img || typeof img !== 'string') return null;
    const trimmed = img.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/favicon') || trimmed.startsWith('data:image/')) {
        return trimmed;
    }
    return null;
}

export class AdminController {
    /**
     * Show login page (redirects to Svelte SPA for browser or serves SSR fallback)
     */
    async showLogin(req: Request, res: Response) {
        // If already logged in, redirect to dashboard
        if (req.session && req.session.isAuthenticated) {
            return res.redirect('/admin/dashboard');
        }

        // If client accepts HTML, redirect to SPA hash route
        if (req.headers.accept && req.headers.accept.includes('text/html')) {
            return res.redirect('/#/admin/login');
        }

        const error = req.query.error as string | undefined;
        res.send(loginPage(error));
        await Promise.resolve();
    }

    /**
     * Check Admin Session API
     */
    async apiGetSession(req: Request, res: Response) {
        try {
            if (req.session && req.session.isAuthenticated) {
                res.json({
                    authenticated: true,
                    admin: {
                        id: req.session.adminId,
                        username: req.session.adminName
                    }
                });
                return;
            }
            res.json({ authenticated: false });
        } catch (error) {
            console.error('Admin session check error:', error);
            res.status(500).json({ authenticated: false, error: 'Session check failed' });
        }
        await Promise.resolve();
    }

    /**
     * Check Admin Login Rate Limit Status API
     */
    async apiGetLoginStatus(req: Request, res: Response) {
        try {
            const cleanIp = this.getCleanClientIp(req);
            const statusCheckKey = `login-status:${cleanIp}`;
            const statusLimit = securityRateLimiter.check(statusCheckKey, 60, 60 * 1000);
            if (statusLimit.isLocked) {
                return res.status(429).json({
                    success: false,
                    isLocked: true,
                    remainingSeconds: statusLimit.remainingSeconds,
                    attemptsLeft: 0,
                    message: 'Terlalu banyak permintaan cek status. Silakan tunggu.'
                });
            }
            securityRateLimiter.recordFailure(statusCheckKey, 60, 60 * 1000);

            const status = adminRateLimiter.check(cleanIp);
            res.json({ success: true, ...status });
        } catch (error) {
            console.error('Check login status error:', error);
            res.status(500).json({ success: false, isLocked: false, remainingSeconds: 0, attemptsLeft: 3 });
        }
        await Promise.resolve();
    }

    /**
     * Process login with 3-attempt limit and 2-hour lockout (7200s)
     */
    async processLogin(req: Request, res: Response) {
        try {
            const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
            const cleanIp = this.getCleanClientIp(req);

            // Step 1: Check if currently locked out
            const checkStatus = adminRateLimiter.check(cleanIp);
            if (checkStatus.isLocked) {
                if (isJson) {
                    return res.status(429).json({
                        status: 'error',
                        message: checkStatus.message || 'Percobaan login Anda diblokir selama 2 jam.',
                        isLocked: true,
                        remainingSeconds: checkStatus.remainingSeconds,
                        lockoutMinutes: checkStatus.lockoutMinutes,
                        attemptsLeft: 0
                    });
                }
                return res.redirect(`/admin/login?error=${encodeURIComponent(checkStatus.message || 'Percobaan login Anda diblokir.')}`);
            }

            const body = req.body as { pin?: string };
            const { pin } = body;

            // Step 2: Validate PIN format
            if (!pin || pin.length !== 6 || !/^\d{6}$/.test(pin)) {
                const fail = adminRateLimiter.recordFailure(cleanIp);
                if (isJson) {
                    return res.status(fail.isLocked ? 429 : 400).json({
                        status: 'error',
                        message: fail.isLocked ? fail.message : (fail.message || 'PIN harus 6 digit angka'),
                        isLocked: fail.isLocked,
                        remainingSeconds: fail.remainingSeconds,
                        lockoutMinutes: fail.lockoutMinutes,
                        attemptsLeft: fail.attemptsLeft
                    });
                }
                return res.redirect(`/admin/login?error=${encodeURIComponent(fail.isLocked ? (fail.message || 'Akses dibatasi') : 'PIN harus 6 digit')}`);
            }

            // Step 3: Find admin with matching PIN
            const admin = await prisma.admin.findFirst({
                where: { pin: pin },
            });

            if (!admin) {
                const fail = adminRateLimiter.recordFailure(cleanIp);
                if (isJson) {
                    return res.status(fail.isLocked ? 429 : 401).json({
                        status: 'error',
                        message: fail.message || 'PIN tidak valid',
                        isLocked: fail.isLocked,
                        remainingSeconds: fail.remainingSeconds,
                        lockoutMinutes: fail.lockoutMinutes,
                        attemptsLeft: fail.attemptsLeft
                    });
                }
                return res.redirect(`/admin/login?error=${encodeURIComponent(fail.message || 'PIN tidak valid')}`);
            }

            // Step 4: Login Successful - Clear rate limit record
            adminRateLimiter.recordSuccess(cleanIp);

            await prisma.admin.update({
                where: { id: admin.id },
                data: { ip: cleanIp }
            });

            // Set session
            req.session.adminId = admin.id;
            req.session.adminName = admin.username;
            req.session.isAuthenticated = true;

            if (isJson) {
                return res.json({
                    status: 'success',
                    message: 'Login berhasil',
                    redirect: '/admin/dashboard',
                    admin: {
                        id: admin.id,
                        username: admin.username
                    }
                });
            }

            res.redirect('/admin/dashboard');
        } catch (error) {
            console.error('Login error:', error);
            const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
            if (isJson) return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem' });
            res.redirect('/admin/login?error=Terjadi kesalahan sistem');
        }
    }

    /**
     * Logout
     */
    async logout(req: Request, res: Response) {
        req.session.destroy((err) => {
            if (err) {
                console.error('Logout error:', err);
            }
            res.redirect('/admin/login');
        });
        await Promise.resolve();
    }

    /**
     * Request OTP for Forgot PIN Reset (Public with strict Rate Limiting)
     */
    async apiForgotPinRequestOtp(req: Request, res: Response) {
        try {
            const cleanIp = this.getCleanClientIp(req);
            
            // Check unified IP lockout
            const ipLock = securityRateLimiter.check(`forgot-pin-lockout:${cleanIp}`, 3, 15 * 60 * 1000);
            if (ipLock.isLocked) {
                return res.status(429).json({
                    success: false,
                    isLocked: true,
                    remainingSeconds: ipLock.remainingSeconds,
                    error: `Batas percobaan tercapai (3x). Akses dibatasi selama 15 menit. Anda tidak dapat meminta atau mengirim ulang kode OTP selama masa tunggu.`
                });
            }

            const { username } = req.body as { username?: string };
            if (!username || !username.trim()) {
                const fail = securityRateLimiter.recordFailure(`forgot-pin-lockout:${cleanIp}`, 3, 15 * 60 * 1000);
                return res.status(fail.isLocked ? 429 : 400).json({
                    success: false,
                    isLocked: fail.isLocked,
                    remainingSeconds: fail.remainingSeconds,
                    error: fail.isLocked
                        ? 'Batas percobaan tercapai (3x). Akses dibatasi selama 15 menit.'
                        : 'Username administrator wajib diisi'
                });
            }

            const trimmed = username.trim();
            const trimmedLower = trimmed.toLowerCase();

            // Check account-level lockout
            const accountLock = securityRateLimiter.check(`forgot-pin-admin-lock:${trimmedLower}`, 3, 15 * 60 * 1000);
            if (accountLock.isLocked) {
                return res.status(429).json({
                    success: false,
                    isLocked: true,
                    remainingSeconds: accountLock.remainingSeconds,
                    error: `Akses untuk akun administrator "${trimmed}" sedang dibatasi selama 15 menit karena terlalu banyak percobaan OTP yang salah.`
                });
            }

            const admin = await prisma.admin.findFirst({
                where: { username: trimmed }
            });

            if (!admin) {
                const fail = securityRateLimiter.recordFailure(`forgot-pin-lockout:${cleanIp}`, 3, 15 * 60 * 1000);
                return res.status(fail.isLocked ? 429 : 404).json({
                    success: false,
                    isLocked: fail.isLocked,
                    remainingSeconds: fail.remainingSeconds,
                    error: fail.isLocked
                        ? 'Batas percobaan tercapai (3x). Akses dibatasi selama 15 menit.'
                        : `Username administrator tidak terdaftar. Sisa kesempatan: ${fail.attemptsLeft}x.`
                });
            }

            // Lookup registered admin email
            let targetEmail = admin.email;
            if (!targetEmail) {
                const userMatch = await prisma.user.findFirst({
                    where: { name: admin.username }
                });
                targetEmail = userMatch?.email || null;
            }

            if (!targetEmail) {
                return res.status(400).json({
                    success: false,
                    error: 'Akun administrator ini belum memiliki email terdaftar untuk verifikasi OTP. Silakan hubungi Super Admin.'
                });
            }

            // Generate 6-digit numerical OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiresAt = Date.now() + (10 * 60 * 1000); // 10 minutes expiry

            // Store in session cache
            adminOtpStore.set(admin.username.toLowerCase(), {
                adminId: admin.id,
                username: admin.username,
                otp,
                expiresAt,
                verified: false,
                attempts: 0
            });

            console.log(`[AdminForgotPin] Generated OTP for administrator "${admin.username}": [${otp}]`);

            // Dispatch OTP email via SMTP
            try {
                await sendEmail({
                    to: targetEmail,
                    subject: `Kode Verifikasi Reset PIN Admin [${otp}] - AppCenter`,
                    html: getAdminResetPinOtpTemplate(admin.username, otp, 10)
                });
            } catch (mailErr: any) {
                console.error('[AdminForgotPin] Email dispatch error:', mailErr);
                return res.status(500).json({
                    success: false,
                    error: `Gagal mengirim email OTP: ${mailErr?.message || 'Layanan SMTP tidak merespons'}. Pastikan konfigurasi SMTP telah aktif.`
                });
            }

            return res.json({
                success: true,
                message: 'Kode OTP keamanan telah dikirim ke email terdaftar untuk administrator tersebut. Silakan periksa kotak masuk email Anda.',
                step: 2,
                cooldownSeconds: 60
            });
        } catch (error) {
            console.error('Error requesting forgot pin OTP:', error);
            return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat memproses permintaan OTP' });
        }
    }

    /**
     * Verify OTP for Forgot PIN Reset (Public with strict Rate Limiting)
     */
    async apiForgotPinVerifyOtp(req: Request, res: Response) {
        try {
            const cleanIp = this.getCleanClientIp(req);
            
            // 1. Check IP lockout
            const ipLock = securityRateLimiter.check(`forgot-pin-lockout:${cleanIp}`, 3, 15 * 60 * 1000);
            if (ipLock.isLocked) {
                return res.status(429).json({
                    success: false,
                    isLocked: true,
                    remainingSeconds: ipLock.remainingSeconds,
                    error: `Batas percobaan tercapai (3x). Akses dibatasi selama 15 menit. Anda tidak dapat melakukan verifikasi kode OTP selama masa tunggu.`
                });
            }

            const { username, otp } = req.body as { username?: string; otp?: string };
            if (!username || !username.trim() || !otp || !otp.trim()) {
                return res.status(400).json({ success: false, error: 'Username dan kode OTP wajib diisi' });
            }

            const trimmedUsername = username.trim().toLowerCase();

            // 2. Check Account lockout
            const accountLock = securityRateLimiter.check(`forgot-pin-admin-lock:${trimmedUsername}`, 3, 15 * 60 * 1000);
            if (accountLock.isLocked) {
                return res.status(429).json({
                    success: false,
                    isLocked: true,
                    remainingSeconds: accountLock.remainingSeconds,
                    error: `Akses untuk akun administrator ini sedang dibatasi selama 15 menit karena terlalu banyak percobaan OTP yang salah.`
                });
            }

            const session = adminOtpStore.get(trimmedUsername);

            if (!session || Date.now() > session.expiresAt) {
                return res.status(400).json({
                    success: false,
                    error: 'Sesi permintaan OTP tidak ditemukan atau telah kedaluwarsa. Silakan minta kode OTP baru.'
                });
            }

            if (session.otp !== otp.trim()) {
                session.attempts += 1;
                // Record failure on BOTH IP and Account
                const ipFail = securityRateLimiter.recordFailure(`forgot-pin-lockout:${cleanIp}`, 3, 15 * 60 * 1000);
                const accountFail = securityRateLimiter.recordFailure(`forgot-pin-admin-lock:${trimmedUsername}`, 3, 15 * 60 * 1000);
                
                const isLocked = ipFail.isLocked || accountFail.isLocked;
                const remainingSeconds = Math.max(ipFail.remainingSeconds, accountFail.remainingSeconds);

                if (isLocked) {
                    // Invalidate active OTP session immediately
                    adminOtpStore.delete(trimmedUsername);
                    return res.status(429).json({
                        success: false,
                        isLocked: true,
                        remainingSeconds,
                        error: `Batas percobaan tercapai (3x). Akses dibatasi selama 15 menit.`
                    });
                }

                return res.status(400).json({
                    success: false,
                    isLocked: false,
                    attemptsLeft: ipFail.attemptsLeft,
                    error: `Kode OTP salah. Sisa kesempatan: ${ipFail.attemptsLeft}x sebelum akses dibatasi selama 15 menit.`
                });
            }

            // OTP is valid - generate one-time reset token valid for 10 minutes
            const resetToken = crypto.randomBytes(32).toString('hex');
            session.verified = true;
            session.resetToken = resetToken;
            session.resetTokenExpiresAt = Date.now() + (10 * 60 * 1000);

            // Clear verify failure counter
            securityRateLimiter.clear(`forgot-pin-lockout:${cleanIp}`);
            securityRateLimiter.clear(`forgot-pin-admin-lock:${trimmedUsername}`);

            return res.json({
                success: true,
                message: 'Kode OTP berhasil diverifikasi! Silakan tentukan PIN 6-digit baru.',
                resetToken,
                step: 3
            });
        } catch (error) {
            console.error('Error verifying forgot pin OTP:', error);
            return res.status(500).json({ success: false, error: 'Terjadi kesalahan sistem saat memverifikasi kode OTP' });
        }
        await Promise.resolve();
    }

    /**
     * Verify Admin Username (Legacy / Step 1 alias)
     */
    async apiVerifyForgotPinUsername(req: Request, res: Response) {
        return this.apiForgotPinRequestOtp(req, res);
    }

    /**
     * Process Admin Forgot PIN Reset (Requires Verified OTP Reset Token)
     */
    async apiProcessForgotPinReset(req: Request, res: Response) {
        try {
            const cleanIp = this.getCleanClientIp(req);
            const rateKey = `forgot-pin-reset:${cleanIp}`;
            const rateCheck = securityRateLimiter.check(rateKey, 3, 15 * 60 * 1000);
            if (rateCheck.isLocked) {
                return res.status(429).json({
                    success: false,
                    isLocked: true,
                    remainingSeconds: rateCheck.remainingSeconds,
                    error: rateCheck.message || 'Terlalu banyak percobaan reset PIN. Akses dibatasi selama 15 menit.'
                });
            }

            const { username, resetToken, newPin, confirmPin } = req.body as {
                username?: string;
                resetToken?: string;
                newPin?: string;
                confirmPin?: string;
            };

            if (!username || !username.trim() || !newPin || !confirmPin) {
                return res.status(400).json({ success: false, error: 'Username, PIN baru, dan konfirmasi PIN wajib diisi' });
            }

            const trimmed = username.trim();
            const session = adminOtpStore.get(trimmed.toLowerCase());

            // Validate that OTP was verified and reset token matches
            if (!session || !session.verified || !session.resetToken || session.resetToken !== resetToken || Date.now() > (session.resetTokenExpiresAt || 0)) {
                return res.status(400).json({
                    success: false,
                    error: 'Sesi verifikasi OTP tidak valid atau telah kedaluwarsa. Silakan lakukan verifikasi OTP ulang.'
                });
            }

            if (newPin !== confirmPin) {
                return res.status(400).json({ success: false, error: 'Konfirmasi PIN baru tidak sesuai' });
            }

            if (!/^\d{6}$/.test(newPin)) {
                const fail = securityRateLimiter.recordFailure(rateKey, 3, 15 * 60 * 1000);
                return res.status(fail.isLocked ? 429 : 400).json({
                    success: false,
                    error: fail.isLocked ? fail.message : 'PIN baru harus tepat 6 digit angka numerik'
                });
            }

            const admin = await prisma.admin.findFirst({
                where: { id: session.adminId }
            });

            if (!admin) {
                return res.status(404).json({
                    success: false,
                    error: 'Akun administrator tidak ditemukan di sistem'
                });
            }

            // Check if PIN is already used by another admin
            const duplicatePin = await prisma.admin.findFirst({
                where: {
                    pin: newPin,
                    id: { not: admin.id }
                }
            });

            if (duplicatePin) {
                return res.status(400).json({ success: false, error: 'PIN ini sudah digunakan oleh admin lain. Gunakan kombinasi 6 digit berbeda.' });
            }

            // Update PIN in database
            await prisma.admin.update({
                where: { id: admin.id },
                data: { pin: newPin }
            });

            // Clear session and rate limits
            adminOtpStore.delete(trimmed.toLowerCase());
            securityRateLimiter.clear(rateKey);
            securityRateLimiter.clear(`forgot-pin-lockout:${cleanIp}`);
            securityRateLimiter.clear(`forgot-pin-admin-lock:${trimmed.toLowerCase()}`);
            adminRateLimiter.recordSuccess(cleanIp);

            return res.json({
                success: true,
                message: 'PIN keamanan administrator berhasil direset! Silakan login dengan PIN baru Anda.'
            });
        } catch (error) {
            console.error('Error processing forgot pin reset:', error);
            return res.status(500).json({ success: false, error: 'Gagal mereset PIN admin' });
        }
    }

    /**
     * API Get Trial Products (JSON for Svelte SPA)
     */
    async apiGetTrialProducts(req: Request, res: Response) {
        try {
            const now = Math.floor(Date.now() / 1000);
            const startOfToday = new Date();
            startOfToday.setHours(0, 0, 0, 0);
            const startOfTodayEpoch = Math.floor(startOfToday.getTime() / 1000);

            const [products, trials, totalTrialsCount, todayTrialsCount] = await Promise.all([
                prisma.products.findMany({
                    select: { id: true, name: true, price: true, image: true, is_active: true },
                    orderBy: { id: 'asc' }
                }),
                prisma.trial.findMany({
                    orderBy: { id: 'desc' },
                    take: 15
                }),
                prisma.trial.count(),
                prisma.trial.count({
                    where: { created: { gte: startOfTodayEpoch } }
                })
            ]);

            const productMap = new Map(products.map(p => [(p.name || '').toLowerCase(), p]));

            const formattedTrials = trials.map(t => {
                const matchedProd = productMap.get((t.product || '').toLowerCase());
                const isWaiting = t.user === 'WAITING_ACTIVATION' && !t.machine_id;
                const isExpired = t.expired <= now;

                let status: 'waiting' | 'active' | 'expired' = 'waiting';
                let statusText = 'Belum Dipakai';
                if (isExpired) {
                    status = 'expired';
                    statusText = 'Kadaluarsa';
                } else if (!isWaiting) {
                    status = 'active';
                    statusText = 'Aktif di Device';
                }

                // Format Duration
                const durationSeconds = t.expired - t.created;
                let durationStr = '-';
                if (durationSeconds >= 2592000) {
                    const months = Math.round(durationSeconds / 2592000);
                    durationStr = `${months} Bulan`;
                } else if (durationSeconds >= 86400) {
                    const days = Math.round(durationSeconds / 86400);
                    durationStr = `${days} Hari`;
                } else if (durationSeconds >= 3600) {
                    const hours = Math.round(durationSeconds / 3600);
                    durationStr = `${hours} Jam`;
                } else {
                    durationStr = `${Math.round(durationSeconds / 60)} Menit`;
                }

                return {
                    id: t.id,
                    token: t.token,
                    product: t.product,
                    product_image: sanitizeProductImage(matchedProd?.image),
                    user: t.user,
                    machine_id: t.machine_id || null,
                    duration: durationStr,
                    status,
                    statusText,
                    created_at: t.created,
                    created_formatted: new Date(t.created * 1000).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    }),
                    expired_at: t.expired,
                    expired_formatted: new Date(t.expired * 1000).toLocaleDateString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                    })
                };
            });

            const activeCount = formattedTrials.filter(t => t.status === 'active').length;
            const waitingCount = formattedTrials.filter(t => t.status === 'waiting').length;

            return res.json({
                status: 'success',
                data: {
                    products: products.map(p => ({
                        ...p,
                        image: sanitizeProductImage(p.image)
                    })),
                    trials: formattedTrials,
                    stats: {
                        total: totalTrialsCount,
                        waiting: waitingCount,
                        active: activeCount,
                        today: todayTrialsCount
                    }
                }
            });
        } catch (error) {
            console.error('API Trial products error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat produk' });
        }
    }

    /**
     * Delete / Revoke Trial Key
     */
    async processDeleteTrial(req: Request, res: Response) {
        try {
            const rawId = req.params.id;
            const trialId = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN;
            if (isNaN(trialId) || trialId <= 0) {
                return res.status(400).json({ status: 'error', message: 'ID trial tidak valid' });
            }

            await prisma.trial.delete({ where: { id: trialId } });
            return res.json({ status: 'success', message: 'Kode trial berhasil dihapus' });
        } catch (error) {
            console.error('Delete trial error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal menghapus kode trial' });
        }
    }

    /**
     * Show Create Trial Page (redirects to Svelte SPA or SSR)
     */
    async showCreateTrial(req: Request, res: Response) {
        try {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return this.apiGetTrialProducts(req, res);
            }
            if (req.headers.accept && req.headers.accept.includes('text/html')) {
                return res.redirect('/#/admin/trials/create');
            }
            const products = await prisma.products.findMany({
                select: { id: true, name: true }
            });

            const successCode = req.query.code as string | undefined;
            const error = req.query.error as string | undefined;

            res.send(createTrialPage(error, successCode, products, req.session.adminName || 'Admin'));
        } catch (error) {
            console.error('Show Trial error:', error);
            res.redirect('/#/admin/trials/create');
        }
    }

    /**
     * API Get Affiliate Payout History (JSON for Svelte SPA)
     */
    async apiGetAffiliateHistory(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const pageSize = parseInt(req.query.limit as string) || 20;
            const filterEmail = (req.query.email as string) || undefined;
            const sort = (req.query.sort as string) || 'created';
            const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

            const where: any = {};
            if (filterEmail && filterEmail.trim()) {
                const keyword = filterEmail.trim();
                where.OR = [
                    { affiliate_email: { contains: keyword } },
                    { note: { contains: keyword } },
                    { accepted_by: { contains: keyword } }
                ];
            }

            const total = await prisma.affiliate_payouts.count({ where });
            const payouts = await prisma.affiliate_payouts.findMany({
                where,
                orderBy: { [sort]: order },
                skip: (page - 1) * pageSize,
                take: pageSize
            });

            // Collect unique emails
            const emails = Array.from(new Set(payouts.map(p => p.affiliate_email)));

            // Fetch affiliate_member for bank info
            const affiliateMembers = await prisma.affiliate_member.findMany({
                where: { email: { in: emails } }
            });
            const memberMap = new Map<string, any>();
            affiliateMembers.forEach(m => memberMap.set(m.email, m));

            // Fetch user for WhatsApp and Full Name
            const users = await prisma.user.findMany({
                where: { email: { in: emails } },
                select: { email: true, name: true, whatsapp: true }
            });
            const userMap = new Map<string, any>();
            users.forEach(u => userMap.set(u.email, u));

            const formattedPayouts = payouts.map(p => {
                const member = memberMap.get(p.affiliate_email);
                const user = userMap.get(p.affiliate_email);

                return {
                    id: p.id,
                    created_timestamp: p.created,
                    created: new Date(p.created * 1000).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    }),
                    affiliate_email: p.affiliate_email,
                    affiliate_name: user?.name || member?.payout_name || p.affiliate_email.split('@')[0],
                    whatsapp: user?.whatsapp || null,
                    bank_name: member?.payout_bank_name || null,
                    no_rek: member?.payout_no_rek || null,
                    payout_name: member?.payout_name || user?.name || null,
                    kupon: member?.kupon || null,
                    amount: p.amount,
                    note: p.note,
                    accepted_by: p.accepted_by || 'System'
                };
            });

            // Global Payout Statistics
            const totalAgg = await prisma.affiliate_payouts.aggregate({
                _sum: { amount: true },
                _count: { id: true },
                _avg: { amount: true }
            });

            const now = new Date();
            const startOfMonth = Math.floor(new Date(now.getFullYear(), now.getMonth(), 1).getTime() / 1000);
            const monthAgg = await prisma.affiliate_payouts.aggregate({
                where: { created: { gte: startOfMonth } },
                _sum: { amount: true },
                _count: { id: true }
            });

            const stats = {
                totalPaidAllTime: totalAgg._sum.amount || 0,
                totalPayoutsCount: totalAgg._count.id || 0,
                avgPayoutAllTime: Math.round(totalAgg._avg.amount || 0),
                totalPaidThisMonth: monthAgg._sum.amount || 0,
                totalPayoutsThisMonth: monthAgg._count.id || 0
            };

            return res.json({
                status: 'success',
                data: {
                    payouts: formattedPayouts,
                    stats,
                    pagination: {
                        page,
                        pageSize,
                        total,
                        totalPages: Math.ceil(total / pageSize)
                    },
                    filterEmail,
                    sort,
                    order
                }
            });
        } catch (error) {
            console.error('API Payout history error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat riwayat payout' });
        }
    }

    /**
     * Show Payout History (redirects to Svelte SPA or SSR)
     */
    async showPayoutHistory(req: Request, res: Response) {
        try {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return this.apiGetAffiliateHistory(req, res);
            }
            if (req.headers.accept && req.headers.accept.includes('text/html')) {
                return res.redirect('/#/admin/affiliate/history');
            }
            const page = parseInt(req.query.page as string) || 1;
            const pageSize = 20;
            const filterEmail = req.query.email as string || undefined;
            const sort = (req.query.sort as string) || 'created';
            const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

            const where: any = {};
            if (filterEmail) {
                where.affiliate_email = filterEmail;
            }

            const total = await prisma.affiliate_payouts.count({ where });
            const payouts = await prisma.affiliate_payouts.findMany({
                where,
                orderBy: { [sort]: order },
                skip: (page - 1) * pageSize,
                take: pageSize
            });

            const adminName = (req.session as any).admin || 'Admin';

            const formattedPayouts = payouts.map(p => ({
                id: p.id,
                created: new Date(p.created * 1000).toLocaleString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric',
                    hour: '2-digit', minute: '2-digit'
                }),
                affiliate_email: p.affiliate_email,
                amount: p.amount,
                note: p.note,
                accepted_by: p.accepted_by || 'System'
            }));

            res.send(adminPayoutHistoryPage({
                adminName,
                payouts: formattedPayouts,
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages: Math.ceil(total / pageSize)
                },
                filterEmail,
                sort,
                order
            }));
        } catch (error) {
            console.error('Show payout history error:', error);
            res.redirect('/#/admin/affiliate/history');
        }
    }

    /**
     * Process Create Trial (Generate Code)
     */
    async processCreateTrial(req: Request, res: Response) {
        const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
        try {
            const body = req.body as { product?: string; duration?: string | number; unit?: string };
            const { product, duration, unit } = body;

            if (!product || !duration || !unit) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Semua field wajib diisi' });
                return res.redirect('/admin/trials/create?error=Semua field wajib diisi');
            }

            const numDuration = parseInt(String(duration));
            if (isNaN(numDuration) || numDuration <= 0) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Durasi tidak valid' });
                return res.redirect('/admin/trials/create?error=Durasi tidak valid');
            }

            // Generate Code
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let token = 'TRIAL-';
            for (let i = 0; i < 16; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));

            let seconds = 0;
            if (unit === 'hour') seconds = numDuration * 3600;
            else if (unit === 'day') seconds = numDuration * 86400;
            else if (unit === 'month') seconds = numDuration * 2628000;
            else if (unit === 'year') seconds = numDuration * 31536000;

            const now = Math.floor(Date.now() / 1000);
            const expired = now + seconds;

            await prisma.trial.create({
                data: {
                    user: 'WAITING_ACTIVATION',
                    machine_id: '',
                    created: now,
                    expired: expired,
                    product: product,
                    token: token
                }
            });

            if (isJson) {
                return res.json({
                    status: 'success',
                    message: 'Kode trial berhasil dibuat',
                    code: token
                });
            }

            res.redirect(`/admin/trials/create?code=${token}`);
        } catch (error) {
            console.error('Process Trial error:', error);
            if (isJson) return res.status(500).json({ status: 'error', message: 'Gagal membuat kode trial' });
            res.redirect('/admin/trials/create?error=Gagal membuat trial code');
        }
    }

    /**
     * Helper to compute start of month epoch (00:00:00) based on client timezone
     */
    private getStartOfMonthEpoch(tz: string = 'Asia/Jakarta'): number {
        try {
            const now = new Date();
            // Get date parts in target timezone (YYYY-MM-DD)
            const parts = new Intl.DateTimeFormat('en-CA', {
                timeZone: tz,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).format(now);

            const [year, month] = parts.split('-');
            const firstDayIso = `${year}-${month}-01T00:00:00`;

            const tempDate = new Date(firstDayIso + 'Z');
            const tzDateStr = tempDate.toLocaleString('sv-SE', { timeZone: tz });
            const tzDate = new Date(tzDateStr.replace(' ', 'T') + 'Z');
            const offsetMs = tzDate.getTime() - tempDate.getTime();

            const actualUtcTimestamp = tempDate.getTime() - offsetMs;
            return Math.floor(actualUtcTimestamp / 1000);
        } catch {
            const now = new Date();
            return Math.floor(new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0).getTime() / 1000);
        }
    }

    /**
     * Helper to compute dashboard analytics metrics
     */
    private async getDashboardMetrics(adminName: string, clientTz: string = 'Asia/Jakarta', period: string = '7d') {
        // Calculate Start of Month Epoch based on client timezone (00:00:00 on the 1st of this month)
        const startOfMonthEpoch = this.getStartOfMonthEpoch(clientTz);
        const nowSec = Math.floor(Date.now() / 1000);

        // --- 1. General Stats (This Month) ---
        const totalOrders = await prisma.order_list.count({
            where: {
                created: { gte: startOfMonthEpoch }
            }
        });
        const pendingPayments = await prisma.order_list.count({
            where: {
                paid_at: null,
                created: { gte: startOfMonthEpoch },
                NOT: [
                    { status: { contains: 'complete' } },
                    { status: { contains: 'success' } },
                    { status: { contains: 'settled' } },
                    { status: { contains: 'lunas' } },
                    { status: { contains: 'EXPIRED' } },
                    { status: { contains: 'expired' } },
                ]
            },
        });
        const completedPayments = await prisma.order_list.count({
            where: {
                paid_at: { not: null },
                created: { gte: startOfMonthEpoch }
            }
        });

        // Get total revenue (This Month) - Gross
        const monthlyPaidOrders = await prisma.order_list.findMany({
            where: {
                paid_at: { gte: startOfMonthEpoch },
            },
            select: {
                total_amount: true,
                items: true,
                duration: true,
            }
        });

        let grossRevenue = 0;
        monthlyPaidOrders.forEach(order => {
            if (order.total_amount && Number(order.total_amount) > 0) {
                grossRevenue += Number(order.total_amount);
            } else {
                try {
                    let itemPrice = 0;
                    const items: any = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

                    if (Array.isArray(items) && items.length > 0) {
                        const first = items[0];
                        const rawPrice = first.price ? String(first.price) : '0';
                        itemPrice = parseInt(rawPrice) || 0;

                        if (first.is_discount === '1' && first.discount_percent) {
                            const disc = parseInt(String(first.discount_percent)) || 0;
                            itemPrice = itemPrice - (itemPrice * disc / 100);
                        }
                    } else if (items && typeof items === 'object') {
                        const rawPrice = items.price ? String(items.price) : '0';
                        itemPrice = parseInt(rawPrice) || 0;
                    }

                    const durationMonths = order.duration ? Math.max(1, Math.round(order.duration / 43800)) : 1;
                    if (itemPrice > 0) {
                        grossRevenue += Math.round(itemPrice * durationMonths);
                    }
                } catch {
                    // Ignore parse error
                }
            }
        });

        // Get total affiliate cost (This Month)
        const affiliateCostResult = await prisma.affiliate_transaksi.aggregate({
            _sum: {
                affiliate_income: true,
            },
            where: {
                created_at: { gte: startOfMonthEpoch },
            },
        });
        const affiliateCost = affiliateCostResult._sum.affiliate_income || 0;
        const netRevenue = grossRevenue - affiliateCost;

        // --- 2. Affiliate Stats ---
        const totalAllAffiliates = await prisma.affiliate_member.count();
        const newAffiliatesThisMonth = await prisma.affiliate_member.count({
            where: { created: { gte: startOfMonthEpoch } }
        });

        // Active Affiliates (Last 30 Days)
        const thirtyDaysAgo = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
        const activeAffiliatesResult = await prisma.affiliate_transaksi.findMany({
            where: { created_at: { gte: thirtyDaysAgo } },
            distinct: ['affiliator_email'],
            select: { affiliator_email: true }
        });
        const activeAffiliates = activeAffiliatesResult.length;

        // Unpaid Commission
        const unpaidCommissionResult = await prisma.affiliate_transaksi.aggregate({
            _sum: { affiliate_income: true },
            where: { already_paid: 0 }
        });
        const unpaidCommission = unpaidCommissionResult._sum.affiliate_income || 0;

        // --- 2.5 Fetch Product Catalog for Image & Details Lookup ---
        const catalogProducts = await prisma.products.findMany({
            select: {
                id: true,
                name: true,
                image: true,
                price: true,
                product_id: true
            }
        });

        const productMapByName = new Map<string, { id: number; name: string; image: string | null; price: number }>();
        catalogProducts.forEach(p => {
            if (p.name) {
                productMapByName.set(p.name.toLowerCase().trim(), {
                    id: p.id,
                    name: p.name,
                    image: sanitizeProductImage(p.image),
                    price: p.price || 0
                });
            }
        });

        // --- 3. Product Stats (Top Selling THIS MONTH from 1st day 00:00:00 to now) ---
        const paidOrdersThisMonth = await prisma.order_list.findMany({
            where: {
                paid_at: { gte: startOfMonthEpoch }
            },
            select: { items: true },
            orderBy: { created: 'desc' }
        });

        const productCounts: Record<string, number> = {};
        paidOrdersThisMonth.forEach(order => {
            try {
                const items: any = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                let name = 'Unknown';
                if (Array.isArray(items) && items.length > 0) name = items[0].name;
                else if (items && typeof items === 'object') name = items.name;

                if (name && name !== 'Unknown') {
                    productCounts[name] = (productCounts[name] || 0) + 1;
                }
            } catch {
                // Ignore parse errors
            }
        });

        const topProducts = Object.entries(productCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([name, count]) => {
                const found = productMapByName.get(name.toLowerCase().trim());
                return {
                    name,
                    count,
                    image: sanitizeProductImage(found?.image),
                    price: found?.price || 0
                };
            });

        // --- 4. Dynamic Revenue Graph & Growth Calculation ---
        let currentPeriodStart = nowSec - (7 * 86400);
        let prevPeriodStart = nowSec - (14 * 86400);
        let prevPeriodEnd = currentPeriodStart;
        let numIntervals = 7;
        let isMonthlyGrouping = false;

        if (period === '30d') {
            currentPeriodStart = nowSec - (30 * 86400);
            prevPeriodStart = nowSec - (60 * 86400);
            prevPeriodEnd = currentPeriodStart;
            numIntervals = 30;
        } else if (period === 'this_month') {
            currentPeriodStart = startOfMonthEpoch;
            const daysInCurrentMonth = Math.max(1, Math.ceil((nowSec - currentPeriodStart) / 86400));
            numIntervals = daysInCurrentMonth;
            prevPeriodEnd = startOfMonthEpoch;
            prevPeriodStart = startOfMonthEpoch - (daysInCurrentMonth * 86400);
        } else if (period === 'this_year') {
            const currentYear = new Date().getFullYear();
            currentPeriodStart = Math.floor(new Date(`${currentYear}-01-01T00:00:00`).getTime() / 1000);
            prevPeriodStart = Math.floor(new Date(`${currentYear - 1}-01-01T00:00:00`).getTime() / 1000);
            prevPeriodEnd = currentPeriodStart;
            isMonthlyGrouping = true;
            numIntervals = 12;
        }

        const currentPeriodOrders = await prisma.order_list.findMany({
            where: { paid_at: { gte: currentPeriodStart } },
            select: { total_amount: true, paid_at: true }
        });

        const prevPeriodOrders = await prisma.order_list.findMany({
            where: { paid_at: { gte: prevPeriodStart, lt: prevPeriodEnd } },
            select: { total_amount: true }
        });

        const currentRevenueSum = currentPeriodOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
        const prevRevenueSum = prevPeriodOrders.reduce((acc, o) => acc + (o.total_amount || 0), 0);
        const growthPercent = prevRevenueSum > 0
            ? Math.round(((currentRevenueSum - prevRevenueSum) / prevRevenueSum) * 100)
            : currentRevenueSum > 0 ? 100 : 0;

        const revenueMap: Record<string, number> = {};
        const graphKeys: string[] = [];

        if (isMonthlyGrouping) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            months.forEach(m => {
                revenueMap[m] = 0;
                graphKeys.push(m);
            });
            for (const order of currentPeriodOrders) {
                if (!order.paid_at || !order.total_amount) continue;
                const mIdx = new Date(order.paid_at * 1000).getMonth();
                const key = months[mIdx];
                if (revenueMap[key] !== undefined) revenueMap[key] += order.total_amount;
            }
        } else {
            const getDateKey = (t: number) => {
                return new Date(t * 1000).toLocaleDateString('id-ID', {
                    timeZone: clientTz,
                    day: 'numeric',
                    month: 'short'
                });
            };

            for (let i = numIntervals - 1; i >= 0; i--) {
                const d = new Date(nowSec * 1000);
                d.setDate(d.getDate() - i);
                const key = d.toLocaleDateString('id-ID', {
                    timeZone: clientTz,
                    day: 'numeric',
                    month: 'short'
                });
                revenueMap[key] = 0;
                graphKeys.push(key);
            }

            for (const order of currentPeriodOrders) {
                if (!order.paid_at || !order.total_amount) continue;
                const key = getDateKey(order.paid_at);
                if (revenueMap[key] !== undefined) {
                    revenueMap[key] += order.total_amount;
                }
            }
        }

        const revenueGraphData = graphKeys.map(date => ({
            date,
            amount: Math.max(0, revenueMap[date] || 0)
        }));

        // --- 5. Expiring Licenses Watchlist & Alerts ---
        const in7Days = nowSec + (7 * 86400);

        const expiringDevices = await prisma.device.findMany({
            where: {
                expired: {
                    gte: nowSec - 86400,
                    lte: in7Days
                }
            },
            orderBy: {
                expired: 'asc'
            },
            take: 50
        });

        const expiringLicensesCount = await prisma.device.count({
            where: {
                expired: {
                    gte: nowSec - 86400,
                    lte: in7Days
                }
            }
        });

        const orderIds = expiringDevices.map(d => d.order_id).filter(Boolean);
        const emails = [...new Set(expiringDevices.map(d => d.email).filter(Boolean))];

        const [deviceTokens, deviceUsers] = await Promise.all([
            prisma.token_device_activation.findMany({
                where: {
                    OR: [
                        { order_id: { in: orderIds } },
                        { user: { in: emails } }
                    ]
                },
                select: {
                    id: true,
                    token: true,
                    order_id: true,
                    user: true,
                    product: true
                }
            }),
            prisma.user.findMany({
                where: {
                    email: { in: emails }
                },
                select: {
                    email: true,
                    name: true,
                    whatsapp: true
                }
            })
        ]);

        const userMap = new Map(deviceUsers.map(u => [u.email.toLowerCase(), u]));
        const tokenByOrder = new Map(deviceTokens.map(t => [`${t.order_id}`, t.token]));
        const tokenByEmailProd = new Map(deviceTokens.map(t => [`${t.user?.toLowerCase()}_${t.product?.toLowerCase()}`, t.token]));

        const expiringLicenses = expiringDevices.slice(0, 5).map(d => {
            const u = userMap.get(d.email.toLowerCase());
            const token = tokenByOrder.get(`${d.order_id}`)
                || tokenByEmailProd.get(`${d.email.toLowerCase()}_${d.product.toLowerCase()}`)
                || d.label
                || d.machine_id
                || 'TOKEN-ACTIVE';
            const daysLeft = Math.max(0, Math.ceil((d.expired - nowSec) / 86400));
            return {
                id: d.id,
                token,
                product: d.product,
                user: u?.name ? `${u.name}` : d.email,
                userEmail: d.email,
                whatsapp: u?.whatsapp || null,
                machineId: d.machine_id,
                expiresAt: new Date(d.expired * 1000).toLocaleDateString('id-ID', {
                    timeZone: clientTz,
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }),
                expiresEpoch: d.expired,
                daysLeft
            };
        });

        // --- 6. Top Affiliates Leaderboard ---
        const topAffiliatesRaw = await prisma.affiliate_transaksi.groupBy({
            by: ['affiliator_email'],
            _sum: { affiliate_income: true },
            _count: { id: true },
            where: {
                created_at: { gte: startOfMonthEpoch }
            },
            orderBy: {
                _sum: {
                    affiliate_income: 'desc'
                }
            },
            take: 5
        });

        const topAffiliates = topAffiliatesRaw.map(a => ({
            email: a.affiliator_email,
            income: a._sum.affiliate_income || 0,
            count: a._count.id || 0
        }));

        const pendingVerificationCount = await prisma.order_list.count({
            where: {
                paid_at: null,
                NOT: [
                    { status: { contains: 'complete' } },
                    { status: { contains: 'success' } },
                    { status: { contains: 'settled' } },
                    { status: { contains: 'lunas' } },
                    { status: { contains: 'EXPIRED' } },
                    { status: { contains: 'expired' } },
                ]
            }
        });

        const unpaidCommissionCount = await prisma.affiliate_transaksi.count({
            where: { already_paid: 0 }
        });

        // --- 7. Recent Orders (Table / Feed) ---
        const recentOrdersData = await prisma.order_list.findMany({
            take: 5,
            orderBy: { id: 'desc' },
            where: {
                paid_at: { not: null }
            },
            select: {
                id: true,
                user: true,
                items: true,
                total_amount: true,
                status: true,
                channel_code: true,
                payment: true,
                payment_id: true,
                payment_request_id: true,
                va_number: true,
                confirmed_by: true,
                created: true,
                paid_at: true,
                duration: true,
            },
        });

        const recentOrders = recentOrdersData.map(order => {
            let buyerName = '-';
            let buyerEmail = '';
            try {
                const parsedUser: any = JSON.parse(order.user);
                if (parsedUser && typeof parsedUser === 'object') {
                    buyerEmail = parsedUser.email || '';
                    buyerName = parsedUser.name || (buyerEmail ? buyerEmail.split('@')[0] : 'Pembeli');
                } else {
                    buyerEmail = String(order.user);
                    buyerName = buyerEmail ? buyerEmail.split('@')[0] : 'Pembeli';
                }
            } catch {
                buyerEmail = String(order.user);
                buyerName = buyerEmail ? buyerEmail.split('@')[0] : 'Pembeli';
            }

            let productName = 'Produk AppCenter';
            let durationDisplay = '-';
            let productImage: string | null = null;
            try {
                const itemsData: any = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                if (Array.isArray(itemsData) && itemsData.length > 0) {
                    productName = itemsData[0].name || productName;
                    durationDisplay = itemsData[0].duration_text || '-';
                } else if (itemsData && typeof itemsData === 'object') {
                    productName = itemsData.name || productName;
                    durationDisplay = itemsData.duration_text || '-';
                }
            } catch {
                // Ignore parse error
            }

            const catalogMatch = productMapByName.get(productName.toLowerCase().trim());
            if (catalogMatch && catalogMatch.image) {
                productImage = catalogMatch.image;
            }

            let resolvedChannel = order.channel_code;
            if (!resolvedChannel || resolvedChannel.toUpperCase() === 'UNPAID') {
                if (order.payment && order.payment.toUpperCase() !== 'UNPAID') {
                    resolvedChannel = order.payment;
                } else if (order.payment_id && order.payment_id.startsWith('qrpy_')) {
                    resolvedChannel = 'QRIS';
                } else if (order.va_number) {
                    resolvedChannel = 'Virtual Account';
                } else if (order.payment_request_id) {
                    resolvedChannel = 'Xendit';
                } else if (order.confirmed_by && order.confirmed_by !== '-') {
                    resolvedChannel = 'Manual';
                } else {
                    resolvedChannel = 'Lunas';
                }
            }

            return {
                id: order.id,
                user: buyerName,
                email: buyerEmail,
                productName,
                productImage,
                durationDisplay,
                totalAmount: order.total_amount || 0,
                status: order.status ? order.status.substring(0, 20) : 'COMPLETED',
                channelCode: resolvedChannel,
                createdAt: new Date(order.created * 1000).toLocaleDateString('id-ID', { timeZone: clientTz }),
                paidAt: order.paid_at ? new Date(order.paid_at * 1000).toLocaleDateString('id-ID', { timeZone: clientTz }) : null
            };
        });

        return {
            adminName,
            timezone: clientTz,
            period,
            startOfMonth: new Date(startOfMonthEpoch * 1000).toISOString(),
            stats: {
                totalOrders,
                pendingPayments,
                completedPayments,
                totalRevenue: netRevenue,
                grossRevenue,
                affiliateCost,
                totalAffiliates: totalAllAffiliates,
                newAffiliatesThisMonth: newAffiliatesThisMonth,
                activeAffiliates,
                totalCommissionPaid: unpaidCommission
            },
            quickAlerts: {
                pendingCount: pendingVerificationCount,
                expiringCount: expiringLicensesCount,
                unpaidPayoutCount: unpaidCommissionCount,
                unpaidPayoutAmount: unpaidCommission
            },
            growthPercent,
            topProducts,
            revenueGraphData,
            recentOrders,
            expiringLicenses,
            topAffiliates
        };
    }

    /**
     * API Get Dashboard (JSON for Svelte SPA)
     */
    async apiGetDashboard(req: Request, res: Response) {
        try {
            const clientTz = (req.query.timezone as string) || 'Asia/Jakarta';
            const period = (req.query.period as string) || '7d';
            const data = await this.getDashboardMetrics(req.session.adminName || 'Admin', clientTz, period);
            return res.json({
                status: 'success',
                data
            });
        } catch (error) {
            console.error('API Dashboard error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat data dashboard' });
        }
    }

    /**
     * Show dashboard (redirects to Svelte SPA or renders SSR)
     */
    async showDashboard(req: Request, res: Response) {
        try {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return this.apiGetDashboard(req, res);
            }
            if (req.headers.accept && req.headers.accept.includes('text/html')) {
                return res.redirect('/#/admin/dashboard');
            }
            const clientTz = (req.query.timezone as string) || 'Asia/Jakarta';
            const dashboardData = await this.getDashboardMetrics(req.session.adminName || 'Admin', clientTz);
            res.send(dashboardPage(dashboardData));
        } catch (error) {
            console.error('Dashboard error:', error);
            res.redirect('/#/admin/dashboard');
        }
    }


    /**
     * Show create payment page
     */
    async showCreatePayment(req: Request, res: Response) {
        try {
            // Get products
            const products = await prisma.products.findMany({
                select: {
                    id: true,
                    name: true,
                    price: true,
                    is_discount: true,
                    discount_percent: true,
                },
            });

            const formattedProducts = products.map(p => {
                let finalPrice = p.price;
                if (p.is_discount && p.discount_percent > 0) {
                    finalPrice = p.price - (p.price * p.discount_percent / 100);
                }
                return {
                    id: p.id,
                    name: p.name,
                    price: Math.round(finalPrice),
                };
            });

            const error = req.query.error as string | undefined;
            const success = req.query.success as string | undefined;

            // Fetch GoQRIS settings
            const goqrisConfig = await getGoqrisConfig();

            res.send(createPaymentPage({
                adminName: req.session.adminName || 'Admin',
                products: formattedProducts,
                adminFeePercent: goqrisConfig.adminFeePercent || 0,
                error,
                success,
            }));
        } catch (error) {
            console.error('Create payment page error:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Process create payment
     */
    async processCreatePayment(req: Request, res: Response) {
        try {
            const body = req.body as {
                customerEmail?: string;
                customerName?: string;
                productId?: string;
                duration?: string;
                channelCode?: string;
                note?: string;
                totalAmount?: number;
                adminFee?: string;
            };

            const {
                customerEmail,
                customerName,
                productId,
                duration,
                channelCode, // Optional now, or ignored
                note,
                adminFee,
            } = body;

            // Validate required fields (channelCode no longer required)
            if (!customerEmail || !customerName || !productId) {
                return res.redirect('/admin/payment/create?error=Semua field wajib diisi');
            }

            // Get product
            const product = await prisma.products.findUnique({
                where: { id: parseInt(productId) },
            });

            if (!product) {
                return res.redirect('/admin/payment/create?error=Produk tidak ditemukan');
            }

            // Calculate final price with discount
            let finalPrice = product.price;
            if (product.is_discount && product.discount_percent > 0) {
                finalPrice = product.price - (product.price * product.discount_percent / 100);
            }
            finalPrice = Math.round(finalPrice);

            // Convert duration from months to MINUTES (1 month = 43800 minutes)
            const durationMonths = parseInt(duration || '1') || 1;
            const durationMinutes = durationMonths * 43800;

            // Calculate total: price × months + admin fee
            const calculatedSubtotal = finalPrice * durationMonths;
            const calculatedAdminFee = parseInt(adminFee || '0') || 0;
            const calculatedTotal = calculatedSubtotal + calculatedAdminFee;

            // Create order in database
            const order = await prisma.order_list.create({
                data: {
                    items: JSON.stringify({
                        id: product.id.toString(),
                        name: product.name,
                        image: product.image,
                        product_id: product.id.toString(),
                        description: product.description,
                        price: finalPrice.toString(),
                        is_discount: product.is_discount ? '1' : '0',
                        discount_percent: product.discount_percent.toString(),
                    }),
                    created: Math.floor(Date.now() / 1000),
                    confirmed_by: '',
                    status: 'Waiting for payment',
                    payment: 'XENDIT_CHECKOUT', // Pending actual method selection
                    status_badge: '#FFA500',
                    last_updated: '',
                    note: note || '',
                    user: customerEmail,
                    duration: durationMinutes,
                    voucer: '',
                    channel_code: channelCode || 'XENDIT_INVOICE',
                    total_amount: calculatedTotal,
                    admin_fee: calculatedAdminFee,
                },
            });

            // Create order with GoQRIS
            const refId = `INV-${order.id}`;

            const goqrisRes = await createGoqrisOrder({
                refId,
                amount: calculatedTotal,
                customerName: customerName || 'Pelanggan',
                customerEmail: customerEmail
            });

            const qrImage = goqrisRes.data?.payment_detail?.qr_image || '';
            const totalAmountFromGateway = goqrisRes.data?.total_amount || calculatedTotal;
            const trxId = goqrisRes.data?.trx_id || '';

            // Update order with GoQRIS details
            const expiresAt = Math.floor(Date.now() / 1000) + (24 * 3600);
            const invoiceToken = await ensureOrderInvoiceToken(order.id);

            await prisma.order_list.update({
                where: { id: order.id },
                data: {
                    payment_request_id: refId,
                    payment_id: trxId,
                    qr_string: qrImage,
                    total_amount: totalAmountFromGateway,
                    payment_url: `/#/invoice/${invoiceToken}`,
                    payment_expires_at: expiresAt,
                },
            });

            res.redirect(`/admin/payment/success?orderId=${order.id}`);
        } catch (error) {
            const err = error as Error;
            console.error('Create payment error:', error);
            res.redirect(`/admin/payment/create?error=${encodeURIComponent(err.message || 'Gagal membuat pembayaran')}`);
        }
    }

    /**
     * Show payment success page
     */
    async showPaymentSuccess(req: Request, res: Response) {
        try {
            const orderId = parseInt(req.query.orderId as string);

            if (!orderId) {
                return res.redirect('/admin/dashboard');
            }

            const order = await prisma.order_list.findUnique({
                where: { id: orderId },
            });

            if (!order) {
                return res.redirect('/admin/dashboard');
            }

            // Parse user info
            let userInfo = { email: '', name: '' };
            try {
                const parsed: unknown = JSON.parse(order.user);
                if (parsed && typeof parsed === 'object') {
                    const parsedObj = parsed as { email?: string; name?: string };
                    userInfo = {
                        email: parsedObj.email || order.user,
                        name: parsedObj.name || ''
                    };
                } else {
                    userInfo.email = order.user;
                }
            } catch (e) {
                userInfo.email = order.user;
            }

            const html = `
<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pembayaran Berhasil Dibuat - Admin Panel</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Inter', sans-serif; }
    .gradient-bg { background: linear-gradient(135deg, #1e1e2e 0%, #2d1b4e 50%, #1e1e2e 100%); }
    .card { background: rgba(30, 30, 46, 0.6); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; }
  </style>
</head>
<body class="bg-gray-950 text-white min-h-screen gradient-bg">
  <div class="min-h-screen flex items-center justify-center p-4">
    <div class="max-w-lg w-full">
      <div class="card p-8 text-center">
        <div class="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6">
          <svg class="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
          </svg>
        </div>
        
        <h1 class="text-2xl font-bold mb-2">Pembayaran Berhasil Dibuat!</h1>
        <p class="text-gray-400 mb-6">Order #${orderId} telah dibuat dan menunggu pembayaran.</p>
        
        <div class="bg-gray-800/50 rounded-xl p-6 text-left mb-6">
          <div class="space-y-3">
            <div class="flex justify-between">
              <span class="text-gray-400">Order ID</span>
              <span class="font-mono">#${orderId}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Pelanggan</span>
              <span>${userInfo.name || userInfo.email}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Metode</span>
              <span class="text-blue-400">${order.channel_code}</span>
            </div>
            <div class="flex justify-between">
              <span class="text-gray-400">Total</span>
              <span class="font-bold text-green-400">Rp ${(order.total_amount || 0).toLocaleString('id-ID')}</span>
            </div>
            ${order.va_number ? `
            <div class="border-t border-white/10 pt-3 mt-3">
              <p class="text-gray-400 text-sm mb-1">Nomor Virtual Account:</p>
              <p class="text-xl font-mono font-bold text-yellow-400">${order.va_number}</p>
            </div>
            ` : ''}
            ${order.payment_url ? `
            <div class="border-t border-white/10 pt-3 mt-3">
              <a href="${order.payment_url}" target="_blank" class="block w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-4 rounded-xl text-center transition-colors">
                Buka Halaman Pembayaran
              </a>
            </div>
            ` : ''}
          </div>
        </div>
        
        <div class="flex gap-4">
          <a href="/admin/payment/create" class="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-3 px-4 rounded-xl text-center transition-colors">
            Buat Lagi
          </a>
          <a href="/admin/dashboard" class="flex-1 bg-primary hover:bg-primary/80 text-white font-medium py-3 px-4 rounded-xl text-center transition-colors" style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);">
            Dashboard
          </a>
        </div>
      </div>
    </div>
  </div>
</body>
</html>
      `;

            res.send(html);
        } catch (error) {
            console.error('Payment success page error:', error);
            res.redirect('/admin/dashboard');
        }
    }

    /**
     * Show public payment success page (User Redirect)
     */
    async showPublicPaymentSuccess(req: Request, res: Response) {
        try {
            const externalId = req.query.external_id as string;

            let orderId = 0;
            if (externalId && externalId.startsWith('order_')) {
                const parts = externalId.split('_');
                if (parts.length >= 2) {
                    orderId = parseInt(parts[1]);
                }
            } else if (req.query.order_id) {
                orderId = parseInt(req.query.order_id as string);
            }

            if (!orderId) {
                return res.redirect('/member/dashboard');
            }

            const order = await prisma.order_list.findUnique({
                where: { id: orderId },
            });

            if (!order) {
                return res.redirect('/member/dashboard');
            }

            const html = `
<!DOCTYPE html>
<html lang="id" class="dark">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Pembayaran Berhasil - App Center</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap');
    body { font-family: 'Outfit', sans-serif; }
    .gradient-bg { background: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%); }
    .glass-card { 
        background: rgba(255, 255, 255, 0.05); 
        backdrop-filter: blur(10px); 
        border: 1px solid rgba(255, 255, 255, 0.1); 
        border-radius: 24px; 
    }
    .success-icon {
        animation: scaleIn 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes scaleIn {
        from { transform: scale(0); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
  </style>
</head>
<body class="bg-gray-950 text-white min-h-screen gradient-bg flex items-center justify-center p-4">
  <div class="glass-card max-w-md w-full p-8 text-center relative overflow-hidden">
    <div class="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
    
    <div class="success-icon w-24 h-24 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6 ring-4 ring-green-500/10">
      <svg class="w-12 h-12 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    
    <h1 class="text-3xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400">Pembayaran Berhasil!</h1>
    <p class="text-gray-400 mb-8">Terima kasih, pembayaran Anda untuk Order #${orderId} telah kami terima.</p>
    
    <div class="bg-gray-900/50 rounded-2xl p-6 mb-8 border border-white/5">
        <div class="flex justify-between items-center mb-3">
            <span class="text-gray-400 text-sm">Total Pembayaran</span>
            <span class="text-xl font-bold text-white">Rp ${(order.total_amount || 0).toLocaleString('id-ID')}</span>
        </div>
        <div class="flex justify-between items-center">
            <span class="text-gray-400 text-sm">Status</span>
            ${(order.status.toLowerCase().includes('complete') || order.status.toLowerCase().includes('success') || order.paid_at || (req.query.status && (req.query.status === 'PAID' || req.query.status === 'SETTLED'))) ?
                    `<span class="px-3 py-1 rounded-full text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">BERHASIL</span>` :
                    `<span class="px-3 py-1 rounded-full text-xs font-medium bg-yellow-500/10 text-yellow-400 border border-yellow-500/20">DIPROSES</span>`}
        </div>
    </div>

    <a href="/member/dashboard" class="block w-full bg-white text-gray-900 hover:bg-gray-100 font-bold py-4 px-6 rounded-xl transition-all transform hover:scale-[1.02] shadow-xl shadow-white/10">
      Kembali ke Dashboard
    </a>
  </div>
</body>
</html>
            `;
            res.send(html);
        } catch (error) {
            console.error('Public payment success page error:', error);
            res.redirect('/member/dashboard');
        }
    }

    /**
     * Helper to compute epoch date range from period or custom date
     */
    private getDateRangeFilter(
        period?: string,
        startDateStr?: string,
        endDateStr?: string,
        tz: string = 'Asia/Jakarta'
    ): { gte?: number; lte?: number } | null {
        const nowSec = Math.floor(Date.now() / 1000);

        if (!period || period === 'all') {
            return null;
        }

        if (period === 'this_month') {
            const startThisMonth = this.getStartOfMonthEpoch(tz);
            return { gte: startThisMonth };
        }

        if (period === 'last_month') {
            try {
                const now = new Date();
                const parts = new Intl.DateTimeFormat('en-CA', {
                    timeZone: tz,
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit'
                }).format(now);

                let [yearNum, monthNum] = parts.split('-').map(Number);
                monthNum -= 1;
                if (monthNum === 0) {
                    monthNum = 12;
                    yearNum -= 1;
                }
                const monthStr = String(monthNum).padStart(2, '0');
                const lastDayOfLastMonth = new Date(yearNum, monthNum, 0).getDate();

                const startIso = `${yearNum}-${monthStr}-01T00:00:00`;
                const endIso = `${yearNum}-${monthStr}-${String(lastDayOfLastMonth).padStart(2, '0')}T23:59:59`;

                const toEpoch = (iso: string) => {
                    const temp = new Date(iso + 'Z');
                    const localStr = temp.toLocaleString('sv-SE', { timeZone: tz });
                    const localDate = new Date(localStr.replace(' ', 'T') + 'Z');
                    const offset = localDate.getTime() - temp.getTime();
                    return Math.floor((temp.getTime() - offset) / 1000);
                };

                return { gte: toEpoch(startIso), lte: toEpoch(endIso) };
            } catch {
                const now = new Date();
                const start = Math.floor(new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0).getTime() / 1000);
                const end = Math.floor(new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime() / 1000);
                return { gte: start, lte: end };
            }
        }

        if (period === 'last_3_months') {
            return { gte: nowSec - (90 * 86400) };
        }

        if (period === 'last_1_year') {
            return { gte: nowSec - (365 * 86400) };
        }

        if (period === 'custom') {
            const range: { gte?: number; lte?: number } = {};
            if (startDateStr && /^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
                try {
                    const iso = `${startDateStr}T00:00:00`;
                    const temp = new Date(iso + 'Z');
                    const localStr = temp.toLocaleString('sv-SE', { timeZone: tz });
                    const localDate = new Date(localStr.replace(' ', 'T') + 'Z');
                    const offset = localDate.getTime() - temp.getTime();
                    range.gte = Math.floor((temp.getTime() - offset) / 1000);
                } catch {
                    range.gte = Math.floor(new Date(startDateStr + 'T00:00:00').getTime() / 1000);
                }
            }
            if (endDateStr && /^\d{4}-\d{2}-\d{2}$/.test(endDateStr)) {
                try {
                    const iso = `${endDateStr}T23:59:59`;
                    const temp = new Date(iso + 'Z');
                    const localStr = temp.toLocaleString('sv-SE', { timeZone: tz });
                    const localDate = new Date(localStr.replace(' ', 'T') + 'Z');
                    const offset = localDate.getTime() - temp.getTime();
                    range.lte = Math.floor((temp.getTime() - offset) / 1000);
                } catch {
                    range.lte = Math.floor(new Date(endDateStr + 'T23:59:59').getTime() / 1000);
                }
            }
            return (range.gte !== undefined || range.lte !== undefined) ? range : null;
        }

        return null;
    }

    /**
     * API Get Payments (JSON for Svelte SPA)
     */
    async apiGetPayments(req: Request, res: Response) {
        try {
            const page = parseInt(req.query.page as string) || 1;
            const perPage = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 100);
            const skip = (page - 1) * perPage;

            const search = (req.query.search as string) || '';
            const rawSort = (req.query.sort as string) || 'created';
            const sort = ['created', 'total_amount', 'paid_at', 'id'].includes(rawSort) ? rawSort : 'created';
            const order = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

            const period = (req.query.period as string) || 'all';
            const startDate = (req.query.startDate as string) || '';
            const endDate = (req.query.endDate as string) || '';
            const product = (req.query.product as string) || 'all';
            const timezone = (req.query.timezone as string) || 'Asia/Jakarta';
            const rawStatus = ((req.query.status as string) || 'all').toLowerCase();
            const statusFilter = ['all', 'pending', 'paid', 'completed', 'expired'].includes(rawStatus) ? rawStatus : 'all';

            // Filter logic with AND / OR conditions
            const andConditions: any[] = [];

            if (search) {
                const numericSearch = parseInt(search);

                // Search in tokens first
                const matchingTokens = await prisma.token_device_activation.findMany({
                    where: { token: { contains: search } },
                    select: { order_id: true }
                });
                const tokenOrderIds = matchingTokens
                    .map(t => t.order_id)
                    .filter((id): id is number => id !== null);

                const orConditions: any[] = [
                    { user: { contains: search } },
                    { items: { contains: search } },
                ];

                if (!isNaN(numericSearch)) {
                    orConditions.push({ id: numericSearch });
                }

                if (tokenOrderIds.length > 0) {
                    orConditions.push({ id: { in: tokenOrderIds } });
                }

                andConditions.push({ OR: orConditions });
            }

            // Product filter
            if (product && product !== 'all') {
                andConditions.push({ items: { contains: product } });
            }

            // Date period filter
            const dateRange = this.getDateRangeFilter(period, startDate, endDate, timezone);
            if (dateRange) {
                const createdFilter: any = {};
                if (dateRange.gte !== undefined) createdFilter.gte = dateRange.gte;
                if (dateRange.lte !== undefined) createdFilter.lte = dateRange.lte;
                andConditions.push({ created: createdFilter });
            }

            // Base conditions without status filter for computing accurate tab counts
            const baseConditions = [...andConditions];
            const baseWhere: any = baseConditions.length > 0 ? { AND: baseConditions } : {};

            // Status filter condition
            if (statusFilter === 'pending') {
                andConditions.push({
                    paid_at: null,
                    NOT: [
                        { status: { contains: 'complete' } },
                        { status: { contains: 'success' } },
                        { status: { contains: 'settled' } },
                        { status: { contains: 'lunas' } },
                        { status: { contains: 'EXPIRED' } },
                        { status: { contains: 'expired' } },
                    ]
                });
            } else if (statusFilter === 'paid' || statusFilter === 'completed') {
                andConditions.push({
                    OR: [
                        { paid_at: { not: null } },
                        { status: { contains: 'complete' } },
                        { status: { contains: 'success' } },
                        { status: { contains: 'settled' } },
                        { status: { contains: 'lunas' } },
                    ]
                });
            } else if (statusFilter === 'expired') {
                andConditions.push({
                    OR: [
                        { status: { contains: 'EXPIRED' } },
                        { status: { contains: 'expired' } },
                    ]
                });
            }

            const where: any = andConditions.length > 0 ? { AND: andConditions } : {};

            const [totalPayments, countAll, countPending, countPaid, countExpired] = await Promise.all([
                prisma.order_list.count({ where }),
                prisma.order_list.count({ where: baseWhere }),
                prisma.order_list.count({
                    where: {
                        AND: [
                            ...(baseConditions.length > 0 ? [baseWhere] : []),
                            {
                                paid_at: null,
                                NOT: [
                                    { status: { contains: 'complete' } },
                                    { status: { contains: 'success' } },
                                    { status: { contains: 'settled' } },
                                    { status: { contains: 'lunas' } },
                                    { status: { contains: 'EXPIRED' } },
                                    { status: { contains: 'expired' } },
                                ]
                            }
                        ]
                    }
                }),
                prisma.order_list.count({
                    where: {
                        AND: [
                            ...(baseConditions.length > 0 ? [baseWhere] : []),
                            {
                                OR: [
                                    { paid_at: { not: null } },
                                    { status: { contains: 'complete' } },
                                    { status: { contains: 'success' } },
                                    { status: { contains: 'settled' } },
                                    { status: { contains: 'lunas' } },
                                ]
                            }
                        ]
                    }
                }),
                prisma.order_list.count({
                    where: {
                        AND: [
                            ...(baseConditions.length > 0 ? [baseWhere] : []),
                            {
                                OR: [
                                    { status: { contains: 'EXPIRED' } },
                                    { status: { contains: 'expired' } },
                                ]
                            }
                        ]
                    }
                })
            ]);

            const payments = await prisma.order_list.findMany({
                where,
                orderBy: { [sort]: order },
                skip,
                take: perPage,
                select: {
                    id: true,
                    user: true,
                    items: true,
                    total_amount: true,
                    admin_fee: true,
                    channel_code: true,
                    payment: true,
                    status: true,
                    payment_request_id: true,
                    va_number: true,
                    paid_at: true,
                    created: true,
                    payment_expires_at: true,
                    duration: true,
                    invoice_token: true,
                },
            });

            const orderIds = payments.map(p => p.id);
            const emails: string[] = [];
            payments.forEach(p => {
                try {
                    const parsed: any = JSON.parse(p.user);
                    if (parsed && typeof parsed === 'object' && parsed.email) {
                        emails.push(parsed.email);
                    } else {
                        emails.push(p.user);
                    }
                } catch {
                    emails.push(p.user);
                }
            });

            const [tokens, users, catalogProducts] = await Promise.all([
                prisma.token_device_activation.findMany({
                    where: { order_id: { in: orderIds } }
                }),
                prisma.user.findMany({
                    where: { email: { in: emails } },
                    select: { email: true, name: true }
                }),
                prisma.products.findMany({
                    select: { id: true, name: true, image: true }
                })
            ]);

            const productImgMap = new Map<string, string>();
            catalogProducts.forEach(p => {
                const safeImg = sanitizeProductImage(p.image);
                if (p.name && safeImg) {
                    productImgMap.set(p.name.toLowerCase().trim(), safeImg);
                }
            });

            const formattedPayments = payments.map(p => {
                const tokenRecord = tokens.find(t => t.order_id === p.id);
                const licenseToken = tokenRecord ? tokenRecord.token : null;

                let userInfo = { email: '', name: '' };
                try {
                    const parsed: any = JSON.parse(p.user);
                    if (parsed && typeof parsed === 'object') {
                        userInfo = parsed as { email: string; name: string };
                    } else {
                        userInfo.email = p.user;
                    }
                } catch {
                    userInfo.email = p.user.substring(0, 30);
                }

                if (!userInfo.name) {
                    const foundUser = users.find(u => u.email === userInfo.email);
                    if (foundUser && foundUser.name) userInfo.name = foundUser.name;
                }

                let productName = '-';
                let durationDisplay = '-';
                let itemPrice = 0;
                try {
                    const items: any = typeof p.items === 'string' ? JSON.parse(p.items) : p.items;
                    if (items && Array.isArray(items) && items.length > 0) {
                        const firstItem = items[0];
                        productName = firstItem.name || '-';
                        durationDisplay = firstItem.duration_text || '-';
                        const rawPrice = firstItem.price ? String(firstItem.price) : '0';
                        itemPrice = parseInt(rawPrice) || 0;

                        if (firstItem.is_discount === '1' && firstItem.discount_percent) {
                            const rawDiscount = String(firstItem.discount_percent);
                            const discountPercent = parseInt(rawDiscount) || 0;
                            itemPrice = itemPrice - (itemPrice * discountPercent / 100);
                        }
                    } else if (items && typeof items === 'object') {
                        productName = items.name || '-';
                        durationDisplay = items.duration_text || '-';
                    }
                } catch (e) {
                    /* ignore parsing error */
                }

                let productImage: string | null = null;
                if (productName && productName !== '-') {
                    productImage = productImgMap.get(productName.toLowerCase().trim()) || null;
                    if (!productImage) {
                        const found = catalogProducts.find(cp => productName.toLowerCase().includes(cp.name.toLowerCase()) || cp.name.toLowerCase().includes(productName.toLowerCase()));
                        if (found && found.image) productImage = sanitizeProductImage(found.image);
                    }
                }

                const durationMonths = p.duration ? Math.max(1, Math.round(p.duration / 43800)) : 1;
                let totalAmount = 0;
                if (p.total_amount && Number(p.total_amount) > 0) {
                    totalAmount = Number(p.total_amount);
                } else if (itemPrice > 0) {
                    totalAmount = itemPrice * durationMonths;
                }

                const displayName = userInfo.name || userInfo.email || '-';
                const displayEmail = (userInfo.email && displayName !== userInfo.email) ? userInfo.email : '';

                let resolvedChannel = p.channel_code;
                if (!resolvedChannel || resolvedChannel.toUpperCase() === 'UNPAID') {
                    if (p.payment && p.payment.toUpperCase() !== 'UNPAID') {
                        resolvedChannel = p.payment;
                    } else if (p.payment_request_id) {
                        resolvedChannel = 'Xendit Gateway';
                    } else if (p.va_number) {
                        resolvedChannel = 'Virtual Account';
                    } else if (p.status === 'SUCCESS' || p.paid_at) {
                        resolvedChannel = 'Xendit Online';
                    } else {
                        resolvedChannel = 'Menunggu';
                    }
                }

                return {
                    id: p.id,
                    user: displayName,
                    email: displayEmail,
                    productName: productName.substring(0, 30) + (productName.length > 30 ? '...' : ''),
                    productImage: productImage,
                    durationDisplay: durationDisplay,
                    durationMonths: durationMonths,
                    totalAmount: totalAmount,
                    adminFee: p.admin_fee || 0,
                    channelCode: resolvedChannel,
                    status: p.status,
                    paymentRequestId: p.payment_request_id,
                    vaNumber: p.va_number,
                    paidAt: p.paid_at ? new Date(p.paid_at * 1000).toLocaleString('id-ID', { timeZone: timezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null,
                    createdAt: new Date(p.created * 1000).toLocaleString('id-ID', { timeZone: timezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
                    expiresAt: p.payment_expires_at ? new Date(p.payment_expires_at * 1000).toLocaleString('id-ID', { timeZone: timezone, day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null,
                    licenseToken: licenseToken,
                    invoiceToken: (p as any).invoice_token || null,
                };
            });

            const availableProducts = catalogProducts.map(p => ({
                id: p.id,
                name: p.name,
                image: sanitizeProductImage(p.image)
            }));

            return res.json({
                status: 'success',
                data: {
                    payments: formattedPayments,
                    totalPayments,
                    page,
                    totalPages: Math.ceil(totalPayments / perPage),
                    search,
                    sort,
                    order,
                    period,
                    product,
                    status: statusFilter,
                    counts: {
                        all: countAll,
                        pending: countPending,
                        paid: countPaid,
                        expired: countExpired
                    },
                    startDate,
                    endDate,
                    availableProducts
                }
            });
        } catch (error) {
            console.error('API Payments error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat daftar pembayaran' });
        }
    }

    /**
     * Show payments list (redirects to Svelte SPA or renders SSR)
     */
    async showPaymentsList(req: Request, res: Response) {
        try {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return this.apiGetPayments(req, res);
            }
            if (req.headers.accept && req.headers.accept.includes('text/html')) {
                return res.redirect('/#/admin/payments');
            }
            return this.apiGetPayments(req, res);
        } catch (error) {
            console.error('Payments list error:', error);
            res.redirect('/#/admin/payments');
        }
    }

    /**
     * Get detailed order & payment information including customer profile, tokens, and affiliate data
     */
    async apiGetPaymentDetail(req: Request, res: Response) {
        try {
            const rawId = (req.params.id || req.query.id || req.query.order_id) as string;
            const orderId = parseInt(rawId);
            if (isNaN(orderId)) {
                return res.status(400).json({ status: 'error', message: 'Order ID tidak valid' });
            }

            const order = await prisma.order_list.findUnique({
                where: { id: orderId }
            });

            if (!order) {
                return res.status(404).json({ status: 'error', message: 'Data pesanan/pembayaran tidak ditemukan' });
            }

            // Parse User Email / Name
            let customerEmail = '';
            let customerName = '';
            try {
                const parsedUser: any = JSON.parse(order.user);
                if (parsedUser && typeof parsedUser === 'object') {
                    customerEmail = parsedUser.email || '';
                    customerName = parsedUser.name || '';
                } else {
                    customerEmail = String(order.user);
                }
            } catch {
                customerEmail = String(order.user);
            }

            // Fetch Full Customer Profile
            let customerProfile: any = null;
            if (customerEmail) {
                customerProfile = await prisma.user.findFirst({
                    where: { email: customerEmail },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        whatsapp: true,
                        company: true,
                        verified: true,
                        banned: true,
                        created: true
                    }
                });
            }

            // Fetch License Activation Tokens
            const tokens = await prisma.token_device_activation.findMany({
                where: { order_id: orderId },
                orderBy: { id: 'desc' }
            });

            const formattedTokens = tokens.map(t => ({
                id: t.id,
                token: t.token,
                product: t.product,
                duration: t.duration,
                isActivated: t.taked === 1,
                takedAt: t.taked_at ? new Date(t.taked_at * 1000).toLocaleString('id-ID') : null,
                takedIp: t.taked_ip || null,
                user: t.user || null,
                createdAt: new Date(t.created * 1000).toLocaleString('id-ID')
            }));

            // Fetch Affiliate Commission
            const affiliateTx = await prisma.affiliate_transaksi.findFirst({
                where: {
                    OR: [
                        { invoice_code: `order_${orderId}` },
                        { invoice_code: String(orderId) },
                        { invoice_code: { contains: String(orderId) } }
                    ]
                }
            });

            let affiliateInfo: any = null;
            if (affiliateTx) {
                affiliateInfo = {
                    affiliatorEmail: affiliateTx.affiliator_email,
                    affiliateIncome: affiliateTx.affiliate_income,
                    alreadyPaid: affiliateTx.already_paid === 1,
                    productName: affiliateTx.product_name,
                    createdAt: affiliateTx.created_at ? new Date(affiliateTx.created_at * 1000).toLocaleString('id-ID') : null,
                    paidAt: affiliateTx.paid_at ? new Date(affiliateTx.paid_at * 1000).toLocaleString('id-ID') : null
                };
            }

            // Fetch catalog products to map images
            const catalogProducts = await prisma.products.findMany({
                select: { id: true, name: true, image: true }
            });
            const productImgMap = new Map<string, string>();
            catalogProducts.forEach(p => {
                const safeImg = sanitizeProductImage(p.image);
                if (p.name && safeImg) {
                    productImgMap.set(p.name.toLowerCase().trim(), safeImg);
                }
            });

            // Parse Items List
            let parsedItems: any[] = [];
            let durationDisplay = '-';
            try {
                const itemsData: any = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                if (Array.isArray(itemsData)) {
                    parsedItems = itemsData.map((item: any) => {
                        const rawPrice = item.price ? String(item.price) : '0';
                        const itemPrice = parseInt(rawPrice) || 0;
                        let discountPercent = 0;

                        if (item.is_discount === '1' && item.discount_percent) {
                            discountPercent = parseInt(String(item.discount_percent)) || 0;
                        }

                        if (!durationDisplay || durationDisplay === '-') {
                            durationDisplay = item.duration_text || '-';
                        }

                        const itemName = item.name || 'Produk AppCenter';
                        let itemImage = productImgMap.get(itemName.toLowerCase().trim()) || null;
                        if (!itemImage) {
                            const found = catalogProducts.find(cp => itemName.toLowerCase().includes(cp.name.toLowerCase()) || cp.name.toLowerCase().includes(itemName.toLowerCase()));
                            if (found && found.image) itemImage = sanitizeProductImage(found.image);
                        }

                        return {
                            name: itemName,
                            image: itemImage,
                            price: itemPrice,
                            discountPercent,
                            finalPrice: discountPercent > 0 ? itemPrice - (itemPrice * discountPercent / 100) : itemPrice,
                            durationText: item.duration_text || '-',
                            count: item.count || 1
                        };
                    });
                } else if (itemsData && typeof itemsData === 'object') {
                    durationDisplay = itemsData.duration_text || '-';
                    const itemName = itemsData.name || 'Produk AppCenter';
                    let itemImage = productImgMap.get(itemName.toLowerCase().trim()) || null;
                    if (!itemImage) {
                        const found = catalogProducts.find(cp => itemName.toLowerCase().includes(cp.name.toLowerCase()) || cp.name.toLowerCase().includes(itemName.toLowerCase()));
                        if (found && found.image) itemImage = sanitizeProductImage(found.image);
                    }

                    parsedItems = [{
                        name: itemName,
                        image: itemImage,
                        price: parseInt(String(itemsData.price || '0')) || 0,
                        discountPercent: 0,
                        finalPrice: parseInt(String(itemsData.price || '0')) || 0,
                        durationText: itemsData.duration_text || '-',
                        count: 1
                    }];
                }
            } catch {
                parsedItems = [];
            }

            const durationMonths = order.duration ? Math.max(1, Math.round(order.duration / 43800)) : 1;
            const statusStr = (order.status || '').toLowerCase();
            const isPaid = Boolean(order.paid_at) || statusStr.includes('complete') || statusStr.includes('success') || statusStr.includes('settled') || statusStr.includes('lunas');

            let resolvedChannel = order.channel_code;
            if (!resolvedChannel || resolvedChannel.toUpperCase() === 'UNPAID') {
                if (order.payment && order.payment.toUpperCase() !== 'UNPAID') {
                    resolvedChannel = order.payment;
                } else if (order.payment_id && order.payment_id.startsWith('qrpy_')) {
                    resolvedChannel = 'QRIS (Xendit)';
                } else if (order.va_number) {
                    resolvedChannel = 'Virtual Account';
                } else if (order.payment_url || order.payment_request_id) {
                    resolvedChannel = 'Xendit Gateway';
                } else if (order.confirmed_by && order.confirmed_by !== '-') {
                    resolvedChannel = 'Manual Transfer (Admin)';
                } else if (isPaid) {
                    resolvedChannel = 'Pembayaran Lunas';
                } else {
                    resolvedChannel = 'Belum Dipilih';
                }
            }

            // Parse Voucher Detail
            let voucherDetail: {
                code: string;
                decreaseValue: number;
                voucherType: string;
                displayDiscount?: string;
                affiliateEmail?: string;
                affiliateIncome?: number;
            } | null = null;

            if (order.voucer && typeof order.voucer === 'string' && order.voucer.trim()) {
                const trimmedVoucher = order.voucer.trim();
                try {
                    if (trimmedVoucher.startsWith('{') && trimmedVoucher.endsWith('}')) {
                        const parsed = JSON.parse(trimmedVoucher);
                        if (parsed && typeof parsed === 'object') {
                            const decreaseVal = Number(parsed.decrease_value) || 0;
                            const vType = parsed.voucer_type || '%';
                            let displayDiscount = '';
                            if (vType === '%') {
                                displayDiscount = `${decreaseVal}%`;
                            } else if (decreaseVal > 0) {
                                displayDiscount = `Rp ${decreaseVal.toLocaleString('id-ID')}`;
                            }
                            voucherDetail = {
                                code: String(parsed.code || 'VOUCHER'),
                                decreaseValue: decreaseVal,
                                voucherType: vType,
                                displayDiscount: displayDiscount || undefined,
                                affiliateEmail: parsed.affiliate_email,
                                affiliateIncome: parsed.affiliate_income ? Number(parsed.affiliate_income) : undefined
                            };
                        }
                    } else {
                        voucherDetail = {
                            code: trimmedVoucher,
                            decreaseValue: 0,
                            voucherType: ''
                        };
                    }
                } catch {
                    voucherDetail = {
                        code: trimmedVoucher,
                        decreaseValue: 0,
                        voucherType: ''
                    };
                }
            }

            let invoiceToken = (order as any).invoice_token || null;
            if (!invoiceToken) {
                try {
                    invoiceToken = await ensureOrderInvoiceToken(order.id);
                } catch {
                    // ignore
                }
            }

            return res.json({
                status: 'success',
                data: {
                    order: {
                        id: order.id,
                        status: order.status,
                        statusBadge: order.status_badge || null,
                        isPaid,
                        invoiceToken,
                        totalAmount: order.total_amount || 0,
                        adminFee: order.admin_fee || 0,
                        channelCode: resolvedChannel,
                        paymentMethod: (order.payment && order.payment !== 'UNPAID') ? order.payment : resolvedChannel,
                        paymentRequestId: order.payment_request_id || null,
                        paymentId: order.payment_id || null,
                        vaNumber: order.va_number || null,
                        qrString: order.qr_string || null,
                        paymentUrl: order.payment_url || null,
                        duration: order.duration,
                        durationMonths,
                        durationDisplay,
                        voucer: order.voucer || null,
                        voucherDetail,
                        note: order.note || '',
                        confirmedBy: order.confirmed_by || '-',
                        lastUpdated: order.last_updated || null,
                        createdAt: new Date(order.created * 1000).toLocaleString('id-ID'),
                        createdEpoch: order.created,
                        expiresAt: order.payment_expires_at ? new Date(order.payment_expires_at * 1000).toLocaleString('id-ID') : null,
                        paidAt: order.paid_at ? new Date(order.paid_at * 1000).toLocaleString('id-ID') : null
                    },
                    items: parsedItems,
                    customer: {
                        name: customerProfile?.name || customerName || (customerEmail ? customerEmail.split('@')[0] : 'Pelanggan'),
                        email: customerEmail || '-',
                        whatsapp: customerProfile?.whatsapp || null,
                        company: customerProfile?.company || null,
                        verified: customerProfile ? Boolean(customerProfile.verified) : false,
                        registeredAt: customerProfile?.created ? new Date(customerProfile.created * 1000).toLocaleDateString('id-ID') : null
                    },
                    tokens: formattedTokens,
                    affiliate: affiliateInfo
                }
            });
        } catch (error) {
            console.error('API Payment Detail error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat detail pembayaran' });
        }
    }

    /**
     * Legacy Webhook handler (Disabled for GoQRIS, as GoQRIS uses polling)
     */
    handleWebhook(req: Request, res: Response) {
        return res.status(200).json({ status: 'ignored', message: 'GoQRIS uses server-side status polling.' });
    }

    /**
     * Common logic to handle successful order payment
     * Marks order as paid, generates license token, and records affiliate commission
     */
    async processOrderSuccess(orderId: number, paymentId: string) {
        try {
            const order = await prisma.order_list.findUnique({ where: { id: orderId } });
            if (!order || order.status === 'Order has been complete') return;

            // 1. Atomic Update Order Status to prevent concurrent duplicate processing
            const updateResult = await prisma.order_list.updateMany({
                where: {
                    id: orderId,
                    status: { not: 'Order has been complete' }
                },
                data: {
                    status: 'Order has been complete',
                    status_badge: '#4285F4',
                    paid_at: Math.floor(Date.now() / 1000),
                    payment_id: paymentId,
                    last_updated: new Date().toISOString(),
                },
            });

            if (updateResult.count === 0) {
                console.log(`Order #${orderId} already completed, skipping duplicate processing.`);
                return;
            }

            console.log(`Order #${orderId} marked as completed`);

            // Extract clean user email (handle plain string or serialized JSON)
            let cleanUserEmail = order.user;
            try {
                const parsedUser: unknown = JSON.parse(order.user);
                if (parsedUser && typeof parsedUser === 'object' && (parsedUser as { email?: string }).email) {
                    cleanUserEmail = (parsedUser as { email: string }).email;
                }
            } catch {
                cleanUserEmail = order.user;
            }

            // 2. Create License Token
            const existingToken = await prisma.token_device_activation.findFirst({
                where: { order_id: orderId }
            });

            if (!existingToken) {
                let productName = 'App Product';
                try {
                    interface ItemType { name?: string }
                    const rawItems: unknown = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    if (Array.isArray(rawItems) && rawItems.length > 0) {
                        const firstItem = rawItems[0] as ItemType;
                        productName = firstItem.name || 'App Product';
                    } else if (rawItems && typeof rawItems === 'object') {
                        const itemObj = rawItems as ItemType;
                        if (itemObj && itemObj.name) {
                            productName = itemObj.name;
                        }
                    }
                } catch (e) { /* empty */ }

                // Generate Random Token
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                let token = '';
                for (let i = 0; i < 20; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));

                await prisma.token_device_activation.create({
                    data: {
                        token: token,
                        order_id: orderId,
                        product: productName,
                        duration: order.duration || 43800,
                        user: cleanUserEmail,
                        created: Math.floor(Date.now() / 1000),
                        taked: 0,
                        taked_at: 0,
                        taked_ip: ''
                    }
                });
                console.log(`Token generated for Order #${orderId}`);
            }

            // 3. Affiliate Commission Logic
            if (order.voucer) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                let voucherData: any = null;
                try {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    const parsed = typeof order.voucer === 'string' ? JSON.parse(order.voucer) : order.voucer;
                    if (parsed) voucherData = parsed;
                } catch (e) { /* empty */ }

                // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                if (voucherData && voucherData.affiliate_email) {
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument
                    const incomePercent = parseInt(voucherData.affiliate_income || '0') || 0;
                    const totalPaid = order.total_amount || 0;
                    const income = Math.round(totalPaid * incomePercent / 100);

                    if (income > 0) {
                        let affiliateCustomerName = 'Member';
                        let affiliateProductName = 'App Product';
                        try {
                            const customerUser = await prisma.user.findFirst({
                                where: { email: cleanUserEmail }
                            });
                            if (customerUser && customerUser.name) affiliateCustomerName = customerUser.name;
                        } catch (e) { /* empty */ }

                        try {
                            interface ItemType { name?: string }
                            const raw: unknown = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                            if (Array.isArray(raw) && raw.length > 0) {
                                const first = raw[0] as ItemType;
                                affiliateProductName = first.name || 'App Product';
                            } else if (raw && typeof raw === 'object') {
                                const obj = raw as ItemType;
                                if (obj && obj.name) affiliateProductName = obj.name;
                            }
                        } catch (e) { /* empty */ }

                        const now = new Date();
                        await prisma.affiliate_transaksi.create({
                            data: {
                                product_name: affiliateProductName,
                                created_at: Math.floor(Date.now() / 1000),
                                affiliate_income: income,
                                tanggal: now.getDate(),
                                bulan: now.getMonth() + 1,
                                tahun: now.getFullYear(),
                                invoice_code: `INV-${order.id}`,
                                already_paid: 0,
                                paid_at: null,
                                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
                                affiliator_email: voucherData.affiliate_email,
                                customer_email: cleanUserEmail,
                                customer_name: affiliateCustomerName,
                                customer_paid_price: totalPaid
                            }
                        });
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
                        console.log(`Affiliate commission recorded for ${voucherData.affiliate_email}: ${income}`);
                    }
                }
            }
        } catch (err) {
            console.error('Error in processOrderSuccess:', err);
        }
    }

    /**
     * Manual confirm payment by Admin
     */
    async confirmPaymentManually(req: Request, res: Response) {
        try {
            const orderId = parseInt(req.params.id as string);
            if (!orderId) return res.status(400).json({ error: 'Invalid Order ID' });

            await this.processOrderSuccess(orderId, 'MANUAL_CONFIRM_BY_ADMIN');

            res.json({ success: true, message: 'Payment confirmed successfully' });
        } catch (error) {
            console.error('Manual confirm error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    /**
     * Update Order Duration
     */
    async updateOrderDuration(req: Request, res: Response) {
        try {
            const orderId = parseInt(req.params.id as string, 10);
            const { duration } = req.body as { duration: number };

            if (!orderId || isNaN(orderId) || !duration || duration <= 0) {
                return res.status(400).json({ error: 'Invalid data' });
            }

            const durationMinutes = duration * 43800; // month to minutes

            // Update order duration
            await prisma.order_list.update({
                where: { id: orderId },
                data: {
                    duration: durationMinutes,
                    last_updated: new Date().toISOString()
                }
            });

            // Update license duration if already exists
            await prisma.token_device_activation.updateMany({
                where: { order_id: orderId },
                data: {
                    duration: durationMinutes
                }
            });

            // Also synchronize active devices duration and expiration timestamp
            const devices = await prisma.device.findMany({
                where: { order_id: orderId }
            });
            for (const dev of devices) {
                const newExpired = dev.created + (durationMinutes * 60);
                await prisma.device.update({
                    where: { id: dev.id },
                    data: {
                        duration: durationMinutes,
                        expired: newExpired
                    }
                });
            }

            res.json({ success: true, message: 'Duration updated successfully' });
        } catch (error) {
            console.error('Update duration error:', error);
            res.status(500).json({ error: 'Internal Server Error' });
        }
    }

    /**
     * API Get Affiliate (JSON for Svelte SPA)
     * Full Server-Side Filtering, Searching, Sorting & Pagination
     */
    async apiGetAffiliate(req: Request, res: Response) {
        try {
            const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
            const pageSize = Math.max(1, Math.min(100, parseInt((req.query.pageSize || req.query.limit) as string, 10) || 10));
            const search = ((req.query.search as string) || '').trim().toLowerCase();
            const tab = ((req.query.tab as string) || 'all').trim().toLowerCase();
            const bankFilter = ((req.query.bank as string) || 'all').trim().toUpperCase();
            const sort = ((req.query.sort as string) || 'pending_desc').trim();

            // 1. Calculate Global Summary Stats
            const totalPaidResult = await prisma.affiliate_payouts.aggregate({
                _sum: { amount: true }
            });
            const totalPaid = totalPaidResult._sum.amount || 0;

            const totalUnpaidResult = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: { already_paid: 0 }
            });
            const totalUnpaid = totalUnpaidResult._sum.affiliate_income || 0;

            // Monthly stats
            const now = new Date();
            const firstDayThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);

            const incomeThisMonthResult = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: {
                    created_at: { gte: Math.floor(firstDayThisMonth.getTime() / 1000) }
                }
            });
            const incomeThisMonth = incomeThisMonthResult._sum.affiliate_income || 0;

            const incomeLastMonthResult = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: {
                    created_at: {
                        gte: Math.floor(firstDayLastMonth.getTime() / 1000),
                        lte: Math.floor(lastDayLastMonth.getTime() / 1000)
                    }
                }
            });
            const incomeLastMonth = incomeLastMonthResult._sum.affiliate_income || 0;

            // Fetch all affiliate members to compute dynamic trends & relations
            const members = await prisma.affiliate_member.findMany();
            const memberEmails = members.map(m => m.email);

            // Fetch paid payouts per member
            const paidPayouts = await prisma.affiliate_payouts.findMany({
                where: { affiliate_email: { in: memberEmails } },
                select: { affiliate_email: true, amount: true }
            });
            const paidMap = new Map<string, number>();
            paidPayouts.forEach(p => {
                paidMap.set(p.affiliate_email, (paidMap.get(p.affiliate_email) || 0) + (p.amount || 0));
            });

            // Fetch recent transactions
            const transactions = await prisma.affiliate_transaksi.findMany({
                where: {
                    affiliator_email: { in: memberEmails },
                    created_at: {
                        gte: Math.floor(firstDayLastMonth.getTime() / 1000)
                    }
                },
                select: {
                    affiliator_email: true,
                    affiliate_income: true,
                    created_at: true
                }
            });

            // Fetch catalog products to map images
            const catalogProducts = await prisma.products.findMany({
                select: { id: true, name: true, image: true }
            });
            const productImgMap = new Map<string, string>();
            catalogProducts.forEach(p => {
                const safeImg = sanitizeProductImage(p.image);
                if (p.name && safeImg) {
                    productImgMap.set(p.name.toLowerCase().trim(), safeImg);
                }
            });

            // Fetch unpaid transactions
            const unpaidTransactionsAll = await prisma.affiliate_transaksi.findMany({
                where: {
                    affiliator_email: { in: memberEmails },
                    already_paid: 0
                },
                orderBy: { created_at: 'desc' },
                select: {
                    affiliator_email: true,
                    affiliate_income: true,
                    product_name: true,
                    invoice_code: true,
                    created_at: true
                }
            });

            const formattedUnpaidAll = unpaidTransactionsAll.map(ut => {
                let productImage: string | null = null;
                if (ut.product_name) {
                    productImage = productImgMap.get(ut.product_name.toLowerCase().trim()) || null;
                    if (!productImage) {
                        const found = catalogProducts.find(cp => ut.product_name.toLowerCase().includes(cp.name.toLowerCase()) || cp.name.toLowerCase().includes(ut.product_name.toLowerCase()));
                        if (found && found.image) productImage = sanitizeProductImage(found.image);
                    }
                }
                return {
                    ...ut,
                    product_image: productImage
                };
            });

            let betterCount = 0;
            let worseCount = 0;
            const availableBanksSet = new Set<string>();
            let hasUnsetBank = false;

            const startLastMonth = Math.floor(firstDayLastMonth.getTime() / 1000);
            const endLastMonth = Math.floor(lastDayLastMonth.getTime() / 1000);
            const startThisMonth = Math.floor(firstDayThisMonth.getTime() / 1000);

            // 1-pass index transactions by affiliator_email (O(M))
            const transSummaryMap = new Map<string, { lastMonth: number; thisMonth: number }>();
            for (const t of transactions) {
                let entry = transSummaryMap.get(t.affiliator_email);
                if (!entry) {
                    entry = { lastMonth: 0, thisMonth: 0 };
                    transSummaryMap.set(t.affiliator_email, entry);
                }
                const income = t.affiliate_income || 0;
                if (t.created_at >= startLastMonth && t.created_at <= endLastMonth) {
                    entry.lastMonth += income;
                } else if (t.created_at >= startThisMonth) {
                    entry.thisMonth += income;
                }
            }

            // 1-pass index unpaid transactions by affiliator_email (O(U))
            const unpaidMap = new Map<string, typeof formattedUnpaidAll>();
            const pendingCommissionMap = new Map<string, number>();
            for (const ut of formattedUnpaidAll) {
                let list = unpaidMap.get(ut.affiliator_email);
                if (!list) {
                    list = [];
                    unpaidMap.set(ut.affiliator_email, list);
                }
                list.push(ut);
                pendingCommissionMap.set(
                    ut.affiliator_email,
                    (pendingCommissionMap.get(ut.affiliator_email) || 0) + (ut.affiliate_income || 0)
                );
            }

            const processedMembers = members.map(m => {
                const transSummary = transSummaryMap.get(m.email) || { lastMonth: 0, thisMonth: 0 };
                const incomeLastMonthMember = transSummary.lastMonth;
                const incomeThisMonthMember = transSummary.thisMonth;

                const memberUnpaid = unpaidMap.get(m.email) || [];
                const pendingCommission = pendingCommissionMap.get(m.email) || 0;
                const paidCommission = paidMap.get(m.email) || 0;

                let trend = 'SAME';
                let percentageChange = 0;

                if (incomeLastMonthMember > 0) {
                    percentageChange = ((incomeThisMonthMember - incomeLastMonthMember) / incomeLastMonthMember) * 100;
                } else if (incomeThisMonthMember > 0) {
                    percentageChange = 100;
                }

                if (incomeThisMonthMember > incomeLastMonthMember) {
                    trend = 'UP';
                    betterCount++;
                } else if (incomeThisMonthMember < incomeLastMonthMember) {
                    trend = 'DOWN';
                    worseCount++;
                }

                const bankName = (m.payout_bank_name || '').trim();
                const noRek = (m.payout_no_rek || '').trim();
                const isBankSet = Boolean(bankName && bankName !== '-' && noRek && noRek !== '-');

                if (isBankSet) {
                    availableBanksSet.add(bankName.toUpperCase());
                } else {
                    hasUnsetBank = true;
                }

                return {
                    id: m.id,
                    email: m.email,
                    memberSince: m.created ? new Date(m.created * 1000).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    }) : '-',
                    created_timestamp: m.created || 0,
                    kupon: m.kupon || '-',
                    bank_name: m.payout_bank_name || '-',
                    no_rek: m.payout_no_rek || '-',
                    owner_name: m.payout_name || '-',
                    isBankSet,
                    pendingCommission,
                    paidCommission,
                    unpaidCount: memberUnpaid.length,
                    unpaidTransactions: memberUnpaid,
                    incomeLastMonth: incomeLastMonthMember,
                    incomeThisMonth: incomeThisMonthMember,
                    trend,
                    percentageChange: Math.abs(Math.round(percentageChange))
                };
            });

            // Tab counts across ALL members
            const tabCounts = {
                all: processedMembers.length,
                unpaid: processedMembers.filter(m => m.pendingCommission > 0).length,
                bank_set: processedMembers.filter(m => m.isBankSet).length,
                no_bank: processedMembers.filter(m => !m.isBankSet).length
            };

            // 2. Server-Side Filtering
            let filtered = processedMembers;

            // Search filter
            if (search) {
                filtered = filtered.filter(m => {
                    return (
                        m.email.toLowerCase().includes(search) ||
                        m.kupon.toLowerCase().includes(search) ||
                        m.bank_name.toLowerCase().includes(search) ||
                        m.owner_name.toLowerCase().includes(search) ||
                        m.no_rek.toLowerCase().includes(search)
                    );
                });
            }

            // Tab filter
            if (tab === 'unpaid') {
                filtered = filtered.filter(m => m.pendingCommission > 0);
            } else if (tab === 'bank_set') {
                filtered = filtered.filter(m => m.isBankSet);
            } else if (tab === 'no_bank') {
                filtered = filtered.filter(m => !m.isBankSet);
            }

            // Bank filter
            if (bankFilter && bankFilter !== 'ALL') {
                if (bankFilter === 'UNSET') {
                    filtered = filtered.filter(m => !m.isBankSet);
                } else {
                    filtered = filtered.filter(m => m.bank_name.toUpperCase().includes(bankFilter));
                }
            }

            // 3. Server-Side Sorting
            filtered.sort((a, b) => {
                if (sort === 'pending_desc') return b.pendingCommission - a.pendingCommission;
                if (sort === 'pending_asc') return a.pendingCommission - b.pendingCommission;
                if (sort === 'income_desc') return b.incomeThisMonth - a.incomeThisMonth;
                if (sort === 'paid_desc') return b.paidCommission - a.paidCommission;
                if (sort === 'bank_status') return (b.isBankSet ? 1 : 0) - (a.isBankSet ? 1 : 0);
                if (sort === 'bank_unset_first') return (a.isBankSet ? 1 : 0) - (b.isBankSet ? 1 : 0);
                if (sort === 'email_desc') return b.email.localeCompare(a.email);
                if (sort === 'kupon_asc') return a.kupon.localeCompare(b.kupon);
                if (sort === 'newest') return b.created_timestamp - a.created_timestamp;
                return a.email.localeCompare(b.email);
            });

            // 4. Server-Side Pagination
            const total = filtered.length;
            const totalPages = Math.max(1, Math.ceil(total / pageSize));
            const paginatedMembers = filtered.slice((page - 1) * pageSize, page * pageSize);

            let overallTrendText = 'STABLE';
            let overallPercentage = 0;

            if (incomeLastMonth > 0) {
                overallPercentage = ((incomeThisMonth - incomeLastMonth) / incomeLastMonth) * 100;
            } else if (incomeThisMonth > 0) {
                overallPercentage = 100;
            }

            if (incomeThisMonth > incomeLastMonth) overallTrendText = 'UP';
            else if (incomeThisMonth < incomeLastMonth) overallTrendText = 'DOWN';

            return res.json({
                status: 'success',
                data: {
                    stats: {
                        totalPaid,
                        totalUnpaid,
                        incomeThisMonth,
                        incomeLastMonth,
                        betterCount,
                        worseCount,
                        overallTrend: overallTrendText,
                        overallPercentage: Math.abs(Math.round(overallPercentage))
                    },
                    tabCounts,
                    availableBanks: Array.from(availableBanksSet).sort(),
                    hasUnsetBank,
                    members: paginatedMembers,
                    pagination: {
                        page,
                        pageSize,
                        total,
                        totalPages
                    },
                    search,
                    tab,
                    bank: bankFilter,
                    sort
                }
            });
        } catch (error) {
            console.error('API Affiliate error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat data affiliate' });
        }
    }


    /**
     * Show Affiliate Management (redirects to Svelte SPA or SSR)
     */
    async showAffiliateManagement(req: Request, res: Response) {
        try {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return this.apiGetAffiliate(req, res);
            }
            if (req.headers.accept && req.headers.accept.includes('text/html')) {
                return res.redirect('/#/admin/affiliate');
            }
            return this.apiGetAffiliate(req, res);
        } catch (error) {
            console.error('Admin Affiliate Management Error:', error);
            res.redirect('/#/admin/affiliate');
        }
    }

    /**
     * Mark Affiliate Commissions as Paid (Bulk)
     */
    async markAffiliateAsPaid(req: Request, res: Response) {
        try {
            const { email } = req.body as { email: string };

            if (!email) {
                return res.status(400).json({ status: 'error', error: 'Affiliate email is required', message: 'Affiliate email is required' });
            }

            const pendingParams = {
                where: {
                    affiliator_email: email,
                    already_paid: 0
                }
            };

            const aggregate = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: pendingParams.where
            });

            const totalAmount = aggregate._sum.affiliate_income || 0;

            if (totalAmount <= 0) {
                return res.status(400).json({ status: 'error', error: 'No pending commissions to pay', message: 'Tidak ada komisi yang tertunda' });
            }

            const adminName = req.session.adminName || (req.session as any).admin || 'Admin';
            await prisma.affiliate_payouts.create({
                data: {
                    affiliate_email: email,
                    amount: totalAmount,
                    created: Math.floor(Date.now() / 1000),
                    accepted_by: adminName,
                    note: 'Pembayaran Komisi Affiliate'
                }
            });

            const updated = await prisma.affiliate_transaksi.updateMany({
                where: pendingParams.where,
                data: {
                    already_paid: 1,
                    paid_at: Math.floor(Date.now() / 1000)
                }
            });

            res.json({
                status: 'success',
                success: true,
                message: `Berhasil mencairkan komisi untuk ${email}. Total: Rp ${totalAmount.toLocaleString('id-ID')}`,
                count: updated.count,
                amount: totalAmount
            });

        } catch (error) {
            console.error('Error marking affiliate as paid:', error);
            res.status(500).json({ status: 'error', error: 'Internal Server Error', message: 'Gagal mencairkan komisi' });
        }
    }

    /**
     * API: Update Affiliate Member Bank Account (Admin)
     */
    async apiUpdateAffiliateMemberBank(req: Request, res: Response) {
        try {
            const { id, email, bank_name, no_rek, owner_name } = req.body as {
                id?: number | string;
                email?: string;
                bank_name?: string;
                no_rek?: string;
                owner_name?: string;
            };

            const memberId = id ? parseInt(String(id), 10) : undefined;
            const targetEmail = (email || '').trim();

            if (!memberId && !targetEmail) {
                return res.status(400).json({ status: 'error', message: 'ID atau Email mitra affiliate wajib diisi' });
            }

            const cleanBank = (bank_name || '').trim();
            const cleanRek = (no_rek || '').replace(/\s+/g, '');
            const cleanOwner = (owner_name || '').trim().toUpperCase();

            // Strict 4 banks validation matching database
            const validBanks: Record<string, { regex: RegExp; digits: string }> = {
                'BCA': { regex: /^\d{10}$/, digits: '10 digit angka' },
                'BNI': { regex: /^\d{10}$/, digits: '10 digit angka' },
                'BRI': { regex: /^\d{15}$/, digits: '15 digit angka' },
                'MANDIRI': { regex: /^\d{13}$/, digits: '13 digit angka' }
            };

            const normalizedBankKey = cleanBank.toUpperCase();
            if (cleanBank && !validBanks[normalizedBankKey]) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Bank tidak valid. Pilihan bank resmi: BCA, BNI, BRI, atau Mandiri.'
                });
            }

            if (cleanRek && normalizedBankKey && validBanks[normalizedBankKey]) {
                if (!validBanks[normalizedBankKey].regex.test(cleanRek)) {
                    return res.status(400).json({
                        status: 'error',
                        message: `Format nomor rekening ${cleanBank} tidak valid. Wajib ${validBanks[normalizedBankKey].digits}.`
                    });
                }
            }

            // Find member
            const member = await prisma.affiliate_member.findFirst({
                where: {
                    OR: [
                        ...(memberId ? [{ id: memberId }] : []),
                        ...(targetEmail ? [{ email: targetEmail }] : [])
                    ]
                }
            });

            if (!member) {
                return res.status(404).json({ status: 'error', message: 'Data mitra affiliate tidak ditemukan' });
            }

            // Canonical bank name format
            const canonicalBankName = normalizedBankKey === 'MANDIRI' ? 'Mandiri' : (normalizedBankKey || null);

            const updated = await prisma.affiliate_member.update({
                where: { id: member.id },
                data: {
                    payout_bank_name: canonicalBankName,
                    payout_no_rek: cleanRek || null,
                    payout_name: cleanOwner || null
                }
            });

            return res.json({
                status: 'success',
                message: `Rekening affiliate ${member.email} berhasil diperbarui`,
                data: {
                    id: updated.id,
                    email: updated.email,
                    bank_name: updated.payout_bank_name,
                    no_rek: updated.payout_no_rek,
                    owner_name: updated.payout_name
                }
            });

        } catch (error) {
            console.error('Error updating affiliate member bank:', error);
            res.status(500).json({ status: 'error', message: 'Gagal memperbarui rekening bank mitra' });
        }
    }

    /**
     * API Get Products (JSON for Svelte SPA)
     */
    async apiGetProducts(req: Request, res: Response) {
        try {
            const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
            const pageSize = Math.max(1, Math.min(100, parseInt((req.query.pageSize || req.query.limit || req.query.per_page) as string, 10) || 10));
            const search = (req.query.search as string || '').trim();
            const categoryParam = req.query.category_id as string | undefined;
            const status = (req.query.status as string || 'all').toLowerCase();
            const sort = (req.query.sort as string || 'status-active').toLowerCase();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const where: any = {};

            // 1. Search Query
            if (search) {
                const searchNum = parseInt(search, 10);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const searchConditions: any[] = [
                    { name: { contains: search } },
                    { description: { contains: search } }
                ];
                if (!isNaN(searchNum)) {
                    searchConditions.push({ id: searchNum });
                    searchConditions.push({ product_id: searchNum });
                }
                where.OR = searchConditions;
            }

            // 2. Category Filter (Multi-category aware)
            if (categoryParam && categoryParam !== 'all') {
                const catId = parseInt(categoryParam, 10);
                if (!isNaN(catId)) {
                    const catConditions = [
                        { category_id: catId },
                        { category_ids: { contains: `[${catId}]` } },
                        { category_ids: { contains: `[${catId},` } },
                        { category_ids: { contains: `,${catId},` } },
                        { category_ids: { contains: `,${catId}]` } },
                        { category_ids: { contains: ` ${catId},` } },
                        { category_ids: { contains: ` ${catId}]` } },
                        { category_ids: { contains: `"${catId}"` } },
                        { category_ids: { contains: `${catId}` } }
                    ];
                    if (where.OR) {
                        where.AND = [
                            { OR: where.OR },
                            { OR: catConditions }
                        ];
                        delete where.OR;
                    } else {
                        where.OR = catConditions;
                    }
                }
            }

            // 3. Status Filter
            if (status === 'active') {
                where.is_active = true;
            } else if (status === 'inactive') {
                where.is_active = false;
            } else if (status === 'discount') {
                where.is_discount = true;
                where.discount_percent = { gt: 0 };
            }

            // 4. Sorting: Default to Status Aktif Dahulu (Active first)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let orderBy: any = [{ is_active: 'desc' }, { id: 'desc' }];
            if (sort === 'newest') {
                orderBy = { id: 'desc' };
            } else if (sort === 'status-active') {
                orderBy = [{ is_active: 'desc' }, { id: 'desc' }];
            } else if (sort === 'status-inactive') {
                orderBy = [{ is_active: 'asc' }, { id: 'desc' }];
            } else if (sort === 'name') {
                orderBy = { name: 'asc' };
            } else if (sort === 'price-asc') {
                orderBy = { price: 'asc' };
            } else if (sort === 'price-desc') {
                orderBy = { price: 'desc' };
            }

            const skip = (page - 1) * pageSize;
            const take = pageSize;

            const [products, totalFiltered, totalAll, activeCount, discountCount, categoriesList] = await Promise.all([
                prisma.products.findMany({
                    where,
                    orderBy,
                    skip,
                    take
                }),
                prisma.products.count({ where }),
                prisma.products.count(),
                prisma.products.count({ where: { is_active: true } }),
                prisma.products.count({ where: { is_discount: true, discount_percent: { gt: 0 } } }),
                prisma.categories.findMany({
                    select: { id: true, name: true, slug: true, icon: true },
                    orderBy: { name: 'asc' }
                })
            ]);

            const catMap = new Map(categoriesList.map(c => [c.id, c]));
            const enrichedProducts = products.map(p => {
                let ids: number[] = [];
                if (p.category_ids) {
                    try {
                        const parsed = typeof p.category_ids === 'string' ? JSON.parse(p.category_ids) : p.category_ids;
                        if (Array.isArray(parsed)) {
                            ids = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
                        }
                    } catch {
                        ids = [];
                    }
                }
                if (ids.length === 0 && p.category_id) {
                    ids = [p.category_id];
                }
                ids = Array.from(new Set(ids));
                const matchedCats = ids.map(id => catMap.get(id)).filter(Boolean) as Array<{ id: number; name: string; slug: string; icon: string }>;
                const categoryName = matchedCats.map(c => c.name).join(', ') || null;

                return {
                    ...p,
                    image: sanitizeProductImage(p.image),
                    category_ids: ids,
                    category_id: ids[0] || p.category_id || null,
                    category_name: categoryName,
                    categories: matchedCats,
                    parsed_installer_files: sftpService.parseInstallerFiles(p.installer_files)
                };
            });

            const totalPages = Math.ceil(totalFiltered / pageSize) || 1;

            return res.json({
                status: 'success',
                data: {
                    products: enrichedProducts,
                    categories: categoriesList,
                    pagination: {
                        page,
                        pageSize,
                        total: totalFiltered,
                        totalPages
                    },
                    stats: {
                        total: totalAll,
                        active: activeCount,
                        inactive: Math.max(0, totalAll - activeCount),
                        discount: discountCount
                    }
                }
            });
        } catch (error) {
            console.error('API Products error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat katalog produk' });
        }
    }

    /**
     * Show Products List (/admin/products) (redirects to Svelte SPA or SSR)
     */
    async showProductsList(req: Request, res: Response) {
        try {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return this.apiGetProducts(req, res);
            }
            if (req.headers.accept && req.headers.accept.includes('text/html')) {
                return res.redirect('/#/admin/products');
            }
            return this.apiGetProducts(req, res);
        } catch (error) {
            console.error('Error rendering products page:', error);
            res.redirect('/#/admin/products');
        }
    }

    /**
     * Process Create Product (/admin/products/create)
     */
    async processCreateProduct(req: Request, res: Response) {
        const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
        try {
            const body = req.body as {
                name?: string;
                product_id?: string | number;
                price?: string | number;
                category_id?: string | number | null;
                category_ids?: unknown;
                is_discount?: string | boolean;
                discount_percent?: string | number;
                is_active?: string | boolean;
                is_bundle?: string | boolean;
                bundle_items?: unknown;
                description?: string;
                image?: string;
                tutorials?: unknown;
            };

            const name = body.name ? body.name.trim() : '';
            const price = body.price !== undefined ? parseFloat(String(body.price)) : NaN;

            if (!name || isNaN(price) || price < 0) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Nama produk dan harga dasar wajib diisi' });
                return res.redirect('/admin/products?error=Nama produk dan harga dasar (valid) wajib diisi');
            }

            let generatedProductId = Math.floor(100000 + Math.random() * 900000);
            let attempts = 0;
            const MAX_ATTEMPTS = 10;
            let exists = await prisma.products.findFirst({ where: { product_id: generatedProductId } });
            while (exists && attempts < MAX_ATTEMPTS) {
                attempts++;
                generatedProductId = Math.floor(100000 + Math.random() * 900000);
                exists = await prisma.products.findFirst({ where: { product_id: generatedProductId } });
            }
            if (exists) {
                generatedProductId = Math.floor(Date.now() % 1000000);
            }

            let categoryIdsToSave: number[] = [];
            if (body.category_ids !== undefined && body.category_ids !== null) {
                if (Array.isArray(body.category_ids)) {
                    categoryIdsToSave = body.category_ids.map(Number).filter(n => !isNaN(n) && n > 0);
                } else if (typeof body.category_ids === 'string') {
                    try {
                        const parsed = JSON.parse(body.category_ids);
                        if (Array.isArray(parsed)) {
                            categoryIdsToSave = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
                        } else if (!isNaN(parseInt(body.category_ids, 10))) {
                            categoryIdsToSave = [parseInt(body.category_ids, 10)];
                        }
                    } catch {
                        categoryIdsToSave = body.category_ids.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
                    }
                } else if (typeof body.category_ids === 'number') {
                    categoryIdsToSave = [body.category_ids];
                }
            } else if (body.category_id !== undefined && body.category_id !== '' && body.category_id !== null) {
                const single = parseInt(String(body.category_id), 10);
                if (!isNaN(single) && single > 0) categoryIdsToSave = [single];
            }
            categoryIdsToSave = Array.from(new Set(categoryIdsToSave));
            const primaryCategoryId = categoryIdsToSave[0] || null;
            const categoryIdsJson = categoryIdsToSave.length > 0 ? JSON.stringify(categoryIdsToSave) : null;

            const isDiscount = Boolean(body.is_discount);
            const discountPercent = isDiscount && body.discount_percent !== undefined
                ? parseInt(String(body.discount_percent), 10) || 0
                : 0;
            const isActive = Boolean(body.is_active !== undefined ? body.is_active : true);
            const isBundle = Boolean(body.is_bundle);
            let bundleItemsJson: string | null = null;
            if (isBundle && body.bundle_items) {
                if (Array.isArray(body.bundle_items)) {
                    bundleItemsJson = JSON.stringify(body.bundle_items.map(Number).filter(n => !isNaN(n) && n > 0));
                } else if (typeof body.bundle_items === 'string') {
                    try {
                        const parsed = JSON.parse(body.bundle_items);
                        if (Array.isArray(parsed)) {
                            bundleItemsJson = JSON.stringify(parsed.map(Number).filter(n => !isNaN(n) && n > 0));
                        } else {
                            bundleItemsJson = body.bundle_items;
                        }
                    } catch {
                        bundleItemsJson = JSON.stringify(body.bundle_items.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0));
                    }
                }
            }

            const sanitizedTutorials = sanitizeTutorials(body.tutorials);
            const expandedTutorials = await expandTutorialsWithPlaylists(sanitizedTutorials);
            const tutorialsJson = JSON.stringify(expandedTutorials);

            const product = await prisma.products.create({
                data: {
                    name: name,
                    product_id: generatedProductId,
                    category_id: primaryCategoryId,
                    category_ids: categoryIdsJson,
                    price: price,
                    is_discount: isDiscount,
                    discount_percent: discountPercent,
                    is_active: isActive,
                    is_bundle: isBundle,
                    bundle_items: bundleItemsJson,
                    description: body.description ? body.description.trim() : '',
                    image: body.image || '',
                    tutorials: tutorialsJson
                }
            });

            if (isJson) {
                return res.json({
                    status: 'success',
                    message: 'Produk baru berhasil ditambahkan',
                    data: product
                });
            }

            return res.redirect('/admin/products?success=Produk baru berhasil ditambahkan');
        } catch (error) {
            console.error('Error creating product:', error);
            if (isJson) return res.status(500).json({ status: 'error', message: 'Gagal menambahkan produk' });
            return res.redirect('/admin/products?error=Gagal menambahkan produk');
        }
    }

    /**
     * Process Edit Product (/admin/products/edit/:id)
     */
    async processEditProduct(req: Request, res: Response) {
        const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
        try {
            const productId = parseInt(req.params.id as string, 10);
            if (isNaN(productId)) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'ID produk tidak valid' });
                return res.redirect('/admin/products?error=ID produk tidak valid');
            }

            const body = req.body as {
                name?: string;
                product_id?: string | number;
                price?: string | number;
                category_id?: string | number | null;
                category_ids?: unknown;
                is_discount?: string | boolean;
                discount_percent?: string | number;
                is_active?: string | boolean;
                is_bundle?: string | boolean;
                bundle_items?: unknown;
                description?: string;
                image?: string;
                tutorials?: unknown;
            };

            const name = body.name ? body.name.trim() : '';
            const price = body.price !== undefined ? parseFloat(String(body.price)) : NaN;

            if (!name || isNaN(price) || price < 0) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Nama produk dan harga dasar wajib diisi' });
                return res.redirect('/admin/products?error=Nama produk dan harga dasar (valid) wajib diisi');
            }

            let categoryIdsToSave: number[] = [];
            if (body.category_ids !== undefined && body.category_ids !== null) {
                if (Array.isArray(body.category_ids)) {
                    categoryIdsToSave = body.category_ids.map(Number).filter(n => !isNaN(n) && n > 0);
                } else if (typeof body.category_ids === 'string') {
                    try {
                        const parsed = JSON.parse(body.category_ids);
                        if (Array.isArray(parsed)) {
                            categoryIdsToSave = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
                        } else if (!isNaN(parseInt(body.category_ids, 10))) {
                            categoryIdsToSave = [parseInt(body.category_ids, 10)];
                        }
                    } catch {
                        categoryIdsToSave = body.category_ids.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
                    }
                } else if (typeof body.category_ids === 'number') {
                    categoryIdsToSave = [body.category_ids];
                }
            } else if (body.category_id !== undefined && body.category_id !== '' && body.category_id !== null) {
                const single = parseInt(String(body.category_id), 10);
                if (!isNaN(single) && single > 0) categoryIdsToSave = [single];
            }
            categoryIdsToSave = Array.from(new Set(categoryIdsToSave));
            const primaryCategoryId = categoryIdsToSave[0] || null;
            const categoryIdsJson = categoryIdsToSave.length > 0 ? JSON.stringify(categoryIdsToSave) : null;

            const isDiscount = Boolean(body.is_discount);
            const discountPercent = isDiscount && body.discount_percent !== undefined
                ? parseInt(String(body.discount_percent), 10) || 0
                : 0;
            const isActive = Boolean(body.is_active);
            const isBundle = Boolean(body.is_bundle);
            let bundleItemsJson: string | null = null;
            if (isBundle && body.bundle_items) {
                if (Array.isArray(body.bundle_items)) {
                    bundleItemsJson = JSON.stringify(body.bundle_items.map(Number).filter(n => !isNaN(n) && n > 0));
                } else if (typeof body.bundle_items === 'string') {
                    try {
                        const parsed = JSON.parse(body.bundle_items);
                        if (Array.isArray(parsed)) {
                            bundleItemsJson = JSON.stringify(parsed.map(Number).filter(n => !isNaN(n) && n > 0));
                        } else {
                            bundleItemsJson = body.bundle_items;
                        }
                    } catch {
                        bundleItemsJson = JSON.stringify(body.bundle_items.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0));
                    }
                }
            }

            const sanitizedTutorials = sanitizeTutorials(body.tutorials);
            const expandedTutorials = await expandTutorialsWithPlaylists(sanitizedTutorials);
            const tutorialsJson = JSON.stringify(expandedTutorials);

            const updated = await prisma.products.update({
                where: { id: productId },
                data: {
                    name: name,
                    price: price,
                    category_id: primaryCategoryId,
                    category_ids: categoryIdsJson,
                    is_discount: isDiscount,
                    discount_percent: discountPercent,
                    is_active: isActive,
                    is_bundle: isBundle,
                    bundle_items: bundleItemsJson,
                    description: body.description ? body.description.trim() : '',
                    image: body.image || '',
                    tutorials: tutorialsJson
                }
            });

            if (isJson) {
                return res.json({
                    status: 'success',
                    message: 'Data produk berhasil diperbarui',
                    data: updated
                });
            }

            return res.redirect('/admin/products?success=Data produk berhasil diperbarui');
        } catch (error) {
            console.error('Error updating product:', error);
            if (isJson) return res.status(500).json({ status: 'error', message: 'Gagal memperbarui produk' });
            return res.redirect('/admin/products?error=Gagal memperbarui produk');
        }
    }

    /**
     * Process Delete Product (/admin/products/delete/:id)
     */
    async processDeleteProduct(req: Request, res: Response) {
        const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
        try {
            const productId = parseInt(req.params.id as string, 10);
            if (isNaN(productId) || productId <= 0) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'ID produk tidak valid' });
                return res.redirect('/admin/products?error=ID produk tidak valid');
            }

            const product = await prisma.products.findUnique({ where: { id: productId } });
            if (!product) {
                if (isJson) return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan' });
                return res.redirect('/admin/products?error=Produk tidak ditemukan');
            }

            // Remove product image if local file
            if (product.image && product.image.startsWith('/uploads/products/')) {
                const imgPath = path.join(process.cwd(), 'public', product.image);
                if (fs.existsSync(imgPath)) {
                    try { fs.unlinkSync(imgPath); } catch (e) { console.warn('Failed to delete product image:', e); }
                }
            }

            await prisma.products.delete({
                where: { id: productId }
            });

            if (isJson) {
                return res.json({
                    status: 'success',
                    message: 'Produk berhasil dihapus'
                });
            }

            return res.redirect('/admin/products?success=Produk berhasil dihapus');
        } catch (error) {
            console.error('Error deleting product:', error);
            if (isJson) return res.status(500).json({ status: 'error', message: 'Gagal menghapus produk' });
            return res.redirect('/admin/products?error=Gagal menghapus produk');
        }
    }

    /**
     * Process Toggle Product Status (/admin/products/toggle-status/:id)
     */
    async processToggleProductStatus(req: Request, res: Response) {
        try {
            const productId = parseInt(req.params.id as string, 10);
            if (isNaN(productId)) {
                return res.status(400).json({ error: 'ID produk tidak valid' });
            }

            const product = await prisma.products.findUnique({
                where: { id: productId }
            });

            if (!product) {
                return res.status(404).json({ error: 'Produk tidak ditemukan' });
            }

            const updated = await prisma.products.update({
                where: { id: productId },
                data: {
                    is_active: !product.is_active
                }
            });

            return res.json({
                success: true,
                is_active: updated.is_active,
                message: `Status produk ${updated.name} berhasil diubah`
            });
        } catch (error) {
            console.error('Error toggling product status:', error);
            return res.status(500).json({ error: 'Gagal mengubah status produk' });
        }
    }

    /**
     * Upload Product Image (/admin/api/products/:id/upload-image OR /admin/api/products/upload-image)
     */
    async uploadProductImage(req: Request, res: Response) {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ status: 'error', message: 'File gambar tidak ditemukan' });
            }

            const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
            if (!allowedMimes.includes(file.mimetype)) {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                return res.status(400).json({ status: 'error', message: 'Format gambar harus PNG, JPG, WEBP, atau SVG' });
            }

            const uploadDir = path.join(process.cwd(), 'public/uploads/products');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const ext = path.extname(file.originalname).toLowerCase() || '.png';
            const filename = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
            const targetPath = path.join(uploadDir, filename);

            fs.copyFileSync(file.path, targetPath);
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

            const imageUrl = `/uploads/products/${filename}`;
            const rawId = req.params.id;
            const productId = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN;
            if (!isNaN(productId) && productId > 0) {
                const product = await prisma.products.findUnique({ where: { id: productId } });
                if (product && product.image && product.image.startsWith('/uploads/products/')) {
                    const oldFilePath = path.join(process.cwd(), 'public', product.image);
                    if (fs.existsSync(oldFilePath)) {
                        try { fs.unlinkSync(oldFilePath); } catch (e) { console.warn('Failed to unlink old image:', e); }
                    }
                }

                await prisma.products.update({
                    where: { id: productId },
                    data: { image: imageUrl }
                });
            }

            return res.json({
                status: 'success',
                message: 'Gambar produk berhasil diunggah',
                image_url: imageUrl
            });
        } catch (error) {
            console.error('Upload product image error:', error);
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) { console.warn('Failed to clean up temp file:', e); }
            }
            return res.status(500).json({ status: 'error', message: 'Gagal mengunggah gambar produk' });
        }
    }

    /**
     * API Get Categories (/admin/api/categories)
     */
    async apiGetCategories(req: Request, res: Response) {
        try {
            const [categoriesList, productsList] = await Promise.all([
                prisma.categories.findMany({ orderBy: { id: 'desc' } }),
                prisma.products.findMany({ select: { id: true, category_id: true, category_ids: true } })
            ]);

            const productCountMap = new Map<number, number>();
            let totalCategorizedCount = 0;

            for (const p of productsList) {
                let ids: number[] = [];
                if (p.category_ids) {
                    try {
                        const parsed = typeof p.category_ids === 'string' ? JSON.parse(p.category_ids) : p.category_ids;
                        if (Array.isArray(parsed)) {
                            ids = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
                        }
                    } catch {
                        ids = [];
                    }
                }
                if (ids.length === 0 && p.category_id) {
                    ids = [p.category_id];
                }
                ids = Array.from(new Set(ids));
                if (ids.length > 0) totalCategorizedCount++;

                for (const catId of ids) {
                    productCountMap.set(catId, (productCountMap.get(catId) || 0) + 1);
                }
            }

            const mapped = categoriesList.map(c => ({
                id: c.id,
                name: c.name,
                slug: c.slug,
                icon: c.icon,
                description: c.description,
                is_active: c.is_active,
                created_at: c.created_at,
                products_count: productCountMap.get(c.id) || 0
            }));

            return res.json({
                status: 'success',
                data: {
                    categories: mapped,
                    stats: {
                        total: mapped.length,
                        active: mapped.filter(c => c.is_active).length,
                        total_products_categorized: totalCategorizedCount
                    }
                }
            });
        } catch (error) {
            console.error('API Categories error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat kategori produk' });
        }
    }

    /**
     * Show Categories List (/admin/categories) (redirects to Svelte SPA or returns JSON)
     */
    async showCategoriesList(req: Request, res: Response) {
        try {
            if (req.headers.accept && req.headers.accept.includes('application/json')) {
                return this.apiGetCategories(req, res);
            }
            return res.redirect('/#/admin/categories');
        } catch (error) {
            console.error('Error rendering categories page:', error);
            res.redirect('/#/admin/categories');
        }
    }

    /**
     * Process Create Category (/admin/api/categories/create)
     */
    async processCreateCategory(req: Request, res: Response) {
        try {
            const body = req.body as {
                name?: string;
                slug?: string;
                icon?: string;
                description?: string;
                is_active?: string | boolean;
            };

            const name = body.name ? body.name.trim() : '';
            if (!name) {
                return res.status(400).json({ status: 'error', message: 'Nama kategori wajib diisi' });
            }

            let slug = body.slug ? body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
            if (!slug) {
                slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }

            // Check slug uniqueness
            const existing = await prisma.categories.findUnique({ where: { slug } });
            if (existing) {
                slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
            }

            const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

            const category = await prisma.categories.create({
                data: {
                    name,
                    slug,
                    icon: body.icon ? body.icon.trim() : '',
                    description: body.description ? body.description.trim() : '',
                    is_active: isActive
                }
            });

            return res.json({
                status: 'success',
                message: 'Kategori berhasil ditambahkan',
                data: category
            });
        } catch (error) {
            console.error('Error creating category:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal menambahkan kategori' });
        }
    }

    /**
     * Process Edit Category (/admin/api/categories/edit/:id)
     */
    async processEditCategory(req: Request, res: Response) {
        try {
            const rawId = req.params.id;
            const categoryId = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN;
            if (isNaN(categoryId) || categoryId <= 0) {
                return res.status(400).json({ status: 'error', message: 'ID kategori tidak valid' });
            }

            const body = req.body as {
                name?: string;
                slug?: string;
                icon?: string;
                description?: string;
                is_active?: string | boolean;
            };

            const name = body.name ? body.name.trim() : '';
            if (!name) {
                return res.status(400).json({ status: 'error', message: 'Nama kategori wajib diisi' });
            }

            let slug = body.slug ? body.slug.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') : '';
            if (!slug) {
                slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
            }

            const existingSlug = await prisma.categories.findFirst({
                where: { slug, NOT: { id: categoryId } }
            });
            if (existingSlug) {
                slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`;
            }

            const isActive = body.is_active !== undefined ? Boolean(body.is_active) : true;

            const updated = await prisma.categories.update({
                where: { id: categoryId },
                data: {
                    name,
                    slug,
                    icon: body.icon ? body.icon.trim() : '',
                    description: body.description ? body.description.trim() : '',
                    is_active: isActive
                }
            });

            return res.json({
                status: 'success',
                message: 'Kategori berhasil diperbarui',
                data: updated
            });
        } catch (error) {
            console.error('Error editing category:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memperbarui kategori' });
        }
    }

    /**
     * Process Delete Category (/admin/api/categories/delete/:id)
     */
    async processDeleteCategory(req: Request, res: Response) {
        try {
            const rawId = req.params.id;
            const categoryId = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN;
            if (isNaN(categoryId) || categoryId <= 0) {
                return res.status(400).json({ status: 'error', message: 'ID kategori tidak valid' });
            }

            const category = await prisma.categories.findUnique({ where: { id: categoryId } });
            if (!category) {
                return res.status(404).json({ status: 'error', message: 'Kategori tidak ditemukan' });
            }

            // Unlink products in this category (multi-category aware)
            const productsToUnlink = await prisma.products.findMany({
                select: { id: true, category_id: true, category_ids: true }
            });

            for (const p of productsToUnlink) {
                let ids: number[] = [];
                if (p.category_ids) {
                    try {
                        const parsed = typeof p.category_ids === 'string' ? JSON.parse(p.category_ids) : p.category_ids;
                        if (Array.isArray(parsed)) {
                            ids = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
                        }
                    } catch {
                        ids = [];
                    }
                }
                if (ids.length === 0 && p.category_id) {
                    ids = [p.category_id];
                }

                if (ids.includes(categoryId) || p.category_id === categoryId) {
                    const remainingIds = ids.filter(id => id !== categoryId);
                    const newPrimary = remainingIds[0] || null;
                    const newJson = remainingIds.length > 0 ? JSON.stringify(remainingIds) : null;
                    await prisma.products.update({
                        where: { id: p.id },
                        data: {
                            category_id: newPrimary,
                            category_ids: newJson
                        }
                    });
                }
            }

            // Delete icon if local
            if (category.icon && category.icon.startsWith('/uploads/categories/')) {
                const oldFilePath = path.join(process.cwd(), 'public', category.icon);
                if (fs.existsSync(oldFilePath)) {
                    try { fs.unlinkSync(oldFilePath); } catch (e) { console.warn('Failed to unlink old category icon:', e); }
                }
            }

            await prisma.categories.delete({
                where: { id: categoryId }
            });

            return res.json({
                status: 'success',
                message: 'Kategori berhasil dihapus'
            });
        } catch (error) {
            console.error('Error deleting category:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal menghapus kategori' });
        }
    }

    /**
     * Process Toggle Category Status (/admin/api/categories/toggle-status/:id)
     */
    async processToggleCategoryStatus(req: Request, res: Response) {
        try {
            const rawId = req.params.id;
            const categoryId = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN;
            if (isNaN(categoryId) || categoryId <= 0) {
                return res.status(400).json({ error: 'ID kategori tidak valid' });
            }

            const cat = await prisma.categories.findUnique({ where: { id: categoryId } });
            if (!cat) {
                return res.status(404).json({ error: 'Kategori tidak ditemukan' });
            }

            const updated = await prisma.categories.update({
                where: { id: categoryId },
                data: { is_active: !cat.is_active }
            });

            return res.json({
                success: true,
                is_active: updated.is_active,
                message: `Status kategori ${updated.name} berhasil diubah`
            });
        } catch (error) {
            console.error('Error toggling category status:', error);
            return res.status(500).json({ error: 'Gagal mengubah status kategori' });
        }
    }

    /**
     * Upload Category Icon (/admin/api/categories/upload-icon OR /admin/api/categories/:id/upload-icon)
     */
    async uploadCategoryIcon(req: Request, res: Response) {
        try {
            const file = req.file;
            if (!file) {
                return res.status(400).json({ status: 'error', message: 'File icon tidak ditemukan' });
            }

            const allowedMimes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/svg+xml'];
            if (!allowedMimes.includes(file.mimetype)) {
                if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
                return res.status(400).json({ status: 'error', message: 'Format icon harus PNG, JPG, WEBP, atau SVG' });
            }

            const uploadDir = path.join(process.cwd(), 'public/uploads/categories');
            if (!fs.existsSync(uploadDir)) {
                fs.mkdirSync(uploadDir, { recursive: true });
            }

            const ext = path.extname(file.originalname).toLowerCase() || '.png';
            const filename = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
            const targetPath = path.join(uploadDir, filename);

            fs.copyFileSync(file.path, targetPath);
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);

            const iconUrl = `/uploads/categories/${filename}`;

            const rawId = req.params.id;
            const categoryId = typeof rawId === 'string' ? parseInt(rawId, 10) : NaN;
            if (!isNaN(categoryId) && categoryId > 0) {
                const category = await prisma.categories.findUnique({ where: { id: categoryId } });
                if (category && category.icon && category.icon.startsWith('/uploads/categories/')) {
                    const oldFilePath = path.join(process.cwd(), 'public', category.icon);
                    if (fs.existsSync(oldFilePath)) {
                        try { fs.unlinkSync(oldFilePath); } catch (e) { console.warn('Failed to unlink old category icon:', e); }
                    }
                }

                await prisma.categories.update({
                    where: { id: categoryId },
                    data: { icon: iconUrl }
                });
            }

            return res.json({
                status: 'success',
                message: 'Icon kategori berhasil diunggah',
                icon_url: iconUrl
            });
        } catch (error) {
            console.error('Upload category icon error:', error);
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) { console.warn('Failed to clean up temp file:', e); }
            }
            return res.status(500).json({ status: 'error', message: 'Gagal mengunggah icon kategori' });
        }
    }

    /**
     * Upload Product Installer (/admin/products/:id/upload-installer)
     */
    async uploadProductInstaller(req: Request, res: Response) {
        const uploadedFile = req.file || (Array.isArray(req.files) ? req.files[0] : (req.files ? Object.values(req.files).flat()[0] : undefined));
        const tempFilePath = uploadedFile?.path;
        try {
            const productId = parseInt(req.params.id as string, 10);
            if (isNaN(productId)) {
                if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                return res.status(400).json({ error: 'ID produk tidak valid' });
            }

            const body = req.body as { os?: string };
            const osType = body.os;
            if (osType !== 'windows' && osType !== 'mac') {
                if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                return res.status(400).json({ error: 'Tipe OS harus "windows" atau "mac"' });
            }

            if (!uploadedFile || !tempFilePath || !fs.existsSync(tempFilePath)) {
                return res.status(400).json({ error: 'File installer belum dipilih' });
            }

            const product = await prisma.products.findUnique({
                where: { id: productId }
            });

            if (!product) {
                if (tempFilePath && fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
                return res.status(404).json({ error: 'Produk tidak ditemukan' });
            }

            const currentFiles = sftpService.parseInstallerFiles(product.installer_files);
            const targetList = osType === 'windows' ? [...currentFiles.windows] : [...currentFiles.mac];
            const safeFilename = sftpService.sanitizeFilename(uploadedFile.originalname);

            // Upload new file to SFTP
            const uploadedInfo = await sftpService.uploadInstaller(uploadedFile.path, uploadedFile.originalname, osType);

            // Clean up local temp file
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                fs.unlinkSync(tempFilePath);
            }

            const existingIdx = targetList.findIndex(f => f.filename === safeFilename);
            if (existingIdx >= 0) {
                targetList[existingIdx] = uploadedInfo;
            } else {
                targetList.push(uploadedInfo);
            }

            // Update database
            const updatedFiles: ProductInstallerFiles = {
                ...currentFiles,
                [osType]: targetList
            };

            const updatedJson = sftpService.serializeInstallerFiles(updatedFiles);

            await prisma.products.update({
                where: { id: productId },
                data: { installer_files: updatedJson }
            });

            return res.json({
                success: true,
                message: `File installer ${safeFilename} (${osType === 'windows' ? 'Windows' : 'macOS'}) berhasil diupload`,
                data: uploadedInfo,
                installer_files: updatedFiles
            });
        } catch (error) {
            console.error('Error uploading product installer:', error);
            if (tempFilePath && fs.existsSync(tempFilePath)) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (cleanErr) {
                    console.warn('Failed to clean up temp file:', cleanErr);
                }
            }
            return res.status(500).json({ error: 'Gagal mengupload file installer ke server' });
        }
    }

    /**
     * Upload Product Installer Chunk (/admin/products/:id/upload-chunk)
     */
    async uploadProductInstallerChunk(req: Request, res: Response) {
        const uploadedFile = req.file || (Array.isArray(req.files) ? req.files[0] : (req.files ? Object.values(req.files).flat()[0] : undefined));
        const tempChunkPath = uploadedFile?.path;
        try {
            const productId = parseInt(req.params.id as string, 10);
            if (isNaN(productId)) {
                if (tempChunkPath && fs.existsSync(tempChunkPath)) fs.unlinkSync(tempChunkPath);
                return res.status(400).json({ error: 'ID produk tidak valid' });
            }

            const body = req.body as {
                upload_id?: string;
                chunk_index?: string | number;
                total_chunks?: string | number;
                filename?: string;
                os?: string;
            };

            const uploadId = body.upload_id ? body.upload_id.replace(/[^a-zA-Z0-9_-]/g, '') : '';
            const chunkIndex = typeof body.chunk_index !== 'undefined' ? parseInt(String(body.chunk_index), 10) : -1;
            const totalChunks = typeof body.total_chunks !== 'undefined' ? parseInt(String(body.total_chunks), 10) : -1;
            const rawFilename = body.filename ? body.filename.trim() : '';
            const osType = body.os;

            if (!uploadId || chunkIndex < 0 || totalChunks <= 0 || !rawFilename || (osType !== 'windows' && osType !== 'mac')) {
                if (tempChunkPath && fs.existsSync(tempChunkPath)) fs.unlinkSync(tempChunkPath);
                return res.status(400).json({ error: 'Parameter chunk upload tidak lengkap atau tidak valid' });
            }

            if (!uploadedFile || !tempChunkPath || !fs.existsSync(tempChunkPath)) {
                return res.status(400).json({ error: 'File chunk belum diterima' });
            }

            const chunkDir = path.join(os.tmpdir(), 'installer_chunks', uploadId);
            if (!fs.existsSync(chunkDir)) {
                fs.mkdirSync(chunkDir, { recursive: true });
            }

            // Cleanup old orphaned chunk directories (> 2 hours old) to prevent /tmp RAM-disk leaks
            try {
                const baseChunkDir = path.join(os.tmpdir(), 'installer_chunks');
                if (fs.existsSync(baseChunkDir)) {
                    const now = Date.now();
                    const maxAge = 2 * 60 * 60 * 1000;
                    const subdirs = fs.readdirSync(baseChunkDir);
                    for (const sub of subdirs) {
                        if (sub === uploadId) continue;
                        const subPath = path.join(baseChunkDir, sub);
                        const stat = fs.statSync(subPath);
                        if (stat.isDirectory() && now - stat.mtimeMs > maxAge) {
                            fs.rmSync(subPath, { recursive: true, force: true });
                        }
                    }
                }
            } catch {
                // Non-blocking cleanup
            }

            const chunkTarget = path.join(chunkDir, `chunk_${chunkIndex}`);
            fs.renameSync(tempChunkPath, chunkTarget);

            // Check if this is the final chunk
            if (chunkIndex === totalChunks - 1) {
                // Verify all chunks exist
                for (let i = 0; i < totalChunks; i++) {
                    const cPath = path.join(chunkDir, `chunk_${i}`);
                    if (!fs.existsSync(cPath)) {
                        return res.status(400).json({ error: `Chunk ke-${i} hilang atau gagal diunggah` });
                    }
                }

                // Merge chunks safely with backpressure handling
                const safeFilename = sftpService.sanitizeFilename(rawFilename);
                const assembledPath = path.join(chunkDir, safeFilename);
                const writeStream = fs.createWriteStream(assembledPath, { flags: 'w' });

                for (let i = 0; i < totalChunks; i++) {
                    const cPath = path.join(chunkDir, `chunk_${i}`);
                    await new Promise<void>((resolve, reject) => {
                        const readStream = fs.createReadStream(cPath);
                        readStream.on('error', (err) => reject(err));
                        readStream.on('end', () => resolve());
                        readStream.pipe(writeStream, { end: false });
                    });
                }
                writeStream.end();

                await new Promise<void>((resolve, reject) => {
                    writeStream.on('finish', () => resolve());
                    writeStream.on('error', (err) => reject(err));
                });

                // Find product
                const product = await prisma.products.findUnique({
                    where: { id: productId }
                });

                if (!product) {
                    try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch (rmErr) {
                        console.warn('Failed to remove chunk dir:', rmErr);
                    }
                    return res.status(404).json({ error: 'Produk tidak ditemukan' });
                }

                const currentFiles = sftpService.parseInstallerFiles(product.installer_files);
                const targetList = osType === 'windows' ? [...currentFiles.windows] : [...currentFiles.mac];

                // Upload combined file to SFTP
                const uploadedInfo = await sftpService.uploadInstaller(assembledPath, safeFilename, osType);

                // Clean up chunk directory
                try {
                    fs.rmSync(chunkDir, { recursive: true, force: true });
                } catch (cleanErr) {
                    console.warn('Failed to clean chunk directory:', cleanErr);
                }

                // Check if file with same filename already in list
                const existingIdx = targetList.findIndex(f => f.filename === safeFilename);
                if (existingIdx >= 0) {
                    targetList[existingIdx] = uploadedInfo;
                } else {
                    targetList.push(uploadedInfo);
                }

                // Update database
                const updatedFiles: ProductInstallerFiles = {
                    ...currentFiles,
                    [osType]: targetList
                };
                const updatedJson = sftpService.serializeInstallerFiles(updatedFiles);

                await prisma.products.update({
                    where: { id: productId },
                    data: { installer_files: updatedJson }
                });

                return res.json({
                    success: true,
                    is_complete: true,
                    message: `File installer ${safeFilename} (${osType === 'windows' ? 'Windows' : 'macOS'}) berhasil diupload`,
                    data: uploadedInfo,
                    installer_files: updatedFiles
                });
            }

            return res.json({
                success: true,
                is_complete: false,
                chunk_index: chunkIndex,
                total_chunks: totalChunks
            });
        } catch (error) {
            console.error('Error in uploadProductInstallerChunk:', error);
            if (tempChunkPath && fs.existsSync(tempChunkPath)) {
                try { fs.unlinkSync(tempChunkPath); } catch (cleanErr) {
                    console.warn('Failed to remove temp chunk:', cleanErr);
                }
            }
            return res.status(500).json({ error: 'Gagal memproses chunk upload' });
        }
    }

    /**
     * Delete Product Installer (/admin/products/:id/delete-installer)
     */
    async deleteProductInstaller(req: Request, res: Response) {
        try {
            const productId = parseInt(req.params.id as string, 10);
            if (isNaN(productId)) {
                return res.status(400).json({ error: 'ID produk tidak valid' });
            }

            const body = req.body as { os?: string; file_id?: string; filename?: string };
            const osType = body.os;
            if (osType !== 'windows' && osType !== 'mac') {
                return res.status(400).json({ error: 'Tipe OS harus "windows" atau "mac"' });
            }

            const product = await prisma.products.findUnique({
                where: { id: productId }
            });

            if (!product) {
                return res.status(404).json({ error: 'Produk tidak ditemukan' });
            }

            const currentFiles = sftpService.parseInstallerFiles(product.installer_files);
            const targetList = osType === 'windows' ? [...currentFiles.windows] : [...currentFiles.mac];

            let newTargetList = targetList;
            const fileId = body.file_id;
            const filename = body.filename;

            if (fileId || filename) {
                const itemToDelete = targetList.find(f => (fileId && f.id === fileId) || (filename && f.filename === filename));
                if (itemToDelete && itemToDelete.filename) {
                    await sftpService.deleteInstaller(itemToDelete.filename);
                }
                newTargetList = targetList.filter(f => !((fileId && f.id === fileId) || (filename && f.filename === filename)));
            } else {
                // Delete all files for this OS
                for (const item of targetList) {
                    if (item.filename) {
                        try {
                            await sftpService.deleteInstaller(item.filename);
                        } catch (delErr) {
                            console.warn(`Warning deleting file ${item.filename}:`, delErr);
                        }
                    }
                }
                newTargetList = [];
            }

            const updatedFiles: ProductInstallerFiles = {
                ...currentFiles,
                [osType]: newTargetList
            };

            const updatedJson = sftpService.serializeInstallerFiles(updatedFiles);

            await prisma.products.update({
                where: { id: productId },
                data: { installer_files: updatedJson }
            });

            return res.json({
                success: true,
                message: `File installer berhasil dihapus dari server`,
                installer_files: updatedFiles
            });
        } catch (error) {
            console.error('Error deleting product installer:', error);
            return res.status(500).json({ error: 'Gagal menghapus file installer' });
        }
    }

    /**
     * Helper to get sanitized client IP address
     */
    private getCleanClientIp(req: Request): string {
        return getClientIp(req);
    }

    /**
     * Get Admin Profile & System Diagnostics API
     */
    async apiGetProfile(req: Request, res: Response) {
        try {
            const adminId = req.session.adminId;
            const admin = await prisma.admin.findFirst({
                where: adminId ? { id: adminId } : undefined
            });

            if (!admin) {
                return res.status(404).json({ success: false, error: 'Admin tidak ditemukan' });
            }

            const isSuperAdmin = !admin.role || admin.role.toLowerCase().includes('super');
            const cleanIp = this.getCleanClientIp(req);

            const [totalProducts, totalCategories, totalAffiliates] = await Promise.all([
                prisma.products.count(),
                prisma.categories.count(),
                prisma.affiliate_member.count()
            ]);

            return res.json({
                success: true,
                admin: {
                    id: admin.id,
                    username: admin.username,
                    role: admin.role || 'Super Administrator',
                    isSuperAdmin,
                    ip: cleanIp,
                    hasPin: !!admin.pin
                },
                stats: {
                    totalProducts,
                    totalCategories,
                    totalAffiliates
                },
                system: {
                    nodeVersion: process.version,
                    platform: process.platform,
                    uptimeHours: Math.floor(process.uptime() / 3600),
                    memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024)
                }
            });
        } catch (error) {
            console.error('Error fetching admin profile:', error);
            return res.status(500).json({ success: false, error: 'Gagal memuat profil admin' });
        }
    }

    /**
     * Update Admin Security PIN API
     */
    async apiUpdatePin(req: Request, res: Response) {
        try {
            const adminId = req.session.adminId;
            const cleanIp = this.getCleanClientIp(req);
            const rateKey = `update-pin:${cleanIp}:${adminId || 'auth'}`;
            const rateCheck = securityRateLimiter.check(rateKey, 3, 15 * 60 * 1000);
            if (rateCheck.isLocked) {
                return res.status(429).json({
                    success: false,
                    error: rateCheck.message || 'Terlalu banyak percobaan gagal. Pembaruan PIN dibatasi selama 15 menit.'
                });
            }

            const { currentPin, newPin } = req.body as { currentPin?: string; newPin?: string };

            if (!currentPin || !newPin) {
                return res.status(400).json({ success: false, error: 'PIN lama dan PIN baru wajib diisi' });
            }

            if (!/^\d{6}$/.test(newPin)) {
                return res.status(400).json({ success: false, error: 'PIN baru harus tepat 6 digit angka' });
            }

            const admin = await prisma.admin.findFirst({
                where: adminId ? { id: adminId } : undefined
            });

            if (!admin) {
                return res.status(404).json({ success: false, error: 'Admin tidak ditemukan' });
            }

            if (admin.pin && admin.pin !== currentPin) {
                const fail = securityRateLimiter.recordFailure(rateKey, 3, 15 * 60 * 1000);
                return res.status(fail.isLocked ? 429 : 400).json({
                    success: false,
                    error: fail.isLocked
                        ? (fail.message || 'PIN saat ini salah. Akses pembaruan PIN diblokir selama 15 menit.')
                        : `PIN saat ini salah. Sisa kesempatan: ${fail.attemptsLeft}x.`
                });
            }

            await prisma.admin.update({
                where: { id: admin.id },
                data: { pin: newPin }
            });

            securityRateLimiter.clear(rateKey);

            return res.json({
                success: true,
                message: 'PIN keamanan admin berhasil diperbarui'
            });
        } catch (error) {
            console.error('Error updating admin PIN:', error);
            return res.status(500).json({ success: false, error: 'Gagal memperbarui PIN admin' });
        }
    }

    /**
     * Update Admin Username API
     */
    async apiUpdateUsername(req: Request, res: Response) {
        try {
            const adminId = req.session.adminId;
            const { username } = req.body as { username?: string };

            if (!username || username.trim().length < 3) {
                return res.status(400).json({ success: false, error: 'Username minimal 3 karakter' });
            }

            const admin = await prisma.admin.findFirst({
                where: adminId ? { id: adminId } : undefined
            });

            if (!admin) {
                return res.status(404).json({ success: false, error: 'Admin tidak ditemukan' });
            }

            const trimmed = username.trim();
            await prisma.admin.update({
                where: { id: admin.id },
                data: { username: trimmed }
            });

            req.session.adminName = trimmed;

            return res.json({
                success: true,
                message: 'Username admin berhasil diperbarui',
                username: trimmed
            });
        } catch (error) {
            console.error('Error updating admin username:', error);
            return res.status(500).json({ success: false, error: 'Gagal memperbarui username' });
        }
    }

    /**
     * Get All Admins List (Super Admin only)
     */
    async apiGetAdmins(req: Request, res: Response) {
        try {
            const adminId = req.session.adminId;
            const currentAdmin = await prisma.admin.findFirst({ where: adminId ? { id: adminId } : undefined });
            if (!currentAdmin) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const isSuper = !currentAdmin.role || currentAdmin.role.toLowerCase().includes('super');
            if (!isSuper) {
                return res.status(403).json({ success: false, error: 'Hanya Super Administrator yang dapat mengakses daftar admin' });
            }

            const admins = await prisma.admin.findMany({
                orderBy: { id: 'asc' }
            });

            const cleanAdmins = admins.map(a => ({
                id: a.id,
                username: a.username,
                role: a.role || 'Super Administrator',
                isSuperAdmin: !a.role || a.role.toLowerCase().includes('super'),
                ip: a.ip && (a.ip.includes('.') || a.ip.includes(':')) && a.ip.length <= 45 ? a.ip.replace(/^::ffff:/, '') : '127.0.0.1',
                hasPin: !!a.pin,
                isCurrentAdmin: a.id === currentAdmin.id
            }));

            return res.json({ success: true, admins: cleanAdmins });
        } catch (error) {
            console.error('Error fetching admins:', error);
            return res.status(500).json({ success: false, error: 'Gagal memuat daftar admin' });
        }
    }

    /**
     * Create New Admin Account (Super Admin only)
     */
    async apiCreateAdmin(req: Request, res: Response) {
        try {
            const adminId = req.session.adminId;
            const currentAdmin = await prisma.admin.findFirst({ where: adminId ? { id: adminId } : undefined });
            if (!currentAdmin) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const isSuper = !currentAdmin.role || currentAdmin.role.toLowerCase().includes('super');
            if (!isSuper) {
                return res.status(403).json({ success: false, error: 'Hanya Super Administrator yang dapat menambahkan admin baru' });
            }

            const { username, role, pin } = req.body as { username?: string; role?: string; pin?: string };
            if (!username || username.trim().length < 3) {
                return res.status(400).json({ success: false, error: 'Username minimal 3 karakter' });
            }
            if (!pin || !/^\d{6}$/.test(pin)) {
                return res.status(400).json({ success: false, error: 'PIN wajib tepat 6 digit angka' });
            }

            const existingUsername = await prisma.admin.findFirst({
                where: { username: username.trim() }
            });
            if (existingUsername) {
                return res.status(400).json({ success: false, error: 'Username sudah digunakan oleh admin lain' });
            }

            const existingPin = await prisma.admin.findFirst({
                where: { pin: pin }
            });
            if (existingPin) {
                return res.status(400).json({ success: false, error: 'PIN ini sudah digunakan oleh admin lain' });
            }

            const newAdmin = await prisma.admin.create({
                data: {
                    username: username.trim(),
                    password: '',
                    up_link: '',
                    ip: this.getCleanClientIp(req),
                    role: role === 'Super Administrator' ? 'Super Administrator' : 'Administrator',
                    pin: pin
                }
            });

            return res.json({
                success: true,
                message: `Admin ${newAdmin.username} berhasil ditambahkan`,
                admin: {
                    id: newAdmin.id,
                    username: newAdmin.username,
                    role: newAdmin.role
                }
            });
        } catch (error) {
            console.error('Error creating admin:', error);
            return res.status(500).json({ success: false, error: 'Gagal menambahkan admin' });
        }
    }

    /**
     * Delete Admin Account (Super Admin only)
     */
    async apiDeleteAdmin(req: Request, res: Response) {
        try {
            const adminId = req.session.adminId;
            const currentAdmin = await prisma.admin.findFirst({ where: adminId ? { id: adminId } : undefined });
            if (!currentAdmin) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const isSuper = !currentAdmin.role || currentAdmin.role.toLowerCase().includes('super');
            if (!isSuper) {
                return res.status(403).json({ success: false, error: 'Hanya Super Administrator yang dapat menghapus admin' });
            }

            const targetId = parseInt(String(req.params.id), 10);
            if (isNaN(targetId)) return res.status(400).json({ success: false, error: 'ID Admin tidak valid' });

            if (targetId === currentAdmin.id) {
                return res.status(400).json({ success: false, error: 'Tidak dapat menghapus akun admin yang sedang Anda gunakan saat ini' });
            }

            const targetAdmin = await prisma.admin.findUnique({ where: { id: targetId } });
            if (!targetAdmin) return res.status(404).json({ success: false, error: 'Admin target tidak ditemukan' });

            const isTargetSuper = !targetAdmin.role || targetAdmin.role.toLowerCase().includes('super');
            if (isTargetSuper) {
                const superAdminsCount = await prisma.admin.count({
                    where: {
                        OR: [
                            { role: 'Super Administrator' },
                            { role: null }
                        ]
                    }
                });
                if (superAdminsCount <= 1) {
                    return res.status(400).json({ success: false, error: 'Tidak dapat menghapus Super Administrator terakhir di sistem' });
                }
            }

            await prisma.admin.delete({ where: { id: targetId } });

            return res.json({
                success: true,
                message: `Admin ${targetAdmin.username} berhasil dihapus dari sistem`
            });
        } catch (error) {
            console.error('Error deleting admin:', error);
            return res.status(500).json({ success: false, error: 'Gagal menghapus admin' });
        }
    }

    /**
     * Reset Admin Security PIN (Super Admin only)
     */
    async apiResetAdminPin(req: Request, res: Response) {
        try {
            const adminId = req.session.adminId;
            const cleanIp = this.getCleanClientIp(req);
            const currentAdmin = await prisma.admin.findFirst({ where: adminId ? { id: adminId } : undefined });
            if (!currentAdmin) return res.status(401).json({ success: false, error: 'Unauthorized' });

            const isSuper = !currentAdmin.role || currentAdmin.role.toLowerCase().includes('super');
            if (!isSuper) {
                return res.status(403).json({ success: false, error: 'Hanya Super Administrator yang dapat mereset PIN admin lain' });
            }

            const targetId = parseInt(String(req.params.id), 10);
            if (isNaN(targetId)) return res.status(400).json({ success: false, error: 'ID Admin tidak valid' });

            const rateKey = `reset-pin:${cleanIp}:${targetId}`;
            const rateCheck = securityRateLimiter.check(rateKey, 3, 15 * 60 * 1000);
            if (rateCheck.isLocked) {
                return res.status(429).json({
                    success: false,
                    error: rateCheck.message || 'Terlalu banyak percobaan reset PIN gagal. Akses dibatasi selama 15 menit.'
                });
            }

            const { newPin, confirmUsername } = req.body as { newPin?: string; confirmUsername?: string };

            const targetAdmin = await prisma.admin.findUnique({ where: { id: targetId } });
            if (!targetAdmin) return res.status(404).json({ success: false, error: 'Admin target tidak ditemukan' });

            // Strict username confirmation check
            if (!confirmUsername || confirmUsername.trim().toLowerCase() !== targetAdmin.username.trim().toLowerCase()) {
                const fail = securityRateLimiter.recordFailure(rateKey, 3, 15 * 60 * 1000);
                return res.status(fail.isLocked ? 429 : 400).json({
                    success: false,
                    error: fail.isLocked
                        ? (fail.message || 'Terlalu banyak kesalahan konfirmasi username. Akses dibatasi 15 menit.')
                        : `Konfirmasi username tidak cocok dengan akun admin target (${targetAdmin.username}). Sisa kesempatan: ${fail.attemptsLeft}x.`
                });
            }

            if (!newPin || !/^\d{6}$/.test(newPin)) {
                const fail = securityRateLimiter.recordFailure(rateKey, 3, 15 * 60 * 1000);
                return res.status(fail.isLocked ? 429 : 400).json({
                    success: false,
                    error: fail.isLocked
                        ? (fail.message || 'Terlalu banyak kegagalan format PIN. Akses dibatasi 15 menit.')
                        : 'PIN baru harus tepat 6 digit angka numerik'
                });
            }

            const existingPin = await prisma.admin.findFirst({
                where: {
                    pin: newPin,
                    id: { not: targetId }
                }
            });
            if (existingPin) {
                return res.status(400).json({ success: false, error: 'PIN ini sudah digunakan oleh admin lain' });
            }

            await prisma.admin.update({
                where: { id: targetId },
                data: { pin: newPin }
            });

            securityRateLimiter.clear(rateKey);

            return res.json({
                success: true,
                message: `PIN untuk admin ${targetAdmin.username} berhasil direset`
            });
        } catch (error) {
            console.error('Error resetting admin PIN:', error);
            return res.status(500).json({ success: false, error: 'Gagal mereset PIN admin' });
        }
    }

    /**
     * Get Users List API for Admin User Management
     */
    async apiGetUsers(req: Request, res: Response) {
        try {
            const page = Math.max(1, parseInt(req.query.page as string) || 1);
            const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
            const search = ((req.query.search as string) || '').trim();
            const tab = ((req.query.tab as string) || 'all').trim();
            const sort = ((req.query.sort as string) || 'created_desc').trim();

            const conditions: any[] = [];

            // Search filter
            if (search) {
                conditions.push({
                    OR: [
                        { name: { contains: search } },
                        { email: { contains: search } },
                        { whatsapp: { contains: search } },
                        { company: { contains: search } },
                        { ip: { contains: search } }
                    ]
                });
            }

            // Fetch paid user emails (users who have at least 1 paid order with total_amount > 0 and completed/paid status)
            const paidOrders = await prisma.order_list.findMany({
                where: {
                    total_amount: { gt: 0 },
                    OR: [
                        { paid_at: { not: null } },
                        { status: { in: ['COMPLETED', 'PAID', 'SETTLED', 'ACCEPT', 'terbayar', 'success', 'settlement', 'confirmed', 'selesai'] } },
                        { status_badge: 'success' }
                    ]
                },
                select: { user: true }
            });
            const paidUserEmails = Array.from(new Set(paidOrders.map(o => o.user).filter(Boolean)));

            // Tab filter
            if (tab === 'premium') {
                conditions.push({ email: { in: paidUserEmails } });
            } else if (tab === 'regular' || tab === 'unpaid' || tab === 'non_premium') {
                conditions.push({ email: { notIn: paidUserEmails } });
            } else if (tab === 'verified') {
                conditions.push({ verified: true });
            } else if (tab === 'unverified') {
                conditions.push({ verified: false });
            } else if (tab === 'pending_verify') {
                const pendingTokens = await prisma.verification_token.findMany({
                    where: { is_taked: false },
                    select: { email: true, user_id: true }
                });
                const tokenEmails = pendingTokens.map(t => t.email).filter(Boolean);
                const tokenUserIds = pendingTokens.map(t => t.user_id).filter(Boolean);
                conditions.push({
                    OR: [
                        { email: { in: tokenEmails } },
                        { id: { in: tokenUserIds } }
                    ]
                });
            } else if (tab === 'banned') {
                conditions.push({ banned: true });
            } else if (tab === 'affiliate') {
                const affMembers = await prisma.affiliate_member.findMany({ select: { email: true } });
                const affEmails = affMembers.map(a => a.email);
                conditions.push({ email: { in: affEmails } });
            }

            // Total overall metrics
            const totalUsersCount = await prisma.user.count();
            const premiumUsersCount = await prisma.user.count({ where: { email: { in: paidUserEmails } } });
            const regularUsersCount = Math.max(0, totalUsersCount - premiumUsersCount);
            const verifiedUsersCount = await prisma.user.count({ where: { verified: true } });
            const unverifiedUsersCount = await prisma.user.count({ where: { verified: false } });
            const bannedUsersCount = await prisma.user.count({ where: { banned: true } });
            const affiliateCount = await prisma.affiliate_member.count();

            const pendingTokensForCount = await prisma.verification_token.findMany({
                where: { is_taked: false },
                select: { email: true, user_id: true }
            });
            const pEmails = pendingTokensForCount.map(t => t.email).filter(Boolean);
            const pUserIds = pendingTokensForCount.map(t => t.user_id).filter(Boolean);
            const pendingVerifyCount = (pEmails.length > 0 || pUserIds.length > 0)
                ? await prisma.user.count({
                    where: {
                        OR: [
                            { email: { in: pEmails } },
                            { id: { in: pUserIds } }
                        ]
                    }
                })
                : 0;

            const filteredWhere: any = conditions.length > 0 ? { AND: conditions } : {};
            const total = await prisma.user.count({ where: filteredWhere });
            const totalPages = Math.ceil(total / limit) || 1;

            let users: any[] = [];

            const isRelationalSort = ['orders_desc', 'orders_asc', 'devices_desc', 'devices_asc', 'spent_desc', 'spent_asc'].includes(sort);

            if (isRelationalSort) {
                // Fetch candidate user IDs & emails matching filter
                const matchingCandidates = await prisma.user.findMany({
                    where: filteredWhere,
                    select: { id: true, email: true, created: true }
                });

                const candidateEmails = matchingCandidates.map(u => u.email);

                const allDevices = await prisma.device.findMany({
                    where: { email: { in: candidateEmails } },
                    select: { email: true }
                });
                const sortDeviceMap = new Map<string, number>();
                allDevices.forEach(d => {
                    sortDeviceMap.set(d.email, (sortDeviceMap.get(d.email) || 0) + 1);
                });

                const allOrders = await prisma.order_list.findMany({
                    where: { user: { in: candidateEmails } },
                    select: { user: true, total_amount: true, status: true, status_badge: true }
                });
                const sortOrderCountMap = new Map<string, number>();
                const sortOrderSpentMap = new Map<string, number>();
                allOrders.forEach(o => {
                    const isSuccess = ['confirmed', 'selesai', 'PAID', 'paid'].includes(o.status) || o.status_badge === 'success';
                    if (isSuccess) {
                        sortOrderCountMap.set(o.user, (sortOrderCountMap.get(o.user) || 0) + 1);
                        sortOrderSpentMap.set(o.user, (sortOrderSpentMap.get(o.user) || 0) + (o.total_amount || 0));
                    }
                });

                matchingCandidates.sort((a, b) => {
                    if (sort === 'orders_desc') {
                        const diff = (sortOrderCountMap.get(b.email) || 0) - (sortOrderCountMap.get(a.email) || 0);
                        return diff !== 0 ? diff : (b.created - a.created);
                    }
                    if (sort === 'orders_asc') {
                        const diff = (sortOrderCountMap.get(a.email) || 0) - (sortOrderCountMap.get(b.email) || 0);
                        return diff !== 0 ? diff : (b.created - a.created);
                    }
                    if (sort === 'devices_desc') {
                        const diff = (sortDeviceMap.get(b.email) || 0) - (sortDeviceMap.get(a.email) || 0);
                        return diff !== 0 ? diff : (b.created - a.created);
                    }
                    if (sort === 'devices_asc') {
                        const diff = (sortDeviceMap.get(a.email) || 0) - (sortDeviceMap.get(b.email) || 0);
                        return diff !== 0 ? diff : (b.created - a.created);
                    }
                    if (sort === 'spent_desc') {
                        const diff = (sortOrderSpentMap.get(b.email) || 0) - (sortOrderSpentMap.get(a.email) || 0);
                        return diff !== 0 ? diff : (b.created - a.created);
                    }
                    if (sort === 'spent_asc') {
                        const diff = (sortOrderSpentMap.get(a.email) || 0) - (sortOrderSpentMap.get(b.email) || 0);
                        return diff !== 0 ? diff : (b.created - a.created);
                    }
                    return 0;
                });

                const pageSlice = matchingCandidates.slice((page - 1) * limit, page * limit);
                const pageUserIds = pageSlice.map(u => u.id);

                const fetchedUsers = await prisma.user.findMany({
                    where: { id: { in: pageUserIds } }
                });
                const fetchedMap = new Map(fetchedUsers.map(u => [u.id, u]));
                users = pageUserIds.map(id => fetchedMap.get(id)!).filter(Boolean);
            } else {
                // Standard direct sorting
                let orderBy: any = { created: 'desc' };
                if (sort === 'created_asc') orderBy = { created: 'asc' };
                else if (sort === 'name_asc') orderBy = { name: 'asc' };
                else if (sort === 'name_desc') orderBy = { name: 'desc' };

                users = await prisma.user.findMany({
                    where: filteredWhere,
                    orderBy,
                    skip: (page - 1) * limit,
                    take: limit
                });
            }

            const emails = users.map(u => u.email);
            const userIds = users.map(u => u.id);

            // Fetch relations in bulk
            const devices = await prisma.device.findMany({
                where: { email: { in: emails } }
            });
            const orders = await prisma.order_list.findMany({
                where: { user: { in: emails } }
            });
            const affiliates = await prisma.affiliate_member.findMany({
                where: { email: { in: emails } }
            });
            const locations = await prisma.user_location.findMany({
                where: {
                    OR: [
                        { user_id: { in: userIds } },
                        { user_email: { in: emails } }
                    ]
                }
            });

            // Map data
            const deviceMap = new Map<string, number>();
            devices.forEach(d => {
                const count = deviceMap.get(d.email) || 0;
                deviceMap.set(d.email, count + 1);
            });

            const orderCountMap = new Map<string, number>();
            const orderSpentMap = new Map<string, number>();
            orders.forEach(o => {
                const isSuccess = ['confirmed', 'selesai', 'PAID', 'paid'].includes(o.status) || o.status_badge === 'success';
                if (isSuccess) {
                    orderCountMap.set(o.user, (orderCountMap.get(o.user) || 0) + 1);
                    orderSpentMap.set(o.user, (orderSpentMap.get(o.user) || 0) + (o.total_amount || 0));
                }
            });

            const affiliateMap = new Map<string, any>();
            affiliates.forEach(a => affiliateMap.set(a.email, a));

            const locationMap = new Map<string, any>();
            locations.forEach(l => {
                if (l.user_email) locationMap.set(l.user_email, l);
                if (l.user_id) locationMap.set(String(l.user_id), l);
            });

            const formattedUsers = users.map(u => {
                const aff = affiliateMap.get(u.email);
                const loc = locationMap.get(u.email) || locationMap.get(String(u.id));

                return {
                    id: u.id,
                    original_id: u.original_id,
                    name: u.name || 'Unnamed Member',
                    email: u.email,
                    whatsapp: u.whatsapp || null,
                    company: u.company || null,
                    verified: Boolean(u.verified),
                    banned: Boolean(u.banned),
                    created: u.created ? new Date(u.created * 1000).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    }) : '-',
                    created_timestamp: u.created,
                    ip: u.ip || loc?.ip || null,
                    location: loc ? {
                        city: loc.city || null,
                        region: loc.region || null,
                        country: loc.country || null
                    } : null,
                    devicesCount: deviceMap.get(u.email) || 0,
                    ordersCount: orderCountMap.get(u.email) || 0,
                    totalSpent: orderSpentMap.get(u.email) || 0,
                    isAffiliate: Boolean(aff),
                    affiliateKupon: aff?.kupon || null
                };
            });

            return res.json({
                success: true,
                stats: {
                    totalUsers: totalUsersCount,
                    premiumUsers: premiumUsersCount,
                    regularUsers: regularUsersCount,
                    verifiedUsers: verifiedUsersCount,
                    unverifiedUsers: unverifiedUsersCount,
                    pendingVerifyUsers: pendingVerifyCount,
                    bannedUsers: bannedUsersCount,
                    affiliateUsers: affiliateCount
                },
                pagination: {
                    page,
                    pageSize: limit,
                    total,
                    totalPages
                },
                users: formattedUsers
            });
        } catch (error) {
            console.error('Error fetching users:', error);
            return res.status(500).json({ success: false, error: 'Gagal mengambil data pengguna' });
        }
    }

    /**
     * Get Single User Detail API
     */
    async apiGetUserDetail(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string, 10);
            if (isNaN(id)) {
                return res.status(400).json({ success: false, error: 'ID tidak valid' });
            }

            const user = await prisma.user.findUnique({
                where: { id }
            });

            if (!user) {
                return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });
            }

            const devices = await prisma.device.findMany({
                where: { email: user.email },
                orderBy: { created: 'desc' }
            });

            const orders = await prisma.order_list.findMany({
                where: { user: user.email },
                orderBy: { created: 'desc' }
            });

            const affiliate = await prisma.affiliate_member.findFirst({
                where: { email: user.email }
            });

            const locations = await prisma.user_location.findMany({
                where: {
                    OR: [
                        { user_id: user.id },
                        { user_email: user.email }
                    ]
                },
                orderBy: { id: 'desc' },
                take: 5
            });

            return res.json({
                success: true,
                user: {
                    id: user.id,
                    original_id: user.original_id,
                    name: user.name,
                    email: user.email,
                    whatsapp: user.whatsapp,
                    company: user.company,
                    verified: Boolean(user.verified),
                    banned: Boolean(user.banned),
                    created: user.created ? new Date(user.created * 1000).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    }) : '-',
                    ip: user.ip
                },
                devices: devices.map(d => ({
                    id: d.id,
                    order_id: d.order_id,
                    product: d.product,
                    machine_id: d.machine_id,
                    label: d.label,
                    duration: d.duration,
                    created: d.created ? new Date(d.created * 1000).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    }) : '-',
                    expired: d.expired ? new Date(d.expired * 1000).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric'
                    }) : '-',
                    is_expired: d.expired ? (d.expired * 1000 < Date.now()) : false
                })),
                orders: orders.map(o => ({
                    id: o.id,
                    status: o.status,
                    status_badge: o.status_badge,
                    total_amount: o.total_amount,
                    payment: o.payment,
                    duration: o.duration,
                    channel_code: o.channel_code,
                    created: o.created ? new Date(o.created * 1000).toLocaleString('id-ID', {
                        day: 'numeric', month: 'short', year: 'numeric',
                        hour: '2-digit', minute: '2-digit'
                    }) : '-'
                })),
                affiliate: affiliate ? {
                    id: affiliate.id,
                    kupon: affiliate.kupon,
                    bank_name: affiliate.payout_bank_name,
                    no_rek: affiliate.payout_no_rek,
                    payout_name: affiliate.payout_name,
                    income: affiliate.kupon_income_idr
                } : null,
                locations: locations.map(l => ({
                    id: l.id,
                    ip: l.ip,
                    city: l.city,
                    region: l.region,
                    country: l.country,
                    timezone: l.timezone
                }))
            });
        } catch (error) {
            console.error('Error fetching user detail:', error);
            return res.status(500).json({ success: false, error: 'Gagal mengambil detail pengguna' });
        }
    }

    /**
     * Toggle User Banned Status API
     */
    async apiToggleUserBan(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string, 10);
            if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID tidak valid' });

            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });

            const newBanned = req.body.banned !== undefined ? Boolean(req.body.banned) : !user.banned;
            await prisma.user.update({
                where: { id },
                data: { banned: newBanned }
            });

            return res.json({
                success: true,
                message: newBanned ? 'Akun pengguna berhasil diblokir' : 'Blokir akun pengguna berhasil dibuka',
                banned: newBanned
            });
        } catch (error) {
            console.error('Error toggling user ban:', error);
            return res.status(500).json({ success: false, error: 'Gagal mengubah status blokir' });
        }
    }

    /**
     * Toggle User Verified Status API
     */
    async apiToggleUserVerified(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string, 10);
            if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID tidak valid' });

            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });

            const newVerified = req.body.verified !== undefined ? Boolean(req.body.verified) : !user.verified;
            await prisma.user.update({
                where: { id },
                data: { verified: newVerified }
            });

            return res.json({
                success: true,
                message: newVerified ? 'Akun pengguna berhasil diverifikasi' : 'Status verifikasi akun berhasil dicabut',
                verified: newVerified
            });
        } catch (error) {
            console.error('Error toggling user verification:', error);
            return res.status(500).json({ success: false, error: 'Gagal mengubah status verifikasi' });
        }
    }

    /**
     * Reset User Password API
     */
    async apiResetUserPassword(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string, 10);
            if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID tidak valid' });

            const { new_password } = req.body as { new_password?: string };
            if (!new_password || new_password.trim().length < 6) {
                return res.status(400).json({ success: false, error: 'Password baru minimal 6 karakter' });
            }

            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });

            await prisma.user.update({
                where: { id },
                data: { password: new_password.trim() }
            });

            return res.json({
                success: true,
                message: `Password untuk ${user.email} berhasil direset`
            });
        } catch (error) {
            console.error('Error resetting user password:', error);
            return res.status(500).json({ success: false, error: 'Gagal mereset password' });
        }
    }

    /**
     * Update User Info API (Name, WhatsApp, Company)
     * Email is permanent & locked
     */
    async apiUpdateUser(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string, 10);
            if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID tidak valid' });

            const { name, whatsapp, company } = req.body as {
                name?: string;
                whatsapp?: string;
                company?: string;
            };

            const user = await prisma.user.findUnique({ where: { id } });
            if (!user) return res.status(404).json({ success: false, error: 'Pengguna tidak ditemukan' });

            const data: any = {};
            if (name !== undefined) data.name = name.trim();
            if (whatsapp !== undefined) data.whatsapp = whatsapp.trim();
            if (company !== undefined) data.company = company.trim();

            await prisma.user.update({
                where: { id },
                data
            });

            return res.json({
                success: true,
                message: 'Data pengguna berhasil diperbarui'
            });
        } catch (error) {
            console.error('Error updating user info:', error);
            return res.status(500).json({ success: false, error: 'Gagal memperbarui data pengguna' });
        }
    }

    /**
     * Get List of Database Backups with Audit Metadata
     */
    async apiGetBackups(req: Request, res: Response) {
        try {
            const backups = await BackupService.getBackupsList();
            return res.json({
                success: true,
                backups
            });
        } catch (error) {
            console.error('Error fetching database backups:', error);
            return res.status(500).json({ success: false, error: 'Gagal memuat daftar pencadangan database' });
        }
    }

    /**
     * Start Database Backup Process (Background Job with Progress)
     */
    async apiCreateBackup(req: Request, res: Response) {
        try {
            const adminUsername = req.session?.adminName || 'Admin';
            const backupId = await BackupService.startBackup(adminUsername);

            const initialStatus = await BackupService.getBackupStatus(backupId);

            return res.json({
                success: true,
                message: 'Proses pencadangan database telah dimulai',
                backup: initialStatus
            });
        } catch (error: any) {
            console.error('Error starting database backup:', error);
            return res.status(500).json({
                success: false,
                error: error?.message || 'Gagal memulai proses pencadangan database'
            });
        }
    }

    /**
     * Get Real-time Status of a Single Database Backup
     */
    async apiGetBackupStatus(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string, 10);
            if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID tidak valid' });

            const backup = await BackupService.getBackupStatus(id);
            if (!backup) {
                return res.status(404).json({ success: false, error: 'Pencadangan database tidak ditemukan' });
            }

            return res.json({
                success: true,
                backup
            });
        } catch (error) {
            console.error('Error fetching backup status:', error);
            return res.status(500).json({ success: false, error: 'Gagal memeriksa status pencadangan' });
        }
    }

    /**
     * Download Backup Archive with Full Downloader Audit Logging
     */
    async apiDownloadBackup(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string, 10);
            if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID tidak valid' });

            const adminUsername = req.session?.adminName || 'Admin';
            const ip = this.getCleanClientIp(req);
            const userAgent = req.headers['user-agent'] || '';

            const result = await BackupService.recordDownloadAndGetFile(id, {
                adminUsername,
                ip,
                userAgent
            });

            if (!result) {
                return res.status(404).json({
                    success: false,
                    error: 'Berkas pencadangan tidak ditemukan atau proses ekspor belum selesai'
                });
            }

            const contentType = result.filename.endsWith('.sql') ? 'application/sql' : 'application/octet-stream';
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
            res.setHeader('Content-Length', result.fileSize);

            const fileStream = fs.createReadStream(result.filePath);
            fileStream.pipe(res);
        } catch (error) {
            console.error('Error downloading backup:', error);
            if (!res.headersSent) {
                return res.status(500).json({ success: false, error: 'Gagal mengunduh berkas database' });
            }
        }
    }

    /**
     * Delete Database Backup Archive
     */
    async apiDeleteBackup(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id as string, 10);
            if (isNaN(id)) return res.status(400).json({ success: false, error: 'ID tidak valid' });

            const success = await BackupService.deleteBackup(id);
            if (!success) {
                return res.status(404).json({ success: false, error: 'Pencadangan tidak ditemukan' });
            }

            return res.json({
                success: true,
                message: 'Berkas pencadangan berhasil dihapus'
            });
        } catch (error) {
            console.error('Error deleting backup:', error);
            return res.status(500).json({ success: false, error: 'Gagal menghapus pencadangan' });
        }
    }
    /**
     * API: Get Payment Settings (GoQRIS)
     */
    async apiGetPaymentSettings(req: Request, res: Response) {
        try {
            const settings = await prisma.payment_settings.findUnique({
                where: { gateway_name: 'goqris' }
            });

            // Mask api key for security
            let maskedApiKey = '';
            if (settings?.api_key) {
                const len = settings.api_key.length;
                maskedApiKey = len > 8 
                    ? settings.api_key.slice(0, 4) + '••••••••' + settings.api_key.slice(-3)
                    : '••••••••';
            }

            // Mask webhook secret for security
            let maskedWebhookSecret = '';
            if (settings?.webhook_secret) {
                const sLen = settings.webhook_secret.length;
                maskedWebhookSecret = sLen > 8
                    ? settings.webhook_secret.slice(0, 3) + '••••••••' + settings.webhook_secret.slice(-3)
                    : '••••••••';
            }

            return res.json({
                status: 'success',
                data: {
                    gateway_name: 'goqris',
                    api_key: maskedApiKey,
                    has_api_key: Boolean(settings?.api_key),
                    project_name: settings?.project_name || '',
                    callback_url: settings?.callback_url || '',
                    webhook_secret: maskedWebhookSecret,
                    has_webhook_secret: Boolean(settings?.webhook_secret),
                    is_active: settings?.is_active ?? true,
                    expiry_minutes: settings?.expiry_minutes || 1440,
                    admin_fee: settings?.admin_fee || 0,
                    admin_fee_percent: settings?.admin_fee_percent || 0
                }
            });
        } catch (error) {
            console.error('Error fetching payment settings:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal mengambil konfigurasi payment gateway' });
        }
    }

    /**
     * API: Save Payment Settings (GoQRIS)
     */
    async apiSavePaymentSettings(req: Request, res: Response) {
        try {
            const { api_key, project_name, callback_url, webhook_secret, is_active, expiry_minutes, admin_fee, admin_fee_percent } = req.body;

            const existing = await prisma.payment_settings.findUnique({
                where: { gateway_name: 'goqris' }
            });

            // If api_key is masked or empty, preserve existing key
            let finalApiKey = existing?.api_key || '';
            if (api_key && !api_key.includes('••••')) {
                finalApiKey = api_key.trim();
            }

            // If webhook_secret is masked or empty, preserve existing secret
            let finalWebhookSecret = existing?.webhook_secret || '';
            if (webhook_secret && !webhook_secret.includes('••••')) {
                finalWebhookSecret = webhook_secret.trim();
            }

            const updated = await prisma.payment_settings.upsert({
                where: { gateway_name: 'goqris' },
                update: {
                    api_key: finalApiKey,
                    project_name: (project_name || '').trim(),
                    callback_url: (callback_url || '').trim(),
                    webhook_secret: finalWebhookSecret,
                    is_active: Boolean(is_active),
                    expiry_minutes: parseInt(expiry_minutes, 10) || 1440,
                    admin_fee: parseInt(admin_fee, 10) || 0,
                    admin_fee_percent: parseFloat(admin_fee_percent) || 0,
                },
                create: {
                    gateway_name: 'goqris',
                    api_key: finalApiKey,
                    project_name: (project_name || '').trim(),
                    callback_url: (callback_url || '').trim(),
                    webhook_secret: finalWebhookSecret,
                    is_active: Boolean(is_active),
                    expiry_minutes: parseInt(expiry_minutes, 10) || 1440,
                    admin_fee: parseInt(admin_fee, 10) || 0,
                    admin_fee_percent: parseFloat(admin_fee_percent) || 0,
                }
            });

            return res.json({
                status: 'success',
                message: 'Pengaturan GoQRIS berhasil disimpan',
                data: {
                    gateway_name: updated.gateway_name,
                    project_name: updated.project_name,
                    callback_url: updated.callback_url,
                    is_active: updated.is_active,
                    expiry_minutes: updated.expiry_minutes,
                    admin_fee: updated.admin_fee,
                    admin_fee_percent: updated.admin_fee_percent
                }
            });
        } catch (error) {
            console.error('Error saving payment settings:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal menyimpan konfigurasi payment gateway' });
        }
    }

    /**
     * API: Get SMTP & Email Settings
     */
    async apiGetSmtpSettings(req: Request, res: Response) {
        try {
            const settings = await prisma.smtp_settings.findFirst({
                orderBy: { id: 'desc' }
            });

            // Mask password for security
            let maskedPassword = '';
            if (settings?.password) {
                const len = settings.password.length;
                maskedPassword = len > 4
                    ? settings.password.slice(0, 2) + '••••••••' + settings.password.slice(-2)
                    : '••••••••';
            }

            const fallbackConfig = await getSmtpConfig();

            return res.json({
                status: 'success',
                data: {
                    id: settings?.id || null,
                    host: settings?.host || fallbackConfig.host || '',
                    port: settings?.port || fallbackConfig.port || 587,
                    secure: settings?.secure ?? fallbackConfig.secure ?? false,
                    encryption: settings?.encryption || fallbackConfig.encryption || 'tls',
                    username: settings?.username || fallbackConfig.username || '',
                    password: maskedPassword,
                    has_password: Boolean(settings?.password || fallbackConfig.password),
                    from_email: settings?.from_email || fallbackConfig.from_email || '',
                    from_name: settings?.from_name || fallbackConfig.from_name || 'AppCenter - Ziqva Labs',
                    reply_to: settings?.reply_to || fallbackConfig.reply_to || '',
                    is_active: settings?.is_active ?? fallbackConfig.is_active ?? true,
                    require_auth: settings?.require_auth ?? fallbackConfig.require_auth ?? true,
                }
            });
        } catch (error) {
            console.error('Error fetching SMTP settings:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal mengambil konfigurasi SMTP' });
        }
    }

    /**
     * API: Save SMTP & Email Settings
     */
    async apiSaveSmtpSettings(req: Request, res: Response) {
        try {
            const { host, port, secure, encryption, username, password, from_email, from_name, reply_to, is_active, require_auth } = req.body;

            if (!host || !host.trim()) {
                return res.status(400).json({ status: 'error', message: 'Host SMTP wajib diisi (misal: smtp.gmail.com)' });
            }
            if (!port || isNaN(parseInt(port, 10))) {
                return res.status(400).json({ status: 'error', message: 'Port SMTP wajib berupa angka (misal: 587 atau 465)' });
            }
            if (!from_email || !from_email.trim()) {
                return res.status(400).json({ status: 'error', message: 'Email Pengirim (From Email) wajib diisi' });
            }

            const existing = await prisma.smtp_settings.findFirst({
                orderBy: { id: 'desc' }
            });

            // If password is blank or contains mask characters, preserve existing password
            let finalPassword = existing?.password || '';
            if (password && !password.includes('••••')) {
                finalPassword = password.trim();
            }

            const portNum = parseInt(port, 10);
            const enc = (encryption || (portNum === 465 ? 'ssl' : (portNum === 587 ? 'tls' : 'none'))).toLowerCase();
            const isSecure = Boolean(secure || portNum === 465 || enc === 'ssl');

            let saved;
            if (existing) {
                saved = await prisma.smtp_settings.update({
                    where: { id: existing.id },
                    data: {
                        host: host.trim(),
                        port: portNum,
                        secure: isSecure,
                        encryption: enc,
                        username: (username || '').trim(),
                        password: finalPassword,
                        from_email: from_email.trim(),
                        from_name: (from_name || 'AppCenter - Ziqva Labs').trim(),
                        reply_to: reply_to ? reply_to.trim() : null,
                        is_active: is_active !== undefined ? Boolean(is_active) : true,
                        require_auth: require_auth !== undefined ? Boolean(require_auth) : true,
                    }
                });
            } else {
                saved = await prisma.smtp_settings.create({
                    data: {
                        host: host.trim(),
                        port: portNum,
                        secure: isSecure,
                        encryption: enc,
                        username: (username || '').trim(),
                        password: finalPassword,
                        from_email: from_email.trim(),
                        from_name: (from_name || 'AppCenter - Ziqva Labs').trim(),
                        reply_to: reply_to ? reply_to.trim() : null,
                        is_active: is_active !== undefined ? Boolean(is_active) : true,
                        require_auth: require_auth !== undefined ? Boolean(require_auth) : true,
                    }
                });
            }

            return res.json({
                status: 'success',
                message: 'Konfigurasi SMTP berhasil disimpan',
                data: {
                    id: saved.id,
                    host: saved.host,
                    port: saved.port,
                    secure: saved.secure,
                    encryption: saved.encryption,
                    username: saved.username,
                    from_email: saved.from_email,
                    from_name: saved.from_name,
                    reply_to: saved.reply_to,
                    is_active: saved.is_active,
                    require_auth: saved.require_auth,
                }
            });
        } catch (error: any) {
            console.error('Error saving SMTP settings:', error);
            return res.status(500).json({ status: 'error', message: error?.message || 'Gagal menyimpan konfigurasi SMTP' });
        }
    }

    /**
     * API: Test SMTP Connection & Send Test Email
     */
    async apiTestSmtpConnection(req: Request, res: Response) {
        try {
            const { host, port, secure, encryption, username, password, from_email, from_name, reply_to, require_auth, test_email } = req.body;

            const existing = await prisma.smtp_settings.findFirst({
                orderBy: { id: 'desc' }
            });

            let finalPassword = existing?.password || '';
            if (password && !password.includes('••••')) {
                finalPassword = password.trim();
            }

            const portNum = port ? parseInt(port, 10) : (existing?.port || 587);
            const enc = (encryption || existing?.encryption || (portNum === 465 ? 'ssl' : 'tls')).toLowerCase() as 'none' | 'tls' | 'ssl';
            const isSecure = Boolean(secure ?? existing?.secure ?? (portNum === 465 || enc === 'ssl'));

            const configToTest: SmtpConfig = {
                host: host ? host.trim() : (existing?.host || ''),
                port: portNum,
                secure: isSecure,
                encryption: enc,
                username: username !== undefined ? username.trim() : (existing?.username || ''),
                password: finalPassword,
                from_email: from_email ? from_email.trim() : (existing?.from_email || 'noreply@ziqva.com'),
                from_name: from_name ? from_name.trim() : (existing?.from_name || 'AppCenter - Ziqva Labs'),
                reply_to: reply_to !== undefined ? (reply_to ? reply_to.trim() : null) : (existing?.reply_to || null),
                is_active: true,
                require_auth: require_auth !== undefined ? Boolean(require_auth) : (existing?.require_auth ?? true),
            };

            const result = await testSmtpConnection(configToTest, test_email ? test_email.trim() : undefined);
            return res.json({
                status: 'success',
                message: result.message,
                details: result.details
            });
        } catch (error: any) {
            console.error('Error testing SMTP connection:', error);
            return res.status(400).json({
                status: 'error',
                message: error?.message || 'Gagal menguji koneksi SMTP. Periksa host, port, dan kredensial.'
            });
        }
    }

    /**
     * API: Get All OAuth Clients (Admin)
     */
    async apiGetOAuthClients(req: Request, res: Response) {
        try {
            const clients = await prisma.oauth_clients.findMany({
                orderBy: { created_at: 'desc' },
            });

            // Count active tokens per client
            const activeTokenCounts = await prisma.oauth_access_tokens.groupBy({
                by: ['client_id'],
                _count: { id: true },
                where: {
                    revoked: false,
                    expires_at: { gt: new Date() },
                },
            });

            const tokenCountMap = new Map<string, number>();
            for (const item of activeTokenCounts) {
                tokenCountMap.set(item.client_id, item._count.id);
            }

            const formatted = clients.map((c) => {
                let redirectUris: string[] = [];
                let origins: string[] = [];
                try {
                    redirectUris = JSON.parse(c.allowed_redirect_uris);
                } catch {
                    redirectUris = (c.allowed_redirect_uris || '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
                }
                try {
                    origins = c.allowed_origins ? JSON.parse(c.allowed_origins) : [];
                } catch {
                    origins = (c.allowed_origins || '').split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
                }

                return {
                    id: c.id,
                    client_id: c.client_id,
                    has_secret: Boolean(c.client_secret_hash),
                    name: c.name,
                    description: c.description,
                    icon_url: c.icon_url,
                    allowed_redirect_uris: redirectUris,
                    allowed_origins: origins,
                    allowed_scopes: c.allowed_scopes,
                    is_trusted: c.is_trusted,
                    is_active: c.is_active,
                    active_tokens_count: tokenCountMap.get(c.client_id) || 0,
                    created_by: c.created_by,
                    created_at: c.created_at,
                    updated_at: c.updated_at,
                };
            });

            return res.json({
                status: 'success',
                data: formatted,
            });
        } catch (error) {
            console.error('Error fetching OAuth clients:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat daftar aplikasi OAuth' });
        }
    }

    /**
     * API: Create New OAuth Client (Admin)
     */
    async apiCreateOAuthClient(req: Request, res: Response) {
        try {
            const {
                name,
                description,
                icon_url,
                allowed_redirect_uris,
                allowed_origins,
                allowed_scopes,
                is_trusted,
                generate_secret,
            } = req.body as {
                name?: string;
                description?: string;
                icon_url?: string;
                allowed_redirect_uris?: string | string[];
                allowed_origins?: string | string[];
                allowed_scopes?: string;
                is_trusted?: boolean;
                generate_secret?: boolean;
            };

            if (!name || !name.trim()) {
                return res.status(400).json({ status: 'error', message: 'Nama aplikasi wajib diisi' });
            }

            // Format redirect URIs to JSON array
            let parsedUris: string[] = [];
            if (Array.isArray(allowed_redirect_uris)) {
                parsedUris = allowed_redirect_uris.map((u) => u.trim()).filter(Boolean);
            } else if (typeof allowed_redirect_uris === 'string') {
                parsedUris = allowed_redirect_uris.split(/[\n,]+/).map((u) => u.trim()).filter(Boolean);
            }

            if (parsedUris.length === 0) {
                return res.status(400).json({ status: 'error', message: 'Minimal satu Allowed Redirect URI wajib diisi' });
            }

            // Format allowed origins to JSON array
            let parsedOrigins: string[] = [];
            if (Array.isArray(allowed_origins)) {
                parsedOrigins = allowed_origins.map((o) => o.trim()).filter(Boolean);
            } else if (typeof allowed_origins === 'string') {
                parsedOrigins = allowed_origins.split(/[\n,]+/).map((o) => o.trim()).filter(Boolean);
            }

            const clientId = OAuthService.generateClientId();
            let rawSecret: string | null = null;
            let secretHash: string | null = null;

            if (generate_secret !== false) {
                const generated = OAuthService.generateClientSecret();
                rawSecret = generated.secret;
                secretHash = generated.hash;
            }

            const adminUsername = (req.session as any)?.adminName || 'admin';

            const createdClient = await prisma.oauth_clients.create({
                data: {
                    client_id: clientId,
                    client_secret_hash: secretHash,
                    name: name.trim(),
                    description: description ? description.trim() : null,
                    icon_url: icon_url ? icon_url.trim() : null,
                    allowed_redirect_uris: JSON.stringify(parsedUris),
                    allowed_origins: JSON.stringify(parsedOrigins),
                    allowed_scopes: (allowed_scopes || 'profile email').trim(),
                    is_trusted: Boolean(is_trusted),
                    is_active: true,
                    created_by: adminUsername,
                },
            });

            return res.json({
                status: 'success',
                message: 'Aplikasi OAuth berhasil didaftarkan',
                client: {
                    id: createdClient.id,
                    client_id: createdClient.client_id,
                    name: createdClient.name,
                    description: createdClient.description,
                    icon_url: createdClient.icon_url,
                    allowed_redirect_uris: parsedUris,
                    allowed_origins: parsedOrigins,
                    allowed_scopes: createdClient.allowed_scopes,
                    is_trusted: createdClient.is_trusted,
                    is_active: createdClient.is_active,
                    has_secret: Boolean(secretHash),
                },
                raw_client_secret: rawSecret,
            });
        } catch (error) {
            console.error('Error creating OAuth client:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal mendaftarkan aplikasi OAuth' });
        }
    }

    /**
     * API: Update OAuth Client (Admin)
     */
    async apiUpdateOAuthClient(req: Request, res: Response) {
        try {
            const clientId = parseInt(req.params.id as string, 10);
            if (!clientId || isNaN(clientId)) {
                return res.status(400).json({ status: 'error', message: 'ID aplikasi tidak valid' });
            }

            const existing = await prisma.oauth_clients.findUnique({ where: { id: clientId } });
            if (!existing) {
                return res.status(404).json({ status: 'error', message: 'Aplikasi tidak ditemukan' });
            }

            const {
                name,
                description,
                icon_url,
                allowed_redirect_uris,
                allowed_origins,
                allowed_scopes,
                is_trusted,
                is_active,
            } = req.body as {
                name?: string;
                description?: string;
                icon_url?: string;
                allowed_redirect_uris?: string | string[];
                allowed_origins?: string | string[];
                allowed_scopes?: string;
                is_trusted?: boolean;
                is_active?: boolean;
            };

            let parsedUris = existing.allowed_redirect_uris;
            if (allowed_redirect_uris !== undefined) {
                let urisList: string[] = [];
                if (Array.isArray(allowed_redirect_uris)) {
                    urisList = allowed_redirect_uris.map((u) => u.trim()).filter(Boolean);
                } else if (typeof allowed_redirect_uris === 'string') {
                    urisList = allowed_redirect_uris.split(/[\n,]+/).map((u) => u.trim()).filter(Boolean);
                }
                parsedUris = JSON.stringify(urisList);
            }

            let parsedOrigins = existing.allowed_origins;
            if (allowed_origins !== undefined) {
                let originsList: string[] = [];
                if (Array.isArray(allowed_origins)) {
                    originsList = allowed_origins.map((o) => o.trim()).filter(Boolean);
                } else if (typeof allowed_origins === 'string') {
                    originsList = allowed_origins.split(/[\n,]+/).map((o) => o.trim()).filter(Boolean);
                }
                parsedOrigins = JSON.stringify(originsList);
            }

            const updated = await prisma.oauth_clients.update({
                where: { id: clientId },
                data: {
                    name: name !== undefined ? name.trim() : existing.name,
                    description: description !== undefined ? (description ? description.trim() : null) : existing.description,
                    icon_url: icon_url !== undefined ? (icon_url ? icon_url.trim() : null) : existing.icon_url,
                    allowed_redirect_uris: parsedUris,
                    allowed_origins: parsedOrigins,
                    allowed_scopes: allowed_scopes !== undefined ? allowed_scopes.trim() : existing.allowed_scopes,
                    is_trusted: is_trusted !== undefined ? Boolean(is_trusted) : existing.is_trusted,
                    is_active: is_active !== undefined ? Boolean(is_active) : existing.is_active,
                },
            });

            return res.json({
                status: 'success',
                message: 'Aplikasi OAuth berhasil diperbarui',
                client: updated,
            });
        } catch (error) {
            console.error('Error updating OAuth client:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memperbarui aplikasi OAuth' });
        }
    }

    /**
     * API: Reset OAuth Client Secret (Admin)
     */
    async apiResetOAuthClientSecret(req: Request, res: Response) {
        try {
            const clientId = parseInt(req.params.id as string, 10);
            if (!clientId || isNaN(clientId)) {
                return res.status(400).json({ status: 'error', message: 'ID aplikasi tidak valid' });
            }

            const existing = await prisma.oauth_clients.findUnique({ where: { id: clientId } });
            if (!existing) {
                return res.status(404).json({ status: 'error', message: 'Aplikasi tidak ditemukan' });
            }

            const generated = OAuthService.generateClientSecret();

            await prisma.oauth_clients.update({
                where: { id: clientId },
                data: {
                    client_secret_hash: generated.hash,
                },
            });

            return res.json({
                status: 'success',
                message: 'Client Secret baru berhasil dibuat',
                raw_client_secret: generated.secret,
            });
        } catch (error) {
            console.error('Error resetting OAuth client secret:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal membuat ulang Client Secret' });
        }
    }

    /**
     * API: Delete OAuth Client (Admin)
     */
    async apiDeleteOAuthClient(req: Request, res: Response) {
        try {
            const clientId = parseInt(req.params.id as string, 10);
            if (!clientId || isNaN(clientId)) {
                return res.status(400).json({ status: 'error', message: 'ID aplikasi tidak valid' });
            }

            const existing = await prisma.oauth_clients.findUnique({ where: { id: clientId } });
            if (!existing) {
                return res.status(404).json({ status: 'error', message: 'Aplikasi tidak ditemukan' });
            }

            // Cleanup tokens, auth codes, and consents
            await prisma.oauth_access_tokens.deleteMany({ where: { client_id: existing.client_id } });
            await prisma.oauth_auth_codes.deleteMany({ where: { client_id: existing.client_id } });
            await prisma.oauth_user_consents.deleteMany({ where: { client_id: existing.client_id } });

            await prisma.oauth_clients.delete({ where: { id: clientId } });

            return res.json({
                status: 'success',
                message: 'Aplikasi OAuth dan seluruh token terkait berhasil dihapus',
            });
        } catch (error) {
            console.error('Error deleting OAuth client:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal menghapus aplikasi OAuth' });
        }
    }
}

export const adminController = new AdminController();


