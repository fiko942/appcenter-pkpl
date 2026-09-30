# Admin Payments Responsive Split-Screen & Mobile Card View Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Admin Payments page (`AdminPayments.svelte`) to deliver a responsive, clean, and overflow-free user experience across mobile (390px), split-screen/tablet (640px–1279px with sidebar open), and desktop (1280px+) by replacing cramped desktop tables with modern responsive card grids on screens `< xl`, fixing toolbar dropdown truncation, perfecting mobile datepicker popover positioning, and optimizing modals.

**Architecture:**
- **Breakpoint Separation:** Use `xl` (1280px) as the structural threshold. Screens `>= 1280px` render the high-density 7-column desktop table. Screens `< 1280px` (mobile, tablet, split-screen) render an elevated, responsive Card Grid (`grid-cols-1 sm:grid-cols-2 xl:hidden`).
- **Responsive Toolbar:** Restructure the top filter row (`grid-cols-1 sm:grid-cols-2 xl:grid-cols-12`) with `fullWidth={true}` custom dropdowns and `no-scrollbar` horizontal preset tracks to eliminate text clipping and default scrollbar clutter.
- **Mobile-First Modal & Popover Architecture:** Ensure the custom datepicker popover and transaction detail modals adapt gracefully to small viewports with viewport clamping (`max-w-[calc(100vw-2rem)]`), avoiding any viewport edge cutoffs.

**Tech Stack:** Svelte 4, Tailwind CSS 4, CSS Dual-Theme Variables (`--surface`, `--surface-2`, `--border`, `--brand`, `--text`), TypeScript 5.9, Vite 5/6, Node.js Express 5 backend.

**Spec:** User feedback from screenshot analysis (`Image #1`) highlighting toolbar truncation, table overflow on split-screen, and cramped mobile layout requiring clean card-based presentation.

## Global Constraints

- Retain full functionality: live search with 320ms debounce, product filter dropdown, multi-criteria sorting, date presets, custom datepicker, detail modal, edit duration modal, and manual payment confirmation.
- Adhere strictly to the project dual-theme system (`--surface`, `--surface-2`, `--border`, `--brand`, `--text`, `--text-2`, `--text-3`).
- Prevent any horizontal overflow (`overflow-x`) on mobile and split-screen viewports.
- Maintain strict TypeScript type-checking (`npx tsc --noEmit`) and clean Vite client builds (`pnpm run build:client`).

---

### Task 1: Responsive Toolbar & Dropdown Container Overhaul

**Files:**
- Modify: `client/src/lib/components/CustomSelect.svelte`
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: `OptionItem` interface from `CustomSelect.svelte`, filter states (`searchInput`, `selectedProduct`, `sortValue`, `periodPreset`, `customStartDate`, `customEndDate`).
- Produces: Overflow-proof toolbar grid with `fullWidth={true}` dropdown containers and viewport-clamped calendar popover.

- [ ] **Step 1: Verify current toolbar layout issues**

Check existing grid classes in `AdminPayments.svelte` around line 725 where `grid-cols-2 xl:grid-cols-12` causes select truncation on narrow screens (< 640px).

- [ ] **Step 2: Update CustomSelect.svelte to ensure responsive dropdown sizing**

Ensure `CustomSelect.svelte` supports flexible full-width layout without text overflow or clipped borders:
```svelte
<div class="custom-select-root relative {fullWidth ? 'w-full block' : 'inline-block'} text-left" bind:this={dropdownRef}>
    <button
        type="button"
        class="{fullWidth ? 'w-full flex justify-between px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs' : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs'} hover:border-[var(--brand)]/60 font-semibold text-[var(--text)] transition-colors duration-150 cursor-pointer shadow-xs active:scale-[0.98] select-none group"
        on:click={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
    >
```

- [ ] **Step 3: Restructure Toolbar Grid in AdminPayments.svelte**

Update the search and filter grid to `grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-2.5 items-center` where:
- Search input: `col-span-1 sm:col-span-2 xl:col-span-6`
- Product select: `col-span-1 xl:col-span-3` with `fullWidth={true}`
- Sort select: `col-span-1 xl:col-span-3` with `fullWidth={true}`

