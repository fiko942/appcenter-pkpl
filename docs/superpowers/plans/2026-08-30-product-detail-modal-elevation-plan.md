# Implementation Plan: Ultra-Polished Liquid Glass Quick Product Detail Modal

## Problem Identified in Modal:
1. **Unformatted Description Block**: The long descriptive text is rendered in a single dense paragraph without visual breathing room.
2. **Flat Spec Box & Plain OS Badges**: OS tags lack vector badges (Windows blue logo, Apple logo) and look generic.
3. **Buried License & Guarantee Info**: License bind and auto-activation guarantee are small gray footnotes.
4. **Header & Footer Hierarchy**: Modal lacks liquid-glass backdrop glow, specular reflection, billing cycle badge (`/bulan` / `/paket`), and clear visual separation.

## Proposed Upgrades:
1. **Modal Header with Liquid Glass & Category Chip**:
   - Translucent card with glowing border and specular light sheen (`backdrop-blur-2xl bg-[var(--surface-1)]/95 dark:bg-[#0c162e]/95`).
   - Category tag rendered with image thumbnail icon.
2. **Smart Feature Bullet Highlights**:
   - Break description into highlight chips / tags or clean paragraphs.
3. **Structured Spec & OS Compatibility Card**:
   - Modern OS badges with high-contrast logos (Windows flag & Apple logo).
   - Dedicated trust badge chip with shield icon: `Garansi HWID Lock & Aktivasi Instan <100ms`.
4. **Elevated Footer Price & Gradient CTA**:
   - Clear price formatting (`Rp 129.350 / bulan`, `Rp 249.000 / paket`, or `Gratis (Rp 0)`).
   - Prominent tactile gradient CTA button with glow.

## Verification:
- Build check via `pnpm run build` (Exit code 0).
