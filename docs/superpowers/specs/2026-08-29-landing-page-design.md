# Design Specification: Public Landing Page on Route `/`

## Overview
Membangun Public Landing Page berkonsep **Dark Glassmorphism Premium** pada rute `/` (`client/src/lib/pages/LandingPage.svelte`). Landing page ini berfungsi sebagai portal ekosistem utama untuk memperkenalkan platform AppCenter Ziqva, memamerkan katalog software bot & tools gratis (Rp 0), mempromosikan program kemitraan afiliasi, serta menyediakan akses cepat ke portal member dan admin.

---

## 1. Architectural & Routing Integration

- **Svelte SPA Component**: `client/src/lib/pages/LandingPage.svelte`
- **Route Registration (`client/src/App.svelte`)**:
  - Registered for route `/` and `/welcome`.
  - **Smart Hybrid Routing**:
    - Saat pengunjung publik (guest) membuka `/`, sistem merender `LandingPage.svelte`.
    - Saat member/admin yang sudah terotentikasi membuka `/` tanpa parameter preview, sistem secara otomatis mengarahkan ke dashboard masing-masing (`#/member/dashboard` atau `#/admin/dashboard`).
    - Jika pengguna terotentikasi membuka `/#/welcome` atau `/?preview=true`, sistem tetap merender `LandingPage.svelte` dengan tombol topbar "Kembali ke Dashboard".
- **Backend Serving (`src/app.ts`)**:
  - Express melayani `client_dist/index.html` pada request `GET /` dengan status 200 OK.

---

## 2. Layout Structure & 7 Core Sections

### Section 1: Glassmorphism Header & Topbar Navigation
- **Branding**: Logo Ziqva AppCenter (`/favicon.svg`) + Teks bercahaya "AppCenter Ziqva".
- **Navigasi Rute**: Software Bot, Tools Gratis, Program Afiliasi, Tutorial Video, Keamanan.
- **Tombol Aksi**: "Masuk" (`#/member/login`) & "Daftar Akun" (`#/member/register`) dengan aksen gradient glow.
- **Header Behavior**: Sticky header dengan `backdrop-blur-md`, border kaca frosted, dan responsif drawer mobile.

### Section 2: Hero 3D Ecosystem & Value Proposition
- **Hero Left Copy**:
  - Pill Badge: `✨ EKOSISTEM SOFTWARE & BOT OTOMATISASI TERPERCAYA`
  - H1 Headline: "Otomatiskan Pekerjaan, Melipatgandakan Hasil Bisnis Digital Anda."
  - Subtitle: "Platform pusat software bot desktop, lisensi resmi, dan tools otomatisasi serba cepat untuk pertumbuhan bisnis tanpa batas."
  - Action Buttons: "Jelajahi Software" & "Coba Tools Gratis (Rp 0)".
- **Hero Right 3D Visual**:
  - 3D Floating Glassmorphic Centerpiece Platter (`heroFloat` levitation animation), ambient radial glow, logo Ziqva, dan tumpukan ikon satelit software bot unggulan.

### Section 3: Live Software Catalog & Free Tools Showcase
- **Segmented Filter Tabs**: "Semua Software", "🔥 Paket Bundle Hemat", "🎁 Tools Gratis (Rp 0)", dan Kategori Produk dinamis dari API.
- **Interactive Grid Cards**:
  - Latar kaca frosted, badge promo (`GRATIS Rp 0`, `HEMAT X%`, `BARU`), thumbnail icon 40x40px, harga jual final, harga asli coret, dan tombol CTA langsung ("Klaim Gratis" / "Lihat Detail").
  - Data di-fetch secara reaktif dari `GET /member/api/products`.

### Section 4: Platform Security & Architectural Invariants
- **4 Cards Grid**:
  - 🔒 **Hardware Binding (HWID Lock)**: Lisensi terikat aman pada perangkat PC/laptop tanpa kebocoran data.
  - 🚀 **Aktivasi Instan**: Token lisensi terbit seketika pasca transaksi atau klaim gratis.
  - 📂 **SFTP High-Speed Installer**: Direct download installer Windows & macOS resmi tercepat.
  - ⚡ **Auto-Update & Video Tutorial**: Bebas dari komplikasi setup dengan dukungan tutorial video bioskop.

### Section 5: Program Kemitraan Afiliasi & Komisi Transparan
- **Banner Highlight Afiliasi**:
  - Headline: "Dapatkan Komisi Berkelanjutan Bersama Ziqva Affiliate."
  - 3 Pillar Points: Kupon Diskon Khusus Pembeli, Komisi Transparan Per Penjualan, Pencairan Otomatis ke Bank/E-Wallet.
  - CTA Button: "Bergabung Jadi Mitra Afiliasi →" (`#/member/register`).

### Section 6: CTA Registrasi & Proof Stat Counter
- **Proof Counters**: `8.6k+` Pengguna Aktif | `30+` Software & Bot | `99.9%` Uptime System.
- **Call-to-Action Card**: "Siap Mengembangkan Bisnis Anda Secara Otomatis?" dengan tombol "Daftar Akun Gratis Sekarang".

### Section 7: Footer Navigation & Ecosystem Identity
- **Branding & Socials**: Logo Ziqva, deskripsi ringkas, hak cipta.
- **Link Columns**: Navigasi Cepat, Portal Member, Akses Admin, Pusat Bantuan/Tutorial, Kebijakan Privasi & Syarat Ketentuan.

---

## 3. Verification & Chrome DevTools QA Plan
1. Jalankan `pnpm run build` untuk memverifikasi 0 TypeScript & Svelte compilation errors.
2. Jalankan skrip pengujian otomatis Chrome DevTools (`scratch/verify-landing-page.js`):
   - **Desktop Light & Dark Theme** (1440px × 900px)
   - **Mobile Light & Dark Theme** (390px × 844px)
3. Tangkap screenshot visual dan pastikan zero 404 network errors & zero console errors.
