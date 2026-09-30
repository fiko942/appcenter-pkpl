# Ziqva OAuth 2.0 & SSO Identity Provider Specification

- **Date:** 2026-09-19
- **Status:** Approved
- **Author:** Ziqva Core Engineering & Architecture
- **Target Release:** `reborn` branch
- **Base Domain:** `appcenter.ziqva.com`

---

## 1. Executive Summary

Layanan **Ziqva OAuth 2.0 & SSO (Single Sign-On)** dirancang untuk menjadi penyedia identitas terpusat (*Identity Provider / IdP*) bagi seluruh ekosistem aplikasi Ziqva (web, desktop, mobile, maupun internal services), dengan konsep menyerupai *Google Sign-In (`accounts.google.com`)*.

Pengguna dapat melakukan otentikasi menggunakan akun Ziqva yang terdaftar di AppCenter (`appcenter.ziqva.com`). Manajemen aplikasi klien (*OAuth Clients*) dikelola secara eksklusif oleh Administrator melalui panel Admin AppCenter.

### Fitur Utama:
1. **OAuth 2.0 Authorization Server**: Mendukung *Authorization Code Flow* standar (RFC 6749) dan *PKCE (Proof Key for Code Exchange - RFC 7636)* untuk aplikasi publik (Desktop/Electron/Flutter/SPA).
2. **Database Opaque Tokens**: Token akses (`zqv_at_...`) dan refresh token (`zqv_rt_...`) tersimpan di database Prisma MySQL, menjamin pencabutan instan (*instant revocation*) dan sinkronisasi realtime dengan status user (banned/verified).
3. **Smart Consent UI**: Layanan consent interaktif bergaya Google Sign-In dengan dukungan *First-Party Trusted App bypass* dan penyimpanan izin persetujuan (*user consent memory*).
4. **Admin Client Management**: Pengelolaan penuh aplikasi klien oleh Admin (Client ID, Secret Generation, Whitelist Redirect URIs, Allowed Origins, Scopes, App Icon, & Trusted Status).
5. **Zero Disruption Guarantee**: Tidak merusak atau mengubah alur login member eksisting, admin panel, GoQRIS gateway, maupun lisensi perangkat HWID.

---

## 2. Arsitektur & Diagram Alur Data

### 2.1 Alur Authorization Code Flow + PKCE

```text
+-------------------+           +-----------------------+           +----------------------+
|   Client App      |           | AppCenter SSO (Svelte)|           | AppCenter API Engine |
| (Web/Desktop/App) |           |  /oauth/authorize     |           |     (Express.js)     |
+-------------------+           +-----------------------+           +----------------------+
          |                                 |                                  |
          | 1. Redirect to /oauth/authorize |                                  |
          |    (client_id, redirect_uri,    |                                  |
          |     code_challenge, scope)      |                                  |
          |-------------------------------->|                                  |
          |                                 | 2. Validasi sesi user login      |
          |                                 |    - Belum login -> /login       |
          |                                 |    - Trusted app -> auto grant   |
          |                                 |    - Untrusted -> Render Consent |
          |                                 |                                  |
          |                                 | 3. User Klik "Izinkan / Continue"|
          |                                 |    Request Auth Code             |
          |                                 |--------------------------------->|
          |                                 |                                  |
          |                                 | 4. Generate Auth Code (10m TTL)  |
          |                                 |<---------------------------------|
          | 5. Redirect ke redirect_uri     |                                  |
          |    ?code=zqv_code_...&state=... |                                  |
          |<--------------------------------|                                  |
          |                                                                    |
          | 6. POST /oauth/token (code, code_verifier, client_id, secret)     |
          |------------------------------------------------------------------->|
          |                                                                    | 7. Verifikasi PKCE & Code
          |                                                                    |    Tandai code as USED
          |                                                                    |    Terbitkan Access Token
          | 8. Return JSON (access_token, refresh_token, expires_in)          |
          |<-------------------------------------------------------------------|
          |                                                                    |
          | 9. GET /oauth/userinfo (Header: Bearer zqv_at_...)                 |
          |------------------------------------------------------------------->|
          | 10. Return Profile JSON (id, email, name, avatar, whatsapp, etc.)  |
          |<-------------------------------------------------------------------|
```

---

## 3. Skema Database (Prisma Models)

Penambahan 4 model baru pada `prisma/schema.prisma`:

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
  allowed_redirect_uris String   @db.Text // JSON Array string: ["https://app.com/callback"]
  allowed_origins       String?  @db.Text // JSON Array string: ["https://app.com", "http://localhost:3000"]
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
  code_challenge_method String?  @db.VarChar(10) // 'S256' | 'plain'
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

