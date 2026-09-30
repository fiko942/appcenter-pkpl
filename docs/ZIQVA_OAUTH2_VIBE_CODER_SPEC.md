# ZIQVA OAUTH 2.0 & SSO VIBE CODER MASTER SPECIFICATION
> **Format:** Ready-to-paste AI Master Brief & `/writing-plans` Specification for Cursor Composer, Windsurf Cascade, Claude Code, Grok, ChatGPT, and Copilot.

---

## 🤖 HOW TO USE THIS SPECIFICATION WITH AI CODING AGENTS

When building a new app or integrating Ziqva Single Sign-On (SSO) into an existing project, copy the prompt block below or pass this entire file into your AI tool with the `/writing-plans` command:

```text
/writing-plans
Read this entire Ziqva OAuth 2.0 / SSO specification.
Analyze our current project structure and framework.
Formulate a strict, step-by-step implementation plan (checklist format) to integrate Ziqva SSO.
Once the plan is verified, generate all files in full without placeholders.
```

---

## 1. IDENTITY PROVIDER SERVER METADATA

| Property | Value | Description |
| :--- | :--- | :--- |
| **Issuer / Base Host** | `https://appcenter.ziqva.com` | Production Base SSO Server |
| **Local Dev Host** | `http://localhost:5173` | Local Development SSO Server |
| **Authorization Endpoint** | `GET /oauth/authorize` | Browser-based user login & consent |
| **Token Endpoint** | `POST /oauth/token` | Exchange auth code or refresh token |
| **UserInfo Endpoint** | `GET /oauth/userinfo` | Fetch authenticated user profile |
| **Token Revocation Endpoint**| `POST /oauth/revoke` | RFC 7009 Token Revocation / Logout |
| **Supported Grants** | `authorization_code`, `refresh_token` | Standard OAuth 2.0 RFC 6749 |
| **PKCE Support** | RFC 7636 (`S256`, `plain`) | Required for Public Clients (Mobile/SPA) |
| **Access Token Lifetime** | `2,592,000` seconds (30 Days) | Prefixed with `zqv_at_` |
| **Refresh Token Lifetime** | `7,776,000` seconds (90 Days) | Prefixed with `zqv_rt_` (With Token Rotation) |
| **Auth Code Lifetime** | `600` seconds (10 Minutes) | Single-use, Prefixed with `zqv_code_` |
| **Allowed Scopes** | `profile` `email` `whatsapp` | Space-delimited string |

---

## 2. STRICT CONTRACT & ENDPOINT SPECIFICATIONS

### A. Authorization Endpoint
**`GET /oauth/authorize`**

Initiates the OAuth 2.0 authorization flow in the browser. Redirects the user to the Ziqva login and consent screen.

#### Query Parameters:
| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `client_id` | `string` | **YES** | Your registered App ID (e.g. `zqv_client_9f8a...`) |
| `redirect_uri` | `string` | **YES** | Exact URL where code will be delivered (Must be whitelisted) |
| `response_type`| `string` | **YES** | Must be literal `code` |
| `scope` | `string` | **YES** | Space-delimited scopes, e.g. `profile email` |
| `state` | `string` | **YES** | Cryptographically random string (min 16-32 chars) for CSRF defense |
| `code_challenge`| `string` | Conditional | Base64URL-encoded SHA-256 hash of `code_verifier` (Required for PKCE) |
| `code_challenge_method` | `string` | Conditional | `S256` (Recommended) or `plain` |
| `prompt` | `string` | Optional | Set to `consent` to force the consent screen even if already granted |

#### Success Callback:
The browser redirects back to your `redirect_uri`:
```text
https://yourapp.com/api/auth/callback?code=zqv_code_7d2f91...&state=xyz123random
```

#### Error Callback:
```text
https://yourapp.com/api/auth/callback?error=access_denied&error_description=Pengguna+membatalkan+permintaan+akses&state=xyz123random
```

