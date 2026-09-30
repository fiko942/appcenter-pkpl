# Implementation Plan: Prevent Unwanted 2-Line Text Wrapping (Ensure Clean Single-Line Typography Across Headers & Cards)

## Objectives:
Audit and streamline all titles, kicker badges, metric labels, and feature headers across `LandingPage.svelte` to ensure they fit cleanly on **1 single line** (`whitespace-nowrap` or punchy, concise phrasing) without awkward word wrapping.

## Specific Targets:
1. **Ziqva Guarantee Policy Section (Lines 1358-1398)**:
   - Item 1: `1 Lisensi Aktif per Waktu (Bebas Pindah)` -> **`Lisensi Fleksibel & Bebas Pindah`** (Clean single line).
   - Item 2: `Garansi Aktivasi Instan` -> **`Aktivasi Instan & Otomatis`** (Single line).
   - Item 3: `Email Permanen & Aman` -> **`Akun & Email Terproteksi`** (Single line).
   - Item 4: `Pembaruan Fitur & Panduan Modul` -> **`Update Berkala & Video Hub`** (Clean single line).
2. **Hero Trust Grid & Satellite Badges**:
   - Ensure badges like `⚡ Aktivasi 24/7`, `💳 QRIS & Bank`, `🔄 Auto-Update`, `💻 Win & Mac OS` have `whitespace-nowrap`.
3. **Features Bento Grid Headers & Footers**:
   - Ensure all sub-badges and footer action indicators fit cleanly on 1 line.
4. **Affiliate Section Bullets & Estimator Card**:
   - Make bullet headers and metric labels concise and single-line.

## Verification:
- Build check via `pnpm run build` (Exit code 0).
