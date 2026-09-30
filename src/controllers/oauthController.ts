import { Request, Response } from 'express';
import OAuthService from '../services/oauthService';
import { getClientIp } from '../utils/ipHelper';
import { securityRateLimiter } from '../services/securityRateLimiter';
import prisma from '../config/prisma';

interface MemberSession {
    userId?: number;
    userName?: string;
    userEmail?: string;
    userAvatar?: string;
    isMemberAuthenticated?: boolean;
}

export class OAuthController {
    /**
     * GET /oauth/authorize
     * Entry point for OAuth 2.0 authorization code flow
     */
    /**
     * GET /oauth/authorize
     * Entry point for OAuth 2.0 authorization code flow
     */
    async handleAuthorize(req: Request, res: Response) {
        try {
            const {
                client_id,
                redirect_uri,
                response_type,
                scope,
                state,
                code_challenge,
                code_challenge_method,
            } = req.query as Record<string, string | undefined>;

            // 1. Validate mandatory parameters
            if (!client_id) {
                return res.status(400).send(this.renderErrorHtml('Invalid Request', 'Parameter client_id is required.'));
            }

            if (!redirect_uri) {
                return res.status(400).send(this.renderErrorHtml('Invalid Request', 'Parameter redirect_uri is required.'));
            }

            // 2. Validate Client
            const client = await OAuthService.getActiveClient(client_id);
            if (!client) {
                return res.status(400).send(this.renderErrorHtml('Invalid Client', 'Client ID does not exist or has been disabled.'));
            }

            // 3. Validate Redirect URI
            const isRedirectAllowed = OAuthService.validateRedirectUri(client.allowed_redirect_uris, redirect_uri);
            if (!isRedirectAllowed) {
                return res.status(400).send(this.renderErrorHtml('Unauthorized Redirect URI', 'The requested redirect_uri is not whitelisted by this application.'));
            }

            // 4. Validate response_type
            if (response_type !== 'code') {
                const redirectWithErr = `${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}error=unsupported_response_type&error_description=Only+response_type=code+is+supported${state ? `&state=${encodeURIComponent(state)}` : ''}`;
                return res.redirect(redirectWithErr);
            }

            const requestedScopes = (scope || client.allowed_scopes || 'profile email').trim();

            // 5. Redirect directly to Dedicated OAuth / SSO SPA screen
            const authParams = new URLSearchParams({
                client_id,
                redirect_uri,
                scope: requestedScopes,
                ...(state ? { state } : {}),
                ...(code_challenge ? { code_challenge } : {}),
                ...(code_challenge_method ? { code_challenge_method } : {}),
            });

            return res.redirect(`/#/oauth/authorize?${authParams.toString()}`);
        } catch (error) {
            console.error('OAuth Authorize Error:', error);
            return res.status(500).send(this.renderErrorHtml('Internal Server Error', 'An unexpected error occurred during authorization.'));
        }
    }

    /**
     * GET /oauth/api/auth-context (and alias /oauth/api/consent-details)
     * Fetches client info, session status, user profile (if logged in), and scope list for SSO screen
     */
    async getAuthContext(req: Request, res: Response) {
        try {
            const { client_id, scope, redirect_uri } = req.query as { client_id?: string; scope?: string; redirect_uri?: string };
            if (!client_id) {
                return res.status(400).json({ status: 'error', message: 'client_id is required' });
            }

            const client = await OAuthService.getActiveClient(client_id);
            if (!client) {
                return res.status(404).json({ status: 'error', message: 'Client not found or inactive' });
            }

            let isRedirectValid = true;
            if (redirect_uri) {
                isRedirectValid = OAuthService.validateRedirectUri(client.allowed_redirect_uris, redirect_uri);
            }

            const session = req.session as unknown as MemberSession;
            let isAuthenticated = false;
            let userData: any = null;

            if (session && session.isMemberAuthenticated && session.userId) {
                const user = await prisma.user.findUnique({
                    where: { id: session.userId },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatar: true,
                        verified: true,
                        banned: true
                    }
                });

                if (user && !user.banned) {
                    isAuthenticated = true;
                    userData = {
                        id: user.id,
                        name: user.name || user.email.split('@')[0],
                        email: user.email,
                        avatar: user.avatar ? (user.avatar.startsWith('http') ? user.avatar : `/uploads/${user.avatar}`) : null,
                        verified: user.verified
                    };
                } else {
                    session.isMemberAuthenticated = false;
                    session.userId = undefined;
                }
            }

            const requestedScopes = (scope || client.allowed_scopes || 'profile email').split(/\s+/).filter(Boolean);

            const scopeDescriptions: Record<string, { title: string; description: string; icon: string }> = {
                profile: {
                    title: 'Info Profil Dasar',
                    description: 'Melihat nama dan identitas akun Ziqva Anda',
                    icon: 'user',
                },
                email: {
                    title: 'Alamat Email',
                    description: 'Melihat alamat email utama akun Ziqva Anda',
                    icon: 'mail',
                },
                whatsapp: {
                    title: 'Nomor WhatsApp',
                    description: 'Melihat nomor telepon/WhatsApp yang terhubung',
                    icon: 'phone',
                },
                licenses: {
                    title: 'Lisensi & Produk',
                    description: 'Melihat status lisensi produk aktif milik Anda',
                    icon: 'shield-check',
                },
            };

            const formattedScopes = requestedScopes.map((s) => {
                return scopeDescriptions[s] || {
                    title: s.toUpperCase(),
                    description: `Akses izin untuk scope: ${s}`,
                    icon: 'key',
                };
            });

            return res.json({
                status: 'success',
                client: {
                    client_id: client.client_id,
                    name: client.name,
                    description: client.description,
                    icon_url: client.icon_url,
                    is_trusted: client.is_trusted,
                    is_redirect_valid: isRedirectValid
                },
                isAuthenticated,
                user: userData,
                scopes: formattedScopes
            });
        } catch (error) {
            console.error('OAuth Auth Context Error:', error);
            return res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }

