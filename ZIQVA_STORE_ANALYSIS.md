# ZIQVA Store — Development Snapshot & Analysis

Date: 2026-01-24

This document consolidates the repository state and the cumulative changes performed up to this snapshot. It is intended as a single source of truth for hand-offs and for future developers to avoid repeating context questions.

---

## 1) Executive summary
- Project: Node.js + Express + TypeScript server-rendered app.
- ORM: Prisma -> MySQL (connection via `DATABASE_URL` in `.env`).
- Payment gateway: Xendit (Invoices & Payment Requests) via a dedicated service module.
- Sessions: MySQL-backed sessions using `express-mysql-session` (configured in `src/app.ts`).
- New member features: login, register, dashboard, orders listing, profile, device/license management, download center.
- Admin features: payment creation page, payments list, trial creation page, Xendit webhook handler.
- Tooling: ESLint + @typescript-eslint, Prettier, Husky + lint-staged integration.

---

## 2) Change log (what changed and where)
The following is a concise map of the most significant changes and where to find them.

- App bootstrap & sessions
  - `src/app.ts` — Added MySQL session store using `express-mysql-session`. Root `/` redirects to `/member/login`.

- Member area (frontend & routes)
  - `src/routes/memberRoutes.ts` — New member routes: login, register (`/member/register`), dashboard, orders, profile, device page, order pay action, downloads.
  - `src/controllers/memberController.ts` — Member login/register logic, session handling, `showOrders`, `showDownloads` (fetch from Ziqva server), `payOrder`.
  - Views in `src/views/` for member pages: `member-login.ts`, `member-register.ts`, `member-dashboard.ts`, `member-orders.ts`, `member-profile.ts`, `member-downloads.ts`, plus `components/member-sidebar.ts`.

- Device & License
  - `src/controllers/deviceController.ts` — `checkDeviceStatus` endpoint (legacy-compatible JSON but enriched with String dates), `activateLicense` (enforces strict One-Time Trial, allows Paid License transfer).
  - `src/views/device-license.ts` — render user's devices/licenses, copy license key, edit `machine_id`.

- Admin & Payments
  - `src/controllers/adminController.ts` — Admin login/dashboard, payment creation, payments list, trial generation (`showCreateTrial`, `processCreateTrial`), and webhook handler.
  - `src/views/` — `payment-create.ts`, `payments-list.ts`, `admin-create-trial.ts` (includes product & duration selection).

- Xendit integration
  - `src/services/xenditService.ts` — encapsulates `createInvoice`, `createPaymentRequest`, `getPaymentRequest`, `extractPaymentDetails`, `verifyWebhookToken`.
  - `src/config/xendit.ts` — Xendit configuration (keys and callback URLs read from `.env`).

- File & Download Services
  - `src/services/downloadService.ts` — Scrapes `http://download.ziqva.com` directory listing, parses HTML to JSON, detects file types/sizes, and constructs secure HTTPS download links.

- Database / data migration
  - `migrate-*` utilities (e.g., `migrate-order-list-json.ts`, `migrate-fast.ts`, etc.) — scripts to normalize or decrypt JSON fields and migrate legacy encrypted data.
  - `backup/ziqva_labs.sql` — an existing DB dump.
  - `backup/schema_backup.sql` — latest schema-only backup (created 2026-01-24).

- Tooling / Dev experience
  - `package.json` — added `lint`, `format`, Husky `prepare` script, and `lint-staged` config; devDependencies for ESLint and TypeScript tooling.

---

## 3) Detailed behavioral / implementation notes

Frontend
- Views are server-rendered TypeScript template strings (no SPA) and use utility CSS classes resembling Tailwind/Vanilla CSS. Templates are in `src/views/*` and are composed via `baseLayout`.
- `member-downloads`:
  - Scrapes backend service.
  - Displays files in a Grid Layout (Glassmorphism).
  - Auto-icons based on file extension (.exe, .dmg, .zip).
  - Links point to `https://download.ziqva.com/setup-windows-bin/x86/...`.
- `member-register`:
  - Validates password confirmation client-side.
  - Creates user with `verified: true` default.

Backend
- Session store in `src/app.ts` uses a MySQLStore object with host/credentials (taken from `.env` or explicit config). Cookies are set `maxAge = 3 days`.
- `DeviceController`:
  - `checkDeviceStatus`: Returns device status. IMPORTANT: Returns dates as strings (e.g., "24 Januari 2026") to avoid Unix Epoch confusion. Invalid timestamps <= 0 return "-".
  - `activateLicense`:
    - **Trial**: Checks if `machine_id` is already set. If yes, rejects ("Kode trial tidak bisa diaktifkan 2x").
    - **Paid**: Allows updating `machine_id` to support rewriting/transferring license.
- `AdminController`:
  - `processCreateTrial`: Generates random alphanumeric tokens (prefix `TRIAL-`), sets expiry based on duration (Hour/Day/Month), inserts to `trial` table with `user: "WAITING_ACTIVATION"`.

Xendit
- `xenditService` abstracts differences between Invoice and Payment Request responses and returns a normalized set of fields (paymentRequestId, paymentUrl, vaNumber, qrString, expiresAt).
- Webhook verification uses `xenditConfig.webhookToken`.

Database & data handling
- The schema includes `order_list` with fields: `items` (JSON text), `total_amount`, `payment_request_id`, `payment_id`, `payment_url`, `paid_at`, `payment_expires_at`.
- `device` table holds `order_id`, `email`, `expired`, `machine_id`, `duration`, `label` and is used for license activation.
- `trial` table holds `token`, `product`, `expired`, `created`, `machine_id`, `user`.
- `user` table holds `email`, `password` (plaintext currently), `name`, `company`, `whatsapp`, `verified`.

---

## 4) Database changes & backups (what was done)

- Backups
  - `backup/ziqva_labs.sql`: Full dump (historical).
  - `backup/schema_backup.sql`: Schema-only dump (latest state).

- Schema changes
  - The primary schema is `prisma/schema.prisma`. No automated `prisma migrate` script is included in the snapshot — migrations and one-off SQL changes were performed directly (see notes below).

- Data migrations
  - Multiple `migrate-*.ts` scripts were executed to normalize JSON and decrypt legacy-encrypted values. These scripts were run directly against the remote MySQL database (CLI / Node scripts) and used the `DATABASE_URL` environment variable loaded from `.env`.

Notes about terminal-based schema/data changes:
- Any direct schema manipulation (if performed) was executed via the MySQL CLI or `mysqldump` and one-off SQL statements. When that was the case the execution steps were:
  1. Load environment from `.env` (the repository `.env` contains `DATABASE_URL` pointing to the MySQL instance used for development).
  2. Execute `mysqldump` or `mysql` commands directly from a shell using the parsed credentials or `prisma db pull` where applicable.

Example command used earlier to create schema backup:
```
npm run backupdb:scheme
# exec: mysqldump --no-data --skip-ssl -h ... -u ... -p... ziqva_labs > backup/schema_backup.sql
```

If/when schema changes are needed in the future, prefer doing them via Prisma Migrations and versioning the migration files under source control. If direct SQL is used, log the exact SQL and the time/executor in this markdown.

---

## 5) Developer habits & preferences (observed)
- Interaction style: concise, direct, and expects the agent to make edits and run them (pair-programmer style). Prefers minimal but actionable progress updates.
- Frequently requested features/patterns:
  - Add server routes and views with minimal UX but working business logic.
  - Generate Xendit invoices and wire payments to `order_list` records.
  - Persist sessions to MySQL for multi-process reliability.
  - Migrate legacy encrypted data to plaintext for easier consumption.
  - **Strict Validation**: e.g., Trials cannot be reused (machine_id check).
  - **String Dates**: Prefers visual date strings in APIs to avoid client-side parsing issues with 1970/Epoch.
  - **Direct Links**: Prefers scraped links to use raw/direct structure.
  - **Interactive Sorting**: Expects tables to be sortable with visual feedback (arrows) and hover effects.
  - **Performance Reporting**: Prefers data-driven motivational reports that compare current stats to historical records.
- Coding preferences:
  - Use `Prisma` for DB access with proper type safety (avoid `any`).
  - Keep modifications small and focused (fix root cause vs ad-hoc patches).
  - Avoid extra commentary in commits; prefer concise code-level changes.
  - **Aesthetics**: Prefers "Glassmorphism" / Dark Mode / Vibrant Colors. Expects premium look and feel by default.
  - **Consistency**: Dashboard components (sidebar, cards, tables) must be consistent in style and behavior.
- AI assistant tone & behavior expectations:
  - **Natural & Friendly / Terse Execution**: Prefers Indonesian language, direct problem solving, and zero filler or cheerleading slogans ("tanpa bilang gas-gas"). When planning, make a concise implementation plan and execute immediately.
  - **9Router Image Generation**: Uses local 9Router AI gateway (`http://localhost:20128/v1/images/generations`, model `ag/gemini-3.1-flash-image`). All generated images are saved directly to `/Users/fiko942/Downloads/` without automatic database upload, so the user can test UI upload features manually.
  - **Resource Tuning (MySQL Connection Pool)**: Connection pool limit is strictly capped at `5` in both `DATABASE_URL` (`connection_limit=5`) and `sessionStore` (`connectionLimit: 5` in `src/app.ts`).
  - **Scoping & Layout Invariants**:
    - Topbar "Help / Tutorial" icon button is strictly member-only (`showHelp = true`) and hidden on all Admin pages (`showHelp = false`).
    - AdminSidebar navigation labels (e.g. `Affiliate Management`) must always remain strictly on a single line with `white-space: nowrap` and normalized zero margin.
  - **Git Branch Invariant**: Target branch is strictly `reborn` (never push to `master`).
  - **Proactive Problem Solver**: Values an agent that fixes technical hurdles (ESLint, lint-staged, types) autonomously.
  - **Detail Oriented**: Attends to small details like typo fixes and UI micro-interactions without explicit prompts.
  - **Single Source of Truth**: Treats `ZIQVA_STORE_ANALYSIS.md` and `docs/CONTEXT_SNAPSHOT.yaml` as the ultimate references for context and project state.

---

## 6) Immediate outstanding items & recommended next steps
1. **Harden Authentication**: Segera migrasi password plaintext di tabel `user` ke format hash (Bcrypt) untuk keamanan production.
2. **ESLint Cleanup**: Sebagian besar error `unsafe-*` sudah dibersihkan di module affiliate. Tetap lakukan scan berkala pada module lama.
3. **Automated Payout Job**: Pertimbangkan untuk membuat cron job yang mengotomatisasi perubahan flag `already_paid` di `affiliate_transaksi` saat payout diproses admin.
3. Harden Xendit error handling and retries for invoice creation.
4. Migrate direct DB changes into a repeatable Prisma migration workflow if schema modifications are needed.
5. Remove any runtime dependency to the external PHP decrypt API after full migration; implement Node-native encryption if needed.

---

## 7) Where to look for more details
- `PROJECT_PLAN.md` — contains earlier snapshots and explanatory notes on migration and backups.
- `src/services/xenditService.ts` — Xendit integration and normalization logic.
- `src/services/downloadService.ts` — File scraping and parsing logic.
- `src/controllers/*.ts` — implementation of business logic (member/admin/device controllers).
- `src/views/` — all UI templates.
- `migrate-*.ts` scripts — migration utilities used for bulk changes.

---

This file is intentionally additive: do not delete prior historical snapshots in the repository. If you need further breakdown (e.g., per-file diff list or a changelog), I can generate a detailed diff + timeline next.


# Rencana Inisialisasi Project Node.js (AppCenterV2)

Untuk memastikan inisialisasi yang "matang" dan robust, saya menyarankan struktur berikut. Mohon konfirmasinya sebelum saya mengeksekusi perintah.

## Opsi 1: Backend Service (Fokus API & DB)
Cocok jika ini adalah server utama yang akan melayani berbagai client (Web, Mobile, dll).
- **Framework**: Express.js (Standar industri, stabil) atau Fastify (Performa tinggi).
- **Database**: PostgreSQL (Relasional, sangat robust) atau SQLite (File-based, mudah untuk development awal).
- **ORM**: Prisma (Modern, type-safe, memudahkan manajemen database schema).
- **Struktur**: Modular (Routes, Controllers, Services, Middlewares).
- **Tooling**: ESLint, Prettier, Dotenv untuk manajemen environment variable.

## Opsi 2: Fullstack App (Next.js)
Cocok jika Anda ingin membangun Web App sekaligus API dalam satu project.
- **Framework**: Next.js (React framework, support API Routes).
- **Database & ORM**: Prisma dengan SQLite/PostgreSQL.
- **Frontend**: Menggunakan CSS Modern sesuai panduan (Vibrant, tidak menggunakan Tailwind kecuali diminta).

## Pertanyaan Saya:
1. Apakah Anda prefer **Opsi 1 (Backend Only)** atau **Opsi 2 (Fullstack)**?
2. Untuk Database, apakah kita mulai dengan **SQLite** (simpel, tanpa setup server DB terpisah) atau langsung ke **PostgreSQL/MySQL**?

Saya siap mengeksekusi segera setelah Anda memilih. Rekomendasi saya untuk "Project Node.js dengan API dan DB" yang solid adalah **Opsi 1 (Express + Prisma + SQLite)** untuk awal yang cepat namun mudah di-scale ke Postgres nantinya.

## Snapshot Implementasi (Completed)

Berikut adalah status terakhir implementasi project yang telah diselesaikan:

### 1. Arsitektur & Teknologi
- **Core**: Node.js dengan **Express.js**.
- **Language**: **TypeScript** untuk keamanan tipe data.
- **ORM**: **Prisma** (Connected to MySQL Production).
- **Structure**: MVC Pattern (`src/controllers`, `src/routes`, `src/config`).

### 2. Fitur Utama
- **Always Allow Device Authorization**:
    - **Endpoint**: `POST /device/status` (Direct root path, no `/api/v1` prefix).
    - **Logic**: Mencari device di database. Jika ditemukan, return data asli. **Jika TIDAK ditemukan/Expired, return `registered: true`** dengan data dummy (`auto-authorized@ziqva.com`).
    - **Client Compatibility**: Struktur JSON response disesuaikan persis dengan kebutuhan client legacy (`tobelsoft.data.registered`).

### 3. Konfigurasi Server & Build
- **Environment**:
    - Support loading `.env` dari berbagai path (dev `../../.env` vs prod `../.env`).
    - **Database URL**: Dioptimalkan dengan `connect_timeout=60`, `pool_timeout=60`, `connection_limit=20` untuk stabilitas.
- **Build Script (`npm run build`)**:
    - Membersihkan folder `dist`.
    - Kompilasi TypeScript.
    - Copy `.env` dan `package.json` ke `dist`.
    - **Auto-copy Prisma Engine**: Menyalin binary `libquery_engine-debian-openssl-3.0.x.so.node` agar jalan di server Linux Debian.

### 4. Deployment
- Project siap deploy menggunakan folder `dist`.
- Command di server:
  ```bash
  cd dist
  npm install --production # (Optional, dependencies)
  npm start
  ```

---

## Snapshot 2 - Enkripsi & Backup (21 Januari 2026)

### 1. Enkripsi Database Ditemukan
- **Masalah**: Data di database (email, name, dll) terenkripsi menggunakan CI3 Encryption Library.
- **Konfigurasi CI3**:
  - Cipher: `aes-256`
  - Mode: `ctr`
  - Driver: `mcrypt`
  - Key: `K9_VoB8XExZ2z3jX90XIi7L` (dari `application/config/config.php`)

### 2. Solusi Dekripsi
- **PHP API Endpoint**: `http://test.streampeg.com/index.php/`
  - Method: `POST`
  - Body: `text={encrypted_string}`
  - Response: `{"decoded_text": "decrypted_value"}`
- **Node.js Utility**: `src/utils/encryption.ts`
  - Function `decrypt(encryptedText)` - Mengirim request ke PHP API dan return decoded text.
  - Contoh hasil dekripsi:
    - `ccc5c98...` → `tobellord@gmail.com`
    - `6114a8a...` → `rannezh@gmail.com`

### 3. Database Backup
- **File**: `backup/ziqva_labs.sql`
- **Ukuran**: 53 MB
- **Tanggal**: 21 Januari 2026
- **Command**: `mysqldump -h 127.0.0.1 -u fiko -pYourDbPassword123 --skip-ssl ziqva_labs > backup/ziqva_labs.sql`

### 4. Files Created/Modified
- `src/utils/encryption.ts` - Utility untuk encrypt/decrypt menggunakan PHP API
- `backup/ziqva_labs.sql` - Full database backup
- `.gitignore` - Updated (include .env, exclude node_modules, dist, generated)

### 5. Next Steps
- [x] ~~Migrasi data: Decrypt semua data terenkripsi dan simpan dalam format baru~~ ✅ DONE
- [ ] Implement native Node.js encryption (tanpa dependency ke PHP)
- [ ] Update deviceController untuk menggunakan data yang sudah di-decrypt

---

## Snapshot 3 - Migrasi Database Dekripsi (21 Januari 2026, 14:14)

### 1. Migrasi Berhasil
Data terenkripsi di database berhasil didekripsi menggunakan script paralel 20 thread.

### 2. Hasil Migrasi

| Table | Records | Decrypted | Skipped | Errors |
|-------|---------|-----------|---------|--------|
| `device` (email) | 9,262 | 8,781 | 481 | 0 |
| `device_online_status` (user) | 406 | 393 | 13 | 0 |

**Total: 9,668 records diproses, 9,174 didekripsi, 0 error**

### 3. Script Migrasi
- **File**: `migrate-fast.ts`
- **Features**:
  - 20 parallel threads untuk kecepatan maksimal
  - Retry otomatis jika API gagal (max 10 retries)
  - Skip data yang sudah didekripsi
  - Progress realtime di CLI
- **Command**: `npx ts-node migrate-fast.ts`

### 4. Dekripsi API
- **Endpoint**: `POST http://test.streampeg.com/index.php/`
- **Request**: `text={encrypted_string}`
- **Response**: `{"decoded_text": "decrypted_value"}`

### 5. Status Database Saat Ini
- ✅ Tabel `device` - Semua email sudah plaintext
- ✅ Tabel `device_online_status` - Semua user data sudah plaintext
- ✅ Tabel `user` - Sudah di-migrate
- ✅ Tabel `products` - Sudah di-migrate

### 6. Next Steps
- [x] ~~Migrate tabel `user` (email, name columns)~~ ✅ DONE
- [x] ~~Migrate tabel `products` (name column)~~ ✅ DONE
- [ ] Update deviceController untuk menggunakan data plaintext langsung
- [ ] Remove dependency ke PHP decrypt API

---

## Snapshot 4 - Migrasi Database Lengkap (21 Januari 2026, 21:43)

### 1. Migrasi Lengkap Selesai
Semua tabel yang memiliki data terenkripsi telah berhasil didekripsi.

### 2. Hasil Migrasi Final

| Table | Kolom | Records | Decrypted | Skipped | Errors |
|-------|-------|---------|-----------|---------|--------|
| `device` | email | 9,262 | 8,781 | 481 | 0 |
| `device_online_status` | user | 406 | 393 | 13 | 0 |
| `invoice` | data, email | 9,289 | 9,289 | 0 | 0 |
| `order_list` | items, note, user, voucer | 8,948 | 0 | 8,948 | 0 |
| `products` | name, image, description | 19 | 19 | 0 | 0 |
| `token_device_activation` | token, taked_ip, user | 9,396 | 9,396 | 0 | 0 |
| `user` | email, password | 2,770 | 702 | 2,068 | 0 |
| `user` | ip, name, whatsapp, company | 2,770 | ~2,000 | ~770 | 0 |
| `verification_token` | name, email | 879 | 584 | 295 | 0 |
| `voucers` | created_by, code | 1 | 1 | 0 | 0 |

**Total: ~43,000+ records diproses, ~31,000+ didekripsi, 0 errors**

### 3. Script Migrasi yang Dibuat

| Script | Tabel | Kolom |
|--------|-------|-------|
| `migrate-fast.ts` | device, device_online_status | email, user |
| `migrate-invoice.ts` | invoice | data, email |
| `migrate-order-list.ts` | order_list | items, note, user, voucer |
| `migrate-products.ts` | products | name, image, description |
| `migrate-token-device.ts` | token_device_activation | token, taked_ip, user |
| `migrate-user.ts` | user | email, password, ip, name, whatsapp, company |
| `migrate-verification-token.ts` | verification_token | name, email |
| `migrate-voucers.ts` | voucers | created_by, code |

### 4. Status Database Setelah Migrasi
✅ **SEMUA DATA TERENKRIPSI SUDAH DIDEKRIPSI**

Semua tabel yang sebelumnya menyimpan data terenkripsi CI3 sekarang sudah dalam format plaintext.

### 5. Backup
- **File**: `backup/ziqva_labs.sql` (53 MB)
- **Tanggal**: 21 Januari 2026
- **Catatan**: Backup dibuat SEBELUM migrasi dekripsi

### 6. Next Steps
- [ ] Update deviceController untuk menggunakan data plaintext langsung
- [ ] Remove dependency ke PHP decrypt API
- [ ] Implementasi enkripsi baru dengan Node.js native (jika diperlukan)
- [ ] Backup database setelah migrasi selesai

---

## Snapshot 5 - Implementasi Member Area (22 Januari 2026)

### 1. Fitur Member Area Dibuat
- **Login Member**:
  - Route: `/member/login`
  - Auth: Email & Password (sesuai table `user`, status `verified=true`, `banned=false`).
  - Fitur: Preservasi input email saat error login.
- **Dashboard Member**:
  - Route: `/member/dashboard`
  - UI: Modern Dark Mode, Sidebar Navigation (Dashboard, Orders, Profile).
  - Data: Menampilkan Nama, Email, Avatar default.
- **Halaman Member Lainnya**:
  - **Orders** (`/member/orders`): Menampilkan placeholder riwayat pesanan.
  - **Profile** (`/member/profile`): Menampilkan info akun dan form ganti password (placeholder).

### 2. Perubahan Codebase
- **New Controller**: `src/controllers/memberController.ts`
- **New Routes**: `src/routes/memberRoutes.ts` (mounted di `/member`)
- **New Views**:
  - `src/views/member-login.ts`
  - `src/views/member-dashboard.ts`
  - `src/views/member-orders.ts`
  - `src/views/member-profile.ts`
  - `src/views/components/member-sidebar.ts`
- **App Config**: Register `memberRoutes` di `src/app.ts`.

### 3. Catatan Integrasi
- **Xendit**: Reverted perubahan `success_redirect_url` pada `XenditService` (manual adjustment).
- **Security**: Authentication masih menggunakan perbandingan password plaintext (sesuai legacy admin). Direkomendasikan migrasi ke Bcrypt.

### 4. Next Steps
- [ ] Implementasi logika Ganti Password (fungsional).
- [ ] Implementasi Fetch Real Data untuk halaman Orders.
- [ ] Migrasi password hashing (Bcrypt) untuk keamanan user.

---

## Snapshot 6 - Perbaikan Kualitas Kode & Linting Clean-up (22 Januari 2026)

### 1. Eliminasi Error Linting
- **Status Awal**: Project memiliki banyak error ESLint terkait type safety (`any`, `unsafe-assignment`, `unsafe-call`).
- **Status Akhir**: ✅ **0 Errors**. Clean linting pass (`npx eslint "src/**/*.{ts,tsx}"`).
- **Peringatan**: Tersisa warning terkait versi TypeScript (5.9.3) yang lebih baru dari support resmi ESLint, namun tidak berdampak pada fungsionalitas.

### 2. Perubahan Teknis Utama
- **Date Handling Standardization**:
  - **Masalah**: Kesalahan penggunaan method `Date` (`getTime()`) pada data timestamp epoch (number) dari database.
  - **Solusi**: 
    - **Storage**: Konsisten menyimpan **Epoch Seconds (number)** ke database (`Math.floor(Date.now() / 1000)`).
    - **Display**: Konversi ke `Date` object hanya saat diperlukan untuk formatting view.
- **Safe JSON Parsing**:
  - **Masalah**: Penggunaan `JSON.parse` yang menghasilkan tipe `any` secara implisit.
  - **Solusi**: Implementasi pattern `JSON.parse(str) as unknown as Interface` untuk type safety yang eksplisit.
- **Session Store Fixes**:
  - Memperbaiki inisialisasi `express-mysql-session` di `src/app.ts` untuk menghindari error `no-var-requires`.

### 3. Files Modified
- `src/app.ts` - Fix require & session initialization.
- `src/controllers/adminController.ts` - Fix Date handling & JSON parsing.
- `src/controllers/memberController.ts` - Fix `any` types & JSON parsing.

### 4. Next Steps
- [ ] Monitor log untuk memastikan handling tanggal berjalan sesuai ekspektasi di production.
- [ ] Pertimbangkan upgrade/downgrade dependensi TypeScript/ESLint agar versinya kompatibel penuh (menghilangkan warning).

---

## Snapshot 7 - Device & License Page Refinement (22 Januari 2026)

### 1. Refined License Display
- **Status Indicator**: "Expires" column now uses styled badges (EXPIRED/VALID) instead of just plain text messages.
- **Improved UX**: Clear visual cues for license status using colors (Red for Expired, Green for Valid).

### 2. Machine ID Management
- **View Implementation**: Created a dedicated view `src/views/member-device-edit.ts` for modifying Machine IDs.
- **Controller Logic**:
  - Implemented `showEditMachine` to render the edit form.
  - Implemented `processEditMachine` to handle the update logic securely.
  - Ensures users can only modify their own devices.
- **Routing**: Added GET and POST routes at `/member/device/:deviceId/edit-machine`.
- **Navigation**: Integrated "Change Machine ID" button in the licenses list, linking directly to the edit page for valid licenses.

### 3. Files Created/Modified
- `src/views/member-licenses.ts` - UI updates for status badges and action buttons.
- `src/views/member-device-edit.ts` - New view for editing Machine ID.
- `src/controllers/memberController.ts` - Added edit machine logic.
- `src/routes/memberRoutes.ts` - Registered new device management routes.

### 4. Next Steps
- [ ] Test the full flow of changing a machine ID.
- [ ] Implement password hashing (Bcrypt) as previously planned.

---

### 3. Files Modified
- `src/views/member-licenses.ts` - Button and tooltip implementation.

---

## Snapshot 10 - Responsive Sidebar & Revenue Fix (29 Januari 2026)

### 1. Responsive Sidebar Implementation
- **Admin**:
  - Update `admin-sidebar.ts` dengan toggle mobile (hamburger/dot menu), close button, dan overlay.
  - Logic vanilla JS untuk kelas `-translate-x-full` dan `fixed inset-y-0`.
  - Fixing posisi desktop menjadi `md:fixed` (sebelumnya sempat error `md:static` yang merusak layout).
- **Member**:
  - Refactoring sidebar hardcoded menjadi komponen reusable `src/views/components/member-sidebar.ts`.
  - Menerapkan logic responsif yang sama dengan admin sidebar.
  - Integration ke view: dashboard, orders, profile, downloads, affiliate, licenses, device-edit.

### 2. Dashboard Chart & Revenue Fix
- **Chart Library**: Migrasi dari Custom CSS Bars ke **Chart.js**.
  - Canvas element ID `revenueChart`.
  - Script inject via CDN `chart.js` di `dashboard.ts`.
  - Konfigurasi bar chart untuk menampilkan net revenue harian.
- **Revenue Calculation**:
  - **Issue**: Perhitungan awal menampilkan Gross Revenue yang tidak akurat karena belum dikurangi biaya affiliate.
  - **Fix**: Update `adminController.ts` untuk menghitung **Net Revenue** = (Total Amount Paid) - (Affiliate Income This Month).
  - **Debug**: Menambahkan log server sementara untuk memverifikasi angka kalkulasi.

### 3. Build & Run Workflow
- **Issue**: Menjalankan `npm start` (yang menggunakan folder build lama `dist/`) menyebabkan perubahan kode TypeScript terbaru tidak terbaca.
- **Correction**: Menggunakan `npm run dev` (`nodemon` + `ts-node`) selama cycle development untuk memastikan perubahan source code `src/` langsung aktif.

### 4. Code Changes
- `src/views/components/admin-sidebar.ts` - Responsive logic.
- `src/views/components/member-sidebar.ts` - New component.
- `src/views/dashboard.ts` - Chart.js integration.
- `src/controllers/adminController.ts` - Revenue calculation logic.
- `src/views/admin-create-trial.ts` - Duration unit select.

### 5. Next Steps
- [ ] Monitor angka revenue untuk memastikan keakuratan jangka panjang.
- [ ] Hapus log debug di `adminController.ts` jika sudah stabil.



### 1. Affiliate Dashboard & Performance Report
- **Performance Report Banner**:
  - Implementasi banner motivasi yang membandingkan **Komisi Pending** saat ini dengan **Pencairan Terakhir** (Last Payout).
  - Menampilkan data riil (nominal & persentase kenaikan/turun) dengan bahasa yang natural dan bersahabat.
  - Status Badge: `UP %`, `NEED MORE %`, `STABLE` untuk indikasi performa cepat.
- **Affiliate Dashboard**:
  - Menampilkan statistik total income, kupon, dan profile bank (edit button selalu visible).
  - Tabel transaksi dengan fitur sorting pada kolom Tanggal, Durasi, Harga, dan Komisi.
  - Logika sorting durasi yang cerdas (konversi menit ke format manusia sebelum diurutkan).

### 2. Payout History System
- **Combined View**: Menggabungkan data dari `affiliate_payouts` (PAID) dan agregat `affiliate_transaksi` (PENDING) ke dalam satu tabel tunggal.
- **Aggregation Logic**: Semua transaksi komisi yang belum dibayar (`already_paid: 0`) diakumulasikan menjadi satu baris "PENDING" di urutan teratas (saat sort descending).
- **Interactive UI**:
  - Header tabel dapat diklik untuk sorting (Asc/Desc) dengan ikon panah yang interaktif.
  - Baris Pending menampilkan `-` pada kolom tanggal namun tetap diposisikan paling atas untuk kemudahan akses.

### 3. Backend & Code Standard
- **Type Safety**: Migrasi penggunaan `any` ke tipe data Prisma yang eksplisit (`Prisma.affiliate_transaksiWhereInput`) dan interface khusus (`AffiliateTransaction`).
- **Maintenance**: Pembersihan *unused imports* dan variabel untuk memastikan kelulusan *ESLint check* saat pre-commit hook.
- **Data Aggregation**: Menggunakan Prisma Aggregates (`_sum`) untuk efisiensi penghitungan total/pending income.

### 4. Database Context
- **`affiliate_payouts`**: Menyimpan record pencairan komisi yang sudah diproses admin.
- **`affiliate_transaksi`**: Sumber utama komisi dari setiap penjualan. Kolom `already_paid` digunakan sebagai flag status (0 = Belum Cair/Pending, 1 = Sudah Cair/Paid).
- **Schema Backup**: Backup schema final telah dibuat di `backup/schema_backup_final.sql` mencakup seluruh struktur tabel terbaru.

### 5. Files Created/Modified
- `src/views/member-affiliate.ts` - New Dashboard & Performance report.
- `src/views/member-payout-history.ts` - New Payout history view with sorting.
- `src/controllers/memberController.ts` - Controller logic for affiliate features.
- `src/routes/memberRoutes.ts` - Affiliate endpoints registration.
- `docs/CONTEXT_SNAPSHOT.yaml` - Portable context for session continuation.

### 6. Technical Decisions
- **Manual Sorting Helper**: Memilih in-memory sorting untuk kolom durasi agar bisa menangani konversi menit ke string (man-readable) sebelum diurutkan.
- **Unified Payout Table**: Menggabungkan agregat `affiliate_transaksi` (pending) dengan data statis `affiliate_payouts` (paid) untuk memberikan gambaran keuangan yang lengkap kepada user dalam satu tampilan.
- **Always Visible Edit Icon**: Memastikan UI konsisten agar user tidak bingung mencari menu pengeditan data bank.

---

## Snapshot 11 - Admin Revenue Calculation Fix (30 Januari 2026)

### 1. Revenue Calculation Logic Overhaul
- **Masalah**: "Pendapatan Bulan Ini" di dashboard admin tidak akurat dibandingkan "Pendapatan 7 Hari Terakhir".
- **Analisa**: 
  - Data lawas (Legacy) memiliki kolom `total_amount` bernilai `null` atau `0` pada tabel `order_list`.
  - Agregasi SQL (`_sum`) hanya menghitung record yang memiliki nilai valid, menyebabkan *under-reporting*.
  - User menginginkan transparansi antara Gross Revenue dan potongan Affiliate.
- **Solusi Implementasi**:
  - **Smart Calculation Fallback**: Loop manual pada semua order yang lunas bulan ini.
    - Jika `total_amount > 0`: Gunakan nilai tersebut (Xendit Invoice Amount).
    - Jika `total_amount <= 0 / null`: Hitung manual (`item_price * duration_months - discount`).
  - **Breakdown Display**: Menambahkan indikator detail di kartu pendapatan: 
    - `Gross`: Total nilai transaksi masuk.
    - `Aff`: Total komisi affiliate yang harus dibayarkan bulan ini.

### 2. UI Updates
- **Admin Dashboard**:
  - Tampilan pendapatan sekarang menampilkan rincian Gross dan Affiliate deduction.
  - Perbaikan counter `completedPayments` yang sebelumnya hardcoded `0`.

### 3. Files Modified
- `src/controllers/adminController.ts`: Logic `showDashboard` updated dengan fallback calculation.
- `src/views/dashboard.ts`: UI update untuk menampilkan breakdown revenue dan passing data baru.

### 4. Verification
- Sample data affiliate verified (29 Januari 2026) confirm income data structure valid.
- Logic "Net Revenue" = Gross Inflow - Affiliate Outflow verified.

---

## Snapshot 12 - Public Download Page (30 Januari 2026)

### 1. New Feature: Public Download Center
- **Goal**: Menyediakan akses halaman download yang terbuka untuk umum di `/download`.
- **Look & Feel**: Replikasi tampilan `/member/downloads` namun disesuaikan untuk akses publik (tanpa sidebar, standalone layout).
- **Endpoint**: `GET /download`

### 2. Implementation Details
- **Controller**: `src/controllers/publicController.ts` (New) - Handle public endpoints.
- **View**: `src/views/public-downloads.ts` (New) - Standalone Grid Layout dengan Navbar sederhana.
- **Route**: Mounted di `src/app.ts` sebelum routes admin/member.

### 3. Usage
- Akses via URL: `domain.com/download`
- Menampilkan list file dari `downloadService` yang sama dengan member area.

---

## Snapshot 13 - Fix Member Logout (30 Januari 2026)

### 1. Issue Description
- **Problem**: User melaporkan error "Route not found" saat klik "Keluar" di sidebar member area.
- **Cause**: Tombol logout di sidebar mengarah ke `/logout`, sedangkan route yang terdaftar di sistem adalah `/member/logout`.

### 2. Fix Implemented
- **File**: `src/views/components/member-sidebar.ts`
- **Correction**: Mengubah href link logout dari `/logout` menjadi `/member/logout` agar sesuai dengan router Express.


---

## Snapshot 14 - Admin Affiliate Payout History (30 Januari 2026)

### 1. New Feature: Payout History Viewer
- **Goal**: Memudahkan admin melihat riwayat pembayaran komisi per affiliator langsung dari panel manajemen.
- **Access**: Tombol "Clock Icon" di setiap baris tabel Affiliate Management.
- **Endpoint**: `GET /admin/affiliate/history?email=...`

### 2. Implementation Details
- **Controller**: `showPayoutHistory` di `AdminController`.
- **View**: `src/views/admin-payout-history.ts` (New) - Tabel riwayat dengan pagination dan filter.
- **UI Update**: Penambahan tombol aksi di `src/views/admin-affiliate.ts`.


---

## Snapshot 15 - Refine Payout History (30 Januari 2026)

### 1. Updates
- **Sorting**: Menambahkan fitur sorting backend untuk kolom *Nominal* dan *Tanggal*.
- **UI Changes**: Menghapus kolom *Affiliator* dari tabel history (sesuai request) karena sudah difilter/redundant.
- **Pagination**: Backend-side pagination (20 items per page).

### 2. Implementation
- **Controller**: `AdminController.showPayoutHistory` sekarang menangani query params `sort` & `order`.
- **View**: `admin-payout-history.ts` menghapus kolom affiliator dan menambahkan header clickable untuk sorting.


---

## Snapshot 16 - Affiliate Management Pagination (30 Januari 2026)

### 1. Feature
- **Pagination**: Menambahkan pagination pada halaman utama Affiliate Management (`/admin/affiliate`).
- **Limit**: Maksimal 25 baris per halaman.
- **Processing**: Pagination dilakukan di backend (in-memory slice setelah sorting) untuk meringankan beban render frontend.

### 2. Implementation
- **Controller**: Logic slice array `processedMembers` berdasarkan query param `page`.
- **View**: Update UI tabel dengan kontrol navigasi Hal/Prev/Next.


---

## Snapshot 17 - Sorting by Joined Date (30 Januari 2026)

### 1. Update
- **Feature**: Menambahkan kemampuan sorting pada kolom *Bergabung* di tabel Affiliate Management.
- **Param**: `sort=memberSince`

### 2. Implementation
- **Controller**: Logic sorting `processedMembers` berdasarkan field `memberSince`.
- **View**: Header tabel *Bergabung* dibuat clickable dengan indikator icon sort.


---

## Snapshot 18 - Enhanced Search & Tooltips (30 Januari 2026)

### 1. Updates
- **Search**: Kolom pencarian sekarang mendukung pencarian berdasarkan *Kode Kupon* (serta email dan bank yang sudah ada).
- **UI UX**: Menambahkan tooltip deskriptif pada tombol aksi (Detail, History, Mark Paid) agar fungsi lebih jelas bagi admin.

### 2. Implementation
- **Controller**: Update query `OR` condition untuk include field `kupon`.
- **View**: Update placeholder search input dan title attributes pada tombol aksi.


---

## Snapshot 19 - Custom Tooltips (30 Januari 2026)

### 1. Feature Update
- **Tooltip**: Mengganti native browser tooltip (`title` attribute) dengan Custom CSS Tooltip.
- **Behavior**: Muncul instan (immediate) saat hover, tanpa delay bawaan browser.
- **Style**: Dark theme, backdrop blur, backdrop arrow, dan text lebih jelas.

### 2. Implementation
- **View**: `src/views/admin-affiliate.ts` menggunakan pattern `group/tooltip` dan `group-hover/tooltip:block` pada element absolute.


---

## Snapshot 20 - Payout Logic Fixed (30 Januari 2026)

### 1. Issue & Fix
- **Problem**: Logic "Tandai Sudah Dibayar" sebelumnya hanya update flag di tabel transaksi, tapi tidak mencatat riwayat payout (log) di `affiliate_payouts`.
- **Fix**: Update method `markAffiliateAsPaid` di AdminController.

### 2. Logic Flow
1.  Hitung total komisi pending (`affiliate_transaksi` where `already_paid=0`).
2.  Jika total > 0, buat record baru di `affiliate_payouts`.
3.  Update status `affiliate_transaksi` menjadi `already_paid=1` dan set `paid_at`.


---

## Snapshot 21 - Payment Confirmation UX (30 Januari 2026)

### 1. UX Improvement
- **Modal Confirmation**: Mengganti warning browser standar dengan Modal Konfirmasi yang proper (dark theme, backdrop blur).
- **Instant Feedback**: Saat konfirmasi pembayaran berhasil, status UI update otomatis tanpa reload halaman (AJAX).
    - Saldo pending menjadi 0.
    - Jumlah transaksi pending menjadi 0.
    - Tombol "Tandai Sudah Dibayar" menghilang otomatis (baik di baris tabel maupun di panel detail).
    - Tabel detail transaksi dikosongkan.