---

### B. Token Exchange Endpoint
**`POST /oauth/token`**

Exchanges an Authorization Code for Access & Refresh Tokens, OR exchanges a Refresh Token for new tokens.

- **Content-Type**: `application/json` (or `application/x-www-form-urlencoded`)

#### 1. Grant Type: `authorization_code` (Confidential Client with Secret)
```json
{
  "grant_type": "authorization_code",
  "client_id": "zqv_client_abc123",
  "client_secret": "zqv_secret_xyz789",
  "code": "zqv_code_7d2f91...",
  "redirect_uri": "https://yourapp.com/api/auth/callback"
}
```

#### 2. Grant Type: `authorization_code` (Public Client with PKCE)
```json
{
  "grant_type": "authorization_code",
  "client_id": "zqv_client_mobile_app",
  "code_verifier": "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
  "code": "zqv_code_7d2f91...",
  "redirect_uri": "myapp://oauth/callback"
}
```

#### 3. Grant Type: `refresh_token` (Token Refresh Flow)
```json
{
  "grant_type": "refresh_token",
  "client_id": "zqv_client_abc123",
  "client_secret": "zqv_secret_xyz789",
  "refresh_token": "zqv_rt_81b3a0c2..."
}
```

#### Success Response (HTTP 200 OK):
```json
{
  "access_token": "zqv_at_9c72f10b83a04e5d8b72...",
  "token_type": "Bearer",
  "expires_in": 2592000,
  "refresh_token": "zqv_rt_81b3a0c2f718...",
  "scope": "profile email"
}
```

#### Error Response (HTTP 400 / 401):
```json
{
  "error": "invalid_grant",
  "error_description": "Authorization code tidak valid atau telah kedaluwarsa"
}
```

---

### C. User Profile Resource Endpoint
**`GET /oauth/userinfo`**

Retrieves the authenticated user's account details.

- **Headers**: `Authorization: Bearer <access_token>`

#### Success Response (HTTP 200 OK):
```json
{
  "name": "Ahmad Pratama",
  "email": "ahmad@example.com",
  "avatar": null,
  "verified": true,
  "whatsapp": "081234567890",
  "created_at": 1726740000
}
```
*Note: `whatsapp` is only populated if the `whatsapp` scope was requested and authorized. Standard user accounts use client-side initials avatar badge based on `name`.*

---

### D. Token Revocation Endpoint (RFC 7009) & Single Sign-Out
- **Token Revocation (POST `/oauth/revoke`)**: Invalidate access or refresh tokens programmatically.
  - Body: `{ "client_id": "zqv_client_abc123", "client_secret": "zqv_secret_xyz789", "token": "zqv_at_..." }`
- **End-Session Logout (GET/POST `/oauth/logout`)**: Browser redirect to destroy SSO session and redirect back to your app.
  - Query/Body: `?redirect_uri=https://yourapp.com/login`

---

## 3. TYPESCRIPT TYPE DEFINITIONS

```typescript
export interface ZiqvaTokenResponse {
  access_token: string;
  token_type: 'Bearer';
  expires_in: number;
  refresh_token: string;
  scope: string;
}

export interface ZiqvaUserInfo {
  name: string;
  email: string;
  avatar: string | null;
  verified: boolean;
  whatsapp?: string | null;
  created_at: number;
}

export interface ZiqvaOAuthError {
  error: 
    | 'invalid_request'
    | 'unauthorized_client'
    | 'access_denied'
    | 'unsupported_response_type'
    | 'invalid_scope'
    | 'server_error'
    | 'temporarily_unavailable'
    | 'invalid_grant'
    | 'invalid_client'
    | 'unsupported_grant_type';
  error_description: string;
}
```

---

## 4. UNIVERSAL AI MASTER PROMPT TEMPLATE

Copy-paste the block below into your AI chat or `.cursorrules`:

