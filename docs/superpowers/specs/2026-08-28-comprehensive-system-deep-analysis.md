# Design Specification: Comprehensive System Deep Analysis (Technical & Non-Technical)

**Date**: 2026-08-28  
**Scope**: AppCenter V2 Ecosystem  
**Author**: Principal Software Architect & Product Strategist  

---

## 1. Executive Summary & Non-Technical Analysis

### 1.1 Business Model & Value Proposition
AppCenter V2 beroperasi sebagai platform terpadu distribusi perangkat lunak (Desktop Windows/macOS Software Suite), sistem lisensi otomatis (HWID Lock & License Engine), gateway pembayaran instan (Xendit & Free Claim), serta jaringan kemitraan afiliasi (Affiliate Marketing Hub).

- **Target Pasar**: Pengguna digital desktop automation, digital marketers, UMKM, dan agensi yang membutuhkan alat bantu otomatisasi tanpa proses registrasi lisensi manual yang rumit.
- **Strategi Monetisasi**:
  1. **Direct Purchase**: Penjualan software berlisensi dengan model pembayaran sekali bayar (one-time) atau berbasis durasi (bulanan, tahunan, lifetime).
  2. **Free Tools & Freemium Onboarding**: Distribusi produk berharga Rp 0 untuk mengakuisisi pengguna terdaftar (`user` table) yang kemudian dapat dikonversi menjadi pembeli produk premium.
  3. **Affiliate Distribution Engine**: Skema bagi hasil komisi otomatis di mana mitra mendapatkan kupon unik untuk membagikan diskon ke pembeli sekaligus menghasilkan komisi pasif berjenjang.

### 1.2 User Journey & Funnel Conversion
1. **Pemberian Uji Coba (Trial Funnel)**:
   - Admin membuat token trial berdurasi fleksibel (15 Menit s/d 1 Tahun).
   - Admin menyalin template chat WhatsApp ramah & formal untuk dikirimkan langsung ke calon pembeli.
   - Calon pembeli mengunduh software dari Download Hub publik / member area dan memasukkan token trial ke aplikasi desktop.
   - Aplikasi desktop melakukan handshake ke `/device/activation`, mengunci HWID mesin, dan memulai masa aktif trial.
2. **Pembelian & Aktivasi Lisensi**:
   - Pengguna mendaftar akun di portal Member.
   - Pengguna memilih produk di katalog, memasukkan kupon diskon (jika ada), dan memilih checkout via Xendit atau Klaim Gratis (jika Rp 0).
   - Pasca pembayaran sukses (atau klaim instan), sistem membuat token lisensi di `token_device_activation`.
   - Pengguna memasukkan token serial key di aplikasi desktop. Backend mengikat mesin pertama ke tabel `device`.
3. **Purna Jual & Migrasi Perangkat**:
   - Jika pengguna mengganti PC/laptop, pengguna dapat memasukkan kembali token yang sama di aplikasi software pada mesin baru untuk melakukan transfer otorisasi HWID secara mandiri.
   - Pengguna memantau masa aktif, mengunduh installer terbaru, dan menonton panduan video di Tutorial Hub.

---

## 2. Technical Architecture & System Engineering

### 2.1 Backend Architecture (Express 5 + TypeScript + Prisma 6)
- **Single-Port Architecture (Port 4829)**: Menyatukan penyajian Static Client Bundle Svelte SPA (`client/dist` dan `dist/client_dist`), Public Downloads, REST JSON API (`/member/api/*`, `/admin/api/*`), Webhook Payloads (`/payment/success`), dan Legacy Desktop Client Communication (`/device/*`).
- **Database Connection Management**:
  - MySQL Connection Pool secara ketat dibatasi maksimal `5` koneksi simultan baik di Prisma Client (`DATABASE_URL=...?connection_limit=5`) maupun `express-mysql-session` (`connectionLimit: 5` di `src/app.ts`).
  - Mencegah socket starvation dan bottleneck memori pada instance VPS MySQL tunggal.
- **Keamanan & Rate Limiting**:
  - `AdminRateLimiter`: Enforcing batas 3 kali kegagalan PIN dengan eskalasi durasi penguncian berbasis IP (3m -> 5m -> 10m -> 15m).
  - PIN Keamanan Admin 6-Digit permanen default dev: `085213`.
  - Immutable User Email: Email member terkunci permanen pasca registrasi demi konsistensi lisensi dan audit log pembayaran.
  - Xendit Webhook Idempotency: Pemeriksaan kondisi atomik `status: { not: 'Order has been complete' }` mencegah aktivasi lisensi ganda saat terjadi transmisi webhook berulang.