    /**
     * Backward compatibility alias for /oauth/api/consent-details
     */
    async getConsentDetails(req: Request, res: Response) {
        return this.getAuthContext(req, res);
    }

    /**
     * POST /oauth/api/login
     * Dedicated Login Form Handler for Ziqva SSO
     */
    async handleOAuthLogin(req: Request, res: Response) {
        try {
            const {
                email,
                password,
                client_id,
                redirect_uri,
                scopes,
                state,
                code_challenge,
                code_challenge_method
            } = req.body as {
                email?: string;
                password?: string;
                client_id: string;
                redirect_uri: string;
                scopes?: string;
                state?: string;
                code_challenge?: string;
                code_challenge_method?: string;
            };

            if (!client_id || !redirect_uri) {
                return res.status(400).json({ status: 'error', message: 'Parameter client_id dan redirect_uri wajib diisi' });
            }

            if (!email || !password) {
                return res.status(400).json({ status: 'error', message: 'Email dan kata sandi wajib diisi' });
            }

            const client = await OAuthService.getActiveClient(client_id);
            if (!client) {
                return res.status(400).json({ status: 'error', message: 'Aplikasi klien tidak ditemukan atau telah dinonaktifkan' });
            }

            if (!OAuthService.validateRedirectUri(client.allowed_redirect_uris, redirect_uri)) {
                return res.status(400).json({ status: 'error', message: 'Redirect URI tidak diizinkan oleh aplikasi ini' });
            }

            const cleanIp = getClientIp(req);
            const cleanEmail = email.trim().toLowerCase();

            // Strict Brute-Force Rate Limiting (IP & Account Lockout)
            const ipLock = securityRateLimiter.check(`oauth-login:ip:${cleanIp}`, 5, 15 * 60 * 1000);
            if (ipLock.isLocked) {
                const msg = `Terlalu banyak percobaan login gagal dari jaringan Anda. Silakan coba lagi dalam ${Math.ceil(ipLock.remainingSeconds / 60)} menit.`;
                return res.status(429).json({ status: 'error', message: msg, remainingSeconds: ipLock.remainingSeconds });
            }

            const accountLock = securityRateLimiter.check(`oauth-login:account:${cleanEmail}`, 5, 15 * 60 * 1000);
            if (accountLock.isLocked) {
                const msg = `Akun ini sementara dikunci karena terlalu banyak percobaan login yang gagal. Silakan coba lagi dalam ${Math.ceil(accountLock.remainingSeconds / 60)} menit.`;
                return res.status(429).json({ status: 'error', message: msg, remainingSeconds: accountLock.remainingSeconds });
            }

            // Find user
            const user = await prisma.user.findFirst({
                where: { email: cleanEmail },
            });

            if (!user || user.password !== password) {
                const ipFail = securityRateLimiter.recordFailure(`oauth-login:ip:${cleanIp}`, 5, 15 * 60 * 1000);
                const accountFail = securityRateLimiter.recordFailure(`oauth-login:account:${cleanEmail}`, 5, 15 * 60 * 1000);
                const remaining = Math.min(ipFail.attemptsLeft, accountFail.attemptsLeft);
                const errMsg = remaining > 0
                    ? `Email atau kata sandi tidak valid. Sisa kesempatan: ${remaining}x.`
                    : `Terlalu banyak percobaan gagal. Akses login dibatasi selama 15 menit.`;

                return res.status(401).json({ status: 'error', message: errMsg, attemptsLeft: remaining });
            }

            if (!user.verified) {
                return res.status(403).json({ status: 'error', message: 'Akun Anda belum diverifikasi.' });
            }

            if (user.banned) {
                return res.status(403).json({ status: 'error', message: 'Akun Anda telah dinonaktifkan (banned).' });
            }

            // Clear failure counters on successful login
            securityRateLimiter.clear(`oauth-login:ip:${cleanIp}`);
            securityRateLimiter.clear(`oauth-login:account:${cleanEmail}`);

            // Set member session
            const session = req.session as unknown as MemberSession;
            session.userId = user.id;
            session.userName = user.name || user.email;
            session.userEmail = user.email;
            session.userAvatar = user.avatar || undefined;
            session.isMemberAuthenticated = true;

            const requestedScopes = (scopes || client.allowed_scopes || 'profile email').trim();
            const hasConsent = await OAuthService.checkUserConsent(user.id, client_id, requestedScopes);

            const userSummary = {
                id: user.id,
                name: user.name || user.email.split('@')[0],
                email: user.email,
                avatar: user.avatar ? (user.avatar.startsWith('http') ? user.avatar : `/uploads/${user.avatar}`) : null,
                verified: user.verified
            };

            if (client.is_trusted || hasConsent) {
                // Generate authorization code immediately
                const code = await OAuthService.createAuthorizationCode({
                    clientId: client_id,
                    userId: user.id,
                    redirectUri: redirect_uri,
                    scopes: requestedScopes,
                    codeChallenge: code_challenge || null,
                    codeChallengeMethod: code_challenge_method || null,
                });

                const redirectSuccess = `${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
                return res.json({
                    status: 'success',
                    redirect_to: redirectSuccess,
                    user: userSummary
                });
            }

            // If untrusted and no prior consent, prompt user to confirm consent
            return res.json({
                status: 'success',
                requires_consent: true,
                user: userSummary
            });
        } catch (error) {
            console.error('OAuth Login Error:', error);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem saat memproses login.' });
        }
    }

    /**
     * POST /oauth/api/logout-current
     * Clears current SSO session so user can sign in with another account
     */
    handleOAuthLogout(req: Request, res: Response) {
        try {
            const session = req.session as unknown as MemberSession;
            if (session) {
                session.userId = undefined;
                session.userName = undefined;
                session.userEmail = undefined;
                session.userAvatar = undefined;
                session.isMemberAuthenticated = false;
            }
            return res.json({ status: 'success', message: 'Berhasil keluar dari sesi SSO' });
        } catch (error) {
            console.error('OAuth Logout Error:', error);
            return res.status(500).json({ status: 'error', message: 'Terjadi kesalahan sistem' });
        }
    }

    /**
     * GET /oauth/logout or POST /oauth/logout
     * Global SSO Logout / End Session Endpoint with redirect_uri
     */
    handleOAuthLogoutRedirect(req: Request, res: Response) {
        try {
            const { redirect_uri, post_logout_redirect_uri } = (req.method === 'POST' ? req.body : req.query) as { redirect_uri?: string; post_logout_redirect_uri?: string };
            const targetUri = redirect_uri || post_logout_redirect_uri;

            const session = req.session as unknown as MemberSession;
            if (session) {
                session.userId = undefined;
                session.userName = undefined;
                session.userEmail = undefined;
                session.userAvatar = undefined;
                session.isMemberAuthenticated = false;
            }

            if (req.session) {
                req.session.destroy(() => {
                    res.clearCookie('connect.sid', { path: '/' });
                    if (targetUri && typeof targetUri === 'string' && (targetUri.startsWith('http://') || targetUri.startsWith('https://') || targetUri.startsWith('/'))) {
                        return res.redirect(targetUri);
                    }
                    return res.redirect('/#/member/login?logged_out=true');
                });
                return;
            }

            if (targetUri && typeof targetUri === 'string' && (targetUri.startsWith('http://') || targetUri.startsWith('https://') || targetUri.startsWith('/'))) {
                return res.redirect(targetUri);
            }
            return res.redirect('/#/member/login?logged_out=true');
        } catch (error) {
            console.error('OAuth Logout Error:', error);
            return res.redirect('/#/member/login?logged_out=true');
        }
    }

    /**
     * POST /oauth/consent/decision
     * Handles User Click on "Allow" or "Deny"
     */
    async handleConsentDecision(req: Request, res: Response) {
        try {
            const session = req.session as unknown as MemberSession;
            if (!session || !session.isMemberAuthenticated || !session.userId) {
                return res.status(401).json({ status: 'error', message: 'Unauthorized session' });
            }

            const {
                client_id,
                redirect_uri,
                scopes,
                state,
                code_challenge,
                code_challenge_method,
                allow,
            } = req.body as {
                client_id: string;
                redirect_uri: string;
                scopes?: string;
                state?: string;
                code_challenge?: string;
                code_challenge_method?: string;
                allow: boolean;
            };

            if (!client_id || !redirect_uri) {
                return res.status(400).json({ status: 'error', message: 'client_id and redirect_uri are required' });
            }

            const client = await OAuthService.getActiveClient(client_id);
            if (!client) {
                return res.status(400).json({ status: 'error', message: 'Client not found or inactive' });
            }

            if (!OAuthService.validateRedirectUri(client.allowed_redirect_uris, redirect_uri)) {
                return res.status(400).json({ status: 'error', message: 'Redirect URI is not allowed' });
            }

            if (!allow) {
                const deniedUrl = `${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}error=access_denied&error_description=User+denied+access+request${state ? `&state=${encodeURIComponent(state)}` : ''}`;
                return res.json({ status: 'success', redirect_to: deniedUrl });
            }

            const cleanScopes = scopes || 'profile email';

            // Grant consent for future requests
            await OAuthService.grantUserConsent(session.userId, client_id, cleanScopes);

            // Generate authorization code
            const code = await OAuthService.createAuthorizationCode({
                clientId: client_id,
                userId: session.userId,
                redirectUri: redirect_uri,
                scopes: cleanScopes,
                codeChallenge: code_challenge || null,
                codeChallengeMethod: code_challenge_method || null,
            });

            const successUrl = `${redirect_uri}${redirect_uri.includes('?') ? '&' : '?'}code=${encodeURIComponent(code)}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
            return res.json({ status: 'success', redirect_to: successUrl });
        } catch (error) {
            console.error('OAuth Consent Decision Error:', error);
            return res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }

    /**
     * POST /oauth/token
     * Penukaran Auth Code / Refresh Token -> Access Token
     */
    async handleToken(req: Request, res: Response) {
        try {
            // Check CORS headers for allowed client origin
            const origin = req.headers.origin;
            if (origin) {
                res.setHeader('Access-Control-Allow-Origin', origin);
                res.setHeader('Access-Control-Allow-Credentials', 'true');
            }

            const body = req.body as Record<string, string | undefined>;
            const {
                grant_type,
                client_id,
                client_secret,
                code,
                redirect_uri,
                code_verifier,
                refresh_token,
            } = body;

            if (!grant_type) {
                return res.status(400).json({
                    error: 'invalid_request',
                    error_description: 'grant_type parameter is required',
                });
            }

            if (!client_id) {
                return res.status(400).json({
                    error: 'invalid_request',
                    error_description: 'client_id parameter is required',
                });
            }

            const ip = getClientIp(req);
            const userAgent = req.headers['user-agent'] || '';

            if (grant_type === 'authorization_code') {
                if (!code) {
                    return res.status(400).json({
                        error: 'invalid_request',
                        error_description: 'code parameter is required for authorization_code grant',
                    });
                }
                if (!redirect_uri) {
                    return res.status(400).json({
                        error: 'invalid_request',
                        error_description: 'redirect_uri parameter is required for authorization_code grant',
                    });
                }

                const result = await OAuthService.exchangeAuthCode({
                    code,
                    clientId: client_id,
                    clientSecret: client_secret,
                    redirectUri: redirect_uri,
                    codeVerifier: code_verifier,
                    ip,
                    userAgent,
                });

                res.setHeader('Cache-Control', 'no-store');
                res.setHeader('Pragma', 'no-cache');
                return res.status(200).json(result);
            }

            if (grant_type === 'refresh_token') {
                if (!refresh_token) {
                    return res.status(400).json({
                        error: 'invalid_request',
                        error_description: 'refresh_token parameter is required for refresh_token grant',
                    });
                }

                const result = await OAuthService.refreshAccessToken({
                    refreshToken: refresh_token,
                    clientId: client_id,
                    clientSecret: client_secret,
                    ip,
                    userAgent,
                });

                res.setHeader('Cache-Control', 'no-store');
                res.setHeader('Pragma', 'no-cache');
                return res.status(200).json(result);
            }

            return res.status(400).json({
                error: 'unsupported_grant_type',
                error_description: `Grant type '${grant_type}' is not supported`,
            });
        } catch (error: any) {
            const errMsg = error?.message || 'Token exchange failed';
            console.error('OAuth Token Exchange Error:', errMsg);

            if (errMsg.startsWith('invalid_client')) {
                return res.status(401).json({
                    error: 'invalid_client',
                    error_description: errMsg.replace('invalid_client: ', ''),
                });
            }

            if (errMsg.startsWith('invalid_grant')) {
                return res.status(400).json({
                    error: 'invalid_grant',
                    error_description: errMsg.replace('invalid_grant: ', ''),
                });
            }

            return res.status(400).json({
                error: 'invalid_request',
                error_description: errMsg,
            });
        }
    }

    /**
     * GET /oauth/userinfo or GET /api/v1/oauth/userinfo
     */
    async handleUserInfo(req: Request, res: Response) {
        try {
            const origin = req.headers.origin;
            if (origin) {
                res.setHeader('Access-Control-Allow-Origin', origin);
                res.setHeader('Access-Control-Allow-Credentials', 'true');
            }

            const authHeader = req.headers.authorization;
            if (!authHeader) {
                return res.status(401).json({
                    error: 'invalid_token',
                    error_description: 'Missing Authorization header with Bearer token',
                });
            }

            const userInfo = await OAuthService.getUserInfoFromToken(authHeader);
            if (!userInfo) {
                return res.status(401).json({
                    error: 'invalid_token',
                    error_description: 'The access token is invalid, expired, or user account is suspended',
                });
            }

            res.setHeader('Cache-Control', 'no-store');
            return res.json(userInfo);
        } catch (error) {
            console.error('OAuth UserInfo Error:', error);
            return res.status(500).json({
                error: 'server_error',
                error_description: 'An unexpected error occurred',
            });
        }
    }

    /**
     * POST /oauth/revoke
     */
    async handleRevoke(req: Request, res: Response) {
        try {
            const { token } = req.body as { token?: string };
            if (!token) {
                return res.status(400).json({ error: 'invalid_request', error_description: 'token parameter is required' });
            }

            const revoked = await OAuthService.revokeToken(token);
            return res.json({ status: 'success', revoked });
        } catch (error) {
            console.error('OAuth Revoke Error:', error);
            return res.status(500).json({ error: 'server_error', error_description: 'Failed to revoke token' });
        }
    }

    /**
     * Render sleek error HTML for browser requests
     */
    private renderErrorHtml(title: string, message: string): string {
        return `
        <!DOCTYPE html>
        <html lang="id">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title} - Ziqva OAuth</title>
            <style>
                body {
                    margin: 0;
                    padding: 0;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
                    background: #090d16;
                    color: #e2e8f0;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    min-height: 100vh;
                }
                .card {
                    background: rgba(18, 26, 43, 0.85);
                    border: 1px solid rgba(239, 68, 68, 0.3);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.5);
                    border-radius: 16px;
                    padding: 32px;
                    max-width: 440px;
                    width: 90%;
                    text-align: center;
                    backdrop-filter: blur(12px);
                }
                .icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 50%;
                    background: rgba(239, 68, 68, 0.15);
                    color: #ef4444;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 28px;
                    margin: 0 auto 16px;
                }
                h1 {
                    font-size: 20px;
                    font-weight: 700;
                    margin-bottom: 8px;
                    color: #f87171;
                }
                p {
                    font-size: 14px;
                    color: #94a3b8;
                    line-height: 1.6;
                    margin-bottom: 24px;
                }
                .btn {
                    display: inline-block;
                    background: #2563eb;
                    color: white;
                    text-decoration: none;
                    padding: 10px 20px;
                    border-radius: 8px;
                    font-weight: 600;
                    font-size: 14px;
                    transition: background 0.2s;
                }
                .btn:hover {
                    background: #1d4ed8;
                }
            </style>
        </head>
        <body>
            <div class="card">
                <div class="icon">⚠️</div>
                <h1>${title}</h1>
                <p>${message}</p>
                <a href="/" class="btn">Kembali ke AppCenter</a>
            </div>
        </body>
        </html>
        `;
    }
}

export const oauthController = new OAuthController();
export default oauthController;
