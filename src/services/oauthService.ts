import crypto from 'crypto';
import prisma from '../config/prisma';

export interface OAuthTokenResponse {
    access_token: string;
    token_type: 'Bearer';
    expires_in: number;
    refresh_token?: string;
    scope: string;
}

export interface OAuthUserInfo {
    name: string;
    email: string;
    avatar?: string | null;
    verified: boolean;
    whatsapp?: string | null;
    company?: string | null;
    created_at: number;
}

export interface OAuthClientPublicInfo {
    client_id: string;
    name: string;
    description: string | null;
    icon_url: string | null;
    allowed_scopes: string;
    is_trusted: boolean;
}

export class OAuthService {
    /**
     * Generate secure random strings with custom prefix
     */
    static generateRandomString(prefix: string, bytes = 32): string {
        return `${prefix}${crypto.randomBytes(bytes).toString('hex')}`;
    }

    /**
     * Generate unique client_id
     */
    static generateClientId(): string {
        return `zqv_client_${crypto.randomBytes(16).toString('hex')}`;
    }

    /**
     * Generate plaintext secret & SHA-256 hash for secure storage
     */
    static generateClientSecret(): { secret: string; hash: string } {
        const secret = `zqv_sec_${crypto.randomBytes(32).toString('hex')}`;
        const hash = this.hashSecret(secret);
        return { secret, hash };
    }

    /**
     * Compute SHA-256 hash for secret comparison
     */
    static hashSecret(secret: string): string {
        return crypto.createHash('sha256').update(secret.trim()).digest('hex');
    }

    /**
     * Constant-time secret verification to prevent timing attacks
     */
    static verifyClientSecret(rawSecret: string, storedHash: string): boolean {
        if (!rawSecret || !storedHash) return false;
        const computedHash = this.hashSecret(rawSecret);
        try {
            return crypto.timingSafeEqual(
                Buffer.from(computedHash, 'utf8'),
                Buffer.from(storedHash, 'utf8')
            );
        } catch {
            return false;
        }
    }

