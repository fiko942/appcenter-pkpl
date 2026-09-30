# Implementation Plan: Member Tutorials Mobile & UI/UX Elevation

**Date**: 2026-09-16  
**Route**: `http://localhost:5173/#/member/tutorials` and `http://localhost:5173/#/member/tutorials/:id`  
**Target File**: `client/src/lib/pages/Tutorials.svelte`

---

## 1. Overview & Problem Review

### Current Mobile Experience Flaws (`< 768px` / 390x844):
1. **Catalog Overview View (`#/member/tutorials`)**:
   - Header is overly tall with oversized decorative icons and wordy descriptions.
   - Filter tabs (`Semua Software`, `Tersedia Video Panduan`, `Belum Ada Video`) are in an `overflow-x-auto` horizontal chip container that requires swiping and looks inconsistent with the compact dropdown pattern established in Orders, Invoices, and Licenses.
   - Catalog cards are tall (~230px) with generic styling, pushing content down and only fitting ~1.5 cards on mobile screens.

2. **Product Tutorial Detail View (`#/member/tutorials/:id`)**:
   - The top navigation bar stacks vertically into 3 bulky elements (back button, title, search box), taking ~150px of vertical space.
   - A separate "Learning Progress Bar" card sits directly between the header and the video player, pushing the YouTube video player completely below the fold on mobile screens.
   - The chapter playlist stacks underneath both the video player and the large "Now Playing Info Card", forcing mobile users to scroll through hundreds of pixels to pick another chapter.
   - No interactive mobile tab switcher exists between "Daftar Bab & Playlist" and "Tentang Materi & Download".

---

## 2. Proposed UI/UX Architecture (Raycast/Linear Elegance)

### A. Catalog Grid Overview (`#/member/tutorials`)
- **Compact Hero Header & Toolbar**:
  - Refined header with crisp title, gradient app icon, and concise helper text.
  - **Single-row responsive toolbar**:
    - Left: Compact search bar `input[type="text"]` with instant filtering.
    - Right (Mobile): `CustomSelect` dropdown with filter options:
      - `Semua Software (${products.length})`
      - `Tersedia Video (${productsWithVideoCount})`
      - `Belum Ada Video (${productsWithoutVideoCount})`
    - Right (Desktop): Clean segmented pill filter tabs.
- **Raycast-Style High-Density Software Cards**:
  - High-contrast surface tokens (Dark: `#0c1322` / `#101827` / `#141f36`, Light: `#ffffff` / `slate-100/70`).
  - Sleek 44x44 icon container with subtle border.
  - Emerald badge with pulsating status dot for active video courses (`• 5 Video Panduan`).
  - Subtle category/chapter count badge and tactile "Buka Materi →" button.

### B. Product Detail & Video Player View (`#/member/tutorials/:id`)
- **Video-First Sticky / Compact Navigation**:
  - Single-row compact topbar: Back arrow button ("← Katalog"), small product icon (24x24), product name, and video counter badge.
- **Top-Anchored 16:9 Video Box**:
  - Placed directly near the top so it is immediately visible and playable on mobile without scrolling.
- **Unified Media Controller Strip (Directly Under Video)**:
  - Displays "Bab {selectedVideoIndex + 1} dari {currentTutorials.length}", mini animated progress bar, and instant Previous / Next step buttons.
- **Mobile Segmented Tab Switcher with Sliding Pill Indicator**:
  - **Tab 1: "Daftar Bab & Playlist ({N})"** (Default active on mobile):
    - Inline search input for chapters.
    - High-contrast chapter cards with active blue background (`bg-blue-600 text-white`), playing status icon (`▶`), chapter index (`01`, `02`, ...), and 1-tap lesson jump with automatic scroll-to-player.
  - **Tab 2: "Tentang & Download"**:
    - Full video title, description, official tags (`Official HD`, `Langkah Lengkap`).
    - Direct "Download Software Installer" shortcut link to `#/member/downloads?id={selectedProduct.id}`.
  - **Smooth Sliding Pill**: GPU-accelerated Framer Motion-style physics sliding pill animation (`transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`) with active text transitions.
- **Desktop 12-Column Layout & SegmentedTabs**:
  - On desktop (`lg:grid-cols-12`), preserve the 8-col video player + 4-col playlist sidebar layout with enhanced contrast and styling.
  - Desktop catalog filters use `SegmentedTabs` with sliding pill animation.

---

## 3. Step-by-Step Execution Plan

### Step 1: Add Responsive State & CustomSelect Options in `Tutorials.svelte`
- Import `CustomSelect` component in `Tutorials.svelte`.
- Create reactive `catalogDropdownOptions` and `mobileDetailTab` state (`'playlist' | 'info'`).

### Step 2: Overhaul Catalog Overview Mobile Header & Grid View
- Implement single-row search + `CustomSelect` toolbar on mobile (`block md:hidden`).
- Redesign software cards with compact high-density layout, pulsating status badges, and refined typography.

### Step 3: Overhaul Product Detail View for Mobile Ergonomics
- Refactor breadcrumb header into a compact single-row navigation bar on mobile.
- Move video player immediately near top of the detail view.
- Place compact Progress Strip & Prev/Next buttons right under the video player.
- Implement Mobile Segmented Tabs:
  - Tab 1: Chapter Playlist with instant 1-tap switcher.
  - Tab 2: About Video & Direct Software Download Hub action button.

### Step 4: Full Automated Browser Verification (CDP)
- Test mobile viewport (390x844):
  - Check Catalog Overview: single-row toolbar, search filtering, dropdown filter, zero horizontal overflow.
  - Check Product Detail with Videos (Product 102): sticky/top video player, tab switching between Playlist and About, chapter selection, prev/next buttons.
  - Check Product Detail Empty State (Product 103): clean empty container and back button.
- Test desktop viewport (1280x800):
  - Check Catalog Grid (3-column layout) and Detail View (8-col player + 4-col playlist).

### Step 5: Save to Superpowers Memory & Git Push
- Write Superpowers Spec and Plan to `docs/superpowers/specs/` and `docs/superpowers/plans/`.
- Update `docs/CONTEXT_SNAPSHOT.yaml` and `ZIQVA_STORE_ANALYSIS.md`.
- Commit changes and push strictly to `origin/reborn`.
