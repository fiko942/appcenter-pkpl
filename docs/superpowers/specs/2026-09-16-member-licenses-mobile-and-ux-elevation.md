# Member Licenses & Devices Mobile Ergonomics & UI/UX Elevation Specification

**Date:** 2026-09-16  
**Status:** Approved  
**Author:** Grok (Pair Programming)  
**Target:** `client/src/lib/pages/Licenses.svelte`

---

## 1. Executive Summary & Problem Definition

On the Member Portal's "Manajemen Lisensi & Perangkat" page (`#/member/licenses`), mobile viewports (`< md` / `< 768px`) currently force users to scroll a wide table horizontally (`overflow-x-auto`) across 6 dense columns (No, Software & Durasi, Serial Key, Status, Machine ID HWID, Aksi). 

Furthermore:
1. Status filtering tabs (`SegmentedTabs`) scroll horizontally off-screen on narrow viewports instead of offering a compact, right-aligned dropdown selector.
2. Table rows lack distinct zebra striping contrast, making consecutive rows ambiguous in dark mode.
3. The toolbar layout on small screens is stacked and bulky rather than a streamlined single-row compact bar.

Following the design system and ergonomics established on `Orders.svelte` and `MemberInvoices.svelte`, this specification establishes a mobile-first, high-density card architecture with zero horizontal scrollbars, single-row compact search/filter integration, and high-contrast zebra striping.

---

## 2. Design Requirements & System Specifications

### 2.1 Viewport Ergonomics & Responsive Breakpoints
- **Desktop (`>= md` / `>= 768px`)**:
  - Keep the full-featured multi-column sortable table (`hidden md:table` or `hidden md:block`).
  - Keep `SegmentedTabs` status filter with sliding pill animation above the table card container.
  - Implement high-contrast alternating row striping:
    - **Odd rows**: `bg-[var(--surface)] dark:bg-[#0c1322]` (`rgb(12, 19, 34)`), hover: `hover:bg-slate-50 dark:hover:bg-[#18253f]`.
    - **Even rows**: `bg-slate-100/70 dark:bg-[#141f36]` (`rgb(20, 31, 54)`), hover: `hover:bg-slate-200/70 dark:hover:bg-[#1c2c4d]`.
- **Mobile (`< md` / `< 768px`)**:
  - Completely hide the wide scrolling table (`block md:hidden`).
  - Render dedicated high-density mobile cards.
  - Alternating card backgrounds:
    - **Odd cards**: `bg-[var(--surface)] dark:bg-[#0c1322] border-[var(--border)] dark:border-[#1e293b]`.
    - **Even cards**: `bg-slate-100/70 dark:bg-[#141f36] border-slate-200 dark:border-[#22314d]`.
  - Zero horizontal overflow (`overflow-x-hidden`).

### 2.2 Mobile Card Layout Hierarchy
Each mobile license card must feature:
1. **Header Row**:
   - Product Icon / Avatar (36x36px with fallback uppercase letter).
   - Product Name (bold, text-sm, truncate).
   - Duration badge (`px-1.5 py-0.5 rounded text-[10px]`).
   - Tutorial quick link with play icon (if `license.hasTutorials`).
   - Status badge (top-right):
     - Active: Emerald pill with pulsing green indicator dot.
     - Unused: Blue pill with blue indicator dot ("Siap Pakai").
     - Expired: Rose pill with rose indicator dot ("Kadaluarsa").
2. **Key & HWID Grid / Strip**:
   - **Serial Key Strip**: Monospace styled box, 1-touch copy with instant "Disalin!" feedback.
   - **Machine ID (HWID)**: Monospace preview with copy button and edit button (pencil icon) that triggers `openHwidModal(license)`. If unassigned, show "Belum terikat" in subtle italic with quick bind button.
3. **Card Footer & Action Bar**:
   - Left: Status message / expiry countdown formatted text (`text-[11px] text-[var(--text-3)]`).
   - Right: "Unduh Installer" button with download icon (`openDownloadModal(license)`).

### 2.3 Single-Row Compact Header Toolbar
- In the table container header (`p-3 sm:p-4 flex items-center justify-between gap-2.5 bg-[var(--surface-2)] dark:bg-[#131d31]`):
  - **Left**: Flexible search input (`flex-1 md:w-80 relative`) with clear button.
  - **Right (Mobile `< md`)**: Compact, right-aligned, content-fitted status filter `CustomSelect` dropdown.
  - **Right (Desktop `>= md`)**: Page size selector (`CustomSelect`) and total licenses counter badge.

### 2.4 Theme & Contrast Tokens
- Light Mode:
  - Odd: `var(--surface)` / `#ffffff`
  - Even: `rgba(241, 245, 249, 0.70)` (`slate-100/70`)
- Dark Mode:
  - Odd: `#0c1322` (`rgb(12, 19, 34)`)
  - Even: `#141f36` (`rgb(20, 31, 54)`)
  - Border: `#22314d` (header/borders) & `#1e293b` (cards)

---

## 3. Verification Criteria
1. Mobile viewport test at 390x844px and 400x520px:
   - Zero horizontal overflow.
   - Distinct zebra-striped alternating cards.
   - Status dropdown fits without overflowing.
   - 1-touch copy key and HWID modal work properly.
   - Installer download popup modal triggers and renders seamlessly.
2. Desktop viewport test at 1280x800px:
   - Full 6-column table renders with alternating row contrast.
   - `SegmentedTabs` status filter operates with animated pill.
3. Clean memory destruction on `onDestroy` (all timer handles cleared).
