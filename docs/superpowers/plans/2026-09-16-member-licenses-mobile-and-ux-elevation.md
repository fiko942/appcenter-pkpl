# Member Licenses & Devices Mobile Ergonomics & UI/UX Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the Member Licenses & Devices page (`#/member/licenses`) with zero horizontal scrolling on mobile, dedicated high-contrast zebra-striped mobile cards, compact single-row header toolbar with inline mobile status filter, and desktop zebra striping.

**Architecture:** Frontend Svelte 4 component upgrade in `Licenses.svelte` using responsive layout switching (`hidden md:table` for desktop, `block md:hidden` for mobile cards), reactive options calculation for `CustomSelect`, and alternating contrast styling.

**Tech Stack:** Svelte 4, Tailwind CSS, TypeScript, Vite SPA, Chrome DevTools Protocol (CDP) for browser verification.

**Spec:** `docs/superpowers/specs/2026-09-16-member-licenses-mobile-and-ux-elevation.md`

## Global Constraints
- Target branch is strictly `reborn`.
- All package operations must strictly use `pnpm`.
- Maintain zero storage footprint by cleaning up any temporary test scripts.
- No horizontal scrolling on mobile viewports (< 768px).
- Clean up all timers on component unmount (`onDestroy`).

---

### Task 1: Add Mobile Status Dropdown Options and Responsive State

**Files:**
- Modify: `client/src/lib/pages/Licenses.svelte:60-120`

**Interfaces:**
- Consumes: `counts: StatusCounts` from API response
- Produces: `statusDropdownOptions` reactive array for mobile `CustomSelect` component

- [ ] **Step 1: Define reactive `statusDropdownOptions` and handler**

Add reactive mapping in `Licenses.svelte`:
```svelte
$: statusDropdownOptions = [
    { value: 'all', label: `Semua Lisensi (${counts.all})` },
    { value: 'active', label: `Aktif (${counts.active})` },
    { value: 'unused', label: `Siap Pakai (${counts.unused})` },
    ...(counts.expired > 0 ? [{ value: 'expired', label: `Kadaluarsa (${counts.expired})` }] : [])
];
```

- [ ] **Step 2: Add `handleMobileStatusChange` helper**

```svelte
function handleMobileStatusChange(e: CustomEvent<string | number>) {
    setStatusFilter(e.detail as 'all' | 'active' | 'unused' | 'expired');
}
```

- [ ] **Step 3: Verify TypeScript compilation**

Run: `pnpm run build`
Expected: Build succeeds without TypeScript or Svelte errors.

---

### Task 2: Implement Compact Header Toolbar & Responsive Filter View

**Files:**
- Modify: `client/src/lib/pages/Licenses.svelte:440-500`

**Interfaces:**
- Consumes: `statusTabs`, `statusDropdownOptions`, `searchQuery`, `statusFilter`
- Produces: Responsive toolbar showing `SegmentedTabs` only on `>= md`, and single-row search + status dropdown on `< md`

- [ ] **Step 1: Wrap `SegmentedTabs` in desktop-only visibility container**

```svelte
<!-- Filter Status Tabs with Animated Sliding Pill (Desktop Only) -->
<div class="hidden md:flex items-center gap-2 overflow-x-auto pb-1">
    <SegmentedTabs
        tabs={statusTabs}
        bind:activeTab={statusFilter}
        on:change={(e) => setStatusFilter(e.detail)}
    />
</div>
```

- [ ] **Step 2: Restructure Table Container Header into Single-Row Responsive Toolbar**

```svelte
<!-- Search & Controls Bar -->
<div class="p-3 sm:p-4 border-b border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-2.5 bg-[var(--surface-2)] dark:bg-[#131d31]">
    <!-- Search Input (Flexible) -->
    <div class="flex-1 md:w-80 md:flex-initial relative">
        <input
            type="text"
            bind:value={searchQuery}
            on:input={handleSearchInput}
            placeholder="Cari App, License Key, Machine ID..."
            class="w-full pl-9 pr-8 py-2 bg-[var(--surface)] dark:bg-[#0c1322] border border-[var(--border)] dark:border-[#22314d] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)]"
        />
        <svg class="w-4 h-4 text-[var(--text-3)] absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        {#if searchQuery}
            <button
                type="button"
                on:click={() => { searchQuery = ''; pagination.page = 1; fetchLicenses(); }}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer p-1"
            >
                &times;
            </button>
        {/if}
    </div>

    <!-- Mobile Filter Status Dropdown (Right-aligned, fitted) -->
    <div class="block md:hidden flex-shrink-0">
        <CustomSelect
            options={statusDropdownOptions}
            value={statusFilter}
            prefix="Status:"
            align="right"
            on:change={handleMobileStatusChange}
        />
    </div>

    <!-- Desktop Page Size & Total Counter (Desktop Only) -->
    <div class="hidden md:flex items-center gap-3 flex-shrink-0">
        <CustomSelect
            options={pageSizeOptions}
            value={pagination.pageSize}
            prefix="Tampilkan:"
            on:change={handlePageSizeChange}
        />
        <div class="text-xs text-[var(--text-3)] dark:text-slate-300">
            Total: <strong class="text-[var(--text)] dark:text-white font-bold">{pagination.totalItems}</strong> lisensi
        </div>
    </div>
</div>
```