### 2.2 Frontend SPA Architecture (Svelte 4 + Tailwind CSS 4 + Svelte-SPA-Router)
- **Hash-Routing Navigation**: Menggunakan `#/member/...` dan `#/admin/...` dengan pemisahan auth guard mandiri (`requireMemberAuth`, `requireAdminAuth`).
- **Design Tokens & Dual-Theme System**:
  - Variabel CSS terpadu pada `public/css/appcenter-theme.css` (`--bg`, `--surface`, `--surface-2`, `--border`, `--brand`, `--text`, `--text-2`, `--text-3`).
  - Transisi Framer-Motion style sliding pills pada `SegmentedTabs.svelte`, `CustomSelect.svelte`, `CustomDropdown.svelte`, dan `Sidebar.svelte`.
  - Komponen Svelte kustom bebas native HTML `<select>` dan native checkbox.
- **Server-Side Driven Pagination & Filtering**:
  - Seluruh tabel utama admin (`AdminUsers`, `AdminPayments`, `AdminProducts`, `AdminCategories`, `AdminAffiliate`, `AdminAffiliateHistory`) dan member (`Orders`, `Licenses`) beroperasi 100% Server-Side First dengan debounce pencarian 300ms dan lifecycle cleanup (`onDestroy`) untuk mencegah memory leaks.

### 2.3 Storage & Cloud File Management
- **SFTP Chunked Upload Engine**:
  - Mengunggah berkas installer produk multi-OS (Windows `.exe` / `.zip`, macOS `.dmg` / `.pkg`) langsung ke remote storage server `127.0.0.1:22` (target directory `/var/www/html/setup-windows-bin/x86`, domain `download.ziqva.com`).
  - Pemrosesan chunk 5MB dengan sequential stream piping dan pembersihan otomatis folder chunk orphan.
- **Database Backup Engine (Raw SQL Streaming)**:
  - Ekspor skema & data MySQL dalam format Raw SQL murni (`.sql`) tanpa kompresi gzip untuk mencegah korupsi arsip.
  - Kompatibel dengan VPS Linux (deteksi otomatis `mysqldump` / fallback pure TypeScript stream).
  - Verifikasi integritas hash SHA-256 dan audit log download.

---

## 3. Data Model Matrix & Relationships

| Model / Table | Primary Responsibility | Key Fields & Constraints |
| :--- | :--- | :--- |
| `products` | Katalog software aplikasi | `id`, `name`, `price` (Rp 0 s/d N), `category_id`, `tutorials` (JSON), `installer_files` (JSON multi-OS), `is_active` |
| `categories` | Taksonomi & pengelompokan software | `id`, `name`, `slug` (unique), `icon`, `is_active` |
| `order_list` | Transaksi pemesanan & billing | `id`, `user` (email), `items` (JSON), `status`, `payment`, `total_amount`, `payment_request_id`, `paid_at` |
| `token_device_activation` | Serial key lisensi software | `id`, `token`, `order_id`, `duration` (menit/epoch), `product`, `user`, `taked` (0/1) |
| `device` | Mesin fisik terotorisasi (HWID Lock) | `id`, `order_id`, `email`, `machine_id` (HWID), `expired`, `product`, `duration`, `label` |
| `trial` | Kunci uji coba sementara | `id`, `token`, `product`, `user`, `machine_id`, `created`, `expired` |
| `affiliate_member` | Profil mitra afiliasi & rekening | `id`, `email`, `kupon`, `kupon_decrease_value`, `kupon_income_idr`, `payout_bank_name`, `payout_no_rek` |
| `affiliate_transaksi` | Log perolehan komisi dari pesanan | `id`, `affiliator_email`, `customer_email`, `product_name`, `affiliate_income`, `already_paid`, `invoice_code` |
| `affiliate_payouts` | Riwayat transfer pencairan komisi | `id`, `affiliate_email`, `amount`, `accepted_by`, `note`, `created` |
| `database_backups` | Log pencadangan & audit download DB | `id`, `filename`, `file_path`, `file_size`, `checksum_sha256`, `table_count`, `record_count`, `download_history` |
| `user` | Pengguna / Member platform | `id`, `email` (immutable), `password`, `name`, `whatsapp`, `company`, `verified`, `banned` |
| `admin` | Administrator platform | `id`, `username`, `pin` (6 digit), `role`, `ip` |

---

## 4. Invariants & Reliability Guarantees
1. **Branch Invariant**: Strictly `reborn`.
2. **Package Manager**: Strictly `pnpm`.
3. **Database Connection Pool**: Cap strictly at `5`.
4. **Admin Default PIN**: `085213`.
5. **Single Source of Truth**: `docs/CONTEXT_SNAPSHOT.yaml` dan `ZIQVA_STORE_ANALYSIS.md`.
6. **Zero Storage Footprint**: Seluruh direktori profil Chrome dan file temporer pengujian dibersihkan seketika.