---

## 4. Spesifikasi API & Endpoint

### 4.1 `GET /oauth/authorize`
- **Maksud:** Titik masuk otorisasi OAuth2.
- **Query Parameters:**
  - `client_id` (Wajib): ID Klien yang terdaftar.
  - `redirect_uri` (Wajib): URL tujuan setelah otorisasi (wajib cocok persis dengan whitelist).
  - `response_type` (Wajib): Harus `code`.
  - `scope` (Opsional, default `profile email`): Izin yang diminta.
  - `state` (Opsional/Disarankan): Nilai acak pelindung CSRF dari client.
  - `code_challenge` (Opsional untuk confidential client, Wajib untuk PKCE public client).
  - `code_challenge_method` (Opsional, `S256` atau `plain`, default `S256`).
- **Alur Kerja:**
  1. Validasi `client_id` (wajib aktif di DB) dan `redirect_uri` (wajib ada di `allowed_redirect_uris`).
  2. Jika user belum memiliki sesi login di `req.session.user_id`, redirect ke `/login?return_to=<encodeURIComponent(req.originalUrl)>`.
  3. Jika user sudah login:
     - Jika `client.is_trusted === true` ATAU user sudah menyetujui di `oauth_user_consents`: langsung terbitkan `auth_code`, buat record di `oauth_auth_codes` (expired 10 menit), lalu redirect ke `redirect_uri?code=zqv_code_...&state=...`.
     - Jika belum: render halaman Svelte SPA `/oauth/authorize` (atau `#/oauth/authorize`) untuk menampilkan *Consent Dialog*.

### 4.2 `POST /oauth/consent/decision`
- **Maksud:** Endpoint internal yang dipanggil oleh frontend Consent Screen saat user mengklik "Izinkan / Lanjutkan" atau "Batal".
- **Body:**
  - `client_id`, `redirect_uri`, `scopes`, `state`, `code_challenge`, `code_challenge_method`, `allow: boolean`.
- **Response:**
  - Jika `allow === true`: Simpan consent ke `oauth_user_consents`, terbitkan `auth_code`, kembalikan `{ redirect_to: "redirect_uri?code=...&state=..." }`.
  - Jika `allow === false`: Kembalikan `{ redirect_to: "redirect_uri?error=access_denied&state=..." }`.

### 4.3 `POST /oauth/token`
- **Maksud:** Penukaran Authorization Code atau Refresh Token menjadi Access Token.
- **Headers:** `Content-Type: application/x-www-form-urlencoded` atau `application/json`.
- **Parameter:**
  - `grant_type` (Wajib): `authorization_code` atau `refresh_token`.
  - `client_id` (Wajib).
  - `client_secret` (Wajib jika client memiliki secret / confidential).
  - `code` (Wajib jika `grant_type === 'authorization_code'`).
  - `redirect_uri` (Wajib jika `grant_type === 'authorization_code'`).
  - `code_verifier` (Wajib jika saat authorize mengirimkan `code_challenge`).
  - `refresh_token` (Wajib jika `grant_type === 'refresh_token'`).
- **Validasi PKCE:**
  - Jika `code_challenge_method === 'S256'`: Verifikasi bahwa `Base64URLEncode(SHA256(code_verifier)) === code_challenge`.
  - Jika `plain`: Verifikasi `code_verifier === code_challenge`.
- **Response (200 OK):**
  ```json
  {
    "access_token": "zqv_at_9c72f1...",
    "token_type": "Bearer",
    "expires_in": 2592000,
    "refresh_token": "zqv_rt_81b3a...",
    "scope": "profile email"
  }
  ```

### 4.4 `GET /oauth/userinfo` (Alias: `GET /api/v1/oauth/userinfo`)
- **Maksud:** Mengambil data profil user pemilik token.
- **Headers:** `Authorization: Bearer <access_token>`
- **Response (200 OK):**
  ```json
  {
    "sub": 45,
    "id": 45,
    "name": "Budi Santoso",
    "email": "budi@example.com",
    "avatar": "https://appcenter.ziqva.com/uploads/...",
    "verified": true,
    "whatsapp": "081234567890",
    "company": "Ziqva Lab",
    "created_at": 1726740000
  }
  ```

### 4.5 `POST /oauth/revoke`
- **Maksud:** Mencabut token secara manual (RFC 7009).
- **Body:** `token`, `token_type_hint` (`access_token` atau `refresh_token`).
- **Response:** `{ "revoked": true }`.

