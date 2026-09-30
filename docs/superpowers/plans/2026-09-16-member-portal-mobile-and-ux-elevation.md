# Member Portal UI/UX & Mobile Ergonomics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement handcrafted UI/UX elevations across the Member Portal including tactile animated checkboxes, Raycast-style active software cards, high-density pending order action bars, universal invoice routing, responsive mobile order cards, content-fitted filter dropdowns, and high-contrast zebra striping.

---

## Tasks Summary & Status

- [x] **Task 1: Handcrafted Animated Custom Checkbox (`CustomCheckbox.svelte`)**
  - Integrated SVG path-drawing animation and mechanical micro-bounce.
  - Added interactive link guard for Terms and Privacy policies.
  - Unified across Login (`Login.svelte`), Register (`Register.svelte`), and License migration modal (`Licenses.svelte`).

- [x] **Task 2: Responsive Welcome Hero Spacing (`Dashboard.svelte` & `appcenter-theme.css`)**
  - Added responsive bottom margin (`mb-6 sm:mb-8 lg:mb-10`) to `.welcome`.
  - Added `margin-bottom: 24px` on mobile media query in `appcenter-theme.css`.

- [x] **Task 3: Raycast-Style Active Software License Cards (`Dashboard.svelte`)**
  - Re-architected bulky `rounded-3xl` cards into compact `rounded-2xl` cards.
  - Added live pulsating status dot, monospace serial key strip, 1-touch copy feedback, and direct Download Hub routing (`#/member/downloads?id=...`).

- [x] **Task 4: High-Density Pending Order Action Bar (`Dashboard.svelte` & `memberController.ts`)**
  - Enriched `apiGetDashboard` payload to return unexpired pending orders with WIB expiration formatting and generated invoice tokens.
  - Implemented high-density Swiss/Linear action bar with direct payment navigation.

- [x] **Task 5: Universal Invoice SPA Route Registration (`App.svelte`)**
  - Registered `'/invoice/:token'`, `'/invoices/:token'`, and `'/member/invoices/:token'` to `InvoicePublic.svelte`.

- [x] **Task 6: Mobile Orders Card View & High-Contrast Zebra Striping (`Orders.svelte` & `MemberInvoices.svelte`)**
  - Replaced wide desktop table on mobile (`< md`) with zero-scroll mobile cards.
  - Replaced horizontal scrollable filter tabs on mobile with right-aligned content-fitted `CustomSelect` dropdown.
  - Applied high-contrast alternating zebra striping across even and odd rows (`rgb(12, 19, 34)` vs `rgb(20, 31, 54)`).

---

## Verification
- Clean build via `pnpm run build` (Exit code: 0).
- Validated via Chrome automated browser tests across desktop and mobile viewports.
- All temporary test scripts purged for zero storage footprint.
