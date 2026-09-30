# Member Invoices Mobile Ergonomics & UI/UX Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform the Member Invoices page (`client/src/lib/pages/MemberInvoices.svelte` at `#/member/invoices`) with the same mobile ergonomics and UI/UX standards as the Orders page: zero-scroll mobile cards, right-aligned content-fitted status dropdown, high-contrast alternating zebra striping, and refined dual-theme tokens.

---

## Technical Specifications

### 1. Responsive Status Filter Controls
- **Desktop (`hidden md:flex`)**: Preserves the animated `SegmentedTabs` component with count badges.
- **Mobile (`block md:hidden`)**: Renders a right-aligned, content-fitted `CustomSelect` dropdown with label `"Filter Status:"` and options:
  - `Semua Faktur (${counts.all})`
  - `Lunas / Paid (${counts.paid})`
  - `Menunggu Pembayaran (${counts.pending})`

### 2. Mobile Responsive Card List (`block md:hidden`)
- Structure per invoice item:
  - **Top Row**: 40×40px product icon / monogram, Invoice Number (blue monospace link), product name truncate, date string, and high-contrast status badge (`LUNAS` emerald / `UNPAID` amber).
  - **Bottom Row**: Total amount (or `GRATIS`) on the left; Action buttons on the right (Detail Invoice `#/invoice/:token` in blue and Unduh PDF `/api/v1/invoice/:token/pdf` in rose).
- **Zebra Striping**: Alternates between `bg-[var(--surface)] dark:bg-[#0c1322]` (odd) and `bg-slate-100/80 dark:bg-[#141f36]` (even).
- Zero horizontal overflow (`scrollWidth === clientWidth`).

### 3. Preserved Desktop Table (`hidden md:block`)
- Multi-column sortable table with high-contrast alternating zebra striping and tooltip action buttons.

---

## Proposed Changes
- Modify `client/src/lib/pages/MemberInvoices.svelte`

---

## Verification Plan
1. **Compilation**: `pnpm run build`
2. **Browser Verification**:
   - Test Mobile Viewport (`390px, 844px` and `400px, 520px`) via headless Chrome.
   - Verify mobile cards render cleanly with zero horizontal scroll.
   - Verify right-aligned dropdown filter works and filters invoices.
   - Test Desktop Viewport (`1280px, 800px`) and verify full table and tabs are displayed.
   - Verify high-contrast zebra striping across consecutive rows.
   - Purge all temporary test scripts (*zero storage footprint*).
