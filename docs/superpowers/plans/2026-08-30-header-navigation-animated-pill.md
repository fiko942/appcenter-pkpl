# Implementation Plan: Header Navigation Sliding Animated Pill

Implement a high-performance floating animated sliding pill on the desktop Navbar header in `client/src/lib/pages/LandingPage.svelte` that glides smoothly across nav items on click/hover and accurately syncs with current scroll position/active section.

## Proposed Changes

### Frontend: `client/src/lib/pages/LandingPage.svelte`
- Define navigation items array (`navLinks = [{ id: 'hero', label: 'Beranda' }, { id: 'catalog', label: 'Software & Bot' }, { id: 'features', label: 'Keunggulan' }, { id: 'affiliate', label: 'Mitra Afiliasi' }, { id: 'faq', label: 'FAQ' }]`).
- Track `activeNav` state (defaults to `'hero'`).
- Add active element ref binding and calculation for sliding pill indicator (`pillLeft`, `pillWidth`, `hoverNav`).
- Setup an `IntersectionObserver` or scroll listener that detects the currently visible section as the user scrolls, updating the active pill position automatically.
- Style the sliding pill with dynamic backdrop glow, royal-blue tint, and buttery smooth CSS transitions (`transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1)`).

## Verification Plan

### Automated Verification
- Run `pnpm run build` (Exit code 0).