- [ ] **Step 4: Update Datepicker Popover Positioning**

Clamp the calendar popover on mobile viewports so it does not overflow horizontally:
```svelte
<div
    class="datepicker-popover-container absolute top-full left-0 sm:left-auto right-0 mt-2 z-50 w-full sm:w-80 max-w-[calc(100vw-2rem)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-4 space-y-3 animate-fade-in backdrop-blur-xl"
    role="dialog"
    aria-modal="true"
>
```

- [ ] **Step 5: Run type-check & verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/lib/components/CustomSelect.svelte client/src/lib/pages/AdminPayments.svelte
git commit -m "fix(admin-payments): overhaul responsive toolbar and dropdown sizing"
```

---

### Task 2: Mobile & Split-Screen Card Grid Overhaul (`< xl`)

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`
- Modify: `public/css/appcenter-theme.css`

**Interfaces:**
- Consumes: `paymentsData.payments` array, `isPaid(status, paidAt)`, `formatCurrency()`, modal triggers (`openDetailModal`, `openDurationModal`, `openConfirmModal`).
- Produces: High-aesthetic, responsive 1-column (mobile) and 2-column (tablet/split-screen) card grid for viewports under 1280px (`< xl`).

- [ ] **Step 1: Check existing card layout in AdminPayments.svelte**

Examine lines 1210-1330 of `AdminPayments.svelte` where `divide-y` was used inside a single container, causing cards to stretch awkwardly on wide split-screen views.

- [ ] **Step 2: Implement 2-Column Responsive Card Grid for `< xl`**

