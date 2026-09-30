# Implementation Plan: Category Icons, Billing Cycle Suffix, Distinct Free & Bundle Product Styling

## Objectives:
1. **Category Pills with High-Tech Icons**:
   - Add dynamic or semantic contextual icons to every category/tag pill (e.g. YouTube icon for `#Tools Pendukung Youtube`, Affiliator/Link icon for `#Tools Pendukung Affiliator`, Farming/Seed icon for `#Tools Farming`, Shopping Bag/Cart icon for `#Tool Dropshipper`, Layers icon for `Paket Bundle`, Gift/Sparkles for `Tools Gratis`, Grid for `Semua Software`).
2. **Billing / Pricing Unit Clarification**:
   - For paid software bots, display the price with clear `/bulan` billing cycle suffix (e.g., `Rp 129.350 / bln` or `Rp 129.350` with a clean `/bulan` subtext).
   - For bundled packages, display `Rp 249.000 / paket`.
   - For free tools, display `Rp 0` with a clean `Akses Gratis` tag.
3. **Distinct Styling for Bundle & Free Products**:
   - **Bundle Products**: Indigo/purple gradient border accent (`border-indigo-500/50`), glowing indigo badge with bundle tool counter, stacked app icons preview, and "Pesan Paket →" button with gradient.
   - **Free Products**: Emerald/mint glowing border accent (`border-emerald-500/40`), glowing emerald pill `GRATIS Rp 0`, and prominent green CTA `Klaim Gratis →`.
   - **Single Paid Products**: Royal blue liquid glass styling, clear `/bulan` tag, and "Pesan Lisensi →".

## Verification:
- Build check via `pnpm run build` (Exit code 0).