---

## 5. Panel Manajemen Admin (`AdminOAuthClients.svelte`)

### 5.1 Fitur Admin:
1. **Daftar Aplikasi (Clients Table):**
   - Menampilkan Logo, Nama Aplikasi, Client ID, Tipe (Public PKCE / Confidential Secret), Trusted Badge, Status (Active/Inactive), dan Tanggal Dibuat.
2. **Modal Registrasi / Edit Aplikasi:**
   - **Nama Aplikasi** (misal: "Ziqva Desktop Pro")
   - **Deskripsi Aplikasi**
   - **Icon URL / Upload Icon**
   - **Allowed Redirect URIs** (Multi-input / baris baru)
   - **Allowed Origins** (Untuk CORS frontend SPA/Electron)
   - **Default Scopes** (`profile`, `email`, `whatsapp`, `licenses`)
   - **Switch: Trusted / First-Party App** (Bypass consent jika aktif)
   - **Switch: Status Aktif**
3. **Modal Reset Client Secret:**
   - Menghasilkan secret baru cryptographically random 64-karakter, menampilkan sekali kepada admin dengan tombol Copy & peringatan keamanan.
4. **Hapus Aplikasi:**
   - Menghapus client beserta otomatis mencabut semua token aktif yang terkait.

---

## 6. Antarmuka Layanan Login & Persetujuan (Consent Screen)

### 6.1 `OAuthConsent.svelte`
- Desain *liquid-glass* bertema ganda (Light/Dark mode) yang elegan dan bersih.
- Menampilkan:
  - Header: Identitas Ziqva SSO ("Lanjutkan dengan Akun Ziqva").
  - Identitas Akun Aktif: Avatar, Nama, dan Email user yang sedang login dengan link "Ganti Akun" (`/login?return_to=...`).
  - Identitas Aplikasi Pemohon: Icon dan Nama Aplikasi Klien.
  - Ringkasan Hak Akses (*Requested Permissions*):
    - 👤 Mengakses nama dan foto profil Anda
    - ✉️ Mengakses alamat email Anda
    - 📱 Mengakses nomor WhatsApp dan data profil (jika diminta scope terkait)
  - Tombol Tindakan:
    - **Lanjutkan / Izinkan** (Primary Button dengan efek sliding / glow)
    - **Batal** (Mengarahkan kembali ke `redirect_uri` dengan `error=access_denied`)

---

## 7. Keamanan & Kebijakan Anti-Regression

1. **Hashing & Secret Storage**: Client secret disimpan dalam bentuk hash yang aman (SHA-256 / bcrypt) di database. Secret asli hanya ditunjukkan 1x saat generate/reset.
2. **Strict URI Matching**: `redirect_uri` diverifikasi secara *exact match* terhadap daftar whitelist yang didaftarkan admin untuk mencegah *open-redirect vulnerabilities*.
3. **Single-Use Authorization Code**: Auth code hangus setelah digunakan sekali (*one-time use*) dan otomatis expired dalam 10 menit.
4. **Replay Protection**: Jika auth code yang sudah digunakan dicoba ditukar kembali, sistem mencurigai replay attack dan menolak request.
5. **CORS Whitelist**: Endpoint `/oauth/token` dan `/oauth/userinfo` menerapkan header CORS dinamis berdasarkan `allowed_origins` milik client yang terdaftar.
6. **Integritas Sistem Eksisting**:
   - Seluruh rute otorisasi berada di `/oauth/*` dan controller baru `src/controllers/oauthController.ts`.
   - Modifikasi pada rute login member (`src/controllers/memberController.ts`) hanya menambahkan penanganan parameter `return_to` agar setelah user sukses login/register, mereka dialihkan kembali ke alur otorisasi OAuth tanpa mengganggu login normal.

---

## 8. Rencana Pengujian & Verifikasi

1. **Prisma Migration**: `pnpm prisma db push` dan `pnpm prisma generate` untuk memvalidasi skema MySQL.
2. **Automated E2E Simulation Test**: Menambahkan skrip simulasi pengujian otomatis `scripts/test-oauth-sso.ts` untuk menguji:
   - Pembuatan OAuth Client oleh Admin.
   - Simulasi alur authorize -> generation code -> penukaran token (PKCE & Client Secret).
   - Pengambilan userinfo via Bearer token.
   - Simulasi penolakan / invalid redirect URI / expired code / revoked token.
3. **Browser Verification**: Menguji UI Admin OAuth Clients, Consent Screen, dan integrasi login/return_to secara langsung.
