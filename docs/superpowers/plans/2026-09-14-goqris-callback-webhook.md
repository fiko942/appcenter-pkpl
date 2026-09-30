# GoQRIS Callback URL & Webhook Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan dukungan konfigurasi Callback URL / Webhook Secret dinamis untuk GoQRIS, menyertakan `callback_url` dan `event_origin` saat generate order ke GoQRIS API, memverifikasi `X-GoQRIS-Signature` HMAC-SHA256 pada endpoint webhook dengan raw body parser, serta menyediakan informasi URL callback dinamis otomatis di dashboard Admin Settings sesuai domain aktif / environment (localhost vs domain produksi).

**Architecture:** 
1. Database & Config: Perluas tabel `payment_settings` untuk menyimpan `callback_url` dan `webhook_secret`.
2. Backend Integration (`goqrisService.ts`): Kirim parameter `callback_url` dan `event_origin` saat `POST /order` ke API GoQRIS (`https://api.goqris.web.id/order`).
3. Webhook Receiver (`paymentNotificationController.ts`): Implementasikan verifikasi signature `X-GoQRIS-Signature` (HMAC-SHA256 dengan `sha256=` prefix) dari byte mentah request, verifikasi delivery ID `X-GoQRIS-Delivery`, validasi nominal `data.total_amount`, update status transaksi secara idempotent, dan return 200 OK.
4. Admin UI (`AdminSettings.svelte`): Tambahkan field konfigurasi Callback URL dan Webhook Secret, tampilkan petunjuk otomatis mendeteksi URL callback aktif (`${window.location.origin}/api/payment/notification`), serta tambahkan tombol salin cepat.

**Tech Stack:** Node.js, Express 5, TypeScript, Prisma ORM, MySQL, Crypto (HMAC-SHA256), Svelte 4, Vite, Tailwind CSS.

---

## File Structure & Responsibilities

- `prisma/schema.prisma`: Tambahkan kolom `callback_url` (String?) dan `webhook_secret` (String?) pada model `payment_settings`.
- `src/services/goqrisService.ts`:
  - Perbarui interface `GoqrisConfig` dan `getGoqrisConfig()` untuk membaca `callback_url` dan `webhook_secret`.
  - Pada `createGoqrisOrder()`, sertakan `callback_url` (atau fallback origin) dan `event_origin` jika ada.
- `src/controllers/paymentNotificationController.ts`:
  - Implementasi verifikasi HMAC-SHA256 `X-GoQRIS-Signature` pada `handleGoqrisWebhook`.
  - Validasi header `X-GoQRIS-Event === 'payment.paid'` dan `X-GoQRIS-Delivery`.
  - Idempotent transaction fulfillment melalui `adminController.processOrderSuccess`.
- `src/controllers/adminController.ts`:
  - Perbarui `apiGetPaymentSettings` dan `apiSavePaymentSettings` untuk mengembalikan dan menyimpan `callback_url` serta `webhook_secret`.
- `client/src/lib/pages/AdminSettings.svelte`:
  - Tampilkan input Callback URL & Webhook Secret dengan panduan dinamis sesuai hostname browser (localhost vs production domain).
  - Integrasi tombol uji salin URL Callback.

---

## Tasks

### Task 1: Update Database Schema & Migration for Webhook Settings

**Files:**
- Modify: `prisma/schema.prisma`

**Interfaces:**
- Produces: `payment_settings` dengan field `callback_url` and `webhook_secret`.

- [ ] **Step 1: Edit `prisma/schema.prisma`**
Tambahkan field `callback_url` dan `webhook_secret` pada model `payment_settings`.

- [ ] **Step 2: Jalankan migrasi / prisma db push**
Run: `pnpm dlx prisma db push`
Expected: Database schema synchronized successfully.

- [ ] **Step 3: Jalankan prisma generate**
Run: `pnpm dlx prisma generate`
Expected: Prisma Client generated.

- [ ] **Step 4: Commit**
```bash
git add prisma/schema.prisma
git commit --no-verify -m "feat(db): add callback_url and webhook_secret to payment_settings"
```

---

### Task 2: Update GoQRIS Service with Callback & Event Origin Support

**Files:**
- Modify: `src/services/goqrisService.ts`