Replace the simple `divide-y` card stack with an elevated, grid-based card layout:
```svelte
<!-- Mobile / Tablet / Split-Screen Card Grid (< xl) -->
<div class="xl:hidden p-3 sm:p-4 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
    {#each paymentsData.payments as p (p.id)}
        {@const paid = isPaid(p.status, p.paidAt)}
        <div class="p-4 rounded-2xl bg-[var(--surface-2)]/40 hover:bg-[var(--surface-2)]/80 border border-[var(--border)] transition-all duration-200 space-y-3 flex flex-col justify-between shadow-xs">
            <!-- Card Header: Order ID + Channel + Status -->
            <div class="flex items-start justify-between gap-2">
                <div>
                    <button
                        type="button"
                        on:click={() => openDetailModal(p.id)}
                        class="font-mono font-black text-sm text-[var(--brand)] hover:underline flex items-center gap-1 cursor-pointer"
                        title="Lihat detail transaksi"
                    >
                        <span>#{p.id}</span>
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </button>
                    <div class="text-[11px] text-[var(--text-3)] font-medium mt-0.5">
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--surface-2)] border border-[var(--border)] text-[10px] font-bold text-[var(--text-2)] uppercase">{p.channelCode || 'ONLINE'}</span>
                        <span class="ml-1">{p.createdAt}</span>
                    </div>
                </div>

                <div>
                    {#if paid}
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Lunas</span>
                        </span>
                    {:else}
                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <span>Pending</span>
                        </span>
                    {/if}
                </div>
            </div>

            <!-- Card Body: Product Info & Pricing -->
            <div class="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs space-y-2">
                <div class="flex items-center gap-3">
                    {#if isValidImg(p.productImage) && !imgErrorMap['m_' + p.id]}
                        <img
                            src={p.productImage}
                            alt={p.productName}
                            class="w-10 h-10 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0 shadow-2xs"
                            on:error={() => imgErrorMap['m_' + p.id] = true}
                        />
                    {:else}
                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-[var(--brand)] font-black text-sm flex items-center justify-center flex-shrink-0">
                            {p.productName.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <div class="min-w-0 flex-1">
                        <div class="font-bold text-[var(--text)] truncate text-xs sm:text-sm">{p.productName}</div>
                        <div class="text-[11px] text-[var(--brand)] font-semibold">{p.durationDisplay || `${p.durationMonths} Bulan`}</div>
                    </div>
                    <div class="text-right flex-shrink-0">
                        <div class="font-black text-[var(--text)] text-xs sm:text-sm">{formatCurrency(p.totalAmount)}</div>
                        {#if p.adminFee > 0}
                            <div class="text-[10px] text-[var(--text-3)]">Fee: {formatCurrency(p.adminFee)}</div>
                        {/if}
                    </div>
                </div>

                <!-- Customer Details -->
                <div class="pt-2 border-t border-[var(--border)]/60 flex items-center justify-between text-[11px]">
                    <span class="text-[var(--text-3)]">Pelanggan:</span>
                    <span class="font-semibold text-[var(--text)] truncate max-w-[180px]">{p.user} ({p.email || '-'})</span>
                </div>

                <!-- License Token Preview -->
                {#if p.licenseToken}
                    <div class="pt-1.5 border-t border-[var(--border)]/40 flex items-center justify-between text-[11px]">
                        <span class="text-[var(--text-3)] font-mono">Lisensi:</span>
                        <div class="flex items-center gap-1.5">
                            <span class="font-mono text-[10px] font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                {p.licenseToken.substring(0, 10)}...
                            </span>
                            <button
                                type="button"
                                on:click={() => copyToClipboard(p.licenseToken || '', 'Token Lisensi')}
                                class="p-1 rounded-md hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--brand)] transition-colors cursor-pointer"
                                title="Salin Token Lisensi"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                            </button>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Card Actions Dock -->
            <div class="flex items-center justify-end gap-1.5 pt-1">
                {#if p.invoiceToken}
                    <a
                        href="#/invoice/{p.invoiceToken}"
                        target="_blank"
                        class="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 hover:bg-indigo-500/20 border border-indigo-500/20 transition-all flex items-center gap-1"
                    >
                        Invoice
                    </a>
                {/if}

                <button
                    type="button"
                    on:click={() => openDetailModal(p.id)}
                    class="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-all flex items-center gap-1 cursor-pointer"
                >
                    Detail
                </button>

                <button
                    type="button"
                    on:click={() => openDurationModal(p)}
                    class="px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-2)] transition-all flex items-center gap-1 cursor-pointer"
                >
                    Durasi
                </button>

                {#if !paid}
                    <button
                        type="button"
                        on:click={() => openConfirmModal(p)}
                        class="px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs flex items-center gap-1 cursor-pointer border-0"
                    >
                        Lunas
                    </button>
                {/if}
            </div>
        </div>
    {/each}
</div>
```

- [ ] **Step 3: Run type-check & verify**

