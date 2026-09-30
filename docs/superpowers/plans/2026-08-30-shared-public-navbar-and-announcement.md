# Implementation Plan: Shared Navigation Bar & Top Announcement Banner across Public Pages

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a unified, reusable `Navbar.svelte` component (with Top Announcement Bar, brand identity, navigation links, theme toggle, and auth CTA buttons) and apply it consistently across all public pages (`LandingPage.svelte`, `Login.svelte`, `Register.svelte`, `Terms.svelte`, and `Privacy.svelte`).

**Architecture:**
- Create `client/src/lib/components/PublicNavbar.svelte`:
  - Top Announcement Banner (dismissible, gradient accent).
  - Apple TV-Class frosted glass bar (`backdrop-blur-2xl`).
  - Brand identity with icon & "AppCenter Ziqva Labs".
  - Nav links with router / smooth scroll support (`Beranda`, `Katalog`, `Fitur`, `Afiliasi`, `Syarat`, `Privasi`).
  - Dual-Theme switch & Smart Auth buttons (Login, Register / Buka Member Area).
  - Mobile responsive drawer menu.
- Integrate `PublicNavbar.svelte` into `Login.svelte`, `Register.svelte`, `Terms.svelte`, and `Privacy.svelte`.

**Tech Stack:** Svelte 4, svelte-spa-router, Tailwind CSS, TypeScript.

---

### Task 1: Create Reusable `PublicNavbar.svelte` Component
**Files:**
- Create: `client/src/lib/components/PublicNavbar.svelte`

---

### Task 2: Integrate into `Terms.svelte` and `Privacy.svelte`
**Files:**
- Modify: `client/src/lib/pages/Terms.svelte`
- Modify: `client/src/lib/pages/Privacy.svelte`

---

### Task 3: Integrate into `Login.svelte` and `Register.svelte`
**Files:**
- Modify: `client/src/lib/pages/Login.svelte`
- Modify: `client/src/lib/pages/Register.svelte`

---

### Task 4: Build Verification & Git Sync
**Files:**
- Run: `pnpm run build`
- Git Commit & Push to `origin/reborn`
