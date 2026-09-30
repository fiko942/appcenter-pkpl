# Admin Payments (Daftar Pembayaran) UI/UX Elevation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize and elevate the Admin Payments page (`client/src/lib/pages/AdminPayments.svelte`) with responsive mobile cards, seamless filter toolbars, and a multi-tab User Detail-style modal with animated sliding pill indicators.

**Architecture:** Svelte 4 component elevation with Tailwind CSS 4, dynamic sliding pill DOM measurement via `ResizeObserver` & `requestAnimationFrame`, reactive Svelte transitions (`fade`), and full dual-theme support (light/dark).

**Tech Stack:** Svelte 4, TypeScript, Tailwind CSS 4, Svelte SPA Router.

**Spec:** `docs/superpowers/specs/2026-09-17-admin-payments-elevation-design.md`

## Global Constraints

- Preserve all existing state, filters, APIs, and query string synchronization (`statusFilter`, `selectedProduct`, `periodPreset`, `customStartDate`, `customEndDate`, `sortValue`, `searchInput`).
- Zero em-dashes (`—`) in UI copy; use standard hyphens (`-`).
- WCAG AA contrast compliance in both light and dark themes.
- Viewport stability and zero text wrapping on action buttons or mobile chips.

---

### Task 1: Modal Detail State and Animated Pill Controller

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: `PaymentDetailData`, `detailData`, `detailModalOpen`
- Produces: `detailActiveTab: 'order' | 'tokens' | 'customer' | 'technical'`, `syncDetailPill()`, `setDetailTab(tabId)`

- [x] **Step 1: Add detail modal tab state and sliding pill tracker variables**
  Add `detailActiveTab`, `detailTabContainer`, `detailTabElements`, `detailPillStyle`, `detailPillInitialized`, and `detailResizeObserver`.

- [x] **Step 2: Implement `syncDetailPill` and `setDetailTab` functions with `ResizeObserver`**
  Add helper functions to calculate active tab element's `offsetLeft` and `offsetWidth`, and handle observer cleanup on modal close / component destroy.

- [x] **Step 3: Verify TypeScript compilation & component reactivity**
  Run `npm run build` or Vite check to ensure no type errors.

---

### Task 2: Revamp Modal Detail Pembayaran Markup & Sliding Pill UI

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: `detailActiveTab`, `detailData`, `syncDetailPill`, `copyToClipboard`
- Produces: 4 distinct animated tab views (`order`, `tokens`, `customer`, `technical`) inside the modal

- [x] **Step 1: Replace existing monolithic detail modal body with 4-tab sliding pill switcher**
  Implement the tab switcher header with `role="tablist"` and dynamic pill backdrop.

- [x] **Step 2: Implement Tab 1 (Rincian & Produk)**
  Display order metrics (Total, Admin Fee, Gateway/Method, Payment Dates) and purchased item table with clear price breakdown.

- [x] **Step 3: Implement Tab 2 (Token Lisensi)**
  Display machine token cards, HWID/IP binding status, activation status badges, and 1-click copy chips.

- [x] **Step 4: Implement Tab 3 (Pelanggan & Afiliasi)**
  Display customer information with one-tap WhatsApp link and affiliate commission summary.

- [x] **Step 5: Implement Tab 4 (Audit & Teknis)**
  Display technical metadata (Payment Request ID, VA Number / QRIS string, voucher, admin notes, confirmation timestamps).

- [x] **Step 6: Verify modal UI and tab switching**
  Test in browser or via CDP script to confirm smooth tab animation and content rendering.

---

### Task 3: Elevate Mobile Card Grid & Action Button Dock

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: `paymentsData.payments`, `isPaid`, `formatCurrency`, `copyToClipboard`
- Produces: Modernized mobile card layout with clean visual hierarchy

- [x] **Step 1: Refine mobile card layout styling**
  Improve header alignment (Order ID mono badge, Channel code, Status pulse dot), product avatar and duration pill, and customer metadata copy chips.

- [x] **Step 2: Enhance action button dock**
  Ensure all buttons (`Invoice`, `Detail`, `Durasi`, `Konfirmasi Lunas`) have touch-friendly sizing (min 36-40px height) and clear icon-text pairings.

- [x] **Step 3: Verify responsive viewports**
  Check layout on 320px, 375px, 425px, 768px, and desktop viewports.

---

### Task 4: Polish Filter Toolbar, Calendar Popover & Sub-Modals

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: `filterTabs`, `periodPresets`, `showDatePickerPopover`, `confirmModalOpen`, `durationModalOpen`
- Produces: Polished filter toolbar and sub-modals

- [x] **Step 1: Ensure period preset buttons and datepicker trigger have consistent styling**
  Verify active/inactive contrast in light and dark modes.

- [x] **Step 2: Polish Confirm Manual Modal and Edit Duration Modal**
  Standardize modal backdrops, typography, button hover states, and input focus rings.

- [x] **Step 3: Run full build and verify with automated script**
  Run `npm run build` and launch dev server check.

---

### Task 5: IDM-Proof In-App A4 Digital Invoice Document Viewer

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: `openPdfModal(token, orderId)`, `/api/v1/invoice/:token`
- Produces: `pdfModalData`, `#invoice-print-sheet`, print stylesheet `@media print`

- [x] **Step 1: Replace raw PDF iframe with JSON API fetch (`/api/v1/invoice/:token`)**
  Eliminates Internet Download Manager (IDM) interception.

- [x] **Step 2: Implement A4 Document Sheet with bilingual support (ID / EN)**
  Renders responsive official invoice sheet with real-time currency, status stamps, item table, and license keys.

- [x] **Step 3: Implement 1-click Print (`window.print()`) with print styling**
  Enables isolated clean printing of the invoice document.

- [x] **Step 4: Verify build and test API integration**
  Verify client compilation with `npm run build`.