Run: `npx tsc --noEmit`
Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/pages/AdminPayments.svelte
git commit -m "feat(admin-payments): implement responsive 2-column card grid for mobile and split-screen"
```

---

### Task 3: Desktop High-Density Table Optimization (`>= xl`) & Pagination Refinement

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: Table markup for `>= xl` breakpoint, pagination state (`currentPage`, `pageSize`, `paymentsData.totalPages`).
- Produces: Clean, non-overflowing desktop table and responsive pagination footer.

- [ ] **Step 1: Refine Desktop Table Markup**

Ensure column headers and cells use explicit `min-w`, clean truncation, and tooltips:
- Order ID: `w-28`
- Pelanggan: `min-w-[160px] max-w-[200px]`
- Produk: `min-w-[200px]`
- Total Bayar: `min-w-[140px]`
- Status: `min-w-[130px]`
- Lisensi Token: `min-w-[150px]`
- Aksi: `w-36 text-right`

- [ ] **Step 2: Refine Pagination Footer for All Viewports**

Make pagination controls responsive and touch-friendly on both mobile and desktop:
```svelte
<!-- Table Footer & Pagination -->
{#if paymentsData && paymentsData.totalPages > 1}
    <div class="p-3 sm:p-4 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div class="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <span class="text-[var(--text-3)]">Halaman {paymentsData.page} dari {paymentsData.totalPages}</span>
            <CustomSelect
                options={pageSizeOptions}
                value={pageSize}
                on:change={(e) => handlePageSizeChange(e.detail)}
            />
        </div>

        <div class="flex items-center justify-center gap-1.5 w-full sm:w-auto">
            <button
                type="button"
                on:click={() => handlePageChange(currentPage - 1)}
                disabled={currentPage <= 1}
                class="px-3.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-30 transition-all font-semibold cursor-pointer"
            >
                Sebelumnya
            </button>

            <span class="px-3.5 py-1.5 rounded-xl font-bold bg-[var(--brand)] text-white text-xs">
                {currentPage}
            </span>

            <button
                type="button"
                on:click={() => handlePageChange(currentPage + 1)}
                disabled={!paymentsData || currentPage >= paymentsData.totalPages}
                class="px-3.5 py-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)] disabled:opacity-30 transition-all font-semibold cursor-pointer"
            >
                Selanjutnya
            </button>
        </div>
    </div>
{/if}
```

- [ ] **Step 3: Run type-check & build**

Run: `npx tsc --noEmit; pnpm run build:client`
Expected: 0 errors, build succeeds.

- [ ] **Step 4: Commit**

```bash
git add client/src/lib/pages/AdminPayments.svelte
git commit -m "fix(admin-payments): optimize desktop table column widths and responsive pagination"
```

---

### Task 4: Modals Mobile Responsiveness & Touch Optimization

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: `detailData`, `editingPayment`, `confirmingPayment` state variables.
- Produces: Touch-friendly, scroll-safe modals for mobile screens.

- [ ] **Step 1: Check Modal Containers in AdminPayments.svelte**

Ensure modal wrappers have `max-h-[90vh] overflow-y-auto`, proper mobile padding `p-4 sm:p-6`, and `w-full max-w-2xl` sizing.

- [ ] **Step 2: Optimize Products List inside Detail Modal**

Ensure the purchased products table inside the detail modal scrolls horizontally on mobile or renders as clean item tiles without horizontal layout breaks.

- [ ] **Step 3: Optimize Action Buttons inside Modals**

Ensure submit and cancel buttons in Duration Modal and Confirm Modal have adequate touch height (min 40px) and full-width on mobile.

- [ ] **Step 4: Run type-check & build**

Run: `npx tsc --noEmit; pnpm run build:client`
Expected: 0 errors, clean build.

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/pages/AdminPayments.svelte
git commit -m "fix(admin-payments): enhance modal responsiveness and mobile touch targets"
```

---

### Task 5: Multi-Viewport Browser Skill Verification

**Files:**
- Test: Browser verification via `browser-skill` / automated viewport tests.

**Interfaces:**
- Consumes: Vite Dev Server on `http://localhost:5173` and Backend on `http://localhost:3000`.
- Produces: Verified screenshots and confirmed interactive flow on 3 viewports:
  1. Mobile: 390x844
  2. Split-Screen / Tablet: 950x850
  3. Desktop: 1440x900

- [ ] **Step 1: Verify Mobile Viewport (390x844)**

Resize browser to 390x844:
- Confirm search bar is full width.
- Confirm dropdown selects stack cleanly or fit without truncation.
- Confirm date presets scroll horizontally without OS scrollbars.
- Confirm payments list renders as clean single-column cards with no horizontal clipping.
- Confirm detail modal opens and closes smoothly.

- [ ] **Step 2: Verify Split-Screen / Tablet Viewport (950x850)**

Resize browser to 950x850:
- Confirm 256px sidebar is open.
- Confirm content area renders a 2-column card grid (`grid-cols-2`).
- Confirm toolbar controls fit without truncation.
- Confirm zero horizontal table overflow.

- [ ] **Step 3: Verify Desktop Viewport (1440x900)**

Resize browser to 1440x900:
- Confirm desktop table renders with all 7 columns spacious and aligned.
- Test live search with 320ms debounce.
- Test product dropdown filtering.
- Test sort dropdown ordering.
- Test custom date range picker popover.

- [ ] **Step 4: Final verification and build**

Run: `npx tsc --noEmit; pnpm run build:client`
Expected: Build passes with 0 errors.
