# Implementation Plan: Dashboard Full Feature Enhancements (Admin & Member Portal)

Pengembangan komprehensif untuk **Admin Dashboard** (`/#/admin/dashboard`) dan **Member Portal Dashboard** (`/#/dashboard`) untuk meningkatkan efisiensi operasional admin serta pengalaman retensi dan akses lisensi pengguna.

---

## 1. Arsitektur & Lingkup Perubahan

### A. Admin Dashboard (`AdminDashboard.svelte` & `adminController.ts`)
1. **Quick Action Dock (Pusat Aksi Cepat Admin)**:
   - Pintasan instan 1-klik untuk tugas operasional harian:
     - ⚡ *Buat Trial Cepat* (navigasi langsung ke `/#/admin/trial`)
     - 💳 *Verifikasi Pembayaran* (navigasi filter pending ke `/#/admin/payments`)
     - 📦 *Tambah Produk Baru* (buka modal tambah produk atau ke `/#/admin/products`)
     - 👥 *Kelola Afiliasi & Payout* (ke `/#/admin/affiliate-payouts`)
     - 📥 *Backup Data & Pengaturan* (ke `/#/admin/settings`)
2. **Actionable Health & Pending Alerts Widget**:
   - Banner status sistem real-time:
     - 🔔 *Tagihan Pending*: Jumlah transaksi masuk yang menunggu pembayaran/verifikasi manual.
     - ⏳ *Lisensi Segera Habis*: Jumlah lisensi yang akan expired dalam 7 hari ke depan.
     - 💸 *Antrean Payout Afiliasi*: Total komisi mitra yang belum dicairkan.
3. **Grafik Omzet Dinamis Interaktif**:
   - Selector periode grafik: **7 Hari**, **30 Hari**, **Bulan Ini**, **Tahun Ini**.
   - Indikator persentase pertumbuhan omzet (*growth % vs periode sebelumnya*).
4. **Expiring Licenses Watchlist & Top Affiliates Leaderboard**:
   - Tabel ringkas pelanggan yang masa aktifnya akan habis dalam 7 hari (memudahkan admin melakukan follow up renewal).
   - Top 5 Mitra Afiliasi bulan ini beserta status payout.

---

### B. Member Portal Dashboard (`Dashboard.svelte` & `memberController.ts`)
1. **My Active Software Hub (Pusat Software Aktif Saya)**:
   - Widget software aktif milik pelanggan langsung di atas katalog:
     - Nama software, ikon/thumbnail produk, durasi & status aktif.
     - Tombol 1-klik **Salin Token Lisensi** (dengan feedback toast).
     - Tombol **Unduh Aplikasi** (link installer terbaru).
2. **Pending Invoice Banner (Peringatan Tagihan Belum Dibayar)**:
   - Notifikasi mengambang jika member memiliki order pending:
     - Order ID, total tagihan, countdown waktu kedaluwarsa.
     - Tombol 1-klik **Bayar Sekarang / Buka QRIS**.
3. **Getting Started & Quick Activation Guide**:
   - Card panduan langkah awal aktivasi software dan link bantuan Customer Support.

---

## 2. Rincian Teknis & API Endpoint

### 1. Backend Admin (`src/controllers/adminController.ts`)
- Memperluas fungsi `getDashboardMetrics`:
  - Parameter query `period`: `'7d' | '30d' | 'this_month' | 'this_year'` (default `7d` / `this_month`).
  - Menghitung `growthPercent` (perbandingan omzet periode terpilih dengan periode sebelumnya).
  - Mengambil list `expiringLicenses` (lisensi dari `token_device_activation` yang `expires_at` berada di rentang sekarang s.d. sekarang + 7 hari).
  - Mengambil list `topAffiliates` (top 5 affiliator berdasarkan pendapatan bulan ini).
  - Mengembalikan `quickAlerts`: `{ pendingCount, expiringCount, unpaidPayoutCount, unpaidPayoutAmount }`.

### 2. Backend Member (`src/controllers/memberController.ts`)
- Memperluas endpoint `apiGetDashboard`:
  - Mengambil `activeLicenses`: lisensi aktif milik user (`token_device_activation` dengan `user === userEmail`, digabungkan dengan informasi produk, token, masa aktif, dan installer).
  - Mengambil `pendingInvoices`: order pending milik user (`order_list` dengan `user === userEmail`, `paid_at === null`, dan belum expired).

### 3. Frontend Admin (`client/src/lib/pages/AdminDashboard.svelte`)
- Implementasi Quick Action Dock dengan ikon SVG modern & tema gelap/terang adaptif.
- Widget Alert Cards dengan badge counter interaktif.
- Toolbar selector periode grafik omzet (`7 Hari`, `30 Hari`, `Bulan Ini`, `Tahun Ini`).
- Tab/Section Expiring Licenses & Top Affiliates.

### 4. Frontend Member (`client/src/lib/pages/Dashboard.svelte`)
- Implementasi Banner Pending Invoice jika terdapat tagihan aktif.
- Section "Software Aktif Saya" dengan kartu interaktif, copy button, dan download trigger.
- Quick Guide Card untuk kemudahan onboarding pengguna baru.

---

## 3. Rencana Pengujian & Verifikasi
1. **Kompilasi & Build**:
   - `npx tsc --noEmit` untuk validasi TypeScript backend dan frontend.
   - `pnpm run build:client` untuk memastikan bundle Vite terkompilasi bersih tanpa error.
2. **Browser Verification (`browser-skill`)**:
   - Verifikasi tampilan Admin Dashboard di resolusi Desktop (1440px) dan Split-screen (850px).
   - Verifikasi fungsionalitas tombol Quick Action, filter periode grafik, dan detail alert.
   - Verifikasi Member Dashboard pada tampilan Desktop dan Mobile untuk widget Lisensi Aktif dan Invoice Pending.
