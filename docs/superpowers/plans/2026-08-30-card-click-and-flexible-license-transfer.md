# Implementation Plan: Card-Clickable Modal Trigger & Flexible Multi-Device License Transfer Policy Update

## Problem Analysis & User Direction:
1. **Interactive Card Trigger**:
   - Currently, opening the product detail modal requires clicking the small eye icon or the title text.
   - User requirement: The entire product card should be clickable (`cursor-pointer`) to open the detail modal, while inner CTA buttons (`Pesan Lisensi`, `Klaim Gratis`, etc.) preserve their own dedicated action via `e.stopPropagation()`.
2. **License Transfer Flexibility & HWID Policy Copy**:
   - The copy incorrectly suggested licenses were permanently locked/trapped to a single machine forever without recourse.
   - Clarify everywhere (Hero satellite cards, Features bento grid, Guarantee banner, Modal specifications, FAQ, and Footer) that:
     - Licenses are protected with HWID Machine ID for security.
     - **Lisensi Fleksibel & Bebas Dipindahkan**: Lisensi dapat dipindahkan ke perangkat / laptop baru kapan saja secara mandiri via Portal Member (*Self-Service License Transfer & Re-bind*).

## Verification:
- Build check via `pnpm run build` (Exit code 0).
