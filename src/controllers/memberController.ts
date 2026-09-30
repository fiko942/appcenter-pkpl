import { Request, Response } from 'express';
import prisma from '../config/prisma';
import { ensureOrderInvoiceToken } from '../utils/invoiceToken';
import { Prisma } from '../generated/client/client';
import { memberRegisterPage } from '../views/member-register';
import { memberDashboardPage } from '../views/member-dashboard';
import { memberOrdersPage } from '../views/member-orders';
import { memberProfilePage } from '../views/member-profile';
import { memberLicensesPage } from '../views/member-licenses';
import { memberDeviceEditPage } from '../views/member-device-edit';
import { memberCreateOrderPage } from '../views/member-create-order';
import { memberDownloadsPage } from '../views/member-downloads';
import { memberTutorialsPage } from '../views/member-tutorials';
import { memberAffiliatePage, AffiliateTransaction } from '../views/member-affiliate';
import { memberPayoutHistoryPage } from '../views/member-payout-history';
import { createGoqrisOrder, getGoqrisConfig } from '../services/goqrisService';
import { downloadService } from '../services/downloadService';
import { sftpService } from '../services/sftpService';
import { sendEmail, getRegisterOtpTemplate, getResetPasswordOtpTemplate, getPasswordChangedTemplate } from '../services/emailService';
import { getClientIp } from '../utils/ipHelper';
import { securityRateLimiter } from '../services/securityRateLimiter';

// Custom session interface
interface MemberSession {
    userId?: number;
    userName?: string;
    userEmail?: string;
    userAvatar?: string;
    isMemberAuthenticated?: boolean;
    destroy(callback: (err: unknown) => void): void;
}

export function sanitizeProductImage(img?: string | null): string | null {
    if (!img || typeof img !== 'string') return null;
    const trimmed = img.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/favicon') || trimmed.startsWith('data:image/')) {
        return trimmed;
    }
    return null;
}


// Interfaces for data types

interface OrderItem {
    product_id?: number | string;
    price?: number;
    name?: string;
    [key: string]: unknown;
}

interface OrderVoucer {
    decrease_value?: number;
    voucer_type?: string;
    [key: string]: unknown;
}

export class MemberController {
    /**
     * Show login page
     */
    showLogin(req: Request, res: Response) {
        // If already logged in, redirect to dashboard SPA
        const session = req.session as unknown as MemberSession;
        if (session && session.isMemberAuthenticated) {
            return res.redirect('/#/member/dashboard');
        }

        return res.redirect('/#/member/login');
    }