---

### Task 3: Build Dedicated Mobile Card List with High-Contrast Zebra Striping

**Files:**
- Modify: `client/src/lib/pages/Licenses.svelte:520-740`

**Interfaces:**
- Consumes: `licenses: LicenseRow[]`, `copyKey`, `copyHwid`, `openHwidModal`, `openDownloadModal`
- Produces: `block md:hidden` high-density mobile cards with zero horizontal overflow

- [ ] **Step 1: Implement Mobile Cards View (`block md:hidden`)**

Add above or alongside the desktop table:
```svelte
<!-- Mobile Card View (block md:hidden) -->
<div class="block md:hidden divide-y divide-[var(--border)] dark:divide-[#22314d]">
    {#each licenses as license, idx (license.id)}
        <div class="p-4 transition-colors {idx % 2 === 0 ? 'bg-[var(--surface)] dark:bg-[#0c1322]' : 'bg-slate-100/70 dark:bg-[#141f36]'}">
            <!-- Header: Icon, Name, Duration, and Status Badge -->
            <div class="flex items-start justify-between gap-3 mb-3">
                <div class="flex items-center gap-2.5 min-w-0 flex-1">
                    {#if isValidImg(license.image) && !imgErrorMap[license.id]}
                        <img
                            src={license.image}
                            alt={license.product}
                            class="w-9 h-9 rounded-xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-slate-800 flex-shrink-0 shadow-xs"
                            on:error={() => imgErrorMap[license.id] = true}
                        />
                    {:else}
                        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs flex-shrink-0 shadow-xs">
                            {license.product.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5 flex-wrap">
                            <span class="font-bold text-[var(--text)] dark:text-white text-xs truncate" title={license.product}>
                                {license.product}
                            </span>
                            <span class="px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface-2)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 text-[var(--text-3)] dark:text-slate-300 font-semibold">
                                {license.duration}
                            </span>
                        </div>
                        {#if license.hasTutorials}
                            <a href="#/member/tutorials/{license.productId || ''}" class="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1 mt-0.5">
                                <svg class="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                <span>Tutorial</span>
                            </a>
                        {/if}
                    </div>
                </div>

                <!-- Status Badge -->
                <div class="flex-shrink-0">
                    {#if license.status === 'active'}
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/40">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                            Aktif
                        </span>
                    {:else if license.status === 'unused'}
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/40">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"></span>
                            Siap Pakai
                        </span>
                    {:else}
                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/40">
                            <span class="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400"></span>
                            Kadaluarsa
                        </span>
                    {/if}
                </div>
            </div>

            <!-- License Key Box (1-Touch Copy) -->
            <div class="mb-2.5">
                <button
                    type="button"
                    class="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[var(--surface-2)] dark:bg-[#111a2e] hover:bg-[var(--border)] dark:hover:bg-[#18253f] border border-[var(--border)] dark:border-[#22314d] cursor-pointer transition-colors text-left group"
                    on:click={() => copyKey(license.id, license.key)}
                    title="Klik untuk salin License Key"
                >
                    <div class="flex items-center gap-2 min-w-0">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] dark:text-slate-400 flex-shrink-0">Key:</span>
                        <span class="font-mono text-xs text-[var(--text)] dark:text-slate-100 font-medium truncate">
                            {license.key}
                        </span>
                    </div>
                    <div class="flex-shrink-0">
                        {#if copiedKeyId === license.id}
                            <span class="text-[10px] text-emerald-400 font-bold">Disalin!</span>
                        {:else}
                            <svg class="w-3.5 h-3.5 text-[var(--text-3)] dark:text-slate-400 group-hover:text-[var(--brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        {/if}
                    </div>
                </button>
            </div>

            <!-- Machine ID (HWID) & Action Buttons -->
            <div class="flex items-center justify-between gap-2 pt-1 border-t border-[var(--border)]/50 dark:border-[#22314d]/60">
                <!-- Machine ID Container -->
                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                    {#if license.is_applied && license.machineId && license.machineId !== '-'}
                        <button
                            type="button"
                            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] dark:bg-[#111a2e] hover:bg-[var(--border)] dark:hover:bg-slate-700 border border-[var(--border)] dark:border-[#22314d] min-w-0 max-w-full text-left group cursor-pointer"
                            on:click={() => copyHwid(license.id, license.machineId)}
                            title="Klik untuk salin HWID: {license.machineId}"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                            <span class="font-mono text-[11px] text-[var(--text-2)] dark:text-slate-200 truncate">
                                {license.machineId}
                            </span>
                            {#if copiedHwidId === license.id}
                                <span class="text-[9px] text-emerald-400 font-bold flex-shrink-0">Disalin!</span>
                            {/if}
                        </button>
                    {:else}
                        <span class="text-[11px] text-[var(--text-3)] dark:text-slate-400 italic">
                            Belum terikat
                        </span>
                    {/if}

                    <button
                        type="button"
                        on:click={() => openHwidModal(license)}
                        class="p-1.5 rounded-lg bg-[var(--surface-2)] dark:bg-[#111a2e] hover:bg-blue-600 dark:hover:bg-blue-600 text-[var(--text-3)] dark:text-slate-400 hover:text-white dark:hover:text-white border border-[var(--border)] dark:border-[#22314d] hover:border-blue-600 transition-colors cursor-pointer flex-shrink-0"
                        title="Ubah / Ikat Ulang Machine ID (HWID)"
                        aria-label="Ubah Machine ID"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>

                <!-- Download Action Button -->
                <button
                    type="button"
                    on:click={() => openDownloadModal(license)}
                    class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-all border-0 flex-shrink-0"
                    title="Unduh Installer {license.product}"
                >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Unduh</span>
                </button>
            </div>

            <!-- Message / Expiry Subtitle -->
            <div class="text-[10px] text-[var(--text-3)] dark:text-slate-400 mt-1.5 truncate" title={license.message}>
                {license.message}
            </div>
        </div>
    {/each}
</div>
```