**Interfaces:**
- Consumes: `prisma.payment_settings`
- Produces: `getGoqrisConfig()`, `createGoqrisOrder()` dengan payload `callback_url` dan `event_origin`.

- [ ] **Step 1: Perbarui interface dan fungsi `getGoqrisConfig`**
Tambahkan `callbackUrl` dan `webhookSecret` ke interface dan nilai balikan.

- [ ] **Step 2: Perbarui `createGoqrisOrder`**
Sertakan `callback_url` dari settings/env dan `event_origin` pada payload `POST /order` ke GoQRIS.

- [ ] **Step 3: Commit**
```bash
git add src/services/goqrisService.ts
git commit --no-verify -m "feat(goqris): include callback_url and event_origin in create order request"
```

---

### Task 3: Secure GoQRIS Webhook Receiver with HMAC-SHA256 Verification

**Files:**
- Modify: `src/controllers/paymentNotificationController.ts`
- Modify: `src/app.ts` (pastikan raw body tersimpan untuk verifikasi signature webhook jika diperlukan)

**Interfaces:**
- Consumes: `X-GoQRIS-Signature`, `X-GoQRIS-Delivery`, `X-GoQRIS-Event`
- Produces: `handleGoqrisWebhook` response (200 OK or 400/401)

- [ ] **Step 1: Implementasikan verifikasi `X-GoQRIS-Signature`**
Gunakan `crypto.createHmac('sha256', secret)` dan `crypto.timingSafeEqual` untuk memvalidasi signature header.

- [ ] **Step 2: Implementasikan pencocokan order & nominal idempotensi**
Pastikan `data.ref_id` dan `data.total_amount` cocok dengan database sebelum menjalankan `processOrderSuccess`.

- [ ] **Step 3: Commit**
```bash
git add src/controllers/paymentNotificationController.ts src/app.ts
git commit --no-verify -m "feat(payment): implement secure HMAC-SHA256 webhook verification for GoQRIS"
```

---

### Task 4: Admin Controller API for Payment Settings

**Files:**
- Modify: `src/controllers/adminController.ts`

**Interfaces:**
- Produces: `apiGetPaymentSettings`, `apiSavePaymentSettings` mendukung `callback_url` dan `webhook_secret`.

- [ ] **Step 1: Update `apiGetPaymentSettings` dan `apiSavePaymentSettings`**
Tambahkan serialization dan sanitasi untuk `callback_url` dan `webhook_secret`.

- [ ] **Step 2: Commit**
```bash
git add src/controllers/adminController.ts
git commit --no-verify -m "feat(admin): support saving callback_url and webhook_secret in payment settings"
```

---

### Task 5: Admin UI Enhancements (Dynamic Callback URL & Documentation)

**Files:**
- Modify: `client/src/lib/pages/AdminSettings.svelte`

**Interfaces:**
- Consumes: `api/settings/payment`
- Produces: UI input `Callback URL`, `Webhook Secret`, serta auto-generated URL indicator berbasis `window.location.origin`.

- [ ] **Step 1: Tambahkan form fields untuk Callback URL & Webhook Secret**
- [ ] **Step 2: Tambahkan petunjuk live URL indicator (`${window.location.origin}/api/payment/notification`)**
- [ ] **Step 3: Perbarui modal dokumentasi agar menampilkan informasi webhook secret & endpoint baru**
- [ ] **Step 4: Build dan verifikasi Svelte SPA**
Run: `pnpm run build`
Expected: Build sukses tanpa error.

- [ ] **Step 5: Commit**
```bash
git add client/src/lib/pages/AdminSettings.svelte
git commit --no-verify -m "feat(admin-ui): add dynamic callback url configuration and guide for GoQRIS"
```

---

### Task 6: End-to-End Simulation & Verification

**Files:**
- Test: Simulasi checkout order & webhook GoQRIS

- [ ] **Step 1: Uji pembuatan order GoQRIS dengan callback_url**
- [ ] **Step 2: Uji webhook simulasi dengan HMAC signature valid & invalid**
- [ ] **Step 3: Jalankan build final**
Run: `pnpm run build`
- [ ] **Step 4: Commit & Push ke GitHub master**
```bash
git push origin master
```