    /**
     * Process login
     */
    async processLogin(req: Request, res: Response) {
        try {
            const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
            const body = req.body as { email?: string; password?: string };
            const { email, password } = body;

            if (!email || !password) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Email dan Password wajib diisi' });
                return res.redirect('/#/member/login?error=Email dan Password wajib diisi');
            }

            const cleanIp = getClientIp(req);
            const cleanEmail = email.trim().toLowerCase();

            // Strict Brute-Force Rate Limiting (IP & Account Lockout)
            const ipLock = securityRateLimiter.check(`member-login:ip:${cleanIp}`, 5, 15 * 60 * 1000);
            if (ipLock.isLocked) {
                const msg = `Terlalu banyak percobaan login gagal dari jaringan Anda. Silakan coba lagi dalam ${Math.ceil(ipLock.remainingSeconds / 60)} menit.`;
                if (isJson) return res.status(429).json({ status: 'error', message: msg, remainingSeconds: ipLock.remainingSeconds });
                return res.redirect(`/#/member/login?error=${encodeURIComponent(msg)}`);
            }

            const accountLock = securityRateLimiter.check(`member-login:account:${cleanEmail}`, 5, 15 * 60 * 1000);
            if (accountLock.isLocked) {
                const msg = `Akun ini sementara dikunci karena terlalu banyak percobaan login yang gagal. Silakan coba lagi dalam ${Math.ceil(accountLock.remainingSeconds / 60)} menit atau gunakan opsi Lupa Password.`;
                if (isJson) return res.status(429).json({ status: 'error', message: msg, remainingSeconds: accountLock.remainingSeconds });
                return res.redirect(`/#/member/login?error=${encodeURIComponent(msg)}`);
            }

            // Find user
            const user = await prisma.user.findFirst({
                where: { email: cleanEmail },
            });

            if (!user) {
                const ipFail = securityRateLimiter.recordFailure(`member-login:ip:${cleanIp}`, 5, 15 * 60 * 1000);
                const accountFail = securityRateLimiter.recordFailure(`member-login:account:${cleanEmail}`, 5, 15 * 60 * 1000);
                const remaining = Math.min(ipFail.attemptsLeft, accountFail.attemptsLeft);
                const errMsg = remaining > 0
                    ? `Email atau kata sandi tidak valid. Sisa kesempatan: ${remaining}x.`
                    : `Terlalu banyak percobaan gagal. Akses login dibatasi selama 15 menit.`;

                if (isJson) return res.status(401).json({ status: 'error', message: errMsg, attemptsLeft: remaining });
                return res.redirect(`/#/member/login?error=${encodeURIComponent(errMsg)}&email=${encodeURIComponent(cleanEmail)}`);
            }

            // Check password
            if (user.password !== password) {
                const ipFail = securityRateLimiter.recordFailure(`member-login:ip:${cleanIp}`, 5, 15 * 60 * 1000);
                const accountFail = securityRateLimiter.recordFailure(`member-login:account:${cleanEmail}`, 5, 15 * 60 * 1000);
                const remaining = Math.min(ipFail.attemptsLeft, accountFail.attemptsLeft);
                const errMsg = remaining > 0
                    ? `Email atau kata sandi tidak valid. Sisa kesempatan: ${remaining}x.`
                    : `Terlalu banyak percobaan gagal. Akses login dibatasi selama 15 menit.`;

                if (isJson) return res.status(401).json({ status: 'error', message: errMsg, attemptsLeft: remaining });
                return res.redirect(`/#/member/login?error=${encodeURIComponent(errMsg)}&email=${encodeURIComponent(cleanEmail)}`);
            }

            if (!user.verified) {
                if (isJson) return res.status(403).json({ status: 'error', message: 'Akun belum diverifikasi' });
                return res.redirect(`/#/member/login?error=Akun belum diverifikasi&email=${encodeURIComponent(cleanEmail)}`);
            }

            if (user.banned) {
                if (isJson) return res.status(403).json({ status: 'error', message: 'Akun anda telah dibanned' });
                return res.redirect(`/#/member/login?error=Akun anda telah dibanned&email=${encodeURIComponent(cleanEmail)}`);
            }

            // Clear failure counters on successful login
            securityRateLimiter.clear(`member-login:ip:${cleanIp}`);
            securityRateLimiter.clear(`member-login:account:${cleanEmail}`);

            // Set session
            const session = req.session as unknown as MemberSession;
            session.userId = user.id;
            session.userName = user.name || user.email;
            session.userEmail = user.email;
            session.userAvatar = user.avatar || undefined;
            session.isMemberAuthenticated = true;

            const returnToRaw = (body as any)?.return_to || (req.query?.return_to as string);
            let safeReturnTo: string | null = null;
            if (returnToRaw && typeof returnToRaw === 'string' && (returnToRaw.startsWith('/') || returnToRaw.startsWith('#/'))) {
                safeReturnTo = returnToRaw;
            }

            if (isJson) {
                return res.json({
                    status: 'success',
                    message: 'Login berhasil',
                    redirect_to: safeReturnTo || '/#/member/dashboard',
                    user: {
                        name: session.userName,
                        email: session.userEmail,
                        avatar: session.userAvatar
                    }
                });
            }

            res.redirect(safeReturnTo || '/#/member/dashboard');
        } catch (error) {
            console.error('Member login error:', error);
            const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
            if (isJson) return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem' });
            res.redirect('/#/member/login?error=Terjadi kesalahan sistem');
        }
    }

    /**
     * Show register page
     */
    async showRegister(req: Request, res: Response) {
        // If already logged in, redirect to dashboard
        const session = req.session as unknown as MemberSession;
        if (session && session.isMemberAuthenticated) {
            return res.redirect('/#/member/dashboard');
        }

        const error = req.query.error as string | undefined;
        // Keep input values if error
        const name = req.query.name as string;
        const email = req.query.email as string;
        const company = req.query.company as string;
        const whatsapp = req.query.whatsapp as string;

        res.send(memberRegisterPage(error, { name, email, company, whatsapp }));
        await Promise.resolve();
    }

    /**
     * API: Send Registration OTP with Anti-Spam 60s cooldown
     */
    async apiSendRegisterOtp(req: Request, res: Response) {
        try {
            const { email, name } = req.body as { email?: string; name?: string };

            if (!email || !email.trim()) {
                return res.status(400).json({ status: 'error', message: 'Alamat email wajib diisi' });
            }

            const cleanIp = getClientIp(req);
            const cleanEmail = email.trim().toLowerCase();

            // IP-level rate limit on OTP generation requests (max 5 per 10 mins)
            const ipReqLock = securityRateLimiter.check(`register-otp-req:${cleanIp}`, 5, 10 * 60 * 1000);
            if (ipReqLock.isLocked) {
                return res.status(429).json({
                    status: 'error',
                    message: `Terlalu banyak permintaan kode OTP dari IP Anda. Silakan coba lagi dalam ${Math.ceil(ipReqLock.remainingSeconds / 60)} menit.`,
                    remainingSeconds: ipReqLock.remainingSeconds
                });
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(cleanEmail)) {
                return res.status(400).json({ status: 'error', message: 'Format alamat email tidak valid' });
            }

            // Check if already registered
            const existingUser = await prisma.user.findFirst({
                where: { email: cleanEmail }
            });
            if (existingUser) {
                return res.status(400).json({
                    status: 'error',
                    message: 'Email sudah terdaftar. Silakan langsung login atau gunakan fitur Lupa Kata Sandi.'
                });
            }

            // Anti-spam cooldown check (60 seconds)
            const now = Math.floor(Date.now() / 1000);
            const lastToken = await prisma.verification_token.findFirst({
                where: { email: cleanEmail },
                orderBy: { created: 'desc' }
            });

            if (lastToken && (now - lastToken.created) < 60) {
                const remaining = 60 - (now - lastToken.created);
                return res.status(429).json({
                    status: 'error',
                    message: `Mohon tunggu ${remaining} detik sebelum meminta kode OTP baru.`,
                    retry_after: remaining
                });
            }

            // Record attempt in IP rate limiter
            securityRateLimiter.recordFailure(`register-otp-req:${cleanIp}`, 5, 10 * 60 * 1000);

            // Generate 6-digit secure numeric OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiryMinutes = 10;
            const expired = now + (expiryMinutes * 60);

            // Store verification token in DB
            await prisma.verification_token.create({
                data: {
                    name: (name || 'Pengguna Baru').trim(),
                    email: cleanEmail,
                    token: otp,
                    is_taked: false,
                    created: now,
                    expired: expired,
                    user_id: 0,
                }
            });

            // Dispatch Email via SMTP
            try {
                await sendEmail({
                    to: cleanEmail,
                    subject: `Kode Verifikasi Pendaftaran AppCenter [${otp}]`,
                    html: getRegisterOtpTemplate(name || 'Pengguna Baru', otp, expiryMinutes),
                    text: `Halo ${name || 'Pengguna'},\n\nTerima kasih telah mendaftar di AppCenter.\nKode Verifikasi OTP Anda adalah: ${otp}\n(Kode ini berlaku selama ${expiryMinutes} menit).\n\nJangan berikan kode ini kepada siapa pun.\n\n© ${new Date().getFullYear()} Ziqva Labs.`
                });
            } catch (mailErr: any) {
                console.error('[RegisterOTP] Email dispatch error:', mailErr);
                return res.status(500).json({
                    status: 'error',
                    message: `Gagal mengirim email OTP: ${mailErr?.message || 'Layanan SMTP tidak merespons'}. Pastikan konfigurasi SMTP di admin telah diatur.`
                });
            }

            return res.json({
                status: 'success',
                message: `Kode OTP verifikasi berhasil dikirim ke ${cleanEmail}. Silakan periksa inbox atau folder spam Anda.`,
                cooldown_seconds: 60
            });
        } catch (error: any) {
            console.error('Send register OTP error:', error);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan saat memproses kode OTP' });
        }
    }

    /**
     * API: Verify Registration OTP (Pre-check)
     */
    async apiVerifyRegisterOtp(req: Request, res: Response) {
        try {
            const { email, otp } = req.body as { email?: string; otp?: string };

            if (!email || !otp) {
                return res.status(400).json({ status: 'error', message: 'Email dan kode OTP wajib diisi' });
            }

            const cleanIp = getClientIp(req);
            const cleanEmail = email.trim().toLowerCase();
            const cleanOtp = otp.trim();

            // Brute force protection on OTP verification
            const verifyLock = securityRateLimiter.check(`register-otp-verify:${cleanIp}:${cleanEmail}`, 5, 15 * 60 * 1000);
            if (verifyLock.isLocked) {
                return res.status(429).json({
                    status: 'error',
                    message: `Terlalu banyak percobaan kode OTP yang salah. Akses verifikasi dibatasi selama ${Math.ceil(verifyLock.remainingSeconds / 60)} menit.`,
                    remainingSeconds: verifyLock.remainingSeconds
                });
            }

            const now = Math.floor(Date.now() / 1000);

            const tokenRecord = await prisma.verification_token.findFirst({
                where: {
                    email: cleanEmail,
                    token: cleanOtp,
                    is_taked: false,
                    expired: { gte: now }
                },
                orderBy: { created: 'desc' }
            });

            if (!tokenRecord) {
                const fail = securityRateLimiter.recordFailure(`register-otp-verify:${cleanIp}:${cleanEmail}`, 5, 15 * 60 * 1000);
                const remaining = fail.attemptsLeft;
                const errMsg = remaining > 0
                    ? `Kode OTP salah atau telah kedaluwarsa. Sisa kesempatan: ${remaining}x.`
                    : `Batas percobaan kode OTP tercapai. Akses verifikasi dibatasi selama 15 menit.`;

                return res.status(400).json({
                    status: 'error',
                    message: errMsg,
                    attemptsLeft: remaining
                });
            }

            return res.json({
                status: 'success',
                message: 'Kode OTP valid'
            });
        } catch (error) {
            console.error('Verify register OTP error:', error);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem' });
        }
    }

    /**
     * Process register (With Mandatory Email OTP Verification)
     */
    async processRegister(req: Request, res: Response) {
        try {
            const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
            const body = req.body as {
                name?: string;
                email?: string;
                password?: string;
                confirm_password?: string;
                company?: string;
                whatsapp?: string;
                otp?: string;
            };

            const { name, email, password, confirm_password, company, whatsapp, otp } = body;

            // Helper to build redirect URL with params
            const backUrl = (err: string) => {
                const params = new URLSearchParams();
                params.append('error', err);
                if (name) params.append('name', name);
                if (email) params.append('email', email);
                if (company) params.append('company', company);
                if (whatsapp) params.append('whatsapp', whatsapp);
                return `/member/register?${params.toString()}`;
            };

            if (!name || !email || !password || !confirm_password || !whatsapp) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Mohon lengkapi semua field wajib' });
                return res.redirect(backUrl('Mohon lengkapi semua field wajib'));
            }

            if (!otp || !otp.trim()) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Kode OTP verifikasi email wajib diisi' });
                return res.redirect(backUrl('Kode OTP verifikasi email wajib diisi'));
            }

            if (password !== confirm_password) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Konfirmasi kata sandi tidak sesuai' });
                return res.redirect(backUrl('Konfirmasi kata sandi tidak sesuai'));
            }

            if (password.length < 6) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Kata sandi minimal 6 karakter' });
                return res.redirect(backUrl('Kata sandi minimal 6 karakter'));
            }

            const cleanEmail = email.trim().toLowerCase();
            const cleanIp = getClientIp(req);

            // Brute force protection on registration OTP verification
            const verifyLock = securityRateLimiter.check(`register-otp-verify:${cleanIp}:${cleanEmail}`, 5, 15 * 60 * 1000);
            if (verifyLock.isLocked) {
                const lockMsg = `Terlalu banyak percobaan kode OTP yang salah. Akses verifikasi dibatasi selama ${Math.ceil(verifyLock.remainingSeconds / 60)} menit.`;
                if (isJson) return res.status(429).json({ status: 'error', message: lockMsg, remainingSeconds: verifyLock.remainingSeconds });
                return res.redirect(backUrl(lockMsg));
            }

            // Check existing user
            const existingUser = await prisma.user.findFirst({
                where: { email: cleanEmail }
            });

            if (existingUser) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Email sudah terdaftar. Silakan langsung login.' });
                return res.redirect(backUrl('Email sudah terdaftar. Silakan langsung login.'));
            }

            // Verify OTP
            const now = Math.floor(Date.now() / 1000);
            const tokenRecord = await prisma.verification_token.findFirst({
                where: {
                    email: cleanEmail,
                    token: otp.trim(),
                    is_taked: false,
                    expired: { gte: now }
                },
                orderBy: { created: 'desc' }
            });

            if (!tokenRecord) {
                const fail = securityRateLimiter.recordFailure(`register-otp-verify:${cleanIp}:${cleanEmail}`, 5, 15 * 60 * 1000);
                const remaining = fail.attemptsLeft;
                const errMsg = remaining > 0
                    ? `Kode OTP salah atau telah kedaluwarsa. Sisa kesempatan: ${remaining}x.`
                    : `Batas percobaan kode OTP tercapai. Akses verifikasi dibatasi selama 15 menit.`;

                if (isJson) return res.status(400).json({ status: 'error', message: errMsg, attemptsLeft: remaining });
                return res.redirect(backUrl(errMsg));
            }

            // Clear failure counter on success
            securityRateLimiter.clear(`register-otp-verify:${cleanIp}:${cleanEmail}`);

            // Mark OTP as used
            await prisma.verification_token.update({
                where: { id: tokenRecord.id },
                data: { is_taked: true }
            });

            // Create User (Verified = true)
            const newUser = await prisma.user.create({
                data: {
                    email: cleanEmail,
                    password: password,
                    name: name.trim(),
                    company: company ? company.trim() : '',
                    whatsapp: whatsapp.trim(),
                    verified: true,
                    banned: false,
                    created: now,
                    ip: getClientIp(req),
                    avatar: 'https://ui-avatars.com/api/?name=' + encodeURIComponent(name.trim()),
                    original_id: 0,
                }
            });

            // Associate token with new user
            await prisma.verification_token.update({
                where: { id: tokenRecord.id },
                data: { user_id: newUser.id }
            });

            // Auto-login session for seamless UX
            const session = req.session as unknown as MemberSession;
            session.userId = newUser.id;
            session.userName = newUser.name;
            session.userEmail = newUser.email;
            session.userAvatar = newUser.avatar;
            session.isMemberAuthenticated = true;

            const returnToRaw = (body as any)?.return_to || (req.query?.return_to as string);
            let safeReturnTo: string | null = null;
            if (returnToRaw && typeof returnToRaw === 'string' && (returnToRaw.startsWith('/') || returnToRaw.startsWith('#/'))) {
                safeReturnTo = returnToRaw;
            }

            if (isJson) {
                return res.json({
                    status: 'success',
                    message: 'Pendaftaran berhasil! Akun Anda telah terverifikasi.',
                    redirect_to: safeReturnTo || '/#/member/dashboard',
                    user: {
                        name: newUser.name,
                        email: newUser.email,
                        avatar: newUser.avatar
                    }
                });
            }

            // Redirect to Dashboard
            res.redirect(safeReturnTo || '/#/member/dashboard');

        } catch (error: any) {
            console.error('Member register error:', error);
            const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
            if (isJson) return res.status(500).json({ status: 'error', message: error?.message || 'Terjadi kesalahan sistem' });
            res.redirect('/#/member/register?error=Terjadi kesalahan sistem');
        }
    }

    /**
     * API: Send Forgot Password OTP with Anti-Spam 60s cooldown
     */
    async apiSendForgotPasswordOtp(req: Request, res: Response) {
        try {
            const { email } = req.body as { email?: string };

            if (!email || !email.trim()) {
                return res.status(400).json({ status: 'error', message: 'Alamat email wajib diisi' });
            }

            const cleanIp = getClientIp(req);
            const cleanEmail = email.trim().toLowerCase();

            // IP-level rate limit on reset OTP requests (max 5 per 10 mins)
            const ipReqLock = securityRateLimiter.check(`reset-pwd-req:${cleanIp}`, 5, 10 * 60 * 1000);
            if (ipReqLock.isLocked) {
                return res.status(429).json({
                    status: 'error',
                    message: `Terlalu banyak permintaan reset kata sandi dari IP Anda. Silakan coba lagi dalam ${Math.ceil(ipReqLock.remainingSeconds / 60)} menit.`,
                    remainingSeconds: ipReqLock.remainingSeconds
                });
            }

            const user = await prisma.user.findFirst({
                where: { email: cleanEmail }
            });

            if (!user) {
                return res.status(404).json({
                    status: 'error',
                    message: 'Alamat email tidak terdaftar sebagai member.'
                });
            }

            if (user.banned) {
                return res.status(403).json({
                    status: 'error',
                    message: 'Akun Anda telah dinonaktifkan/dibanned. Hubungi admin untuk bantuan.'
                });
            }

            // Anti-spam cooldown check (60 seconds)
            const now = Math.floor(Date.now() / 1000);
            const lastToken = await prisma.reset_password.findFirst({
                where: { email: cleanEmail },
                orderBy: { created: 'desc' }
            });

            if (lastToken && (now - lastToken.created) < 60) {
                const remaining = 60 - (now - lastToken.created);
                return res.status(429).json({
                    status: 'error',
                    message: `Mohon tunggu ${remaining} detik sebelum meminta kode OTP reset baru.`,
                    retry_after: remaining
                });
            }

            // Record request in rate limiter
            securityRateLimiter.recordFailure(`reset-pwd-req:${cleanIp}`, 5, 10 * 60 * 1000);

            // Generate 6-digit OTP
            const otp = Math.floor(100000 + Math.random() * 900000).toString();
            const expiryMinutes = 15;
            const expired = now + (expiryMinutes * 60);

            // Store reset token
            await prisma.reset_password.create({
                data: {
                    name: user.name || user.email,
                    email: cleanEmail,
                    token: otp,
                    is_taked: false,
                    created: now,
                    expired: expired,
                    user_id: user.id,
                }
            });

            // Dispatch Email via SMTP
            try {
                await sendEmail({
                    to: cleanEmail,
                    subject: `Kode OTP Pemulihan Kata Sandi [${otp}] - AppCenter`,
                    html: getResetPasswordOtpTemplate(user.name, otp, expiryMinutes),
                    text: `Halo ${user.name || 'Pengguna'},\n\nKami menerima permintaan untuk mereset kata sandi akun AppCenter Anda.\nKode OTP Anda adalah: ${otp}\n(Kode ini berlaku selama ${expiryMinutes} menit).\n\nJika Anda tidak merasa mengajukan permintaan ini, silakan abaikan pesan ini.\n\n© ${new Date().getFullYear()} Ziqva Labs.`
                });
            } catch (mailErr: any) {
                console.error('[ForgotPasswordOTP] Email dispatch error:', mailErr);
                return res.status(500).json({
                    status: 'error',
                    message: `Gagal mengirim email reset: ${mailErr?.message || 'Layanan SMTP tidak merespons'}. Pastikan konfigurasi SMTP di admin telah diatur.`
                });
            }

            return res.json({
                status: 'success',
                message: `Kode OTP pemulihan kata sandi telah dikirim ke ${cleanEmail}. Periksa kotak masuk atau spam.`,
                cooldown_seconds: 60
            });
        } catch (error: any) {
            console.error('Send forgot password OTP error:', error);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan saat memproses permintaan reset kata sandi' });
        }
    }

    /**
     * API: Verify Forgot Password OTP & Set New Password
     */
    async apiResetPassword(req: Request, res: Response) {
        try {
            const { email, otp, new_password, confirm_password } = req.body as {
                email?: string;
                otp?: string;
                new_password?: string;
                confirm_password?: string;
            };

            if (!email || !otp || !new_password || !confirm_password) {
                return res.status(400).json({ status: 'error', message: 'Semua field wajib diisi' });
            }

            if (new_password !== confirm_password) {
                return res.status(400).json({ status: 'error', message: 'Konfirmasi kata sandi baru tidak sesuai' });
            }

            if (new_password.length < 6) {
                return res.status(400).json({ status: 'error', message: 'Kata sandi minimal 6 karakter' });
            }

            const cleanIp = getClientIp(req);
            const cleanEmail = email.trim().toLowerCase();
            const cleanOtp = otp.trim();

            // Brute force protection on reset OTP verification
            const ipLock = securityRateLimiter.check(`reset-pwd-verify:${cleanIp}:${cleanEmail}`, 5, 15 * 60 * 1000);
            if (ipLock.isLocked) {
                return res.status(429).json({
                    status: 'error',
                    message: `Terlalu banyak percobaan kode OTP yang salah. Akses dibatasi selama ${Math.ceil(ipLock.remainingSeconds / 60)} menit.`,
                    remainingSeconds: ipLock.remainingSeconds
                });
            }

            const accountLock = securityRateLimiter.check(`reset-pwd-account:${cleanEmail}`, 5, 15 * 60 * 1000);
            if (accountLock.isLocked) {
                return res.status(429).json({
                    status: 'error',
                    message: `Akun ini sementara dikunci karena terlalu banyak percobaan OTP yang salah. Silakan coba lagi dalam ${Math.ceil(accountLock.remainingSeconds / 60)} menit.`,
                    remainingSeconds: accountLock.remainingSeconds
                });
            }

            const now = Math.floor(Date.now() / 1000);

            const resetRecord = await prisma.reset_password.findFirst({
                where: {
                    email: cleanEmail,
                    token: cleanOtp,
                    is_taked: false,
                    expired: { gte: now }
                },
                orderBy: { created: 'desc' }
            });

            if (!resetRecord) {
                const ipFail = securityRateLimiter.recordFailure(`reset-pwd-verify:${cleanIp}:${cleanEmail}`, 5, 15 * 60 * 1000);
                const accountFail = securityRateLimiter.recordFailure(`reset-pwd-account:${cleanEmail}`, 5, 15 * 60 * 1000);
                const remaining = Math.min(ipFail.attemptsLeft, accountFail.attemptsLeft);
                const errMsg = remaining > 0
                    ? `Kode OTP salah atau telah kedaluwarsa. Sisa kesempatan: ${remaining}x.`
                    : `Batas percobaan kode OTP tercapai. Akses dibatasi selama 15 menit.`;

                return res.status(400).json({
                    status: 'error',
                    message: errMsg,
                    attemptsLeft: remaining
                });
            }

            // Clear all failure counters on successful reset
            securityRateLimiter.clear(`reset-pwd-verify:${cleanIp}:${cleanEmail}`);
            securityRateLimiter.clear(`reset-pwd-account:${cleanEmail}`);
            securityRateLimiter.clear(`member-login:account:${cleanEmail}`);
            securityRateLimiter.clear(`member-login:ip:${cleanIp}`);

            // Find user
            const user = await prisma.user.findFirst({
                where: { email: cleanEmail }
            });

            if (!user) {
                return res.status(404).json({ status: 'error', message: 'Pengguna tidak ditemukan' });
            }

            // Mark OTP as used
            await prisma.reset_password.update({
                where: { id: resetRecord.id },
                data: { is_taked: true }
            });

            // Update password and ensure verified
            await prisma.user.update({
                where: { id: user.id },
                data: {
                    password: new_password,
                    verified: true
                }
            });

            // Send security notification email (fire and forget / catch error safely)
            try {
                const timeStr = new Date().toLocaleString('id-ID', {
                    dateStyle: 'full',
                    timeStyle: 'medium',
                    timeZone: 'Asia/Jakarta'
                });
                await sendEmail({
                    to: cleanEmail,
                    subject: 'Keamanan Akun: Kata Sandi Berhasil Diperbarui - AppCenter',
                    html: getPasswordChangedTemplate(user.name, timeStr, getClientIp(req))
                });
            } catch (notifyErr) {
                console.error('[PasswordReset] Failed to send security alert email:', notifyErr);
            }

            return res.json({
                status: 'success',
                message: 'Kata sandi Anda berhasil diperbarui! Silakan login dengan kata sandi baru.'
            });
        } catch (error: any) {
            console.error('Reset password error:', error);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan saat memperbarui kata sandi' });
        }
    }

    /**
     * Show dashboard
     */
    async showDashboard(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const userEmail = session.userEmail || '';

        const [products, totalOrders, totalLicenses] = await Promise.all([
            prisma.products.findMany({
                where: { is_active: true },
                orderBy: { id: 'desc' }
            }),
            prisma.order_list.count({
                where: { user: userEmail }
            }),
            prisma.token_device_activation.count({
                where: {
                    user: userEmail
                }
            })
        ]);

        const data = {
            name: session.userName || 'Member',
            email: userEmail,
            avatar: session.userAvatar,
            products: products,
            totalOrders: totalOrders,
            totalLicenses: totalLicenses
        };

        res.send(memberDashboardPage(data));
        await Promise.resolve();
    }

    /**
     * Show Downloads
     */
    async showDownloads(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const [products, files] = await Promise.all([
            prisma.products.findMany({
                where: { is_active: true },
                orderBy: { id: 'desc' }
            }),
            downloadService.getFiles()
        ]);

        const data = {
            name: session.userName || 'Member',
            email: session.userEmail || '',
            avatar: session.userAvatar,
            products: products,
            files: files
        };

        res.send(memberDownloadsPage(data));
        await Promise.resolve();
    }

    /**
     * Show Tutorials Video Learning Hub
     */
    async showTutorials(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const products = await prisma.products.findMany({
            where: { is_active: true },
            orderBy: { id: 'desc' }
        });

        const data = {
            name: session.userName || 'Member',
            email: session.userEmail || '',
            avatar: session.userAvatar,
            products: products
        };

        res.send(memberTutorialsPage(data));
        await Promise.resolve();
    }

    /**
     * Show orders
     */
    async showOrders(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const userEmail = session.userEmail || '';
        const userData = {
            name: session.userName || 'Member',
            email: userEmail,
            avatar: session.userAvatar,
        };

        // Query params
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const searchQuery = (req.query.search as string) || '';
        const sort = (req.query.sort as string) || 'created';
        const orderDir = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

        // Build Prisma query
        let where: Record<string, unknown> = { user: userEmail };
        if (searchQuery) {
            where = {
                ...where,
                OR: [
                    { status: { contains: searchQuery, mode: 'insensitive' } },
                    { payment: { contains: searchQuery, mode: 'insensitive' } },
                    { note: { contains: searchQuery, mode: 'insensitive' } },
                ],
            };
        }

        interface OrderModel {
            id: number;
            user: string;
            items: string | object;
            voucer: string | object | null;
            status: string;
            payment: string;
            note: string | null;
            created: number; // Stored as epoch
            updated: number; // Stored as epoch
            paid_at: number | null; // Stored as epoch
            payment_id: string | null;
            payment_request_id: string | null;
            payment_url: string | null;
            total_amount?: number;
        }

        let orders: OrderModel[] = [];
        let totalOrders = 0;

        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            totalOrders = await prisma.order_list.count({ where }) as unknown as number;
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const rawOrders = await prisma.order_list.findMany({
                where,
                orderBy: { [sort]: orderDir },
                skip: (page - 1) * pageSize,
                take: pageSize,
            });
            // Cast generic prisma result to our model
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            orders = rawOrders as unknown as OrderModel[];

            // Kalkulasi total hanya jika belum ada (legacy check)
            for (const order of orders) {
                if (order.total_amount && order.total_amount > 0) continue;

                let total = 0;

                // Safe items parsing
                let itemsArr: OrderItem[] = [];
                try {
                    const parsed: unknown = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    if (Array.isArray(parsed)) {
                        itemsArr = parsed as OrderItem[];
                    } else if (parsed && typeof parsed === 'object') {
                        itemsArr = [parsed as OrderItem];
                    }
                } catch (e) {
                    itemsArr = [];
                }

                for (const item of itemsArr) {
                    // Ambil detail produk dari tabel products
                    let product = null;
                    if (item.product_id) {
                        product = await prisma.products.findFirst({ where: { product_id: Number(item.product_id) } });
                    }

                    let price = 0;
                    if (product) {
                        price = product.price;
                    } else if (typeof item.price === 'number') {
                        price = item.price;
                    }

                    // Diskon produk
                    if ((product && product.is_discount) && product.discount_percent > 0) {
                        price -= Math.round(price * product.discount_percent / 100);
                    }
                    total += price;
                }

                // Voucer/affiliate
                let voucer: OrderVoucer | null = null;
                try {
                    const parsedVoucer: unknown = typeof order.voucer === 'string' ? JSON.parse(order.voucer) : order.voucer;
                    if (parsedVoucer && typeof parsedVoucer === 'object') {
                        voucer = parsedVoucer as OrderVoucer;
                    }
                } catch (e) {
                    voucer = null;
                }

                if (voucer && typeof voucer.decrease_value === 'number') {
                    if (voucer.voucer_type === '%') {
                        total -= Math.round(total * voucer.decrease_value / 100);
                    } else {
                        total -= voucer.decrease_value;
                    }
                }
                order.total_amount = total > 0 ? total : 0;
            }
        } catch (err) {
            console.error('Gagal fetch orders:', err);
        }

        // Map orders to OrderData structure (converting Date to epoch seconds)
        const mappedOrders = orders.map(order => ({
            ...order,
            created: order.created,
            paid_at: order.paid_at,
            payment_url: order.payment_url || undefined,
            // Ensure proper types for other fields if needed, though they match mostly
        }));

        res.send(memberOrdersPage(userData, mappedOrders, {
            page,
            pageSize,
            totalOrders,
            search: searchQuery,
            sort,
            order: orderDir,
        }));
    }

    /**
     * Show licenses page
     */
    async showLicenses(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const userEmail = session.userEmail || '';

        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const search = (req.query.search as string) || '';
        const sort = (req.query.sort as string) || 'created';
        const orderDir = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

        const userData = {
            name: session.userName || 'Member',
            email: userEmail,
            avatar: session.userAvatar,
            licenses: [] as any[],
            sortData: { field: sort, order: orderDir },
            pagination: { page, pageSize, totalItems: 0, totalPages: 0 },
            search
        };

        try {
            // Fetch validation tokens (licenses) for this user
            const tokens = await prisma.token_device_activation.findMany({
                where: { user: userEmail },
                orderBy: { created: 'desc' }
            });

            // Process tokens to find related devices
            const allUserDevices = await prisma.device.findMany({
                where: { email: userEmail }
            });

            // Fetch products for tutorial links
            const allProducts = await prisma.products.findMany({
                select: { id: true, name: true, product_id: true, tutorials: true }
            });

            const productByName = new Map<string, typeof allProducts[0]>();
            const productByProductId = new Map<number, typeof allProducts[0]>();
            allProducts.forEach(p => {
                if (p.name) productByName.set(p.name.toLowerCase(), p);
                if (p.product_id) productByProductId.set(p.product_id, p);
            });

            const deviceByKey = new Map<string, typeof allUserDevices[0]>();
            allUserDevices.forEach(d => {
                if (d.order_id && d.product) {
                    deviceByKey.set(`${d.order_id}_${d.product.toLowerCase()}`, d);
                }
            });

            let licenses = tokens.map(token => {
                const prodKey = token.product ? token.product.toLowerCase() : '';
                const relatedDevice = token.order_id && prodKey ? deviceByKey.get(`${token.order_id}_${prodKey}`) : undefined;
                const matchedProduct = (prodKey ? productByName.get(prodKey) : undefined)
                    || (token.order_id ? productByProductId.get(token.order_id) : undefined);
                const tutorials = matchedProduct ? matchedProduct.tutorials : null;

                const now = Math.floor(Date.now() / 1000);
                let status: 'used' | 'unused' | 'expired' = 'unused';
                let statusText = 'Not Used';
                let message = '-';
                let cssClass = 'border-zinc-700 bg-zinc-800 text-zinc-400';
                let durationVal = token.duration; // Default duration value
                let durationStr = `${token.duration} Days`;

                let createdTimestamp = token.created;
                let validityTimestamp = 0;

                // Logic Status
                if (token.taked) {
                    // Determine expiration time
                    let expireTime = 0;

                    if (relatedDevice) {
                        expireTime = relatedDevice.expired;
                        createdTimestamp = relatedDevice.created;
                        durationVal = relatedDevice.duration; // Use device duration
                        durationStr = `${relatedDevice.duration} Days`;
                    } else {
                        // If device missing, calculate from taked_at
                        const startTime = token.taked_at || token.created;
                        expireTime = startTime + (token.duration * 24 * 60 * 60);
                    }

                    validityTimestamp = expireTime;

                    const isExpired = expireTime < now;

                    if (isExpired) {
                        status = 'expired';
                        statusText = 'Expired';
                        message = 'Licence expired';
                        cssClass = 'border-red-900/30 bg-red-900/10 text-red-400';
                    } else {
                        status = 'used';
                        statusText = 'Active';

                        // Human readable remaining time
                        const diff = expireTime - now;
                        const days = Math.floor(diff / (3600 * 24));
                        const hours = Math.floor((diff % (3600 * 24)) / 3600);
                        const minutes = Math.floor((diff % 3600) / 60);

                        if (days > 0) {
                            message = `${days} Days left`;
                        } else if (hours > 0) {
                            message = `${hours} Hours left`;
                        } else if (minutes > 0) {
                            message = `${minutes} Mins left`;
                        } else {
                            message = `< 1 Min left`;
                        }
                        cssClass = 'border-emerald-900/30 bg-emerald-900/10 text-emerald-400';
                    }
                } else {
                    status = 'unused';
                    statusText = 'Not Used';
                    message = 'Ready to use';
                    cssClass = 'border-blue-900/30 bg-blue-900/10 text-blue-400';
                    validityTimestamp = 9999999999;
                }

                const createdDate = new Date(createdTimestamp * 1000);
                const createdStr = createdDate.toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });

                return {
                    id: token.id,
                    key: token.token,
                    product: token.product,
                    status,
                    statusText,
                    message,
                    machineId: relatedDevice ? relatedDevice.machine_id : '',
                    duration: durationStr,
                    durationVal,
                    created: createdStr,
                    createdTimestamp,
                    validityTimestamp,
                    actionUrl: relatedDevice ? `/member/device/${relatedDevice.id}/edit-machine` : '#',
                    cssClass,
                    tutorials
                };
            });

            // Filter logic
            if (search) {
                const searchLower = search.toLowerCase();
                licenses = licenses.filter(l =>
                    l.product.toLowerCase().includes(searchLower) ||
                    l.key.toLowerCase().includes(searchLower) ||
                    (l.machineId && l.machineId.toLowerCase().includes(searchLower))
                );
            }

            // Sorting logic
            licenses.sort((a, b) => {
                let valA = 0;
                let valB = 0;

                if (sort === 'validity') {
                    valA = a.validityTimestamp;
                    valB = b.validityTimestamp;
                } else if (sort === 'duration') {
                    valA = a.durationVal;
                    valB = b.durationVal;
                } else {
                    valA = a.createdTimestamp;
                    valB = b.createdTimestamp;
                }

                if (orderDir === 'asc') {
                    return valA - valB;
                } else {
                    return valB - valA;
                }
            });

            // Pagination logic
            const totalItems = licenses.length;
            const totalPages = Math.ceil(totalItems / pageSize);
            const startIndex = (page - 1) * pageSize;
            const endIndex = startIndex + pageSize;
            const paginatedLicenses = licenses.slice(startIndex, endIndex);

            userData.licenses = paginatedLicenses;
            userData.pagination = { page, pageSize, totalItems, totalPages };

        } catch (error) {
            console.error('Error fetching licenses:', error);
        }

        res.send(memberLicensesPage(userData));
    }

    /**
     * Show edit machine page
     */
    async showEditMachine(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const deviceId = Number(req.params.deviceId);
        const userEmail = session.userEmail || '';
        const error = req.query.error as string | undefined;

        if (!deviceId) return res.redirect('/#/member/licenses');

        try {
            const device = await prisma.device.findFirst({
                where: { id: deviceId, email: userEmail }
            });

            if (!device) {
                return res.redirect('/#/member/licenses');
            }

            const data = {
                name: session.userName || 'Member',
                email: session.userEmail || '',
                avatar: session.userAvatar,
                deviceId: device.id,
                currentMachineId: device.machine_id || '',
                productName: device.product || device.label || 'Unknown Product'
            };

            res.send(memberDeviceEditPage(data, error));
        } catch (error) {
            console.error('Error fetching device:', error);
            res.redirect('/#/member/licenses');
        }
    }

    /**
     * Process edit machine
     */
    async processEditMachine(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const deviceId = Number(req.params.deviceId);
        const userEmail = session.userEmail || '';
        const body = req.body as { machine_id?: string };
        const machine_id = body.machine_id;

        if (!deviceId || !machine_id) {
            return res.redirect(`/member/device/${deviceId}/edit-machine?error=Machine ID is required`);
        }

        try {
            const device = await prisma.device.findFirst({
                where: { id: deviceId, email: userEmail }
            });

            if (!device) return res.redirect('/#/member/licenses');

            await prisma.device.update({
                where: { id: deviceId },
                data: { machine_id }
            });

            res.redirect('/#/member/licenses');
        } catch (error) {
            console.error('Error updating machine id:', error);
            res.redirect(`/member/device/${deviceId}/edit-machine?error=System error`);
        }
    }

    /**
     * Show create order page
     */
    async showCreateOrder(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const userEmail = session.userEmail || '';
        const error = req.query.error as string | undefined;

        try {
            const products = await prisma.products.findMany({
                where: {
                    is_active: true
                },
                orderBy: {
                    id: 'asc'
                }
            });

            // Cast products to needed interface (handling potential data mismatch)
            const mappedProducts = products.map(p => ({
                id: p.id,
                product_id: p.product_id,
                name: p.name,
                price: p.price,
                is_discount: p.is_discount,
                discount_percent: p.discount_percent,
                tutorials: p.tutorials
            }));

            const data = {
                name: session.userName || 'Member',
                email: userEmail,
                avatar: session.userAvatar,
                products: mappedProducts
            };

            res.send(memberCreateOrderPage(data, error));
        } catch (error) {
            console.error('Error showing create order:', error);
            res.redirect('/#/member/dashboard');
        }
    }

    /**
     * API Check Voucher logic
     */
    async apiCheckVoucher(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', valid: false, message: 'Unauthorized' });
        }

        const rawCode = req.body?.code || req.body?.voucher_code || '';
        const rawProductId = req.body?.product_id;
        const code = String(rawCode || '').trim();
        const productId = parseInt(String(rawProductId || '0'), 10);

        if (!code || !productId) {
            return res.json({ status: 'error', valid: false, message: 'Kode kupon atau produk tidak valid' });
        }

        try {
            const result = await this.validateVoucherLogic(code, productId);
            return res.json({
                status: result.valid ? 'success' : 'error',
                valid: result.valid,
                message: result.message,
                data: {
                    discount_amount: result.discountAmount || 0,
                    message: result.message,
                    voucher_data: result.voucherData
                }
            });
        } catch (error) {
            console.error('Voucher check error:', error);
            return res.status(500).json({ status: 'error', valid: false, message: 'Server error saat memeriksa kupon' });
        }
    }

    /**
     * Process Create Order
     */
    /**
     * Process Create Order
     */
    async processCreateOrder(req: Request, res: Response) {
        const isJson = req.is('json') || (req.headers.accept && req.headers.accept.includes('application/json'));
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            if (isJson) return res.status(401).json({ status: 'error', message: 'Unauthorized' });
            return res.redirect('/#/member/login');
        }

        const userEmail = session.userEmail || '';
        const body = req.body as { product_id?: string | number; voucher_code?: string; duration?: string | number; duration_select?: string | number };
        const productIdRaw = body.product_id;
        const durationRaw = body.duration || body.duration_select || '2';

        if (!productIdRaw) {
            if (isJson) return res.status(400).json({ status: 'error', message: 'Pilih produk terlebih dahulu' });
            return res.redirect('/#/member/orders/create?error=Pilih produk terlebih dahulu');
        }

        const durationMonths = parseInt(String(durationRaw), 10);
        if (![1, 2, 3, 4, 6].includes(durationMonths)) {
            if (isJson) return res.status(400).json({ status: 'error', message: 'Durasi tidak valid' });
            return res.redirect('/#/member/orders/create?error=Durasi tidak valid');
        }

        const targetId = parseInt(String(productIdRaw), 10);

        try {
            const product = await prisma.products.findFirst({
                where: {
                    id: targetId,
                    is_active: true
                }
            });

            if (!product) {
                if (isJson) return res.status(400).json({ status: 'error', message: 'Produk tidak ditemukan atau sedang tidak aktif' });
                return res.redirect('/#/member/orders/create?error=Produk tidak ditemukan atau sedang tidak tersedia untuk dipesan');
            }

            // Calculate Base Price for Duration
            let unitPrice = product.price;
            if (product.is_discount && product.discount_percent > 0) {
                unitPrice -= Math.round(product.price * product.discount_percent / 100);
            }
            if (unitPrice < 0) unitPrice = 0;

            let finalPrice = unitPrice * durationMonths;

            // Voucher Logic
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            let voucherData: any = null;
            if (body.voucher_code) {
                const voucherCheck = await this.validateVoucherLogic(body.voucher_code, targetId);

                if (voucherCheck.valid) {
                    const vData = voucherCheck.voucherData as { voucer_type: string; decrease_value: number };

                    let discountAmount = 0;
                    if (vData.voucer_type === '%') {
                        discountAmount = Math.round(finalPrice * vData.decrease_value / 100);
                    } else {
                        discountAmount = vData.decrease_value;
                    }

                    if (discountAmount > 0) {
                        finalPrice -= discountAmount;
                        if (finalPrice < 0) finalPrice = 0;
                        voucherData = vData;
                    }
                }
            }

            const now = Math.floor(Date.now() / 1000);

            // Construct items JSON
            const items = [{
                db_id: product.id,
                product_id: product.product_id,
                name: product.name,
                price: product.price,
                final_unit_price: unitPrice,
                duration_months: durationMonths,
                duration_text: `${durationMonths} Bulan`
            }];

            // Handle Free Product Order (Rp 0)
            if (finalPrice === 0 || product.price === 0) {
                const newOrder = await prisma.order_list.create({
                    data: {
                        user: userEmail,
                        items: JSON.stringify(items),
                        created: now,
                        paid_at: now,
                        confirmed_by: 'SYSTEM_FREE_CLAIM',
                        status: 'Order has been complete',
                        status_badge: '#4285F4',
                        payment: 'PAID',
                        payment_id: `FREE_CLAIM_${now}_${Math.floor(1000 + Math.random() * 9000)}`,
                        payment_request_id: `FREE_${now}_${Math.floor(1000 + Math.random() * 9000)}`,
                        payment_url: '',
                        note: 'Produk Gratis (Rp 0)',
                        duration: durationMonths * 43800,
                        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                        voucer: voucherData ? JSON.stringify(voucherData) : '',
                        total_amount: 0
                    }
                });

                // Generate License Token(s) (Multi-token if product is a Bundle)
                const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                const generateRandomToken = () => {
                    let t = '';
                    for (let i = 0; i < 20; i++) t += chars.charAt(Math.floor(Math.random() * chars.length));
                    return t;
                };

                const primaryToken = generateRandomToken();

                if (product.is_bundle && product.bundle_items) {
                    let bundleItemIds: number[] = [];
                    try {
                        const parsed = typeof product.bundle_items === 'string' ? JSON.parse(product.bundle_items) : product.bundle_items;
                        if (Array.isArray(parsed)) bundleItemIds = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
                    } catch {
                        bundleItemIds = String(product.bundle_items).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
                    }

                    if (bundleItemIds.length > 0) {
                        const includedProducts = await prisma.products.findMany({
                            where: { id: { in: bundleItemIds } },
                            select: { name: true }
                        });

                        for (let bIdx = 0; bIdx < includedProducts.length; bIdx++) {
                            const bProd = includedProducts[bIdx];
                            const t = bIdx === 0 ? primaryToken : generateRandomToken();
                            await prisma.token_device_activation.create({
                                data: {
                                    token: t,
                                    order_id: newOrder.id,
                                    product: bProd.name,
                                    duration: durationMonths * 43800,
                                    user: userEmail,
                                    created: now,
                                    taked: 0,
                                    taked_at: 0,
                                    taked_ip: ''
                                }
                            });
                        }
                    } else {
                        await prisma.token_device_activation.create({
                            data: {
                                token: primaryToken,
                                order_id: newOrder.id,
                                product: product.name,
                                duration: durationMonths * 43800,
                                user: userEmail,
                                created: now,
                                taked: 0,
                                taked_at: 0,
                                taked_ip: ''
                            }
                        });
                    }
                } else {
                    await prisma.token_device_activation.create({
                        data: {
                            token: primaryToken,
                            order_id: newOrder.id,
                            product: product.name,
                            duration: durationMonths * 43800,
                            user: userEmail,
                            created: now,
                            taked: 0,
                            taked_at: 0,
                            taked_ip: ''
                        }
                    });
                }

                if (isJson) {
                    return res.json({
                        status: 'success',
                        is_free: true,
                        message: 'Aktivasi lisensi produk gratis berhasil',
                        redirect: '/#/member/licenses',
                        order_id: newOrder.id,
                        token: primaryToken
                    });
                }

                return res.redirect('/#/member/licenses?success=Aktivasi lisensi gratis berhasil');
            }

            // Get expiry offset from settings or fallback to 24 hours (1440 minutes)
            const config = await getGoqrisConfig();
            const expiryMinutes = config.expiryMinutes || 1440;
            const expiresAt = now + (expiryMinutes * 60);

            // Paid Order
            const newOrder = await prisma.order_list.create({
                data: {
                    user: userEmail,
                    items: JSON.stringify(items),
                    created: now,
                    confirmed_by: '',
                    status: 'PENDING',
                    status_badge: 'warning',
                    payment: 'UNPAID',
                    note: '',
                    duration: durationMonths * 43800,
                    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
                    voucer: voucherData ? JSON.stringify(voucherData) : '',
                    total_amount: finalPrice,
                    payment_expires_at: expiresAt
                }
            });

            if (isJson) {
                return res.json({
                    status: 'success',
                    is_free: false,
                    redirect: `/member/orders/${newOrder.id}/pay`,
                    order_id: newOrder.id
                });
            }

            // Redirect to Pay
            return res.redirect(`/member/orders/${newOrder.id}/pay`);

        } catch (error) {
            console.error('Create order error:', error);
            if (isJson) return res.status(500).json({ status: 'error', message: 'Gagal membuat pesanan' });
            return res.redirect('/#/member/orders/create?error=Gagal membuat pesanan');
        }
    }

    /**
     * Helper logic for Checking Voucher
     */
    private async validateVoucherLogic(code: string, productId: number): Promise<{ valid: boolean; message: string; discountAmount: number; voucherData?: any }> {
        const product = await prisma.products.findFirst({
            where: {
                OR: [
                    { id: productId },
                    { product_id: productId }
                ],
                is_active: true
            }
        });
        if (!product) return { valid: false, message: 'Produk tidak ditemukan atau tidak aktif', discountAmount: 0 };

        const cleanCode = code.trim();

        // 1. Check Standard Vouchers
        const voucer = await prisma.voucers.findFirst({
            where: {
                OR: [
                    { code: cleanCode },
                    { code: cleanCode.toUpperCase() },
                    { code: cleanCode.toLowerCase() }
                ]
            }
        });

        if (voucer) {
            // Check product eligibility
            // voucer.products could be "all" or "1,2,3"
            const productIds = (voucer.products || '').split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
            const eligible = !voucer.products || voucer.products === 'all' || productIds.includes(product.product_id) || productIds.includes(product.id);

            if (!eligible) {
                return { valid: false, message: 'Voucher tidak berlaku untuk produk ini', discountAmount: 0 };
            }

            // Calculate Discount
            let discount = 0;
            if (voucer.voucer_type === '%') {
                let basePrice = product.price;
                if (product.is_discount && product.discount_percent > 0) {
                    basePrice -= Math.round(product.price * product.discount_percent / 100);
                }
                discount = Math.round(basePrice * voucer.decrease_value / 100);
            } else {
                discount = voucer.decrease_value;
            }

            return {
                valid: true,
                message: 'Voucher berhasil digunakan',
                discountAmount: discount,
                voucherData: {
                    code: voucer.code,
                    decrease_value: voucer.decrease_value,
                    voucer_type: voucer.voucer_type
                }
            };
        }

        // 2. Check Affiliate Member Coupons
        const affiliate = await prisma.affiliate_member.findFirst({
            where: {
                OR: [
                    { kupon: cleanCode },
                    { kupon: cleanCode.toUpperCase() },
                    { kupon: cleanCode.toLowerCase() }
                ]
            }
        });

        if (affiliate) {
            // Affiliate coupons are percentage based
            let basePrice = product.price;
            if (product.is_discount && product.discount_percent > 0) {
                basePrice -= Math.round(product.price * product.discount_percent / 100);
            }
            const discount = Math.round(basePrice * affiliate.kupon_decrease_value / 100);

            return {
                valid: true,
                message: 'Kode Kupon Affiliate berhasil digunakan',
                discountAmount: discount,
                voucherData: {
                    code: affiliate.kupon,
                    decrease_value: affiliate.kupon_decrease_value,
                    voucer_type: '%', // Affiliate is percentage
                    affiliate_email: affiliate.email,
                    affiliate_income: affiliate.kupon_income_idr
                }
            };
        }

        return { valid: false, message: 'Kode kupon / voucher tidak ditemukan', discountAmount: 0 };
    }

    async showProfile(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const data = {
            name: session.userName || 'Member',
            email: session.userEmail || '',
            avatar: session.userAvatar,
        };

        res.send(memberProfilePage(data));
        await Promise.resolve();
    }

    /**
     * Process change password
     */
    async processChangePassword(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const body = req.body as { current_password?: string; new_password?: string };
        const { current_password, new_password } = body;
        const userEmail = session.userEmail || '';

        if (!current_password || !new_password) {
            // Ideally we should show error in the page, for now redirect
            return res.redirect('/#/member/profile');
        }

        try {
            const user = await prisma.user.findFirst({
                where: { email: userEmail }
            });

            if (!user) return res.redirect('/#/member/login');

            if (user.password !== current_password) {
                // Wrong password
                // TODO: Pass error message to view
                return res.redirect('/#/member/profile');
            }

            // Update password
            await prisma.user.update({
                where: { id: user.id },
                data: { password: new_password }
            });

            // Destroy session and redirect to login
            req.session.destroy((err) => {
                if (err) console.error('Error destroying session:', err);
                res.redirect('/#/member/login?error=Password berhasil diubah, silakan login kembali');
            });

        } catch (error) {
            console.error('Error changing password:', error);
            res.redirect('/#/member/profile');
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
            res.redirect('/#/member/login');
        });
        await Promise.resolve(); // Satisfy require-await
    }

    /**
     * Handle payment for order
     */
    async payOrder(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const orderId = Number(req.params.orderId);
        if (!orderId) return res.status(400).send('Order ID tidak valid');

        const userEmail = session.userEmail || '';
        // Ambil order
        const order = await prisma.order_list.findFirst({ where: { id: orderId, user: userEmail } });
        if (!order) return res.status(404).send('Order tidak ditemukan');

        // Sudah dibayar, redirect ke orders
        if (order.paid_at || order.status === 'Order has been complete') return res.redirect('/#/member/orders');

        const now = Math.floor(Date.now() / 1000);
        const config = await getGoqrisConfig();
        const expiryMinutes = config.expiryMinutes || 1440;
        const effectiveExpiresAt = order.payment_expires_at || (order.created + (expiryMinutes * 60));

        // Jika waktu sekarang melebihi batas kedaluwarsa, tandai pesanan sebagai EXPIRED dan cegah pembayaran
        if (now > effectiveExpiresAt) {
            if (order.status !== 'EXPIRED') {
                await prisma.order_list.update({
                    where: { id: order.id },
                    data: {
                        status: 'EXPIRED',
                        status_badge: 'danger',
                        last_updated: new Date().toISOString()
                    }
                });
            }
            return res.redirect('/#/member/orders?error=Tagihan+pembayaran+telah+kadaluarsa');
        }

        // Jika payment_id/payment_request_id/payment_url belum ada, generate payment baru
        if (!order.payment_id || !order.payment_request_id || !order.payment_url) {
            let total = order.total_amount || 0;

            // Fallback calculation for legacy orders without total_amount
            if (total <= 0) {
                // Ambil data produk dan total
                // Safe parsing of items
                let itemsArr: OrderItem[] = [];
                try {
                    const parsed: unknown = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    if (Array.isArray(parsed)) {
                        itemsArr = parsed as OrderItem[];
                    } else if (parsed && typeof parsed === 'object') {
                        itemsArr = [parsed as OrderItem];
                    }
                } catch (e) { itemsArr = []; }

                for (const item of itemsArr) {
                    // Ambil detail produk dari tabel products
                    let product = null;
                    if (item.product_id) {
                        product = await prisma.products.findFirst({ where: { product_id: Number(item.product_id) } });
                    }

                    let price = 0;
                    if (product) {
                        price = product.price;
                    } else if (typeof item.price === 'number') {
                        price = item.price;
                    }

                    // Diskon produk
                    if ((product && product.is_discount) && product.discount_percent > 0) {
                        price -= Math.round(price * product.discount_percent / 100);
                    }
                    total += price;
                }

                // Voucer
                let voucer: OrderVoucer | null = null;
                try {
                    const parsedVoucer: unknown = typeof order.voucer === 'string' ? JSON.parse(order.voucer) : order.voucer;
                    if (parsedVoucer && typeof parsedVoucer === 'object') {
                        voucer = parsedVoucer as OrderVoucer;
                    }
                } catch (e) { voucer = null; }

                if (voucer && typeof voucer.decrease_value === 'number') {
                    if (voucer.voucer_type === '%') {
                        total -= Math.round(total * voucer.decrease_value / 100);
                    } else {
                        total -= voucer.decrease_value;
                    }
                }
            }
            total = total > 0 ? total : 0;

            // If order total is 0 (Free product), complete order automatically
            if (total === 0) {
                const now = Math.floor(Date.now() / 1000);
                await prisma.order_list.update({
                    where: { id: order.id },
                    data: {
                        status: 'Order has been complete',
                        status_badge: '#4285F4',
                        payment: 'PAID',
                        paid_at: now,
                        confirmed_by: 'SYSTEM_FREE_CLAIM',
                        payment_id: `FREE_CLAIM_${now}_${Math.floor(1000 + Math.random() * 9000)}`,
                        payment_request_id: `FREE_${now}_${Math.floor(1000 + Math.random() * 9000)}`,
                        payment_url: '',
                        total_amount: 0
                    }
                });

                // Check existing token or create
                const existingToken = await prisma.token_device_activation.findFirst({
                    where: { order_id: order.id }
                });

                if (!existingToken) {
                    let productName = 'App Product';
                    try {
                        interface ItemType { name?: string }
                        const rawItems: unknown = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                        if (Array.isArray(rawItems) && rawItems.length > 0) {
                            const firstItem = rawItems[0] as ItemType;
                            productName = firstItem.name || 'App Product';
                        }
                    } catch (e) { /* empty */ }

                    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
                    let token = '';
                    for (let i = 0; i < 20; i++) token += chars.charAt(Math.floor(Math.random() * chars.length));

                    await prisma.token_device_activation.create({
                        data: {
                            token: token,
                            order_id: order.id,
                            product: productName,
                            duration: order.duration || 43800,
                            user: userEmail,
                            created: now,
                            taked: 0,
                            taked_at: 0,
                            taked_ip: ''
                        }
                    });
                }

                return res.redirect('/#/member/licenses?success=Aktivasi lisensi gratis berhasil');
            }

            // Generate payment request ke GoQRIS
            const refId = `INV-${order.id}`;

            let goqrisRes;
            try {
                goqrisRes = await createGoqrisOrder({
                    refId: refId,
                    amount: total,
                    customerName: session.userName || 'Member',
                    customerEmail: userEmail,
                });
            } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                return res.redirect(`/#/member/orders/create?error=${encodeURIComponent('Gagal generate pembayaran: ' + msg)}`);
            }

            const qrImage = goqrisRes.data?.payment_detail?.qr_image || '';
            const totalAmountFromGateway = goqrisRes.data?.total_amount || total;
            const trxId = goqrisRes.data?.trx_id || '';
            
            // Get expiry offset from settings
            const config = await getGoqrisConfig();
            const expiresAt = Math.floor(Date.now() / 1000) + ((config.expiryMinutes || 1440) * 60);
            
            const invoiceToken = await ensureOrderInvoiceToken(order.id);
            const invoiceUrl = `/#/invoice/${invoiceToken}`;

            // Simpan QR dan info pembayaran ke order
            await prisma.order_list.update({
                where: { id: order.id },
                data: {
                    payment_request_id: refId,
                    payment_id: trxId,
                    payment_url: invoiceUrl,
                    qr_string: qrImage,
                    total_amount: totalAmountFromGateway,
                    payment_expires_at: expiresAt,
                },
            });

            return res.redirect(invoiceUrl);
        } else {
            // Sudah ada payment_url, arahkan ke invoice page (karena QR sudah dirender disana)
            const invoiceToken = await ensureOrderInvoiceToken(order.id);
            return res.redirect(`/#/invoice/${invoiceToken}`);
        }
    }
    /**
     * Show affiliate dashboard
     */
    async showAffiliate(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const userEmail = session.userEmail || '';
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const search = (req.query.search as string) || '';
        const sort = (req.query.sort as string) || 'tanggal';
        const orderDir = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

        try {
            // Stats: Get basic affiliate profile info
            const profile = await prisma.affiliate_member.findFirst({
                where: { email: userEmail },
                select: {
                    kupon: true,
                    created: true,
                    payout_bank_name: true,
                    payout_no_rek: true,
                    payout_name: true
                }
            });

            const isEnrolled = !!profile;
            let ordersCount = 0;
            const requiredOrders = 6;
            let isEligible = false;

            if (!isEnrolled) {
                // Calculate eligibility: 6 orders in 6 months
                const sixMonthsAgo = Math.floor(Date.now() / 1000) - (180 * 24 * 60 * 60);
                ordersCount = await prisma.order_list.count({
                    where: {
                        user: userEmail,
                        created: { gte: sixMonthsAgo },
                        status: 'Order has been complete'
                    }
                });
                isEligible = ordersCount >= requiredOrders;
            }

            // Stats: Total income for this affiliator
            const totalIncomeResult = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: { affiliator_email: userEmail }
            });
            const totalIncome = (totalIncomeResult._sum.affiliate_income as number) || 0;

            // Stats: Total pending income (unpaid transactions)
            const pendingResult = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: {
                    affiliator_email: userEmail,
                    already_paid: 0
                }
            });
            const totalPending = (pendingResult._sum.affiliate_income as number) || 0;

            // Last Payout: Get most recent payout for this member
            const lastPayout = await prisma.affiliate_payouts.findFirst({
                where: { affiliate_email: userEmail },
                orderBy: { created: 'desc' },
                select: { amount: true, created: true }
            });

            // Build filter
            const where: Prisma.affiliate_transaksiWhereInput = { affiliator_email: userEmail };
            if (search) {
                where.OR = [
                    { customer_email: { contains: search } },
                    { invoice_code: { contains: search } },
                    { product_name: { contains: search } },
                    { customer_name: { contains: search } }
                ];
            }

            // Total count for pagination
            const totalTransactions = await prisma.affiliate_transaksi.count({ where });

            // Sort logic mapping
            let dbSortField = 'created_at';
            if (sort === 'harga') dbSortField = 'customer_paid_price';
            else if (sort === 'komisi') dbSortField = 'affiliate_income';
            else if (sort === 'tanggal') dbSortField = 'created_at';

            let enrichedTransactions: AffiliateTransaction[] = [];

            if (sort === 'durasi') {
                // Fetch all and sort in memory
                const transactions = await prisma.affiliate_transaksi.findMany({ where });
                const invoiceCodes = transactions.map(t => t.invoice_code);
                const orderIds: number[] = [];
                invoiceCodes.forEach(code => {
                    let id = NaN;
                    if (code.startsWith('INV-')) id = parseInt(code.replace('INV-', ''));
                    else id = parseInt(code);
                    if (!isNaN(id)) orderIds.push(id);
                });

                const orders = await prisma.order_list.findMany({
                    where: { id: { in: orderIds } },
                    select: { id: true, duration: true }
                });
                const durationMap = new Map(orders.map(o => [o.id, o.duration]));

                const enriched = transactions.map(t => {
                    let orderId = NaN;
                    if (t.invoice_code.startsWith('INV-')) orderId = parseInt(t.invoice_code.replace('INV-', ''));
                    else orderId = parseInt(t.invoice_code);
                    const durRaw = durationMap.get(orderId) || 0;
                    return {
                        id: t.id,
                        created_at: t.created_at,
                        product_name: t.product_name,
                        customer_email: t.customer_email,
                        customer_name: t.customer_name,
                        customer_paid_price: t.customer_paid_price,
                        affiliate_income: t.affiliate_income,
                        invoice_code: t.invoice_code,
                        durationVal: durRaw,
                        duration: this.formatDuration(durRaw)
                    };
                });

                enriched.sort((a, b) => {
                    return orderDir === 'asc' ? a.durationVal - b.durationVal : b.durationVal - a.durationVal;
                });
                enrichedTransactions = enriched.slice((page - 1) * pageSize, page * pageSize);
            } else {
                // DB Level sort and paginate
                const transactions = await prisma.affiliate_transaksi.findMany({
                    where,
                    orderBy: { [dbSortField]: orderDir },
                    skip: (page - 1) * pageSize,
                    take: pageSize
                });

                const invoiceCodes = transactions.map(t => t.invoice_code);
                const orderIds: number[] = [];
                invoiceCodes.forEach(code => {
                    let id = NaN;
                    if (code.startsWith('INV-')) id = parseInt(code.replace('INV-', ''));
                    else id = parseInt(code);
                    if (!isNaN(id)) orderIds.push(id);
                });

                const orders = await prisma.order_list.findMany({
                    where: { id: { in: orderIds } },
                    select: { id: true, duration: true }
                });
                const durationMap = new Map(orders.map(o => [o.id, o.duration]));

                enrichedTransactions = transactions.map(t => {
                    let orderId = NaN;
                    if (t.invoice_code.startsWith('INV-')) orderId = parseInt(t.invoice_code.replace('INV-', ''));
                    else orderId = parseInt(t.invoice_code);
                    const durRaw = durationMap.get(orderId) || 0;
                    return {
                        id: t.id,
                        created_at: t.created_at,
                        product_name: t.product_name,
                        customer_email: t.customer_email,
                        customer_name: t.customer_name,
                        customer_paid_price: t.customer_paid_price,
                        affiliate_income: t.affiliate_income,
                        invoice_code: t.invoice_code,
                        duration: this.formatDuration(durRaw)
                    };
                });
            }

            const userData = {
                name: session.userName || 'Member',
                email: userEmail,
                avatar: session.userAvatar,
            };

            res.send(memberAffiliatePage(userData, enrichedTransactions, {
                page,
                pageSize,
                totalTransactions,
                search,
                sort,
                order: orderDir,
                totalIncome,
                totalPending,
                profile: profile ? {
                    kupon: profile.kupon || '-',
                    created: profile.created,
                    payout_bank_name: profile.payout_bank_name || undefined,
                    payout_no_rek: profile.payout_no_rek || undefined,
                    payout_name: profile.payout_name || undefined
                } : undefined,
                lastPayout: lastPayout ? {
                    amount: lastPayout.amount,
                    created: lastPayout.created
                } : undefined,
                isEnrolled,
                isEligible,
                ordersCount,
                requiredOrders
            }));

        } catch (error) {
            console.error('Affiliate dashboard error:', error);
            res.redirect('/#/member/dashboard?error=Gagal memuat data affiliate');
        }
    }

    /**
     * Helper to format duration minutes
     */
    private formatDuration(minutes: number): string {
        if (!minutes || minutes <= 0) return '-';
        if (minutes < 60) return `${minutes} menit`;
        if (minutes < 1440) {
            const jam = Math.floor(minutes / 60);
            const sisa = minutes % 60;
            return `${jam} jam${sisa ? ` ${sisa} menit` : ''}`;
        }
        if (minutes < 43800) {
            const hari = Math.floor(minutes / 1440);
            const sisa = minutes % 1440;
            return `${hari} hari${sisa ? ` ${this.formatDuration(sisa)}` : ''}`;
        }
        const bulan = Math.round(minutes / 43800);
        return `${bulan} bulan`;
    }
    /**
     * Update affiliate payout information
     */
    async updateAffiliateProfile(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).send('Unauthorized');
        }

        const userEmail = session.userEmail || '';
        const { bank_name, no_rek, owner_name } = req.body as { bank_name: string, no_rek: string, owner_name: string };

        if (!bank_name || !no_rek || !owner_name) {
            return res.status(400).send('Semua data harus diisi');
        }

        try {
            // Find existing record
            const aff = await prisma.affiliate_member.findFirst({
                where: { email: userEmail }
            });

            if (!aff) {
                return res.status(404).send('Data affiliate tidak ditemukan');
            }

            await prisma.affiliate_member.update({
                where: { id: aff.id },
                data: {
                    payout_bank_name: bank_name,
                    payout_no_rek: no_rek,
                    payout_name: owner_name
                }
            });

            res.status(200).send('OK');
        } catch (error) {
            console.error('Update affiliate profile error:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Update affiliate coupon code
     */
    async updateAffiliateCoupon(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).send('Unauthorized');
        }

        const userEmail = session.userEmail || '';
        const { coupon } = req.body as { coupon: string };

        if (!coupon || coupon.length < 3) {
            return res.status(400).send('Kode kupon minimal 3 karakter');
        }

        // Regex check: alphanumeric only
        if (!/^[A-Z0-9]+$/i.test(coupon)) {
            return res.status(400).send('Kode kupon hanya boleh huruf dan angka');
        }

        const cleanCoupon = coupon.toUpperCase();

        try {
            // 1. Check if used in regular vouchers
            const vExists = await prisma.voucers.findFirst({ where: { code: cleanCoupon } });
            if (vExists) return res.status(400).send('Kode kupon sudah digunakan sistem');

            // 2. Check if used by another affiliate
            const affExists = await prisma.affiliate_member.findFirst({
                where: {
                    kupon: cleanCoupon,
                    email: { not: userEmail }
                }
            });
            if (affExists) return res.status(400).send('Kode kupon sudah digunakan member lain');

            // 3. Find current member
            const aff = await prisma.affiliate_member.findFirst({ where: { email: userEmail } });
            if (!aff) return res.status(404).send('Data affiliate tidak ditemukan');

            // 4. Update
            await prisma.affiliate_member.update({
                where: { id: aff.id },
                data: { kupon: cleanCoupon }
            });

            res.status(200).send('OK');
        } catch (error) {
            console.error('Update affiliate coupon error:', error);
            res.status(500).send('Internal Server Error');
        }
    }

    /**
     * Show payout history page
     */
    async showPayoutHistory(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const userEmail = session.userEmail || '';
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = 10;
        const sort = (req.query.sort as string) || 'created';
        const orderDir = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

        try {
            // Fetch paid records
            const paidPayouts = await prisma.affiliate_payouts.findMany({
                where: { affiliate_email: userEmail },
                orderBy: { created: 'desc' }
            });

            const paidRecords = paidPayouts.map(p => ({
                id: `paid-${p.id}`,
                created: p.created,
                amount: p.amount,
                status: 'paid' as const,
                note: p.note || 'Penarikan Selesai'
            }));

            // Aggregate pending income
            const pendingIncomeResult = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: {
                    affiliator_email: userEmail,
                    already_paid: 0
                }
            });

            const totalPending = (pendingIncomeResult._sum.affiliate_income as number) || 0;
            const pendingRecords = [];

            if (totalPending > 0) {
                pendingRecords.push({
                    id: 'pending-summary',
                    created: Math.floor(Date.now() / 1000), // Treat as NOW for sorting
                    amount: totalPending,
                    status: 'pending' as const,
                    note: 'Total Komisi Yang Belum Ditransfer'
                });
            }

            // Combine and Sort
            const allRecords = [...pendingRecords, ...paidRecords].sort((a, b) => {
                let valA = 0;
                let valB = 0;

                if (sort === 'amount') {
                    valA = a.amount;
                    valB = b.amount;
                } else {
                    valA = a.created;
                    valB = b.created;
                }

                return orderDir === 'asc' ? valA - valB : valB - valA;
            });

            // Paginate in memory
            const totalPayouts = allRecords.length;
            const paginatedRecords = allRecords.slice((page - 1) * pageSize, page * pageSize);

            const userData = {
                name: session.userName || 'Member',
                email: userEmail,
                avatar: session.userAvatar,
            };

            res.send(memberPayoutHistoryPage(userData, paginatedRecords, {
                page,
                pageSize,
                totalPayouts,
                sort,
                order: orderDir
            }));

        } catch (error) {
            console.error('Payout history error:', error);
            res.redirect('/#/member/affiliate?error=Gagal memuat riwayat');
        }
    }

    /**
     * Process Join Affiliate
     */
    async processJoinAffiliate(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.redirect('/#/member/login');
        }

        const userEmail = session.userEmail || '';

        try {
            // Check if already affiliate
            const existing = await prisma.affiliate_member.findFirst({ where: { email: userEmail } });
            if (existing) return res.redirect('/#/member/affiliate');

            // Check eligibility
            const sixMonthsAgo = Math.floor(Date.now() / 1000) - (180 * 24 * 60 * 60);
            const ordersCount = await prisma.order_list.count({
                where: {
                    user: userEmail,
                    created: { gte: sixMonthsAgo },
                    status: 'Order has been complete'
                }
            });

            if (ordersCount < 6) {
                // Suspicious activity log?
                console.warn(`Spam detection: User ${userEmail} attempted to join affiliate without meeting requirements.`);
                return res.redirect('/#/member/affiliate?error=Pendaftaran ditolak. Anda belum memenuhi syarat.');
            }

            // Additional bot protection: Rate limit based on timestamp (optional but good)
            // Or check if the user account is too new (e.g., created today) - but they have 6 orders, so they should be legit.

            // Ensure they aren't already registered again (double check)
            const secondCheck = await prisma.affiliate_member.findFirst({ where: { email: userEmail } });
            if (secondCheck) return res.redirect('/#/member/affiliate');

            // Create affiliate member
            // Generate coupon: ZQ + Random chars
            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let coupon = 'ZQ';
            for (let i = 0; i < 4; i++) coupon += chars.charAt(Math.floor(Math.random() * chars.length));

            // Generate unix key
            let unix = '';
            for (let i = 0; i < 60; i++) unix += chars.charAt(Math.floor(Math.random() * chars.length));

            await prisma.affiliate_member.create({
                data: {
                    email: userEmail,
                    kupon: coupon,
                    created: Math.floor(Date.now() / 1000),
                    unix: unix,
                    kupon_decrease_value: 10, // Default 10% discount for customer
                    kupon_income_idr: 5,      // Default 5% income for affiliator
                }
            });

            res.redirect('/#/member/affiliate');
        } catch (error) {
            console.error('Join affiliate error:', error);
            res.redirect('/#/member/affiliate?error=Gagal mendaftar program affiliate');
        }
    }

    /**
     * API: Get Member Affiliate Dashboard JSON Data
     */
    async apiGetAffiliate(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = session.userEmail || '';
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = parseInt(req.query.pageSize as string) || 10;
        const search = (req.query.search as string) || '';
        const sort = (req.query.sort as string) || 'tanggal';
        const orderDir = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

        try {
            const profile = await prisma.affiliate_member.findFirst({
                where: { email: userEmail },
                select: {
                    kupon: true,
                    created: true,
                    payout_bank_name: true,
                    payout_no_rek: true,
                    payout_name: true,
                    kupon_decrease_value: true,
                    kupon_income_idr: true
                }
            });

            const isEnrolled = !!profile;
            const requiredOrders = 6;
            const sixMonthsAgo = Math.floor(Date.now() / 1000) - (180 * 24 * 60 * 60);

            const ordersCount = await prisma.order_list.count({
                where: {
                    user: userEmail,
                    created: { gte: sixMonthsAgo },
                    status: 'Order has been complete'
                }
            });
            const isEligible = ordersCount >= requiredOrders;

            // Total Income
            const totalIncomeResult = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: { affiliator_email: userEmail }
            });
            const totalIncome = (totalIncomeResult._sum.affiliate_income as number) || 0;

            // Pending Unpaid Income
            const pendingResult = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: {
                    affiliator_email: userEmail,
                    already_paid: 0
                }
            });
            const totalPending = (pendingResult._sum.affiliate_income as number) || 0;

            // Last Payout
            const lastPayout = await prisma.affiliate_payouts.findFirst({
                where: { affiliate_email: userEmail },
                orderBy: { created: 'desc' },
                select: { amount: true, created: true }
            });

            // Transactions Filter
            const where: Prisma.affiliate_transaksiWhereInput = { affiliator_email: userEmail };
            if (search) {
                where.OR = [
                    { customer_email: { contains: search } },
                    { invoice_code: { contains: search } },
                    { product_name: { contains: search } },
                    { customer_name: { contains: search } }
                ];
            }

            const totalTransactions = await prisma.affiliate_transaksi.count({ where });

            let dbSortField = 'created_at';
            if (sort === 'harga') dbSortField = 'customer_paid_price';
            else if (sort === 'komisi') dbSortField = 'affiliate_income';
            else if (sort === 'tanggal') dbSortField = 'created_at';

            const transactions = await prisma.affiliate_transaksi.findMany({
                where,
                orderBy: { [dbSortField]: orderDir },
                skip: (page - 1) * pageSize,
                take: pageSize
            });

            return res.json({
                status: 'success',
                data: {
                    isEnrolled,
                    isEligible,
                    ordersCount,
                    requiredOrders,
                    profile: profile ? {
                        kupon: profile.kupon || '-',
                        created: profile.created,
                        payout_bank_name: profile.payout_bank_name || '',
                        payout_no_rek: profile.payout_no_rek || '',
                        payout_name: profile.payout_name || '',
                        kupon_decrease_value: profile.kupon_decrease_value,
                        kupon_income_idr: profile.kupon_income_idr
                    } : null,
                    stats: {
                        totalIncome,
                        totalPending,
                        totalTransactions
                    },
                    lastPayout: lastPayout ? {
                        amount: lastPayout.amount,
                        created: lastPayout.created
                    } : null,
                    transactions,
                    pagination: {
                        page,
                        pageSize,
                        totalTransactions,
                        totalPages: Math.ceil(totalTransactions / pageSize)
                    }
                }
            });
        } catch (error) {
            console.error('API get affiliate error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat data affiliate' });
        }
    }

    /**
     * API: Process Join Affiliate Program
     */
    async apiJoinAffiliate(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = session.userEmail || '';

        try {
            const existing = await prisma.affiliate_member.findFirst({ where: { email: userEmail } });
            if (existing) {
                return res.status(400).json({ status: 'error', message: 'Anda sudah terdaftar sebagai mitra affiliate' });
            }

            const sixMonthsAgo = Math.floor(Date.now() / 1000) - (180 * 24 * 60 * 60);
            const ordersCount = await prisma.order_list.count({
                where: {
                    user: userEmail,
                    created: { gte: sixMonthsAgo },
                    status: 'Order has been complete'
                }
            });

            if (ordersCount < 6) {
                return res.status(400).json({
                    status: 'error',
                    message: `Syarat belum terpenuhi. Anda membutuhkan minimal 6 order selesai (saat ini ${ordersCount} order).`
                });
            }

            const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            let coupon = 'ZQ';
            for (let i = 0; i < 4; i++) coupon += chars.charAt(Math.floor(Math.random() * chars.length));

            let unix = '';
            for (let i = 0; i < 60; i++) unix += chars.charAt(Math.floor(Math.random() * chars.length));

            const newAffiliate = await prisma.affiliate_member.create({
                data: {
                    email: userEmail,
                    kupon: coupon,
                    created: Math.floor(Date.now() / 1000),
                    unix: unix,
                    kupon_decrease_value: 10, // Default 10% discount for customer
                    kupon_income_idr: 5,      // Default 5% income for affiliator
                }
            });

            return res.json({
                status: 'success',
                message: 'Selamat! Pendaftaran affiliate berhasil.',
                data: newAffiliate
            });
        } catch (error) {
            console.error('API join affiliate error:', error);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem saat mendaftar affiliate' });
        }
    }

    /**
     * API: Update Payout Information (JSON)
     */
    async apiUpdateAffiliatePayout(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = session.userEmail || '';
        const { bank_name, no_rek, owner_name } = req.body as { bank_name?: string; no_rek?: string; owner_name?: string };

        if (!bank_name || !no_rek || !owner_name) {
            return res.status(400).json({ status: 'error', message: 'Nama bank, nomor rekening, dan nama pemilik wajib diisi' });
        }

        try {
            const aff = await prisma.affiliate_member.findFirst({ where: { email: userEmail } });
            if (!aff) {
                return res.status(404).json({ status: 'error', message: 'Data affiliate tidak ditemukan' });
            }

            await prisma.affiliate_member.update({
                where: { id: aff.id },
                data: {
                    payout_bank_name: bank_name.trim(),
                    payout_no_rek: no_rek.trim(),
                    payout_name: owner_name.trim()
                }
            });

            return res.json({ status: 'success', message: 'Informasi rekening penarikan berhasil diperbarui' });
        } catch (error) {
            console.error('API update affiliate payout error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memperbarui informasi rekening' });
        }
    }

    /**
     * API: Update Custom Coupon Code (JSON)
     */
    async apiUpdateAffiliateCoupon(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = session.userEmail || '';
        const { coupon } = req.body as { coupon?: string };

        if (!coupon || coupon.trim().length < 3) {
            return res.status(400).json({ status: 'error', message: 'Kode kupon minimal 3 karakter' });
        }

        const cleanCoupon = coupon.trim().toUpperCase();
        if (!/^[A-Z0-9]+$/i.test(cleanCoupon)) {
            return res.status(400).json({ status: 'error', message: 'Kode kupon hanya boleh huruf dan angka' });
        }

        try {
            const vExists = await prisma.voucers.findFirst({ where: { code: cleanCoupon } });
            if (vExists) {
                return res.status(400).json({ status: 'error', message: 'Kode kupon sudah digunakan oleh sistem' });
            }

            const affExists = await prisma.affiliate_member.findFirst({
                where: {
                    kupon: cleanCoupon,
                    email: { not: userEmail }
                }
            });
            if (affExists) {
                return res.status(400).json({ status: 'error', message: 'Kode kupon sudah digunakan oleh member lain' });
            }

            const aff = await prisma.affiliate_member.findFirst({ where: { email: userEmail } });
            if (!aff) {
                return res.status(404).json({ status: 'error', message: 'Data affiliate tidak ditemukan' });
            }

            await prisma.affiliate_member.update({
                where: { id: aff.id },
                data: { kupon: cleanCoupon }
            });

            return res.json({ status: 'success', message: 'Kode kupon berhasil diperbarui', coupon: cleanCoupon });
        } catch (error) {
            console.error('API update affiliate coupon error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memperbarui kode kupon' });
        }
    }

    /**
     * API: Get Payout History JSON
     */
    async apiGetAffiliatePayouts(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = session.userEmail || '';
        const page = parseInt(req.query.page as string) || 1;
        const pageSize = 10;
        const sort = (req.query.sort as string) || 'created';
        const orderDir = (req.query.order as string) === 'asc' ? 'asc' : 'desc';

        try {
            const paidPayouts = await prisma.affiliate_payouts.findMany({
                where: { affiliate_email: userEmail },
                orderBy: { created: 'desc' }
            });

            const paidRecords = paidPayouts.map(p => ({
                id: `paid-${p.id}`,
                created: p.created,
                amount: p.amount,
                status: 'paid' as const,
                note: p.note || 'Penarikan Selesai'
            }));

            const pendingIncomeResult = await prisma.affiliate_transaksi.aggregate({
                _sum: { affiliate_income: true },
                where: {
                    affiliator_email: userEmail,
                    already_paid: 0
                }
            });

            const totalPending = (pendingIncomeResult._sum.affiliate_income as number) || 0;
            const pendingRecords = [];

            if (totalPending > 0) {
                pendingRecords.push({
                    id: 'pending-summary',
                    created: Math.floor(Date.now() / 1000),
                    amount: totalPending,
                    status: 'pending' as const,
                    note: 'Total Komisi Yang Belum Ditransfer'
                });
            }

            const allRecords = [...pendingRecords, ...paidRecords].sort((a, b) => {
                let valA = a.created;
                let valB = b.created;
                if (sort === 'amount') {
                    valA = a.amount;
                    valB = b.amount;
                }
                return orderDir === 'asc' ? valA - valB : valB - valA;
            });

            const totalPayouts = allRecords.length;
            const paginatedRecords = allRecords.slice((page - 1) * pageSize, page * pageSize);

            return res.json({
                status: 'success',
                data: {
                    payouts: paginatedRecords,
                    totalPending,
                    totalPayouts,
                    pagination: {
                        page,
                        pageSize,
                        totalPayouts,
                        totalPages: Math.ceil(totalPayouts / pageSize)
                    }
                }
            });
        } catch (error) {
            console.error('API get affiliate payouts error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat riwayat penarikan' });
        }
    }

    // ==========================================
    // SVELTE REST JSON API ENDPOINTS
    // ==========================================

    /**
     * API: Get Public Platform Stats (Estimated member counts & platform health)
     */
    async apiGetPublicStats(req: Request, res: Response) {
        try {
            const totalUsers = await prisma.user.count();
            
            // Format approximate number (e.g. 500+, 1.2k+, 2.8k+, 5.6k+)
            let formattedMembers = '100+';
            if (totalUsers >= 1000) {
                const kVal = (totalUsers / 1000).toFixed(1).replace(/\.0$/, '');
                formattedMembers = `${kVal}k+`;
            } else if (totalUsers >= 100) {
                const roundedFifty = Math.floor(totalUsers / 50) * 50;
                formattedMembers = `${roundedFifty}+`;
            } else if (totalUsers >= 10) {
                const roundedTen = Math.floor(totalUsers / 10) * 10;
                formattedMembers = `${roundedTen}+`;
            } else if (totalUsers > 0) {
                formattedMembers = `${totalUsers}+`;
            }

            return res.json({
                status: 'success',
                data: {
                    totalUsers,
                    formattedMembers: `${formattedMembers} Member Aktif`,
                    uptime: '99.9% Uptime Server',
                    guarantee: 'Update Berkala'
                }
            });
        } catch {
            return res.json({
                status: 'success',
                data: {
                    totalUsers: 2800,
                    formattedMembers: '2.8k+ Member Aktif',
                    uptime: '99.9% Uptime Server',
                    guarantee: 'Update Berkala'
                }
            });
        }
    }

    /**
     * API: Get Current Member Session
     */
    async apiGetSession(req: Request, res: Response) {
        await Promise.resolve();
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.json({ authenticated: false });
        }
        return res.json({
            authenticated: true,
            user: {
                name: session.userName || 'Member',
                email: session.userEmail || '',
                avatar: session.userAvatar || undefined
            }
        });
    }

    /**
     * API: Get Member Dashboard Data
     */
    async apiGetDashboard(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = session.userEmail || '';
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 86400);

        const [products, totalOrders, totalLicenses, tokenCounts, tokenCounts30d, paidOrders30d, onlineCounts, categoriesList] = await Promise.all([
            prisma.products.findMany({
                where: { is_active: true }
            }),
            prisma.order_list.count({
                where: { user: userEmail }
            }),
            prisma.token_device_activation.count({
                where: { user: userEmail }
            }),
            prisma.token_device_activation.groupBy({
                by: ['product'],
                _count: { id: true }
            }),
            prisma.token_device_activation.groupBy({
                by: ['product'],
                where: { created: { gte: thirtyDaysAgo } },
                _count: { id: true }
            }),
            prisma.order_list.findMany({
                where: {
                    created: { gte: thirtyDaysAgo },
                    OR: [
                        { paid_at: { not: null } },
                        { status: { in: ['COMPLETED', 'PAID', 'SETTLED', 'ACCEPT', 'terbayar', 'success', 'settlement'] } }
                    ]
                },
                select: { items: true, status: true, paid_at: true }
            }),
            prisma.online_devices.groupBy({
                by: ['product_name'],
                _count: { id: true }
            }),
            prisma.categories.findMany({
                where: { is_active: true },
                orderBy: { id: 'desc' }
            })
        ]);

        const formatActiveUsers = (count: number): string => {
            if (count >= 1000) {
                const k = (count / 1000).toFixed(1).replace(/\.0$/, '');
                return `${k}k+`;
            }
            if (count >= 50) {
                return `${Math.floor(count / 10) * 10}+`;
            }
            if (count > 0) {
                return `${count}+`;
            }
            return '100+';
        };

        const nameToProductMap = new Map<string, typeof products[0]>();
        const idToProductMap = new Map<number, typeof products[0]>();
        products.forEach(p => {
            nameToProductMap.set(p.name.trim().toLowerCase(), p);
            idToProductMap.set(p.id, p);
            if (p.product_id) idToProductMap.set(p.product_id, p);
        });

        const monthlySalesMap = new Map<number, number>();
        tokenCounts30d.forEach(t => {
            const pName = (t.product || '').trim().toLowerCase();
            const matched = nameToProductMap.get(pName);
            if (matched) {
                monthlySalesMap.set(matched.id, (monthlySalesMap.get(matched.id) || 0) + t._count.id);
            }
        });

        paidOrders30d.forEach(o => {
            try {
                const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
                if (Array.isArray(items)) {
                    items.forEach((it: any) => {
                        const pid = Number(it.product_id || it.db_id);
                        const matched = pid ? idToProductMap.get(pid) : (it.name ? nameToProductMap.get(String(it.name).trim().toLowerCase()) : null);
                        if (matched && !monthlySalesMap.has(matched.id)) {
                            monthlySalesMap.set(matched.id, 1);
                        }
                    });
                }
            } catch (err) {
                // Ignore parse errors for corrupt items JSON
            }
        });

        const tokenMap = new Map<string, number>();
        tokenCounts.forEach(t => tokenMap.set((t.product || '').toLowerCase().trim(), t._count.id));
        const onlineMap = new Map<string, number>();
        onlineCounts.forEach(o => onlineMap.set((o.product_name || '').toLowerCase().trim(), o._count.id));

        const catMap = new Map(categoriesList.map(c => [c.id, c]));
        const catProductCountMap = new Map<number, number>();

        products.forEach(p => {
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
            ids.forEach(id => {
                catProductCountMap.set(id, (catProductCountMap.get(id) || 0) + 1);
            });
        });

        const enrichedProducts = products.map(p => {
            const pName = p.name.toLowerCase().trim();
            const tokenCount = tokenMap.get(pName) || 0;
            const onlineCount = onlineMap.get(pName) || 0;
            const realCount = Math.max(tokenCount, onlineCount);

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
            const matchedCats = ids.map(id => catMap.get(id)).filter(Boolean) as Array<{ id: number; name: string; slug: string; icon: string | null }>;
            const primaryCat = matchedCats[0] || (p.category_id ? catMap.get(p.category_id) : undefined);

            const sales30d = monthlySalesMap.get(p.id) || 0;

            return {
                ...p,
                category_ids: ids,
                category_id: ids[0] || p.category_id || null,
                category_name: matchedCats.map(c => c.name).join(', ') || (primaryCat ? primaryCat.name : null),
                category_icon: primaryCat ? primaryCat.icon : null,
                category_slug: primaryCat ? primaryCat.slug : null,
                categories: matchedCats,
                active_users: realCount,
                active_users_formatted: formatActiveUsers(realCount),
                monthly_sales_count: sales30d,
                monthly_sales_formatted: sales30d > 0 ? `${sales30d} terbeli bulan ini` : '0 terbeli bulan ini'
            };
        });

        // Sort by 30-day paid sales count DESC, then active users DESC, then ID DESC
        enrichedProducts.sort((a, b) => {
            if (b.monthly_sales_count !== a.monthly_sales_count) {
                return b.monthly_sales_count - a.monthly_sales_count;
            }
            if (b.active_users !== a.active_users) {
                return b.active_users - a.active_users;
            }
            return b.id - a.id;
        });

        const categories = categoriesList.map(c => ({
            id: c.id,
            name: c.name,
            slug: c.slug,
            icon: c.icon || null,
            description: c.description || '',
            count: catProductCountMap.get(c.id) || 0
        }));

        // Fetch User's Active Licenses
        const userTokens = await prisma.token_device_activation.findMany({
            where: { user: userEmail },
            orderBy: { id: 'desc' },
            take: 6
        });

        const myActiveLicenses = userTokens.map(t => {
            const pName = (t.product || '').trim();
            const matchedProduct = nameToProductMap.get(pName.toLowerCase());
            const durationMin = t.duration || 43800;
            const expiresEpoch = (t.taked_at || t.created) + (durationMin * 60);
            const isExpired = expiresEpoch < now;
            const daysLeft = Math.max(0, Math.ceil((expiresEpoch - now) / 86400));

            let installerFiles: any[] = [];
            if (matchedProduct && matchedProduct.installer_files) {
                try {
                    installerFiles = typeof matchedProduct.installer_files === 'string'
                        ? JSON.parse(matchedProduct.installer_files)
                        : matchedProduct.installer_files;
                } catch {
                    installerFiles = [];
                }
            }

            return {
                id: t.id,
                productId: matchedProduct?.id || null,
                token: t.token,
                productName: pName,
                productImage: sanitizeProductImage(matchedProduct?.image),
                installerFiles,
                isActivated: Boolean(t.taked),
                isExpired,
                daysLeft,
                durationMonths: Math.max(1, Math.round(durationMin / 43800)),
                expiresAtFormatted: new Date(expiresEpoch * 1000).toLocaleDateString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric'
                }),
                downloadUrl: matchedProduct?.id 
                    ? `#/member/downloads?id=${matchedProduct.id}` 
                    : `#/member/downloads?search=${encodeURIComponent(pName)}`,
                tutorialsUrl: matchedProduct?.tutorials || null
            };
        });

        // Fetch Pending Invoices (Active unexpired orders awaiting payment)
        const config = await getGoqrisConfig();
        const globalExpiryMinutes = config.expiryMinutes || 1440;

        const pendingOrders = await prisma.order_list.findMany({
            where: {
                OR: [
                    { user: userEmail },
                    { user: userEmail.toLowerCase() }
                ],
                paid_at: null,
                status: { notIn: ['Order has been complete', 'Order is cancelled', 'BATAL', 'EXPIRED'] }
            },
            orderBy: { id: 'desc' },
            take: 2
        });

        const pendingInvoices = (await Promise.all(pendingOrders.map(async o => {
            let productName = 'Software License';
            try {
                const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
                if (Array.isArray(items) && items.length > 0) productName = items[0].name || productName;
            } catch {
                // Fallback to default product name if items JSON parse fails
            }

            const orderExpiresAt = o.payment_expires_at ? Number(o.payment_expires_at) : (o.created + (globalExpiryMinutes * 60));
            const isExpired = now > orderExpiresAt || (o.status && o.status.toUpperCase().includes('EXPIRED'));
            const minutesLeft = Math.max(0, Math.ceil((orderExpiresAt - now) / 60));
            const invoiceToken = await ensureOrderInvoiceToken(o.id);

            return {
                id: o.id,
                productName,
                totalAmount: o.total_amount || 0,
                paymentRequestId: o.payment_request_id || null,
                vaNumber: o.va_number || null,
                expiresAt: orderExpiresAt,
                minutesLeft,
                expiresAtFormatted: new Date(orderExpiresAt * 1000).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                isExpired,
                invoiceToken
            };
        }))).filter(o => !o.isExpired);

        return res.json({
            status: 'success',
            data: {
                user: {
                    name: session.userName || 'Member',
                    email: userEmail,
                    avatar: session.userAvatar
                },
                products: enrichedProducts,
                categories,
                totalOrders,
                totalLicenses,
                myActiveLicenses,
                pendingInvoices
            }
        });
    }

    /**
     * API: Get Tutorial Products Catalog (Lightweight metadata for fast loading)
     */
    async apiGetTutorials(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        try {
            const [rawProducts, categoriesList] = await Promise.all([
                prisma.products.findMany({
                    where: { is_active: true },
                    select: {
                        id: true,
                        name: true,
                        description: true,
                        image: true,
                        tutorials: true,
                        installer_files: true,
                        category_id: true,
                        category_ids: true
                    },
                    orderBy: { id: 'desc' }
                }),
                prisma.categories.findMany({
                    where: { is_active: true },
                    select: { id: true, name: true, slug: true, icon: true }
                })
            ]);

            const catMap = new Map(categoriesList.map(c => [c.id, c]));

            const products = rawProducts.map(p => {
                let videoCount = 0;
                if (p.tutorials) {
                    try {
                        const parsed = typeof p.tutorials === 'string' ? JSON.parse(p.tutorials) : p.tutorials;
                        if (Array.isArray(parsed)) {
                            videoCount = parsed.length;
                        }
                    } catch {
                        videoCount = 0;
                    }
                }

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
                const matchedCats = ids.map(id => catMap.get(id)).filter(Boolean) as Array<{ id: number; name: string; slug: string; icon: string | null }>;
                const primaryCat = matchedCats[0] || (p.category_id ? catMap.get(p.category_id) : undefined);

                return {
                    id: p.id,
                    name: p.name,
                    description: p.description || '',
                    image: p.image || null,
                    tutorials: p.tutorials || null,
                    installer_files: p.installer_files || null,
                    category_ids: ids,
                    category_id: ids[0] || p.category_id || null,
                    category_name: matchedCats.map(c => c.name).join(', ') || (primaryCat ? primaryCat.name : null),
                    category_icon: primaryCat ? primaryCat.icon : null,
                    category_slug: primaryCat ? primaryCat.slug : null,
                    categories: matchedCats,
                    video_count: videoCount,
                    has_tutorials: videoCount > 0
                };
            });

            return res.json({
                status: 'success',
                data: {
                    user: {
                        name: session.userName || 'Member',
                        email: session.userEmail || '',
                        avatar: session.userAvatar
                    },
                    products
                }
            });
        } catch (error) {
            console.error('API Get Tutorials Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat katalog tutorial' });
        }
    }

    /**
     * API: Get Specific Product Tutorials On-Demand
     */
    async apiGetProductTutorial(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const productId = parseInt(req.params.productId as string, 10);
        if (!productId || isNaN(productId)) {
            return res.status(400).json({ status: 'error', message: 'ID produk tidak valid' });
        }

        try {
            const product = await prisma.products.findUnique({
                where: { id: productId },
                select: {
                    id: true,
                    name: true,
                    description: true,
                    image: true,
                    tutorials: true,
                    installer_files: true,
                    category_id: true,
                    category_ids: true
                }
            });

            if (!product) {
                return res.status(404).json({ status: 'error', message: 'Produk tidak ditemukan' });
            }

            let parsedTutorials: unknown[] = [];
            if (product.tutorials) {
                try {
                    const parsed = typeof product.tutorials === 'string' ? JSON.parse(product.tutorials) : product.tutorials;
                    if (Array.isArray(parsed)) {
                        parsedTutorials = parsed;
                    }
                } catch {
                    parsedTutorials = [];
                }
            }

            let ids: number[] = [];
            if (product.category_ids) {
                try {
                    const parsed = typeof product.category_ids === 'string' ? JSON.parse(product.category_ids) : product.category_ids;
                    if (Array.isArray(parsed)) {
                        ids = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
                    }
                } catch {
                    ids = [];
                }
            }
            if (ids.length === 0 && product.category_id) {
                ids = [product.category_id];
            }
            ids = Array.from(new Set(ids));

            const categoriesList = await prisma.categories.findMany({
                where: { id: { in: ids } },
                select: { id: true, name: true, slug: true, icon: true }
            });

            const categoryName = categoriesList.map(c => c.name).join(', ') || null;

            return res.json({
                status: 'success',
                data: {
                    product: {
                        id: product.id,
                        name: product.name,
                        description: product.description || '',
                        image: product.image || null,
                        installer_files: product.installer_files || null,
                        category_ids: ids,
                        category_id: ids[0] || product.category_id || null,
                        category_name: categoryName,
                        categories: categoriesList,
                        tutorials: parsedTutorials,
                        video_count: parsedTutorials.length,
                        has_tutorials: parsedTutorials.length > 0
                    }
                }
            });
        } catch (error) {
            console.error('API Get Product Tutorial Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat materi video produk' });
        }
    }

    /**
     * API: Get Downloads Hub Files & Installers (Backend-Driven Pagination & Search)
     */
    async apiGetDownloads(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
        const limitParam = parseInt(String(req.query.limit || req.query.pageSize || '24'), 10);
        const limit = isNaN(limitParam) ? 24 : Math.max(0, limitParam);
        const searchQuery = String(req.query.search || req.query.q || '').trim().toLowerCase();
        const filterType = String(req.query.filter || req.query.type || 'all').trim().toLowerCase();

        const [rawProducts, files, categoriesList] = await Promise.all([
            prisma.products.findMany({
                where: { is_active: true },
                orderBy: { id: 'desc' }
            }),
            downloadService.getFiles(),
            prisma.categories.findMany({
                where: { is_active: true },
                select: { id: true, name: true, slug: true, icon: true }
            })
        ]);

        const catMap = new Map(categoriesList.map(c => [c.id, c]));

        const allProducts = rawProducts.map(p => {
            const parsedInstallers = sftpService.parseInstallerFiles(p.installer_files);

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
            const matchedCats = ids.map(id => catMap.get(id)).filter(Boolean) as Array<{ id: number; name: string; slug: string; icon: string | null }>;
            const primaryCat = matchedCats[0] || (p.category_id ? catMap.get(p.category_id) : undefined);

            return {
                ...p,
                category_ids: ids,
                category_id: ids[0] || p.category_id || null,
                category_name: matchedCats.map(c => c.name).join(', ') || (primaryCat ? primaryCat.name : null),
                category_icon: primaryCat ? primaryCat.icon : null,
                category_slug: primaryCat ? primaryCat.slug : null,
                categories: matchedCats,
                installer_files: parsedInstallers
            };
        });

        // 1. Backend Filter by Search Query
        const searchFilteredProducts = searchQuery 
            ? allProducts.filter(p => 
                (p.name && p.name.toLowerCase().includes(searchQuery)) ||
                (p.description && p.description.toLowerCase().includes(searchQuery))
              )
            : allProducts;

        let filteredProducts = searchFilteredProducts;

        // 2. Backend Filter by Software Type / OS (all, win, mac, tutorial)
        if (filterType === 'win') {
            filteredProducts = filteredProducts.filter(p => Array.isArray(p.installer_files?.windows) && p.installer_files.windows.length > 0);
        } else if (filterType === 'mac') {
            filteredProducts = filteredProducts.filter(p => Array.isArray(p.installer_files?.mac) && p.installer_files.mac.length > 0);
        } else if (filterType === 'tutorial') {
            filteredProducts = filteredProducts.filter(p => {
                if (!p.tutorials) return false;
                try {
                    const parsed = typeof p.tutorials === 'string' ? JSON.parse(p.tutorials) : p.tutorials;
                    return Array.isArray(parsed) && parsed.length > 0;
                } catch {
                    return false;
                }
            });
        }

        // 3. Backend Count & Pagination Calculation
        const totalFiltered = filteredProducts.length;
        const totalPages = limit === 0 ? 1 : Math.max(1, Math.ceil(totalFiltered / limit));
        const effectivePage = Math.min(page, totalPages);
        
        const paginatedProducts = limit === 0 
            ? filteredProducts 
            : filteredProducts.slice((effectivePage - 1) * limit, effectivePage * limit);

        // Counts per filter type for frontend tab counters (reflecting current search query)
        const counts = {
            all: searchFilteredProducts.length,
            win: searchFilteredProducts.filter(p => Array.isArray(p.installer_files?.windows) && p.installer_files.windows.length > 0).length,
            mac: searchFilteredProducts.filter(p => Array.isArray(p.installer_files?.mac) && p.installer_files.mac.length > 0).length,
            tutorial: searchFilteredProducts.filter(p => {
                if (!p.tutorials) return false;
                try {
                    const parsed = typeof p.tutorials === 'string' ? JSON.parse(p.tutorials) : p.tutorials;
                    return Array.isArray(parsed) && parsed.length > 0;
                } catch {
                    return false;
                }
            }).length
        };

        return res.json({
            status: 'success',
            data: {
                user: {
                    name: session.userName || 'Member',
                    email: session.userEmail || '',
                    avatar: session.userAvatar
                },
                products: paginatedProducts,
                files,
                pagination: {
                    page: effectivePage,
                    limit,
                    totalFiltered,
                    totalPages,
                    counts
                }
            }
        });
    }

    /**
     * API: Get Active Products Catalog with Server-Side Search, Category Filter, and 10-Item Pagination
     */
    async apiGetProducts(req: Request, res: Response) {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 86400);

        const searchQuery = ((req.query.search as string) || '').trim().toLowerCase();
        const categoryFilter = ((req.query.category as string) || 'all').trim();
        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10)); // strictly 10 default

        const [allActiveProducts, tokenCounts, tokenCounts30d, paidOrders30d, onlineCounts, categoriesList] = await Promise.all([
            prisma.products.findMany({
                where: { is_active: true }
            }),
            prisma.token_device_activation.groupBy({
                by: ['product'],
                _count: { id: true }
            }),
            prisma.token_device_activation.groupBy({
                by: ['product'],
                where: { created: { gte: thirtyDaysAgo } },
                _count: { id: true }
            }),
            prisma.order_list.findMany({
                where: {
                    created: { gte: thirtyDaysAgo },
                    OR: [
                        { paid_at: { not: null } },
                        { status: { in: ['COMPLETED', 'PAID', 'SETTLED', 'ACCEPT', 'terbayar', 'success', 'settlement'] } }
                    ]
                },
                select: { items: true, status: true, paid_at: true }
            }),
            prisma.online_devices.groupBy({
                by: ['product_name'],
                _count: { id: true }
            }),
            prisma.categories.findMany({
                where: { is_active: true },
                select: { id: true, name: true, slug: true, icon: true }
            })
        ]);

        const formatActiveUsers = (count: number) => {
            if (count <= 0) return '0+';
            if (count < 10) return `${count}+`;
            if (count < 50) {
                return `${Math.floor(count / 10) * 10}+`;
            }
            return `${Math.floor(count / 50) * 50}+`;
        };

        const nameToProductMap = new Map<string, typeof allActiveProducts[0]>();
        const idToProductMap = new Map<number, typeof allActiveProducts[0]>();
        allActiveProducts.forEach(p => {
            nameToProductMap.set(p.name.trim().toLowerCase(), p);
            idToProductMap.set(p.id, p);
            if (p.product_id) idToProductMap.set(p.product_id, p);
        });

        const monthlySalesMap = new Map<number, number>();
        tokenCounts30d.forEach(t => {
            const pName = (t.product || '').trim().toLowerCase();
            const matched = nameToProductMap.get(pName);
            if (matched) {
                monthlySalesMap.set(matched.id, (monthlySalesMap.get(matched.id) || 0) + t._count.id);
            }
        });

        paidOrders30d.forEach(o => {
            try {
                const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
                if (Array.isArray(items)) {
                    items.forEach((it: any) => {
                        const pid = Number(it.product_id || it.db_id);
                        const matched = pid ? idToProductMap.get(pid) : (it.name ? nameToProductMap.get(String(it.name).trim().toLowerCase()) : null);
                        if (matched && !monthlySalesMap.has(matched.id)) {
                            monthlySalesMap.set(matched.id, 1);
                        }
                    });
                }
            } catch (err) {
                // Ignore parse errors for corrupt items JSON
            }
        });

        const tokenMap = new Map<string, number>();
        tokenCounts.forEach(t => tokenMap.set((t.product || '').toLowerCase().trim(), t._count.id));
        const onlineMap = new Map<string, number>();
        onlineCounts.forEach(o => onlineMap.set((o.product_name || '').toLowerCase().trim(), o._count.id));
        const catMap = new Map(categoriesList.map(c => [c.id, c]));

        const enrichedProducts = allActiveProducts.map(p => {
            const pName = p.name.toLowerCase().trim();
            const tokenCount = tokenMap.get(pName) || 0;
            const onlineCount = onlineMap.get(pName) || 0;
            const realCount = Math.max(tokenCount, onlineCount);

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
            const matchedCats = ids.map(id => catMap.get(id)).filter(Boolean) as Array<{ id: number; name: string; slug: string; icon: string | null }>;
            const primaryCat = matchedCats[0] || (p.category_id ? catMap.get(p.category_id) : undefined);

            let videoCount = 0;
            if (p.tutorials) {
                try {
                    const parsed = typeof p.tutorials === 'string' ? JSON.parse(p.tutorials) : p.tutorials;
                    if (Array.isArray(parsed)) {
                        videoCount = parsed.length;
                    }
                } catch {
                    videoCount = 0;
                }
            }

            const sales30d = monthlySalesMap.get(p.id) || 0;

            return {
                ...p,
                category_ids: ids,
                category_id: ids[0] || p.category_id || null,
                category_name: matchedCats.map(c => c.name).join(', ') || (primaryCat ? primaryCat.name : null),
                category_icon: primaryCat ? primaryCat.icon : null,
                category_slug: primaryCat ? primaryCat.slug : null,
                categories: matchedCats,
                active_users: realCount,
                active_users_formatted: formatActiveUsers(realCount),
                video_count: videoCount,
                has_tutorials: videoCount > 0,
                monthly_sales_count: sales30d,
                monthly_sales_formatted: sales30d > 0 ? `${sales30d} terbeli bulan ini` : '0 terbeli bulan ini'
            };
        });

        // Sort by 30-day paid sales count DESC, then active users DESC, then ID DESC
        enrichedProducts.sort((a, b) => {
            if (b.monthly_sales_count !== a.monthly_sales_count) {
                return b.monthly_sales_count - a.monthly_sales_count;
            }
            if (b.active_users !== a.active_users) {
                return b.active_users - a.active_users;
            }
            return b.id - a.id;
        });

        // Server-Side Filtering (Search and Category)
        const filtered = enrichedProducts.filter(p => {
            // Search matching: strictly Project Name and Description
            if (searchQuery) {
                const nameMatch = (p.name || '').toLowerCase().includes(searchQuery);
                const descMatch = (p.description || '').toLowerCase().includes(searchQuery);
                if (!nameMatch && !descMatch) return false;
            }

            // Category matching
            if (categoryFilter === 'all') return true;
            if (categoryFilter === 'bundle') return p.is_bundle === true;
            if (categoryFilter === 'free') return p.price === 0;

            if (categoryFilter.startsWith('tag:')) {
                const tag = categoryFilter.replace('tag:', '').toLowerCase();
                return (p.category_name || '').toLowerCase().includes(tag);
            }

            const numCatId = parseInt(categoryFilter, 10);
            if (!isNaN(numCatId)) {
                return p.category_id === numCatId || (p.category_ids && p.category_ids.includes(numCatId));
            }

            return true;
        });

        const total = filtered.length;
        const totalPages = Math.ceil(total / pageSize) || 1;
        const offset = (page - 1) * pageSize;
        const paginatedProducts = filtered.slice(offset, offset + pageSize);

        // Collect available tags across all active products
        const tags = Array.from(
            new Set(
                enrichedProducts
                    .filter(p => p.is_active && p.category_name)
                    .flatMap(p => (p.category_name || '').split(',').map((s: string) => s.trim()))
                    .filter(Boolean)
            )
        );

        return res.json({
            status: 'success',
            data: {
                products: paginatedProducts,
                categories: categoriesList,
                tags,
                pagination: {
                    page,
                    pageSize,
                    total,
                    totalPages,
                    hasMore: page < totalPages,
                    remaining: Math.max(0, total - (offset + paginatedProducts.length))
                }
            }
        });
    }

    /**
     * API: Get Member Orders List with Sorting, Filtering, and Pagination
     */
    async apiGetOrders(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = (session.userEmail || '').trim();
        const searchQuery = ((req.query.search as string) || '').trim().toLowerCase();
        const statusFilter = ((req.query.status as string) || 'all').trim().toLowerCase();
        const sortBy = ((req.query.sort as string) || 'created').trim().toLowerCase(); // 'created' | 'duration' | 'total_amount'
        const sortOrder = ((req.query.order as string) || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));

        try {
            const config = await getGoqrisConfig();
            const globalExpiryMinutes = config.expiryMinutes || 1440;

            const rawOrders = await prisma.order_list.findMany({
                where: {
                    OR: [
                        { user: userEmail },
                        { user: userEmail.toLowerCase() }
                    ]
                },
                orderBy: { id: 'desc' }
            });

            // Fetch products to assist item naming, installer files, and tutorials
            const allProducts = await prisma.products.findMany({
                select: {
                    id: true,
                    name: true,
                    product_id: true,
                    image: true,
                    price: true,
                    installer_files: true,
                    tutorials: true
                }
            });

            // Ensure every order has an invoice token generated
            const orders = await Promise.all(rawOrders.map(async (order) => {
                const token = await ensureOrderInvoiceToken(order.id);
                (order as any).invoice_token = token;
                return order;
            }));

            const productMap = new Map<number, typeof allProducts[0]>();
            allProducts.forEach(p => {
                productMap.set(p.id, p);
                if (p.product_id) productMap.set(p.product_id, p);
            });

            const mappedOrders = orders.map(order => {
                let itemsArr: Array<{
                    db_id?: number | string;
                    product_id?: number | string;
                    name?: string;
                    price?: number;
                    final_unit_price?: number;
                    duration_months?: number;
                    duration_text?: string;
                }> = [];

                try {
                    const parsed: unknown = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
                    if (Array.isArray(parsed)) {
                        itemsArr = parsed as typeof itemsArr;
                    } else if (parsed && typeof parsed === 'object') {
                        itemsArr = [parsed as (typeof itemsArr)[0]];
                    }
                } catch {
                    itemsArr = [];
                }

                // Extract matched product
                let matchedProduct: typeof allProducts[0] | null = null;
                const itemDetails = itemsArr.map(item => {
                    const matched = item.product_id ? productMap.get(Number(item.product_id)) : (item.db_id ? productMap.get(Number(item.db_id)) : null);
                    if (matched && !matchedProduct) {
                        matchedProduct = matched;
                    }
                    return {
                        name: item.name || matched?.name || 'Produk Digital',
                        product_id: item.product_id || matched?.product_id || matched?.id,
                        price: item.price || item.final_unit_price || matched?.price || 0,
                        duration_text: item.duration_text || (item.duration_months ? `${item.duration_months} Bulan` : null)
                    };
                });

                if (!matchedProduct && allProducts.length > 0) {
                    matchedProduct = allProducts.find(p => order.items && order.items.toLowerCase().includes(p.name.toLowerCase())) || null;
                }

                const productName = itemDetails.length > 0 ? itemDetails.map(i => i.name).join(', ') : 'Produk Digital';

                // Check tutorials
                let hasTutorials = false;
                if (matchedProduct && matchedProduct.tutorials) {
                    try {
                        const parsedTuts = typeof matchedProduct.tutorials === 'string' ? JSON.parse(matchedProduct.tutorials) : matchedProduct.tutorials;
                        hasTutorials = Array.isArray(parsedTuts) && parsedTuts.length > 0;
                    } catch {
                        hasTutorials = false;
                    }
                }

                // Parse installer files
                const parsedInstallerFiles = sftpService.parseInstallerFiles(matchedProduct?.installer_files);

                // Raw duration in minutes for sorting
                const rawDuration = order.duration || (itemDetails[0]?.duration_text?.includes('Bulan') ? parseInt(itemDetails[0].duration_text, 10) * 43800 : 0);

                // Duration format
                let durationText = '';
                if (itemDetails.length > 0 && itemDetails[0].duration_text) {
                    durationText = itemDetails[0].duration_text;
                } else if (order.duration) {
                    const minutes = order.duration;
                    if (minutes >= 43800) {
                        const months = Math.round(minutes / 43800);
                        durationText = `${months} Bulan`;
                    } else if (minutes >= 1440) {
                        const days = Math.round(minutes / 1440);
                        durationText = `${days} Hari`;
                    } else {
                        durationText = `${minutes} Menit`;
                    }
                } else {
                    durationText = '-';
                }

                const isPaid = !!order.paid_at || order.status === 'Order has been complete';

                // Hitung status kedaluwarsa secara dinamis berdasarkan payment_expires_at atau setting expiry
                const nowSec = Math.floor(Date.now() / 1000);
                const orderExpiresAt = order.payment_expires_at || (order.created + (globalExpiryMinutes * 60));
                const isExpired = !isPaid && (nowSec > orderExpiresAt || order.status.toUpperCase().includes('EXPIRED') || order.status.toUpperCase().includes('BATAL'));

                // Categorize status for filtering
                let statusCategory = 'pending';
                let displayStatus = order.status;
                if (isPaid) {
                    statusCategory = 'paid';
                } else if (isExpired) {
                    statusCategory = 'expired';
                    displayStatus = 'Expired';
                }

                // Tentukan payment_url untuk tombol Bayar di Member Orders:
                // Jika order belum bayar dan belum memiliki QRIS aktif, klik 'Bayar' akan memanggil endpoint /member/orders/:id/pay
                // yang secara otomatis akan men-generate QR GoQRIS baru dan mengarahkan user langsung ke halaman scan QR.
                // Jika sudah memiliki QRIS / invoice_token, langsung buka halaman invoice QR tersebut.
                let targetPaymentUrl = `/member/orders/${order.id}/pay`;
                if ((order as any).qr_string && (order as any).invoice_token) {
                    targetPaymentUrl = `/#/invoice/${(order as any).invoice_token}`;
                }

                return {
                    id: order.id,
                    order_no: `#ORD-${order.id}`,
                    product_id: matchedProduct?.id || (itemDetails[0]?.product_id ? Number(itemDetails[0].product_id) : null),
                    product_name: productName,
                    product_image: sanitizeProductImage(matchedProduct?.image),
                    has_tutorials: hasTutorials,
                    installer_files: parsedInstallerFiles,
                    items: itemDetails,
                    created: order.created,
                    created_formatted: new Date(order.created * 1000).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                    }),
                    status: displayStatus,
                    invoice_token: (order as any).invoice_token || null,
                    status_category: statusCategory,
                    is_paid: isPaid,
                    is_expired: isExpired,
                    expires_at: orderExpiresAt,
                    paid_at: order.paid_at,
                    payment_method: order.payment || 'QRIS / GoQRIS',
                    payment_url: targetPaymentUrl,
                    total_amount: order.total_amount || 0,
                    duration_text: durationText,
                    raw_duration: rawDuration
                };
            });

            // Calculate status count summary across all user orders
            const counts = {
                all: mappedOrders.length,
                paid: mappedOrders.filter(o => o.status_category === 'paid').length,
                pending: mappedOrders.filter(o => o.status_category === 'pending').length,
                expired: mappedOrders.filter(o => o.status_category === 'expired').length
            };

            // 1. Filter by Search Query
            let filtered = searchQuery
                ? mappedOrders.filter(o =>
                    o.order_no.toLowerCase().includes(searchQuery) ||
                    o.product_name.toLowerCase().includes(searchQuery) ||
                    o.status.toLowerCase().includes(searchQuery) ||
                    o.payment_method.toLowerCase().includes(searchQuery) ||
                    o.created_formatted.toLowerCase().includes(searchQuery)
                )
                : mappedOrders;

            // 2. Filter by Status Category
            if (statusFilter !== 'all') {
                filtered = filtered.filter(o => o.status_category === statusFilter);
            }

            // 3. Sorting
            filtered.sort((a, b) => {
                let comparison = 0;
                if (sortBy === 'duration') {
                    comparison = a.raw_duration - b.raw_duration;
                } else if (sortBy === 'total_amount' || sortBy === 'total') {
                    comparison = a.total_amount - b.total_amount;
                } else {
                    // Default 'created' date
                    comparison = a.created - b.created;
                }
                return sortOrder === 'asc' ? comparison : -comparison;
            });

            // 4. Pagination
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
            const safePage = Math.min(page, totalPages);
            const paginatedOrders = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

            return res.json({
                status: 'success',
                data: {
                    orders: paginatedOrders,
                    pagination: {
                        page: safePage,
                        pageSize,
                        totalItems,
                        totalPages
                    },
                    counts
                }
            });
        } catch (error) {
            console.error('API Get Orders Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal mengambil data pesanan' });
        }
    }

    /**
     * API: Get Member Licenses List with Multi-search, Sorting, Filtering, and Pagination
     */
    async apiGetLicenses(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = (session.userEmail || '').trim();
        const searchQuery = ((req.query.search as string) || '').trim().toLowerCase();
        const statusFilter = ((req.query.status as string) || 'all').trim().toLowerCase();
        const sortBy = ((req.query.sort as string) || 'created').trim().toLowerCase(); // 'created' | 'product' | 'duration' | 'remaining'
        const sortOrder = ((req.query.order as string) || 'desc').trim().toLowerCase() === 'asc' ? 'asc' : 'desc';

        const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
        const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string, 10) || 10));

        try {
            const [tokens, allUserDevices, allProducts] = await Promise.all([
                prisma.token_device_activation.findMany({
                    where: {
                        OR: [
                            { user: userEmail },
                            { user: userEmail.toLowerCase() }
                        ]
                    },
                    orderBy: { created: 'desc' }
                }),
                prisma.device.findMany({
                    where: {
                        OR: [
                            { email: userEmail },
                            { email: userEmail.toLowerCase() }
                        ]
                    }
                }),
                prisma.products.findMany({
                    select: { id: true, name: true, product_id: true, tutorials: true, image: true, installer_files: true }
                })
            ]);

            const now = Math.floor(Date.now() / 1000);

            const formatDurationText = (mins: number): string => {
                if (!mins || mins <= 0) return '-';
                if (mins >= 43800) {
                    const m = Math.round(mins / 43800);
                    return `${m} Bulan`;
                }
                if (mins >= 1440) {
                    const d = Math.round(mins / 1440);
                    return `${d} Hari`;
                }
                if (mins <= 365) {
                    return `${mins} Hari`;
                }
                return `${mins} Menit`;
            };

            const productByName = new Map<string, typeof allProducts[0]>();
            const productByProductId = new Map<number, typeof allProducts[0]>();
            allProducts.forEach(p => {
                if (p.name) productByName.set(p.name.toLowerCase(), p);
                if (p.product_id) productByProductId.set(p.product_id, p);
            });

            const deviceByKey = new Map<string, typeof allUserDevices[0]>();
            const deviceByOrderId = new Map<number, typeof allUserDevices[0]>();
            allUserDevices.forEach(d => {
                if (d.order_id && d.product) {
                    deviceByKey.set(`${d.order_id}_${d.product.toLowerCase()}`, d);
                }
                if (d.order_id && !deviceByOrderId.has(d.order_id)) {
                    deviceByOrderId.set(d.order_id, d);
                }
            });

            const mappedLicenses = tokens.map(token => {
                const prodKey = token.product ? token.product.toLowerCase() : '';
                const relatedDevice = (token.order_id && prodKey ? deviceByKey.get(`${token.order_id}_${prodKey}`) : undefined)
                    || (token.order_id ? deviceByOrderId.get(token.order_id) : undefined);

                const matchedProduct = (prodKey ? productByName.get(prodKey) : undefined)
                    || (token.order_id ? productByProductId.get(token.order_id) : undefined);

                let status: 'active' | 'unused' | 'expired' = 'unused';
                let statusText = 'Belum Dipakai';
                let message = 'Siap Digunakan';
                let durationStr = formatDurationText(token.duration);
                const machineId = relatedDevice?.machine_id || null;
                const isApplied = !!token.taked && !!machineId;

                let activatedAt: number | null = null;
                let activatedAtFormatted: string | null = null;
                let expiresAt: number | null = null;
                let expiresAtFormatted: string | null = null;
                let remainingDays: number = 9999;

                if (token.taked) {
                    activatedAt = token.taked_at || relatedDevice?.created || token.created;
                    if (activatedAt) {
                        activatedAtFormatted = new Date(activatedAt * 1000).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric'
                        });
                    }

                    if (relatedDevice) {
                        expiresAt = relatedDevice.expired;
                        durationStr = formatDurationText(relatedDevice.duration);
                    } else {
                        const durationSeconds = token.duration > 365 ? token.duration * 60 : token.duration * 86400;
                        expiresAt = (activatedAt || token.created) + durationSeconds;
                    }

                    if (expiresAt) {
                        expiresAtFormatted = new Date(expiresAt * 1000).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric'
                        });

                        if (expiresAt < now) {
                            status = 'expired';
                            statusText = 'Kadaluarsa';
                            message = 'Masa aktif habis';
                            remainingDays = 0;
                        } else {
                            status = 'active';
                            statusText = 'Aktif';
                            const diff = expiresAt - now;
                            const days = Math.floor(diff / 86400);
                            const hours = Math.floor((diff % 86400) / 3600);
                            remainingDays = days;
                            if (days > 0) {
                                message = `Sisa ${days} hari`;
                            } else if (hours > 0) {
                                message = `Sisa ${hours} jam`;
                            } else {
                                message = '< 1 jam';
                            }
                        }
                    }
                } else {
                    message = 'Belum diaktivasi';
                }

                const createdDate = new Date(token.created * 1000);
                const createdStr = createdDate.toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'short', year: 'numeric'
                });

                const installerFiles = sftpService.parseInstallerFiles(matchedProduct?.installer_files);

                return {
                    id: token.id,
                    key: token.token,
                    product: token.product || matchedProduct?.name || 'Software Lisensi',
                    productId: matchedProduct?.id || null,
                    image: sanitizeProductImage(matchedProduct?.image),
                    hasTutorials: !!matchedProduct?.tutorials,
                    installer_files: installerFiles,
                    status,
                    statusText,
                    message,
                    machineId: machineId || '-',
                    is_applied: isApplied,
                    duration: durationStr,
                    raw_duration: token.duration || 0,
                    created: createdStr,
                    raw_created: token.created || 0,
                    activated_at: activatedAt,
                    activated_at_formatted: activatedAtFormatted,
                    expires_at: expiresAt,
                    expires_at_formatted: expiresAtFormatted,
                    remaining_days: remainingDays,
                    orderId: token.order_id
                };
            });

            // Calculate status count summary
            const counts = {
                all: mappedLicenses.length,
                active: mappedLicenses.filter(l => l.status === 'active').length,
                unused: mappedLicenses.filter(l => l.status === 'unused').length,
                expired: mappedLicenses.filter(l => l.status === 'expired').length
            };

            // 1. Multi-criteria Search Filter
            let filtered = searchQuery
                ? mappedLicenses.filter(l =>
                    l.key.toLowerCase().includes(searchQuery) ||
                    l.product.toLowerCase().includes(searchQuery) ||
                    l.machineId.toLowerCase().includes(searchQuery) ||
                    l.statusText.toLowerCase().includes(searchQuery) ||
                    l.message.toLowerCase().includes(searchQuery) ||
                    `#ord-${l.orderId}`.toLowerCase().includes(searchQuery)
                )
                : mappedLicenses;

            // 2. Status Category Filter
            if (statusFilter !== 'all') {
                filtered = filtered.filter(l => l.status === statusFilter);
            }

            // 3. Sorting
            filtered.sort((a, b) => {
                let comparison = 0;
                if (sortBy === 'product') {
                    comparison = a.product.localeCompare(b.product);
                } else if (sortBy === 'duration') {
                    comparison = a.raw_duration - b.raw_duration;
                } else if (sortBy === 'remaining') {
                    comparison = a.remaining_days - b.remaining_days;
                } else {
                    // Default 'created'
                    comparison = a.raw_created - b.raw_created;
                }
                return sortOrder === 'asc' ? comparison : -comparison;
            });

            // 4. Pagination
            const totalItems = filtered.length;
            const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
            const safePage = Math.min(page, totalPages);
            const paginatedLicenses = filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

            return res.json({
                status: 'success',
                data: {
                    licenses: paginatedLicenses,
                    pagination: {
                        page: safePage,
                        pageSize,
                        totalItems,
                        totalPages
                    },
                    counts
                }
            });
        } catch (error) {
            console.error('API Get Licenses Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal mengambil data lisensi' });
        }
    }

    /**
     * API: Get Specific Order License Details
     */
    async apiGetOrderLicenses(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = (session.userEmail || '').trim();
        const orderId = parseInt(req.params.orderId as string, 10);

        if (!orderId || isNaN(orderId)) {
            return res.status(400).json({ status: 'error', message: 'ID Pesanan tidak valid' });
        }

        try {
            const order = await prisma.order_list.findFirst({
                where: {
                    id: orderId,
                    OR: [
                        { user: userEmail },
                        { user: userEmail.toLowerCase() }
                    ]
                }
            });

            if (!order) {
                return res.status(404).json({ status: 'error', message: 'Pesanan tidak ditemukan' });
            }

            const [tokens, devices, allProducts] = await Promise.all([
                prisma.token_device_activation.findMany({
                    where: {
                        order_id: orderId,
                        OR: [
                            { user: userEmail },
                            { user: userEmail.toLowerCase() }
                        ]
                    },
                    orderBy: { created: 'desc' }
                }),
                prisma.device.findMany({
                    where: {
                        order_id: orderId,
                        OR: [
                            { email: userEmail },
                            { email: userEmail.toLowerCase() }
                        ]
                    }
                }),
                prisma.products.findMany({
                    select: { id: true, name: true, product_id: true, tutorials: true, image: true, price: true, installer_files: true }
                })
            ]);

            const now = Math.floor(Date.now() / 1000);

            const formatDurationText = (mins: number): string => {
                if (!mins || mins <= 0) return '-';
                if (mins >= 43800) {
                    const m = Math.round(mins / 43800);
                    return `${m} Bulan`;
                }
                if (mins >= 1440) {
                    const d = Math.round(mins / 1440);
                    return `${d} Hari`;
                }
                if (mins <= 365) {
                    return `${mins} Hari`;
                }
                return `${mins} Menit`;
            };

            const productByName = new Map<string, typeof allProducts[0]>();
            const productByProductId = new Map<number, typeof allProducts[0]>();
            allProducts.forEach(p => {
                if (p.name) productByName.set(p.name.toLowerCase(), p);
                if (p.product_id) productByProductId.set(p.product_id, p);
            });

            const deviceByKey = new Map<string, typeof devices[0]>();
            const deviceByOrderId = new Map<number, typeof devices[0]>();
            devices.forEach(d => {
                if (d.order_id && d.product) {
                    deviceByKey.set(`${d.order_id}_${d.product.toLowerCase()}`, d);
                }
                if (d.order_id && !deviceByOrderId.has(d.order_id)) {
                    deviceByOrderId.set(d.order_id, d);
                }
            });

            const licenses = tokens.map(token => {
                const prodKey = token.product ? token.product.toLowerCase() : '';
                const relatedDevice = (token.order_id && prodKey ? deviceByKey.get(`${token.order_id}_${prodKey}`) : undefined)
                    || (token.order_id ? deviceByOrderId.get(token.order_id) : undefined);

                const matchedProduct = (prodKey ? productByName.get(prodKey) : undefined)
                    || (token.order_id ? productByProductId.get(token.order_id) : undefined);

                let status: 'active' | 'unused' | 'expired' = 'unused';
                let statusLabel = 'Belum Digunakan';
                let remainingText = 'Siap Digunakan';
                let durationStr = formatDurationText(token.duration);
                const machineId = relatedDevice?.machine_id || null;
                const isApplied = !!token.taked && !!machineId;

                let activatedAt: number | null = null;
                let activatedAtFormatted: string | null = null;
                let expiresAt: number | null = null;
                let expiresAtFormatted: string | null = null;
                let remainingDays: number | null = null;

                if (token.taked) {
                    activatedAt = token.taked_at || relatedDevice?.created || token.created;
                    if (activatedAt) {
                        activatedAtFormatted = new Date(activatedAt * 1000).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) + ' WIB';
                    }

                    if (relatedDevice) {
                        expiresAt = relatedDevice.expired;
                        durationStr = formatDurationText(relatedDevice.duration);
                    } else {
                        const durationSeconds = token.duration > 365 ? token.duration * 60 : token.duration * 86400;
                        expiresAt = (activatedAt || token.created) + durationSeconds;
                    }

                    if (expiresAt) {
                        expiresAtFormatted = new Date(expiresAt * 1000).toLocaleString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                        }) + ' WIB';

                        if (expiresAt < now) {
                            status = 'expired';
                            statusLabel = 'Kadaluarsa';
                            remainingText = 'Masa aktif habis';
                            remainingDays = 0;
                        } else {
                            status = 'active';
                            statusLabel = 'Aktif / Terpasang';
                            const diff = expiresAt - now;
                            const days = Math.floor(diff / 86400);
                            const hours = Math.floor((diff % 86400) / 3600);
                            remainingDays = days;
                            if (days > 0) {
                                remainingText = `Sisa ${days} hari`;
                            } else if (hours > 0) {
                                remainingText = `Sisa ${hours} jam`;
                            } else {
                                remainingText = '< 1 jam';
                            }
                        }
                    }
                } else {
                    remainingText = `Masa aktif ${durationStr} dimulai saat aktivasi`;
                }

                const installerFiles = sftpService.parseInstallerFiles(matchedProduct?.installer_files);

                return {
                    id: token.id,
                    key: token.token,
                    product_name: token.product || matchedProduct?.name || 'Software Lisensi',
                    product_id: matchedProduct?.id || null,
                    status,
                    status_label: statusLabel,
                    is_applied: isApplied,
                    machine_id: machineId,
                    duration_text: durationStr,
                    activated_at: activatedAt,
                    activated_at_formatted: activatedAtFormatted,
                    expires_at: expiresAt,
                    expires_at_formatted: expiresAtFormatted,
                    remaining_days: remainingDays,
                    remaining_text: remainingText,
                    tutorial_url: matchedProduct?.tutorials || null,
                    has_tutorials: !!matchedProduct?.tutorials,
                    product_image: sanitizeProductImage(matchedProduct?.image),
                    installer_files: installerFiles
                };
            });

            const isPaid = !!order.paid_at || order.status === 'Order has been complete';

            return res.json({
                status: 'success',
                data: {
                    order: {
                        id: order.id,
                        order_no: `#ORD-${order.id}`,
                        status: order.status,
                        is_paid: isPaid,
                        created_formatted: new Date(order.created * 1000).toLocaleDateString('id-ID', {
                            day: 'numeric', month: 'short', year: 'numeric'
                        })
                    },
                    licenses,
                    totalLicenses: licenses.length
                }
            });
        } catch (error) {
            console.error('API Get Order Licenses Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat informasi lisensi pesanan' });
        }
    }

    /**
     * API: Get Member Profile Details
     */
    async apiGetProfile(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = (session.userEmail || '').trim();

        try {
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: userEmail },
                        { email: userEmail.toLowerCase() }
                    ]
                }
            });

            if (!user) {
                return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
            }

            const [totalOrders, totalLicenses] = await Promise.all([
                prisma.order_list.count({
                    where: {
                        OR: [
                            { user: userEmail },
                            { user: userEmail.toLowerCase() }
                        ]
                    }
                }),
                prisma.token_device_activation.count({
                    where: {
                        OR: [
                            { user: userEmail },
                            { user: userEmail.toLowerCase() }
                        ]
                    }
                })
            ]);

            const createdDate = user.created
                ? new Date(user.created * 1000).toLocaleDateString('id-ID', {
                    day: 'numeric', month: 'long', year: 'numeric'
                })
                : '-';

            return res.json({
                status: 'success',
                data: {
                    user: {
                        id: user.id,
                        name: user.name || 'Member',
                        email: user.email,
                        whatsapp: user.whatsapp || '',
                        company: user.company || '',
                        verified: Boolean(user.verified),
                        avatar: user.avatar || undefined,
                        created_formatted: createdDate
                    },
                    stats: {
                        total_orders: totalOrders,
                        total_licenses: totalLicenses
                    }
                }
            });
        } catch (error) {
            console.error('API Get Profile Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat data profil' });
        }
    }

    /**
     * API: Update Member Profile (Name, WhatsApp, Company - Email is strictly immutable)
     */
    async apiUpdateProfile(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = (session.userEmail || '').trim();
        const { name, whatsapp, company } = req.body as { name?: string; whatsapp?: string; company?: string };

        if (!name || name.trim().length < 2) {
            return res.status(400).json({ status: 'error', message: 'Nama lengkap wajib diisi minimal 2 karakter' });
        }

        try {
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: userEmail },
                        { email: userEmail.toLowerCase() }
                    ]
                }
            });

            if (!user) {
                return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
            }

            const updatedName = name.trim();
            const updatedWhatsapp = (whatsapp || '').trim();
            const updatedCompany = (company || '').trim();

            await prisma.user.update({
                where: { id: user.id },
                data: {
                    name: updatedName,
                    whatsapp: updatedWhatsapp,
                    company: updatedCompany
                }
            });

            // Update express session
            session.userName = updatedName;

            return res.json({
                status: 'success',
                message: 'Profil berhasil diperbarui',
                data: {
                    name: updatedName,
                    email: user.email,
                    whatsapp: updatedWhatsapp,
                    company: updatedCompany
                }
            });
        } catch (error) {
            console.error('API Update Profile Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memperbarui profil' });
        }
    }

    /**
     * API: Change / Reset Password
     */
    async apiChangePassword(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = (session.userEmail || '').trim();
        const { current_password, new_password, confirm_password } = req.body as {
            current_password?: string;
            new_password?: string;
            confirm_password?: string;
        };

        if (!current_password || !new_password || !confirm_password) {
            return res.status(400).json({ status: 'error', message: 'Semua kolom password wajib diisi' });
        }

        if (new_password.length < 6) {
            return res.status(400).json({ status: 'error', message: 'Password baru minimal harus 6 karakter' });
        }

        if (new_password !== confirm_password) {
            return res.status(400).json({ status: 'error', message: 'Konfirmasi password baru tidak cocok' });
        }

        if (current_password === new_password) {
            return res.status(400).json({ status: 'error', message: 'Password baru tidak boleh sama dengan password saat ini' });
        }

        try {
            const user = await prisma.user.findFirst({
                where: {
                    OR: [
                        { email: userEmail },
                        { email: userEmail.toLowerCase() }
                    ]
                }
            });

            if (!user) {
                return res.status(404).json({ status: 'error', message: 'User tidak ditemukan' });
            }

            if (user.password !== current_password) {
                return res.status(400).json({ status: 'error', message: 'Password saat ini salah' });
            }

            await prisma.user.update({
                where: { id: user.id },
                data: { password: new_password }
            });

            return res.json({
                status: 'success',
                message: 'Password berhasil diubah!'
            });
        } catch (error) {
            console.error('API Change Password Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal mengubah password' });
        }
    }

    /**
     * Get HWID change status, limits, and cooldown for a license token
     */
    async apiGetHwidStatus(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = (session.userEmail || '').trim();
        const tokenId = parseInt(req.query.token_id as string, 10);
        if (!tokenId || isNaN(tokenId)) {
            return res.status(400).json({ status: 'error', message: 'Parameter token_id tidak valid' });
        }

        try {
            const token = await prisma.token_device_activation.findFirst({
                where: {
                    id: tokenId,
                    OR: [
                        { user: userEmail },
                        { user: userEmail.toLowerCase() }
                    ]
                }
            });

            if (!token) {
                return res.status(404).json({ status: 'error', message: 'Lisensi tidak ditemukan atau bukan milik Anda' });
            }

            const now = Math.floor(Date.now() / 1000);
            const oneDayAgo = now - 86400;

            const device = await prisma.device.findFirst({
                where: {
                    order_id: token.order_id,
                    product: token.product,
                    OR: [
                        { email: userEmail },
                        { email: userEmail.toLowerCase() }
                    ]
                },
                orderBy: { id: 'desc' }
            });

            const recentHistory = await prisma.device_hwid_history.findMany({
                where: {
                    token_id: token.id,
                    created_at: { gte: oneDayAgo }
                },
                orderBy: { created_at: 'desc' }
            });

            const changesToday = recentHistory.length;
            const maxChangesPerDay = 3;
            const remainingChangesToday = Math.max(0, maxChangesPerDay - changesToday);

            const latestChange = recentHistory[0] || null;
            const cooldownDuration = 45 * 60; // 45 minutes = 2700s
            let cooldownSecondsRemaining = 0;
            let nextAllowedTimestamp = 0;

            if (latestChange) {
                const timeSinceLastChange = now - latestChange.created_at;
                if (timeSinceLastChange < cooldownDuration) {
                    cooldownSecondsRemaining = cooldownDuration - timeSinceLastChange;
                    nextAllowedTimestamp = latestChange.created_at + cooldownDuration;
                }
            }

            const canChange = remainingChangesToday > 0 && cooldownSecondsRemaining === 0;

            return res.json({
                status: 'success',
                data: {
                    token_id: token.id,
                    product: token.product,
                    current_hwid: device?.machine_id || '',
                    changesToday,
                    maxChangesPerDay,
                    remainingChangesToday,
                    canChange,
                    cooldownSecondsRemaining,
                    nextAllowedTimestamp,
                    lastChangedAt: latestChange?.created_at || null,
                    recentHistory: recentHistory.map(h => ({
                        id: h.id,
                        old_hwid: h.old_hwid,
                        new_hwid: h.new_hwid,
                        created_at: h.created_at
                    }))
                }
            });
        } catch (error) {
            console.error('API Get HWID Status Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memuat status Machine ID' });
        }
    }

    /**
     * Update/Rebind Machine ID for a license token with strict 3x/day limit and 45min cooldown
     */
    async apiUpdateMachineId(req: Request, res: Response) {
        const session = req.session as unknown as MemberSession;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = (session.userEmail || '').trim();
        const { token_id, new_hwid } = req.body as { token_id?: number | string; new_hwid?: string };

        const tokenId = parseInt(String(token_id), 10);
        const cleanNewHwid = (new_hwid || '').trim();

        if (!tokenId || isNaN(tokenId)) {
            return res.status(400).json({ status: 'error', message: 'ID Lisensi tidak valid' });
        }

        if (!cleanNewHwid || cleanNewHwid.length < 3) {
            return res.status(400).json({ status: 'error', message: 'Machine ID (HWID) baru wajib diisi (minimal 3 karakter)' });
        }

        if (cleanNewHwid.length > 255) {
            return res.status(400).json({ status: 'error', message: 'Machine ID (HWID) terlalu panjang (maksimal 255 karakter)' });
        }

        try {
            const token = await prisma.token_device_activation.findFirst({
                where: {
                    id: tokenId,
                    OR: [
                        { user: userEmail },
                        { user: userEmail.toLowerCase() }
                    ]
                }
            });

            if (!token) {
                return res.status(404).json({ status: 'error', message: 'Lisensi tidak ditemukan atau bukan milik akun Anda' });
            }

            const now = Math.floor(Date.now() / 1000);
            const oneDayAgo = now - 86400;

            const device = await prisma.device.findFirst({
                where: {
                    order_id: token.order_id,
                    product: token.product,
                    OR: [
                        { email: userEmail },
                        { email: userEmail.toLowerCase() }
                    ]
                },
                orderBy: { id: 'desc' }
            });

            const currentHwid = device?.machine_id || '';
            if (currentHwid && currentHwid.toLowerCase() === cleanNewHwid.toLowerCase()) {
                return res.status(400).json({ status: 'error', message: 'Machine ID baru sama dengan Machine ID yang sedang terpasang saat ini' });
            }

            const recentHistory = await prisma.device_hwid_history.findMany({
                where: {
                    token_id: token.id,
                    created_at: { gte: oneDayAgo }
                },
                orderBy: { created_at: 'desc' }
            });

            // 1. Check max limit (3x per day)
            const maxChangesPerDay = 3;
            if (recentHistory.length >= maxChangesPerDay) {
                return res.status(429).json({
                    status: 'error',
                    message: 'Batas maksimal 3x perubahan Machine ID per hari telah tercapai. Silakan coba kembali besok.'
                });
            }

            // 2. Check cooldown (45 minutes)
            const cooldownDuration = 45 * 60; // 2700s
            const latestChange = recentHistory[0] || null;
            if (latestChange) {
                const timeSinceLast = now - latestChange.created_at;
                if (timeSinceLast < cooldownDuration) {
                    const remainingSeconds = cooldownDuration - timeSinceLast;
                    const remainingMinutes = Math.ceil(remainingSeconds / 60);
                    return res.status(429).json({
                        status: 'error',
                        message: `Perubahan Machine ID memerlukan jeda minimal 45 menit. Harap tunggu ${remainingMinutes} menit lagi sebelum melakukan perubahan berikutnya.`,
                        cooldownSecondsRemaining: remainingSeconds
                    });
                }
            }

            // 3. Update device table
            if (device) {
                await prisma.device.update({
                    where: { id: device.id },
                    data: { machine_id: cleanNewHwid }
                });
            } else {
                const durationMinutes = token.duration > 0 ? token.duration : 43800;
                await prisma.device.create({
                    data: {
                        order_id: token.order_id,
                        email: userEmail,
                        expired: now + durationMinutes * 60,
                        product: token.product,
                        machine_id: cleanNewHwid,
                        created: now,
                        duration: durationMinutes,
                        label: token.product
                    }
                });
            }

            // 4. Update token_device_activation status
            await prisma.token_device_activation.update({
                where: { id: token.id },
                data: {
                    taked: 1,
                    taked_at: token.taked_at || now,
                    taked_ip: getClientIp(req)
                }
            });

            // 5. Insert history log
            await prisma.device_hwid_history.create({
                data: {
                    token_id: token.id,
                    order_id: token.order_id,
                    user_email: userEmail,
                    product: token.product,
                    old_hwid: currentHwid || '-',
                    new_hwid: cleanNewHwid,
                    created_at: now,
                    ip: getClientIp(req)
                }
            });

            const updatedRemaining = Math.max(0, maxChangesPerDay - (recentHistory.length + 1));

            return res.json({
                status: 'success',
                message: 'Machine ID berhasil diperbarui!',
                data: {
                    token_id: token.id,
                    product: token.product,
                    machine_id: cleanNewHwid,
                    remainingChangesToday: updatedRemaining,
                    nextAllowedTimestamp: now + cooldownDuration
                }
            });
        } catch (error) {
            console.error('API Update Machine ID Error:', error);
            return res.status(500).json({ status: 'error', message: 'Gagal memperbarui Machine ID' });
        }
    }
}

export const memberController = new MemberController();


