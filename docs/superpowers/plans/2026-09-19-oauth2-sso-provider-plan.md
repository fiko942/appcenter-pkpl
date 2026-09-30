# Ziqva OAuth 2.0 & SSO Identity Provider Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Membangun subsistem OAuth 2.0 Authorization Server & SSO Identity Provider di `appcenter.ziqva.com` yang memungkinkan ekosistem aplikasi Ziqva melakukan login terpusat dengan akun Ziqva (seperti Google Sign-In), lengkap dengan manajemen client admin, smart consent UI, token database, dan dukungan PKCE.

**Architecture:** Memanfaatkan model Prisma MySQL terisolasi (`oauth_clients`, `oauth_auth_codes`, `oauth_access_tokens`, `oauth_user_consents`), engine otorisasi modular `oauthService.ts`, router Express `/oauth/*` dan `/api/v1/oauth/*`, antarmuka admin Svelte `AdminOAuthClients.svelte`, serta layar persetujuan responsif `OAuthConsent.svelte` berstandar design system AppCenter.

**Tech Stack:** Node.js 20+, Express 5, TypeScript 5.9, Prisma ORM 6, Svelte 4, Vite 6, Tailwind CSS 4, Crypto native.

**Spec:** `docs/superpowers/specs/2026-09-19-oauth2-sso-provider-design.md`

## Global Constraints

1. **Git Target:** Strictly branch `reborn` (dilarang push ke `master`).
2. **Package Manager:** Strictly `pnpm` (v11.23.0).
3. **Database Connection Pool:** Maksimal 5 koneksi (`connection_limit=5`).
4. **Token Formatting:** Access token diawali `zqv_at_`, Refresh token `zqv_rt_`, Auth code `zqv_code_`.
5. **Security Invariant:** User email immutable, client secret di-hash SHA-256/bcrypt, redirect URI wajib exact match whitelist.
6. **Zero Regression:** Alur login member eksisting (`/login`, `/member/login`), admin session, GoQRIS payment, dan lisensi perangkat HWID tidak boleh terganggu.

---

### Task 1: Update Database Schema & Generate Prisma Client

**Files:**
- Modify: `prisma/schema.prisma`
- Generate: `src/generated/client`

**Interfaces:**
- Produces: `prisma.oauth_clients`, `prisma.oauth_auth_codes`, `prisma.oauth_access_tokens`, `prisma.oauth_user_consents`

- [ ] **Step 1: Add OAuth2 models to `prisma/schema.prisma`**

Tambahkan model berikut pada `prisma/schema.prisma`:

```prisma
// ==========================================
// ZIQVA OAUTH 2.0 & SSO SUBSYSTEM
// ==========================================

model oauth_clients {
  id                    Int      @id @default(autoincrement())
  client_id             String   @unique @db.VarChar(64)
  client_secret_hash    String?  @db.VarChar(255)
  name                  String   @db.VarChar(255)
  description           String?  @db.Text
  icon_url              String?  @db.Text
  allowed_redirect_uris String   @db.Text
  allowed_origins       String?  @db.Text
  allowed_scopes        String   @default("profile email") @db.VarChar(255)
  is_trusted            Boolean  @default(false)
  is_active             Boolean  @default(true)
  created_by            String?  @db.VarChar(100)
  created_at            DateTime @default(now())
  updated_at            DateTime @default(now()) @updatedAt
}

model oauth_auth_codes {
  id                    Int      @id @default(autoincrement())
  code                  String   @unique @db.VarChar(128)
  client_id             String   @db.VarChar(64)
  user_id               Int
  redirect_uri          String   @db.Text
  scopes                String   @db.VarChar(255)
  code_challenge        String?  @db.VarChar(128)
  code_challenge_method String?  @db.VarChar(10)
  expires_at            DateTime
  is_used               Boolean  @default(false)
  created_at            DateTime @default(now())
}

model oauth_access_tokens {
  id                 Int       @id @default(autoincrement())
  token              String    @unique @db.VarChar(128)
  refresh_token      String?   @unique @db.VarChar(128)
  client_id          String    @db.VarChar(64)
  user_id            Int
  scopes             String    @db.VarChar(255)
  expires_at         DateTime
  refresh_expires_at DateTime?
  revoked            Boolean   @default(false)
  ip                 String?   @db.VarChar(100)
  user_agent         String?   @db.Text
  created_at         DateTime  @default(now())
  last_used_at       DateTime  @default(now()) @updatedAt
}

model oauth_user_consents {
  id         Int      @id @default(autoincrement())
  user_id    Int
  client_id  String   @db.VarChar(64)
  scopes     String   @db.VarChar(255)
  granted_at DateTime @default(now())
  updated_at DateTime @default(now()) @updatedAt

  @@unique([user_id, client_id])
}
```

