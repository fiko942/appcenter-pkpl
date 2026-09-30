# Implementation Plan: Bundle Products Visual Elevation & Clean Pricing (No "Lifetime Gratis")

## Requirements:
1. **Bundle Products Visual Display**:
   - For `is_bundle === true`, render an attractive **Glassmorphic Multi-App Icon Stack** in the card header (similar to Member Dashboard), with dynamic satellite icons showing the included software.
   - Show a glowing `BUNDLE HEMAT` badge and list of software included with clean tags.
2. **Pricing & Free Display Handling**:
   - For `price === 0` (Free tools):
     - Display strictly **`Gratis (Rp 0)`** or **`Rp 0`** without redundant/confusing "lifetime gratis" text.
     - CTA text: **`Klaim Gratis →`**.
   - For Paid Products:
     - Display clean formatted price (`Rp xxx.xxx`) with original crossed-out price if discounted.
     - CTA text: **`Pesan Lisensi →`** or **`Pesan Paket →`** (for bundles).

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