- [ ] **Step 2: Apply Desktop Table Visibility & High-Contrast Zebra Striping (`hidden md:block`)**

Wrap the desktop table inside `<div class="hidden md:block overflow-x-auto">` and update `<tbody>` row class:
```svelte
<tbody class="divide-y divide-[var(--border)] dark:divide-[#22314d]">
    {#each licenses as license, idx (license.id)}
        <tr class="transition-colors {idx % 2 === 0 ? 'bg-[var(--surface)] dark:bg-[#0c1322] hover:bg-slate-50 dark:hover:bg-[#18253f]' : 'bg-slate-100/70 dark:bg-[#141f36] hover:bg-slate-200/70 dark:hover:bg-[#1c2c4d]'}">
            <!-- Row cells -->
            ...
        </tr>
    {/each}
</tbody>
```

---

### Task 4: Responsive Pagination and Layout Tuning

**Files:**
- Modify: `client/src/lib/pages/Licenses.svelte:730-800`

**Interfaces:**
- Consumes: `pagination: PaginationMeta`, `pageNumbers: (number | string)[]`
- Produces: Responsive pagination toolbar cleanly aligned on both mobile and desktop

- [ ] **Step 1: Check pagination wrapping and alignment**

```svelte
{#if pagination.totalPages > 1 || pagination.totalItems > 0}
    <div class="p-3 sm:p-4 border-t border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface-2)] dark:bg-[#131d31]">
        <div class="text-xs text-[var(--text-3)] dark:text-slate-300 text-center sm:text-left">
            Menampilkan <strong class="text-[var(--text)] dark:text-white font-bold">{startRowIndex} - {endRowIndex}</strong> dari <strong class="text-[var(--text)] dark:text-white font-bold">{pagination.totalItems}</strong> lisensi
        </div>
        <div class="flex items-center gap-1.5 flex-wrap justify-center">
            <!-- Prev, Page Numbers, Next -->
        </div>
    </div>
{/if}
```

---

### Task 5: Browser Verification (Desktop & Mobile)

**Files:**
- Test via CDP Headless Chrome automation

- [ ] **Step 1: Build client and run verification script on mobile viewport (390x844)**

Verify that:
1. `#/member/licenses` renders with zero horizontal scrollbar on mobile.
2. Mobile cards display alternating zebra colors (`#0c1322` vs `#141f36` in dark mode).
3. Status filter dropdown is inline in the header and filters properly.
4. Copying license key shows "Disalin!" feedback.
5. Clicking HWID edit button opens the Machine ID modal cleanly.
6. Clicking "Unduh" opens the installer download popup modal.

- [ ] **Step 2: Verify on desktop viewport (1280x800)**

Verify that:
1. Desktop view renders full sortable 6-column table.
2. `SegmentedTabs` status pill navigates properly.
3. Alternating row zebra striping is distinct.

- [ ] **Step 3: Commit and Push**

Commit message: `feat(member-licenses): mobile card view with zero horizontal scroll, single-row compact toolbar, and high-contrast zebra striping`
Push to branch `origin reborn`.