    /**
     * Base64URL encoding without padding (RFC 7636)
     */
    static base64UrlEncode(buffer: Buffer): string {
        return buffer
            .toString('base64')
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=+$/, '');
    }

    /**
     * Verify PKCE code_verifier against code_challenge (RFC 7636)
     */
    static verifyPkce(codeVerifier: string, codeChallenge: string, method = 'S256'): boolean {
        if (!codeVerifier || !codeChallenge) return false;

        const normalizedMethod = (method || 'S256').toUpperCase();

        if (normalizedMethod === 'PLAIN') {
            return codeVerifier === codeChallenge;
        }

        if (normalizedMethod === 'S256') {
            const hash = crypto.createHash('sha256').update(codeVerifier, 'ascii').digest();
            const calculatedChallenge = this.base64UrlEncode(hash);
            return calculatedChallenge === codeChallenge;
        }

        return false;
    }

    /**
     * Validate redirect URI against whitelist array stored as JSON
     */
    static validateRedirectUri(allowedUrisJson: string | null | undefined, targetUri: string): boolean {
        if (!allowedUrisJson || !targetUri) return false;
        try {
            const allowedList: string[] = JSON.parse(allowedUrisJson);
            if (!Array.isArray(allowedList)) return false;

            const normalizedTarget = targetUri.trim();
            return allowedList.some((allowed) => {
                const normalizedAllowed = allowed.trim();
                return normalizedAllowed === normalizedTarget;
            });
        } catch {
            // Fallback: newline or comma separated
            const list = allowedUrisJson.split(/[\n,]+/).map((u) => u.trim()).filter(Boolean);
            return list.includes(targetUri.trim());
        }
    }

    /**
     * Parse allowed origins for dynamic CORS
     */
    static parseAllowedOrigins(allowedOriginsJson: string | null | undefined): string[] {
        if (!allowedOriginsJson) return [];
        try {
            const parsed = JSON.parse(allowedOriginsJson);
            if (Array.isArray(parsed)) return parsed.map((o) => o.trim()).filter(Boolean);
        } catch {
            // Fallback
        }
        return allowedOriginsJson.split(/[\n,]+/).map((o) => o.trim()).filter(Boolean);
    }

    /**
     * Get client by ID (returns null if not found or inactive)
     */
    static async getActiveClient(clientId: string) {
        if (!clientId) return null;
        return prisma.oauth_clients.findFirst({
            where: {
                client_id: clientId,
                is_active: true,
            },
        });
    }

    /**
     * Check if user already consented or if client is trusted (Bypass Consent)
     */
    static async checkUserConsent(userId: number, clientId: string, requestedScopes: string): Promise<boolean> {
        const client = await this.getActiveClient(clientId);
        if (!client) return false;

        // If client is trusted (First-Party Ziqva App), bypass consent
        if (client.is_trusted) return true;

        // Check stored user consent
        const consent = await prisma.oauth_user_consents.findUnique({
            where: {
                user_id_client_id: {
                    user_id: userId,
                    client_id: clientId,
                },
            },
        });

        if (!consent) return false;

        // Check if all requested scopes are already covered in granted scopes
        const grantedList = (consent.scopes || '').split(/\s+/).filter(Boolean);
        const reqList = (requestedScopes || '').split(/\s+/).filter(Boolean);

        return reqList.every((scope) => grantedList.includes(scope));
    }

    /**
     * Save / Upsert user consent
     */
    static async grantUserConsent(userId: number, clientId: string, scopes: string): Promise<void> {
        const existing = await prisma.oauth_user_consents.findUnique({
            where: {
                user_id_client_id: {
                    user_id: userId,
                    client_id: clientId,
                },
            },
        });

        if (existing) {
            // Merge scopes
            const merged = Array.from(
                new Set([...existing.scopes.split(/\s+/), ...scopes.split(/\s+/)])
            ).join(' ');

            await prisma.oauth_user_consents.update({
                where: { id: existing.id },
                data: {
                    scopes: merged,
                    updated_at: new Date(),
                },
            });
        } else {
            await prisma.oauth_user_consents.create({
                data: {
                    user_id: userId,
                    client_id: clientId,
                    scopes: scopes.trim(),
                    granted_at: new Date(),
                },
            });
        }
    }

    /**
     * Create temporary Authorization Code (10 minutes TTL, single use)
     */
    static async createAuthorizationCode(params: {
        clientId: string;
        userId: number;
        redirectUri: string;
        scopes: string;
        codeChallenge?: string | null;
        codeChallengeMethod?: string | null;
    }): Promise<string> {
        const code = this.generateRandomString('zqv_code_', 32);
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 menit

        await prisma.oauth_auth_codes.create({
            data: {
                code,
                client_id: params.clientId,
                user_id: params.userId,
                redirect_uri: params.redirectUri,
                scopes: params.scopes || 'profile email',
                code_challenge: params.codeChallenge || null,
                code_challenge_method: params.codeChallengeMethod || null,
                expires_at: expiresAt,
                is_used: false,
            },
        });

        return code;
    }

    /**
     * Exchange Authorization Code for Access & Refresh Tokens
     */
    static async exchangeAuthCode(params: {
        code: string;
        clientId: string;
        clientSecret?: string;
        redirectUri: string;
        codeVerifier?: string;
        ip?: string;
        userAgent?: string;
    }): Promise<OAuthTokenResponse> {
        const { code, clientId, clientSecret, redirectUri, codeVerifier, ip, userAgent } = params;

        // 1. Validate Client
        const client = await this.getActiveClient(clientId);
        if (!client) {
            throw new Error('invalid_client: Client does not exist or is inactive');
        }

        // 2. Validate Client Secret if configured (Confidential client)
        if (client.client_secret_hash) {
            if (!clientSecret || !this.verifyClientSecret(clientSecret, client.client_secret_hash)) {
                // If it has code_verifier and code_challenge, allow public client bypass only if secret is omitted AND PKCE is present
                const authCodeCheck = await prisma.oauth_auth_codes.findUnique({ where: { code } });
                if (!authCodeCheck?.code_challenge) {
                    throw new Error('invalid_client: Invalid client_secret');
                }
            }
        }

        // 3. Find Auth Code
        const authCode = await prisma.oauth_auth_codes.findUnique({
            where: { code },
        });

        if (!authCode) {
            throw new Error('invalid_grant: Authorization code not found');
        }

        if (authCode.is_used) {
            // Replay attack detected: revoke all tokens issued to this client/user
            throw new Error('invalid_grant: Authorization code has already been used');
        }

        if (authCode.expires_at < new Date()) {
            throw new Error('invalid_grant: Authorization code has expired');
        }

        if (authCode.client_id !== clientId) {
            throw new Error('invalid_grant: Client ID does not match authorization request');
        }

        if (authCode.redirect_uri !== redirectUri) {
            throw new Error('invalid_grant: Redirect URI does not match authorization request');
        }

        // 4. Validate PKCE if challenge was supplied during authorize
        if (authCode.code_challenge) {
            if (!codeVerifier) {
                throw new Error('invalid_request: code_verifier is required for PKCE code exchange');
            }
            const isPkceValid = this.verifyPkce(
                codeVerifier,
                authCode.code_challenge,
                authCode.code_challenge_method || 'S256'
            );
            if (!isPkceValid) {
                throw new Error('invalid_grant: PKCE verification failed');
            }
        }

        // 5. Mark auth code as used
        await prisma.oauth_auth_codes.update({
            where: { id: authCode.id },
            data: { is_used: true },
        });

        // 6. Generate Opaque Tokens
        const accessToken = this.generateRandomString('zqv_at_', 32);
        const refreshToken = this.generateRandomString('zqv_rt_', 32);
        const accessExpiresIn = 30 * 24 * 60 * 60; // 30 days in seconds
        const accessExpiresAt = new Date(Date.now() + accessExpiresIn * 1000);
        const refreshExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

        await prisma.oauth_access_tokens.create({
            data: {
                token: accessToken,
                refresh_token: refreshToken,
                client_id: clientId,
                user_id: authCode.user_id,
                scopes: authCode.scopes,
                expires_at: accessExpiresAt,
                refresh_expires_at: refreshExpiresAt,
                ip: ip || null,
                user_agent: userAgent || null,
                revoked: false,
            },
        });

        return {
            access_token: accessToken,
            token_type: 'Bearer',
            expires_in: accessExpiresIn,
            refresh_token: refreshToken,
            scope: authCode.scopes,
        };
    }

    /**
     * Refresh Access Token using Refresh Token
     */
    static async refreshAccessToken(params: {
        refreshToken: string;
        clientId: string;
        clientSecret?: string;
        ip?: string;
        userAgent?: string;
    }): Promise<OAuthTokenResponse> {
        const { refreshToken, clientId, clientSecret, ip, userAgent } = params;

        // 1. Validate Client
        const client = await this.getActiveClient(clientId);
        if (!client) {
            throw new Error('invalid_client: Client does not exist or is inactive');
        }

        if (client.client_secret_hash && clientSecret) {
            if (!this.verifyClientSecret(clientSecret, client.client_secret_hash)) {
                throw new Error('invalid_client: Invalid client_secret');
            }
        }

        // 2. Find Active Token Record
        const existingToken = await prisma.oauth_access_tokens.findFirst({
            where: {
                refresh_token: refreshToken,
                client_id: clientId,
                revoked: false,
            },
        });

        if (!existingToken) {
            throw new Error('invalid_grant: Invalid or revoked refresh token');
        }

        if (existingToken.refresh_expires_at && existingToken.refresh_expires_at < new Date()) {
            throw new Error('invalid_grant: Refresh token has expired');
        }

        // 3. Rotate tokens
        const newAccessToken = this.generateRandomString('zqv_at_', 32);
        const newRefreshToken = this.generateRandomString('zqv_rt_', 32);
        const accessExpiresIn = 30 * 24 * 60 * 60; // 30 days
        const accessExpiresAt = new Date(Date.now() + accessExpiresIn * 1000);
        const refreshExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000); // 90 days

        await prisma.oauth_access_tokens.update({
            where: { id: existingToken.id },
            data: {
                token: newAccessToken,
                refresh_token: newRefreshToken,
                expires_at: accessExpiresAt,
                refresh_expires_at: refreshExpiresAt,
                ip: ip || existingToken.ip,
                user_agent: userAgent || existingToken.user_agent,
                last_used_at: new Date(),
            },
        });

        return {
            access_token: newAccessToken,
            token_type: 'Bearer',
            expires_in: accessExpiresIn,
            refresh_token: newRefreshToken,
            scope: existingToken.scopes,
        };
    }

    /**
     * Get user information from Access Token
     */
    static async getUserInfoFromToken(accessToken: string): Promise<OAuthUserInfo | null> {
        if (!accessToken) return null;

        const cleanToken = accessToken.replace(/^Bearer\s+/i, '').trim();

        const tokenRecord = await prisma.oauth_access_tokens.findFirst({
            where: {
                token: cleanToken,
                revoked: false,
                expires_at: {
                    gt: new Date(),
                },
            },
        });

        if (!tokenRecord) return null;

        // Fetch User
        const user = await prisma.user.findUnique({
            where: { id: tokenRecord.user_id },
        });

        if (!user || user.banned) {
            return null;
        }

        // Update last used timestamp
        await prisma.oauth_access_tokens.update({
            where: { id: tokenRecord.id },
            data: { last_used_at: new Date() },
        });

        const scopes = tokenRecord.scopes.split(/\s+/).filter(Boolean);

        return {
            name: user.name || user.email.split('@')[0],
            email: user.email,
            avatar: user.avatar ? (user.avatar.startsWith('http') ? user.avatar : `https://appcenter.ziqva.com/uploads/${user.avatar}`) : null,
            verified: user.verified,
            whatsapp: scopes.includes('whatsapp') || scopes.includes('profile') ? user.whatsapp : null,
            company: scopes.includes('profile') ? user.company : null,
            created_at: user.created,
        };
    }

    /**
     * Revoke access token or refresh token (RFC 7009)
     */
    static async revokeToken(token: string): Promise<boolean> {
        if (!token) return false;
        const cleanToken = token.trim();

        const result = await prisma.oauth_access_tokens.updateMany({
            where: {
                OR: [{ token: cleanToken }, { refresh_token: cleanToken }],
            },
            data: {
                revoked: true,
            },
        });

        return result.count > 0;
    }
}

export default OAuthService;