````markdown
# TASK: Integrate Ziqva OAuth 2.0 Single Sign-On (SSO)

You are an expert Fullstack and Security Architect. Integrate Ziqva SSO into this codebase following the official RFC 6749, RFC 7636 PKCE, and RFC 7009 standards.

### 1. Configuration & Env Variables
Configure your environment file (`.env` or `.env.local`):
```env
ZIQVA_OAUTH_HOST="https://appcenter.ziqva.com"
ZIQVA_CLIENT_ID="YOUR_CLIENT_ID"
ZIQVA_CLIENT_SECRET="YOUR_CLIENT_SECRET"
ZIQVA_REDIRECT_URI="http://localhost:3000/api/auth/callback"
ZIQVA_SCOPE="profile email whatsapp"
SESSION_SECRET="super_secret_32_character_key_here"
```

### 2. Execution Plan (/writing-plans)
Before modifying code, generate an execution plan containing:
1. **Helper Client**: Create auth utility module with `getAuthorizeUrl()`, `exchangeCode()`, `getUserInfo()`, `refreshTokens()`, and `revokeToken()`.
2. **Login Route**: Route to create CSRF `state` (stored in secure HttpOnly cookie) and redirect to Ziqva Authorization Server.
3. **Callback Route**: Route to verify `state`, exchange `code` for tokens, fetch profile, upsert user in database/session, and set HttpOnly session cookie.
4. **Session Management**: Middleware / Server helper to extract logged-in user and handle automatic background token refreshing.
5. **Logout Route**: Route to revoke token via `POST /oauth/revoke` and destroy session cookies.
6. **UI Components**: "Masuk dengan Ziqva" button component with Ziqva branding.
7. **Types & Validation**: TypeScript types and Zod schemas for all API payloads.

### 3. Implementation Rules
- NEVER store Client Secret in client-side bundles (use PKCE if building a SPA or Mobile App).
- ALWAYS validate CSRF `state` strictly in the callback handler.
- ALWAYS use `HttpOnly`, `Secure`, `SameSite=Lax` cookies for token storage.
- Implement silent token refresh when access token is within 5 minutes of expiration.
- Handle OAuth error query params gracefully (`error` & `error_description`).
````

---

## 5. FRAMEWORK RECIPES

### A. Next.js 14 / 15 (App Router & Route Handlers)

#### 1. OAuth Client SDK (`lib/auth/ziqva.ts`)
```typescript
import { cookies } from 'next/headers';

const OAUTH_HOST = process.env.ZIQVA_OAUTH_HOST || 'https://appcenter.ziqva.com';
const CLIENT_ID = process.env.ZIQVA_CLIENT_ID!;
const CLIENT_SECRET = process.env.ZIQVA_CLIENT_SECRET!;
const REDIRECT_URI = process.env.ZIQVA_REDIRECT_URI!;
const SCOPE = process.env.ZIQVA_SCOPE || 'profile email';

export function getZiqvaAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'code',
    scope: SCOPE,
    state,
  });
  return `${OAUTH_HOST}/oauth/authorize?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string) {
  const res = await fetch(`${OAUTH_HOST}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      code,
      redirect_uri: REDIRECT_URI,
    }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error_description || 'Gagal menukar authorization code');
  }
  return res.json();
}

export async function getZiqvaUserProfile(accessToken: string) {
  const res = await fetch(`${OAUTH_HOST}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error('Gagal mengambil data profil Ziqva');
  return res.json();
}
```

#### 2. Login Route (`app/api/auth/login/route.ts`)
```typescript
import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getZiqvaAuthUrl } from '@/lib/auth/ziqva';

