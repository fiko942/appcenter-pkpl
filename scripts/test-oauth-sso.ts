import crypto from 'crypto';
import prisma from '../src/config/prisma';
import OAuthService from '../src/services/oauthService';

function base64UrlEncode(buffer: Buffer): string {
    return buffer
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
}

async function runOAuthE2ETests() {
    console.log('🚀 Starting Ziqva OAuth 2.0 & SSO Full E2E Test Suite...\n');

    let passedTests = 0;
    let totalTests = 0;

    function assert(condition: boolean, message: string) {
        totalTests++;
        if (condition) {
            console.log(`  ✅ [PASS] ${message}`);
            passedTests++;
        } else {
            console.error(`  ❌ [FAIL] ${message}`);
            throw new Error(`Test Assertion Failed: ${message}`);
        }
    }

    // 1. Setup Test User
    const testEmail = `test_oauth_${Date.now()}@ziqva-test.com`;
    const testUser = await prisma.user.create({
        data: {
            email: testEmail,
            name: 'OAuth Test Engineer',
            password: 'testpassword123',
            verified: true,
            banned: false,
            created: Math.floor(Date.now() / 1000),
            ip: '127.0.0.1',
            avatar: 'https://ui-avatars.com/api/?name=OAuth+Test',
            whatsapp: '081234567890',
            company: 'Ziqva Labs Test',
            original_id: 0,
        },
    });
    console.log(`👤 Created Test User ID: ${testUser.id} (${testUser.email})`);

    // 2. Setup Confidential Client
    const secretData = OAuthService.generateClientSecret();
    const confidentialClient = await prisma.oauth_clients.create({
        data: {
            client_id: `zqv_client_test_conf_${Date.now()}`,
            client_secret_hash: secretData.hash,
            name: 'Confidential Web App Test',
            description: 'Automated test confidential client',
            allowed_redirect_uris: JSON.stringify(['https://client.ziqva.com/oauth/callback', 'http://localhost:3000/callback']),
            allowed_origins: JSON.stringify(['https://client.ziqva.com', 'http://localhost:3000']),
            allowed_scopes: 'profile email whatsapp',
            is_trusted: false,
            is_active: true,
        },
    });
    console.log(`🔑 Created Confidential Client ID: ${confidentialClient.client_id}`);

    // 3. Setup Public PKCE Client (No Secret)
    const pkceClient = await prisma.oauth_clients.create({
        data: {
            client_id: `zqv_client_test_pkce_${Date.now()}`,
            client_secret_hash: null,
            name: 'Public Desktop App PKCE Test',
            description: 'Automated test public PKCE client',
            allowed_redirect_uris: JSON.stringify(['myapp://oauth/callback', 'http://127.0.0.1:8080/callback']),
            allowed_origins: JSON.stringify(['http://127.0.0.1:8080']),
            allowed_scopes: 'profile email',
            is_trusted: true,
            is_active: true,
        },
    });
    console.log(`⚡ Created Public PKCE Client ID: ${pkceClient.client_id}\n`);

    try {
        // ==========================================
        // TEST SUITE 1: Confidential Client Authorization Code Flow
        // ==========================================
        console.log('--- TEST SUITE 1: Confidential Client Authorization Code Flow ---');

        // Step 1: Create Auth Code
        const authCode1 = await OAuthService.createAuthorizationCode({
            clientId: confidentialClient.client_id,
            userId: testUser.id,
            redirectUri: 'https://client.ziqva.com/oauth/callback',
            scopes: 'profile email whatsapp',
        });
        assert(Boolean(authCode1 && authCode1.startsWith('zqv_code_')), 'Auth Code generation produces valid prefixed token');

        // Step 2: Exchange Auth Code for Access & Refresh Tokens
        const tokenResponse1 = await OAuthService.exchangeAuthCode({
            code: authCode1,
            clientId: confidentialClient.client_id,
            clientSecret: secretData.secret,
            redirectUri: 'https://client.ziqva.com/oauth/callback',
            ip: '127.0.0.1',
        });
        assert(tokenResponse1.token_type === 'Bearer', 'Token type is Bearer');
        assert(tokenResponse1.access_token.startsWith('zqv_at_'), 'Access token starts with zqv_at_');
        assert(tokenResponse1.refresh_token?.startsWith('zqv_rt_') === true, 'Refresh token starts with zqv_rt_');
        assert(tokenResponse1.expires_in === 2592000, 'Access token expiration is 30 days');

        // Step 3: Fetch UserInfo with Access Token
        const userInfo1 = await OAuthService.getUserInfoFromToken(tokenResponse1.access_token);
        assert(userInfo1 !== null, 'UserInfo fetched successfully with Bearer token');
        assert(userInfo1?.name === testUser.name, 'UserInfo name matches test user name');
        assert(userInfo1?.email === testUser.email, 'UserInfo email matches test user email');
        assert(userInfo1?.whatsapp === '081234567890', 'UserInfo whatsapp field returned for requested scope');

        // Step 4: Refresh Access Token
        const refreshedTokenResponse = await OAuthService.refreshAccessToken({
            refreshToken: tokenResponse1.refresh_token!,
            clientId: confidentialClient.client_id,
            clientSecret: secretData.secret,
        });
        assert(refreshedTokenResponse.access_token.startsWith('zqv_at_'), 'Refreshed access token is valid');
        assert(refreshedTokenResponse.access_token !== tokenResponse1.access_token, 'Refreshed access token is rotated');

        // Step 5: Revoke Token
        const revokeResult = await OAuthService.revokeToken(refreshedTokenResponse.access_token);
        assert(revokeResult === true, 'Token successfully revoked');
        const userInfoAfterRevoke = await OAuthService.getUserInfoFromToken(refreshedTokenResponse.access_token);
        assert(userInfoAfterRevoke === null, 'UserInfo rejected after token revocation');

        console.log('');

        // ==========================================
        // TEST SUITE 2: Public Client PKCE Flow (RFC 7636)
        // ==========================================
        console.log('--- TEST SUITE 2: Public Client PKCE Flow (RFC 7636 S256) ---');

        // Generate PKCE code_verifier & code_challenge
        const codeVerifier = crypto.randomBytes(32).toString('base64url');
        const challengeHash = crypto.createHash('sha256').update(codeVerifier, 'ascii').digest();
        const codeChallenge = base64UrlEncode(challengeHash);

        // Step 1: Create Auth Code with S256 Challenge
        const pkceAuthCode = await OAuthService.createAuthorizationCode({
            clientId: pkceClient.client_id,
            userId: testUser.id,
            redirectUri: 'myapp://oauth/callback',
            scopes: 'profile email',
            codeChallenge: codeChallenge,
            codeChallengeMethod: 'S256',
        });
        assert(Boolean(pkceAuthCode), 'PKCE Auth Code generated with S256 Challenge');

        // Step 2: Attempt exchange with incorrect code_verifier -> MUST FAIL
        let wrongVerifierFailed = false;
        try {
            await OAuthService.exchangeAuthCode({
                code: pkceAuthCode,
                clientId: pkceClient.client_id,
                redirectUri: 'myapp://oauth/callback',
                codeVerifier: 'wrong_verifier_string_12345678901234567890',
            });
        } catch (e: any) {
            wrongVerifierFailed = e.message.includes('PKCE verification failed');
        }
        assert(wrongVerifierFailed, 'Exchange with invalid code_verifier correctly rejected');

        // Step 3: Exchange with correct code_verifier without secret -> MUST PASS
        const pkceTokenResponse = await OAuthService.exchangeAuthCode({
            code: pkceAuthCode,
            clientId: pkceClient.client_id,
            redirectUri: 'myapp://oauth/callback',
            codeVerifier: codeVerifier,
        });
        assert(pkceTokenResponse.access_token.startsWith('zqv_at_'), 'PKCE exchange succeeded without client_secret');

        // Step 4: Verify UserInfo with PKCE Token
        const pkceUserInfo = await OAuthService.getUserInfoFromToken(pkceTokenResponse.access_token);
        assert(pkceUserInfo?.email === testUser.email, 'UserInfo verified with PKCE Access Token');

        console.log('');

        // ==========================================
        // TEST SUITE 3: Security & Error Handling
        // ==========================================
        console.log('--- TEST SUITE 3: Security, Edge Cases & Attack Mitigations ---');

        // 1. Replay attack: attempt to use pkceAuthCode a second time -> MUST FAIL
        let replayBlocked = false;
        try {
            await OAuthService.exchangeAuthCode({
                code: pkceAuthCode,
                clientId: pkceClient.client_id,
                redirectUri: 'myapp://oauth/callback',
                codeVerifier: codeVerifier,
            });
        } catch (e: any) {
            replayBlocked = e.message.includes('already been used');
        }
        assert(replayBlocked, 'Replay attack blocked: already used auth code rejected');

        // 2. Redirect URI Whitelist Check
        const validUri1 = OAuthService.validateRedirectUri(confidentialClient.allowed_redirect_uris, 'https://client.ziqva.com/oauth/callback');
        const invalidUri = OAuthService.validateRedirectUri(confidentialClient.allowed_redirect_uris, 'https://evil-attacker.com/steal-code');
        assert(validUri1 === true, 'Whitelisted redirect URI accepted');
        assert(invalidUri === false, 'Non-whitelisted redirect URI rejected');

        // 3. User Consent Storage & Smart Bypass Check
        const isTrustedBypass = await OAuthService.checkUserConsent(testUser.id, pkceClient.client_id, 'profile email');
        assert(isTrustedBypass === true, 'Trusted client correctly bypasses consent screen');

        const initialConsent = await OAuthService.checkUserConsent(testUser.id, confidentialClient.client_id, 'profile email');
        assert(initialConsent === false, 'Untrusted client requires consent before grant');

        await OAuthService.grantUserConsent(testUser.id, confidentialClient.client_id, 'profile email');
        const consentAfterGrant = await OAuthService.checkUserConsent(testUser.id, confidentialClient.client_id, 'profile email');
        assert(consentAfterGrant === true, 'User consent saved and remembered on subsequent checks');

        console.log('');
        console.log(`🎉 ALL ${passedTests} / ${totalTests} TESTS PASSED PERFECTLY!\n`);
    } finally {
        // Cleanup Test Data
        console.log('🧹 Cleaning up test artifacts...');
        await prisma.oauth_access_tokens.deleteMany({
            where: { client_id: { in: [confidentialClient.client_id, pkceClient.client_id] } },
        });
        await prisma.oauth_auth_codes.deleteMany({
            where: { client_id: { in: [confidentialClient.client_id, pkceClient.client_id] } },
        });
        await prisma.oauth_user_consents.deleteMany({
            where: { client_id: { in: [confidentialClient.client_id, pkceClient.client_id] } },
        });
        await prisma.oauth_clients.deleteMany({
            where: { id: { in: [confidentialClient.id, pkceClient.id] } },
        });
        await prisma.user.delete({ where: { id: testUser.id } });
        console.log('✨ Cleanup complete.');
    }
}

runOAuthE2ETests()
    .catch((err) => {
        console.error('❌ OAuth E2E Test Suite Encountered Error:', err);
        process.exit(1);
    })
    .finally(() => {
        prisma.$disconnect();
    });
