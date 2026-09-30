import nodemailer from 'nodemailer';
import prisma from '../config/prisma';

export interface SmtpConfig {
    id?: number;
    host: string;
    port: number;
    secure: boolean;
    encryption: 'none' | 'tls' | 'ssl';
    username: string;
    password: string;
    from_email: string;
    from_name: string;
    reply_to?: string | null;
    is_active: boolean;
    require_auth: boolean;
}

/**
 * Retrieve active SMTP configuration from database or fallback to environment variables
 */
export async function getSmtpConfig(): Promise<SmtpConfig> {
    try {
        const settings = await prisma.smtp_settings.findFirst({
            orderBy: { id: 'desc' },
        });

        if (settings) {
            return {
                id: settings.id,
                host: settings.host || process.env.SMTP_HOST || process.env.MAIL_HOST || '',
                port: settings.port || parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587', 10),
                secure: settings.secure ?? (settings.port === 465 || settings.encryption === 'ssl'),
                encryption: (settings.encryption as 'none' | 'tls' | 'ssl') || 'tls',
                username: settings.username || process.env.SMTP_USER || process.env.MAIL_USER || '',
                password: settings.password || process.env.SMTP_PASS || process.env.MAIL_PASS || '',
                from_email: settings.from_email || process.env.SMTP_FROM_EMAIL || process.env.MAIL_FROM_ADDRESS || 'noreply@ziqva.com',
                from_name: settings.from_name || process.env.SMTP_FROM_NAME || process.env.MAIL_FROM_NAME || 'AppCenter - Ziqva Labs',
                reply_to: settings.reply_to || process.env.SMTP_REPLY_TO || null,
                is_active: settings.is_active ?? true,
                require_auth: settings.require_auth ?? true,
            };
        }
    } catch (err) {
        console.error('[EmailService] Failed to load SMTP settings from DB:', err);
    }

    // Default fallback from ENV
    const port = parseInt(process.env.SMTP_PORT || process.env.MAIL_PORT || '587', 10);
    const encryption = port === 465 ? 'ssl' : (port === 587 ? 'tls' : 'none');
    return {
        host: process.env.SMTP_HOST || process.env.MAIL_HOST || '',
        port,
        secure: port === 465,
        encryption,
        username: process.env.SMTP_USER || process.env.MAIL_USER || '',
        password: process.env.SMTP_PASS || process.env.MAIL_PASS || '',
        from_email: process.env.SMTP_FROM_EMAIL || process.env.MAIL_FROM_ADDRESS || 'noreply@ziqva.com',
        from_name: process.env.SMTP_FROM_NAME || process.env.MAIL_FROM_NAME || 'AppCenter - Ziqva Labs',
        reply_to: process.env.SMTP_REPLY_TO || null,
        is_active: process.env.SMTP_IS_ACTIVE !== 'false',
        require_auth: true,
    };
}

/**
 * Creates a nodemailer Transporter using given or stored SMTP config
 */
export function createTransporterFromConfig(config: SmtpConfig) {
    const isSecure = config.secure || config.port === 465 || config.encryption === 'ssl';

    const transportOptions: nodemailer.TransportOptions = {
        host: config.host,
        port: config.port,
        secure: isSecure,
        auth: config.require_auth && config.username ? {
            user: config.username,
            pass: config.password,
        } : undefined,
        tls: {
            rejectUnauthorized: false,
        },
    } as any;

    return nodemailer.createTransport(transportOptions);
}

/**
 * Verify SMTP connection and optionally send a test email
 */
export async function testSmtpConnection(overrideConfig?: Partial<SmtpConfig>, testRecipientEmail?: string): Promise<{ success: boolean; message: string; details?: any }> {
    const activeConfig = await getSmtpConfig();
    const config: SmtpConfig = {
        ...activeConfig,
        ...(overrideConfig || {}),
    };

    if (!config.host) {
        throw new Error('Host SMTP belum diisi.');
    }
    if (!config.port) {
        throw new Error('Port SMTP belum diisi.');
    }

    const transporter = createTransporterFromConfig(config);

    // 1. Verify connection handshake & authentication
    await transporter.verify();

    // 2. If recipient email is provided, send test email
    if (testRecipientEmail) {
        const testHtml = getTestEmailTemplate(config.from_name, config.from_email, new Date().toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }));
        const info = await transporter.sendMail({
            from: `"${config.from_name}" <${config.from_email}>`,
            to: testRecipientEmail,
            subject: `Uji Coba Pengiriman Email - ${config.from_name}`,
            html: testHtml,
            text: `Uji coba koneksi SMTP ${config.from_name} berhasil terverifikasi. Email ini dikirimkan ke ${testRecipientEmail}.`,
            replyTo: config.reply_to || undefined,
        });

        return {
            success: true,
            message: `Koneksi SMTP berhasil & email uji coba telah terkirim ke ${testRecipientEmail}.`,
            details: { messageId: info.messageId, response: info.response },
        };
    }

    return {
        success: true,
        message: 'Koneksi dan autentikasi SMTP berhasil diverifikasi.',
    };
}