export async function GET() {
  const state = crypto.randomBytes(24).toString('hex');
  const authUrl = getZiqvaAuthUrl(state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set('oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 600, // 10 minutes
    path: '/',
  });
  return response;
}
```

#### 3. Callback Route (`app/api/auth/callback/route.ts`)
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { exchangeCodeForTokens, getZiqvaUserProfile } from '@/lib/auth/ziqva';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(error)}`, req.url));
  }

  const savedState = req.cookies.get('oauth_state')?.value;
  if (!state || !savedState || state !== savedState) {
    return NextResponse.redirect(new URL('/login?error=invalid_state', req.url));
  }

  try {
    const tokens = await exchangeCodeForTokens(code!);
    const profile = await getZiqvaUserProfile(tokens.access_token);

    // Save tokens and user info in session
    const response = NextResponse.redirect(new URL('/dashboard', req.url));
    response.cookies.delete('oauth_state');
    response.cookies.set('ziqva_session', JSON.stringify({ profile, tokens }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: tokens.expires_in,
      path: '/',
    });
    return response;
  } catch (err: any) {
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(err.message)}`, req.url));
  }
}
```

---

### B. Python FastAPI

```python
import os
import secrets
import httpx
from fastapi import FastAPI, Depends, HTTPException, status, Request, Response
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

app = FastAPI()

ZIQVA_OAUTH_HOST = os.getenv("ZIQVA_OAUTH_HOST", "https://appcenter.ziqva.com")
ZIQVA_CLIENT_ID = os.getenv("ZIQVA_CLIENT_ID")
ZIQVA_CLIENT_SECRET = os.getenv("ZIQVA_CLIENT_SECRET")
ZIQVA_REDIRECT_URI = os.getenv("ZIQVA_REDIRECT_URI")
ZIQVA_SCOPE = "profile email"

class ZiqvaUser(BaseModel):
    name: str
    email: str
    avatar: str | None = None
    verified: bool
    whatsapp: str | None = None

@app.get("/auth/login")
def login(response: Response):
    state = secrets.token_urlsafe(32)
    url = (
        f"{ZIQVA_OAUTH_HOST}/oauth/authorize?"
        f"client_id={ZIQVA_CLIENT_ID}&"
        f"redirect_uri={ZIQVA_REDIRECT_URI}&"
        f"response_type=code&"
        f"scope={ZIQVA_SCOPE}&"
        f"state={state}"
    )
    res = RedirectResponse(url)
    res.set_cookie("oauth_state", state, httponly=True, samesite="lax", max_age=600)
    return res

@app.get("/auth/callback")
async def callback(request: Request, code: str = None, state: str = None, error: str = None):
    if error:
        raise HTTPException(status_code=400, detail=f"OAuth error: {error}")
    
    saved_state = request.cookies.get("oauth_state")
    if not state or not saved_state or state != saved_state:
        raise HTTPException(status_code=400, detail="Invalid CSRF state")

    async with httpx.AsyncClient() as client:
        # 1. Exchange Code
        token_resp = await client.post(
            f"{ZIQVA_OAUTH_HOST}/oauth/token",
            json={
                "grant_type": "authorization_code",
                "client_id": ZIQVA_CLIENT_ID,
                "client_secret": ZIQVA_CLIENT_SECRET,
                "code": code,
                "redirect_uri": ZIQVA_REDIRECT_URI
            }
        )
        if token_resp.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to exchange token")
        tokens = token_resp.json()

        # 2. Get User Info
        user_resp = await client.get(
            f"{ZIQVA_OAUTH_HOST}/oauth/userinfo",
            headers={"Authorization": f"Bearer {tokens['access_token']}"}
        )
        user_data = user_resp.json()

    # Issue application JWT or session cookie
    response = RedirectResponse(url="/dashboard")
    response.delete_cookie("oauth_state")
    return response
```

---

### C. Flutter PKCE (Mobile & Desktop)