- [ ] **Step 2: Push database schema and generate Prisma client**

Run:
```bash
pnpm prisma db push
pnpm prisma generate
```
Expected: Schema pushed successfully to MySQL and Prisma Client generated at `src/generated/client`.

- [ ] **Step 3: Verify Prisma schema compilation**

Verifikasi bahwa TypeScript mengenali model baru di `src/config/prisma.ts`.

---

### Task 2: Core OAuth2 Service Engine (`src/services/oauthService.ts`)

**Files:**
- Create: `src/services/oauthService.ts`

**Interfaces:**
- Produces:
  - `generateClientId(): string`
  - `generateClientSecret(): { secret: string; hash: string }`
  - `verifyClientSecret(secret: string, hash: string): boolean`
  - `verifyPkce(codeVerifier: string, codeChallenge: string, method?: string): boolean`
  - `createAuthorizationCode(params: {...}): Promise<string>`
  - `exchangeAuthCodeForTokens(params: {...}): Promise<TokenResult>`
  - `refreshAccessToken(refreshToken: string, clientId: string, clientSecret?: string): Promise<TokenResult>`
  - `getUserInfoFromToken(token: string): Promise<UserInfoResult>`
  - `revokeToken(token: string): Promise<boolean>`

- [ ] **Step 1: Write `src/services/oauthService.ts`**

Implementasikan logika kriptografi, validasi PKCE S256/plain, hashing secret SHA-256, pembuatan auth code 10m TTL, pembuatan token akses 30 hari & refresh token 90 hari, query data user profil dengan pengecekan `banned === false`.

- [ ] **Step 2: Unit test crypto & PKCE logic**

Tulis test unit singkat untuk memvalidasi fungsi hash, PKCE S256 base64url challenge matching, dan token formatting.

---

### Task 3: OAuth2 Endpoints & Express Routing

**Files:**
- Create: `src/controllers/oauthController.ts`
- Create: `src/routes/oauthRoutes.ts`
- Modify: `src/app.ts`

**Interfaces:**
- Consumes: `oauthService.ts`
- Produces:
  - `GET /oauth/authorize`
  - `POST /oauth/consent/decision`
  - `POST /oauth/token`
  - `GET /oauth/userinfo`
  - `POST /oauth/revoke`
  - `GET /api/v1/oauth/userinfo`

- [ ] **Step 1: Create `src/controllers/oauthController.ts`**

Menangani HTTP handlers:
- `handleAuthorize`: Validasi client, redirect URI, cek session user (`req.session.user_id`). Jika belum login, redirect ke `/login?return_to=...`. Jika sudah login dan trusted/consented, langsung terbitkan code dan redirect ke target client. Jika belum consent, arahkan ke SPA view `#/oauth/authorize`.
- `handleConsentDecision`: Menerima persetujuan user (`allow: true/false`), simpan ke `oauth_user_consents`, terbitkan code dan return redirect URL.
- `handleToken`: Penukaran grant type `authorization_code` atau `refresh_token` dengan response standar JSON RFC 6749.
- `handleUserInfo`: Header `Authorization: Bearer <token>`, validasi token aktif dan return profil user.
- `handleRevoke`: Pencabutan token RFC 7009.

- [ ] **Step 2: Create `src/routes/oauthRoutes.ts` & Register in `src/app.ts`**

Pasang route CORS dinamis sesuai `allowed_origins` milik client dan mount router di `app.use('/oauth', oauthRoutes)` serta `app.use('/api/v1/oauth', oauthRoutes)`.

---

### Task 4: Seamless Return-To Flow on Member Login & Register

**Files:**
- Modify: `src/controllers/memberController.ts`
- Modify: `client/src/lib/pages/MemberLogin.svelte`
- Modify: `client/src/lib/pages/MemberRegister.svelte`

**Interfaces:**
- Consumes: `req.query.return_to` or `req.body.return_to`
- Produces: Smooth post-login redirection to pending OAuth authorization request

- [ ] **Step 1: Update `memberController.ts` login and register handlers**

Pastikan jika request login / register menyertakan parameter `return_to` (yang diawali `/oauth/authorize`), response API menyertakan `{ redirect_to: return_to }` dan sesi `req.session.user_id` aktif tersimpan sebelum redirect.

- [ ] **Step 2: Update Svelte Login & Register components**

Periksa URL search query `return_to` di `MemberLogin.svelte` dan `MemberRegister.svelte`. Setelah login sukses, prioritaskan navigasi ke URL `return_to` tersebut alih-alih selalu mengarahkan ke `#/dashboard`.

---

### Task 5: Admin OAuth Client Management API

**Files:**
- Modify: `src/controllers/adminController.ts`
- Modify: `src/routes/adminRoutes.ts`

