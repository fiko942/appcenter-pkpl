# Implementation Plan: Comprehensive System Evolution & Scaling Plan

**Date**: 2026-08-28  
**Scope**: AppCenter V2 Ecosystem Roadmap  
**Status**: Ready / Active  

---

## 1. System Evolution Objectives
Memperkuat skalabilitas, performa, keamanan, dan pengalaman pengguna pada platform AppCenter V2 berdasarkan temuan audit teknis dan non-teknis menyeluruh.

---

## 2. Phase Breakdown

### Phase 1: Security & Reliability Hardening
- **Task 1.1: Password Hashing Upgrade**: Transisi dari penyimpanan plaintext legacy ke `bcrypt` / `argon2` dengan backward-compatible re-hash pada login pertama.
- **Task 1.2: Session Expiration & Refresh**: Peningkatan mekanisme perpanjangan sesi admin dan member secara transparan.
- **Task 1.3: Rate Limiting Extension**: Perluasan rate limiting pada endpoint pembuatan order (`POST /member/orders/create`) dan verifikasi token device (`POST /device/activation`).

### Phase 2: High-Performance Data & Caching Layer
- **Task 2.1: In-Memory / Redis Caching for Public Catalog**: Menambahkan caching memory untuk `/member/api/products` dan `/member/api/tutorials` dengan cache invalidation otomatis saat admin melakukan pembaruan di `AdminProducts` atau `AdminCategories`.
- **Task 2.2: Advanced Analytical Metrics**: Menambahkan visualisasi grafik tren penjualan 12 bulan dan agregasi omset bulanan di `AdminDashboard.svelte`.

### Phase 3: Enhanced Business & Marketing Automation
- **Task 3.1: Automated Affiliate Payout Notifications**: Mengintegrasikan notifikasi pesan instan (WhatsApp / Email) saat payout afiliasi berhasil ditransfer.
- **Task 3.2: Automated Trial Expiry Callout**: Menampilkan callout penawaran upgrade khusus bagi pengguna trial yang masa aktifnya tersisa < 24 jam.

---

## 3. Verification & Safety Guidelines
- Setiap fase wajib mematuhi seluruh invariant permanen (`GEMINI.md`).
- Pengujian simulasi end-to-end (`pnpm run test:simulation`) wajib dijalankan sebelum dan sesudah perilisan perubahan fitur besar.
- Zero local storage footprint: seluruh file dump dan profil pengujian wajib langsung dibersihkan.