```dart
import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

class ZiqvaOAuthService {
  static const String ssoHost = "https://appcenter.ziqva.com";
  static const String clientId = "YOUR_FLUTTER_CLIENT_ID";
  static const String redirectUri = "ziqvaapp://oauth/callback";
  static const String scope = "profile email";

  final _storage = const FlutterSecureStorage();

  String _generateRandomString(int length) {
    final rand = Random.secure();
    final bytes = List<int>.generate(length, (_) => rand.nextInt(256));
    return base64UrlEncode(bytes).replaceAll('=', '').substring(0, length);
  }

  String _generateCodeChallenge(String verifier) {
    final bytes = utf8.encode(verifier);
    final digest = sha256.convert(bytes);
    return base64UrlEncode(digest.bytes).replaceAll('=', '');
  }

  Future<Map<String, dynamic>> login() async {
    final codeVerifier = _generateRandomString(64);
    final codeChallenge = _generateCodeChallenge(codeVerifier);
    final state = _generateRandomString(32);

    final authUrl = Uri.parse(
      "$ssoHost/oauth/authorize?"
      "client_id=$clientId&"
      "redirect_uri=${Uri.encodeComponent(redirectUri)}&"
      "response_type=code&"
      "scope=${Uri.encodeComponent(scope)}&"
      "state=$state&"
      "code_challenge=$codeChallenge&"
      "code_challenge_method=S256"
    );

    // Launch secure in-app browser
    final result = await FlutterWebAuth2.authenticate(
      url: authUrl.toString(),
      callbackUrlScheme: "ziqvaapp",
    );

    final callbackUri = Uri.parse(result);
    final code = callbackUri.queryParameters['code'];
    final returnedState = callbackUri.queryParameters['state'];

    if (returnedState != state || code == null) {
      throw Exception("State validation failed or code missing");
    }

    // Token Exchange with PKCE Verifier
    final response = await http.post(
      Uri.parse("$ssoHost/oauth/token"),
      headers: {"Content-Type": "application/json"},
      body: jsonEncode({
        "grant_type": "authorization_code",
        "client_id": clientId,
        "code": code,
        "redirect_uri": redirectUri,
        "code_verifier": codeVerifier,
      }),
    );

    if (response.statusCode != 200) {
      throw Exception("Token exchange failed: ${response.body}");
    }

    final tokens = jsonDecode(response.body);
    await _storage.write(key: 'access_token', value: tokens['access_token']);
    await _storage.write(key: 'refresh_token', value: tokens['refresh_token']);

    // Fetch User Profile
    final userProfile = await fetchUserProfile(tokens['access_token']);
    return userProfile;
  }

  Future<Map<String, dynamic>> fetchUserProfile(String token) async {
    final res = await http.get(
      Uri.parse("$ssoHost/oauth/userinfo"),
      headers: {"Authorization": "Bearer $token"},
    );
    return jsonDecode(res.body);
  }
}
```

---

## 6. ERROR HANDLING DICTIONARY

| Error Code | HTTP Status | Meaning | Action to take |
| :--- | :--- | :--- | :--- |
| `invalid_request` | 400 | Missing parameter / invalid format | Check request parameters |
| `invalid_client` | 401 | Invalid `client_id` or `client_secret` | Verify app credentials in Admin Hub |
| `invalid_grant` | 400 | Code expired, used, or verifier mismatch | Restart login flow |
| `unauthorized_client` | 400 | Client not allowed to use grant type | Check client type permissions |
| `access_denied` | 403 | User rejected consent screen | Inform user authorization is required |
| `invalid_scope` | 400 | Scope requested is not allowed | Request only `profile`, `email`, `whatsapp` |
| `server_error` | 500 | Internal server error | Retry with exponential backoff |

---

## 7. PRODUCTION SECURITY CHECKLIST

- [x] **HTTPS Enforcement**: All requests must use HTTPS in production.
- [x] **Whitelisted Redirect URIs**: Exact match only (No wildcard subdomains or open redirects).
- [x] **Strict PKCE S256**: Public clients must always compute SHA-256 challenges.
- [x] **Token Rotation**: Refresh tokens are single-use and rotate upon each exchange.
- [x] **CSRF State**: Every authorization redirect generates and validates a crypto-random `state`.
- [x] **No Token Exposure in URLs**: Tokens are never passed via URL query parameters.

