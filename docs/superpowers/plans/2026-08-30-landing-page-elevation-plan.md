# Implementation Plan: Landing Page Elevation (Light/Dark Dynamic Glass, Mobile Optimization, Interactive Calculator & Product Enhancements)

Elevate `client/src/lib/pages/LandingPage.svelte` to production-grade UI/UX with seamless Light and Dark mode responsiveness, integrated `ThemeToggle` component, interactive affiliate commission calculator, instant search, responsive category pills with smooth scrolling, OS platform badges, and refined Apple-class glassmorphic design tokens.

## User Review Required

> [!IMPORTANT]
> No breaking changes to existing routes, APIs, or database schema. All changes are contained within the frontend Svelte presentation layer (`LandingPage.svelte`) and asset styles.

## Proposed Changes

### Frontend: `client/src/lib/pages/LandingPage.svelte`
- **Dynamic Dual-Theme Glassmorphism**:
  - Replace hardcoded dark colors (`bg-[#0a0f1d]`, `bg-[#0e172e]`, `text-slate-300`, `border-white/10`) with reactive dual-theme tokens (`bg-[var(--surface)]/85`, `bg-[var(--surface-1)]`, `text-[var(--text)]`, `text-[var(--text-2)]`, `border-[var(--border)]`, backdrop-blur-2xl).
  - Light mode: Translucent frosty glass with soft indigo/blue tint.
  - Dark mode: Deep obsidian royal blue glass with subtle glowing borders.
- **ThemeToggle Component Integration**:
  - Replace raw inline SVGs in desktop Navbar and mobile drawer with `<ThemeToggle />`.
- **Top Announcement Marquee Bar**:
  - Add a sleek dismissible top announcement bar highlighting "⚡ AppCenter v2.0 Live: Ekosistem Software Bot Desktop & Lisensi Resmi Terpadu".
- **Hero & 3D Showcase Enhancement**:
  - Fix satellite card positioning for mobile screens (`relative` or adaptive grid on small viewports, precision floating on large screens) to prevent clipping.
  - Elevate micro metrics widgets to follow theme variables.
- **Instant Product Search & Responsive Categories**:
  - Add search input field in the catalog section.
  - Enable smooth horizontal scrollable pill container for mobile screens (`overflow-x-auto no-scrollbar`).
  - Add OS compatibility badges (Windows / macOS) on product cards by checking `installer_files`.
  - Add Quick Detail Modal for product cards.
- **Interactive Affiliate Calculator Widget**:
  - Add an interactive slider allowing visitors to simulate monthly affiliate earnings (e.g. Sales volume slider: 1 - 200 software sales x Average price x 30% commission).
- **Footer Refinement**:
  - Add live server status badge (Uptime 99.9%), target branch & system status indicators, and clean category links.

## Verification Plan

### Automated Verification
- Run `pnpm run build` to verify Svelte template compilation, TypeScript types, and Vite bundling (Exit code 0).
- Check with terminal / node script that all components compile cleanly.

### Manual / Browser Verification
- Verify Light Mode vs Dark Mode visual contrast and legibility.
- Verify Mobile Viewport (<400px) responsiveness (no horizontal overflow, smooth tab scrolling, responsive satellite cards).
- Verify interactive elements (Search filter, Category tabs, Affiliate calculator slider, FAQ accordion, modals).
