# Member Portal UI/UX & Mobile Ergonomics Elevation Specification

**Date:** 2026-09-16  
**Status:** Implemented & Verified  
**Scope:** Member Portal UI/UX, Authentication Forms, Dashboard Components, Mobile Ergonomics, and Orders Navigation

---

## 1. Overview & Objectives

Elevate the UI/UX across the Member Portal from generic template aesthetics into handcrafted, high-end SaaS experiences inspired by Linear, Apple, Stripe, and Raycast design systems. Key goals include:
1. Eliminating clunky "AI-slop" visuals (glowing neon boxes, artificial gradients, and oversized padding).
2. Implementing custom tactile animated micro-interactions (`CustomCheckbox.svelte` with SVG path drawing).
3. Transforming Active License Cards and Pending Order Notifications into sleek, purposeful, and high-density components.
4. Redesigning the Member Orders page on mobile viewports into zero-horizontal-scroll card lists with right-aligned content-fitted dropdown filters and high-contrast alternating zebra striping.

---

## 2. Detailed Subsystem Specifications

### 2.1. Handcrafted Animated Checkbox (`CustomCheckbox.svelte`)
- **Box Dimensions**: Precision 18×18px with `rounded-[5px]`, crisp borders (`border-slate-300 dark:border-slate-700/80`), and inset shadows (`shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.05)]`).
- **Checked State**: Solid brand blue (`bg-blue-600 border-blue-600 dark:bg-blue-500`) or purple for registration, with a tactile micro-bounce animation (`@keyframes checkmarkPop`).
- **SVG Path Drawing**: Custom checkmark path drawn dynamically via `stroke-dashoffset: 16 -> 0` using `cubic-bezier(0.16, 1, 0.3, 1)`.
- **Link Guard**: Built-in event filtering to prevent unintended toggle when users click `<a>` links (such as Terms & Privacy policies) inside the checkbox label slot.

### 2.2. Responsive Welcome Hero Spacing (`Dashboard.svelte` & `appcenter-theme.css`)
- Added responsive vertical margin (`mb-6 sm:mb-8 lg:mb-10`) to the Welcome Hero Section (`.welcome`).
- Ensures at least 24px of clear vertical breathing room above "LISENSI TERDAFTAR" on mobile viewports ($\le 760\text{px}$).

### 2.3. Raycast-Style Active Software License Cards (`Dashboard.svelte`)
- Compact `rounded-2xl` containers with balanced padding and subtle hover elevation (`hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md`).
- 44×44px product thumbnail / fallback monogram avatar.
- Status badge with live pulsating dot (`Aktif • X Hari` emerald / `Kedaluwarsa` rose).
- Sleek serial key strip with monospace typography and 1-click copy button with instant checkmark feedback ("Tersalin!").
- Action bar directing "Unduh Installer" directly to `#/member/downloads?id=...` in the Download Hub.

### 2.4. High-Density Pending Order Action Bar (`Dashboard.svelte` & `memberController.ts`)
- Backend `apiGetDashboard` returns unexpired pending orders with formatted expiration time (`expiresAtFormatted` in WIB), remaining minutes, and verified invoice token.
- High-density notification bar with neutral surface tokens, 36×36px clock/invoice icon, human-crafted natural copywriting, and a high-contrast "Bayar Pesanan" button linking directly to `#/invoice/:token`.

### 2.5. Universal Invoice Routing (`App.svelte`)
- Registered singular `'/invoice/:token'`, plural `'/invoices/:token'`, and member-scoped `'/member/invoices/:token'` to `InvoicePublic.svelte` ensuring seamless navigation without falling through to catch-all.

### 2.6. Mobile Orders View & High-Contrast Zebra Striping (`Orders.svelte` & `MemberInvoices.svelte`)
- **Mobile Card View (`block md:hidden`)**: Full card view eliminating table horizontal scroll on mobile devices ($320\text{px} - 767\text{px}$).
- **Mobile Status Dropdown (`CustomSelect.svelte`)**: Right-aligned, content-fitted dropdown filter replacing wide horizontal scrollable tabs on mobile.
- **High-Contrast Zebra Striping**:
  - Odd rows: `bg-[var(--surface)] dark:bg-[#0c1322]` (`rgb(12, 19, 34)`).
  - Even rows: `bg-slate-100/70 dark:bg-[#141f36]` (`rgb(20, 31, 54)`).
  - Clear, distinct visual contrast across consecutive rows for effortless reading.

---

## 3. Verification & Compliance
- 100% verified with automated headless Chrome CDP and `browser-skill` across Mobile ($390\times844$, $400\times520$) and Desktop ($1280\times800$, $1440\times900$) viewports.
- All temporary artifacts purged immediately (*zero storage footprint*).