### 2. Technical
- **AJAX**: Fetch POST ke `/admin/affiliate/mark-paid`.
- **DOM Manipulation**: Update element by ID (`pending-amount-{id}`, `btn-pay-row-{id}`, dll) secara realtime.


---

## SAVE CONTEXT v3 (30 Januari 2026)
*Jika kamu tidak memiliki kemampuan menulis file secara langsung, HENTIKAN dan laporkan keterbatasan tersebut sebelum melakukan apa pun.*

### 1. Summary Changes
- **Feature**: Affiliate Management Enhancement.
- **Frontend Changes**:
    - `src/views/admin-affiliate.ts`: Implemented pagination (UX controls), sorting (clickable headers), search (added coupon support), and custom tooltip CSS. Added Payment Confirmation Modal.
    - `src/views/admin-payout-history.ts`: Created new view for payout history.
- **Backend Changes**:
    - `src/controllers/adminController.ts`:
        - `showAffiliateManagement`: Added in-memory pagination (25/page), sorting logic, and search by coupon.
        - `markAffiliateAsPaid`: Logic fix to create `affiliate_payouts` record and update transaction status to `already_paid=1`.
        - `showPayoutHistory`: Added backend sorting and pagination.
    - `src/routes/adminRoutes.ts`: Registered payout history route.
- **Database**:
    - table `affiliate_payouts`: Active usage for payment logs.
    - table `affiliate_transaksi`: Status update flow fixed.

### 2. Backup
- **DB Schema**: `backup/schema_backup_context_save_v3.sql`
- **Status**: Manual mysqldump executed due to permissions on default script.

---

## SAVE CONTEXT v4 (24 Agustus 2026)
*Full Workspace Deep Scan & Comprehensive System Preservation.*

### 1. Summary Scan & Roles
- **Total Controllers**: 5 (`adminController`, `memberController`, `deviceController`, `productController`, `publicController`).
- **Total Routes**: 6 route files mapping 48+ distinct endpoints.
- **Total Views**: 21 SSR templates with Dark Premium / Glassmorphism theme.
- **Total Database Models**: 30 tables in MySQL (`ziqva_labs`).
- **Roles Mapped**:
  1. **Public / Guest**: Akses download center publik, auth forms, product catalog.
  2. **Legacy Desktop Client / Bot**: Validasi HWID (`/device/status`) & aktivasi token (`/device/activation`).
  3. **Member**: Full access portal, orders, licenses, machine ID edit, downloads.
  4. **Affiliate Member**: Syarat >= 6 order dalam 180 hari, banner performa, custom kupon `ZQ...`, riwayat komisi & payout.
  5. **Administrator**: Dashboard Net/Gross Chart.js, manual invoice generator, payment approval, trial code generator, affiliate bulk payout AJAX modal, products CRUD.
  6. **System / Webhook**: Integrasi Xendit Invoices (`processOrderSuccess`).

### 2. File State & Docs Synchronized
- `docs/CONTROLLERS_DEEP_SCAN.md`: Complete method-by-method architectural specification for all 5 controllers.
- `docs/CONTEXT_SNAPSHOT.yaml`: Structural additive merge completed (Version 4).
- `docs/SYSTEM_FEATURE_MATRIX.md`: Complete subsystem architecture & endpoint matrix verified.
- `docs/SECURITY_AND_GAP_ANALYSIS.md`: Complete 100% workspace file inventory & security recommendations.
- `docs/XENDIT_INTEGRATION.md`: Xendit specifications & minute-based duration formulas verified.

### 3. Database Backup
- **Primary Schema Backup**: `backup/schema_backup.sql`
- **Historical Snapshot**: `backup/schema_backup_context_save_v4.sql`
- **Executed At**: 2026-08-24 14:19:04 WIB via `scripts/backup-schema.js` (mysqldump --no-data --skip-ssl)
- **Status**: Success (100% schema dump verified).

---

## SAVE CONTEXT v5 (24 Agustus 2026)
*Fitur Produk: Video Tutorial Multi-Link YouTube & Playlist Integrasi Lengkap.*

### 1. Summary Changes
- **Database Schema**:
  - Model `products` ditambahkan kolom `tutorials LONGTEXT NULL` di `prisma/schema.prisma` dan remote MySQL.
  - Regenerated Prisma Client (`src/generated/client`).
- **YouTube Parsing & Sanitization Engine**:
  - Created `src/utils/youtube.ts` dengan regex auto-parser untuk link YouTube (video reguler, Shorts, Playlist, dan URL `youtu.be`).
  - Serializer & deserializer JSON yang aman dan type-safe.
- **Admin Management (`/admin/products`)**:
  - Dynamic Tutorial Row Repeater pada modal **Tambah Produk** & **Edit Produk** (input Judul Video + URL YouTube + tombol Hapus).
  - Badge interaktif `🎬 N Video` di tabel produk untuk preview cepat video tutorial.
  - Modal **Interactive YouTube Player** dengan layout split (16:9 iframe player di kiri + playlist drawer interaktif di kanan).
  - Penanganan auto-stop video saat modal ditutup (membersihkan iframe src).
- **Member Surfaces**:
  - `/member/licenses`: Tombol `Lihat Tutorial (N)` pada tabel lisensi member + modal YouTube Player interaktif.
  - `/member/orders/create`: Banner preview interaktif saat produk yang memiliki tutorial dipilih pada dropdown checkout.
- **Verification & Quality**:
  - `npx tsc --noEmit` lulus 100% (0 errors).
  - Integration & unit test lulus 100%.

### 2. Files Created & Modified
- `prisma/schema.prisma` - Added `tutorials` to `products`.
- `src/utils/youtube.ts` - New YouTube parser and validator engine.
- `src/controllers/adminController.ts` - Tutorials parsing in product create/edit handlers.
- `src/controllers/memberController.ts` - Attached product tutorials to member licenses & order checkout.
- `src/views/admin-products.ts` - UI dynamic repeater + badge + YouTube Player modal.
- `src/views/member-licenses.ts` - UI tutorial button + member YouTube Player modal.
- `src/views/member-create-order.ts` - UI tutorial prompt + order YouTube Player modal.
- `docs/superpowers/specs/2026-08-24-product-tutorials-design.md` - Design specification.
- `docs/superpowers/plans/2026-08-24-product-tutorials-plan.md` - Implementation plan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Master context snapshot v5.

---

## SAVE CONTEXT v6 (24 Agustus 2026)
*Fitur Produk: Upload File Installer Software (Windows & Mac via SFTP) dengan File Preview & Replacement.*

### 1. Summary Changes
- **Database Schema**:
  - Model `products` ditambahkan kolom `installer_files LONGTEXT NULL` di `prisma/schema.prisma` dan diaplikasikan langsung ke MySQL remote `ziqva_labs`.
  - Regenerated Prisma Client (`src/generated/client`).
- **SFTP Remote Storage Engine**:
  - Dibuat `src/services/sftpService.ts` menggunakan `ssh2-sftp-client` untuk terhubung ke `127.0.0.1:22` (target path `/var/www/html/setup-windows-bin/x86`).
  - Fitur: Auto-sanitasi nama file, pemformatan ukuran file (MB/GB), pengecekan file exists, upload cepat via streaming, dan penghapusan file lama di server saat diganti.
  - Tipe file didukung: Windows (`.exe`, `.zip`, `.rar`, `.7z`) dan macOS (`.dmg`, `.pkg`, `.zip`, `.rar`, `.7z`).
- **Backend & Middleware**:
  - Dikonfigurasi `multer` untuk temporary file handling di `src/routes/adminRoutes.ts`.
  - Endpoint baru: `POST /admin/products/:id/upload-installer` dan `POST /admin/products/:id/delete-installer`.
  - Handler di `src/controllers/adminController.ts`: `uploadProductInstaller` dan `deleteProductInstaller`.
- **Admin Management UI (`/admin/products`)**:
  - Kolom **File Installer** dengan status badge 🪟 Windows dan 🍎 Mac.
  - Modal **Kelola File Installer Software (`#manageAppFileModal`)** dengan dual card (Windows & Mac):
    - Status badge aktif/belum ada.
    - Card info file aktif: nama file, ukuran, tanggal upload, tombol unduh langsung `download.ziqva.com`, dan tombol hapus file.
    - Form upload/ganti file dengan status spinner interaktif.
    - Input tambah produk tetap ringkas (opsional upload saat pembuatan produk baru).

### 2. Files Created & Modified
- `prisma/schema.prisma` - Added `installer_files` to `products`.
- `src/services/sftpService.ts` - New SFTP service for upload/delete/format installer files.
- `src/types/ssh2-sftp-client.d.ts` - TypeScript declaration for SFTP client.
- `src/routes/adminRoutes.ts` - Multer configuration and installer routes.
- `src/controllers/adminController.ts` - Upload and delete installer controller methods.
- `src/views/admin-products.ts` - Table installer column and installer management modal.
- `docs/superpowers/specs/2026-08-24-product-app-installer-upload-design.md` - Design specification.
- `docs/superpowers/plans/2026-08-24-product-app-installer-upload-plan.md` - Implementation plan.
---

## SAVE CONTEXT v7 (24 Agustus 2026)
*Fitur: Multi-File Installer Support per OS, High-Speed 5MB Chunked SFTP Upload, Redesigned Member Downloads Hub, & Modal Hardening.*

### 1. Summary Changes
- **Multi-File Installer Schema & Engine**:
  - `ProductInstallerFiles` mendukung array installer per OS: `{ windows: ProductInstallerInfo[]; mac: ProductInstallerInfo[] }`.
  - `sftpService.parseInstallerFiles` aman mem-parsing format legacy single object maupun multi-file array.
  - Dukungan penambahan multi-file dan penghapusan per file spesifik (`file_id` / `filename`) di server SFTP remote (`127.0.0.1`).
- **High-Speed Chunked Upload (5MB Chunks)**:
  - Frontend memotong file besar menjadi chunk 5MB dan mengunggahnya secara berurutan ke backend (`POST /admin/products/:id/upload-chunk`).
  - Backend menyusun kembali chunk di direktori temporary server dan mentransfer file utuh ke SFTP remote.
  - Multi-phase progress bar interaktif dengan indikator kecepatan transfer (MB/s), counter byte, persentase, dan status transfer SFTP.
- **Redesigned Member Downloads Hub (`/member/downloads`)**:
  - Menghapus tabel utilitas legacy lama di bagian bawah.
  - Tampilan card modern per produk dengan status ketersediaan installer Windows/Mac dan Video Tutorial.
  - Single-file: tombol unduh langsung dengan ukuran file.
  - Multi-file: tombol unduh membuka modal interaktif **Pilih Versi Download (`#downloadPickerModal`)** yang menampilkan daftar semua file installer.
  - Integrasi modal pemutar video YouTube Tutorial (`#downloadsTutorialModal`) dengan dukungan playlist dan `referrerpolicy="strict-origin-when-cross-origin"`.
  - Filter interaktif (Semua, Windows, Mac, Video Tutorial) dan pencarian live.
- **Bugfixes & Modal Hardening**:
  - Menghapus duplikasi deklarasi JavaScript di `src/views/admin-products.ts` dan menyelaraskan ID elemen DOM modal (`installer_modal_product_name`).
  - Menggunakan map data aman (`window.PRODUCTS_MAP`) untuk mempassing ID numerik ke event modal `openInstallerModal(${product.id})`, `openTutorialModal`, `openEditModal`.
  - Menyelaraskan endpoint chunk upload dan konfigurasi Multer `upload.any()` di `src/routes/adminRoutes.ts`.
  - Konfigurasi ESLint relaxed rules di `.eslintrc.cjs` dan passing build `pnpm run build` 100%.

### 2. Files Created & Modified
- `src/services/sftpService.ts` - Multi-file array schema, safe parser, and single-file deletion logic.
- `src/controllers/adminController.ts` - Multi-file chunked upload reassembly, upload fallback extractor, and per-file delete handler.
- `src/routes/adminRoutes.ts` - Registered `/products/:id/upload-chunk` & `/products/:id/upload-installer-chunk` with `upload.any()`.
- `src/views/member-downloads.ts` - Redesigned unified download center, multi-file version picker modal, tutorial video player modal, and responsive layout.
- `src/views/admin-products.ts` - Multi-file preview cards, 5MB chunked upload engine, and clean modal opener deduplication.
- `.eslintrc.cjs` - Configured relaxed rules for untyped express sessions and controller methods.
- `backup/schema_backup.sql` & `backup/schema_backup_context_save_v7.sql` - Updated database schema backup.
- `docs/CONTEXT_SNAPSHOT.yaml` - Updated context snapshot to version 7.

---

## SAVE CONTEXT v8 (26 Agustus 2026)
*Fitur: Menu Baru & Halaman Pusat Pembelajaran Video Tutorial Member (`/member/tutorials`) Terintegrasi Cinema Modal Player.*

### 1. Summary Changes
- **Member Navigation Update (`src/views/components/member-sidebar.ts`)**:
  - Ditambahkan menu navigasi baru **"Tutorial Video"** (`/member/tutorials`) dengan key aktif `'tutorials'` dan Crisp SVG icon kamera/play video.
- **Routing & Controller (`src/routes/memberRoutes.ts` & `src/controllers/memberController.ts`)**:
  - Didaftarkan endpoint `GET /member/tutorials`.
  - Ditambahkan handler `showTutorials` pada `MemberController` yang memuat produk aktif dari Prisma MySQL dan mem-parsing data tutorial YouTube.
- **YouTube Thumbnail Utility (`src/utils/youtube.ts`)**:
  - Dibuat fungsi helper `getYouTubeThumbnail` untuk menghasilkan URL thumbnail resmi YouTube (`hqdefault.jpg`) secara otomatis dari video ID maupun embed URL.
- **SSR View Video Learning Hub (`src/views/member-tutorials.ts`)**:
  - Banner statistik dinamis: Total Video, Total Software, dan Total Playlist.
  - Live search bar untuk filter judul video & nama produk secara instan tanpa reload halaman.
  - Filter pills untuk kategori produk dan jenis media (Semua, Single Video, Playlist).
  - Kartu video responsif dengan rasio 16:9, badge tipe video, thumbnail YouTube beresolusi tinggi, tag nama software, dan tombol play interaktif.
  - **Cinema Modal Player (`#tutorialCinemaModal`)**: Split layout dengan pemutar YouTube 16:9 responsive di sisi kiri dan drawer playlist seri video di sisi kanan untuk berpindah video secara instan.
  - Fitur auto-stop audio/video saat modal ditutup dan tautan langsung ke halaman Download Hub & Lisensi Aplikasi.
- **Browser Automation Verification (`chrome-devtools`)**:
  - Diverifikasi penuh menggunakan automated browser test: Login member `tobellord@gmail.com` / `tobel123`, navigasi ke `/member/tutorials`, interaksi live search, dan pemutaran Cinema Modal Player.
  - Tangkapan layar visual: `member-tutorials-grid-screenshot.png`, `member-tutorials-modal-screenshot.png`, `member-tutorials-filtered-screenshot.png`.

### 2. Files Created & Modified
- `src/views/member-tutorials.ts` - New SSR View for Member Video Learning Hub.
- `src/views/components/member-sidebar.ts` - Added "Tutorial Video" menu item.
- `src/routes/memberRoutes.ts` - Added route `GET /member/tutorials`.
- `src/controllers/memberController.ts` - Added `showTutorials` action.
- `src/utils/youtube.ts` - Added `getYouTubeThumbnail` helper.
- `scripts/verify-tutorials-browser.js` - Automated browser verification script.
- `docs/superpowers/specs/2026-08-26-member-tutorials-design.md` - Design specification.
- `docs/superpowers/plans/2026-08-26-member-tutorials-plan.md` - Implementation plan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Master context snapshot v8.

### 3. Git Branch Policy Invariant
- **Branch Aktif**: `reborn`
- **Aturan**: Seluruh pengembangan, commit, dan push ke remote GitHub wajib ditujukan ke branch `reborn`. Jangan pernah melakukan push ke branch `master`.

---

## 8) Snapshot: Svelte SPA Modernization, Orders Overhaul, Downloads Multi-OS, & Member Profile (2026-08-26)

### 1. Summary of Changes
- **Svelte SPA Client Architecture (`client/src/`)**:
  - Full Single Page Application (SPA) with `svelte-spa-router`, single-port Express server serving static dist assets alongside JSON API endpoints.
- **Member Profile Management (`client/src/lib/pages/Profile.svelte` & `src/controllers/memberController.ts`)**:
  - Halaman profil mandiri (`#/member/profile`) dengan avatar dinamis berinisial, data diri (nama, no. WhatsApp, perusahaan).
  - **Enforcement Email Terkunci**: Email akun bersifat permanen & tidak dapat diubah (dilindungi badge gembok).
  - **Ganti Password Aman**: Validasi password saat ini terhadap database, password baru minimal 6 karakter, konfirmasi password, toggle intip password, dan animasi loading.
  - Endpoint JSON: `GET /member/api/profile`, `POST /member/api/profile`, `POST /member/api/change-password`.
- **Pusat Unduhan Multi-OS & Multi-File (`client/src/lib/pages/Downloads.svelte` & `src/controllers/memberController.ts`)**:
  - Normalisasi installer files SFTP (`sftpService.parseInstallerFiles`).
  - Badge jumlah file OS (Windows & Mac) dan Modal Dialog Pemilih File Multi-Versi (.exe, .dmg, .zip) dengan direct download link.
- **Pesanan Saya Standardized Grid & Compact Actions (`client/src/lib/pages/Orders.svelte`)**:
  - Penomoran berurutan dinamis (`No 1, 2, 3...`) berbasis pagination.
  - Tombol aksi Lisensi & Unduh menjadi Icon-Only Buttons berukuran seragam (`w-8 h-8 rounded-xl`).
  - Tombol "Bayar Sekarang" disederhanakan menjadi "Bayar".
  - Standardisasi gap layout `<main>` yang selaras dengan seluruh halaman member.
- **Optimasi Pemilih Produk & Checkout Order Baru (`ProductDetail.svelte` & `CustomDropdown.svelte`)**:
  - Dropdown produk compact dengan input pencarian instan dan animasi loading spinner saat fetch data.
  - Pembatasan informasi Pengguna Aktif: Badge hanya tampil jika jumlah pengguna aktif `>= 500`.
  - Validasi kupon voucher akurat (mencocokkan `id` dan `product_id` di DB, mendukung case-insensitive, dan tombol "Terapkan" dengan spinner animasi "Cek...").
  - Perhitungan dinamis badge *"Hemat s/d X%"* berdasarkan akumulasi diskon produk dan kupon nyata (disembunyikan jika tidak ada diskon).
- **Perutean Tutorial Dinamis (`#/member/tutorials/:id`)**:
  - Setiap produk memiliki URL tutorial dedicated.
  - Link tutorial pada halaman order baru otomatis mengarah ke produk yang dipilih dan hanya tampil jika software memiliki materi tutorial.

- **Perbaikan Tema Terang Halaman Profil (`client/src/lib/pages/Profile.svelte`)**:
  - Menghilangkan warna statis gelap hardcoded. Menggunakan variabel CSS sistem (`var(--surface)`, `var(--surface-2)`, `var(--border)`, `var(--text)`, `var(--text-2)`, `var(--text-3)`).
  - Teks, input, label, badge, dan ringkasan pesanan & lisensi tampil bersih dan berbobot di mode terang maupun mode gelap.
- **Penyederhanaan Header Topbar (`client/src/lib/components/Topbar.svelte`)**:
  - Menggantikan tombol teks ganda ("Cari" & "Butuh bantuan?") dengan single icon button bantuan bulat (`w-8 h-8 rounded-full`).
  - Tinggi tombol diselaraskan presisi dengan pill toggle switch tema (32px).
  - Tautan langsung mengarah ke halaman video tutorial (`#/member/tutorials`).

### 2. Database Backup Verification
- **Script**: `npm run backupdb:scheme`
- **Output File**: `backup/schema_backup.sql`
- **Timestamp**: `2026-08-26T19:12:00+07:00`
- **Status**: Verified Schema Dump (MySQL 8.x, `ziqva_labs`).

### 3. Files Created & Modified in this Snapshot
- `client/src/lib/pages/Profile.svelte` - Light & Dark theme color fixes and profile management.
- `client/src/lib/components/Topbar.svelte` - Single 32px help icon button linking to tutorials.
- `client/src/lib/components/CustomSelect.svelte` - Dropdown Pagination Size Component.
- `client/src/App.svelte` - Registered `/member/profile` route.
- `client/src/lib/components/Sidebar.svelte` - Added "Profil Saya" navigation item and linked user footer.
- `client/src/lib/components/CustomDropdown.svelte` - Product picker with search filter, loading spinner, and >=500 threshold.
- `client/src/lib/pages/ProductDetail.svelte` - Dynamic savings calculation, coupon verification loading, and dedicated tutorial link.
- `client/src/lib/pages/Orders.svelte` - Normalized sequence numbering, icon-only action buttons, "Bayar" text.
- `client/src/lib/pages/Downloads.svelte` - Multi-OS multi-version modal file installer.
- `src/controllers/memberController.ts` - Added `apiGetProfile`, `apiUpdateProfile`, `apiChangePassword`, enhanced `apiCheckVoucher` and `apiGetProducts`.
- `src/routes/memberRoutes.ts` - Registered profile JSON API endpoints.
- `docs/CONTEXT_SNAPSHOT.yaml` - Master context snapshot v12.

---

## 9) Snapshot: Modern Svelte SPA Admin PIN Login Migration (2026-08-26)

### 1. Summary of Changes
- **Admin PIN Login Svelte Component (`client/src/lib/pages/AdminLogin.svelte`)**:
  - Halaman login PIN administrator mandiri (`#/admin/login`) berkonsep glassmorphism premium.
  - **6-Digit PIN Boxes**: 6 input terpisah dengan auto-advance, backspace navigation, arrow key navigation, dan paste clipboard listener.
  - **Tactile Numeric Keypad**: Tombol angka 0–9, tombol Clear (`C`), dan Backspace (`⌫`) untuk sentuhan layar / mouse.
  - **Masking Mode**: Toggle lihat PIN (`•` vs angka jelas).
  - **Micro-Interactions**: Animasi shake saat PIN salah, loading spinner saat verifikasi, dan auto-submit saat digit ke-6 terisi.
  - **Dual-Theme Support**: Variabel CSS sistem adaptif terhadap tema Terang dan Gelap via `ThemeToggle.svelte`.

---

## 142) Snapshot: Relocated Page Size Selector to Footer Pagination Bar & Smart Dropdown Alignment (2026-09-16)

### 1. Summary of Changes
- **Relocated Page Size Selector (`CustomSelect`) to Table Footer**:
  - Ditempatkan secara konsisten di baris footer pagination pada seluruh tabel: `Affiliate.svelte` (`#/member/affiliate`), `AffiliatePayouts.svelte` (`#/member/affiliate/payouts`), `Licenses.svelte` (`#/member/licenses`), dan `AdminUsers.svelte` (`#/admin/users`).
  - Menghilangkan duplikasi dropdown page size dari toolbar filter/search di bagian atas card agar header tetap bersih dan fokus pada pencarian dan filter status.
- **Smart Responsive Dropdown Alignment (`CustomSelect.svelte`)**:
  - Ditambahkan prop `align: 'left' | 'right' | 'auto'`.
  - Secara otomatis mendeteksi posisi viewport (`rect.left < 180` atau constrained right margin) untuk membuka menu secara presisi ke kiri atau ke kanan tanpa clipping atau horizontal overflow.
  - Perhitungan tinggi dinamis `estimatedMenuHeight` untuk transisi buka ke atas (`openUpward`) yang mulus saat dropdown berada di area footer.
- **Browser Automation Verification (`browser-skill` / `bsk`)**:
  - Dilakukan verifikasi visual end-to-end pada halaman Affiliate dan Licenses:
  - Membuka dropdown "Tampilkan: 10" di footer dan mengonfirmasi seluruh opsi menu (`10 / hal`, `20 / hal`, `50 / hal`) tampil lengkap mengambang di atas tabel dengan z-index optimal tanpa clipping.
- **Git Branch Invariant**:
  - Semua perubahan di-stage dan dipersiapkan untuk remote branch `reborn`.

---

## 143) Snapshot: Standardized Numbered Pagination with Arrow-Only Prev/Next (2026-09-16)

### 1. Summary of Changes
- **Unified Numbered Pagination across All Member & Admin Tables**:
  - Standarisasi penuh komponen pagination di: `Affiliate.svelte` (`#/member/affiliate`), `AffiliatePayouts.svelte` (`#/member/affiliate/payouts`), `Orders.svelte` (`#/member/orders`), `Licenses.svelte` (`#/member/licenses`), `MemberInvoices.svelte` (`#/member/invoices`), `Downloads.svelte` (`#/member/downloads`), `AdminUsers.svelte` (`#/admin/users`), `AdminProducts.svelte` (`#/admin/products`), `AdminCategories.svelte` (`#/admin/categories`), dan `AdminAffiliateHistory.svelte` (`#/admin/affiliate/history`).
- **Arrow-Only Previous & Next Buttons**:
  - Tombol Sebelumnya (Previous) dan Berikutnya (Next) diubah menjadi icon chevron arrow minimalis (`w-8 h-8 rounded-xl flex items-center justify-center`) dengan atribut aksesibilitas `aria-label` dan `title` yang jelas.
- **Centered Numbered Page Pills**:
  - Nomor halaman diletakkan rapi di tengah antara tombol panah Previous dan Next.
  - Halaman aktif disorot dengan pill biru solid berbayang halus (`bg-blue-600 text-white shadow-sm shadow-blue-500/30`), sedangkan halaman tidak aktif memiliki border adaptif tema terang/gelap (`w-8 h-8 rounded-xl text-xs font-bold`).
  - Halaman berjumlah banyak secara otomatis diringkas dengan ellipsis (`...`).
- **Browser Automation Verification (`browser-skill` / `bsk`)**:
  - Diverifikasi pada halaman Member Licenses, Affiliate, dan Orders:
  - Menguji klik perpindahan halaman (Halaman 1 ke Halaman 2), transisi aktif, navigasi panah kiri/kanan, dan kelengkapan visual.
- **Git Branch Invariant**:
  - Seluruh kode dikomit dan dipush ke remote branch `reborn`.

---

## 144) Snapshot: Redesigned Affiliate Payout & Coupon Modals (Pro Max Fintech UI) (2026-09-16)

### 1. Summary of Changes
- **Redesigned Payout Modal (`#payoutModal`) into Pro Max Fintech Experience**:
  - Mengeliminasi tampilan generic AI / template kotak putih datar.
  - **Live Virtual ATM / Bank Card Interactive Preview**:
    - Kartu virtual real-time bergradien resmi perbankan (`BCA` royal blue, `Mandiri` navy/gold, `BNI` teal/tangerine, `BRI` sapphire).
    - Dilengkapi metallic EMV chip, contactless wave icon, badge resmi kode bank, live nomor rekening monospaced (`1440 0177 3720 3`), live nama pemilik rekening uppercase, dan badge verifikasi status format (`Format Sesuai` vs `Wajib X digit`).
  - **Fast Bank Selector Grid**:
    - Grid 4 tombol bank resmi (`BCA`, `Mandiri`, `BNI`, `BRI`) dengan ring glow aktif dan digit format hint.
  - **Refined Form Inputs & Validation**:
    - Input nomor rekening dengan length counter dinamis (`13 / 13 digit`), input nama pemilik rekening dengan petunjuk sinkronisasi m-banking.
    - Banner jaminan keamanan enkripsi 256-bit & bebas potongan admin.
  - **Structured Modal Footer**:
    - Footer bar terpisah dengan border pemisah halus, tombol "Batal", dan tombol utama "Simpan Rekening" bergradien dengan ikon centang dan status loading spinner.
- **Redesigned Coupon Modal (`#couponModal`)**:
  - Dilengkapi **Live Ticket Voucher Preview** bergradien indigo/purple dengan garis pembatas perforasi putus-putus, badge diskon 10% pembeli & komisi 5% mitra, serta kode kupon live monospaced.
- **Browser Automation Verification (`browser-skill` / `bsk`)**:
  - Diverifikasi penuh pada halaman `http://localhost:5173/#/member/affiliate`.
  - Membuka modal rekening pencairan, validasi live card preview, interaksi pilih bank, dan modal kupon referral.
- **Git Branch Invariant**:
  - Seluruh perubahan dikomit dan dipush ke branch `reborn`.

---

## 145) Snapshot: Redesigned Affiliate Dashboard Stat Cards & Icons (Pro Max UI) (2026-09-16)

### 1. Summary of Changes
- **Redesigned 4 Hero Stat Cards on Affiliate Dashboard (`#/member/affiliate`)**:
  - Mengeliminasi ikon generik AI / template pastel dan warna teks pelangi acak.
  - **Card 1: Kupon Anda**:
    - Ikon tiket voucher presisi (`w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600`), kotak tiket interaktif dengan kode kupon penuh tanpa pemotongan canggung (`ASKDJKASJ12039`), tombol salin tactile, dan pill benefit diskon/komisi.
  - **Card 2: Komisi Berjalan (Pending Settlement)**:
    - Ikon jam pasir / settlement dompet digital presisi (`w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600`), badge status pending berdenyut, dan jadwal transfer otomatis awal bulan.
  - **Card 3: Total Komisi Cair (Revenue Growth)**:
    - Ikon tren pertumbuhan pendapatan (`w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600`), badge sukses, angka nominal hijau tebal, dan jumlah transaksi valid.
  - **Card 4: Rekening Pencairan (Bank Account Widget)**:
    - Ikon gedung bank resmi (`w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600`), badge bank resmi solid (`MANDIRI`), nomor rekening terformat rapi (`1440 0177 3720 3`), dan nama pemilik rekening.
  - **Hero Identity Banner**:
    - Menggantikan ikon 3 siluet generik dengan ikon jaringan kemitraan modern (*Partnership Network / Revenue Share*) bergradien biru-indigo berbayang elegan.
- **Browser Automation Verification (`browser-skill` / `bsk`)**:
  - Diverifikasi langsung pada browser di `http://localhost:5173/#/member/affiliate`.
- **Git Branch Invariant**:
  - Seluruh kode dikomit dan dipush ke remote branch `reborn`.

---

## 146) Snapshot: Eliminated AI Header Box & Polished Affiliate Page Typography (2026-09-16)

### 1. Summary of Changes
- **Eliminated Bulky Floating Banner Box on Affiliate Pages**:
  - Menghapus kotak banner mengambang dengan ikon 3 siluet generik pada `Affiliate.svelte` (`#/member/affiliate`) dan `AffiliatePayouts.svelte` (`#/member/affiliate/payouts`).
  - Mengadopsi header halaman natural yang konsisten dengan halaman lain (`Orders.svelte` dan `Licenses.svelte`):
    - Judul: **`Program Kemitraan Afiliasi`** (`text-2xl font-extrabold text-[var(--text)]`).
    - Subtitle: **`Bagikan kode kupon Anda ke calon pembeli & dapatkan komisi bersih 5% langsung pada setiap transaksi sukses.`**
    - Tombol aksi: **`Riwayat Penarikan Dana`** (tombol outline bersih dengan ikon dokumen).
- **Refined Value Proposition Cards in State 1 (Enrollment Gate)**:
  - Menggantikan teks angka mentah pada kartu pra-kemitraan dengan ikon SVG tajam dan teks nilai yang jelas (Kupon Diskon 10%, Komisi Bersih 5%, Pencairan Otomatis Bulanan).
- **Browser Automation Verification (`browser-skill` / `bsk`)**:
  - Memvalidasi tampilan header baru yang bersih, natural, dan proporsional langsung di browser.
- **Git Branch Invariant**:
  - Seluruh kode dikomit dan dipush ke remote branch `reborn`.

---

## 147) Snapshot: Comprehensive Superpowers Documentation & Production Readiness (2026-09-16)

### 1. Summary of Changes
- **Superpowers Specifications & Implementation Plan Synchronized**:
  - Diperbarui `docs/superpowers/specs/2026-09-16-affiliate-portal-modernization.md` dan `docs/superpowers/plans/2026-09-16-affiliate-portal-modernization.md` mendokumentasikan secara menyeluruh seluruh perombakan:
    1. Relokasi `CustomSelect` page size ke footer pagination bar dengan smart auto-alignment & dynamic upward opening.
    2. Standarisasi numbered pagination dengan tombol panah saja (`<` dan `>`), pill nomor halaman di tengah, dan ellipsis dinamis pada seluruh tabel member dan admin.
    3. Redesain modal rekening pencairan (`#payoutModal`) menjadi Pro Max Fintech UI dengan interactive live virtual ATM card preview (BCA, Mandiri, BNI, BRI), metallic EMV chip, contactless wave, dynamic spacing, cardholder embossing, dan 4-bank selector grid.
    4. Redesain modal kupon referral (`#couponModal`) dengan live ticket voucher preview dan quick code suggestions.
    5. Redesain 4 hero stat card dengan icon domain-driven (tiket voucher, jam pasir settlement, grafik revenue, gedung bank) dan kode kupon tanpa terpotong.
    6. Eliminasi banner box melayang bergaya AI dan adopsi tipografi halaman natural.
- **Verification & Build Health**:
  - Verifikasi kompilasi produksi `pnpm run build` sukses dengan 0 error.
  - Snapshot context v260 disimpan ke `docs/CONTEXT_SNAPSHOT.yaml`.
- **Git Branch Invariant**:
  - Seluruh perubahan dikomit dan dipush ke remote branch `reborn`.

---

## 148) Snapshot: Refined Affiliate Stat Cards to Compact Pro Max Metric Hierarchy (2026-09-16)

### 1. Summary of Changes
- **Compact Proportional Stat Cards (`Affiliate.svelte`)**:
  - Mengurangi padding berlebih dari `p-5 sm:p-6` menjadi `p-3.5 sm:p-4` yang proporsional, mengurangi gap antar kartu menjadi `gap-3 sm:gap-3.5`.
  - Mengeliminasi nested box tiket berukuran besar pada Card Kupon dan menggantikannya dengan baris monospaced ringkas beserta tombol salin inline.
  - Mengeliminasi teks daftar bank acak (`BCA • Mandiri • BRI • BNI`) pada Card Rekening Pencairan yang memakan ruang vertikal tanpa fungsi jelas.
  - Menyamakan ritme visual ke-4 kartu secara konsisten (Header Kategori & Status, Angka Metrik Utama Monospaced, Subtitle Single-Line), memangkas tinggi kartu hingga 50% sehingga tabel transaksi langsung terlihat tanpa scrolling panjang di desktop.
- **Browser Automation Verification (`bsk`)**:
  - Diverifikasi visual di Chrome desktop: tata letak seimbang, rapi, dan harmonis.
- **Git Branch Invariant**:
  - Seluruh perubahan dikomit dan dipush ke remote branch `reborn`.

---

## Snapshot 14 - Migrasi Admin Dashboard ke Svelte SPA Modern (26 Agustus 2026)

### 1. Migrasi Admin Dashboard ke Svelte
- **Frontend Svelte SPA Components**:
  - `AdminLayout.svelte` (`client/src/lib/components/AdminLayout.svelte`): Layout shell identik dengan Member Area (`Topbar.svelte` + `AdminSidebar.svelte` + responsive mobile drawer).
  - `AdminSidebar.svelte` (`client/src/lib/components/AdminSidebar.svelte`): Sidebar navigasi admin dengan token CSS `appcenter-theme.css`, menu manajemen sistem, link portal member, dan profile footer admin dengan logout.
  - `AdminDashboard.svelte` (`client/src/lib/pages/AdminDashboard.svelte`):
    - **Header**: Greeting admin dengan tombol aksi cepat (Tagihan Manual, Buat Trial, Katalog Produk).
    - **4 Stat Cards**: Pendapatan Bersih (dengan breakdown Gross & Affiliate), Total Pesanan (dengan status lunas/pending), Affiliator Baru (dengan total aktif bertransaksi 30 hari), dan Komisi Belum Dibayar.
    - **Custom Bar Chart**: Grafik trend pendapatan 7 hari responsif dengan tooltip hover mata uang IDR.
    - **Produk Terlaris**: Leaderboard 5 produk terlaris dengan badge ranking `#1`, `#2`, `#3`.
    - **Tabel Transaksi Terkini**: Tabel 5 transaksi lunas terakhir dengan kolom Order ID, Pembeli, Nominal, Channel pembayaran, Status badge, dan Tanggal.
- **Backend Admin Controller & Route JSON API**:
  - `AdminController.apiGetDashboard`: Menghitung analitik riil dan mengembalikan payload JSON lengkap.
  - `AdminController.showDashboard`: Redirect request browser `text/html` ke `/#/admin/dashboard`.
  - `GET /admin/api/dashboard` didaftarkan di `src/routes/adminRoutes.ts`.
- **Router Registration**:
  - Mendaftarkan `#/admin/dashboard` dan `#/admin` di `client/src/App.svelte`.
- **Automated Verification**:
  - Script `scripts/verify-admin-dashboard.js` menguji login dengan PIN `085213`, validasi API dashboard 200 OK, dan menangkap screenshot Chrome DevTools untuk mode Terang dan Gelap.

---

## Snapshot 15 - Migrasi Penuh Admin Panel ke Svelte SPA & Navigasi Mulus Tanpa Reload (27 Agustus 2026)

### 1. Migrasi Penuh Admin Panel ke Svelte SPA
- **Halaman-Halaman Baru Svelte SPA**:
  - **`AdminPayments.svelte` (`client/src/lib/pages/AdminPayments.svelte` -> `#/admin/payments`)**:
    - Live search (Order ID, email, nama pembeli, token lisensi), sort, pagination.
    - Modal konfirmasi pembayaran & modal edit durasi lisensi instan.
    - Tombol salin token lisensi 1 klik.
  - **`AdminCreateTrial.svelte` (`client/src/lib/pages/AdminCreateTrial.svelte` -> `#/admin/trials/create`)**:
    - Pilihan produk aktif dinamis dari API.
    - Pengaturan durasi & unit waktu (Jam, Hari, Bulan).
    - Generate token trial instan dengan tombol copy token.
  - **`AdminProducts.svelte` (`client/src/lib/pages/AdminProducts.svelte` -> `#/admin/products`)**:
    - Kartu ringkasan statistik produk (Total, Aktif, Diskon).
    - Modal tambah produk baru & modal edit informasi produk.
    - Toggle aktif/nonaktif produk 1 klik via AJAX.
    - Modal hapus produk.
  - **`AdminAffiliate.svelte` (`client/src/lib/pages/AdminAffiliate.svelte` -> `#/admin/affiliate`)**:
    - Kartu metrik keuangan affiliasi: Komisi Belum Dibayar, Total Sudah Dibayar, Komisi Bulan Ini, Komisi Bulan Lalu.
    - Tabel partner affiliasi, kupon diskon, detail rekening bank pencairan.
    - Modal konfirmasi pencairan komisi ("Tandai Sudah Ditransfer").
  - **`AdminAffiliateHistory.svelte` (`client/src/lib/pages/AdminAffiliateHistory.svelte` -> `#/admin/affiliate/history`)**:
    - Log riwayat transaksi payout affiliasi lengkap dengan filter pencarian email & pagination.

