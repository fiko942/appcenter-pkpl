# Admin Products Mobile & Desktop UI/UX Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Admin Product Catalog (`AdminProducts.svelte`) for responsive mobile and desktop viewports with a clean inline header + badge, swipeable Segmented Tabs status bar, balanced 2-column mobile filter toolbar, and a touch-optimized card layout on mobile screens.

**Architecture:** Implement responsive Tailwind layout in `client/src/lib/pages/AdminProducts.svelte` using dual-view rendering (`hidden md:block` for the desktop table and `md:hidden` for mobile card items), responsive header flex containers, top-level Segmented Tabs, and balanced 2-column mobile dropdown selectors.

**Tech Stack:** Svelte 4, Vite 5, Tailwind CSS 4, `svelte-spa-router`, `bsk` (BrowserSkill CLI)

**Spec:** `docs/superpowers/specs/2026-09-17-admin-products-mobile-ui-design.md`

## Global Constraints

- Do not alter backend API contracts or database schemas.
- Maintain full feature parity across desktop and mobile views (edit, delete, status toggle, tutorials player, installer manager, multi-category badges, discounts, bundle badges).
- No horizontal scrolling tables on mobile screens (< 768px).
- Verify responsive rendering and interactive workflows in Chromium via `bsk`.

---

### Task 1: Redesign Page Header and Primary CTA on Mobile & Desktop

**Files:**
- Modify: `client/src/lib/pages/AdminProducts.svelte:795-850`

**Interfaces:**
- Consumes: `totalCount`, `loading`, `openAddModal`
- Produces: Responsive header layout where "Katalog Produk" heading and `{totalCount} Produk` badge are cleanly inline with `whitespace-nowrap`, and the CTA button is aligned to the right.

- [x] **Step 1: Inspect current header code in `client/src/lib/pages/AdminProducts.svelte`**
- [x] **Step 2: Update header markup to use responsive flex container with right-aligned button and inline badge**
- [x] **Step 3: Run client build to verify no syntax errors**

---

### Task 2: Segmented Tabs & Balanced 2-Column Mobile Dropdown Toolbar

**Files:**
- Modify: `client/src/lib/pages/AdminProducts.svelte:850-910`

**Interfaces:**
- Consumes: `searchInput`, `statusTabs`, `selectedStatusFilter`, `categoryFilterOptions`, `selectedCategoryFilter`, `sortOptions`, `sortBy`
- Produces: Top-level swipeable `SegmentedTabs` for status filtering, full-width search input, and equal 50/50 2-column grid for Category and Sort dropdowns on mobile (`grid grid-cols-2 gap-2.5 w-full`), transitioning to inline flex on desktop.

- [x] **Step 1: Place SegmentedTabs at the top of the card**
- [x] **Step 2: Update Toolbar markup with 2-column mobile grid and full-width dropdowns**
- [x] **Step 3: Run client build to verify compilation**

---

### Task 3: Implement Mobile Card/Item Layout (`md:hidden`) and Retain Desktop Table (`hidden md:block`)

**Files:**
- Modify: `client/src/lib/pages/AdminProducts.svelte:910-1200`

**Interfaces:**
- Consumes: `currentProducts`, `openTutorialPlayer`, `openInstallerModal`, `openEditModal`, `openDeleteModal`, `toggleStatus`
- Produces: Dual-view renderer with card grid on mobile and table on desktop.

- [x] **Step 1: Wrap existing table inside `<div class="hidden md:block overflow-x-auto">`**
- [x] **Step 2: Add mobile card list renderer inside `<div class="md:hidden divide-y divide-[var(--border)]">`**
- [x] **Step 3: Run client build to verify compilation**

---

### Task 4: Responsive Verification and Browser Audit via `bsk`

**Files:**
- Audit: `http://localhost:5173/#/admin/products`

**Interfaces:**
- Consumes: BrowserSkill CLI session
- Produces: Visual screenshots in mobile viewport (390x844) and desktop viewport (1280x800).

- [x] **Step 1: Test mobile viewport in browser with `bsk`**
- [x] **Step 2: Test desktop viewport in browser with `bsk`**
- [x] **Step 3: Verify modal and toolbar interactions**

---

### Task 5: Commit and Git Synchronization

**Files:**
- Add: `client/src/lib/pages/AdminProducts.svelte`, `docs/superpowers/`
- Commit message: `feat(admin-products): responsive mobile cards, header right cta, segmented status tabs, and balanced 2-column dropdown toolbar`

- [x] **Step 1: Git status and diff review**
- [x] **Step 2: Git commit and push to remote `master`**