export interface SendMailOptions {
    to: string;
    subject: string;
    html: string;
    text?: string;
    replyTo?: string;
}

/**
 * High-level send email function that loads active SMTP settings and dispatches message
 */
export async function sendEmail(options: SendMailOptions): Promise<{ success: boolean; messageId?: string }> {
    const config = await getSmtpConfig();

    if (!config.is_active) {
        throw new Error('Layanan pengiriman email (SMTP) sedang dinonaktifkan oleh Administrator.');
    }
    if (!config.host || !config.from_email) {
        throw new Error('Konfigurasi SMTP belum lengkap. Silakan atur Host dan From Email di Pengaturan Admin.');
    }

    const transporter = createTransporterFromConfig(config);

    // Clean plain text fallback if text is not provided
    const cleanText = options.text || options.html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const info = await transporter.sendMail({
        from: `"${config.from_name}" <${config.from_email}>`,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: cleanText,
        replyTo: options.replyTo || config.reply_to || undefined,
        headers: {
            'X-Priority': '1 (Highest)',
            'X-MSMail-Priority': 'High',
            'Importance': 'High',
        }
    });

    return {
        success: true,
        messageId: info.messageId,
    };
}

// =======================================================
// CLEAN LIGHT-THEMED PROFESSIONAL HTML EMAIL TEMPLATES
// =======================================================

const EMAIL_BODY_STYLE = `
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    background-color: #f1f5f9;
    color: #334155;
    margin: 0;
    padding: 0;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    line-height: 1.6;
`;

/**
 * Helper to render clean standard header
 */
function renderEmailHeader(categoryName = 'Pemberitahuan Sistem'): string {
    return `
        <tr>
            <td style="padding: 28px 32px 20px 32px; border-bottom: 1px solid #f1f5f9; background-color: #ffffff;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td align="left" style="vertical-align: middle;">
                            <div style="font-size: 17px; font-weight: 800; color: #0f172a; letter-spacing: -0.02em;">
                                AppCenter <span style="font-weight: 500; color: #64748b; font-size: 13px;">by Ziqva Labs</span>
                            </div>
                        </td>
                        <td align="right" style="vertical-align: middle;">
                            <span style="display: inline-block; font-size: 11px; font-weight: 600; color: #475569; background-color: #f1f5f9; padding: 4px 10px; border-radius: 6px; letter-spacing: 0.02em;">
                                ${categoryName}
                            </span>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    `;
}

/**
 * Helper to render clean standard footer
 */
function renderEmailFooter(): string {
    return `
        <tr>
            <td style="padding: 24px 32px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center;">
                <p style="color: #64748b; font-size: 12px; margin: 0 0 6px 0; line-height: 1.5;">
                    Email ini dikirim secara otomatis oleh sistem AppCenter Ziqva Labs.
                </p>
                <p style="color: #94a3b8; font-size: 11px; margin: 0;">
                    © ${new Date().getFullYear()} Ziqva Labs. Seluruh hak cipta dilindungi undang-undang.
                </p>
            </td>
        </tr>
    `;
}

/**
 * 1. Registration OTP Verification Email Template
 */
