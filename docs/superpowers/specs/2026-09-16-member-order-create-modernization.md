# Design Spec: Member Create Order Modernization & Mobile Ergonomics

**Date**: 2026-09-16  
**Status**: Approved  
**Target Route**: `#/member/orders/create` (rendered by `client/src/lib/pages/ProductDetail.svelte`)

---

## 1. Executive Summary & Goals
The Order Creation / Product Detail page (`#/member/orders/create`) allows logged-in members to configure software license orders, select license durations, apply promo/voucher codes, view transparent price breakdowns, and initiate instant activation or invoice creation.

Currently, the page suffers from a legacy split-hero grid (`grid-template-columns: 1fr 1.08fr`) containing a massive 440px empty visual orbit container that consumes screen real-estate and pushes order configurations below the fold on mobile viewports. Furthermore, duration tab pill animations use pixel-offset calculations that drift across responsive sizes, and voucher inputs lack cancellation controls.

This modernization introduces a high-density, Raycast-inspired two-column order configurator on desktop and a streamlined, single-scroll ergonomic flow on mobile, complete with live search, smooth percentage-based pill transitions, transparent invoice summary cards, and quick navigation.

---

## 2. Key Architecture & Layout System

### 2.1 Modern Page Header
- **Top Bar**:
  - Badge tag: `✨ ORDER SOFTWARE & LISENSI RESMI`
  - Heading 1: `Buat Pesanan Baru`
  - Subtitle: `Pilih software otomasi, tentukan durasi berlangganan, dan gunakan kupon promo untuk mengaktifkan lisensi resmi.`
  - Action button (Top Right): `← Lihat Pesanan Saya` linking directly to `#/member/orders`.

### 2.2 2-Column Desktop / Responsive Split
1. **Left Column (Order Configurator & Product Intelligence)**:
   - **Product Selector**: Elevated `CustomDropdown` with search query filter, icon avatars, live user counts, and active pricing.
   - **Selected Software Hero Card**:
     - Modern glassmorphic/surface container with 48px product icon / initial avatar.
     - Category badge (e.g. `TOOLS OTOMASI`, `OFFICIAL BOT`, `TOOLS GRATIS`).
     - Real-time active user pulse dot indicator (`• 1.2k+ Pengguna Aktif` when $\ge 500$).
     - Responsive description typography.
   - **Bundle Software Items Card** (When `selectedProduct.is_bundle` is true):
     - Visual grid of bundled software items with individual icons and verified license tags.
   - **License Duration Selector**:
     - 3-segment sliding pill tab switcher (`2 Bulan | 4 Bulan | 6 Bulan`).
     - Fluid GPU-accelerated transition using `transform: translateX(0% | 100% | 200%)` with `ease-[cubic-bezier(0.16,1,0.3,1)]` and `w-[calc(33.333%-2.67px)]`.
   - **Interactive Voucher / Promo Input**:
     - Text input with uppercase monospace styling.
     - Validation button with live spinner.
     - Active voucher badge with savings pill and a tactile `✕ Hapus Kupon` button to clear/reset the voucher.
   - **Product Features & Security Badges**:
     - Key feature bullets (Lisensi Resmi Terverifikasi, Update Versi Berkala, Panduan Tutorial Lengkap, Dukungan Teknis).

2. **Right Column (Sticky Checkout & Invoice Summary Card)**:
   - **Pricing Breakdown Table**:
     - Harga Normal Satuan (`Rp XXX.XXX`)
     - Diskon Produk (jika ada, e.g. `-20%`)
     - Durasi Berlangganan (`X Bulan`)
     - Diskon Kupon Promo (`-Rp XX.XXX`, green highlight)
     - Total Hemat (`Hemat Rp XX.XXX (XX%)`)
   - **Total Estimasi Pembayaran**:
     - Prominent price display (`text-2xl font-black text-blue-600 dark:text-blue-400 font-mono` or `Gratis`).
   - **Primary Action Button (CTA)**:
     - Prominent button with active tactile press states (`Lanjutkan ke Pesanan Saya →` or `Klaim Lisensi Gratis`).
   - **Trust & Activation Highlights**:
     - Activation type: `Instan Otomatis`
     - License binding: `Machine ID Bound`
     - Documentation quick-link: Direct link to `#/member/tutorials/:id` if tutorials exist.

---

## 3. Mobile Ergonomics & Viewport Optimizations ($390\times844$)
- Compact product header eliminating vertical bloat.
- Form controls grouped intuitively with finger-friendly touch targets ($>44\text{px}$).
- Prominent price summary positioned directly above the submit button for frictionless one-thumb checkout.

---

## 4. Verification Plan
- Verify clean compilation with `pnpm run build`.
- Inspect UI, interactions, dropdown, duration switcher, voucher, and success modal in Chrome via `bsk` across Desktop ($1280\times800$) and Mobile ($390\times844$) viewports.
