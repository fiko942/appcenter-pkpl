# Member Invoices & Orders Compact Single-Row Toolbar & Mobile Ergonomics Specification

**Date:** 2026-09-16  
**Status:** Implemented, Verified & Deployed  
**Scope:** `client/src/lib/pages/MemberInvoices.svelte`, `client/src/lib/pages/Orders.svelte`, Mobile Ergonomics, and Global Custom Scrollbars

---

## 1. Overview & Objectives

Optimize the layout and responsive behavior of the transaction tables across the Member Portal:
1. **Member Invoices (`MemberInvoices.svelte`)**:
   - Zero-scroll mobile card list (`block md:hidden`).
   - Single-row compact toolbar (`p-3 sm:p-4 flex items-center justify-between gap-2.5`) with flexible search input on the left and right-aligned sort dropdown on the right.
   - Right-aligned, content-fitted status filter dropdown on mobile.
   - High-contrast alternating zebra striping (`rgb(12, 19, 34)` vs `rgb(20, 31, 54)` in dark mode).
2. **Member Orders (`Orders.svelte`)**:
   - Integrated mobile status dropdown directly into the table toolbar, side-by-side with the search input on the exact same horizontal row (`isInlineOnSameRow: true`).
   - Preserved animated `SegmentedTabs` and multi-column sortable table for desktop viewports ($\ge 768\text{px}$).

---

## 2. Technical Architecture

### 2.1. Compact 1-Row Toolbar Layout
```svelte
<div class="p-3 sm:p-4 border-b border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-2.5 bg-[var(--surface-2)] dark:bg-[#131d31]">
    <!-- Search Input (Flexible) -->
    <div class="flex-1 min-w-0 sm:max-w-xs relative">
        <input
            type="text"
            bind:value={searchQuery}
            on:input={handleSearchInput}
            placeholder="Cari..."
            class="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)] transition-colors"
        />
        <svg class="w-3.5 h-3.5 text-[var(--text-3)] dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
    </div>

    <!-- Right Side Inline Control -->
    <div class="shrink-0 flex items-center gap-1.5">
        <CustomSelect ... />
    </div>
</div>
```

### 2.2. High-Contrast Zebra Striping
- **Odd Elements**: `bg-[var(--surface)] dark:bg-[#0c1322]` (`rgb(12, 19, 34)`).
- **Even Elements**: `bg-slate-100/70 dark:bg-[#141f36]` (`rgb(20, 31, 54)`).
- **Hover**: `hover:bg-blue-50/70 dark:hover:bg-[#1a2845] transition-colors`.

---

## 3. Verification & Compliance
- 100% verified via automated headless Chrome CDP and `browser-skill` across Mobile ($390\times844$, $400\times520$) and Desktop ($1280\times800$) viewports.
- All temporary test scripts purged (*zero storage footprint*).
