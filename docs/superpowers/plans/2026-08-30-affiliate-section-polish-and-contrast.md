# Implementation Plan: Polish Affiliate Section UX, Contrast, and Responsive Layout

## Audit Findings & Upgrades:
1. **Vector Icon Standardization**:
   - Ensure clean vector SVG icons for all badges (no OS system emojis).
2. **Text Contrast & Readability**:
   - Lighten the slider range scale labels (`1 lisensi`, `50 lisensi`, `100 lisensi`) from `text-slate-400` to `text-slate-300 font-semibold` to pass WCAG AA contrast.
   - Boost visibility of the feature checklist bullets on the left.
3. **Formula Tooltip / Explanation**:
   - Add a subtle information note/tooltip explaining the mathematical formula: `(Durasi × Harga Bersih) × 15% Komisi × Target Penjualan` so users understand the calculation intuitively.
4. **Responsive Layout**:
   - Ensure the left feature bullet tags stack cleanly without overflow on mobile/tablet viewports.

## Verification:
- Build check via `pnpm run build` (Exit code 0).