### 2. Navigasi SPA Hash & Penghapusan Tagihan Manual Dashboard
- **Hash Links SPA (`client/src/lib/components/AdminSidebar.svelte`)**:
  - Seluruh menu sidebar diarahkan ke `#/admin/...`.
  - Berpindah antar modul admin secara instan tanpa hard reload browser (teruji via script CDP memory marker preservation).
- **Dashboard Produk Terlaris Berbasis Timezone & Bulan Berjalan**:
  - Ditambahkan helper `getStartOfMonthEpoch(tz)` di `src/controllers/adminController.ts` untuk menghitung epoch awal bulan pukul 00:00:00 sesuai timezone browser (`req.query.timezone`).
  - Leaderboard produk terlaris di-filter strictly dengan `paid_at >= startOfMonthEpoch`.
  - Menghapus tombol "+ Tagihan Manual" dari Admin Dashboard sesuai arahan.

### 3. Backend Controller & Router JSON Endpoints
- Didaftarkan endpoint API JSON di `src/routes/adminRoutes.ts` & dihandle di `src/controllers/adminController.ts`:
  - `GET /admin/api/payments`
  - `GET /admin/api/trials/products` & `POST /admin/api/trials/create`
  - `GET /admin/api/products`, `POST /admin/api/products/create`, `POST /admin/api/products/edit/:id`, `POST /admin/api/products/delete/:id`, `POST /admin/api/products/toggle-status/:id`
  - `GET /admin/api/affiliate` & `POST /admin/api/affiliate/mark-paid`
  - `GET /admin/api/affiliate/history`
- Request browser `text/html` ke URL lama secara otomatis dialihkan (redirect 302) ke route hash SPA yang sesuai.

### 4. Automated Verification & Quality Guard
- `npm run lint && npm run build` -> Lolos 100% tanpa error (Exit code: 0).
- `scripts/verify-spa-navigation.js` -> Verifikasi 100% lulus (zero page reload across all admin pages).
- `scripts/verify-all-admin-pages.js` -> Menangkap screenshot desktop & mobile seluruh halaman admin.
- Git repository synced & pushed ke branch `reborn` (`commit c77a5fa`).

### 5. Database Schema Backup
- **Script**: `npm run backupdb:scheme`
- **File**: `backup/schema_backup.sql`
- **Timestamp**: `2026-08-27T04:03:52+07:00`
- **Status**: Verified dump (MySQL 8.x, database `ziqva_labs`).

---

## Snapshot 16 - Ketersediaan Semua Produk & Default Durasi 1 Bulan pada Halaman Buat Trial Admin (27 Agustus 2026)

### 1. Ketersediaan Seluruh Produk pada Generator Kode Trial
- **Backend (`src/controllers/adminController.ts`)**:
  - Menghapus pembatasan `where: { is_active: true }` pada method `apiGetTrialProducts` (`GET /admin/api/trials/products`).
  - Mengambil seluruh produk dari tabel `products` (`select: { id, name, price, is_active }`, `orderBy: { id: 'asc' }`) sehingga mencakup produk aktif dan nonaktif khusus untuk kebutuhan pembuatan kode trial oleh administrator.
  - Endpoint publik dan member (`/member/api/products`, `/member/api/dashboard`) tetap strictly `is_active: true` tanpa perubahan.
- **Frontend Svelte SPA (`client/src/lib/pages/AdminCreateTrial.svelte`)**:
  - Mengganti elemen dropdown HTML default dengan komponen modern Member Area: **`CustomDropdown.svelte`** (dengan input pencarian instan, icon inisial dinamis, badge harga, badge `Nonaktif` untuk produk tidak aktif, dan animasi popup glassmorphism) serta **`CustomSelect.svelte`** untuk pemilihan satuan waktu durasi (Jam, Hari, Bulan).
  - Menginisialisasi default state durasi menjadi **1 Bulan** (`duration: 1`, `unit: 'month'`).
- **SSR Fallback View (`src/views/admin-create-trial.ts`)**:
  - Mengubah default selected unit menjadi `month` (`Bulan`).

### 2. Files Modified
- `src/controllers/adminController.ts` - `apiGetTrialProducts` fetches all products with `is_active` flag.
- `client/src/lib/components/CustomDropdown.svelte` - Added `Nonaktif` badge support.
- `client/src/lib/components/CustomSelect.svelte` - Added `fullWidth` prop support.
- `client/src/lib/pages/AdminCreateTrial.svelte` - Integrated `CustomDropdown` & `CustomSelect`.
- `src/views/admin-create-trial.ts` - Default selected unit `month`.
- `docs/superpowers/specs/2026-08-27-admin-trial-all-products-design.md` - Design specification.
- `docs/superpowers/plans/2026-08-27-admin-trial-all-products-plan.md` - Implementation plan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Context snapshot v15.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 16.

---

## Snapshot 17 - Pengelolaan & Tampilan Icon/Gambar Produk Lengkap (Admin & Member) (27 Agustus 2026)

### 1. Fitur Upload & Pengelolaan Gambar Produk
- **Backend & Storage**:
  - Endpoint upload: `POST /admin/api/products/:id/upload-image` dan `POST /admin/api/products/upload-image` (Multer, support PNG/JPG/WEBP/SVG max 2MB).
  - File disimpan di `public/uploads/products/prod-[timestamp]-[hash].[ext]` dan dilayani secara statis via route Express `GET /uploads/products/*`.
  - Auto cleanup file lokal lama saat gambar produk di-update/diganti.
- **Admin Products Catalog (`client/src/lib/pages/AdminProducts.svelte`)**:
  - Kolom **Nama Produk** pada tabel kini merender thumbnail icon persegi `40x40px rounded-xl border` dengan fallback inisial huruf elegan.
  - Modal **Tambah / Edit Produk** dilengkapi section baru **Icon / Gambar Software** dengan:
    - Live preview box `64x64px` real-time.
    - Tombol file picker langsung dari komputer dengan loading spinner.
    - Input URL gambar eksternal (HTTPS/uploads).
    - Tombol Hapus/Reset Icon.
- **Member Presentation Surfaces**:
  - **`CustomDropdown.svelte`**: Menampilkan icon produk pada trigger button (`w-9 h-9`) dan setiap item option (`w-7 h-7`) dengan fallback error handling `on:error` ke inisial huruf.
  - **`ProductDetail.svelte`**: Menampilkan icon software resolusi tinggi di tengah orbit visual 3D hero.
  - **`Dashboard.svelte`**: Menampilkan icon software di kartu produk populer.
  - **`Downloads.svelte`**: Menampilkan thumbnail icon produk di samping nama software dan badge OS.
  - **`Tutorials.svelte`**: Menampilkan icon produk pada kartu katalog tutorial dan header detail bab.
  - **`Licenses.svelte`**: Menampilkan thumbnail icon produk di tabel daftar lisensi member.

### 2. Files Modified
- `src/app.ts` - Mounted static `/uploads` route.
- `src/routes/adminRoutes.ts` - Registered upload-image routes with Multer.
- `src/controllers/adminController.ts` - Implemented `uploadProductImage`.
- `src/controllers/memberController.ts` - Added `image` field in `apiGetLicenses`.
- `client/src/lib/pages/AdminProducts.svelte` - Upload file UI, URL input, live preview, table avatar.
- `client/src/lib/components/CustomDropdown.svelte` - Product image rendering with error fallback.
- `client/src/lib/pages/ProductDetail.svelte` - Hero visual orbit icon.
- `client/src/lib/pages/Dashboard.svelte` - Popular product card orbit icon.
- `client/src/lib/pages/Downloads.svelte` - Software card header icon.
- `client/src/lib/pages/Tutorials.svelte` - Catalog card & detail breadcrumb icon.
- `client/src/lib/pages/Licenses.svelte` - License table product icon.
- `docs/superpowers/specs/2026-08-27-product-icons-design.md` - Design specification.
- `docs/superpowers/plans/2026-08-27-product-icons-plan.md` - Implementation plan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Context snapshot v16.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 17.

---

## Snapshot 18 - Kategori Produk, Icon & Deskripsi, serta Submenu Navigasi Admin (27 Agustus 2026)

### 1. Fitur Kategori Produk & Restrukturisasi Navigasi
- **Database & Prisma Schema**:
  - Tabel `categories` (`id`, `name`, `slug` UNIQUE, `icon`, `description`, `is_active`, `created_at`).
  - Kolom relasi `category_id INT NULL` pada tabel `products`.
- **Backend APIs & Static Serving**:
  - Endpoint CRUD kategori: `GET /admin/api/categories`, `POST /admin/api/categories/create`, `POST /admin/api/categories/edit/:id`, `POST /admin/api/categories/delete/:id`, `POST /admin/api/categories/toggle-status/:id`.
  - Endpoint upload icon kategori: `POST /admin/api/categories/upload-icon` dan `POST /admin/api/categories/:id/upload-icon` ke direktori `public/uploads/categories/`.
  - Auto cleanup icon file lokal lama saat kategori dihapus atau icon diganti.
  - Penyesuaian `processCreateProduct`, `processEditProduct`, dan `apiGetProducts` untuk menyertakan `category_id` dan `category_name`.
- **Admin Navigation Sidebar (`AdminSidebar.svelte`)**:
  - Menu utama **Produk** kini menjadi expandable accordion yang memuat submenu:
    1. **Katalog Produk** (`#/admin/products`)
    2. **Kategori Produk** (`#/admin/categories`)
  - Auto expand ketika navigasi berada di halaman produk atau kategori.
- **Halaman Kategori Admin (`AdminCategories.svelte` - `#/admin/categories`)**:
  - Overview stats (Total, Aktif, Produk Terkategori), live search filter.
  - Tabel daftar kategori dengan thumbnail avatar icon, slug, deskripsi, counter jumlah produk, toggle status, serta tombol edit & hapus.
  - Modal Tambah & Edit Kategori lengkap dengan auto-slug, icon file picker + URL input + live preview box `64x64px`, textarea deskripsi, dan toggle aktif.
  - Modal konfirmasi hapus kategori dengan proteksi peringatan unlinking produk.
- **Integrasi di Katalog Produk (`AdminProducts.svelte`)**:
  - Dropdown pemilihan kategori software pada modal Tambah / Edit Produk.
  - Badge penanda nama kategori ungu pada tabel daftar produk.

### 2. Files Modified & Created
- `prisma/schema.prisma` - Added `model categories` & `products.category_id`.
- `src/controllers/adminController.ts` - Category CRUD, icon upload, and product category enrichment.
- `src/routes/adminRoutes.ts` - Registered category routes.
- `client/src/lib/components/AdminSidebar.svelte` - Expandable Produk accordion submenu.
- `client/src/lib/pages/AdminCategories.svelte` - New categories management page.
- `client/src/lib/pages/AdminProducts.svelte` - Category selector & badge.
- `client/src/App.svelte` - Registered `#/admin/categories` route.
- `docs/superpowers/specs/2026-08-27-product-categories-design.md` - Design specification.
- `docs/superpowers/plans/2026-08-27-product-categories-plan.md` - Implementation plan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Context snapshot v17.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 18.

---

## Snapshot 19 - Revamp Halaman Buat Trial (Trial Management Hub) (27 Agustus 2026)

### 1. Fitur Halaman Buat Trial yang Informatif, Seimbang & Responsive
- **4 Quick Stats Cards**:
  - Total Trial (`total`), Belum Dipakai (`waiting`), Aktif di Device (`active`), dan Dibuat Hari Ini (`today`).
- **Two-Column Responsive Layout (Desktop 7:5, Mobile Full-Width)**:
  - **Kolom Kiri (Form Generator & Result)**:
    - Pilihan Produk Software via `CustomDropdown` (dengan icon, harga, & status aktif).
    - Input Durasi dan Satuan Waktu (`CustomSelect`).
    - Live Summary Konfigurasi real-time.
    - Tombol aksi generate instan dengan state loading halus.
    - Hasil kode trial siap salin dengan format monospace tebal dan tombol 1-klik copy.
  - **Kolom Kanan (Panduan Sistem Trial yang Informatif)**:
    - 4 poin penjelasan ringkas dan padat: Aktivasi instan tanpa akun, Perhitungan durasi real-time, Proteksi Hardware Lock (HWID), dan Akses fitur lengkap.
- **Tabel Riwayat Kode Trial Terbaru**:
  - Menampilkan daftar trial terakhir yang digenerate dengan thumbnail produk, kode key, durasi, badge status (Belum Dipakai, Aktif di Device, Kadaluarsa), waktu dibuat, tombol salin instan, serta aksi hapus/revoke.
- **API & Backend Enhancements**:
  - Endpoint `GET /admin/api/trials/products` kini mengembalikan `products`, `recent_trials`, dan `stats`.
  - Endpoint `POST /admin/api/trials/delete/:id` untuk menghapus/revoke kode trial yang tidak digunakan.
- **Theme-Adaptive Compliance**:
  - Menggunakan CSS variables `var(--surface-1)`, `var(--surface-2)`, `var(--border)`, `var(--text)`, `var(--text-2)`, `var(--text-3)`, `var(--brand)` sehingga tampil konsisten dan kontras baik di mode terang (light) maupun gelap (dark).

### 2. Files Modified
- `src/controllers/adminController.ts` - Enhanced `apiGetTrialProducts` & added `processDeleteTrial`.
- `src/routes/adminRoutes.ts` - Registered `POST /api/trials/delete/:id`.
- `client/src/lib/pages/AdminCreateTrial.svelte` - Completely revamped UI.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v18.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 19.

---

## Snapshot 20 - Restyle & Modernisasi Halaman Katalog Produk (27 Agustus 2026)

### 1. High-Density Modern SaaS Table & Integrated Toolbar
- **Streamlined Header & Metric Chips**:
  - Menggantikan 3 kartu stats besar dengan 4 *metric chips* horizontal ringkas (Total Produk, Aktif Tayang, Draft/Nonaktif, Promo Diskon) yang menghemat ~150px tinggi layar vertikal.
- **Integrated Filter & Quick Pills Bar**:
  - Kotak pencarian live menyatu langsung dengan selector sorting (`Terbaru`, `Nama A-Z`, `Harga Termurah`, `Harga Termahal`).
  - Baris horizontal quick filter pills: `Semua`, `Aktif`, `Nonaktif`, dan pills dinamis untuk setiap kategori produk (`#Kategori`).
- **Smart Merged Table Columns**:
  - Kolom **Software / Produk**: Avatar compact 36x36px (dengan initial monogram dinamis), nama produk bold, subtext ID & SKU monospace, serta cuplikan deskripsi 1 baris.
  - Kolom **Kategori**: Tag kategori ungu dengan icon folder/tag.
  - Kolom **Harga & Diskon**: Menggabungkan harga jual final, harga asli coret, dan badge diskon `-XX%` dalam 1 cell finansial rapi.
  - Kolom **Status Tayang**: Toggle switch interaktif 1-klik (`Aktif` vs `Nonaktif`).
  - Kolom **Aksi**: Action button group modern untuk modal Edit dan modal Hapus.
- **Theme-Adaptive Compliance**:
  - 100% konsisten dengan CSS Custom Variables tema aktif.

### 2. Files Modified & Created
- `client/src/lib/pages/AdminProducts.svelte` - Restyled modern high-density SaaS catalog.
- `docs/superpowers/specs/2026-08-27-catalog-products-restyle-design.md` - Design specification.
- `docs/superpowers/plans/2026-08-27-catalog-products-restyle-plan.md` - Implementation plan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v19.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 20.

---

## Snapshot 21 - Server-Side Pagination, Debounced Search, Filter & Svelte CustomSelect Integration (27 Agustus 2026)

### 1. Server-Side Query Execution & Custom Svelte Select Components
- **Backend API (`apiGetProducts`)**:
  - Mendukung query parameters: `page`, `pageSize`, `search`, `category_id`, `status`, dan `sort`.
  - Mengembalikan struktur payload: `products` (paginated), `categories`, `pagination` (`page`, `pageSize`, `total`, `totalPages`), dan `stats` (`total`, `active`, `inactive`, `discount`).
  - Search query mencakup nama software, deskripsi, serta numerik `id` dan `product_id`.
- **Frontend Svelte Architecture (`AdminProducts.svelte`)**:
  - Live search dengan debounce 300ms yang secara otomatis me-request data baru ke server dan me-reset `page = 1`.
  - Filter pills per-kategori dan status tayang terhubung langsung ke backend pagination.
  - Penggantian seluruh elemen default HTML `<select>` dengan komponen Svelte `CustomSelect.svelte`:
    - Dropdown Sort By (`Terbaru`, `Nama A-Z`, `Harga Termurah`, `Harga Termahal`).
    - Dropdown Items Per Page (`10`, `25`, `50`, `100 per hal`).
    - Dropdown Kategori Software di dalam Modal Tambah / Edit Produk.
  - Komponen Navigasi Pagination Interaktif:
    - Counter `Menampilkan X - Y dari Z produk`.
    - Tombol navigasi `Sebelumnya`, nomor halaman dinamis, dan `Selanjutnya`.

### 2. Files Modified & Created
- `src/controllers/adminController.ts` - Server-side pagination, search, category, status & sort logic in `apiGetProducts`.
- `client/src/lib/pages/AdminProducts.svelte` - Integrated server-side pagination, debounced search, and replaced native selects with `CustomSelect`.
- `docs/superpowers/specs/2026-08-27-products-server-pagination-spec.md` - Design specification.
- `docs/superpowers/plans/2026-08-27-products-server-pagination-plan.md` - Implementation plan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v20.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 21.

---

## Snapshot 22 - Single Unified Enterprise Catalog Table Hub & Action Icons Redesign (27 Agustus 2026)

### 1. Konsolidasi Menjadi 1 Surface Card Terpadu (Zero Redundancy)
- **Eliminasi Redundansi Filter**:
  - Menghapus 4 kartu metrik besar yang tumpang tindih dengan filter pills.
  - Membangun **Segmented Status Tabs** di bagian atas kartu tabel (`Semua`, `Aktif`, `Nonaktif`, `Promo Diskon`) dengan counter badge masing-masing.
- **Single-Row Integrated Toolbar**:
  - Input pencarian (dengan debounced server query & clear button).
  - Dropdown filter Kategori (`CustomSelect`: `Semua Kategori`, `#Kategori A`, `#Kategori B`).
  - Dropdown Sorting (`CustomSelect`: `Terbaru`, `Nama A-Z`, `Harga Termurah`, `Harga Termahal`).
  - Dropdown limit Per Halaman (`CustomSelect`: `10`, `25`, `50`, `100 / hal`).
- **Redesigned Modern Action Buttons**:
  - Tombol **Edit**: Tombol rounded kotak `32x32px` dengan icon SVG pensil modern (`w-8 h-8 rounded-xl bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--brand)] hover:text-white`).
  - Tombol **Hapus**: Tombol rounded kotak `32x32px` dengan icon SVG tempat sampah modern (`w-8 h-8 rounded-xl bg-[var(--surface-2)] text-red-400 hover:bg-red-600 hover:text-white`).
- **Table Density & Typography**:
  - Kolom kategori tanpa data diganti dengan tanda `-` yang netral (menghapus teks miring *Tanpa Kategori*).
  - Footer pagination menyatu bersih dengan border bawah kartu tabel.

### 2. Files Modified & Created
- `client/src/lib/pages/AdminProducts.svelte` - Unified Enterprise Table Hub layout.
- `docs/superpowers/specs/2026-08-27-unified-catalog-table-design.md` - Design specification.
- `docs/superpowers/plans/2026-08-27-unified-catalog-table-plan.md` - Implementation plan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v21.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 22.

---

## Snapshot 23 - Perbaikan Background Transparan & Refinement Modal Tambah/Edit dan Hapus (27 Agustus 2026)

### 1. Root Cause & Solution
- **Root Cause**: Kelas `bg-[var(--surface-1)]` pada kontainer modal mengevaluasi variabel CSS `--surface-1` yang sebelumnya belum dideklarasikan di `public/css/appcenter-theme.css`. Akibatnya, nilai background menjadi *invalid/transparent*, sehingga teks tabel di belakang modal tembus dan bertumpuk dengan form modal.
- **Perbaikan CSS Tokens**:
  - Menambahkan deklarasi resmi `--surface-1` dan `--surface-3` di `:root` (Light: `#ffffff` & `#e2e8f0`) dan `[data-theme="dark"]` (Dark: `#101827` & `#22314d`).
- **Refinement Modal UI**:
  - **Modal Tambah / Edit Produk**:
    - Kontainer solid `bg-white dark:bg-[#101827]` dengan backdrop blur yang halus.
    - Header modal dengan icon badge brand biru dan tombol close `×` yang kontras.
    - Input form dengan padding presisi dan state focus glow yang tajam.
    - Preview icon software dengan bingkai solid.
  - **Modal Konfirmasi Hapus Produk**:
    - Kontainer solid `bg-white dark:bg-[#101827]`.
    - Warning badge merah dengan icon tempat sampah yang tegas di bagian header.
    - Teks konfirmasi jelas dengan nama produk bold.
    - Tombol aksi `Batal` dan `Ya, Hapus Produk` (solid red) dengan animasi loading spinner saat proses penghapusan.

### 2. Files Modified
- `public/css/appcenter-theme.css` - Added `--surface-1` and `--surface-3` tokens.
- `client/src/lib/pages/AdminProducts.svelte` - Overhauled Add/Edit and Delete modals.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v22.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 23.

---

## Snapshot 24 - Relokasi Kontrol "Per Halaman" ke Footer Pagination Tabel (27 Agustus 2026)

### 1. UX & Ergonomic Alignment
- **Top Header Clean-up**:
  - Menghapus dropdown `Per Hal:` dari header atas di sebelah segmented status tabs. Header atas kini khusus untuk tab filter status (`Semua`, `Aktif`, `Nonaktif`, `Promo Diskon`) yang rapi.
- **Table Footer Integration**:
  - Memindahkan dropdown `CustomSelect` selector limit `Per Hal` (`10`, `25`, `50`, `100 / hal`) ke **Footer Pagination Tabel** di sebelah kiri (bersama teks info counter `Menampilkan X - Y dari Z produk`).
  - Sisi kanan footer menampilkan tombol navigasi halaman (`Sebelumnya`, nomor halaman, `Selanjutnya`).

### 2. Files Modified
- `client/src/lib/pages/AdminProducts.svelte` - Relocated Per Page dropdown to pagination footer.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v23.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 24.

---

## Snapshot 25 - Implementasi Komponen Svelte CustomCheckbox (27 Agustus 2026)

### 1. Svelte CustomCheckbox Architecture
- **Komponen Baru (`CustomCheckbox.svelte`)**:
  - Dibuat dengan arsitektur murni Svelte tanpa elemen `<input type="checkbox">` default HTML.
  - Memiliki animasi scale SVG checkmark yang halus, support warna tematik (`brand`, `emerald`, `rose`, `amber`), keyboard navigation (`Enter` / `Space`), dan deskripsi subtext.
- **Penerapan di Modal**:
  - **Modal Produk (`AdminProducts.svelte`)**: Menggantikan checkbox HTML promo diskon (`color="rose"`) dan status tayang aktif (`color="emerald"`).
  - **Modal Kategori (`AdminCategories.svelte`)**: Menggantikan checkbox HTML status aktif kategori (`color="emerald"`).

### 2. Files Modified & Created
- `client/src/lib/components/CustomCheckbox.svelte` - New Svelte custom checkbox component.
- `client/src/lib/pages/AdminProducts.svelte` - Applied CustomCheckbox in product modal.
- `client/src/lib/pages/AdminCategories.svelte` - Applied CustomCheckbox in category modal.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v24.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 25.

---

## Snapshot 26 - Implementasi Komponen Svelte SegmentedTabs dengan Animasi Framer-Motion Sliding Pill (27 Agustus 2026)

### 1. Framer-Motion Style Spring Sliding Pill Architecture
- **Komponen Baru (`SegmentedTabs.svelte`)**:
  - Backdrop pill aktif meluncur mulus (`ease-[cubic-bezier(0.16,1,0.3,1)]`, durasi 300ms) di bawah tab yang diklik mengikuti koordinat `offsetLeft` dan `offsetWidth`.
  - Warna highlight pill menyesuaikan status aktif (`brand` untuk Semua, `emerald` untuk Aktif, `amber` untuk Nonaktif, `rose` untuk Promo Diskon).
  - Teks dan counter pill transisi warna teks (`text-white font-bold`) saat pill meluncur ke bawahnya.
  - Mendukung auto-reposition saat window di-resize.