export function getRegisterOtpTemplate(name: string, otp: string, expiryMinutes = 10): string {
    const safeName = name ? name.trim() : 'Pengguna';
    return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kode Verifikasi Pendaftaran</title>
</head>
<body style="${EMAIL_BODY_STYLE}">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
                    ${renderEmailHeader('Verifikasi Pendaftaran')}

                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px 32px 28px 32px; background-color: #ffffff;">
                            <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.3;">
                                Verifikasi Alamat Email Anda
                            </h2>
                            <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0; line-height: 1.6;">
                                Halo <strong>${safeName}</strong>,<br>
                                Terima kasih telah mendaftar di AppCenter. Gunakan 6 digit kode One-Time Password (OTP) di bawah ini untuk memverifikasi akun Anda:
                            </p>

                            <!-- OTP Box -->
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                                    Kode Verifikasi OTP
                                </div>
                                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 0.25em; color: #0f172a; padding-left: 0.25em; margin: 6px 0;">
                                    ${otp}
                                </div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                    Kode berlaku selama <strong>${expiryMinutes} menit</strong>
                                </div>
                            </div>

                            <div style="border-left: 3px solid #cbd5e1; padding-left: 14px; margin: 20px 0 0 0;">
                                <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 6px 0;">
                                    <strong>Peringatan Keamanan:</strong> Jangan berikan kode ini kepada siapa pun, termasuk pihak yang mengaku sebagai staf kami.
                                </p>
                                <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                                    Jika Anda tidak merasa melakukan pendaftaran, Anda dapat mengabaikan email ini dengan aman.
                                </p>
                            </div>
                        </td>
                    </tr>

                    ${renderEmailFooter()}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * 2. Reset Password OTP Email Template
 */
export function getResetPasswordOtpTemplate(name: string, otp: string, expiryMinutes = 15): string {
    const safeName = name ? name.trim() : 'Pengguna';
    return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Permintaan Reset Kata Sandi</title>
</head>
<body style="${EMAIL_BODY_STYLE}">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
                    ${renderEmailHeader('Pemulihan Akun')}

                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px 32px 28px 32px; background-color: #ffffff;">
                            <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.3;">
                                Permintaan Reset Kata Sandi
                            </h2>
                            <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0; line-height: 1.6;">
                                Halo <strong>${safeName}</strong>,<br>
                                Kami menerima permintaan untuk mengatur ulang kata sandi akun AppCenter Anda. Masukkan 6 digit kode OTP berikut pada halaman pemulihan kata sandi:
                            </p>

                            <!-- OTP Box -->
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                                    Kode OTP Reset Kata Sandi
                                </div>
                                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 0.25em; color: #0f172a; padding-left: 0.25em; margin: 6px 0;">
                                    ${otp}
                                </div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                    Kode berlaku selama <strong>${expiryMinutes} menit</strong>
                                </div>
                            </div>

                            <div style="border-left: 3px solid #cbd5e1; padding-left: 14px; margin: 20px 0 0 0;">
                                <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 6px 0;">
                                    <strong>Penting:</strong> Jangan berikan kode ini kepada orang lain.
                                </p>
                                <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                                    Jika Anda tidak merasa mengajukan permintaan ini, silakan abaikan email ini. Kata sandi akun Anda tetap aman.
                                </p>
                            </div>
                        </td>
                    </tr>

                    ${renderEmailFooter()}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * 3. Password Changed Confirmation Alert Template
 */
export function getPasswordChangedTemplate(name: string, timeStr: string, ipAddress?: string): string {
    const safeName = name ? name.trim() : 'Pengguna';
    return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kata Sandi Berhasil Diubah</title>
</head>
<body style="${EMAIL_BODY_STYLE}">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
                    ${renderEmailHeader('Keamanan Akun')}

                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px 32px 28px 32px; background-color: #ffffff;">
                            <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.3;">
                                Kata Sandi Anda Berhasil Diubah
                            </h2>
                            <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0; line-height: 1.6;">
                                Halo <strong>${safeName}</strong>,<br>
                                Kata sandi untuk akun AppCenter Anda telah berhasil diperbarui. Berikut adalah ringkasan informasinya:
                            </p>

                            <!-- Details Table -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; width: 130px;">Waktu Perubahan</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600;">${timeStr}</td>
                                </tr>
                                ${ipAddress ? `
                                <tr>
                                    <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Alamat IP</td>
                                    <td style="padding: 12px 16px; font-size: 13px; color: #0f172a; font-family: monospace;">${ipAddress}</td>
                                </tr>
                                ` : ''}
                            </table>

                            <p style="font-size: 12px; color: #dc2626; line-height: 1.5; margin: 0;">
                                Jika Anda tidak melakukan perubahan ini, segera hubungi tim administrator kami untuk mengamankan akun Anda.
                            </p>
                        </td>
                    </tr>

                    ${renderEmailFooter()}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * 4. Admin PIN Reset OTP Email Template
 */
export function getAdminResetPinOtpTemplate(username: string, otp: string, expiryMinutes = 10): string {
    const safeName = username ? username.trim() : 'Administrator';
    return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Kode Verifikasi Reset PIN Administrator</title>
</head>
<body style="${EMAIL_BODY_STYLE}">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
                    ${renderEmailHeader('Keamanan Administrator')}

                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px 32px 28px 32px; background-color: #ffffff;">
                            <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.3;">
                                Verifikasi Reset PIN Administrator
                            </h2>
                            <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0; line-height: 1.6;">
                                Halo <strong>${safeName}</strong>,<br>
                                Sistem menerima permintaan untuk mereset PIN keamanan akun Administrator Anda. Masukkan 6 digit kode OTP berikut pada panel login admin untuk melanjutkan pembuatan PIN baru:
                            </p>

                            <!-- OTP Box -->
                            <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; text-align: center; margin: 24px 0;">
                                <div style="font-size: 11px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 6px;">
                                    Kode OTP Keamanan Admin
                                </div>
                                <div style="font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace; font-size: 34px; font-weight: 800; letter-spacing: 0.25em; color: #0f172a; padding-left: 0.25em; margin: 6px 0;">
                                    ${otp}
                                </div>
                                <div style="font-size: 12px; color: #64748b; margin-top: 6px;">
                                    Kode berlaku selama <strong>${expiryMinutes} menit</strong>
                                </div>
                            </div>

                            <div style="border-left: 3px solid #cbd5e1; padding-left: 14px; margin: 20px 0 0 0;">
                                <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin: 0 0 6px 0;">
                                    <strong>Peringatan Keamanan:</strong> Kode verifikasi ini bersifat rahasia dan memberikan akses untuk mengubah PIN admin. Jangan pernah membagikannya kepada siapa pun.
                                </p>
                                <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                                    Jika Anda tidak merasa melakukan permintaan ini, segera amankan akses server Anda.
                                </p>
                            </div>
                        </td>
                    </tr>

                    ${renderEmailFooter()}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}

/**
 * 5. Test Email Template for Admin Connection Testing
 */
export function getTestEmailTemplate(appName: string, senderEmail: string, testTime: string): string {
    return `
<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Uji Coba Pengiriman Email</title>
</head>
<body style="${EMAIL_BODY_STYLE}">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f1f5f9; padding: 32px 16px;">
        <tr>
            <td align="center">
                <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 560px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05);">
                    ${renderEmailHeader('Uji Coba Server')}

                    <!-- Content -->
                    <tr>
                        <td style="padding: 32px 32px 28px 32px; background-color: #ffffff;">
                            <div style="display: inline-block; padding: 4px 12px; background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 6px; margin-bottom: 14px;">
                                <span style="font-size: 12px; font-weight: 600; color: #16a34a;">Koneksi SMTP Berhasil</span>
                            </div>

                            <h2 style="font-size: 18px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; line-height: 1.3;">
                                Pengaturan Email Berfungsi dengan Baik
                            </h2>
                            <p style="font-size: 14px; color: #475569; margin: 0 0 20px 0; line-height: 1.6;">
                                Halo Administrator,<br>
                                Ini adalah pesan uji coba dari sistem <strong>${appName}</strong> untuk memverifikasi bahwa server mail (SMTP) Anda telah terkonfigurasi dengan benar. Sistem siap digunakan untuk mengirimkan email verifikasi pendaftaran, reset kata sandi, dan kode OTP.
                            </p>

                            <!-- Details Table -->
                            <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; margin: 20px 0;">
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b; width: 130px;">Email Pengirim</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600;">${senderEmail}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Nama Pengirim</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a; font-weight: 600;">${appName}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #64748b;">Waktu Pengiriman</td>
                                    <td style="padding: 12px 16px; border-bottom: 1px solid #e2e8f0; font-size: 13px; color: #0f172a;">${testTime}</td>
                                </tr>
                                <tr>
                                    <td style="padding: 12px 16px; font-size: 13px; color: #64748b;">Status Koneksi</td>
                                    <td style="padding: 12px 16px; font-size: 13px; color: #16a34a; font-weight: 600;">Terverifikasi &amp; Aktif</td>
                                </tr>
                            </table>

                            <p style="font-size: 12px; color: #94a3b8; line-height: 1.5; margin: 0;">
                                Anda menerima email ini karena tombol uji coba koneksi SMTP ditekan pada panel admin.
                            </p>
                        </td>
                    </tr>

                    ${renderEmailFooter()}
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
    `.trim();
}
