# Implementation Plan: Ultra-Clean Stripe/Linear-Grade Header Redesign

Fix all visual flaws identified in header audit:
1. **Remove Ugly Capsule Pill Track**: Replace the chunky boxed nav container with clean, borderless floating nav links.
2. **Subtle Apple/Linear Hover & Active Indicator**: Use a clean, translucent pill hover/active state (`bg-[var(--surface-2)]` / `bg-white/10` with crisp text and a micro underline dot/pill) instead of an oversized clunky gradient box.
3. **Refine Announcement Bar**: Replace the loud saturated solid blue banner with a sleek, subtle glass strip (`bg-blue-950/40 dark:bg-blue-950/60 border-b border-blue-500/20 text-blue-200`) with unified typography.
4. **Perfect Optical Alignment**: Normalize vertical height (h-16 instead of bloated h-20), precise flex alignment across logo, center nav, and action buttons.
5. **Button Hierarchy & Shape**: Refine CTA button with `rounded-xl` (matching the design system instead of generic pill-fatigue), clean hover glow, and proper contrast with "Masuk" text button.

## Proposed Changes

### Frontend: `client/src/lib/pages/LandingPage.svelte`
- Redesign `<header>` structure to clean standard height `h-16 sm:h-18`.
- Remove bulky `<nav class="p-1.5 rounded-full bg-slate-900 border...">`.
- Replace with clean floating nav list with smooth background pill indicator that transitions cleanly without competing with the primary CTA button.
- Refine announcement bar to minimalist frosted glass with crisp badge.
- Clean up brand typography and baseline alignment.

## Verification Plan

### Automated Verification
- Run `pnpm run build` (Exit code 0).
