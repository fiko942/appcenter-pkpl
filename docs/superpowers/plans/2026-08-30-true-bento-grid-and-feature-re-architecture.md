# Implementation Plan: True Bento-Grid Re-architecture & Native Cross-Platform Engine Elevation

## 1. Analysis of Flaws in Current Features Grid:
1. **SFTP Card Irrelevance**: "SFTP High-Speed Installer" is an irrelevant developer implementation detail that does not represent core user value for marketing/automation software bots.
2. **Pseudo-Bento Uniformity**: All 6 cards have the exact same 1x1 size, flat borders, duplicate top & bottom tags, creating monotonous visual fatigue.
3. **Color & Hierarchy Discord**: Top tags repeat the exact same message as bottom footers with conflicting dot colors.

## 2. Proposed Architectural Redesign (Asymmetrical Apple/Linear-Grade Bento Grid):
1. **Hero Bento Card 1 (Span 2 Columns on Desktop - Indigo Gradient Glow)**:
   - **Title**: **Proteksi Machine ID & Transfer Lisensi Bebas**
   - **Feature**: Multi-device flexible migration, instant hardware re-bind without buying new licenses.
   - **Interactive Visual**: Illustrated device swap graphic (`PC Kantor ⇄ Laptop Pribadi`) with status badge `Aktivasi Mandiri 24/7`.
2. **Replacement Card for SFTP (Card 2 - Emerald Glow)**:
   - **Title**: **Multi-Akun & Arsitektur Otomasi Native**
   - **Feature**: Arsitektur multi-thread berkecepatan tinggi yang dirancang khusus untuk automasi massal ribuan akun tanpa lemot di Windows 10/11 & macOS.
   - **Tech Tag**: `NATIVE MULTI-THREAD` / `Win & Mac Native Engine`
3. **Card 3 (Cyan Glow)**:
   - **Title**: **Auto-Updater System (Zero Downtime)**
   - **Feature**: Patch otomatis dan pembaruan fitur terkini langsung di dalam aplikasi tanpa instal ulang.
4. **Card 4 (Rose/Crimson Glow)**:
   - **Title**: **Pembayaran Otomatis & Lisensi Instan <100ms**
   - **Feature**: QRIS Real-time (BCA, Mandiri, BRI, GoPay, OVO, DANA) dengan webhook auto-provisioning.
5. **Hero Bento Card 5 (Span 2 Columns on Desktop - Purple Glow)**:
   - **Title**: **Hub Modul Video Tutorial Terintegrasi (1080p Cinema)**
   - **Feature**: Modul pembelajaran step-by-step terstruktur langsung di dashboard member dengan live preview progress.

## Verification:
- Build check via `pnpm run build` (Exit code 0).