- **Penerapan**:
  - Diterapkan pada Segmented Status Tabs di bagian atas tabel [`AdminProducts.svelte`](file:///Users/fiko942/Desktop/appcenter/client/src/lib/pages/AdminProducts.svelte).

### 2. Files Modified & Created
- `client/src/lib/components/SegmentedTabs.svelte` - Reusable sliding pill segmented tabs component.
- `client/src/lib/pages/AdminProducts.svelte` - Integrated SegmentedTabs.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v25.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 26.

---

## Snapshot 27 - Perbaikan Hover Tombol & Revamp Single Unified Category Hub (27 Agustus 2026)

### 1. Root Cause & Solution Bug Hover Tombol
- **Root Cause**: Tombol `+ Tambah Kategori` menggunakan kelas `hover:bg-[var(--brand-dark)]`. Karena variabel CSS `--brand-dark` belum didefinisikan, background tombol menjadi transparan/putih saat di-hover di tema terang (Light Mode), membuat teks putih tidak terbaca.
- **Perbaikan**: Mengganti styling tombol menjadi `bg-[var(--brand)] hover:opacity-90 text-white shadow-md shadow-blue-500/20` yang solid, konsisten, dan tajam di semua tema.

### 2. Single Unified Category Hub Layout (`AdminCategories.svelte`)
- **Struktur Terpadu**:
  - Menghapus 3 kartu stat besar dan memindahkan status counter langsung ke **SegmentedTabs** dengan animasi Framer-motion sliding pill (`Semua`, `Aktif`, `Nonaktif`).
  - Single-row toolbar: Kotak pencarian live menyatu dengan dropdown pengurutan [`CustomSelect`](client/src/lib/components/CustomSelect.svelte) (`Nama A-Z`, `Produk Terbanyak`, `Terbaru`).
  - High-density categories table: Icon/monogram 36x36px, nama kategori bold, `#slug` monospace, deskripsi ringkas, pill produk terhubung, toggle switch status 1-klik, dan tombol aksi modern rounded 32x32px.
  - Modals solid `bg-white dark:bg-[#101827]` anti-tembus pandang dengan uploader icon dan [`CustomCheckbox`](client/src/lib/components/CustomCheckbox.svelte).

### 3. Files Modified & Created
- `client/src/lib/pages/AdminCategories.svelte` - Unified Category Hub rewrite.
- `docs/superpowers/specs/2026-08-27-unified-categories-hub-design.md` - Design specification.
- `docs/superpowers/plans/2026-08-27-unified-categories-hub-plan.md` - Implementation plan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v26.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 27.

---

## Snapshot 28 - Perbaikan Sinkronisasi Auto-Alignment SegmentedTabs Saat Refresh Halaman (27 Agustus 2026)

### 1. Root Cause & Solution
- **Root Cause**: Saat halaman pertama kali di-refresh, data hitungan (`count`) masih `0` atau font web belum selesai dirender (`layout calculation in progress`). Ketika data API masuk dan DOM tombol melebar, posisi dan lebar pill aktif tidak otomatis mengukur ulang dimensi tombol terkini, sehingga pill tampak menyempit atau terpotong pada angka counter.
- **Perbaikan Arsitektur Sinkronisasi**:
  - Menambahkan `ResizeObserver` pada kontainer dan setiap elemen tombol tab untuk mendeteksi perubahan lebar teks/badge secara instan.
  - Mengintegrasikan hook `document.fonts.ready` agar pill mengukur ulang dimensi setelah webfont terpasang sempurna.
  - Memanfaatkan lifecycle `afterUpdate` dan sinkronisasi ganda `requestAnimationFrame` untuk menjamin pill 100% presisi melingkupi seluruh tombol tab beserta counter badge.

### 2. Files Modified
- `client/src/lib/components/SegmentedTabs.svelte` - Robust multi-lifecycle auto-synchronization.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v27.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 28.

---

## Snapshot 29 - Elite Context Preservation & VPS Production Deployment Readiness (27 Agustus 2026)

### 1. State Summary & Architecture Preservation
- **Svelte Custom Component Library**:
  - `CustomSelect.svelte`: Fully themed, accessible dropdown replacement for all native HTML `<select>`.
  - `CustomCheckbox.svelte`: Animated SVG checkmark scaling, color presets, keyboard accessible replacement for all `<input type="checkbox">`.
  - `SegmentedTabs.svelte`: Spring-like Framer-Motion sliding pill indicator with `cubic-bezier(0.16, 1, 0.3, 1)`, `ResizeObserver`, and `document.fonts.ready` synchronization.
- **Admin Hubs Revamp**:
  - `AdminProducts.svelte`: Single Unified Enterprise Table Hub with server-side pagination, debounced search, category filter, sorting, status tabs, modern action buttons, and bottom pagination footer.
  - `AdminCategories.svelte`: Single Unified Category Hub with search & sort toolbar, 1-click active status toggle, high-density rows, and fixed button hover states.
  - `AdminTrialCreate.svelte`: Responsive 2-column Trial Hub with quick stats, guidance step cards, live config summary, and token copy/revoke history table.
- **Production Build Structure**:
  - `dist/client_dist/`: Minified Vite SPA bundle with optimized JS/CSS chunks.
  - `dist/public/`: Static assets, uploads directory, and theme CSS.
  - `dist/generated/client/`: Prisma binary engine (`debian-openssl-3.0.x` & `native`).
  - `dist/server.js`: Transpiled Node.js TypeScript server ready for PM2 on VPS.

### 2. Files Modified & Created in this Session
- `client/src/lib/components/CustomCheckbox.svelte`
- `client/src/lib/components/SegmentedTabs.svelte`
- `client/src/lib/components/CustomSelect.svelte`
- `client/src/lib/pages/AdminProducts.svelte`
- `client/src/lib/pages/AdminCategories.svelte`
- `client/src/lib/pages/AdminTrialCreate.svelte`
- `public/css/appcenter-theme.css`
- `docs/superpowers/specs/2026-08-27-unified-categories-hub-design.md`
- `docs/superpowers/plans/2026-08-27-unified-categories-hub-plan.md`
- `docs/superpowers/specs/2026-08-27-unified-catalog-table-design.md`
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v28.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 29.

---

## Snapshot 30 - Penghapusan Tombol Help/Tutorial pada Navbar Admin (27 Agustus 2026)

### 1. UX Scoping: Member-Only Help Button
- **Top Header Navbar (`Topbar.svelte`)**:
  - Ditambahkan prop `export let showHelp: boolean = true;`.
  - Tombol icon tautan pusat bantuan & video tutorial (`#/member/tutorials`) dibungkus kondisi `{#if showHelp}`.
- **Admin Layout (`AdminLayout.svelte`)**:
  - Mengirimkan `showHelp={false}` ke komponen `Topbar`.
  - Halaman-halaman admin sekarang hanya menampilkan toggle tema (Light/Dark mode switch) tanpa tombol Help tutorial member.
- **Member Layout (`Layout.svelte`)**:
  - Tetap mempertahankan tombol Help tutorial member (`showHelp = true`).

### 2. Files Modified
- `client/src/lib/components/Topbar.svelte` - Added `showHelp` boolean prop.
- `client/src/lib/components/AdminLayout.svelte` - Passed `showHelp={false}`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v29.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 30.

---

## Snapshot 31 - Pengurangan Batas Pool Koneksi Database MySQL (27 Agustus 2026)

### 1. Optimalisasi Resource & Connection Pool Tuning
- **Prisma MySQL Connection Pool (`.env`)**:
  - Mengubah parameter `connection_limit=20` menjadi `connection_limit=5` pada `DATABASE_URL`.
  - Mengurangi beban concurrency koneksi idle ke remote database MySQL (`127.0.0.1`).
- **Express MySQL Session Store Pool (`src/app.ts`)**:
  - Menambahkan konfigurasi `connectionLimit: 5` pada `MySQLStore` options.

### 2. Files Modified
- `.env` - Set `connection_limit=5`.
- `src/app.ts` - Added `connectionLimit: 5` to `sessionStore`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v30.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 31.

---

## Snapshot 32 - Inisialisasi & Pemetaan Kategori Produk Software Otomatis (27 Agustus 2026)

### 1. Inisialisasi 7 Kategori Produk Terpadu
Kategori produk dibuat langsung di database MySQL `ziqva_labs` dan 22 produk software yang ada telah otomatis dipetakan ke `category_id` masing-masing:
1. **Scraper Marketplace** (`scraper-marketplace`):
   - Deskripsi: *Software otomatisasi untuk scraping data produk, harga, supplier, dan katalog toko dari berbagai platform marketplace.*
   - Produk (6): `AliExpress Scrapper Remastered`, `Lazada Scrapper Remastered`, `Shopee Bypass`, `Shopee Supplier`, `Monotaro Scrapper`, `BGD_SCRP`.
2. **Mass Uploader & Bot Toko** (`mass-uploader-bot`):
   - Deskripsi: *Tools otomatisasi upload produk massal, pembuatan akun merchant, dan monitoring multi-akun toko online tanpa batasan.*
   - Produk (3): `Tokped Uploader`, `Bulk Tokped`, `AsistenQ Owner`.
3. **Konverter Data & Multi-Platform** (`konverter-data-multi-platform`):
   - Deskripsi: *Alat konversi format data dan integrasi antar platform marketplace (BigSeller, Shopee, Tokopedia, AliExpress).*
   - Produk (3): `BigSeller to AliExpress Converter`, `BigSeller to Shopee`, `BigSeller to Tokopedia`.
4. **Otomasi Video & Media Sosial** (`otomasi-video-media-sosial`):
   - Deskripsi: *Tools live streaming otomatis, mass upload video, dan asisten multi-channel untuk YouTube dan TikTok.*
   - Produk (6): `Tiktok Uploader`, `Tiktok Creator`, `Youtube Streamer`, `Youtube Assistant`, `AsistenQ Youtube`, `Vids`.
5. **Pengolahan Video & Utilitas AI** (`pengolahan-video-utilitas-ai`):
   - Deskripsi: *Utilitas pengolahan video bulk, rendering looping otomatis, dan penghapus watermark AI untuk konten kreator.*
   - Produk (2): `Render Looping Bulk`, `Watermark Sora Remover Ultimate`.
6. **Device Farming & Makro** (`device-farming-makro`):
   - Deskripsi: *Pusat kontrol desktop untuk manajemen multi-device Android, inspeksi perangkat, dan otomatisasi makro aplikasi.*
   - Produk (1): `Affilia`.
7. **Pembukuan & Finansial** (`pembukuan-finansial`):
   - Deskripsi: *Software pembukuan transaksi marketplace, rekapitulasi fee invoice, dan perhitungan profitabilitas toko.*
   - Produk (1): `profitQ`.

### 2. Database Backup Verification
- **Script**: `npm run backupdb:scheme`
- **Output File**: `backup/schema_backup.sql`
- **Timestamp**: `2026-08-27T09:29:41+07:00`
- **Status**: Verified Schema Dump.

---

## Snapshot 33 - Perbaikan Layout Single-Line Menu Affiliate Management Sidebar Admin (27 Agustus 2026)

### 1. Root Cause & Solution
- **Root Cause**: Kombinasi margin item `margin: 4px 12px` dengan padding container `<nav class="px-3">` (12px) memotong 48px lebar horizontal, ditambah tanpa `white-space: nowrap` sehingga teks "Affiliate Management" turun menjadi 2 baris.
- **Perbaikan**:
  - Menyelaraskan `.sidebar-nav-item` di `appcenter-theme.css`: `margin: 4px 0`, `padding: 0 12px`, `gap: 10px`, `font-size: 13.5px`, dan `white-space: nowrap`.
  - Menghapus pembatasan `w-[calc(100%-24px)]` pada tombol submenu Produk di `AdminSidebar.svelte` menjadi `w-full`.
  - Menambahkan kelas `whitespace-nowrap` pada seluruh label teks menu sidebar.

### 2. Files Modified
- `public/css/appcenter-theme.css` - Normalized `.sidebar-nav-item` width and whitespace.
- `client/src/lib/components/AdminSidebar.svelte` - Applied `w-full` and `whitespace-nowrap`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v32.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 33.

---

## Snapshot 34 - Revamp Enterprise UI & Responsivitas Halaman Affiliate Management dan Riwayat Payout (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**: Tampilan halaman Affiliate Management (`AdminAffiliate.svelte`) dan Riwayat Payout (`AdminAffiliateHistory.svelte`) sebelumnya belum rapi, tidak memiliki toolbar terintegrasi, tidak ada filter kategori/tab, tidak ada rincian transaksi tertunda per affiliator, tidak ada fitur 1-click copy rekening/kupon, serta kurang responsif pada layar ponsel.
- **Solusi**:
  - **AdminAffiliate.svelte**:
    - 4 Glassmorphic Metric Cards: Komisi Menunggu Payout, Total Sudah Dicairkan, Komisi Bulan Ini, dan Total Mitra Affiliasi.
    - Integrated Single-Row Toolbar: Live Search, `SegmentedTabs` (Semua, Menunggu Payout, Lunas, Belum Set Bank), `CustomSelect` sorter (Komisi Tertunda, Email, Kupon), dan per-page selector.
    - 1-Click Copy: Salin nomor rekening dan kode kupon dengan visual toast feedback.
    - Interactive Modals: Modal Rincian Komisi Tertunda (list invoice & produk) dan Modal Konfirmasi Transfer Payout.
    - Responsive Mobile Cards (`md:hidden`) untuk tampilan ramah layar sentuh di perangkat seluler.
  - **AdminAffiliateHistory.svelte**:
    - 3 Metric Overview Cards: Total Transaksi Payout, Nominal Pada Halaman Ini, dan Rata-rata Nominal per Payout.
    - Enterprise Search Toolbar & `CustomSelect` sorter + per-page limits.
    - ID copyable tag `#ID`, status tag `Ditransfer`, dan responsive mobile card layout.
  - **adminController.ts**:
    - `apiGetAffiliateHistory` diupgrade untuk pencarian multi-field (`affiliate_email`, `note`, `accepted_by`).

### 2. Files Modified
- `client/src/lib/pages/AdminAffiliate.svelte` - Full Enterprise Table Hub revamp.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Payout log redesign & mobile cards.
- `src/controllers/adminController.ts` - Enhanced multi-field search for payout history.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v34.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 34.

---

## Snapshot 35 - Fitur Modal Detail Pembayaran & Action Icon Buttons Ber-Tooltip pada Daftar Pembayaran Admin (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**: Halaman admin daftar pembayaran (`AdminPayments.svelte`) belum memiliki fitur untuk melihat rincian lengkap pembayaran (data Xendit/gateway, profil pelanggan, kunci lisensi token yang digenerate beserta status aktivasi mesinnya, komisi afiliasi, dan rincian item produk). Kolom aksi juga masih berupa teks biasa tanpa tooltip dan Order ID belum bisa diklik langsung untuk audit.
- **Solusi**:
  - **Backend (`src/controllers/adminController.ts` & `src/routes/adminRoutes.ts`)**:
    - Menambahkan endpoint `GET /admin/api/payments/detail/:id` (`apiGetPaymentDetail`).
    - Menggabungkan data relasional: `order_list`, `user` (profil lengkap, WA, verifikasi), `token_device_activation` (token, status `taked`, `taked_at`, `taked_ip`), dan `affiliate_transaksi` (affiliator, komisi, status payout).
  - **Frontend (`AdminPayments.svelte`)**:
    - **Clickable Order ID**: Order ID `#{id}` pada tabel dapat diklik langsung untuk memicu modal detail pembayaran.
    - **Icon Button & Hover Tooltip**: Mengganti tombol aksi teks menjadi icon buttons ber-tooltip modern (Detail `eye` -> "Lihat Detail", Edit Durasi `pen` -> "Ubah Durasi", Konfirmasi Lunas `check` -> "Konfirmasi Lunas").
    - **Payment Detail Modal**: Popover/Modal responsif yang menyajikan rincian lengkap tagihan (nominal, fee, metode, nomor VA, link bayar, request ID, payment ID, timestamps), informasi pelanggan (nama, email copyable, direct link WhatsApp `wa.me`, perusahaan), lisensi token & status aktivasi IP, komisi afiliasi, dan catatan order.
    - **Responsive Mobile Layout**: Card view modular khusus layar sentuh dan ponsel.

### 2. Files Modified
- `src/controllers/adminController.ts` - Added `apiGetPaymentDetail`.
- `src/routes/adminRoutes.ts` - Registered route `/api/payments/detail/:id`.
- `client/src/lib/pages/AdminPayments.svelte` - Clickable ID, action tooltips, comprehensive detail modal, responsive cards.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v35.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 35.

---

## Snapshot 36 - Redesain Human-Crafted & Motion UI Generator Token Trial Admin (`AdminCreateTrial.svelte`) (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**: Halaman Generator Kode Trial (`AdminCreateTrial.svelte`) memiliki tampilan yang terasa seperti template generik AI (icon generik, copywriting marketing klise seperti "Generate Kode Trial Sekarang", tidak ada preset durasi cepat, dan layout tabel yang kaku).
- **Solusi**:
  - **Handcrafted SVG Iconography & Vibrant Micro-Accents**:
    - Total Token: Passkey / Key SVG (Aksen Blue/Indigo).
    - Belum Dipakai: Sandclock / Hourglass SVG (Aksen Amber).
    - Aktif di Komputer: Laptop Shield Check HWID SVG (Aksen Emerald).
    - Dibuat Hari Ini: Calendar Check / Time SVG (Aksen Purple).
  - **Quick Duration Presets**: Menambahkan tombol filter cepat (`1 Hari`, `3 Hari`, `7 Hari`, `14 Hari`, `1 Bulan`) dengan active transition halus (`active:scale-95`).
  - **No-AI-Slop Copywriting**: Mengganti copy klise menjadi bahasa teknis yang jelas, presisi, dan natural ("Token Trial Software", "Preset Cepat", "Spesifikasi Lisensi Trial", "Single-Device HWID Lock").
  - **Motion & Responsive Table**:
    - Floating copy toast feedback (`animate-bounce`).
    - Responsive mobile card view untuk riwayat token trial.

### 2. Files Modified
- `client/src/lib/pages/AdminCreateTrial.svelte` - Handcrafted iconography, preset pills, clean copy, and mobile view.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v36.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 36.

---

## Snapshot 37 - Standarisasi Breadcrumbs, Handcrafted Metric Cards, dan Fitur Audit Riwayat Payout Komisi Lengkap (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Breadcrumb di `AdminAffiliate.svelte` menampilkan badge "Admin Console" yang tidak konsisten dengan navigasi aplikasi.
  - Kartu metrik di halaman afiliasi & riwayat payout menggunakan icon template generik dan warna monoton.
  - Log riwayat payout (`AdminAffiliateHistory.svelte`) belum menampilkan rekening bank tujuan, profil mitra (nama & WhatsApp), tidak ada modal audit bukti payout, serta belum memiliki tombol cepat konfirmasi transfer ke WhatsApp mitra.
- **Solusi**:
  - **Standarisasi Breadcrumbs & Headers**:
    - `AdminAffiliate.svelte`: `Affiliate Management / Program Afiliasi`.
    - `AdminAffiliateHistory.svelte`: `< Affiliate Management / Riwayat Pembayaran`.
  - **Handcrafted Metric Cards & Vibrant Accents**:
    - `AdminAffiliate.svelte`: Menunggu Payout (Amber), Total Sudah Dicairkan (Emerald), Komisi Bulan Ini (Blue), Mitra Afiliasi (Purple).
    - `AdminAffiliateHistory.svelte`: Total Dana Dicairkan (Emerald), Total Payout Berhasil (Blue), Rata-Rata per Transfer (Purple), Dicairkan Bulan Ini (Amber).
  - **Riwayat Payout Informatif & Audit Modal**:
    - Backend `apiGetAffiliateHistory`: Join dengan `affiliate_member` (bank, no rek, atas nama, kupon) dan `user` (nama lengkap, nomor WhatsApp) + agregasi statistik global (`totalPaidAllTime`, `totalPayoutsCount`, `avgPayoutAllTime`, `totalPaidThisMonth`).
    - Kolom Rekening Tujuan: Badge Bank, No Rekening copyable 1-klik, dan Atas Nama.
    - Kolom Affiliator & Kontak: Email copyable, Nama Affiliator, kode kupon.
    - Modal Bukti Payout Komisi: Rincian lengkap transfer, rekening, operator, nominal, dan tombol salin format bukti.
    - 1-Click WhatsApp Action: Mengirim format pesan konfirmasi pencairan resmi langsung ke nomor WhatsApp affiliator via `wa.me`.
    - Responsive Mobile Layout: Card view modular ramah perangkat mobile.

### 2. Files Modified
- `src/controllers/adminController.ts` - Upgraded `apiGetAffiliateHistory` with relational joins & global stats.
- `client/src/lib/pages/AdminAffiliate.svelte` - Breadcrumb standard and handcrafted metric cards.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Comprehensive payout log, bank accounts, WhatsApp confirmation, and audit modal.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v37.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 37.

---

## Snapshot 38 - Filter Bank, Penanganan Status Belum Set Bank, Opsi Sorting Lengkap, dan Animasi Dropdown Framer-Motion Style (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Di database `affiliate_member`, mitra yang belum mengisi bank memiliki nilai `payout_bank_name: null`, `payout_no_rek: null`, atau `-`. Sebelumnya hanya ditampilkan teks strip `-` tanpa status visual yang jelas.
  - Belum ada filter khusus per nama bank (BCA, BNI, BRI, Mandiri, Belum Diset).
  - Opsi pengurutan (sorting) masih terbatas.
  - Dropdown menu belum memiliki efek animasi hover highlight/pill interaktif bergaya Framer Motion.
- **Solusi**:
  - **Analisa & Validasi Data Bank**:
    - Fungsi `isBankSetFn` memvalidasi kelengkapan nama bank dan nomor rekening secara akurat (`Boolean(b && b !== '-' && r && r !== '-')`).
    - Mitra tanpa bank kini ditampilkan dengan badge amber tegas: `[Belum Diset]` + subtext *"Mitra belum input rekening"*.
  - **Filter Bank & Tab Status**:
    - Menambahkan dropdown selector Bank dinamis (Semua Bank, Bank BCA, Bank BNI, Bank BRI, Bank Mandiri, ⚠️ Belum Diset).
    - Tab Filter diperluas: `Semua`, `Menunggu Payout`, `Bank Lengkap`, `Belum Set Bank`, `Lunas`.
  - **Opsi Sorting Komprehensif**:
    - Komisi Tertunda (Tertinggi & Terendah).
    - Komisi Bulan Ini (Tertinggi).
    - Total Sudah Dicairkan (Tertinggi).
    - Status Bank (Lengkap Dahulu & Belum Diset Dahulu).
    - Email Affiliator (A - Z & Z - A).
    - Kode Kupon (A - Z).
    - Waktu Bergabung (Terbaru).
  - **Animasi Dropdown Framer-Motion Style**:
    - `CustomSelect.svelte` & `CustomDropdown.svelte` diupgrade dengan:
      - Spring dropdown popup animation (`cubic-bezier(0.16, 1, 0.3, 1)`).
      - Hover Peel highlight pill (`peel-highlight`) dengan transisi halus dan pergeseran teks (`group-hover:translate-x-1`).
      - Check icon spring scale-in (`animate-scale-in`).
      - Micro-interaction active click bounce (`active:scale-[0.98]`).

### 2. Files Modified
- `client/src/lib/components/CustomSelect.svelte` - Framer-motion style hover peel pill & spring animations.
- `client/src/lib/components/CustomDropdown.svelte` - Product dropdown hover peel pill & spring animations.
- `client/src/lib/pages/AdminAffiliate.svelte` - Bank filter dropdown, unset bank badge, extended sorting, and refined table/mobile cards.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v38.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 38.

---

## Snapshot 39 - Implementasi Update Management & Paginasi Pusat Unduhan (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Di halaman update/downloads, data update dan installer aplikasi tidak memiliki kontrol pagination, hanya menampilkan segelintir item secara terbatas tanpa navigasi halaman.
  - Database MySQL memiliki 76 arsip rilis update (`update_files`) untuk 5 software (`profitQ`, `AsistenQ Owner`, `AsistenQ Admin`, `AsistenQ Chat`, `Shopee Bypass`) yang belum memiliki panel manajemen admin modern.
- **Solusi**:
  - **Admin Update Management (`AdminUpdates.svelte` / `/admin/updates`)**:
    - Server-side pagination lengkap (6 / 10 / 20 / 50 / 100 per halaman).
    - Filter tab produk software dinamis dengan counter badge (`AsistenQ Owner (27)`, `Shopee Bypass (23)`, `profitQ (17)`, `AsistenQ Admin (6)`, `AsistenQ Chat (3)`).
    - Pencarian fleksibel berdasarkan versi (`1.5.8`), build number (`#32`), nama file ZIP, dan catatan perbaikan changelog.
    - 4 Metric cards ringkasan: Total Rilis Update (76), Software Terdaftar (5), Total Ukuran Arsip (5.71 GB), dan Filtered Result count.
    - Dual View: High-density enterprise table view & responsive cards view.
    - Changelog Parser & Badges: `Fitur Baru` (emerald), `Perbaikan Bug` (rose), `Perubahan` (blue).
    - Modal popup detail rilis dengan salin MD5 checksum dan tombol unduh langsung.
  - **Member Downloads Pagination (`Downloads.svelte` / `/member/downloads`)**:
    - Menambahkan client-side pagination (default 6 / hal, opsi 6, 9, 12, 24, Semua) dengan kontrol navigasi Prev/Next, nomor halaman, dan dropdown per halaman (`CustomSelect`).
  - **Backend Controller & Routing**:
    - `AdminController.apiGetUpdates`: Endpoint `GET /admin/api/updates` dengan parameter query `page`, `pageSize`, `search`, `product`, `sort`, `order` dan agregasi data Prisma yang efisien.
    - Integrasi menu `Update Management` pada `AdminSidebar.svelte` dan route `#/admin/updates` pada `App.svelte`.

### 2. Files Created & Modified
- `src/controllers/adminController.ts` - Implementasi `apiGetUpdates` dengan server-side pagination & filter agregasi.
- `src/routes/adminRoutes.ts` - Registrasi route `/admin/updates` dan `/admin/api/updates`.
- `client/src/App.svelte` - Registrasi route SPA `#/admin/updates`.
- `client/src/lib/components/AdminSidebar.svelte` - Navigasi `Update Management` di grup MANAJEMEN SISTEM.
- `client/src/lib/pages/AdminUpdates.svelte` - Halaman manajemen rilis update software lengkap dengan paginasi, filter tab, dual view, dan modal changelog.
- `client/src/lib/pages/Downloads.svelte` - Paginasi interaktif pada grid katalog software & unduhan member.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v39.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 39.

---

## Snapshot 40 - Manajemen File Installer & Setup Multi-Platform pada Katalog Produk (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada template katalog produk (`AdminProducts.svelte`), admin belum dapat mengelola dan mengunggah file setup installer (Windows & macOS) per produk yang dibutuhkan oleh member di Pusat Unduhan (`/member/downloads`) dan Lisensi (`/member/licenses`).
  - Default sorting pada tabel produk masih berdasarkan item terbaru (`newest`), belum mengutamakan produk dengan status tayang aktif (`status-active`).
- **Solusi**:
  - **Manajemen File Installer & Setup (`AdminProducts.svelte`)**:
    - Menambahkan kolom **File Setup / Installer** pada tabel katalog produk dengan badge counter interaktif (🪟 Windows count | 🍎 macOS count).
    - Menambahkan tombol aksi khusus *Kelola File Installer* (cyan) pada setiap baris produk.
    - Membuat **Modal Kelola File Installer**:
      - Tab switch OS: Windows Setup (`.exe`, `.zip`, `.msi`) dan macOS Setup (`.dmg`, `.zip`, `.pkg`, `.app`).
      - List file installer yang sudah terupload lengkap dengan format ekstensi, ukuran file, tanggal upload, salin link URL CDN, tombol unduh langsung, dan hapus file.
      - **High-Speed Chunked Upload**: Mengunggah file installer berukuran besar dengan potongan 5MB per chunk, live progress bar, speed tracker, dan sinkronisasi otomatis ke CDN SFTP (`download.ziqva.com`).
  - **Default Sorting Status Aktif Dahulu**:
    - Backend `apiGetProducts` dan frontend `AdminProducts.svelte` kini menggunakan default sorting `status-active` (`ORDER BY is_active DESC, id DESC`), sehingga seluruh produk aktif tayang langsung muncul di baris teratas.
  - **API & Routing**:
    - Registrasi alias endpoint API `/admin/api/products/:id/upload-chunk`, `/admin/api/products/:id/upload-installer`, dan `/admin/api/products/:id/delete-installer`.
    - Sanitasi dan serialisasi otomatis struktur multi-file array JSON pada kolom `products.installer_files`.

### 2. Files Created & Modified
- `src/controllers/adminController.ts` - Default sort `status-active` (`is_active: 'desc', id: 'desc'`) dan enrichment `parsed_installer_files`.
- `src/routes/adminRoutes.ts` - Registrasi alias API endpoints installer upload, chunking, and deletion.
- `client/src/lib/pages/AdminProducts.svelte` - Penambahan kolom installer, tombol aksi, modal kelola file multi-OS, chunk upload engine, dan default sort status aktif.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v40.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 40.

---

## Snapshot 41 - Penghapusan Standalone Update Management (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Menu standalone `Update Management` di admin console tidak lagi diperlukan karena seluruh manajemen file setup/installer aplikasi sudah terintegrasi secara modular, terstruktur, dan presisi di dalam halaman Katalog Produk (`AdminProducts.svelte`).
- **Solusi**:
  - Menghapus komponen `AdminUpdates.svelte` dan route `#/admin/updates`.
  - Menghapus menu navigasi `Update Management` pada `AdminSidebar.svelte`.
  - Menghapus endpoint `GET /admin/api/updates` dan route `/admin/updates` pada `adminRoutes.ts` & `adminController.ts`.

### 2. Files Modified & Deleted
- `client/src/lib/pages/AdminUpdates.svelte` - [DELETED]
- `client/src/lib/components/AdminSidebar.svelte` - Dihapus link menu Update Management.
- `client/src/App.svelte` - Dihapus mapping route `#/admin/updates`.
- `src/routes/adminRoutes.ts` - Dihapus route `/admin/updates` & `/admin/api/updates`.
- `src/controllers/adminController.ts` - Dihapus method `apiGetUpdates`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v41.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 41.

---

## Snapshot 42 - Pembersihan & Modernisasi Generator Token Trial (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Halaman buat token trial (`AdminCreateTrial.svelte`) sebelumnya memuat elemen yang tidak diperlukan (4 stat metric card dan tabel riwayat token di bagian bawah) yang menambah noise antarmuka.
  - Alur konfirmasi hasil pembuatan token belum memiliki modal pop-up interaktif beranimasi.
- **Solusi**:
  - **Penyederhanaan Layout & Spesifikasi**:
    - Dihapus 4 metric cards (`Total Token`, `Belum Dipakai`, `Aktif di Device`, `Dibuat Hari Ini`).
    - Dihapus tabel riwayat token trial di bagian bawah.
    - Halaman difokuskan murni pada 2 kolom: **Konfigurasi Token Trial** (kiri) dan **Spesifikasi Lisensi Trial** (kanan) yang menjelaskan proteksi Single-Device HWID lock, countdown aktivasi fleksibel, aktivasi 1-klik, dan kadaluarsa otomatis.
  - **Animated Success Modal Popup**:
    - Saat tombol *Buat Token Trial Sekarang* diklik dan proses selesai, modal popup beranimasi halus (`animate-fade-in`, `animate-scale-in`, backdrop blur) akan muncul.
    - Menampilkan badge checkmark pulsing, detail software dan durasi, box kode token besar dengan 1-touch copy, dan template pesan format WhatsApp/Chat siap kirim ke calon klien.
    - Tombol aksi cepat: *Buat Token Lain* dan *Salin Token & Tutup*.

### 2. Files Created & Modified
- `client/src/lib/pages/AdminCreateTrial.svelte` - Pembersihan stat cards & riwayat token, penambahan modal pop-up hasil token trial beranimasi.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v42.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 42.

---

## Snapshot 43 - Framer Motion Sliding Pill Animation pada Seluruh Dropdown (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Efek hover opsi pada menu dropdown sebelumnya hanya menggunakan fade-in / fade-out statis per item tanpa pergerakan dinamis (*sliding pill transition*).
- **Solusi**:
  - **Framer Motion Smooth Sliding Pill**:
    - Mengintegrasikan floating indicator pill dinamis dengan kurva pegas `cubic-bezier(0.16, 1, 0.3, 1)` dan durasi `250ms`.
    - Saat mouse digeser dari opsi A ke opsi B, pill meluncur mulus secara vertikal mengikuti posisi (`offsetTop` & `offsetHeight`) item yang sedang disorot.
    - Saat mouse meninggalkan list dropdown, pill otomatis meluncur kembali ke opsi aktif/terpilih (`selectedOption`).
    - Diterapkan secara serentak pada komponen inti:
      - `CustomSelect.svelte`: Digunakan pada seluruh filter status, kategori, pagination, dan sorting di member & admin portal.
      - `CustomDropdown.svelte`: Digunakan pada pemilihan produk software di pembuatan trial & order.

### 2. Files Created & Modified
- `client/src/lib/components/CustomSelect.svelte` - Implementasi smooth sliding pill backdrop indicator dengan tracking `optionElements`.
- `client/src/lib/components/CustomDropdown.svelte` - Implementasi smooth sliding pill backdrop indicator dengan tracking `itemElements` pada list scrollable.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v43.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 43.

---

## Snapshot 44 - Normalisasi Header Tabel Single-Line & Konsolidasi Aksi Installer (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Header tabel pada Katalog Produk terpotong/melipat menjadi dua baris (`FILE SETUP /` dan `INSTALLER`, `STATUS` dan `TAYANG`), membuat baris header terlalu tinggi dan tidak rapi.
  - Terdapat duplikasi tombol aksi upload installer (tombol badge di kolom *File Setup* dan tombol cyan di kolom *Aksi*).
- **Solusi**:
  - **Single-Line Header Typography**:
    - Menyederhanakan label header tabel: `Software`, `Kategori`, `Harga`, `File Setup`, `Status`, `Aksi`.
    - Menerapkan `whitespace-nowrap` secara konsisten pada seluruh elemen `<th>` di `AdminProducts.svelte`, `AdminCategories.svelte`, `AdminAffiliate.svelte`, `AdminAffiliateHistory.svelte`, dan `AdminPayments.svelte`.
  - **Konsolidasi Aksi**:
    - Menghapus tombol upload installer duplikat (cyan) dari kolom *Aksi*.
    - Kolom *Aksi* kini terfokus murni untuk *Edit Produk* dan *Hapus Produk*.
    - Pengelolaan dan pengunggahan file installer diakses langsung melalui tombol badge interaktif di kolom *File Setup*.

### 2. Files Created & Modified
- `client/src/lib/pages/AdminProducts.svelte` - Header disederhanakan, ditambahkan `whitespace-nowrap`, dan dihapus tombol upload duplikat di kolom Aksi.
- `client/src/lib/pages/AdminCategories.svelte` - Penambahan `whitespace-nowrap` dan penyederhanaan label header.
- `client/src/lib/pages/AdminAffiliate.svelte` - Penambahan `whitespace-nowrap` dan penyederhanaan label header.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Penambahan `whitespace-nowrap` dan penyederhanaan label header.
- `client/src/lib/pages/AdminPayments.svelte` - Penambahan `whitespace-nowrap` dan penyederhanaan label header.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v44.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 44.

---

## Snapshot 45 - Stabilisasi Lebar & Eliminasi Flicker pada Menu Dropdown (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Menu dropdown mengalami jitter/kedip (*flickering*) dan pergeseran lebar kontainer (*layout width shift*) saat mouse menggeser opsi.
  - Penyebab: Perubahan ketebalan font (*font-weight* dari normal ke *semibold/bold*) dan efek transformasi horizontal (`group-hover:translate-x-1`) mengubah dimensi teks secara dinamis, memicu loop *mouseenter/mouseleave* dan perubahan lebar menu.
- **Solusi**:
  - **Font Weight & Typography Locking**:
    - Mengunci ketebalan font secara konsisten (`font-semibold`) di semua state (aktif, hover, maupun normal) sehingga ukuran teks tidak pernah berubah secara fisik.
    - Menghapus efek `group-hover:translate-x-1` untuk memastikan koordinat bounding box stabil 100%.
    - Membedakan state aktif dan hover secara murni melalui kontras warna teks (`text-[var(--brand)]` vs `text-[var(--text)]` vs `text-[var(--text-2)]`) serta sliding pill backdrop.
  - **Container Width Stability**:
    - Menambahkan `min-w-full w-max max-w-xs whitespace-nowrap` pada kontainer dropdown list.
  - **Scoped Sliding Pill CSS Transitions**:
    - Mengganti `transition-all` menjadi transisi scoped (`top`, `height`, `opacity`, `background-color`, `border-color`) sehingga lebar pill terpatri kuat (`left-1.5 right-1.5`) tanpa distorsi horizontal.

### 2. Files Created & Modified
- `client/src/lib/components/CustomSelect.svelte` - Stabilisasi lebar dropdown, font weight locking, dan transisi sliding pill presisi.
- `client/src/lib/components/CustomDropdown.svelte` - Stabilisasi listbox, eliminasi transformasi teks penyebab jitter, dan transisi sliding pill presisi.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v45.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 45.

---

## Snapshot 46 - Perbaikan Layout Flow Dropdown Container (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Saat menu dropdown dibuka, baris toolbar ikut memanjang secara vertikal ke bawah sehingga elemen lain (search bar, filter kategori, dan tabel) ikut terdorong atau ketinggiannya ikut membesar.
  - Penyebab: Terdapat kelas `relative` yang tidak sengaja tertulis bersamaan dengan `absolute` pada `dropdown-menu-list` di `CustomSelect.svelte`, menyebabkan browser menginterpretasikannya sebagai elemen normal document flow alih-alih floating overlay murni.
- **Solusi**:
  - Menghapus kelas `relative` dari kontainer `dropdown-menu-list` di `CustomSelect.svelte`.
  - Kontainer dropdown kini murni floating `position: absolute; top: 100%; z-index: 50` di atas konten lain tanpa memengaruhi atau mendorong tinggi container toolbar/elemen di sekitarnya.

### 2. Files Created & Modified
- `client/src/lib/components/CustomSelect.svelte` - Penghapusan kelas `relative` pada overlay popup listbox.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v46.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 46.

---

## Snapshot 47 - Redesain Sel File Setup & Chip Platform Installer (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Tampilan sel *File Setup* sebelumnya (`[ 🪟 1 | 🍎 1 ↑ ]`) memiliki kontras warna yang buruk pada Light Mode (ikon Apple `text-slate-200` hampir tidak terlihat), serta terlihat kaku dan tidak rapi saat belum ada file (`🪟 - | 🍎 - ↑`).
- **Solusi**:
  - **Modern Dual-State Chips**:
    - **State Ada File**: Ditampilkan chip platform terpisah dengan kontras tinggi di Light & Dark Mode:
      - Windows Chip: `bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20` + logo Microsoft + jumlah file.
      - macOS Chip: `bg-slate-500/10 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600` + logo Apple + jumlah file.
      - Ikon upload/edit yang menyala biru brand saat di-hover.
    - **State Belum Ada File**: Ditampilkan tombol aksi dashed yang bersih dan menarik (`[ + Upload Setup ]`) untuk mengarahkan admin mengunggah installer secara instan.

### 2. Files Created & Modified
- `client/src/lib/pages/AdminProducts.svelte` - Redesain sel tabel File Setup / Installer.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v47.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 47.

---

## Snapshot 48 - Pembersihan Emoji & Integrasi SVG Warning pada Dropdown Filter Bank (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Opsi `⚠️ Belum Diset` pada dropdown filter bank di Manajemen Afiliasi menggunakan emoji mentah di sebelah kiri teks, yang tidak profesional dan tidak konsisten dengan standar antarmuka.
- **Solusi**:
  - **Dukungan Warning Prop pada CustomSelect**:
    - Menambahkan properti `warning?: boolean` pada interface `OptionItem` di `CustomSelect.svelte`.
    - Merender badge SVG warning segitiga warna amber di sebelah **kanan** (bukan di kiri) tanpa emoji atau karakter simbolik apapun.
  - **Pembaruan Opsi Filter Bank**:
    - Opsi bank di `AdminAffiliate.svelte` diubah dari `{ value: 'unset', label: '⚠️ Belum Diset' }` menjadi `{ value: 'unset', label: 'Belum Diset', warning: true }`.

### 2. Files Created & Modified
- `client/src/lib/components/CustomSelect.svelte` - Penambahan properti `warning` dan render SVG warning segitiga di sisi kanan.
- `client/src/lib/pages/AdminAffiliate.svelte` - Migrasi opsi `Belum Diset` ke SVG warning native.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v48.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 48.

---

## Snapshot 49 - Konfigurasi Default Paginasi Tabel Afiliasi (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Paginasi tabel pada halaman Manajemen Afiliasi (`AdminAffiliate.svelte`) secara default menampilkan 20 baris per halaman alih-alih 10.
- **Solusi**:
  - Mengubah nilai inisial `pageSize` di `AdminAffiliate.svelte` dari `20` menjadi `10`.
  - Paginasi kini langsung memuat 10 affiliator pertama secara default dan tetap responsif saat admin memilih opsi 20, 50, atau 100 baris.

### 2. Files Created & Modified
- `client/src/lib/pages/AdminAffiliate.svelte` - Penyesuaian `let pageSize = 10`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v49.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 49.

---

## Snapshot 50 - Peningkatan Kontras & Tipografi Sel Rekening Payout Afiliasi (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Kolom *Rekening Payout* pada tabel affiliator memiliki kontras warna yang rendah pada Light Mode: teks bank dan nama pemilik (`a.n.`) terlalu redup/pudar, serta badge *Belum Diset* menggunakan warna kuning muda yang sulit terbaca.
- **Solusi**:
  - **Dynamic Bank Badges**:
    - Dibuat fungsi helper `getBankBadgeStyle(bank)` dengan warna tematik spesifik per institusi:
      - BCA: `blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30`
      - BNI: `teal-500/10 text-teal-800 dark:text-teal-400 border-teal-500/30`
      - BRI: `sky-500/10 text-sky-800 dark:text-sky-400 border-sky-500/30`
      - Mandiri: `amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/30`
      - E-Wallet / Bank Digital: `purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30`
  - **High-Contrast Account Owner & Nomor Rekening**:
    - Nomor rekening monospaced tebal dengan 1-touch copy button.
    - Nama pemilik rekening menggunakan teks tegas: `a.n. <strong class="text-[var(--text)] font-bold">{bankOwner}</strong>`.
  - **High-Contrast Belum Diset Badge**:
    - Badge beranimasi halus dengan kontras tajam `bg-amber-500/15 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30` dan ikon SVG warning segitiga.

### 2. Files Created & Modified
- `client/src/lib/pages/AdminAffiliate.svelte` - Penambahan `getBankBadgeStyle` dan peningkatan kontras sel Rekening Payout.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Penambahan `getBankBadgeStyle` dan perbaikan kontras Rekening Tujuan.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v50.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 50.

---

## Snapshot 51 - Normalisasi Kontras Elemen Kuning/Amber di Light Theme (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Teks dan ikon bernuansa kuning/amber (`text-amber-400`, `#fbbf24`) memiliki rasio kontras yang sangat rendah pada latar belakang putih di Light Mode (terlihat redup dan sulit dibaca).
- **Solusi**:
  - **Sistem Pewarnaan Responsif High-Contrast**:
    - Seluruh tipografi amber dikalibrasi menjadi `text-amber-600 dark:text-amber-400` atau `text-amber-700 dark:text-amber-400` sehingga memiliki kontras tajam (WCAG AA > 4.5:1) pada tema terang tanpa mengurangi kecerahan pada tema gelap.
    - Metrik Card *Menunggu Payout*, tabel *Komisi Tertunda*, status badge *Pending*, dan modal transaksi diperbarui secara menyeluruh.
    - Banner peringatan di `AdminCategories.svelte` diperbaiki menggunakan ikon SVG segitiga dan warna `text-amber-800 dark:text-amber-300`.

### 2. Files Created & Modified
- `client/src/lib/pages/AdminAffiliate.svelte` - Normalisasi kontras metrik card, tabel komisi tertunda, dan modal rincian.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Normalisasi kontras card dicairkan bulan ini.
- `client/src/lib/pages/AdminPayments.svelte` - Normalisasi badge pending transaksi dan komisi afiliasi.
- `client/src/lib/pages/AdminDashboard.svelte` - Peningkatan kontras teks pending pembayaran.
- `client/src/lib/pages/AdminCategories.svelte` - Peningkatan kontras banner perhatian hapus kategori dengan SVG native.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v51.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 51.

---

## Snapshot 52 - Integrasi Logo Resmi Bank (BCA, BNI, BRI, Mandiri) pada Sel Rekening Payout (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Kolom rekening payout sebelumnya hanya menampilkan teks singkatan nama bank. Diperlukan tampilan logo resmi bank (BCA, BNI, BRI, Mandiri) yang tajam, proporsional, dan konsisten di tema gelap maupun terang.
- **Solusi**:
  - **Asset Bank SVG Resmi**:
    - Mengintegrasikan file vektor SVG transparan resmi untuk 4 bank utama di database:
      - `public/images/banks/bca.svg`
      - `public/images/banks/bni.svg`
      - `public/images/banks/bri.svg`
      - `public/images/banks/mandiri.svg`
  - **Dual-Theme High-Contrast Badge Container**:
    - Merender logo di dalam badge putih bersih berbingkai halus (`h-6 px-1.5 py-0.5 rounded-lg bg-white border border-slate-200/80 dark:border-slate-700 shadow-2xs`) agar warna asli logo (navy BCA, teal/orange BNI, biru/oranye BRI, biru/gold Mandiri) tampil 100% presisi dan kontras di latar belakang Light Mode maupun Dark Mode.
  - **Terapkan Menyeluruh**:
    - Diterapkan pada tabel utama dan mobile view di `AdminAffiliate.svelte` serta `AdminAffiliateHistory.svelte`, dan modal konfirmasi transfer payout.

### 2. Files Created & Modified
- `public/images/banks/bca.svg` - Logo vektor resmi BCA.
- `public/images/banks/bni.svg` - Logo vektor resmi BNI.
- `public/images/banks/bri.svg` - Logo vektor resmi BRI.
- `public/images/banks/mandiri.svg` - Logo vektor resmi Bank Mandiri.
- `client/src/lib/pages/AdminAffiliate.svelte` - Integrasi fungsi `getBankLogo` dan render badge logo bank.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Integrasi fungsi `getBankLogo` dan render badge logo bank.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v52.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 52.

---

## Snapshot 53 - Integrasi Ikon Logo Bank pada Dropdown Filter CustomSelect (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Dropdown filter bank di panel Affiliate Management sebelumnya hanya menampilkan teks "Bank BCA", "Bank BNI", dsb tanpa logo visual.
- **Solusi**:
  - **Dukungan Ikon pada CustomSelect**:
    - Menambahkan properti `icon?: string` pada antarmuka `OptionItem` di `CustomSelect.svelte`.
    - Merender badge logo bank mini pada trigger button maupun setiap item opsi dropdown listbox.
  - **Integrasi Filter Bank**:
    - Opsi bank dinamis di `AdminAffiliate.svelte` diinjeksikan logo resmi bank via `getBankLogo(b)`.

### 2. Files Created & Modified
- `client/src/lib/components/CustomSelect.svelte` - Penambahan properti `icon` dan rendering logo bank pada trigger & opsi.
- `client/src/lib/pages/AdminAffiliate.svelte` - Pemberian logo bank pada `bankOptions`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v53.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 53.

---

## Snapshot 54 - Peningkatan Kontras Tipografi Light Mode & Pagination Kategori Produk (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada tema terang di `AdminCategories.svelte`, teks badge jumlah produk, status aktif, inisial kategori, dan slug/ID kurang kontras/terlihat pudar.
  - Tombol aksi (Edit & Hapus) hanya berupa icon abu-abu kecil 32x32 tanpa label yang jelas.
  - Belum ada sistem pagination pada tabel kategori.
- **Solusi**:
  - **Sistem Pagination**:
    - Implementasi `pageSize` (default 10), `currentPage`, dan `pageSizeOptions` via `CustomSelect`.
    - Footer pagination lengkap dengan tombol *Sebelumnya / Selanjutnya* dan counter baris.
  - **Tipografi High-Contrast (WCAG AA)**:
    - Chip produk: `bg-purple-500/15 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30`.
    - Status aktif/nonaktif: `text-emerald-700 dark:text-emerald-400` / `text-rose-700 dark:text-rose-400`.
    - Inisial & slug: Menggunakan teks tebal berbobot kontras tinggi.
    - Tombol aksi: Ditingkatkan dengan tombol terstruktur berlabel teks dan ikon yang jelas (`Edit` dan `Hapus`).

### 2. Files Created & Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v54.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 54.

---

## Snapshot 55 - Integrasi Ikon Kategori & Kalibrasi Kontras Katalog Produk (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada tema terang di `AdminProducts.svelte`, pill kategori (`text-purple-400`), status aktif (`text-emerald-400`), dan tombol aksi terlihat kurang kontras.
  - Dropdown filter kategori belum menampilkan icon visual kategori.
- **Solusi**:
  - **Ikon pada Filter Kategori & Modal**:
    - Memetakan properti `icon` dari daftar kategori ke `categoryFilterOptions` dan `modalCategoryOptions` di `AdminProducts.svelte`.
  - **Sel Kategori Berikon & High Contrast**:
    - Kolom kategori menampilkan icon gambar/SVG kategori dan tipografi `text-purple-700 dark:text-purple-300 font-extrabold bg-purple-500/15 dark:bg-purple-500/10 border-purple-500/30`.
  - **Status Toggle High Contrast**:
    - Aktif: `text-emerald-700 dark:text-emerald-400 bg-emerald-500/15 dark:bg-emerald-500/10 border-emerald-500/30`.
    - Nonaktif: `text-rose-700 dark:text-rose-400 bg-rose-500/15 dark:bg-rose-500/10 border-rose-500/30`.
  - **Tombol Aksi Terstruktur**:
    - Mengganti tombol abu-abu polos dengan tombol aksi berlabel jelas (`Edit` dan `Hapus`).

### 2. Files Created & Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v55.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 55.

---

## Snapshot 56 - Navigasi Filter Kategori & Animasi Status Toggle (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada halaman `AdminCategories.svelte`, klik pada chip produk belum mengarahkan ke katalog produk dengan filter kategori yang dipilih.
  - Status aktif/nonaktif kategori memerlukan interaksi toggle yang responsif dengan visual feedback, loading spinner, dan animasi status.
- **Solusi**:
  - **Deep-linking Filter Produk**:
    - Chip kolom produk di `AdminCategories.svelte` dijadikan tombol interaktif yang memicu `push('/admin/products?category_id=' + cat.id)`.
    - Di `AdminProducts.svelte`, ditambahkan fungsi `syncCategoryFromUrl()` dan event listener `hashchange` untuk membaca parameter URL secara otomatis.
  - **Status Toggle dengan Animasi**:
    - Tombol status aktif/nonaktif dilengkapi tactile click feedback (`active:scale-95`), glowing dot indicator, spinner saat proses AJAX berlangsung (`togglingId`), pembaruan UI optimistik, dan notifikasi konfirmasi.

### 2. Files Created & Modified
- `client/src/lib/pages/AdminCategories.svelte` - Penambahan navigasi filter produk dan animasi tactile status toggle.
- `client/src/lib/pages/AdminProducts.svelte` - Penambahan sinkronisasi query parameter URL `category_id`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v56.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 56.

---

## Snapshot 57 - Kalibrasi Kontras Rincian Transaksi Komisi & Peningkatan Tombol Tutup (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada modal "Rincian Transaksi Komisi" di `AdminAffiliate.svelte`, nominal komisi berwarna kuning pudar sehingga sulit terbaca pada tema terang.
  - Tombol "Tutup" terlalu polos dan tidak memiliki affordance tombol yang jelas.
- **Solusi**:
  - **Tipografi Nominal High Contrast**:
    - Nilai komisi tiap transaksi dan total komisi diubah menjadi `text-amber-700 dark:text-amber-400 font-black` yang tajam dan kontras di tema terang maupun gelap.
  - **Peningkatan Affordance Tombol Tutup**:
    - Tombol "Tutup" bawah diperbarui dengan ikon close, padding proporsional, border, hover depth, shadow, dan animasi `active:scale-95`.
    - Tombol 'X' header modal diperjelas dengan container tombol bersudut halus.

### 2. Files Created & Modified
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Standardisasi tombol tutup modal detail payout.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v57.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 57.

---

## Snapshot 58 - Kalibrasi Kontras Komprehensif Light Mode & Posisi Ikon Warning (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada halaman `AdminAffiliate.svelte` di tema terang, teks kupon, inisial avatar, status lunas, teks trend bulan ini, dan label "Tidak Ada Tagihan" terlihat pudar.
  - Ikon warning pada badge "Belum Diset" perlu ditempatkan di sisi kanan teks dengan SVG vector resmi dan kontras warna yang tegas.
- **Solusi**:
  - **Kupon & Avatar High-Contrast**:
    - Kupon: `bg-sky-500/15 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 font-bold`.
    - Avatar inisial: `text-blue-700 dark:text-blue-300 font-extrabold border-blue-500/30`.
  - **Badge Belum Diset**:
    - Diformat menjadi `text-amber-800 dark:text-amber-300 font-extrabold bg-amber-500/15 dark:bg-amber-500/10 border-amber-500/40` dengan ikon SVG warning di sebelah kanan label.
  - **Badge Lunas (Rp 0)**:
    - Dipertegas dengan `text-emerald-700 dark:text-emerald-300 font-extrabold bg-emerald-500/15 dark:bg-emerald-500/10 border-emerald-500/30`.
  - **Trend & Status Aksi**:
    - Trend kenaikan/penurunan menggunakan `text-emerald-700` dan `text-rose-700`, teks stabil dan "Tidak Ada Tagihan" dibungkus badge berlatar permukaan yang tegas.

### 2. Files Created & Modified
- `client/src/lib/pages/AdminAffiliate.svelte` - Kalibrasi kontras light mode pada seluruh kolom tabel dan kartu mobile.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v58.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 58.

---

## Snapshot 59 - Standardisasi Header Eyebrow, Terminologi Profesional & Uppercase Table Headers (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Teks subtitle/tag header seperti "Admin Console" dan "Licensing Engine" terkesan alay dan tidak seragam.
  - Header tabel di banyak halaman (Admin Management, Riwayat Pembayaran, Daftar Pembayaran, Licenses, Orders) masih menggunakan format campuran/camelCase dan belum konsisten huruf kapital penuh (uppercase).
- **Solusi**:
  - **Standardisasi Eyebrow & Tag Profesional**:
    - `AdminLayout.svelte`, `AdminCategories.svelte`, `AdminProducts.svelte`, `AdminCreateTrial.svelte`: Mengubah eyebrow menjadi `PANEL ADMIN ZIQVA`.
    - `AdminDashboard.svelte`: Tag header diubah menjadi `PANEL UTAMA` dan deskripsi `Ringkasan Sistem`.
    - `AdminPayments.svelte`: Tag header diubah menjadi `MANAJEMEN TRANSAKSI` dan `Billing & Verifikasi`.
    - `AdminCreateTrial.svelte`: Tag `Licensing Engine` diubah menjadi `GENERATOR LISENSI` dan `Token Uji Coba`.
  - **Standardisasi Table Header Uppercase**:
    - Seluruh tabel pada `AdminAffiliate.svelte`, `AdminAffiliateHistory.svelte`, `AdminPayments.svelte`, `AdminDashboard.svelte`, `Licenses.svelte`, dan `Orders.svelte` diformat konsisten dengan styling `uppercase tracking-wider font-bold text-[var(--text-3)] text-xs` dan label uppercase.

### 2. Files Created & Modified
- `client/src/lib/components/AdminLayout.svelte` - Update default eyebrow menjadi `PANEL ADMIN ZIQVA`.
- `client/src/lib/pages/AdminDashboard.svelte` - Standardisasi tag header `PANEL UTAMA` dan uppercase `<th>`.
- `client/src/lib/pages/AdminPayments.svelte` - Standardisasi tag header `MANAJEMEN TRANSAKSI` dan uppercase `<th>`.
- `client/src/lib/pages/AdminCreateTrial.svelte` - Standardisasi tag header `GENERATOR LISENSI`.
- `client/src/lib/pages/AdminCategories.svelte` - Update eyebrow `PANEL ADMIN ZIQVA`.
- `client/src/lib/pages/AdminProducts.svelte` - Update eyebrow `PANEL ADMIN ZIQVA`.
- `client/src/lib/pages/AdminAffiliate.svelte` - Format uppercase `<th>` `uppercase tracking-wider font-bold`.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Format uppercase `<th>` `uppercase tracking-wider font-bold`.
- `client/src/lib/pages/Licenses.svelte` - Format uppercase `<th>` `uppercase tracking-wider font-bold`.
- `client/src/lib/pages/Orders.svelte` - Format uppercase `<th>` `uppercase tracking-wider font-bold`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v59.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 59.

---

## Snapshot 60 - Implementasi Fitur Profil Admin & Verifikasi Visual Penuh Chrome 68 Konfigurasi (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Halaman Admin belum memiliki modul profil mandiri untuk mengubah nama tampilan admin, mengganti PIN 6-digit keamanan, dan memantau status diagnostik performa server.
  - Sidebar admin di area footer belum mengarah ke rute halaman profil admin.
  - Pengujian responsif dan kontras tema visual pada seluruh halaman publik, admin, dan member perlu diaudit menyeluruh di Google Chrome pada resolusi Desktop (1280x800) dan Mobile (375x812) dengan tema Dark dan Light.
- **Solusi**:
  - **Fitur Profil Admin Komprehensif (`AdminProfile.svelte`)**:
    - Backend API di `src/controllers/adminController.ts` dan `src/routes/adminRoutes.ts`: `GET /admin/api/profile`, `POST /admin/api/profile/update-pin`, `POST /admin/api/profile/update-username`.
    - Kartu Identitas Administrator (Avatar Initial, Role Badge, Verified status, IP sesi).
    - Form Ubah Username dengan validasi panjang karakter dan pembaruan session name instan.
    - Form Ubah PIN Keamanan 6-Digit dengan toggle visibilitas password/text, validasi PIN lama, dan konfirmasi PIN baru.
    - Kartu Diagnostik Sistem (Node.js engine, database pool limit 5, memori RSS, dan target branch `reborn`).
    - Grid Metrik Platform Global (Total Software, Kategori, Transaksi, Lisensi Aktif, Mitra Afiliasi).
  - **Integrasi Navigasi Sidebar**:
    - Menu `Profil Admin` ditambahkan pada `AdminSidebar.svelte`.
    - Avatar dan nama admin pada sidebar footer dibungkus tautan interaktif menuju `#/admin/profile`.
  - **Pencegahan Broken Image pada Seluruh Halaman Member**:
    - Menambahkan `imgErrorMap` dan fallback icon cantik pada `Dashboard.svelte`, `Licenses.svelte`, `Downloads.svelte`, dan `Tutorials.svelte`.
  - **Audit Otomatis Headless Chrome (CDP Protocol)**:
    - Menjalankan 68 konfigurasi pengujian visual mencakup 17 rute pada tema Dark & Light dan viewport Desktop & Mobile.
    - Hasil audit: 68/68 PASS (0 overflow horizontal, 0 broken image, 0 artifact teks).
    - Proses Chrome otomatis dihentikan (`SIGKILL`) dan direktori profil `/tmp/ziqva-chrome-test-tmp` dihapus bersih dari sistem penyimpanan.

### 2. Files Created & Modified
- `src/controllers/adminController.ts` - Menambahkan method `apiGetProfile`, `apiUpdatePin`, `apiUpdateUsername`.
- `src/routes/adminRoutes.ts` - Menambahkan endpoint `/admin/profile`, `/admin/api/profile`, `/admin/api/profile/update-pin`, `/admin/api/profile/update-username`.
- `client/src/lib/pages/AdminProfile.svelte` - Halaman Profil & Keamanan Admin dengan form identitas, ubah PIN, metrik platform, dan diagnostik sistem.
- `client/src/App.svelte` - Registrasi rute SPA `'/admin/profile': AdminProfile`.
- `client/src/lib/components/AdminSidebar.svelte` - Navigasi Profil Admin dan footer profil yang dapat diklik.
- `client/src/lib/pages/Dashboard.svelte` - Fallback gambar produk dengan `imgErrorMap`.
- `client/src/lib/pages/Licenses.svelte` - Fallback gambar produk dengan `imgErrorMap`.
- `client/src/lib/pages/Downloads.svelte` - Fallback gambar produk dengan `imgErrorMap`.
- `client/src/lib/pages/Tutorials.svelte` - Fallback gambar produk dengan `imgErrorMap`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v60.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 60.

---

## Snapshot 61 - Animasi Slide Halus pada Accordion Submenu Produk & Affiliate Management (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Menu accordion submenu pada navigasi Produk dan Affiliate Management di `AdminSidebar.svelte` terbuka dan tertutup secara instan (kaku) tanpa transisi visual, sehingga terasa kurang mulus saat pengguna berpindah halaman atau membuka/menutup menu.
- **Solusi**:
  - **Svelte Native Slide Transition & Chevron Rotation**:
    - Mengintegrasikan `transition:slide={{ duration: 250, easing: cubicOut }}` pada container submenu Produk (`Katalog Produk` & `Kategori Produk`) dan Affiliate Management (`Daftar Mitra & Payout` & `Riwayat Pencairan`).
    - Chevron indikator arah dilengkapi transisi rotasi halus 180 derajat (`transition-transform duration-300 ease-out`).
    - Penanda aktif dot indicator dengan transisi warna instan dan smooth.
  - **Penyesuaian Sub-item Active State**:
    - `AdminAffiliateHistory.svelte` diset dengan `activePage="affiliate-history"` agar submenu `Riwayat Pencairan` tersorot aktif secara spesifik ketika halaman dibuka.

### 2. Files Modified
- `client/src/lib/components/AdminSidebar.svelte` - Penambahan animasi slide transisi Svelte pada submenu Produk dan Affiliate Management.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Update `activePage="affiliate-history"`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v61.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 61.

---

## Snapshot 62 - Penambahan Preset Durasi Trial Tambahan (3 Bulan, 6 Bulan, Setahun) (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada halaman Buat Trial (`AdminCreateTrial.svelte`), pilihan preset durasi cepat hanya tersedia hingga 1 Bulan, belum memiliki preset durasi jangka menengah dan panjang (3 Bulan, 6 Bulan, Setahun), dan opsi satuan waktu belum mendukung `Tahun`.
- **Solusi**:
  - **Penambahan Preset Durasi Cepat**:
    - Menambahkan `3 Bulan` (`3 month`), `6 Bulan` (`6 month`), dan `Setahun` (`1 year`) pada deretan preset pill di samping 1 Bulan.
    - Menambahkan opsi satuan waktu `Tahun` (`year`) pada `unitOptions` CustomSelect.
  - **Backend Support Satuan Tahun**:
    - Memperbarui `processCreateTrial` di `src/controllers/adminController.ts` untuk mengonversi satuan `year` ke 31.536.000 detik (365 hari).
    - Memperbarui opsi `<option value="year">Tahun</option>` pada template fallback `src/views/admin-create-trial.ts`.

### 2. Files Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v62.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 62.

---

## Snapshot 63 - Template Chat WhatsApp Klien (Ramah & Formal) & Rincian Lengkap Token Trial (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Modal sukses pembuatan token trial pada `AdminCreateTrial.svelte` sebelumnya hanya menampilkan rincian ringkas, belum memiliki format pesan chat yang ramah namun tetap formal untuk langsung dikirimkan ke calon pembeli/klien melalui WhatsApp.
  - Template belum mencantumkan informasi lengkap seperti estimasi waktu expired aktual (WIB), status masa aktif mulai sekarang, panduan langkah aktivasi 1-2-3, serta ketentuan penggunaan lisensi single-device HWID lock.
- **Solusi**:
  - **Generator Format Pesan WhatsApp Ramah & Formal**:
    - Greeting hangat & sopan: *"Halo kak! 👋 Terima kasih telah mencoba software kami. Berikut adalah kode lisensi uji coba (Trial) untuk software Anda, selamat digunakan ya!"*.
    - Detail Terstruktur: Software, Kode Token, Durasi, Status Masa Aktif ("Berjalan mulai sekarang"), Perkiraan Expired (`calculateExpiryDate` otomatis dalam format WIB), Batas Perangkat (1 PC HWID Lock).
    - Panduan Aktivasi: Langkah-langkah jelas cara memasukkan token di aplikasi software.
    - Informasi & Ketentuan Penggunaan: HWID lock otomatis, koneksi internet, dan kontak bantuan/upgrade ke Full/Lifetime.
  - **Penyempurnaan Tampilan Modal Sukses**:
    - Grid 4 spesifikasi ringkas (Software, Durasi, Masa Aktif, Batas Perangkat).
    - Kotak token besar dengan tombol salin instan.
    - Pratinjau visual gelembung chat WhatsApp yang dapat di-scroll dan disalin 1-klik (`Salin Format Chat`).
    - Tombol aksi utama di footer modal: `Salin Pesan WhatsApp` (Hijau Emerald WhatsApp), `Salin Token & Selesai`, dan `Buat Token Lain`.

### 2. Files Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v63.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 63.

---

## Snapshot 64 - Perbaikan Dropdown Clipping & Smart Positioning pada CustomSelect (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Menu popover `CustomSelect` (seperti filter Bank pada `AdminAffiliate.svelte`) terpotong setengah di bagian bawah karena container card induk membungkus toolbar dengan `overflow-hidden`.
  - Dropdown tidak mendeteksi sisa ruang di bagian bawah viewport sehingga pada data tabel pendek, item bawah (`Belum Diset`) terpotong.
- **Solusi**:
  - **Penghapusan Overflow Clipping pada Card Induk**:
    - Menghapus class `overflow-hidden` pada wrapper card toolbar di `AdminAffiliate.svelte`, `AdminAffiliateHistory.svelte`, `AdminProducts.svelte`, dan `AdminCategories.svelte`.
    - Properti scroll horizontal `overflow-x-auto` tetap dipertahankan khusus pada area tabel data (`hidden md:block overflow-x-auto rounded-b-2xl`).
  - **Smart Upward Positioning & Max-Height Scrolling**:
    - `CustomSelect.svelte` kini menghitung posisi viewport (`getBoundingClientRect`) saat dibuka. Jika ruang di bawah terbatas (`< 260px`), dropdown otomatis membuka ke atas (`bottom-full mb-1.5`).
    - Ditambahkan `max-h-72 overflow-y-auto` agar seluruh opsi tetap dapat diakses dengan scrollbar internal yang mulus.

### 2. Files Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v64.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 64.

---

## Snapshot 65 - Perbaikan Kontras & Hierarki Visual ThemeToggle (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada komponen `ThemeToggle.svelte`, dalam kondisi Mode Gelap aktif, icon Matahari (Sun) yang tidak terpilih tetap menyala dengan warna kuning amber terang (opacity 90%), sedangkan knob Bulan (Moon) aktif di sebelah kanan berwarna gelap (`#1e293b`) dengan icon ungu pucat (`#a5b4fc`). Hal ini membingungkan pengguna mengenai mode tampilan mana yang sedang aktif.
- **Solusi**:
  - **Hierarki Kontras Tinggi & Dimming State Tidak Aktif**:
    - **Mode Gelap Aktif**: Thumb slider sebelah kanan kini menyala dengan gradien biru-indigo vibran (`linear-gradient(135deg, #3b82f6, #6366f1)`), glow shadow halus (`box-shadow: 0 0 12px rgba(99, 102, 241, 0.4)`), dan icon Bulan putih bersih (`#ffffff`). Icon Matahari di sebelah kiri otomatis diredupkan (`color: #94a3b8; opacity: 0.4`).
    - **Mode Terang Aktif**: Thumb slider sebelah kiri menyala dengan warna putih bersih beraksen amber (`#ffffff` + border/glow `#f59e0b`), dan icon Bulan di sebelah kanan otomatis diredupkan (`color: #94a3b8; opacity: 0.4`).

### 2. Files Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v65.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 65.

---

## Snapshot 66 - Standarisasi Nomor Halaman (Numbered Pagination) Seluruh Tabel Admin (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada beberapa tabel admin (khususnya *Affiliate Management*, *Riwayat Pencairan*, *Kategori Produk*, dan *Daftar Transaksi Pembayaran*), kontrol pagination sebelumnya hanya memiliki tombol text `Sebelumnya` dan `Selanjutnya` tanpa nomor halaman (`1, 2, ..., N`), tidak konsisten dengan pagination standar di *Katalog Produk* (`AdminProducts.svelte`).
- **Solusi**:
  - **Penerapan Numbered Pagination Buttons Standar**:
    - Menambahkan tombol pil nomor halaman interaktif dengan penyorotan halaman aktif (`bg-[var(--brand)] text-white shadow-xs`), pembatas elipsis (`...`), serta tombol `Sebelumnya` dan `Selanjutnya` ber-ikon panah SVG.
    - Diterapkan secara seragam di:
      - `AdminAffiliate.svelte` (Affiliate Management)
      - `AdminAffiliateHistory.svelte` (Riwayat Pencairan Komisi)
      - `AdminCategories.svelte` (Kategori Produk)
      - `AdminPayments.svelte` (Daftar Transaksi Pembayaran)

### 2. Files Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v66.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 66.

---

## Snapshot 67 - Redesain & Kontras Riwayat Pembayaran Komisi (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada halaman *Riwayat Pembayaran Komisi* (`AdminAffiliateHistory.svelte`):
    1. Logo bank tujuan transfer sebelumnya belum seragam dan tidak muncul dengan logo svg resmi seperti di *Affiliate Management*.
    2. Angka nominal transfer dan pill badge `Ditransfer` berwarna hijau muda pudar sehingga sulit terbaca di mode terang (Light Mode).
    3. Angka pada metric card "Dicairkan Bulan Ini" berwarna kuning cerah pudar sehingga kontrasnya sangat rendah di mode terang.
    4. Input pencarian memiliki tombol "Filter Log" terpisah dengan gap yang terlalu lebar dan canggung.
    5. Header tabel belum semuanya UPPERCASE.
- **Solusi**:
  - **Logo Bank Resmi**: Memetakan seluruh bank & e-wallet (BCA, BNI, BRI, Mandiri, CIMB, Jago, SeaBank, Dana, OVO, GoPay) ke logo SVG resmi dalam kontainer putih rapi (`rounded-lg bg-white border border-slate-200/80 shadow-2xs`).
  - **Hierarki Kontras Tinggi**:
    - Nominal transfer ditingkatkan menjadi `text-emerald-700 dark:text-emerald-400 font-extrabold text-sm` dengan badge `bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30`.
    - Metric Card "Dicairkan Bulan Ini" menggunakan `text-amber-700 dark:text-amber-400 font-extrabold` dan subtitle tebal beraksen kontras.
  - **Live Debounced Search Bar**: Mengintegrasikan pencarian live dengan debounce 300ms, tombol batal/clear (✕) instan, dan menghapus tombol terpisah yang memicu gap canggung.
  - **Standarisasi Header Tabel**: Seluruh header tabel kini strictly UPPERCASE (`ID`, `WAKTU TRANSFER`, `AFFILIATOR`, `REKENING TUJUAN`, `NOMINAL`, `OPERATOR & CATATAN`, `AKSI`).

### 2. Files Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v67.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 67.

---

## Snapshot 68 - Default 10 Baris Riwayat Pencairan, Retensi Accordion Sidebar & Animasi Active Pill (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada *Riwayat Pembayaran Komisi* (`AdminAffiliateHistory.svelte`), default jumlah baris per halaman sebelumnya adalah 20 baris dan perlu diubah menjadi 10 baris.
  - Pada *Sidebar Admin* (`AdminSidebar.svelte`), ketika pengguna membuka accordion submenu (misal *Produk*) lalu berpindah atau membuka submenu lain (misal *Affiliate Management*), submenu sebelumnya tidak boleh otomatis tertutup (harus tetap terbuka dan bisa terbuka bersamaan).
  - Indikator menu aktif pada sidebar perlu memiliki animasi pill / dot aktif yang jelas baik di menu global maupun di dalam submenu.
- **Solusi**:
  - **Default 10 Baris**: Mengubah inisialisasi `pageSize` di `AdminAffiliateHistory.svelte` dari 20 menjadi `10`.
  - **Multi-Open Accordion Retention**: Menghapus auto-collapse mutually-exclusive; kedua accordion (*Produk* dan *Affiliate Management*) dapat terbuka bersamaan dan status terbukanya dipertahankan via `localStorage` ('admin_sidebar_products', 'admin_sidebar_affiliate').
  - **Animasi Active Pill & Dot Indicator**: Menambahkan dot pill aktif beranimasi putih (`w-1.5 h-1.5 rounded-full bg-white shadow-xs`) dan penyorotan ring (`ring-1 ring-blue-400/40`) pada seluruh menu aktif di `AdminSidebar.svelte` dan `Sidebar.svelte`.

### 2. Files Modified
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Default `pageSize = 10`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v68.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 68.

---

## Snapshot 69 - Modul Manajemen Pengguna / Admin User Management (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Administrator belum memiliki pusat kendali komprehensif untuk memantau, memverifikasi, memblokir, mereset kata sandi, dan melihat data relasional pengguna (lisensi software aktif, riwayat transaksi pesanan, status program afiliasi, dan riwayat lokasi/IP).
- **Solusi**:
  - **Backend Controller & Routing**:
    - Menambahkan `apiGetUsers`, `apiGetUserDetail`, `apiToggleUserBan`, `apiToggleUserVerified`, `apiResetUserPassword`, dan `apiUpdateUser` pada `src/controllers/adminController.ts`.
    - Mendaftarkan endpoint pada `src/routes/adminRoutes.ts`.
  - **Frontend SPA Svelte (`AdminUsers.svelte`)**:
    - **Top Metric Cards**: Menampilkan 4 metrik agregasi (Total Pengguna, Terverifikasi, Diblokir/Banned, dan Mitra Afiliasi).
    - **Filter & Toolbar Terintegrasi**: Memasang `SegmentedTabs` (Semua, Terverifikasi, Belum Verifikasi, Diblokir, Mitra Afiliasi), live debounced search bar (300ms) dengan tombol batal instan, serta `CustomSelect` untuk sorting dan pagination size.
    - **Enterprise Table**: Header UPPERCASE (`PENGGUNA & KONTAK`, `STATUS AKUN`, `LISENSI & PESANAN`, `PROGRAM AFILIASI`, `REGISTRASI & LOKASI`, `AKSI`) dengan avatar initial berwarna gradien, status badge high-contrast, dan feedback salin email instan.
    - **Aksi Modal Komprehensif**:
      - Modal Detail Pengguna: Ringkasan profil lengkap, daftar lisensi PC aktif dengan status kedaluwarsa, dan riwayat pesanan/transaksi.
      - Modal Edit Pengguna: Update Nama, WhatsApp, dan Perusahaan (Email tetap permanen dan terkunci).
      - Modal Reset Password: Reset kata sandi member (minimal 6 karakter).
      - Modal Konfirmasi Banned / Unban & Modal Konfirmasi Verifikasi Akun.
    - **Standardized Numbered Pagination**: Paginasi nomor pil (`1`, `2`, `...`, `N`) dengan tombol Next/Prev.
    - **Mobile Responsive Layout**: Tampilan kartu modular yang rapi di layar ponsel.
  - **Sidebar & Routing Integration**:
    - Menambahkan menu `Manajemen Pengguna` di `AdminSidebar.svelte`.
    - Mendaftarkan rute `#/admin/users` di `client/src/App.svelte`.

### 2. Files Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v69.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 69.

---

## Snapshot 70 - Migrasi Penuh Server-Side Processing untuk Tabel Admin & Affiliate Management (27 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada halaman *Daftar Mitra & Payout* (`AdminAffiliate.svelte`), frontend sebelumnya melakukan filtering tab, bank dropdown, search keyword, sorting, dan slice paginasi di memori sisi klien (client-side), sedangkan backend hanya mengembalikan data statis. Hal ini tidak efisien saat data membesar dan tidak konsisten dengan modul lainnya yang telah berarsitektur *Server-Side First*.
- **Solusi**:
  - **Backend Controller (`apiGetAffiliate`)**:
    - Menerapkan pemrosesan query parameter server-side: `page`, `limit`/`pageSize`, `search`, `tab` (`all`, `unpaid`, `bank_set`, `no_bank`), `bank` (nama bank atau `unset`), dan `sort` (`pending_desc`, `pending_asc`, `income_desc`, `paid_desc`, `bank_status`, `bank_unset_first`, `email_asc`, `email_desc`, `kupon_asc`, `newest`).
    - Menghitung tab counts global (`tabCounts`: `all`, `unpaid`, `bank_set`, `no_bank`) dan daftar bank yang tersedia (`availableBanks`) dari database.
    - Mengembalikan objek respons terstandar dengan `pagination` metadata (`page`, `pageSize`, `total`, `totalPages`).
  - **Frontend SPA (`AdminAffiliate.svelte`)**:
    - Mengubah seluruh interaksi (search input debounced 300ms, SegmentedTabs click, CustomSelect bank filter, CustomSelect sorter, CustomSelect page size, dan tombol nomor paginasi) menjadi pemanggilan API asinkron ke server `/admin/api/affiliate`.
    - Frontend kini murni hanya merender data yang disajikan oleh backend (*server-driven presentation*).
  - **Audit Keseluruhan Tabel Admin**:
    - `AdminUsers.svelte` (`/admin/api/users`): 100% Server-Side Search, Filter, Sort & Pagination.
    - `AdminAffiliate.svelte` (`/admin/api/affiliate`): 100% Server-Side Search, Tab, Bank Filter, Sort & Pagination.
    - `AdminAffiliateHistory.svelte` (`/admin/api/affiliate/history`): 100% Server-Side Search, Sort & Pagination.
    - `AdminPayments.svelte` (`/admin/api/payments`): 100% Server-Side Search, Sort & Pagination.
    - `AdminProducts.svelte` (`/admin/api/products`): 100% Server-Side Search, Category, Status, Sort & Pagination.

### 2. Files Modified
- `src/controllers/adminController.ts` - Upgraded `apiGetAffiliate` to full server-side processing.
- `client/src/lib/pages/AdminAffiliate.svelte` - Migrated to server-driven data fetching & event binding.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v70.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 70.

### 3. Database Schema Backup
- **Command**: `npm run backupdb:scheme` (`node scripts/backup-schema.js`)
- **File**: `/Users/fiko942/Desktop/appcenter/backup/schema_backup.sql`
- **Timestamp**: `2026-08-27T22:36:10+07:00`
- **Size**: 23KB (Verified)

---

## Snapshot 71 - Mitigasi Memory Leak, Infinite Loop Safeguard & Socket Hang Prevention (28 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  1. Generator product ID di `processCreateProduct` menggunakan `while (exists)` tanpa batas iterasi maksimum yang berisiko loop tak berujung dan memonopoli pool koneksi MySQL (`connection_limit=5`).
  2. Penggabungan chunk installer di `uploadProductInstallerChunk` membaca seluruh chunk secara sinkron (`fs.readFileSync`) tanpa backpressure stream `writeStream`, memicu lonjakan memori RAM ratusan MB serta tidak membersihkan folder chunk temporary yang ditinggalkan jika upload dibatalkan.
  3. Pemanggilan jaringan eksternal (`fetchYouTubePlaylistVideos` di `youtube.ts`, `fetch` di `xenditService.ts`, dan `encryption.ts`) tidak memiliki timeout, berpotensi menahan TCP socket dan closure memori tanpa henti jika gateway/jaringan hang.
- **Solusi**:
  - **Infinite Loop Safeguard**: Menambahkan safety counter `MAX_ATTEMPTS = 10` pada `processCreateProduct` dengan fallback timestamp modulo jika terjadi collision berulang.
  - **Stream Backpressure & Auto-Cleanup**: Mengganti pembacaan buffer sinkron dengan sequential stream piping (`fs.createReadStream` + `pipe` + promise drain) dan menambahkan pembersihan folder chunk orphan berumur > 2 jam di `os.tmpdir()/installer_chunks`.
  - **Network Timeouts & Sockets Hang Prevention**:
    - `fetchYouTubePlaylistVideos`: Menambahkan `timeout: 8000`, `req.on('timeout')`, `req.destroy()`, dan `res.resume()`.
    - `xenditService.ts`: Menambahkan `signal: AbortSignal.timeout(10000)` pada seluruh panggilan endpoint Xendit Invoice dan Payment Request.
    - `encryption.ts`: Menambahkan `signal: AbortSignal.timeout(10000)`.

### 2. Files Modified
- `src/controllers/adminController.ts` - Capped while-loop retry & stream backpressure chunk merger with orphan cleanup.
- `src/utils/youtube.ts` - 8s timeout with socket destruction on https.get.
- `src/services/xenditService.ts` - 10s AbortSignal timeout on all Xendit fetch requests.
- `src/utils/encryption.ts` - 10s AbortSignal timeout on decrypt fetch request.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v71.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 71.

### 3. Database Schema Backup
- **Command**: `npm run backupdb:scheme` (`node scripts/backup-schema.js`)
- **File**: `/Users/fiko942/Desktop/appcenter/backup/schema_backup.sql`
- **Timestamp**: `2026-08-28T07:51:31+07:00`
- **Size**: 23KB (Verified)

---

## Snapshot 72 - Pembersihan Heartbeat Interval & Optimalisasi Logging Prisma (28 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  1. `src/server.ts` memiliki `setInterval` kosong (heartbeat) yang berjalan terus tanpa pernah dihentikan, menahan event loop dan berpotensi mempertahankan process/context lama di memori saat reload.
  2. `src/config/prisma.ts` mengonfigurasi `log: ['query', 'info', 'warn', 'error']` aktif secara global. Di production, mencatat seluruh raw SQL query ke stdout menyebabkan penumpukan string log dan memory buffer backlog di process manager (PM2/Docker).
- **Solusi**:
  - Menghapus timer `setInterval` dari `src/server.ts` karena `app.listen()` sudah otomatis menjaga lifecycle server tetap aktif.
  - Mengubah konfigurasi log Prisma di `src/config/prisma.ts` menjadi `['warn', 'error']` secara default, dan hanya mencatat `['query', 'warn', 'error']` jika `DEBUG_PRISMA=true` pada mode development.

### 2. Files Modified
- `src/server.ts` - Removed dangling setInterval timer.
- `src/config/prisma.ts` - Optimized Prisma log levels for production memory efficiency.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v72.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 72.

---

## Snapshot 73 - Pembersihan Svelte SPA Debounce Timers & Multer Upload Temp File Leaks (28 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  1. Komponen halaman Svelte Admin (`AdminProducts.svelte`, `AdminAffiliate.svelte`, `AdminAffiliateHistory.svelte`, `AdminUsers.svelte`, `AdminPayments.svelte`) memiliki debounce timer pencarian dan feedback toast `setTimeout` tanpa hook `onDestroy`. Jika pengguna mengetik lalu berpindah halaman secara cepat (SPA routing), timer yang pending memicu closure pada instance komponen yang sudah unmount, menahan component tree di heap memori V8.
  2. Endpoint upload gambar dan icon produk/kategori di `adminController.ts` (`uploadProductImage`, `uploadCategoryIcon`) berpotensi meninggalkan file sementara multer di `os.tmpdir()` jika terjadi error di tengah proses try-catch.
  3. `formatSize` di `downloadService.ts` rentan `Math.log(0)` / `-Infinity` jika menerima byte <= 0 atau `NaN`.
- **Solusi**:
  - Menambahkan lifecycle hook `onDestroy` pada seluruh halaman Svelte Admin untuk membersihkan `searchDebounceTimer`, `copyToastTimer`, dan `searchTimeout`.
  - Menambahkan blok pembersihan darurat `fs.unlinkSync(req.file.path)` pada blok `catch` di `uploadProductImage` dan `uploadCategoryIcon`.
  - Menambahkan defensive check `if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B'` di `downloadService.ts`.

### 2. Files Modified
- `client/src/lib/pages/AdminProducts.svelte` - Added onDestroy hook to clear search debounce.
- `client/src/lib/pages/AdminAffiliate.svelte` - Added onDestroy hook to clear debounce & copy toast timers.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Added onDestroy hook to clear search & toast timers.
- `client/src/lib/pages/AdminUsers.svelte` - Added onDestroy hook to clear search & toast timers.
- `client/src/lib/pages/AdminPayments.svelte` - Added onDestroy hook to clear toast timers.
- `src/controllers/adminController.ts` - Added catch block temp file unlink in uploadProductImage & uploadCategoryIcon.
- `src/services/downloadService.ts` - Added non-positive & NaN byte check in formatSize.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v73.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 73.

### 3. Database Schema Backup
- **Command**: `npm run backupdb:scheme` (`node scripts/backup-schema.js`)
- **File**: `/Users/fiko942/Desktop/appcenter/backup/schema_backup.sql`
- **Timestamp**: `2026-08-28T07:59:27+07:00`
- **Size**: 23KB (Verified)

---

## Snapshot 74 - Optimalisasi Hash Map Aggregations O(1) & Eliminasi Nested Array Filtering (28 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  1. `apiGetAffiliate` di `adminController.ts` memuat seluruh data member dan transaksi lalu melakukan `transactions.filter(...)` dan `unpaidTransactionsAll.filter(...)` di dalam `members.map(...)`. Pada beban ribuan transaksi/member, algoritma $O(N \times M)$ ini menciptakan ribuan array sementara di heap V8 pada setiap request, memicu lonjakan CPU dan Garbage Collection (GC) thrashing.
  2. `apiGetLicenses` dan `apiGetOrderLicenses` di `memberController.ts` memanggil `allProducts.find(...)` dan `allUserDevices.find(...)` berulang kali di dalam loop mapping token lisensi ($O(T \times D + T \times P)$).
- **Solusi**:
  - Mengubah agregasi `apiGetAffiliate` menjadi single-pass hash indexing ($O(N + M)$) menggunakan `Map<affiliator_email, summary>` dan `Map<affiliator_email, unpaidList>`.
  - Mengindeks produk dan user devices di `memberController.ts` ke dalam `productByName`, `productByProductId`, `deviceByKey`, dan `deviceByOrderId` sebelum loop mapping, mengubah lookup menjadi $O(1)$ instan.

### 2. Files Modified
- `src/controllers/adminController.ts` - Single-pass Map indexing in apiGetAffiliate.
- `src/controllers/memberController.ts` - Indexed Map lookups in apiGetLicenses and apiGetOrderLicenses.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v74.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 74.

### 3. Database Schema Backup
- **Command**: `npm run backupdb:scheme` (`node scripts/backup-schema.js`)
- **File**: `/Users/fiko942/Desktop/appcenter/backup/schema_backup.sql`
- **Timestamp**: `2026-08-28T08:02:41+07:00`
- **Size**: 23KB (Verified)

---

## Snapshot 75 - Webhook Idempotency, Device Expiry Sync, License Email Parsing & Dynamic Session Store (28 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  1. `processOrderSuccess` di `adminController.ts` rentan terhadap race condition jika Xendit mengirim 2 webhook simultan (menghasilkan token lisensi ganda & komisi ganda).
  2. Saat admin mengubah durasi pesanan di `updateOrderDuration`, tabel `device` tidak ikut disinkronkan, sehingga perangkat PC member tetap kedaluwarsa sesuai masa aktif lama.
  3. `order_list.user` dengan format JSON membuat token lisensi tersimpan dengan user berupa string JSON mentah, sehingga lisensi tidak muncul di `/member/licenses`.
  4. `src/app.ts` meng-hardcode kredensial MySQL untuk `express-mysql-session` alih-alih membaca secara dinamis dari `DATABASE_URL`.
  5. `processDeleteProduct` dan `processDeleteCategory` tidak mengecek keberadaan data dan tidak menghapus file gambar fisik lokal di `/uploads/`.
- **Solusi**:
  - Menambahkan atomic conditional update `prisma.order_list.updateMany({ where: { id: orderId, status: { not: 'Order has been complete' } } })` pada `processOrderSuccess`.
  - Menambahkan sinkronisasi `device.expired` dan `device.duration` pada `updateOrderDuration`.
  - Menambahkan ekstraksi email murni `cleanUserEmail` sebelum token lisensi & transaksi afiliasi dibuat.
  - Mem-parse opsi `MySQLStore` secara dinamis dari `process.env.DATABASE_URL` dengan fallback aman.
  - Memvalidasi keberadaan record (`findUnique`) dan melakukan `unlinkSync` gambar produk/icon kategori sebelum delete.

### 2. Files Modified
- `src/app.ts` - Dynamic sessionStore MySQL URL parsing from DATABASE_URL.
- `src/controllers/adminController.ts` - Atomic webhook check, clean user email extraction, device duration sync, safe product/category deletion with local image unlinking.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v75.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 75.

### 3. Database Schema Backup
- **Command**: `npm run backupdb:scheme` (`node scripts/backup-schema.js`)
- **File**: `/Users/fiko942/Desktop/appcenter/backup/schema_backup.sql`
- **Timestamp**: `2026-08-28T08:07:38+07:00`
- **Size**: 23KB (Verified)

---

## Snapshot 76 - Frontend SPA Window Listener & Clipboard Timer Memory Leak Elimination (28 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  1. Di `AdminProducts.svelte`, `window.addEventListener('hashchange')` didaftarkan di dalam `onMount(async () => { return () => { removeEventListener } })`. Di Svelte 4, fungsi `onMount` yang `async` mengembalikan Promise sehingga callback return pembersihan diabaikan oleh framework, menyebabkan window listener gantung dan menahan seluruh instance komponen di heap memori.
  2. Di `AdminCategories.svelte`, `AdminProfile.svelte`, `AdminCreateTrial.svelte`, `Licenses.svelte`, dan `Orders.svelte`, pemanggilan `setTimeout` untuk feedback toast dan clipboard copy tidak menyimpan referensi timer dan tidak dibersihkan saat komponen unmount (`onDestroy`), menahan closure komponen pada background loop saat pengguna berpindah halaman SPA secara cepat.
- **Solusi**:
  - Memindahkan `handleHashChange` dan pembersihannya ke lifecycle hook `onDestroy` di `AdminProducts.svelte`.
  - Mengimplementasikan penyimpanan handle timer (`toastTimer`, `copyTokenTimer`, `copyHwidTimer`, `usernameTimer`, `pinTimer`) dan menambahkan blok `clearTimeout` di dalam hook `onDestroy` pada semua halaman Svelte SPA terkait.

### 2. Files Modified
- `client/src/lib/pages/AdminProducts.svelte` - Fixed async onMount listener cleanup in onDestroy.
- `client/src/lib/pages/AdminCategories.svelte` - Added toastTimer tracking & onDestroy cleanup.
- `client/src/lib/pages/AdminProfile.svelte` - Added usernameTimer & pinTimer tracking with onDestroy.
- `client/src/lib/pages/AdminCreateTrial.svelte` - Added copyTokenTimer & copyTemplateTimer tracking with onDestroy.
- `client/src/lib/pages/Licenses.svelte` - Added copyKeyTimer & copyHwidTimer tracking with onDestroy.
- `client/src/lib/pages/Orders.svelte` - Added copyTokenTimer & copyHwidTimer tracking with onDestroy.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v76.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 76.

### 3. Database Schema Backup
- **Command**: `npm run backupdb:scheme` (`node scripts/backup-schema.js`)
- **File**: `/Users/fiko942/Desktop/appcenter/backup/schema_backup.sql`
- **Timestamp**: `2026-08-28T08:12:56+07:00`
- **Size**: 23KB (Verified)

---

## Snapshot 77 - Toast, Shake & URL Copy Timers Lifecycle Optimization Across SPA (28 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  1. `AdminLogin.svelte` memiliki `setTimeout` untuk efek getar input PIN (`triggerShake`) tanpa referensi timer dan hook `onDestroy`.
  2. `AdminProducts.svelte` memiliki 4 pemanggilan `setTimeout` untuk feedback toast installer & CDN URL copy tanpa variabel tracking timer pembersihan.
- **Solusi**:
  - Menambahkan handle `shakeTimer` dan lifecycle hook `onDestroy` pada `AdminLogin.svelte`.
  - Menambahkan helper terpusat `showToast` dengan auto-clear pada `toastTimer` dan `copyFileUrlTimer` yang terhubung ke `onDestroy` pada `AdminProducts.svelte`.

### 2. Files Modified
- `client/src/lib/pages/AdminLogin.svelte` - Added shakeTimer and onDestroy hook.
- `client/src/lib/pages/AdminProducts.svelte` - Unified showToast helper with toastTimer and copyFileUrlTimer in onDestroy.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v77.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 77.

### 3. Database Schema Backup
- **Command**: `npm run backupdb:scheme` (`node scripts/backup-schema.js`)
- **File**: `/Users/fiko942/Desktop/appcenter/backup/schema_backup.sql`
- **Timestamp**: `2026-08-28T08:16:32+07:00`
- **Size**: 23KB (Verified)

---

## Snapshot 78 - Dynamic Categories Integration for Member Area (28 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  1. Kategori di halaman Member (`Dashboard.svelte`) masih berstatus hardcoded/statis dengan simulasi count acak, tidak sinkron dengan kategori yang dikelola oleh Admin di database MySQL (`categories` table).
  2. Klik pada kartu kategori di Member Dashboard tidak memfilter katalog produk di bawahnya.
  3. `ProductDetail.svelte` dan `Downloads.svelte` menggunakan nama kategori statis ('Software Bot Otomatis') alih-alih kategori asli dari produk tersebut.
- **Solusi**:
  - Memperbarui `memberController.ts` (`apiGetDashboard`, `apiGetProducts`, `apiGetDownloads`, `apiGetTutorials`) untuk mengambil daftar kategori aktif (`prisma.categories.findMany({ where: { is_active: true } })`), menghitung jumlah produk secara $O(1)$ Hash Map, serta memperkaya entitas produk dengan `category_id`, `category_name`, `category_icon`, dan `category_slug`.
  - Memperbarui `Dashboard.svelte` agar merender kategori dinamis dari payload API, menampilkan ikon gambar/SVG kategori, mendukung filtering interaktif produk per kategori, serta menampilkan badge kategori produk dinamis.
  - Memperbarui `ProductDetail.svelte` dan `Downloads.svelte` agar menampilkan badge nama kategori dinamis dari database.

### 2. Files Modified
- `src/controllers/memberController.ts` - Dynamic categories fetch, hash map count, and product category enrichment in apiGetDashboard, apiGetProducts, apiGetDownloads, apiGetTutorials.
- `client/src/lib/pages/Dashboard.svelte` - Dynamic category rendering, custom icon/image support, interactive product filtering, dynamic product category label.
- `client/src/lib/pages/ProductDetail.svelte` - Dynamic category_name display.
- `client/src/lib/pages/Downloads.svelte` - Category badge on product download cards.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v78.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 78.

### 3. Database Schema Backup
- **Command**: `npm run backupdb:scheme` (`node scripts/backup-schema.js`)
- **File**: `/Users/fiko942/Desktop/appcenter/backup/schema_backup.sql`
- **Timestamp**: `2026-08-28T08:37:59+07:00`
- **Size**: 23KB (Verified)

---

## Snapshot 79 - Database Backup System, Linux VPS Optimization, Admin Table Unification & Navigation Polish (28 Agustus 2026)

### 1. Masalah & Solusi
- **Pencadangan Database Otomatis & Log Audit**:
  - Mengimplementasikan `BackupService` (`src/services/backupService.ts`) untuk backup basis data MySQL secara asinkron di latar belakang dengan live polling progress (`progress`, `current_step`).
  - **Penghapusan Kompresi Gzip**: Menghapus kompresi Gzip Level 9 agar berkas diekspor sebagai **Raw SQL Murni (`.sql`)**, mencegah risiko korupsi arsip saat diekstrak.
  - **Dukungan Penuh & Auto-Prerequisites di VPS Linux**: Menambahkan deteksi otomatis package `mysqldump`/`mariadb-dump` di Linux dengan auto-installer (`apt-get`, `apk`, `yum`), serta *Zero-Dependency Pure TypeScript Streamer* sebagai failsafe native untuk container non-root.
  - **Audit Log Pengunduhan**: Melacak setiap aksi pengunduhan database (username admin, timestamp, alamat IP, User-Agent, dan rincian OS/Browser) yang disimpan dalam kolom JSON `download_history`.
  - **Verifikasi Integritas SHA-256**: Setiap berkas `.sql` diverifikasi dengan kalkulasi checksum hash SHA-256.
- **Unifikasi Desain Container Tabel Admin**:
  - Mengintegrasikan form pencarian dan pengurutan transaksi pada `AdminPayments.svelte` langsung ke dalam kartu container tabel utama (*Single Unified Card*).
  - Menstandarisasi penempatan dropdown *Rows Per Page* (`pageSize`) ke **footer tabel** berdampingan dengan pagination pada `AdminPayments.svelte`, `AdminCategories.svelte`, `AdminAffiliate.svelte`, dan `AdminAffiliateHistory.svelte`.
- **Restyling Header Brand Sidebar & Akses Cepat**:
  - Memperbarui header brand pada `AdminSidebar.svelte` dan `Sidebar.svelte` dengan logo glassmorphism, badge role neon (`ADMIN` / `MEMBER`), dan live pulsating dot status.
  - Menata ulang kartu "Akses Cepat" di sidebar admin dengan console background `#0b1324` dan tombol berinteraksi kontras tinggi.
  - Menambahkan tombol close mobile sidebar responsif dengan backdrop blur.
- **Perbaikan Rincian Transaksi Dashboard (404 Route Not Found)**:
  - Menyinkronkan endpoint API rincian transaksi antara backend (`/admin/api/payments/detail` & `/admin/api/payments/detail/:id`) dan frontend `AdminDashboard.svelte` (`/admin/api/payments/detail/${id}`).
- **Pembersihan Template WhatsApp Trial**:
  - Menghapus klausul lisensi lifetime yang tidak berlaku pada generator copy text WhatsApp di `AdminCreateTrial.svelte`.

### 2. Files Modified / Created
- `src/services/backupService.ts` - Raw SQL streaming backup engine, Linux auto-prerequisites, SHA-256 hash, and download audit logger.
- `src/controllers/adminController.ts` - Admin backup management APIs (`apiGetBackups`, `apiStartBackup`, `apiGetBackupStatus`, `downloadBackup`, `apiDeleteBackup`) and dual params/query detail order support.
- `src/routes/adminRoutes.ts` - Backup routes and detail payment query route.
- `client/src/lib/pages/AdminSettings.svelte` - Database backup management UI with live progress polling, download modal audit log, and raw SQL indicators.
- `client/src/lib/pages/AdminDashboard.svelte` - Synchronized payment detail modal API endpoint.
- `client/src/lib/pages/AdminPayments.svelte` - Unified search & table container and relocated rowsPerPage selector to table footer.
- `client/src/lib/pages/AdminCategories.svelte` - Relocated rowsPerPage selector to table footer.
- `client/src/lib/pages/AdminAffiliate.svelte` - Relocated rowsPerPage selector to table footer.
- `client/src/lib/pages/AdminAffiliateHistory.svelte` - Relocated rowsPerPage selector to table footer.
- `client/src/lib/components/AdminSidebar.svelte` - Modernized brand header and Akses Cepat console.
- `client/src/lib/components/Sidebar.svelte` - Harmonized member brand header and footer.
- `client/src/lib/components/Topbar.svelte` - Dynamic responsive mobile hamburger button styling.
- `client/src/lib/pages/AdminCreateTrial.svelte` - Cleaned up WhatsApp copy template.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v115.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 79.

### 3. Database Schema Backup
- **Command**: `npm run backupdb:scheme` (`node scripts/backup-schema.js`)
- **File**: `/Users/fiko942/Desktop/appcenter/backup/schema_backup.sql`
- **Timestamp**: `2026-08-28T15:51:33+07:00`
- **Size**: 25KB (Verified)

---

## Snapshot 80 - Penggantian Icon 3D Cube Member Dashboard dengan Official Favicon SVG (28 Agustus 2026)

### 1. Masalah & Solusi
- **Masalah**:
  - Pada 3D Welcome Hero di halaman Dashboard Member (`Dashboard.svelte` & `src/views/member-dashboard.ts`), elemen kubus 3D (`.cube`) merender teks statis `Z` alih-alih logo resmi website (`/favicon.svg`).
- **Solusi**:
  - Mengganti teks `<span>Z</span>` pada `.cube` menjadi elemen gambar logo resmi website `<img src="/favicon.svg" alt="Appcenter Logo" class="w-14 h-14 object-contain transform rotate-[8deg] drop-shadow-md" />` di `client/src/lib/pages/Dashboard.svelte` dan `src/views/member-dashboard.ts`.
  - Menambahkan aturan styling `.cube img, .cube svg` pada `public/css/appcenter-theme.css` dengan dimensi `58x58px`, `object-fit: contain`, rotasi `8deg`, dan efek drop-shadow elegan.

### 2. Files Modified
- `client/src/lib/pages/Dashboard.svelte` - Replaced text "Z" with official favicon SVG logo.
- `src/views/member-dashboard.ts` - Replaced text "Z" with official favicon SVG logo.
- `public/css/appcenter-theme.css` - Added `.cube img, .cube svg` styling rules.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v116.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 80.

---

## Snapshot 81 - Penghapusan Kolom Metode, Harmonisasi Icon Button, & Peningkatan Kontras Dark Mode di Pesanan Saya (28 Agustus 2026)

### 1. Masalah & Solusi
- **Penghapusan Kolom Metode**:
  - Menghapus kolom "Metode" pembayaran dari header `<thead class="...">` dan body baris `<tbody class="...">` pada `client/src/lib/pages/Orders.svelte`.
  - Memperbarui placeholder input pencarian menjadi `"Cari No Order, Nama Produk..."`.
- **Harmonisasi Icon Button Aksi**:
  - Menyelaraskan tombol aksi **Unduh Installer** dan **Detail Lisensi** dengan dimensi seragam (`w-8 h-8 rounded-xl`), border container yang matching (`border-slate-200 dark:border-slate-700`), transisi hover terpadu (`hover:bg-blue-600 hover:text-white`), serta warna icon aksen tajam (Biru untuk Unduh, Emerald untuk Lisensi).
- **Peningkatan Kontras Dark Mode**:
  - Memperbaiki kontras seluruh elemen di mode gelap (`dark:bg-[#101827]`, `dark:bg-[#131d31]`, `dark:border-[#22314d]`, `dark:text-white`, `dark:text-slate-300`, `dark:text-slate-400`).
  - Meningkatkan kontras warna teks dan kartu pada Modal Unduh Installer dan Modal Detail Lisensi agar tampak jelas dan tajam di mode gelap.

### 2. Files Modified
- `client/src/lib/pages/Orders.svelte` - Removed Metode column, harmonized action buttons, and boosted Dark Mode contrast.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v117.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 81.

---

## Snapshot 82 - Pemindahan Selector Row Per Page ke Footer Tabel Pesanan Saya (28 Agustus 2026)

### 1. Masalah & Solusi
- **Pemindahan Selector Row Per Page**:
  - Memindahkan komponen dropdown `CustomSelect` (`pageSizeOptions`) dari bar pencarian atas ke footer tabel di samping info rentang baris (`startRowIndex - endRowIndex`).
  - Bar atas kini bersih dan fokus pada input pencarian dan total pesanan.
  - Menyelaraskan tata letak pagination footer dengan pola standar aplikasi (`AdminPayments`, `AdminCategories`, `AdminUsers`).

### 2. Files Modified
- `client/src/lib/pages/Orders.svelte` - Relocated CustomSelect rows per page to table footer.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v118.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 82.

---

## Snapshot 83 - Tutorial & Download Visibility + Dark Mode Enhancement (28 Agustus 2026)

### 1. Tutorial & Download Buttons Visibility
- **Downloads Card Tutorial Button**:
  - Tombol tutorial dibuat lebih tebal (`py-2.5 px-3`, `font-bold`), proporsional dengan tombol download di atasnya.
  - Penambahan badge icon play solid dan efek hover dinamis.
  - Warna dan kontras diperkuat untuk Dark Mode (`dark:bg-purple-950/40 dark:border-purple-800/80 dark:text-purple-300 dark:hover:bg-purple-900/50`).
- **Downloads Card & Modal Contrast**:
  - Filter tabs, search bar, kartu software, badge OS, dan modal popup download diperjelas kontras gelapnya (`dark:bg-[#101827]`, `dark:bg-[#131d31]`, `dark:border-[#22314d]`).
- **Licenses & ProductDetail Consistency**:
  - Link tutorial di tabel lisensi dipertegas (`text-xs font-bold text-purple-600 dark:text-purple-400`).
  - Tombol aksi unduh installer di tabel lisensi diseragamkan dengan tombol aksi pesanan (`w-8 h-8 rounded-xl`, solid dark background).
  - Aside tutorial callout di `ProductDetail.svelte` ditingkatkan dengan styling solid button.
  - Katalog tutorial di `Tutorials.svelte` diselaraskan kontras tema gelapnya.

### 2. Files Modified
- `client/src/lib/pages/Downloads.svelte` - Enhanced tutorial button sizing, contrast, and dark mode tokens.
- `client/src/lib/pages/Licenses.svelte` - Harmonized action buttons, tutorial badges, and dark mode table styling.
- `client/src/lib/pages/ProductDetail.svelte` - Enhanced aside tutorial callout button.
- `client/src/lib/pages/Tutorials.svelte` - Dark mode contrast alignment.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v119.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 83.

---

## Snapshot 84 - Standard Help Icon Unification (28 Agustus 2026)

### 1. Help Icon Modernization
- **Topbar Help Button**:
  - Mengganti icon pelampung lama dengan icon standar **Help / Question Mark Circle** (`question-mark-circle`).
  - Menyelaraskan kontras di mode gelap (`dark:bg-[#131d31]`, `dark:border-[#22314d]`, `dark:text-slate-300`).
- **Tutorial Support Banner**:
  - Mengganti icon lama pada kartu "Masih butuh bantuan seputar software?" di `Tutorials.svelte` dengan icon Help Circle yang jelas.
  - Mempertebal tombol "Bantuan & Support" dengan icon help interaktif.
- **Server Views Consistency**:
  - Menyegarkan SVG help icon di seluruh file view server (`member-tutorials.ts`, `member-dashboard.ts`, `member-orders.ts`, `member-licenses.ts`, `member-downloads.ts`, `member-create-order.ts`).

### 2. Files Modified
- `client/src/lib/components/Topbar.svelte` - Help icon replaced with question-mark-circle.
- `client/src/lib/pages/Tutorials.svelte` - Support banner icon and action button updated.
- `src/views/*` - Synced help icons.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v120.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 84.

---

## Snapshot 85 - Synchronized Sidebar Active Indicator Animation (28 Agustus 2026)

### 1. Sliding Dot Indicator Animation
- **Gliding Indicator Attachment**:
  - Titik putih aktif (`.sidebar-active-dot`) kini disatukan ke dalam container sliding pill (`.sidebar-sliding-pill` & `.sidebar-sub-sliding-pill`).
  - Saat berpindah menu (misalnya dari Beranda ke Tutorial Video), titik putih meluncur mulus bersama kotak biru mengikuti kurva `cubic-bezier(0.16, 1, 0.3, 1)`.
  - Efek hover secara dinamis memudarkan titik dan mengembalikannya saat kursor keluar.
- **Licenses Table Cleanups**:
  - Memperbaiki binding sort header tabel pada `Licenses.svelte`.

### 2. Files Modified
- `client/src/lib/components/Sidebar.svelte` - Sliding dot integration for member area.
- `client/src/lib/components/AdminSidebar.svelte` - Sliding dot integration for admin & submenus.
- `client/src/lib/pages/Licenses.svelte` - Cleaned sort bindings.
- `public/css/appcenter-theme.css` - Defined `.sidebar-active-dot` with glow & smooth transitions.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v121.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 85.

---

## Snapshot 86 - Permanent Invariant: Mandatory Implementation Plan & Immediate Execution (28 Agustus 2026)

### 1. Developer Guidelines Invariant
- **Rule Enforcement**:
  - Ditetapkan ketentuan mutlak: Setiap prompt (penambahan fitur, bugfix, atau perubahan sekecil apa pun) WAJIB selalu membuat `implementation_plan.md` terlebih dahulu.
  - Setelah dokumen plan dibuat, eksekusi dilakukan secara langsung & otonom tanpa menunggu konfirmasi manual ("langsung dikerjain").
  - Verifikasi build (`npm run build`) dan snapshot documentation dilakukan di akhir setiap tugas.

### 2. Files Modified
- `GEMINI.md` - Updated section 4 with mandatory implementation planning & immediate execution invariant.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v122.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 86.

---

## Snapshot 87 - 3D Hero Centerpiece Showcase Redesign (28 Agustus 2026)

### 1. Hero Art Visual Elevation
- **Contrast & Depth Overhaul**:
  - Mengubah kotak `.cube` yang sebelumnya menggunakan gradien ungu-biru datar menjadi kartu 3D glassmorphism berkontras tinggi (`bg-gradient-to-br from-[#192646] to-[#0c1428]`, `border: 1.5px solid rgba(99, 102, 241, 0.45)`).
  - Menambahkan dark inner contrast platter (`.cube-inner-platter` dengan `bg-gradient from #0d1830 to #060c1a`) sehingga vector icon website (`/favicon.svg`) tampak tajam, jernih, dan tidak lagi tenggelam/samar.
  - Menambahkan ambient radial glow dan micro-levitation floating animation (`@keyframes heroFloat`).

### 2. Files Modified
- `client/src/lib/pages/Dashboard.svelte` - Centerpiece markup structure with inner platter.
- `src/views/member-dashboard.ts` - Synced server template markup.
- `public/css/appcenter-theme.css` - Upgraded .cube, .glow, and .cube-inner-platter styling + heroFloat keyframes.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v123.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 87.

---

## Snapshot 88 - License Table Row Numbering (28 Agustus 2026)

### 1. Row Numbering Column
- **Dynamic Sequence Number**:
  - Menambahkan kolom `No` pada tabel Lisensi Aplikasi (`Licenses.svelte` dan `src/views/member-licenses.ts`) yang dihitung dinamis `(pagination.page - 1) * pagination.pageSize + idx + 1`.
  - Menyesuaikan proporsi lebar kolom tabel agar seimbang (`No: 6%`, `Software: 28%`, `Serial Key: 24%`, `Status: 17%`, `HWID: 17%`, `Aksi: 8%`).

### 2. Files Modified
- `client/src/lib/pages/Licenses.svelte` - Added No column and dynamic sequence numbers.
- `src/views/member-licenses.ts` - Synced No column in server view.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v124.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 88.

---

## Snapshot 89 - Elite Context Preservation & Database Backup (SAVE v5) (28 Agustus 2026)

### 1. Protocol Execution
- **Database Backup Engine**:
  - Dijalankan `npm run backupdb:scheme` untuk menghasilkan file dump skema database MySQL terkini di `backup/schema_backup.sql` (~25 KB).
  - Snapshot arsitektural di-bump ke SnapshotVersion 125 dengan model penggabungan aditif (`MergeType: "additive"`).
- **State Invariants Maintained**:
  - Invariant koneksi database pool maksimal 5 tetap terjaga.
  - Invariant git branch `reborn` dan perlindungan single source of truth dipatuhi 100%.

### 2. Files Modified
---

## Snapshot 90 - Dukungan Produk Gratis (Rp 0), Auto-Completion Order, & Tools Gratis Member Dashboard (28 Agustus 2026)

### 1. Masalah & Solusi
- **Dukungan Harga Rp 0 & Auto-Completion Lisensi**:
  - Produk dapat berharga `0` (Rp 0 / Gratis) dan tetap aktif (`is_active: true`).
  - Ketika member memesan produk Rp 0, sistem melewati gateway pembayaran Xendit, langsung membuat pesanan dengan status `'Order has been complete'`, `paid_at: now`, `payment: 'PAID'`, dan secara instan men-generate token lisensi ke tabel `token_device_activation`.
  - Member langsung diarahkan ke halaman Lisensi (`/#/member/licenses`) dengan lisensi siap digunakan.
  - Produk gratis yang nonaktif (`is_active: false`) dicegah dari pemesanan.
- **Notice & Warning Informatif di Modal Admin**:
  - Modal Tambah & Edit Produk di `AdminProducts.svelte` menampilkan kotak pemberitahuan informatif berwarna hijau ketika harga diatur ke `0`: Member dapat langsung mengklaim & mengaktifkan produk secara instan tanpa gateway Xendit.
  - Tabel Katalog Produk Admin merender badge `GRATIS (Rp 0)` beraksen emerald.
- **Section Tools Gratis Dinamis di Dashboard Member**:
  - Section `#free` ("Tools gratis untukmu") di `Dashboard.svelte` kini secara reaktif memfilter produk berharga Rp 0 dari database dan menampilkan kartu produk dinamis dengan tombol `"Klaim Gratis"`.
  - Halaman `ProductDetail.svelte` menampilkan badge `FREE`, estimasi `GRATIS (Rp 0)`, dan tombol CTA `"Klaim Lisensi Gratis"`.

### 2. Files Modified
- `src/controllers/memberController.ts` - Free order instant completion logic in `processCreateOrder` and `payOrder`.
- `client/src/lib/pages/AdminProducts.svelte` - Price 0 support, modal notice banner, and GRATIS badge in products table.
- `src/views/admin-products.ts` - GRATIS badge in SSR admin products table.
- `client/src/lib/pages/ProductDetail.svelte` - Free claim button, badge, and instant hash redirect.
- `client/src/lib/pages/Dashboard.svelte` - Reactive dynamic Free Tools section and Klaim Gratis CTA.
- `client/src/lib/pages/Orders.svelte` - Formatted Rp 0 as `GRATIS (Rp 0)`.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v126.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 90.

---

## Snapshot 91 - Comprehensive Multi-Role QA Audit & UI/UX Hardening (28 Agustus 2026)

### 1. Masalah & Solusi
- **Sanitasi Gambar Produk Warisan (Legacy Image Sanitization)**:
  - Ditemukan referensi file gambar warisan database lama (seperti `255067.png`) yang memicu request 404 pada browser.
  - Ditambahkan helper `sanitizeProductImage` di `memberController.ts` & `adminController.ts` serta `isValidImg` di semua halaman Svelte (`AdminProducts.svelte`, `Licenses.svelte`, `Orders.svelte`, `AdminPayments.svelte`, `AdminDashboard.svelte`, `AdminCreateTrial.svelte`).
  - Request 404 pada seluruh gambar produk warisan turun menjadi 0 (clean fallback icon).
- **Smart Checkout Form Produk Gratis**:
  - Pada `ProductDetail.svelte`, form kupon/voucher disembunyikan otomatis jika produk gratis (`basePrice === 0`), digantikan info banner hijau ramah pengguna.
- **Tombol Reset / Clear Search Cepat**:
  - Diterapkan tombol clear pencarian (`&times;`) pada baris filter di `Orders.svelte`, `Licenses.svelte`, `AdminProducts.svelte`.
- **Keyboard Navigation & Modal Dismissal (ESC)**:
  - Diterapkan listener global `Escape` pada jendela modal di `AdminPayments.svelte`, `AdminUsers.svelte`, `AdminDashboard.svelte`, `Orders.svelte`.
- **Badge Khusus Transaksi Free Claim di Admin**:
  - Transaksi Rp 0 di `AdminPayments.svelte` dan `AdminDashboard.svelte` kini diberi badge `FREE CLAIM (Rp 0)` beraksen emerald.

### 2. Files Modified
- `src/controllers/memberController.ts` - Image sanitization helper on orders & licenses.
- `src/controllers/adminController.ts` - Image sanitization helper on products & trials.
- `client/src/lib/pages/ProductDetail.svelte` - Conditional voucher input on free items.
- `client/src/lib/pages/Orders.svelte` - Clear search, keyboard Escape listener, and image fallback check.
- `client/src/lib/pages/Licenses.svelte` - Clear search and image fallback check.
- `client/src/lib/pages/AdminPayments.svelte` - Free claim badge, keyboard Escape listener, and image check.
- `client/src/lib/pages/AdminDashboard.svelte` - Free claim badge, keyboard Escape listener, and image check.
- `client/src/lib/pages/AdminUsers.svelte` - Keyboard Escape listener on all user management modals.
- `client/src/lib/pages/AdminCreateTrial.svelte` - Image sanitization check.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 91.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v127.

---

## Snapshot 92 - Migrasi Penuh Package Manager ke PNPM & Pembersihan Node Modules (28 Agustus 2026)

### 1. Masalah & Solusi
- **Pengurangan Penggunaan Penyimpanan & Efisiensi Dependensi**:
  - Seluruh `node_modules/` dan `client/node_modules/` sebelumnya dibersihkan beserta `package-lock.json`, `client/package-lock.json`, dan `yarn.lock`.
  - Sistem beralih 100% ke **PNPM (v11.23.0)** dengan mekanisme centralized content-addressable store dan virtual hardlinks yang secara drastis menghemat kapasitas disk space.
- **Konfigurasi Workspace & Build Scripts**:
  - `pnpm-workspace.yaml` dikonfigurasi dengan menyertakan workspace package `client` dan izin build scripts (`esbuild`, `@prisma/client`, `@prisma/engines`, `prisma`, `ssh2`, `cpu-features`).
  - Skrip `build:client` dan `build` di root `package.json` diperbarui menggunakan `pnpm`.
- **Enforcement Invariant Permanen**:
  - Ditambahkan aturan permanen di `GEMINI.md`: "Package Manager Invariant: STRICTLY `pnpm`. Never use `npm` or `yarn`."
  - Kompilasi `pnpm run build` dan `pnpm prisma:generate` terverifikasi 100% passing.

### 2. Files Modified
- `pnpm-workspace.yaml` - Added client package and esbuild build allowance.
- `package.json` - Updated build scripts to invoke pnpm.
- `GEMINI.md` - Added PNPM package manager invariant rule.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v128 and updated run commands.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 92.

---

## Snapshot 93 - Pembersihan Profile User Data Chrome & Auto-Cleanup Pengujian (28 Agustus 2026)

### 1. Masalah & Solusi
- **Pembersihan User Data Profile Chrome Pengujian**:
  - Direktori profil Chrome temporary Puppeteer (`/var/folders/*/*/T/puppeteer_dev_chrome_profile-*` dan `$TMPDIR/puppeteer*`) telah dihapus secara tuntas untuk membebaskan ruang penyimpanan lokal.
- **Mekanisme Auto-Cleanup pada QA Suite**:
  - Skrip pengujian otomatis `scratch/qa-runner.js` diperbarui dengan folder `userDataDir` eksplisit di temporary storage dan blok `finally` yang secara otomatis menghapus direktori profil segera setelah browser ditutup (`fs.rmSync(..., { recursive: true, force: true })`).

### 2. Files Modified
- `scratch/qa-runner.js` - Added explicit temp userDataDir and automated post-test removal.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v129.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 93.

---

## Snapshot 94 - Verifikasi Menyeluruh Fitur, API Endpoints, & Kestabilan Sistem (28 Agustus 2026)

### 1. Masalah & Solusi
- **Verifikasi Kompilasi & Database**:
  - `pnpm prisma:generate` sukses meregenerasi type binding Prisma Client (6.19.3).
  - `pnpm run backupdb:scheme` menghasilkan dump skema database MySQL utuh di `backup/schema_backup.sql` (~25 KB).
  - `pnpm run build` sukses mengompilasi Svelte 4 SPA dan TypeScript backend dengan exit code 0.
- **Verifikasi API & Endpoint Keamanan**:
  - `/health` -> 200 OK dengan status data uptime server.
  - `/api/v1/device/status` -> 200 dengan validasi error schema query parameter yang tepat.
  - Seluruh endpoint member dan admin SPA terproteksi sesi dan merespons data bersih.
- **Verifikasi Headless QA End-to-End**:
  - 61 skenario UI (Desktop Light/Dark + Mobile Light/Dark) diuji otomatis via `scratch/qa-runner.js`.
  - Hasil audit: **0 Console Error**, **0 Network 404**, **0 Fatal Crash**, dan **Auto-cleanup temporary profile** berhasil 100%.

### 2. Files Modified
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v130.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 94.
- `walkthrough.md` - Full verification report.

---

## Snapshot 95 - SAVE v5 Elite Context Preservation & Superpowers Memory Sync (28 Agustus 2026)

### 1. Masalah & Solusi
- **Preservasi Memori Lengkap & Sinkronisasi Superpowers**:
  - Seluruh pencapaian siklus pengembangan terdokumentasi secara aditif ke dalam single source of truth tanpa menghapus konteks historis.
  - Selesai implementasi fitur Produk Gratis Rp 0, Audit QA Multi-Role menyeluruh (61 screenshot, 0 error), Sanitasi path gambar warisan, Fitur smart checkout & tombol clear search, Migrasi penuh dari NPM ke PNPM (v11.23.0), dan Pembersihan profile user data Chrome temporary.
- **Invariants Terkunci & Terverifikasi**:
  - Git Branch: strictly `reborn`.
  - Package Manager: strictly `pnpm`.
  - Database Connection Pool: strictly capped at `5` (`.env` dan `src/app.ts`).
  - Database Schema Dump: `backup/schema_backup.sql` (~25 KB) berhasil diperbarui dan terverifikasi.
  - Build Status: `pnpm run build` 100% lulus (Exit code 0).

### 2. Files Modified / Verified
- `GEMINI.md` - Updated permanent invariants.
- `pnpm-workspace.yaml` - Configured workspace and build script permissions.
- `package.json` - Updated build scripts to use pnpm.
- `src/controllers/memberController.ts` - Free order processing & image sanitization.
- `src/controllers/adminController.ts` - Admin products image sanitization & free claim handling.
- `client/src/lib/pages/ProductDetail.svelte` - Smart voucher hiding for free products.
- `client/src/lib/pages/Orders.svelte` - Clear search button, modal Escape keydown listener.
- `client/src/lib/pages/Licenses.svelte` - Clear search button & image fallback.
- `client/src/lib/pages/AdminPayments.svelte` - Free claim badge, modal Escape keydown listener.
- `client/src/lib/pages/AdminDashboard.svelte` - Free claim badge, modal Escape keydown listener.
- `client/src/lib/pages/AdminProducts.svelte` - Price 0 support, free modal banner, image fallback.
- `client/src/lib/pages/AdminUsers.svelte` - Modal Escape keydown listeners.
- `scratch/qa-runner.js` - Auto-cleanup for Chrome profile storage.
- `backup/schema_backup.sql` - Updated database schema dump.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v131.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 95.

---

## Snapshot 96 - Comprehensive Real Simulation E2E Test Suite & Production Database Cleanup (28 Agustus 2026)

### 1. Masalah & Solusi
- **Rangkaian Uji Simulasi Pengguna Nyata (15 Skenario)**:
  - Dibangun `scripts/e2e-simulation-test.ts` yang menguji seluruh alur otentikasi Member & Admin, alur registrasi user, pembuatan pesanan/klaim lisensi, token device activation, hardware binding HWID, migrasi device, katalog tutorial & unduhan, metrik analitik dashboard admin, generator trial, pencarian pembayaran/user, hingga log backup database.
- **Embedded Server Auto-Booting**:
  - Script secara otomatis mendeteksi server lokal port 4829, atau melakukan bootstrap embedded instance express secara mandiri jika server sedang offline.
- **Pembersihan Database Produksi Terisolasi (100% Safe Cleanup)**:
  - Blok `finally` mengeksekusi penghapusan data uji secara ketat berdasarkan ID yang terlacak (`createdUserId`, `createdOrderId`, `createdTokenId`, `createdDeviceId`, `createdTrialId`), sehingga seluruh data uji dibersihkan tuntas tanpa menyentuh data produksi lainnya.
- **Integrasi CLI Package Manager**:
  - Ditambahkan perintah `pnpm run test:simulation` dan `pnpm run test:e2e` pada `package.json`.

### 2. Files Modified
- `scripts/e2e-simulation-test.ts` - New comprehensive E2E test suite.
- `package.json` - Added `test:simulation` and `test:e2e` scripts.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v132.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 96.

---

## Snapshot 97 - SAVE v5 Context Preservation & Test Suite Maintenance Protocol (28 Agustus 2026)

### 1. Masalah & Solusi
- **Preservasi Memori Lengkap & Test Maintenance Protocol**:
  - Seluruh alur kerja validasi sistem simulasi nyata (`pnpm run test:simulation`) telah terintegrasi dan terdokumentasi.
  - Ditetapkan protokol perawatan: setiap penambahan atau perubahan fitur di masa mendatang WAJIB memperbarui `scripts/e2e-simulation-test.ts` agar senantiasa mencerminkan state produksi terkini.
- **Invariants Terkunci**:
  - Git Branch: strictly `reborn`.
  - Package Manager: strictly `pnpm` (v11.23.0).
  - Database Connection Pool: strictly capped at `5` (`.env` dan `src/app.ts`).
  - Database Schema Dump: `backup/schema_backup.sql` (~25 KB) berhasil diperbarui dan terverifikasi pada 28 Agustus 2026 17:28:00 WIB.
  - Status Test: 15/15 E2E Simulation Test passed (100% clean) dengan database purge terverifikasi.

### 2. Files Modified
- `backup/schema_backup.sql` - Updated database schema dump.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v133.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 97.

---

## Snapshot 98 - Robust E2E Simulation Test Suite & Strict Execution Policy (28 Agustus 2026)

### 1. Masalah & Solusi
- **Rangkaian Uji Komprehensif (Positif & Negatif / Error Detection)**:
  - `scripts/e2e-simulation-test.ts` ditingkatkan untuk menguji skenario positif dan skenario negatif:
    1. Penolakan registrasi duplikat (400).
    2. Penolakan login password salah (401).
    3. Proteksi akses endpoint terproteksi tanpa sesi (401 Unauthorized).
    4. Penolakan durasi pesanan tidak valid (400).
    5. Validasi parameter Device API kosong (400).
    6. Penolakan aktivasi token palsu/tidak valid.
    7. Penolakan Admin PIN salah (401).
    8. Seluruh alur sukses (registrasi, order, aktivasi HWID, migrasi, tutorial, admin analytics, trial generator, user search, log backup).
- **Aturan Permanen Eksekusi Test (`GEMINI.md`)**:
  - Test suite `pnpm run test:simulation` HANYA dieksekusi pada 2 kondisi:
    1. Perubahan **Fitur Besar** (major architectural / core feature updates).
    2. Sesaat sebelum **Preservasi Memori / SAVE v5 Protocol**.
  - Dilarang menjalankan test suite pada perubahan kecil/minor tweaks untuk efisiensi token & runtime.
- **Pembersihan Database Produksi**:
  - 100% data uji dihapus seketika di blok `finally` (terverifikasi aman).

### 2. Files Modified
- `scripts/e2e-simulation-test.ts` - Added negative & positive validation assertions with connection pacing.
- `GEMINI.md` - Added Section 5 Test Suite Execution Invariant.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v134.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 98.

---

## Snapshot 99 - Zero Storage Footprint & Automated Temporary Artifact Purge (28 Agustus 2026)

### 1. Masalah & Solusi
- **Pembersihan Total Penyimpanan Sementara (Zero Local Space Retained)**:
  - Ditetapkan protokol permanen bahwa setiap pengujian selesai dijalankan (baik sukses maupun gagal), seluruh berkas sementara, profil browser Chrome (`userDataDir`, `$TMPDIR/puppeteer_*`, `$TMPDIR/chrome-test-profile-*`, `$TMPDIR/temp_chrome_*`), temporary cache, dan screenshots tidak boleh menyisakan ruang penyimpanan lokal sama sekali.
  - Ditambahkan fungsi otomatis `purgeTemporaryStorage()` pada [scripts/e2e-simulation-test.ts](file:///Users/fiko942/Desktop/appcenter/scripts/e2e-simulation-test.ts) di dalam blok `finally` untuk membersihkan folder temp OS secara otomatis.
- **Invariants Terkunci**:
  - `GEMINI.md` diperbarui dengan Section 6: *Zero Storage Footprint & Temp Artifact Purge*.
  - Git Branch: strictly `reborn`.
  - Package Manager: strictly `pnpm`.
  - Status Test: 15/15 E2E Simulation Test passed (100% clean).

### 2. Files Modified
- `scripts/e2e-simulation-test.ts` - Added `purgeTemporaryStorage()` routine.
- `GEMINI.md` - Added Section 6 Zero Storage Footprint Invariant.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v135.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 99.

---

## Snapshot 100 (MILESTONE) - SAVE v5 Elite Context Preservation & Production Maturity (28 Agustus 2026)

### 1. Masalah & Solusi
- **Milestone 100: Kestabilan Sistem & Preservasi Memori Komprehensif**:
  - Seluruh rangkaian pengembangan fitur, pengujian QA, migrasi arsitektur, dan keamanan sistem telah terintegrasi penuh dan terverifikasi 100%:
    1. **Fitur Produk Gratis Rp 0**: Mendukung klaim instan Rp 0, bypassing gateway pembayaran, auto-complete order, auto-generate token lisensi, dan warning visual di Admin/Member.
    2. **Audit QA UI/UX Multi-Role**: Verifikasi 2 role (Member & Admin), 2 tema (Dark & Light), dan 2 viewport (Desktop & Mobile) dengan 0 error console & 0 404 network.
    3. **Migrasi Paket PNPM**: Migrasi tuntas ke PNPM (v11.23.0) dengan `pnpm-workspace.yaml` untuk efisiensi penyimpanan & dependensi terisolasi.
    4. **Suite Uji Simulasi Nyata (E2E)**: Rangkaian 15 skenario uji positif & negatif di `scripts/e2e-simulation-test.ts` (`pnpm run test:simulation`) dengan auto-boot embedded server.
    5. **Aturan Eksekusi Test (Section 5 GEMINI.md)**: Tes hanya dijalankan saat ada Fitur Besar dan sesaat sebelum SAVE v5 Protocol.
    6. **Zero Storage Footprint (Section 6 GEMINI.md)**: Pembersihan total otomatis seluruh profil Chrome (`userDataDir`), cache, dan artefak temporary di blok `finally`.
    7. **Backup Database Terkunci**: `backup/schema_backup.sql` (~25 KB) berhasil diperbarui dan tersinkronisasi.
- **Invariants Permanen**:
  - Target Branch: STRICTLY `reborn`.
  - Package Manager: STRICTLY `pnpm`.
  - Database Connection Pool: Max 5 connection limit.
  - Admin Default PIN: `085213`.
  - User Email: Permanen & terkunci pasca pendaftaran.

### 2. Files Modified
- `backup/schema_backup.sql` - Updated database schema dump.
- `docs/CONTEXT_SNAPSHOT.yaml` - Milestone Snapshot v136.
- `ZIQVA_STORE_ANALYSIS.md` - Milestone Snapshot 100.

---

## Snapshot 101 - Comprehensive Technical & Non-Technical Deep Analysis and Superpowers Refresh (28 Agustus 2026)

### 1. Masalah & Solusi
- **Analisis Menyeluruh Seluruh Aspek Sistem**:
  - Dilakukan audit kode backend (`src/`), frontend Svelte 4 SPA (`client/src/`), database schema (`prisma/schema.prisma`), dan konfigurasi monorepo PNPM.
  - **Analisis Teknis**:
    1. Arsitektur Single-Port Express 5 pada port 4829 yang menyatukan static SPA bundle, REST JSON API, SFTP chunked upload, dan legacy device activation.
    2. Connection pool capping limit 5 pada MySQL untuk perlindungan stabilitas VPS.
    3. Proteksi keamanan bertingkat: Rate limiter admin (eskalasi 3m->5m->10m->15m), PIN 6-digit default `085213`, HWID locking single-device, dan idempotency webhook Xendit.
    4. Motion & interaction tokens: Framer-Motion style sliding pills, active sliding dots, CSS variables dual-theme, dan server-side pagination di semua tabel.
  - **Analisis Non-Teknis**:
    1. Model bisnis software desktop, monetisasi bertingkat (Free freemium Rp 0, lisensi berdurasi, hingga lifetime).
    2. Ekosistem kemitraan afiliasi: Kupon diskon pembeli, komisi per transaksi, dan transfer pencairan komisi bank/e-wallet transparan.
    3. Funnel konversi trial: Generator token uji coba dengan template chat WhatsApp ramah & formal untuk meningkatkan closing penjualan.
- **Pembaruan Dokumen Superpowers & Master Documentation**:
  - Diterbitkan spesifikasi desain analitik mendalam di `docs/superpowers/specs/2026-08-28-comprehensive-system-deep-analysis.md`.
  - Diterbitkan rencana peta jalan evolusi sistem di `docs/superpowers/plans/2026-08-28-comprehensive-system-evolution-plan.md`.
  - Diterbitkan dokumentasi master lengkap di `docs/MASTER_SYSTEM_DOCUMENTATION.md`.

### 2. Files Created & Modified
- `docs/superpowers/specs/2026-08-28-comprehensive-system-deep-analysis.md` - Comprehensive system design spec.
- `docs/superpowers/plans/2026-08-28-comprehensive-system-evolution-plan.md` - System roadmap evolution plan.
- `docs/MASTER_SYSTEM_DOCUMENTATION.md` - Master documentation portal index.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v137.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 101.

---

## Snapshot 102 - Dedicated Granular Technical & Non-Technical Documentation & Permanent Memory Synchronization (28 Agustus 2026)

### 1. Masalah & Solusi
- **Pemisahan Dokumen & Kedalaman Granular per Seluruh Fitur**:
  - Diterbitkan 2 dokumen master granular berkedalaman tinggi yang membedah 22 subsistem fitur satu per satu:
    1. **Dokumentasi Teknis Granular (`docs/TECHNICAL_DOCUMENTATION.md`)**: Memuat rincian arsitektur kode, file controller, methods, model Prisma, kontrak data API, skenario edge case, rate-limiter IP, HWID lock single-device, multi-chunk SFTP 5MB uploader, dan raw SQL database streaming backup.
    2. **Dokumentasi Non-Teknis & Bisnis (`docs/NON_TECHNICAL_DOCUMENTATION.md`)**: Memuat model bisnis SaaS desktop, customer journey funnel TOFU-MOFU-BOFU, value proposition persona, strategi harga freemium Rp 0, formula komisi afiliasi, psikologi template WhatsApp trial closing, dan 4 SOP operasional admin.
- **Inkorporasi Protokol Preservasi Memori Wajib**:
  - Ditetapkan bahwa setiap permintaan preservasi memori WAJIB memperbarui dokumentasi teknis & non-teknis secara mendalam, memperbarui `docs/CONTEXT_SNAPSHOT.yaml` dan `ZIQVA_STORE_ANALYSIS.md`, serta memverifikasi skema dump database.

### 2. Files Created & Modified
- `docs/TECHNICAL_DOCUMENTATION.md` - Exhaustive 22-module technical deep-dive.
- `docs/NON_TECHNICAL_DOCUMENTATION.md` - Comprehensive business model, funnels, & SOPs.
- `docs/MASTER_SYSTEM_DOCUMENTATION.md` - Unified master encyclopedia index.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v138.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 102.

---

## Snapshot 103 - Full System Encyclopedia Documentation & Comprehensive Testing Suite (28 Agustus 2026)

### 1. Masalah & Solusi
- **Penyusunan Ensiklopedia Lengkap Sistem (100% Seluruh Aspek)**:
  - Diterbitkan dokumentasi terstruktur ke dalam 3 berkas terpisah berkedalaman maksimal:
    1. **`docs/TECHNICAL_DOCUMENTATION.md`**:
       - Bab 1: Tech Stack lengkap (Express 5, Svelte 4, Vite 6, Prisma 6, MySQL 8, PNPM workspace).
       - Bab 2: Panduan instalasi, setup `.env`, database generation, build, dan deployment VPS (PM2 & Nginx reverse proxy).
       - Bab 3: Bedah teknis granular per 22 subsistem fitur (Controller, Methods, ORM queries, Payload JSON, Error codes).
       - Bab 4: **Testing Suite Komprehensif** (15 skenario uji positif & negatif di `scripts/e2e-simulation-test.ts`, auto-boot embedded server, 100% isolasi pembersihan database produksi di blok `finally`, dan zero storage footprint purge).
       - Bab 5: Rekomendasi arsitektural (Password hashing modernization, In-memory Redis caching, Advanced Analytics).
    2. **`docs/NON_TECHNICAL_DOCUMENTATION.md`**:
       - Analisis model bisnis D2C SaaS, customer journey funnel TOFU-MOFU-BOFU, value proposition persona, strategi freemium Rp 0, komisi afiliasi, formula closing WhatsApp trial, dan 4 SOP operasional admin.
    3. **`docs/UI_COMPONENTS_AND_DESIGN_SYSTEM.md`**:
       - Spesifikasi komponen Svelte satu per satu (`CustomSelect`, `CustomCheckbox`, `CustomDropdown`, `SegmentedTabs`, `ThemeToggle`, `Tooltip`, `Sidebar`, `AdminSidebar`, `Topbar`, `Layout`), props, events, kurva easing, dan keyframes (`heroFloat`, `dropInSpring`, `scaleInCheck`, `pulseDot`).
    4. **`docs/MASTER_SYSTEM_DOCUMENTATION.md`**:
       - Portal indeks induk yang menyatukan seluruh dokumentasi sistem.

### 2. Files Created & Modified
- `docs/TECHNICAL_DOCUMENTATION.md` - Tech stack, installation runbook, 22 features, and 15-scenario testing suite.
- `docs/NON_TECHNICAL_DOCUMENTATION.md` - Business strategy, funnels, and SOPs.
- `docs/UI_COMPONENTS_AND_DESIGN_SYSTEM.md` - Complete Svelte UI component suite and design tokens.
- `docs/MASTER_SYSTEM_DOCUMENTATION.md` - Master portal index.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v139.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 103.

---

## Snapshot 104 - Complete SAVE v5 Memory Preservation Protocol & Invariants Lock (28 Agustus 2026)

### 1. Masalah & Solusi
- **Preservasi Memori & Verifikasi Sistem Total**:
  - Dieksekusi protokol SAVE v5 penuh sesuai dengan panduan superpowers `elite-context-preservation`:
    1. **Testing Suite Simulasi E2E Terverifikasi 100%**: Berkas `scripts/e2e-simulation-test.ts` dijalankan via `pnpm run test:simulation`. Seluruh 15 skenario pengujian positif & negatif lulus dengan sempurna (Exit code 0).
    2. **Isolasi Database Produksi**: Seluruh entitas data uji dibersihkan tuntas di blok `finally`, database produksi aman dan tidak tersentuh.
    3. **Zero Storage Footprint Purge**: Direktori sementara Chrome (`$TMPDIR/puppeteer_*`), screenshot, dan dump storage dibersihkan total.
    4. **Pencadangan Skema Basis Data**: Berkas `backup/schema_backup.sql` diperbarui dan diverifikasi utuh.
    5. **Pembaruan Dokumen & Memori Permanen**: Ensiklopedia sistem super lengkap (`TECHNICAL_DOCUMENTATION.md`, `NON_TECHNICAL_DOCUMENTATION.md`, `UI_COMPONENTS_AND_DESIGN_SYSTEM.md`, `MASTER_SYSTEM_DOCUMENTATION.md`), `GEMINI.md`, `CONTEXT_SNAPSHOT.yaml` (v140), dan `ZIQVA_STORE_ANALYSIS.md` disinkronkan secara aditif.

### 2. Files Created & Modified
- `backup/schema_backup.sql` - Fresh schema dump.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v140.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 104.

---

## Snapshot 105 - Production Ready Zip Release, Automated prepare.sh VPS Deployer & Cleaned Audit Data (29 Agustus 2026)

### 1. Masalah & Solusi
- **Otomatisasi Release & Rilis Produksi Instant (`release.zip` & `prepare.sh`)**:
  - Menambahkan perintah `pnpm run zip` pada `package.json` yang secara otomatis mengompilasi Svelte client SPA, Express backend TypeScript, aset statis `public/`, skema Prisma ORM `prisma/`, dan script otomatisasi `prepare.sh` ke dalam berkas arsip `release.zip` (~18 MB).
  - Membuat script **`prepare.sh`** yang executable (`chmod +x`) untuk deployment 1-klik di VPS Linux Ubuntu:
    1. Purge `node_modules` lama untuk menghemat ruang penyimpanan server.
    2. Deteksi & otomatis install `pnpm` jika belum terpasang.
    3. Install dependensi produksi via `pnpm install --prod`.
    4. Eksekusi `npx prisma generate` untuk OS Linux.
    5. Kelola proses PM2 dengan nama **`appcenter-ziqva`** (`start` / `restart` / `pm2 save`).

- **Pembersihan Data Audit & Redesain UX Download Hub**:
  - Menghapus 13 kategori dummy (`Audit Category`) dan 30 produk dummy (`Audit Software Bot A/B`) dari database MySQL secara tuntas.
  - Memperbaiki format tampilan pengguna aktif dari mentah `8600+` menjadi ringkas **`8.6k+ Pengguna Aktif`** menggunakan helper `formatActiveUsers` di `ProductDetail.svelte` & `CustomDropdown.svelte`.
  - Mengubah default item per halaman Download Hub (`Downloads.svelte` & `memberController.ts`) menjadi **24 item per halaman**.
  - Mengintegrasikan tab counters real-time berbasis pencarian, tombol hapus pencarian 1-klik `(X)`, *Skeleton Pulse Grid*, dan *Quick Reset Action*.

### 2. Database Backup Verification
- **Script**: `pnpm run backupdb:scheme`
- **Output File**: `backup/schema_backup.sql`
- **Timestamp**: `2026-08-29T14:28:14+07:00`
- **Status**: Verified Schema Dump (MySQL 8.x, `ziqva_labs`).

### 3. Files Created & Modified in this Snapshot
- `prepare.sh` - Automated deployment script for Ubuntu VPS with PM2 `appcenter-ziqva`.
- `package.json` - Added `build` with `prepare.sh` packaging & `zip` command.
- `client/src/lib/components/CustomDropdown.svelte` - Applied `formatActiveUsers` (`8.6k+`).
- `client/src/lib/pages/ProductDetail.svelte` - Applied `formatActiveUsers` (`8.6k+`).
- `client/src/lib/pages/Downloads.svelte` - Backend search tab counters, clear search `(X)`, skeleton pulse grid, & default 24 items limit.
- `src/controllers/memberController.ts` - Backend search-filtered tab counters & default limit 24.
- `backup/schema_backup.sql` - Updated MySQL schema dump.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v164.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 105.

---

## Snapshot 106 — 2026-08-29 (Production Svelte SPA Routing Fix & Full E2E Verification)

### 1. Major Architectural & UI Enhancements
- **Fix Production Svelte SPA Routing Mismatch**:
  - Replaced legacy SSR HTML view renders in Express (`src/routes/memberRoutes.ts`, `src/routes/adminRoutes.ts`, `src/app.ts`) with direct Svelte SPA `index.html` serving for all `/member/*` and `/admin/*` GET routes.
  - Configured client-side path-to-hash converter script in `client/index.html` to automatically convert non-hash request URLs (e.g., `https://appcenter.ziqva.com/member/orders?page=1...`) into Svelte SPA hash routes (`/#/member/orders?page=1...`) without triggering server-side 302 redirect loops.
  - Added `client_dist` static middleware in `src/app.ts` to ensure all JavaScript and CSS assets return 200 OK.
  - Restored `router.post('/orders/create', ...)` endpoint for backend order creation handling.

- **Full E2E Simulation Test & Live QA**:
  - Verified 15/15 test scenarios via `pnpm run test:simulation` with strict isolated database cleanup.
  - Verified live production rendering via Puppeteer QA screenshots (`live_svelte_spa_orders_authenticated.png`).

### 2. Database Backup Verification
- **Script**: `pnpm run backupdb:scheme`
- **Output File**: `backup/schema_backup.sql`
- **Timestamp**: `2026-08-29T17:02:03+07:00`
- **Status**: Verified Schema Dump (MySQL 8.x, `ziqva_labs`).

### 3. Files Created & Modified in this Snapshot
- `client/index.html` - Inline client-side path-to-hash converter script.
- `src/routes/memberRoutes.ts` - Serves Svelte SPA index.html for member GET routes & restored POST /orders/create.
- `src/routes/adminRoutes.ts` - Serves Svelte SPA index.html for admin GET routes.
- `src/app.ts` - Serves Svelte SPA index.html on root `/` and added `client_dist` static middleware.
- `src/controllers/memberController.ts` - Fixed `showLogin` method signature for ESLint.
- `backup/schema_backup.sql` - Updated MySQL schema dump.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v171.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 106.

---

## Snapshot 107 — 2026-08-29 (Public Landing Page Implementation & Chrome DevTools QA Verification)

### 1. Major Architectural & UI Enhancements
- **Public Landing Page Svelte Component (`client/src/lib/pages/LandingPage.svelte`)**:
  - Membangun Public Landing Page berkonsep **Dark Glassmorphism Premium** dengan 7 seksi lengkap:
    1. Topbar Header Glassmorphism (Logo Ziqva AppCenter, link navigasi, toggle tema, tombol Masuk & Daftar).
    2. Hero 3D Ecosystem Section (Badge headline, deskripsi, 3D levitation centerpiece `heroFloat`, CTA buttons).
    3. Live Software Catalog Showcase (Filter segmented tabs, card grid interaktif, harga, badge promo Rp 0 & Bundle).
    4. Security & Architectural Invariants (HWID Lock, Aktivasi Instan, SFTP High-Speed Installer, Video Tutorials).
    5. Program Kemitraan Afiliasi (Highlight banner komisi, 3 pilar poin, CTA registrasi).
    6. Proof Stat Counter & FAQ Accordion (Counter 8.6k+, 30+ software, 99.9% uptime, accordion interaktif).
    7. Footer Navigation & Ecosystem Identity (Brand info, navigasi cepat, portal akses, bantuan, hak cipta).
- **Smart Hybrid Routing (`client/src/App.svelte`)**:
  - Mengonfigurasi rute `/` dan `/welcome` via `smartLandingRouting()`:
    - Pengunjung publik (guest) melihat Landing Page di `/`.
    - Pengguna terotentikasi (member/admin) diarahkan otomatis ke `#/member/dashboard` atau `#/admin/dashboard` saat membuka `/`.
    - Pengguna terotentikasi dapat membuka `/#/welcome` atau `/?preview=true` untuk melihat landing page dengan opsi beralih kembali ke dashboard.

### 2. Chrome DevTools Visual QA Verification
- Skrip pengujian otomatis `scratch/verify-landing-page.js` menguji 4 variasi tampilan:
  - Desktop Dark Theme (1440x900): ✅ PASS (`landing_page_desktop_dark.png`).
  - Desktop Light Theme (1440x900): ✅ PASS (`landing_page_desktop_light.png`).
  - Mobile Dark Theme (390x844): ✅ PASS (`landing_page_mobile_dark.png`).
  - Mobile Light Theme (390x844): ✅ PASS (`landing_page_mobile_light.png`).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** berhasil 100%.

### 3. Files Created & Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - New Public Landing Page Svelte component.
- `client/src/App.svelte` - Smart Hybrid Routing on `/` and `/welcome`.
- `docs/superpowers/specs/2026-08-29-landing-page-design.md` - Design specification document.
- `scratch/verify-landing-page.js` - Chrome DevTools QA verification script with puppeteer-core.
- `docs/screenshots/landing_page_*.png` - Desktop & Mobile screenshots (Light & Dark theme).
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v172.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 107.

---

## Snapshot 108 — 2026-08-30 (Unrestricted Landing Page Route `/` & Login Session Redirect Scoping)

### 1. Major Architectural & UI Enhancements
- **Unrestricted Landing Page Access (`client/src/App.svelte`)**:
  - Rute `/` dan `/welcome` menyajikan `LandingPage.svelte` secara terbuka tanpa pengalihan (siapa saja dapat mengakses `/` baik pengunjung publik, member, maupun admin).
  - Pengalihan sesi berbasis peran (redirect) secara khusus hanya berlaku pada halaman login:
    - `/member/login`: jika member sudah terotentikasi -> dialihkan ke `#/member/dashboard`.
    - `/admin/login`: jika admin sudah terotentikasi -> dialihkan ke `#/admin/dashboard`.
- **Top Bar Session Actions (`client/src/lib/pages/LandingPage.svelte`)**:
  - Secara reaktif mendeteksi status sesi member & admin.
  - Member terotentikasi melihat tombol *"Buka Member Area →"*.
  - Admin terotentikasi melihat tombol *"Buka Admin Panel →"*.
  - Pengunjung publik melihat tombol *"Masuk"* dan *"Daftar Akun Gratis"*.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme.
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/App.svelte` - Removed `/` condition redirect; login pages retain session redirects.
- `client/src/lib/pages/LandingPage.svelte` - Added member & admin session detection for header CTA.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v173.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 108.

---

## Snapshot 109 — 2026-08-30 (Root Path-to-Hash Converter Fix in `client/index.html`)

### 1. Root Cause & Solution
- **Akar Masalah**: Skrip inline FOUC & converter path-to-hash di `client/index.html` sebelumnya secara hardcode menyetel `window.location.hash = '/member/dashboard'` ketika pengguna membuka URL root `/` tanpa hash. Hal ini membuat akses langsung ke `http://domain.com/` selalu dialihkan ke `/member/dashboard` (dan jika belum login, dialihkan ke `/member/login`).
- **Perbaikan**: Mengubah skrip inline di `client/index.html` agar `if (path === '/' && !window.location.hash)` menyetel `window.location.hash = '/'` (Public Landing Page).
- **Hasil**: Pengikatan URL root `/` tanpa hash maupun `/#/` kini secara konsisten menyajikan Public Landing Page.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme.
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/index.html` - Updated inline path-to-hash converter for root `/` path.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v174.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 109.

---

## Snapshot 110 — 2026-08-30 (Expanded Public Landing Page Copy, Terms & Guarantees, and Legal Modals)

### 1. Major Architectural & UI Copy Enhancements
- **Trust & Compliance Badges (Hero Section)**:
  - Menambahkan indikator kepercayaan real-time di bawah metric hero: *⚡ Aktivasi Instan 24/7*, *💳 QRIS & Transfer Bank*, *🔄 Auto-Update Engine*, *💻 Windows 10/11 & macOS*.
- **Features Grid Expansion (`client/src/lib/pages/LandingPage.svelte`)**:
  - Mengekspansi grid keunggulan menjadi 6 kartu (menambahkan *Auto-Updater System* & *Gerbang Pembayaran Otomatis QRIS/VA Bank*).
- **Dedicated Section: Ketentuan & Garansi Layanan (Ziqva Guarantee Policy v2.0)**:
  - Membangun seksi khusus transparan yang menjelaskan 4 garansi kunci:
    1. *1 Lisensi = 1 HWID Mesin* (Penjelasan lisensi terikat mesin & fitur Self-Service Transfer mandiri).
    2. *Garansi Aktivasi Instan* (Jaminan serial key aktif seketika setelah pembayaran/klaim).
    3. *Email Permanen & Aman* (Proteksi kepemilikan akun & lisensi).
    4. *Technical Support 24/7* (Pendampingan video tutorial & bantuan teknis).
- **FAQ Accordion Expansion**:
  - Menambah 3 FAQ baru seputar: penanganan PC rusak / install ulang OS, mekanisme pencairan komisi Mitra Afiliasi, dan dukungan metode pembayaran QRIS/VA Bank.
- **Legal Modals (Footer)**:
  - Menambahkan modal dialog interaktif untuk **Syarat & Ketentuan Layanan (Terms of Service)** dan **Kebijakan Privasi (Privacy Policy)** pada navigasi footer.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Expanded copy, trust badges, guarantee section, FAQ, and legal modals.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v175.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 110.

---

## Snapshot 111 — 2026-08-30 (Brand Name Alignment to `AppCenter Ziqva Labs`)

### 1. Major Architectural & Brand Enhancements
- **Brand Alignment (`client/src/lib/pages/LandingPage.svelte` & `client/index.html`)**:
  - Mengubah seluruh penyebutan merek pada Public Landing Page dan HTML document title dari `AppCenter Ziqva` / `Ziqva` menjadi **AppCenter Ziqva Labs** / **Ziqva Labs**.
  - Lokasi pembaruan mencakup: Header Brand Logo (`AppCenter Ziqva Labs`), Katalog Subtitle, Features Section Header (`Mengapa Memilih AppCenter Ziqva Labs?`), Guarantees Badge (`Ziqva Labs Guarantee Policy v2.0`), Affiliate Banner (`Komisi Berkelanjutan Bersama Ziqva Labs`), FAQ Accordion (`AppCenter Ziqva Labs`), Footer Brand Logo, Copyright Footer, dan Modal Syarat & Ketentuan / Kebijakan Privasi.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Updated all brand references to AppCenter Ziqva Labs.
- `client/index.html` - Updated document title tag to AppCenter Ziqva Labs.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v176.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 111.

---

## Snapshot 112 — 2026-08-30 (Replaced All Emojis with Professional Inline SVG Icons)

### 1. Major UI Iconography Enhancements
- **Complete Emoji Removal (`client/src/lib/pages/LandingPage.svelte`)**:
  - Mengeliminasi seluruh 20+ emoji dari UI Public Landing Page dan menggantinya dengan ikon SVG vektor inline tajam bertema minimalis profesional.
  - Rincian Penggantian Ikon:
    1. **Hero CTA Button**: Mengganti `🚀` dengan ikon SVG Zap / Flash Launch.
    2. **Trust Badges Hero**: Mengganti `⚡` (Zap), `💳` (Credit Card), `🔄` (Refresh/Sync), `💻` (Monitor/Laptop) dengan SVG Tailwind.
    3. **Floating Platter Satellite**: Mengganti `🔐` dengan SVG Shield Lock.
    4. **Filter Tabs Katalog**: Mengganti `🔥` (Bundle), `🎁` (Free Tag), `📦` (Bundle Badge) dengan SVG modern.
    5. **Features Grid (6 Cards)**: Mengganti `🔒`, `🚀`, `📂`, `🎬`, `🔄`, `💳` dengan ikon SVG 24x24 bertema warna aksen Tailwind.
    6. **Ketentuan & Garansi Layanan**: Mengganti `🛡️`, `🔑`, `⚡`, `🔒`, `🎧` dengan SVG Shield-Check, Key, Zap, Lock, dan Headset.
    7. **Program Afiliasi Banner**: Mengganti `💼` dengan SVG Briefcase.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Replaced all emojis with SVG vector icons.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v177.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 112.

---

## Snapshot 113 — 2026-08-30 (Hero Section Web Design Review & Visual Refinement)

### 1. Major Visual & Layout Enhancements
- **Hero Section UI Upgrade (`client/src/lib/pages/LandingPage.svelte`)**:
  - **Adaptabilitas Tema Ganda pada 3D Ecosystem Showcase**: Mengubah kartu 3D platter dari warna latar gelap statis menjadi adaptif tema (`from-indigo-50/90 via-white to-amber-50/50` pada Light Theme, dan `dark:from-[#192646] dark:to-[#0c1428]` pada Dark Theme) dengan kontras teks yang tetap tajam di kedua mode.
  - **Standardisasi Kartu Micro-Metrics**: Mengubah 3 metrik (`8.6k+`, `30+`, `100%`) dari teks mentah biasa menjadi kartu kontainer terisolasi (`p-3.5 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs hover:border-amber-500/30`) untuk hirarki visual yang lebih rapi.
  - **Upgrade Pill Badges Kepatuhan & Kepercayaan**: Membungkus setiap trust badge ke dalam kontainer pill terisolasi (`px-3 py-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-1)]/80 hover:border-amber-500/30 backdrop-blur-xs`) dengan ikon SVG warna-warni Tailwind.
  - **Mikro-Interaksi Tombol CTA**: Menambahkan efek elevasi halus dan bayangan pendaran amber (`hover:-translate-y-0.5 hover:shadow-amber-500/40`) pada tombol penjelajahan utama.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Refined Hero section layout, metric cards, trust pills, and adaptive 3D showcase.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v178.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 113.

---

## Snapshot 114 — 2026-08-30 (Anti-AI-Slop Copy Transformation & Framer-Motion Motion Choreography)

### 1. Major Copywriting & Animation Enhancements
- **Anti-AI-Slop Copy Transformation (`client/src/lib/pages/LandingPage.svelte`)**:
  - Mengganti klaim pemasaran AI generik & frasa berbunga-bunga (*puffery*) menjadi kalimat bertindak konkret, lugas, dan bernas:
    - **Header Badge**: `PLATFORM OTOMATISASI WORKFLOW & LISENSI DESKTOP` (menggantikan *EKOSISTEM SOFTWARE & BOT OTOMATISASI TERPERCAYA*).
    - **Headline Utama**: `Eliminasi Kerja Manual. Eksekusi Workflow 10x Lebih Cepat.` (menggantikan *Otomatiskan Pekerjaan, Melipatgandakan Hasil Bisnis Anda*).
    - **Sub-headline Deskripsi**: `Akses software bot desktop dan lisensi resmi dalam 1 klik. Jalankan otomatisasi 24/7 tanpa risiko human-error, dari toko online hingga manajemen afiliasi.` (menggantikan *Tools otomatisasi serba cepat... tanpa beban*).
- **Framer-Motion Style Motion Choreography**:
  - Mengintegrasikan transisi masuk terorkestrasi sekelas Framer Motion menggunakan `svelte/transition` (`fly`, `scale`, `fade`) dan `svelte/easing` (`cubicOut`, `backOut`):
    - **Hero Badge**: `in:fly={{ y: -15, duration: 400, delay: 100, easing: cubicOut }}`.
    - **Headline Utama**: `in:fly={{ y: 25, duration: 500, delay: 200, easing: cubicOut }}`.
    - **Deskripsi Sub-headline**: `in:fly={{ y: 20, duration: 500, delay: 300, easing: cubicOut }}`.
    - **Tombol CTA & Metrik**: Staggered entry `400ms` & `500ms`.
    - **Kartu Platter 3D Ecosystem**: `in:scale={{ start: 0.9, duration: 600, delay: 250, easing: backOut }}`.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Applied concrete Anti-AI-Slop copy & Framer Motion entry transitions.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v179.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 114.

---

## Snapshot 115 — 2026-08-30 (Software & Bot Catalog Section Refinement & Framer Motion Choreography)

### 1. Major Copywriting, Iconography & Animation Enhancements
- **Anti-AI-Slop Copy Transformation (`client/src/lib/pages/LandingPage.svelte`)**:
  - **Header Seksi**: `Katalog Software Bot & Tools Otomatisasi` (menggantikan *Pilih Software & Bot Sesuai Kebutuhan Anda*).
  - **Sub-headline**: `Lisensi resmi terikat HWID mesin. Dilengkapi installer SFTP, panduan video tutorial 16:9, dan dukungan teknis langsung.` (menggantikan frasa generik *dukungan tim technical support Ziqva Labs*).
  - **Deskripsi Kartu Default**: `Software bot desktop siap pakai untuk otomatisasi tugas rutin dan optimalisasi workflow digital.`
  - **Pesan Filter Kosong**: `Tidak ada software pada filter kategori ini.`
- **Pembersihan Ikonografi & SVG Vector**:
  - Mengganti seluruh simbol mentah `✓` pada item bundle dengan ikon SVG vektor Checkmark berwarna hijau emerald (`w-3 h-3 text-emerald-500`).
- **Framer-Motion Style Motion Choreography**:
  - Menerapkan *Staggered Card Entrance* `in:scale={{ start: 0.94, duration: 400, delay: idx * 60, easing: backOut }}` untuk setiap kartu produk saat berpindah filter atau saat halaman dimuat.
  - Mikro-interaksi tombol CTA *Pesan Sekarang / Klaim Gratis*: `hover:-translate-y-0.5 hover:shadow-lg hover:shadow-amber-500/25 active:scale-95`.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Applied concrete copy, SVG checkmarks, and Framer Motion staggered animations to Software & Bot catalog section.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v180.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 115.

---

## Snapshot 116 — 2026-08-30 (Keunggulan Platform Section Anti-AI-Slop & Motion Choreography)

### 1. Major Copywriting & Animation Enhancements
- **Anti-AI-Slop Copy Transformation (`client/src/lib/pages/LandingPage.svelte`)**:
  - **Header Seksi**: `Keunggulan Arsitektur & Keamanan Platform` (menggantikan *Mengapa Memilih AppCenter Ziqva Labs?*).
  - **Sub-headline**: `Infrastruktur software desktop dengan lisensi aman, otomatisasi update tanpa hambatan, dan sistem pembayaran terintegrasi.` (menggantikan frasa generik *Keamanan data, kecepatan distribusi installer...*).
  - **Refined Feature Cards (6 Kartu)**:
    1. **HWID Binding**: `Lisensi terkunci permanen pada ID perangkat PC/Laptop. Mencegah pembajakan lisensi dan menjamin hak akses sah pengguna.`
    2. **Aktivasi Real-Time**: `Serial key aktif seketika setelah pembayaran atau klaim Rp 0 terverifikasi di sistem, tanpa perlu konfirmasi manual.`
    3. **SFTP High-Speed Installer**: `Unduh file installer resmi (.exe / .dmg) langsung dari server SFTP berkecepatan tinggi tanpa batas bandwidth.`
    4. **Cinema Video Tutorials**: `Panduan penggunaan video tutorial 16:9 mode bioskop dengan navigasi modul langkah-demi-langkah.`
    5. **Auto-Updater System**: `Aplikasi desktop otomatis mendeteksi versi baru dan melakukan update patch tanpa install ulang.`
    6. **Gerbang Pembayaran Otomatis**: `Transaksi cepat via QRIS (GoPay, OVO, DANA, ShopeePay) dan Virtual Account Bank dengan verifikasi otomatis 24/7.`
- **Framer-Motion Style Motion Choreography**:
  - Header Seksi: Slide-up `in:fly={{ y: 20, duration: 400, delay: 100, easing: cubicOut }}`.
  - Staggered Feature Cards Entrance: 6 kartu masuk secara bergantian dengan efek spring `in:scale={{ start: 0.94, duration: 400, delay: 150 + idx * 80, easing: backOut }}`.
  - Hover Micro-Interactions: Kartu ber-elevasi `hover:-translate-y-1 hover:shadow-xl` dan kontainer ikon ber-zoom `group-hover:scale-110`.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Applied concrete copy, clean SVG icons, and Framer Motion staggered animations to Keunggulan section.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v181.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 116.

---

## Snapshot 117 — 2026-08-30 (Program Mitra Afiliasi Section Anti-AI-Slop & Motion Choreography)

### 1. Major Copywriting & Animation Enhancements
- **Anti-AI-Slop Copy Transformation (`client/src/lib/pages/LandingPage.svelte`)**:
  - **Badge Tag**: `PROGRAM MITRA AFILIASI RESMI` (menggantikan *PROGRAM MITRA AFILIASI*).
  - **Headline Utama**: `Dapatkan Komisi Penjualan Software Hingga 30%` (menggantikan janji generik *Dapatkan Komisi Berkelanjutan Bersama Ziqva Labs*).
  - **Sub-headline Deskripsi**: `Generasikan kode kupon unik dari Portal Member. Komisi otomatis tercatat setiap kali kupon digunakan dan dapat ditarik langsung ke rekening bank atau e-wallet.`
  - **Refined Checklist Bullets**:
    1. `Kupon Diskon Potongan Harga Pembeli`
    2. `Dashboard Real-Time Tracking Komisi`
    3. `Pencairan Langsung ke Bank & E-Wallet`
  - **CTA Button**: `Daftar Akun Mitra Afiliasi →` (menggantikan *Bergabung Mitra Afiliasi →*).
- **SVG Vector Icon Cleanups**:
  - Mengganti simbol `✓` dengan ikon SVG Checkmark vektor berwarna hijau emerald (`w-4 h-4 text-emerald-400`).
- **Framer-Motion Style Motion Choreography**:
  - Banner Card: Spring entrance `in:scale={{ start: 0.95, duration: 500, delay: 100, easing: backOut }}`.
  - Text Content: Slide-up `in:fly={{ y: 20, duration: 400, delay: 200, easing: cubicOut }}`.
  - CTA Button: Slide-right `in:fly={{ x: 20, duration: 400, delay: 300, easing: cubicOut }}` + micro-hover `hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-amber-500/30 active:scale-95`.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Applied concrete copy, SVG checkmarks, and Framer Motion entry transitions to Program Mitra Afiliasi section.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v182.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 117.

---

## Snapshot 118 — 2026-08-30 (FAQ Accordion Section Anti-AI-Slop & Framer Motion Slide Choreography)

### 1. Major Copywriting, Iconography & Motion Enhancements
- **Anti-AI-Slop Copy Transformation (`client/src/lib/pages/LandingPage.svelte`)**:
  - **Sub-headline**: `Jawaban resmi seputar lisensi software, otomatisasi update, dan sistem pembayaran.` (menggantikan frasa generik *Segala hal yang perlu Anda ketahui tentang AppCenter Ziqva Labs*).
- **SVG Vector Iconography**:
  - Mengganti seluruh simbol panah unicode `▼` dengan ikon **SVG Chevron Vector** (`w-4 h-4 text-amber-500`) dengan animasi rotasi 180 derajat yang mulus saat dibuka.
- **Framer-Motion Style Motion Choreography**:
  - Header Seksi: Slide-up `in:fly={{ y: 20, duration: 400, delay: 100, easing: cubicOut }}`.
  - Staggered FAQ Items Entrance: 6 item FAQ masuk secara bergantian dengan efek spring `in:scale={{ start: 0.96, duration: 400, delay: 150 + idx * 60, easing: backOut }}`.
  - Svelte Slide Accordion: Jawaban FAQ mengembang dan menciut secara sangat halus menggunakan `transition:slide={{ duration: 250, easing: cubicOut }}` dengan penanda kartu aktif border amber (`border-amber-500/40 shadow-lg`).

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Applied concrete copy, SVG chevron icons, interactive Svelte state, and Framer Motion slide accordion choreography.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v183.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 118.

---

## Snapshot 120 — 2026-08-30 (Landing Page Theme Color Palette Realignment to Royal Blue)

### 1. Major Theme Realignment Highlights
- **Royal Blue Theme Realignment (`client/src/lib/pages/LandingPage.svelte`)**:
  - Mengganti seluruh aksen warna oranye/amber (`amber-500`, `orange-500`, `amber-400`, `amber-500/30`) di seluruh Landing Page menjadi warna **Royal Blue (`blue-600`, `blue-500`, `indigo-600`, `cyan-500`)** agar selaras 100% dengan palet warna utama Member Area & Admin Area.
  - **Header Topbar**: Favicon logo badge (`bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500`), teks Ziqva Labs (`text-blue-500 dark:text-blue-400`), link hover (`hover:text-blue-600 dark:hover:text-blue-400`), dan tombol CTA (`bg-gradient-to-r from-blue-600 to-indigo-600 text-white`).
  - **Hero Section**: Tag badge (`bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400`), headline gradient (`from-blue-600 via-cyan-500 to-indigo-600`), tombol CTA utama (`bg-gradient-to-r from-blue-600 via-blue-700 to-indigo-600 text-white`), dan aksen 3D Platter (`border-blue-300 dark:border-blue-500/40 shadow-blue-500/10`).
  - **Katalog Software**: Judul seksi (`text-blue-600 dark:text-blue-400`), tab filter aktif (`bg-blue-600 text-white`), badge bundle (`bg-blue-500/20 border-blue-500/40 text-blue-600 dark:text-blue-400`), hover judul produk (`group-hover:text-blue-600 dark:group-hover:text-blue-400`), dan tombol pesal CTA (`bg-gradient-to-r from-blue-600 to-indigo-600 text-white`).
  - **Keunggulan & Ketentuan**: Banner garansi (`border-blue-500/30 bg-blue-500/20 text-blue-600 dark:text-blue-400`), kartu fitur hover (`hover:border-blue-500/40`), dan ikon item (`text-blue-600 dark:text-blue-400`).
  - **Mitra Afiliasi**: Banner kemitraan (`from-[#0b1730] via-[#0d1e40] to-[#121935] border-blue-500/30`), badge (`bg-blue-500/20 border-blue-500/40 text-blue-400`), dan tombol daftar CTA (`bg-gradient-to-r from-blue-600 to-indigo-600 text-white`).
  - **FAQ Accordion**: Ikon Chevron (`text-blue-600 dark:text-blue-400`) dan kartu aktif border (`border-blue-500/40 shadow-blue-500/10`).
  - **Footer & Modal Legal**: Logo footer badge (`bg-blue-600`), link hover (`hover:text-blue-600 dark:hover:text-blue-400`), penanda target branch (`text-blue-600 dark:text-blue-400`), dan tombol modal legal (`bg-blue-600 text-white`).

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Applied Royal Blue theme color realignment across all landing page sections.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v185.
## Snapshot 121 — 2026-08-30 (Hero Section macOS Liquid Glass Redesign & Visual Realignment)

### 1. Major Redesign Highlights
- **macOS Liquid Glass Styling (`client/src/lib/pages/LandingPage.svelte`)**:
  - Transformasi tombol utama `Jelajahi Katalog Software` dan `Coba Tools Gratis (Rp 0)` menggunakan gaya **macOS Frosted Liquid Glass** (`backdrop-blur-xl bg-white/10 border border-white/20 hover:scale-[1.02]`).
  - Transformasi 3 kartu metrik mikro (`8.6k+ Pengguna Aktif`, `30+ Software & Bot`, `100% Lisensi Resmi`) menjadi **widget kaca cair khas macOS** dengan container terpisah untuk ikon SVG vektor dan pergeseran elevasi hover.
  - Re-positioning kartu satelit floating `Tools Gratis (Rp 0)` dan `HWID Lock` di sekeliling 3D Platter ekosistem agar seimbang, rapi, dan tidak lagi menumpuk canggung di luar platter.
  - Mengeliminasi elemen dot animasi *AI-slop* (`animate-ping`) pada badge platform atas dan menggantinya dengan ikon SVG vektor shield terverifikasi.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Applied macOS Liquid Glass styling to CTA buttons, metric widgets, floating satellites, and removed AI-slop dot badges.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v186.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 121.

---

## Snapshot 122 — 2026-08-30 (Pro Designer Apple TV-Class Frosted Glass Bar & Hero Overhaul)

### 1. Major Redesign Highlights
- **Apple TV-Class Frosted Glass Navbar (`client/src/lib/pages/LandingPage.svelte`)**:
  - Mengubah bar Navigasi Header menjadi **translucent TV-Class Glass** (`backdrop-blur-2xl bg-[#0a0f1d]/80 dark:bg-[#060b18]/85 border-b border-white/10 dark:border-blue-500/15 shadow-xl shadow-black/10`).
  - Menambahkan indikator garis bawah animasi (*hover underline indicator*) pada item navigasi desktop.
  - Mengubah tombol CTA pendaftaran/akses portal menjadi **Apple Pill Button** (`px-6 py-2.5 rounded-full font-bold text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95`).
  - Mengubah tombol toggle tema menjadi bentuk *squircle* kaca cair (`p-2.5 rounded-2xl border border-white/15 bg-white/10 dark:bg-slate-800/50 backdrop-blur-xl`).
- **Pro Hero Section Layout & Micro Metrics**:
  - Menyempurnakan tombol CTA utama dan sekunder dengan efek *glossy highlight*, elevasi bayangan dalam (*deep aura shadow*), dan *backdrop-blur-2xl*.
  - Menata 3 widget metrik mikro dengan wadah ikon SVG berdefinisi tinggi (`w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/25`) dan panel *TV-Class Frosted Glass* (`bg-[#0e172e]/60 dark:bg-[#0a1226]/80 border border-white/15`).
  - Merevisi koordinat kartu satelit floating `Tools Gratis` (`top-3 -left-2`) dan `HWID Lock` (`bottom-3 -right-2`) dengan material kaca cair ganda berkedalaman 3D tinggi.

### 2. Chrome DevTools Visual QA Verification
- Diverifikasi 100% via `scratch/verify-landing-page.js` pada 4 viewport/theme (Desktop Light/Dark, Mobile Light/Dark).
- Hasil Audit: **0 Console Error**, **0 Network 404**, dan **Auto-cleanup temporary Chrome profile** 100% bersih.

### 3. Files Modified in this Snapshot
- `client/src/lib/pages/LandingPage.svelte` - Applied Apple TV-Class Frosted Glass styling across Navbar and Hero Section.
- `docs/CONTEXT_SNAPSHOT.yaml` - Snapshot v187.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 122.


























































---

## SPRINT UPDATE: GoQRIS Payment Gateway Integration & Admin UI Refactoring (2026-09-12T09:54:22.248Z)

### Summary of Additive Changes:
1. **GoQRIS Payment Gateway Migration**:
   - Integrated GoQRIS API with API Key support, project name matching, and toggle active status.
   - Added automatic polling endpoint `/api/payment/check-status/:order_id` (3s polling intervals).
   - Order creation and checkout now check for active GoQRIS gateway status before proceeding.
   - Database schema migrated with `payment_settings` table and payment QR code reference fields on orders.

2. **2-Page Bilingual PDF Invoice Template**:
   - Overhauled `src/views/invoicePdfTemplate.ts` to generate two structured pages:
     - Page 1: English formal receipt with complete itemized breakdown and QR code.
     - Page 2: Indonesian formal faktur/kuitansi digital.
   - Refreshed Ziqva Labs branding, eliminated hardcoded text in logo SVG, and configured the official company contact address.

3. **Admin Settings Navigation & Modern Input Controls**:
   - Refactored `client/src/lib/pages/AdminSettings.svelte` with a 2-tab navigation: "Database Backup" and "Payment Gateway".
   - Converted "Masa Aktif Tagihan" into a dual control: numerical duration input with a custom styled dropdown (`CustomSelect.svelte`) selecting either **Jam** (Hours) or **Menit** (Minutes), defaulting to 24 Jam and safely mapped to 1440 minutes on the server.
   - Formatted "Biaya Admin Tambahan" with an explicit **Rp** badge and automated localized thousand separators (`toLocaleString('id-ID')`).
   - Re-designed the GoQRIS integration documentation modal into a clean, minimalist card layout with practical step-by-step instructions and single-click Webhook URL copy capability.

4. **Database Schema Backup**:
   - Schema snapshot backed up to `backup/schema_backup.sql`.

---

## Snapshot 123 — 2026-09-14 (Admin Payments Advanced Date Period Presets, Product Filter & Multi-Sort Toolbar)

### 1. Major Functional & UI Enhancements:
- **Date Period Presets & Custom Range Engine (`adminController.ts` & `AdminPayments.svelte`)**:
  - Implemented `getDateRangeFilter` in backend supporting dynamic date period calculations:
    - **Semua Waktu** (`all` - default without time bounds).
    - **Bulan Ini** (`this_month` - start of current month 00:00:00 to now).
    - **Bulan Kemarin** (`last_month` - start of previous month 00:00:00 to end of previous month 23:59:59).
    - **3 Bulan Terakhir** (`last_3_months` - 90 days trailing window).
    - **1 Tahun Terakhir** (`last_1_year` - 365 days trailing window).
    - **Kustom Rentang** (`custom` - custom start date and end date).
  - Timezone-aware timestamp conversion ensuring precise local boundary evaluation (WIB/client timezone).

- **Dynamic Product Filter Dropdown (`CustomSelect.svelte`)**:
  - Backend queries all catalog products and returns `availableProducts` list.
  - Frontend renders `CustomSelect` with `prefix="Produk:"` showing software thumbnails, allowing instant filtering by specific products or "Semua Produk".

- **2-Row Integrated SaaS Toolbar Layout (Opsi A)**:
  - **Row 1**: Debounced Live Search bar (Order ID, customer email, customer name, license token), Product `CustomSelect`, Multi-Sort `CustomSelect` (`created_desc`, `created_asc`, `amount_desc`, `amount_asc`, `paid_desc`, `id_desc`, `id_asc`), and Refresh button.
  - **Row 2**: Period preset buttons with responsive active highlights, inline date picker inputs (Dari & Sampai) when *Kustom Tanggal* is active, and 1-click **Reset Filter (✕)** button when any active filter is applied.

### 2. Files Modified:
- `src/controllers/adminController.ts` - Extended `apiGetPayments` with `period`, `startDate`, `endDate`, `product`, `sort`, `order` and `availableProducts`.
- `client/src/lib/pages/AdminPayments.svelte` - Implemented 2-row toolbar, period preset pills, product filter, custom date range, and filter reset.
- `docs/superpowers/plans/2026-09-14-admin-payments-filter-sort-period-plan.md` - Implementation plan.

---

## Snapshot 124 — 2026-09-14 (Admin Payments UI/UX Overhaul: Custom Themed Calendar Popover & Mobile Responsive Track)

### 1. Major Functional & Visual Enhancements:
- **Custom Themed Calendar Popover (`AdminPayments.svelte`)**:
  - Eliminated all raw browser HTML `<input type="date">` elements.
  - Implemented a theme-integrated, glassmorphic calendar popover with Indonesian localized months (`Januari` - `Desember`) and days (`Min` - `Sab`).
  - Interactive start-to-end date range selection with hover-in-range highlights, range summary badge (`14 Sep 2026 - 18 Sep 2026`), and quick in-popover presets (`Hari Ini`, `7 Hari`, `30 Hari`).
  - Added global click-outside and Escape key handlers to seamlessly dismiss the popover.

- **Responsive SaaS Toolbar & Horizontal Preset Track**:
  - Replaced clumsy submit button with live 320ms debounced search input with instant clear `✕` action.
  - Re-architected period preset buttons into a smooth horizontal scrollable pill track with subtle active glow and icon badges (`Semua Waktu`, `Bulan Ini`, `Bulan Kemarin`, `3 Bulan Terakhir`, `1 Tahun Terakhir`, `Kustom Tanggal`).
  - Compact toolbar height under 120px on mobile viewports.

- **High-Density Desktop Table & Compact Mobile Transaction Cards**:
  - Desktop: Monospace Order IDs with hover link icons, avatar thumbnails with product duration tags, pulsating status dots (Emerald for Lunas, Amber for Pending), monospace license token pills with 1-click clipboard copy, and unified tooltip action buttons.
  - Mobile: Clean, compact card layout with clear visual hierarchy, direct action badges, and zero horizontal overflow.

### 2. Chrome DevTools Visual QA Verification:
- Verified 100% via `browser-skill` (`bsk`) on Desktop (1440x900) and Mobile (390x844) viewports.
- All temporary screenshots and testing artifacts cleaned up with zero disk footprint.

### 3. Files Modified:
- `client/src/lib/pages/AdminPayments.svelte` - Redesigned entire toolbar, custom calendar popover, desktop table, and mobile cards.
- `docs/superpowers/plans/2026-09-14-admin-payments-ui-ux-custom-datepicker-elevation.md` - Implementation plan.
- `ZIQVA_STORE_ANALYSIS.md` - Snapshot 124.

---

## Snapshot 125 — 2026-09-16 (Member Portal UI/UX Elevation: Handcrafted Checklist, Raycast Active License Cards, High-Density Pending Action Bar, Mobile Card Orders, and High-Contrast Zebra Striping)

### 1. Major Functional & Visual Enhancements:
- **Handcrafted Animated Checkbox (`CustomCheckbox.svelte`)**:
  - Eliminated generic AI-slop visual boxes and heavy neon gradients.
  - Implemented crisp 18x18px checkbox with smooth SVG path-drawing animation (`stroke-dashoffset: 16 -> 0` with `cubic-bezier(0.16, 1, 0.3, 1)`), tactile micro-bounce, and built-in link guard to prevent toggle when clicking Terms and Privacy links.
  - Unified across Login (`Login.svelte`), Register (`Register.svelte`), and HWID migration modal (`Licenses.svelte`).

- **Responsive Spacing on Member Dashboard Hero (`Dashboard.svelte` & `appcenter-theme.css`)**:
  - Added responsive vertical margin (`mb-6 sm:mb-8 lg:mb-10`) to the `.welcome` hero banner, providing clean 24px+ breathing room above "LISENSI TERDAFTAR" on mobile viewports.

- **Raycast-Style Active Software License Cards (`Dashboard.svelte`)**:
  - Re-architected bulky `rounded-3xl` cards into sleek `rounded-2xl` containers with live pulsating status dots, monospace serial key strips with 1-click clipboard copy feedback, and direct routing from "Unduh Installer" to the Download Hub (`#/member/downloads?id=...`).

- **High-Density Pending Order Action Bar (`Dashboard.svelte` & `memberController.ts`)**:
  - Fixed `apiGetDashboard` query to include active pending GoQRIS orders (where `payment_request_id` is null) and automatically generate invoice tokens.
  - Designed high-density action bar with neutral surface tokens, 36x36px icon, natural Indonesian copywriting, and high-contrast "Bayar Pesanan" button.

- **Universal Digital Invoice SPA Routing (`App.svelte`)**:
  - Registered `'/invoice/:token'`, `'/invoices/:token'`, and `'/member/invoices/:token'` to `InvoicePublic.svelte`, ensuring direct navigation to digital payment invoices without falling through to catch-all.

- **Mobile Orders Card View & Right-Aligned Content-Fitted Filter Dropdown (`Orders.svelte`)**:
  - Replaced wide horizontally-scrolling desktop table on mobile (`< md`) with dedicated zero-scroll responsive mobile cards.
  - Replaced wide scrollable filter tabs on mobile with a right-aligned, content-fitted `CustomSelect` dropdown ("Filter Status:").
  - Preserved multi-column sortable table for desktop screens (`>= md`).

- **High-Contrast Alternating Zebra Striping (`Orders.svelte` & `MemberInvoices.svelte`)**:
  - Implemented high-contrast zebra striping between odd rows (`rgb(12, 19, 34)`) and even rows (`rgb(20, 31, 54)` in dark mode / `bg-slate-100` in light mode), making row tracking effortless and visually distinct.

### 2. Browser Automation Verification:
- 100% verified via automated headless Chrome CDP across Desktop ($1280\times800$) and Mobile ($390\times844$, $400\times520$) viewports.
- All temporary testing scripts purged (*zero storage footprint*).

### 3. Files Modified:
- `client/src/App.svelte`
- `client/src/lib/components/CustomCheckbox.svelte`
- `client/src/lib/pages/Dashboard.svelte`
- `client/src/lib/pages/Licenses.svelte`
- `client/src/lib/pages/Login.svelte`
- `client/src/lib/pages/MemberInvoices.svelte`
- `client/src/lib/pages/Orders.svelte`
- `client/src/lib/pages/Register.svelte`
- `public/css/appcenter-theme.css`
- `src/controllers/memberController.ts`
- `src/views/member-dashboard.ts`
- `docs/superpowers/specs/2026-09-16-member-portal-mobile-and-ux-elevation.md`
- `docs/superpowers/plans/2026-09-16-member-portal-mobile-and-ux-elevation.md`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 126 — 2026-09-16 (Member Invoices & Orders Compact Single-Row Toolbar, Mobile Cards, and Global Bespoke Scrollbars)

### 1. Major Functional & Visual Enhancements:
- **Member Invoices Mobile Cards & Compact 1-Row Toolbar (`MemberInvoices.svelte`)**:
  - Replaced wide desktop table on mobile (`< md`) with dedicated zero-scroll mobile cards featuring product icons, invoice number links, total amount, and quick action buttons (Digital Web Invoice in blue, PDF Receipt in rose).
  - Compact 1-Row Toolbar (`p-3 sm:p-4 flex items-center justify-between gap-2.5`): Search input on the left (`flex-1 min-w-0`), Sort dropdown (`CustomSelect`) on the right (`shrink-0`), reducing toolbar height by 50% to ~$55px.
  - High-contrast alternating zebra striping (`rgb(12, 19, 34)` vs `rgb(20, 31, 54)` in dark mode).

- **Mobile Status Filter Dropdown Integration into Orders Toolbar (`Orders.svelte`)**:
  - Integrated the mobile status filter dropdown directly into the table header toolbar side-by-side with the search input on the exact same row (`isInlineOnSameRow: true`).
  - Preserved animated `SegmentedTabs` above the card on desktop viewports ($\ge 768\text{px}$).

- **Global Bespoke Vertical & Horizontal Scrollbar Design (`public/css/appcenter-theme.css`)**:
  - 7px precision scrollbars with pill-rounded thumb (`rounded-full`), transparent track (`background: transparent`), inset floating effect (`background-clip: padding-box`), and adaptive dual-theme color tokens (Light: Slate-400 / Slate-500, Dark: Slate-400 at 22% / 48% with Brand Blue active feedback).
  - Ultra-thin 4px scrollbar utility (`.custom-scrollbar-thin`) for dropdowns and compact modals.

### 2. Browser Automation Verification:
- 100% verified via automated headless Chrome CDP across Desktop ($1280\times800$) and Mobile ($390\times844$, $400\times520$) viewports.
- All temporary testing scripts purged (*zero storage footprint*).

### 3. Files Modified:
- `client/src/lib/pages/MemberInvoices.svelte`
- `client/src/lib/pages/Orders.svelte`
- `public/css/appcenter-theme.css`
- `docs/superpowers/specs/2026-09-16-member-invoices-and-orders-compact-toolbar.md`
- `docs/superpowers/plans/2026-09-16-member-invoices-mobile-and-ux-elevation.md`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 127 — 2026-09-16 (Member Licenses & Devices Mobile Ergonomics, Zero-Scroll Mobile Cards, Single-Row Compact Toolbar & High-Contrast Zebra Striping)

### 1. Major Functional & Visual Enhancements:
- **Member Licenses & Devices Mobile Cards (`Licenses.svelte`)**:
  - Replaced wide horizontally-scrolling table on mobile (`< md`) with dedicated zero-scroll mobile cards.
  - Rendered complete card content: Product Icon/Avatar, Name, Duration badge, Tutorial link with play icon, pulsating status badge (Aktif, Siap Pakai, Kadaluarsa), Monospace Serial Key box with 1-touch copy button and instant visual feedback ("Disalin!"), Machine ID (HWID) box with copy and edit modal trigger button, and "Unduh" installer button.
- **Single-Row Compact Header Toolbar**:
  - Desktop ($\ge \text{md}$): Retained `SegmentedTabs` status filter with sliding pill animation and page size selector.
  - Mobile ($< \text{md}$): Integrated flexible search input side-by-side with a fitted, right-aligned status filter `CustomSelect` dropdown.
- **High-Contrast Alternating Zebra Striping**:
  - Odd cards/rows: `bg-[var(--surface)] dark:bg-[#0c1322]` (`rgb(12, 19, 34)`).
  - Even cards/rows: `bg-slate-100/70 dark:bg-[#141f36]` (`rgb(20, 31, 54)`).
- **Responsive Pagination & Nodemon Configuration**:
  - Standardized compact responsive pagination toolbar.
  - Added `nodemon.json` to isolate server watch path to `src/` and ignore temporary test directories.

### 2. Browser Automation Verification:
- 100% verified via automated headless Chrome CDP across Desktop ($1280\times800$) and Mobile ($390\times844$) viewports.
- Confirmed zero horizontal scrolling, 10 mobile cards, zebra striping colors, copy key feedback, HWID edit modal trigger, and installer download popup modal trigger.
- All temporary testing scripts in `scratch/` and temporary profiles purged (*zero storage footprint*).

### 3. Files Modified:
- `client/src/lib/pages/Licenses.svelte`
- `nodemon.json`
- `docs/superpowers/specs/2026-09-16-member-licenses-mobile-and-ux-elevation.md`
- `docs/superpowers/plans/2026-09-16-member-licenses-mobile-and-ux-elevation.md`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 128 — 2026-09-16 (Member Header Action Button Right-Alignment on Mobile Viewports)

### 1. Major Functional & Visual Enhancements:
- **Right-Aligned Header CTA on Mobile (`Licenses.svelte` & `Orders.svelte`)**:
  - Updated the "+ Beli Lisensi Baru" button in `Licenses.svelte` and "+ Order Software Baru" in `Orders.svelte` to include `self-end md:self-auto`.
  - On mobile viewports ($< \text{md}$ / $< 768\text{px}$), the action button now sits cleanly aligned to the right edge rather than floating on the left.

### 2. Browser Automation Verification:
- Verified via automated headless Chrome CDP at 390px viewport width:
  - Confirmed `isAlignedRight: true` (`parentRight - buttonRight < 40px`).
  - Temporary testing artifacts purged (*zero storage footprint*).

### 3. Files Modified:
- `client/src/lib/pages/Licenses.svelte`
- `client/src/lib/pages/Orders.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 129 — 2026-09-16 (Member Licenses Mobile Cards Raycast-Style Elevation — /ui-ux-pro-max)

### 1. Major Functional & Visual Enhancements:
- **Raycast-Style Mobile Card Architecture (`Licenses.svelte`)**:
  - Re-engineered the mobile card layout from a bulky generic form look to a high-density, professional Swiss/Linear design.
  - **Header Area**: Integrated product name (`h3`), duration pill, and remaining time / activation status subtitle inline next to the 40x40px avatar icon, paired with live pulsating status pills on the top right.
  - **Serial Key Strip**: Monospace key container (`p-2 px-3 rounded-xl bg-slate-100/70 dark:bg-[#070d19]`) with embedded key icon and discrete 1-touch copy pill button ("Salin" / "Disalin!").
  - **Bottom HWID & Actions Toolbar**: Compact HWID status strip with green status dot and quick edit pencil button (or subtle dashed "+ Ikat HWID" button when unassigned), alongside side-by-side "Tutorial" and "Unduh" action buttons.

### 2. Browser Automation Verification:
- 100% verified via automated headless Chrome CDP at 390px mobile viewport:
  - Verified card hierarchy, title, key preview, copy button, HWID box, and download action button.
  - Temporary testing scripts purged (*zero storage footprint*).

### 3. Files Modified:
- `client/src/lib/pages/Licenses.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 130 — 2026-09-16 (Member Video Tutorials Mobile & UI/UX Elevation — /ui-ux-pro-max)

### 1. Major Functional & Visual Enhancements:
- **Catalog Grid Overview (`#/member/tutorials`)**:
  - **Single-Row Mobile Toolbar**: Integrated search input (`input[type="text"]`) and `CustomSelect` status filter dropdown on mobile (`block md:hidden`) for compact single-row ergonomics ("Semua Software", "Tersedia Video Panduan", "Belum Ada Video").
  - **Raycast-Style High-Density Cards**: Redesigned software cards with 44x44 icon, pulsing green video status badge (`• 5 Video Panduan`), two-line summary, chapter count, and high-contrast tactile action button `Buka Materi →`.
- **Product Tutorial Detail View (`#/member/tutorials/:id`)**:
  - **Top Navigation Bar**: Ramping single-row header with back arrow button ("← Katalog"), small app icon, title, and video counter badge.
  - **Video-First Sticky / Immediate Player**: Top-anchored 16:9 YouTube player directly visible without excessive scrolling.
  - **Unified Media Controller Strip**: Directly below player, unified "Bab X dari Y" indicator, mini animated progress bar, and instant Previous / Next navigation buttons.
  - **Mobile Segmented Tabs**: Introduced interactive two-tab switcher on mobile (`block lg:hidden`):
    1. **Daftar Bab & Playlist ({N})**: Searchable chapter playlist with active blue highlight (`bg-blue-600`), playing icon (`▶`), and 1-tap chapter jump.
    2. **Detail & Download**: Comprehensive lesson summary, official HD tags, and direct shortcut link to Download Hub installer files.
  - **Desktop Preservation**: Retained full 12-column split layout (8 cols player + 4 cols chapter playlist sidebar) on desktop viewports (`lg:grid-cols-12`).

### 2. Browser Automation Verification:
- 100% verified via automated headless Chrome CDP at 390px mobile viewport & 1280px desktop viewport:
  - Verified catalog single-row toolbar, search filtering, CustomSelect dropdown, and pulse dot badges.
  - Verified detail video player, media controller strip, tab switcher, chapter switching, and empty state.
  - Temporary testing scripts purged (*zero storage footprint*).

### 3. Files Modified:
- `client/src/lib/pages/Tutorials.svelte`
- `docs/superpowers/specs/2026-09-16-member-tutorials-mobile-and-ux-elevation.md`
- `docs/superpowers/plans/2026-09-16-member-tutorials-mobile-and-ux-elevation.md`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 131 — 2026-09-16 (Member Tutorials Sliding Pill Tab Animations — /ui-ux-pro-max)

### 1. Major Functional & Visual Enhancements:
- **Mobile Segmented Tabs Sliding Pill (`Tutorials.svelte`)**:
  - Implemented smooth Framer Motion-style physics sliding pill animation for the mobile segmented tab switcher (`[ Daftar Bab (5) ]` vs `[ Detail & Download ]`).
  - Powered by absolute-positioned container with GPU-accelerated `transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]` and active text color transitions.
- **Desktop Catalog Segmented Tabs (`Tutorials.svelte`)**:
  - Upgraded desktop catalog status filters ("Semua Software", "Tersedia Video Panduan", "Belum Ada Video") to use the unified `SegmentedTabs` component with synchronized sliding pill indicator.

### 2. Browser Automation Verification:
- 100% verified via automated headless Chrome CDP at 390px mobile viewport:
  - Verified sliding pill transform matrix (`matrix(1, 0, 0, 1, 0, 0)` -> `matrix(1, 0, 0, 1, 174, 0)` -> `matrix(1, 0, 0, 1, 0, 0)`).
  - Verified smooth animation without layout shift or UI flickering.
  - Temporary testing scripts purged (*zero storage footprint*).

### 3. Files Modified:
- `client/src/lib/pages/Tutorials.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 132 — 2026-09-16 (Member Download Hub Mobile & UI/UX Elevation Review — /writing-plans /ui-ux-pro-max /browser-skill)

### 1. Analysis & Architectural Blueprint:
- **Module Audited**: Member Download Hub (`#/member/downloads` / `Downloads.svelte`).
- **UI/UX Audit via Headless Browser**:
  - Identified bulky two-row mobile header with raw horizontal scrolling filter chips taking ~110px vertical space.
  - Identified vertical sprawl in software cards (~300px per card) caused by dual full-width buttons ("Unduh Installer" and "Buka Video Panduan").
  - Identified static, un-animated OS selector tabs inside the Download Installer Pop-up Modal (`#showDownloadModal`).
- **Superpowers Architectural Specification & Plan**:
  - Authored `docs/superpowers/specs/2026-09-16-member-downloads-mobile-and-ux-elevation.md`.
  - Authored `docs/superpowers/plans/2026-09-16-member-downloads-mobile-and-ux-elevation.md`.
  - Defined Single-Row Compact Mobile Toolbar (`< 768px`) with flex-1 search + `CustomSelect` dropdown.
  - Defined Raycast-Style High-Density Software Cards with pulsating live status dots (`• N File Installer`) and compact ergonomic action bars.
  - Defined 3-way sliding pill physics tab switcher for Download Installer Modal (`Semua Platform`, `Windows`, `macOS`).

### 2. Files Modified / Created:
- `docs/superpowers/specs/2026-09-16-member-downloads-mobile-and-ux-elevation.md`
- `docs/superpowers/plans/2026-09-16-member-downloads-mobile-and-ux-elevation.md`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 133 — 2026-09-16 (Member Download Hub Mobile & UI/UX Elevation Implementation — /ui-ux-pro-max /browser-skill)

### 1. Major Functional & Visual Enhancements:
- **Mobile Header & Compact Single-Row Toolbar (`Downloads.svelte`)**:
  - Replaced bulky two-row search and raw horizontal scrolling button bar with a unified single-row container (`p-2.5 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-2 shadow-2xs`).
  - Search input on left (`flex-1 min-w-0 relative`) with embedded magnifying glass SVG and clear button (`x`).
  - Fitted `CustomSelect` dropdown on right with reactive count indicators ("Semua Software", "Windows", "macOS", "Ada Tutorial").
- **Desktop Header & Segmented Tabs (`Downloads.svelte`)**:
  - Split header layout with title/subtitle on left and search box on right.
  - Implemented `SegmentedTabs` component with Framer Motion-style physics sliding pill animation for category and OS filtering.
- **Raycast-Style High-Density Software Cards**:
  - Re-architected software cards into compact `rounded-2xl` containers with 44x44px icon / letter avatar, truncated titles, category badge, and OS badges (`Win`, `Mac`).
  - Live pulsating status badge: Emerald dot (`• N File Tersedia`) for ready downloads vs amber badge (`Belum Ada File`).
  - Tactile, space-efficient action bar: Primary blue `Unduh (N)` button side-by-side with purple `Panduan (N)` video tutorial link.
- **Elevated Download Installer Pop-up Modal**:
  - Replaced static OS tab buttons with 3-segment sliding pill switcher (`[ Semua ]`, `[ Win ]`, `[ Mac ]`) featuring smooth GPU-accelerated cubic-bezier animation (`ease-[cubic-bezier(0.16,1,0.3,1)]`).
  - Refined file item rows with official OS logo container, monospace uppercase extension badges (`EXE`, `DMG`, `ZIP`, `PKG`, `APP`), monospace file size indicator (`85.40 MB`), and direct "Unduh" button.
  - Footer with quick-link to video tutorial `#/member/tutorials/:id`.

### 2. Browser Automation Verification:
- 100% verified via automated headless Chrome CDP across Mobile ($390\times844$) and Desktop ($1280\times800$) viewports:
  - Verified mobile single-row toolbar, search debounce, clear button, and dropdown selection.
  - Verified Raycast card layout, pulse dots, and responsive button layout.
  - Verified modal open/close, 3-way sliding pill animation across all platforms, and filtered file list rendering.
  - Temporary testing scripts purged (*zero storage footprint*).

### 3. Files Modified:
- `client/src/lib/pages/Downloads.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 134 — 2026-09-16 (Crisp Vector Icon Standardization & Apple Logo Fix — /ui-ux-pro-max /browser-skill)

### 1. Vector Icon Fixes:
- **Apple macOS Icon Standardization (`Downloads.svelte` & `AdminProducts.svelte`)**:
  - Replaced legacy distorted/stretched `170x170` Apple SVG path where the leaf was disconnected and the apple silhouette was distorted at small dimensions with the official, pixel-perfect 24x24 Simple Icons vector path.
  - Standardized the Windows logo SVG to the crisp 24x24 vector path for uniform visual weights and 1:1 square geometry across both OS platforms.
- **Installer Modal File Badge Visual Refinement**:
  - Adjusted the macOS file card icon container to `bg-slate-500/10 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600` so that it renders with optimal contrast and aesthetic hierarchy in both Light and Dark themes.

### 2. Browser Verification:
- Inspected the installer modal with `bsk` across all tabs and verified crisp, clear rendering of the Apple logo on the platform switcher tab, product card badges, and installer file list item.

### 3. Files Modified:
- `client/src/lib/pages/Downloads.svelte`
- `client/src/lib/pages/AdminProducts.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 135 — 2026-09-16 (Member Create Order Page Modernization & Mobile Ergonomics — /ui-ux-pro-max /browser-skill)

### 1. Major Functional & UI/UX Enhancements:
- **Modern Page Header & Navigation (`ProductDetail.svelte`)**:
  - Replaced legacy text breadcrumb with an elevated page header containing `✨ ORDER SOFTWARE & LISENSI RESMI` badge, bold H1 `Buat Pesanan Baru`, descriptive subtitle, and quick-navigation button `← Lihat Pesanan Saya` (`#/member/orders`).
- **Eliminated Bulky Visual Orbit Grid & Implemented 2-Column Responsive Architecture**:
  - Replaced legacy 440px empty glassmorphic orbit box with an asymmetric 2-column layout on desktop (7/5 grid) and frictionless vertical flow on mobile ($390\times844$).
- **Enhanced Product Identity & Configurator (Left Column)**:
  - Software selector using `CustomDropdown` with live search, item icons, and user badges.
  - Selected product card with 48px avatar, category badge, live pulsing user dot (`• 1.2k+ Pengguna Aktif`), and description.
  - Visual bundle package software breakdown list with verified license checkmarks.
  - Duration selector with fluid percentage-based sliding pill tabs (`transform: translateX(0% | 100% | 200%)`).
  - Interactive voucher input with live validation, discount badge, and one-click cancel/remove button (`✕`).
  - Guarantee & security feature list.
- **Sticky Checkout & Transparent Price Breakdown (Right Column)**:
  - Transparent itemized cost breakdown (Harga Satuan, Diskon Produk, Durasi, Potongan Kupon, Total Hemat).
  - Prominent total price display with savings percentage badge.
  - Large tactile checkout CTA with loading spinner and distinct free/paid iconography.
  - Trust specs (Aktivasi Instan, Machine ID Bound, Video Tutorial quick-link).

### 2. Browser Verification:
- 100% verified via automated Chrome CDP testing across Desktop ($1280\times800$) and Mobile ($390\times844$ iPhone 14):
  - Verified responsive layout, product selection, fluid sliding pill duration switching (`2 Bulan | 4 Bulan | 6 Bulan`), coupon validation & removal, and mobile one-thumb checkout.
  - Temporary testing scripts purged (*zero storage footprint*).

### 3. Files Modified:
- `client/src/lib/pages/ProductDetail.svelte`
- `docs/superpowers/specs/2026-09-16-member-order-create-modernization.md`
- `docs/superpowers/plans/2026-09-16-member-order-create-modernization.md`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 136 — 2026-09-16 (Pro-Grade Order Configurator Refinement — /ui-ux-pro-max /browser-skill)

### 1. Stripping AI Tropes & Enhancing Native SaaS Craftsmanship:
- **Clean Professional Typography & Hierarchy**:
  - Removed emoji clutter (`✨`, `📦`) and cheesy marketing pills.
  - Replaced with authoritative page title `Pemesanan Lisensi Software`, clean context navigation `← Kembali ke Pesanan Saya`, and a subtle `Aktivasi Instan` green indicator.
- **Eliminated Redundant Card Nesting**:
  - Unified the product selector with a streamlined metadata strip (compact 44px logo avatar, product title, category tag, and concise description) instead of repeating duplicate boxes on top of each other.
- **Streamlined 3-Step Configuration Flow**:
  - `1. Pilih Software` (integrated dropdown + product preview)
  - `2. Pilih Masa Aktif Lisensi` (smooth percentage sliding pill with standard, popular, and value labels)
  - `3. Kupon Promo (Opsional)` (clean monospace input with direct removal button)
- **Digital Receipt-Style Checkout Card**:
  - Styled right column as an authentic billing summary receipt with monospace breakdown lines (Software, Durasi, Harga Satuan, Diskon Produk, Kupon Promo).
  - High-contrast tactile action button (`Buat Pesanan & Bayar →` / `Klaim Lisensi Gratis`).
  - Replaced generic 2x2 grid boxes with clean single-line trust checkmarks.

### 2. Browser Verification:
- Verified clean compilation with `pnpm run build` (0 errors).
- Verified in headless Chrome across Desktop ($1280\times800$) and Mobile ($390\times844$), testing coupon application, removal (`✕`), 4-month duration calculation ($Rp 517.400$), and smooth responsive layout.

### 3. Files Modified:
- `client/src/lib/pages/ProductDetail.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 137 — 2026-09-16 (Eliminated Duplicate Product Cards & Unified Desktop Order Configurator — /ui-ux-pro-max /browser-skill)

### 1. UX Fixes & Visual De-duplication (`ProductDetail.svelte`):
- **Removed Duplicate Product Identity Rows**:
  - Eliminated the redundant product icon, title, and badge strip that was displayed immediately below the already-populated `CustomDropdown` trigger.
  - Replaced it with a clean, understated "Deskripsi Software" information strip that contextualizes the software's capabilities without repeating the logo/title twice.
- **Unified Left Column Architecture**:
  - Consolidated the detached floating cards (`1. Pilih Software`, `2. Pilih Durasi`, `3. Kupon`) into one solid, seamless container with subtle border-t dividers.

### 2. Browser Verification:
- Verified in headless Chrome across Desktop ($1280\times800$) and Mobile ($390\times844$).
- Verified zero duplication, crisp typography, and full alignment with the rest of the Member Portal design language.

### 3. Files Modified:
- `client/src/lib/pages/ProductDetail.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 138 — 2026-09-16 (Aligned Member Order Creation Page Container Padding & Layout — /ui-ux-pro-max /browser-skill)

### 1. Layout & Padding Standardization (`ProductDetail.svelte`):
- **Container Padding Alignment with Download Hub**:
  - Replaced the tight container `<main class="w-full max-w-6xl mx-auto space-y-5 pb-12">` with the standardized Member Portal wrapper `<main class="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-12">`, matching `Downloads.svelte`, `Orders.svelte`, and `Tutorials.svelte`.
  - Added `activePage="create-order"` and `eyebrow="PEMESANAN SOFTWARE & LISENSI"` on `<Layout>` to properly bind navigation state to the active "Order Baru" sidebar item.
- **Visual Balance & Spacing**:
  - Restored breathing space between the top navbar, left sidebar, and the 2-column order configurator card on desktop viewports.

### 2. Browser Verification:
- Verified in browser with `browser-skill` across Desktop ($1440\times900$) and Mobile ($490\times543$).
- Verified zero layout clipping or horizontal overflow. Verified clean build with `pnpm run build` (0 compile errors).

### 3. Files Modified:
- `client/src/lib/pages/ProductDetail.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 139 — 2026-09-16 (Modernized Member Profile Page & Unified Security Form — /ui-ux-pro-max /browser-skill)

### 1. UI/UX Modernization & Redesign (`Profile.svelte`):
- **Unified Identity Header Card**:
  - Refined avatar with status ring and emerald verification badge.
  - Added clean member metadata ("Member Aktif", verified email, joined date).
  - Consolidated order and license metrics into a single balanced stat capsule.
- **Sliding Pill Tab Switcher (`[ 👤 Informasi Profil | 🔒 Keamanan & Password ]`)**:
  - Implemented percentage-based animated pill slider with GPU-accelerated cubic-bezier physics.
  - Solved height asymmetry on desktop and eliminated long vertical scroll fatigue on mobile.
- **Ergonomic Form Inputs with Contextual Icons**:
  - Added clean prefix icons for Name (User), Email (Lock), WhatsApp (Phone), Company (Building), and Password (Lock/Key).
  - Unified all buttons and accents to standard brand primary token (`blue-600`).
- **Live Password Validation & Match Confirmation**:
  - Added real-time character count and requirement checklist.
  - Added live matching indicator badges ("✔ Cocok" / "✕ Tidak Cocok").
  - Added password security guide helper card.

### 2. Browser Verification:
- Verified in browser with `browser-skill` across Desktop ($1440\times900$) and Mobile ($490\times543$).
- Verified smooth tab switching, live password validation, and zero horizontal overflow. Verified clean build with `pnpm run build` (0 compile errors).

### 3. Files Modified:
- `client/src/lib/pages/Profile.svelte`
- `docs/superpowers/specs/2026-09-16-member-profile-modernization.md`
- `docs/superpowers/plans/2026-09-16-member-profile-modernization.md`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 140 — 2026-09-16 (Modernized Member Affiliate Portal & Payouts Log — /ui-ux-pro-max /browser-skill)

### 1. UI/UX Modernization & Redesign (`Affiliate.svelte` & `AffiliatePayouts.svelte`):
- **Layout & Container Uniformity**:
  - Re-engineered main wrapper padding to standardized token: `flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-12`.
- **Hero Identity & 4-Stat Cards Grid**:
  - Added gradient hero banner with icon badge and direct button to Payout History.
  - Card 1 (Kode Kupon): Prominent monospace font, 1-click clipboard copy button, discount and commission badges.
  - Card 2 (Komisi Belum Cair): Pulsing amber status indicator and automatic transfer schedule note.
  - Card 3 (Total Komisi Diterima): Bold emerald typography with cumulative transaction count.
  - Card 4 (Rekening Pencairan): Bank name, account number in monospace, account holder name, and quick setup/edit modal trigger.
- **Zebra Striped Tables & Mobile Cards**:
  - Desktop view: Responsive table with sortable columns, active sort chevrons, alternating subtle zebra rows (`even:bg-[var(--surface-2)]/40 dark:even:bg-[#131d31]/50`), and formatted IDR currency.
  - Mobile view: Distinct card layout with alternating background tints (`even:bg-[var(--surface-2)] dark:even:bg-[#131d31] odd:bg-[var(--surface)] dark:odd:bg-[#101827]`), product badge, date, customer name, commission amount, and rounded status badges (`Cair` / `Pending`).
- **Interactive Modals**:
  - Modal backdrops with `bg-black/70 backdrop-blur-xs`, icon-prefixed inputs, real-time regex account number validation per bank, and uppercase custom coupon configuration.

### 2. Browser Verification:
- Verified end-to-end in browser via `browser-skill` across Desktop ($1440\times900$) and Mobile ($490\times543$).
- Verified modal open/close, 1-click clipboard copy toasts, sort toggles, page size dropdowns, and responsive alignment.
- Verified build succeeds with `pnpm run build` (0 errors).

### 3. Files Modified:
- `client/src/lib/pages/Affiliate.svelte`
- `client/src/lib/pages/AffiliatePayouts.svelte`
- `docs/superpowers/specs/2026-09-16-affiliate-portal-modernization.md`
- `docs/superpowers/plans/2026-09-16-affiliate-portal-modernization.md`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Snapshot 141 — 2026-09-16 (Fixed CustomSelect Dropdown Clipping & Upward Threshold Across Tables — /browser-skill)

### 1. Masalah & Solusi
- **Masalah**:
  1. Pada halaman Mitra Afiliasi (`Affiliate.svelte`), dropdown "Tampilkan: 10" (`CustomSelect`) terpotong/tersembunyi saat dibuka karena container card tabel memiliki class `overflow-hidden`. Ketika dropdown membuka ke atas (`openUpward`), menu terpotong batas atas container.
  2. Logika `openUpward` di `CustomSelect.svelte` menggunakan threshold hardcoded (`spaceBelow < 260px`) yang terlalu besar untuk menu berukuran ringkas (~120px untuk 3 opsi), sehingga dropdown sering kali dipaksa membuka ke atas padahal ruang ke bawah masih sangat lapang.
- **Solusi**:
  - Di `CustomSelect.svelte`: Menyesuaikan threshold `openUpward` berbasis estimasi tinggi menu dinamis (`estimatedMenuHeight = Math.min(220, options.length * 38 + 20)`), sehingga menu hanya membuka ke atas saat ruang bawah benar-benar sempit.
  - Pada card tabel (`Affiliate.svelte`, `AffiliatePayouts.svelte`, `Orders.svelte`, `Licenses.svelte`, `MemberInvoices.svelte`): Menghilangkan `overflow-hidden` dari wrapper terluar, menambahkan `rounded-t-2xl` pada header filter bar dan `rounded-b-2xl` pada footer paginasi, serta menetapkan `relative z-20` agar menu dropdown bebas melayang di atas baris tabel tanpa risiko terpotong tepi container.

### 2. Browser Verification
- Terverifikasi langsung di browser melalui `browser-skill` pada mode Desktop ($1440\times900$) dan Mobile ($490\times543$). Menu dropdown "Tampilkan: 10" muncul sempurna mengambang di atas tabel dengan animasi smooth dan kontras jelas.
- `pnpm run build` sukses dengan 0 error.

### 3. Files Modified:
- `client/src/lib/components/CustomSelect.svelte`
- `client/src/lib/pages/Affiliate.svelte`
- `client/src/lib/pages/AffiliatePayouts.svelte`
- `client/src/lib/pages/Orders.svelte`
- `client/src/lib/pages/Licenses.svelte`
- `client/src/lib/pages/MemberInvoices.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`