**Interfaces:**
- Produces:
  - `GET /admin/api/oauth-clients` (Daftar semua client terdaftar)
  - `POST /admin/api/oauth-clients` (Registrasi client baru)
  - `PUT /admin/api/oauth-clients/:id` (Update info, URIs, status aktif/trusted)
  - `POST /admin/api/oauth-clients/:id/reset-secret` (Generate client secret baru)
  - `DELETE /admin/api/oauth-clients/:id` (Hapus client & revoke all associated tokens)

- [ ] **Step 1: Implement Admin OAuth Controller methods in `src/controllers/adminController.ts`**
- [ ] **Step 2: Add API routes to `src/routes/adminRoutes.ts` with admin session auth middleware**

---

### Task 6: Admin OAuth Management UI (`AdminOAuthClients.svelte`)

**Files:**
- Create: `client/src/lib/pages/AdminOAuthClients.svelte`
- Modify: `client/src/lib/components/AdminSidebar.svelte`
- Modify: `client/src/App.svelte`

**Interfaces:**
- Consumes: Admin OAuth REST APIs
- Produces: Interactive admin portal page to register apps, view Client ID/Secret, configure redirect URIs, origins, and trusted flag

- [ ] **Step 1: Create `client/src/lib/pages/AdminOAuthClients.svelte`**
Menggunakan Tailwind CSS v4, dual-theme support (CSS variables), glassmorphism cards, copy button with animated tooltip, modal register/edit client, and modal reveal secret.

- [ ] **Step 2: Update `client/src/lib/components/AdminSidebar.svelte`**
Tambahkan navigasi baru **OAuth Apps / SSO** dengan icon modern.

- [ ] **Step 3: Register route in `client/src/App.svelte`**
Daftarkan `#/admin/oauth-clients` ke `AdminOAuthClients.svelte`.

---

### Task 7: Svelte SSO Consent & Authorize Screen (`OAuthConsent.svelte`)

**Files:**
- Create: `client/src/lib/pages/OAuthConsent.svelte`
- Modify: `client/src/App.svelte`

**Interfaces:**
- Consumes: `GET /oauth/api/consent-details` & `POST /oauth/consent/decision`
- Produces: Polished Google-like Ziqva Account Consent Dialog

- [ ] **Step 1: Create `client/src/lib/pages/OAuthConsent.svelte`**
Menampilkan:
- Logo Ziqva Identity Header
- Avatar & Profil Akun aktif dengan opsi "Ganti Akun"
- App Icon & Nama Aplikasi Klien
- Rincian izin akses (Scope breakdown: Nama, Email, WhatsApp, Profil)
- Tombol Aksi: "Lanjutkan / Izinkan" (Primary glow) dan "Batal" (Secondary)

- [ ] **Step 2: Register route in `client/src/App.svelte`**
Daftarkan `#/oauth/authorize` ke `OAuthConsent.svelte`.

---

### Task 8: Automated E2E OAuth Simulation & Full Verification

**Files:**
- Create: `scripts/test-oauth-sso.ts`
- Modify: `package.json`

- [ ] **Step 1: Create `scripts/test-oauth-sso.ts`**
Menjalankan simulasi lengkap end-to-end tanpa browser:
1. Registrasi Client via Admin API (Client ID & Secret).
2. Simulasi PKCE Challenge generation (SHA-256 S256).
3. Simulasi request authorize & login session -> generate Auth Code.
4. Simulasi POST `/oauth/token` dengan PKCE code_verifier -> dapatkan `access_token` & `refresh_token`.
5. Simulasi GET `/oauth/userinfo` dengan Bearer token -> validasi data user sesuai database.
6. Simulasi refresh token exchange.
7. Simulasi revoke token -> pastikan request userinfo berikutnya ditolak 401 Unauthorized.
8. Simulasi invalid redirect URI & invalid secret rejection.

- [ ] **Step 2: Run test simulation and verify 100% pass**
Run:
```bash
pnpm ts-node scripts/test-oauth-sso.ts
```

- [ ] **Step 3: Frontend Build Verification**
Run:
```bash
pnpm --filter client build
```
Pastikan build Vite frontend sukses tanpa error type / compilation.

---

## Execution Handoff

Rencana implementasi selesai dan tersimpan di:
`docs/superpowers/plans/2026-09-19-oauth2-sso-provider-plan.md`

Terdapat dua opsi eksekusi:
1. **Subagent-Driven (Direkomendasikan)** - Eksekusi modular per task dengan subagent mandiri dan review checkpoints.
2. **Inline Execution** - Eksekusi langsung secara bertahap di sesi ini dengan pelaporan berkala per task.

Pendekatan mana yang ingin Anda gunakan?