---

## 8. RECENT ARCHITECTURAL REVISIONS & INVARIANTS (DETAILED CHANGELOG)

### 8.1 Dedicated In-Place SSO Login & Google-Style Account Chooser
- **Previous Behavior**: Calling `/oauth/authorize` while unauthenticated previously redirected the browser to the main AppCenter member login page (`/member/login`), polluting the member portal session and creating fragmented redirects.
- **Current Architecture**: `/oauth/authorize` serves a dedicated, self-contained SSO interface (`/#/oauth/authorize` via `OAuthConsent.svelte`).
  - **Unauthenticated Flow**: Displays an inline, client-branded login form directly within the SSO modal with rate limiting (`/oauth/api/login`), email, password, and instant feedback.
  - **Authenticated Flow (Account Chooser)**: Displays a Google-style Account Chooser card showing the active user's name, email, verified badge, requested scopes, explicit "Lanjutkan sebagai [Nama]" action button, and a "Ganti Akun" action button (`/oauth/api/logout-current`) which switches accounts in-place without breaking the OAuth state flow.
  - **No Silent Auto-Login**: The user must always explicitly confirm the account selection.

### 8.2 Zero Database Integer ID Leakage (Security Hardening)
- **Problem**: Exposing auto-increment database integer IDs (`id: 123` or `sub: 123`) in public UserInfo endpoints exposes internal database metrics and enables user enumeration / IDOR attacks.
- **Resolution**: Removed `id` and `sub` integer properties from public `GET /oauth/userinfo` responses, `authContext`, code prompts, AI briefs, and TypeScript interfaces.
- **Identity Contract**: Client applications identify unique users by their verified `email` address.

### 8.3 Global SSO Logout / End-Session Redirect (`GET /oauth/logout` & `POST /oauth/logout`)
- **Problem**: When a user logged out of an external client app and clicked "Login with Ziqva" again, the active AppCenter SSO session would immediately re-authenticate them, preventing them from logging in with a different account.
- **Resolution**: Added `/oauth/logout` endpoint supporting `redirect_uri` / `post_logout_redirect_uri`. This destroys the AppCenter SSO session cookie and cleanly redirects the user back to the client application's login screen.

### 8.4 Initial Avatar Badge UI/UX
- **Problem**: User profile records in AppCenter do not store uploaded image avatar URLs for standard users, resulting in broken/missing `<img>` placeholders.
- **Resolution**: Removed the `<img>` tag from the SSO consent screen and replaced it with a stylized, responsive gradient circular badge displaying the first letter of the user's name (`{(user.name || 'U').charAt(0).toUpperCase()}`).

### 8.5 Admin Developer Hub & AI Vibe-Coder Tools (`AdminOAuthClients.svelte`)
- Admin dashboard includes a dedicated Developer Portal to manage OAuth clients (Confidential & Public PKCE).
- Generates ready-to-use AI integration prompts (`/writing-plans`) tailored for 5 popular frameworks (Next.js, FastAPI, Flutter, Express, Laravel, Golang).
- Built-in live Consent Screen preview and downloadable Markdown specifications.

### 8.6 Automated E2E Test Suite (`scripts/test-oauth-sso.ts`)
- Automated 23-scenario E2E test suite covering:
  - Confidential Client Authorization Code Flow (Token generation, Bearer type, prefix validation, expiration, UserInfo fetching, token rotation, RFC 7009 revocation).
  - Public Client RFC 7636 PKCE Flow (S256 challenge validation, invalid verifier rejection, secretless exchange).
  - Security mitigations (Replay attack prevention, whitelisted redirect URI enforcement, first-party trust bypass, consent persistence, clean artifact teardown).

