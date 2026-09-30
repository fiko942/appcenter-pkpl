# Admin Payments UI/UX Overhaul & Custom Themed Date Range Picker Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menghilangkan seluruh elemen mentah browser (`<input type="date">`), memperbaiki responsivitas mobile secara drastis, serta merombak antarmuka halaman Daftar Pembayaran Admin (`AdminPayments.svelte`) mengikuti standar desain modern (Stripe/Linear class) dengan custom calendar popover, live debounced search, horizontal scrollable preset track, dan high-density desktop/mobile cards.

**Architecture:**
- **Frontend Component (`client/src/lib/pages/AdminPayments.svelte`)**:
  - Mengganti native date inputs dengan **Custom Themed Date Range Calendar Popover** (visual calendar grid, month/year navigator, start/end range selection, localized date labels).
  - Merombak Toolbar menjadi **Responsive 2-Row Glassmorphic Hub**:
    - Baris 1: Live search debounced dengan icon & clear button, Product `CustomSelect`, Sort `CustomSelect`, Refresh button.
    - Baris 2: Smooth horizontal scrollable pill track untuk preset waktu (`Semua Waktu`, `Bulan Ini`, `Bulan Kemarin`, `3 Bulan Terakhir`, `1 Tahun Terakhir`, `Kustom Tanggal`) dan tombol Reset Filter interaktif.
  - Merombak tabel desktop dan kartu mobile agar memiliki tipografi, badge status berpulsasi, token lisensi, dan grup tombol aksi yang rapi dan elegan.

**Tech Stack:** Svelte 4, TypeScript, Tailwind CSS, CustomSelect.

---

## Global Constraints
- **Single Port Invariant**: Server berjalan di port `4829`.
- **Git Branch Invariant**: Target branch adalah `master`.
- **Zero Raw HTML Date Inputs**: Dilarang menggunakan `<input type="date">`.
- **Mobile Responsive**: Area filter tidak boleh memakan lebih dari 140px tinggi layar di mobile.

---

### Task 1: Implement Custom Themed Date Range Calendar & Popover Logic

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

- [ ] **Step 1: Write Custom Calendar State & Navigation Engine**
  - Implement state for calendar popover open/close, current viewing month/year, hover date, selected start/end date.
  - Implement localized day names (`Min`, `Sen`, `Sel`, `Rab`, `Kam`, `Jum`, `Sab`) and month names.
  - Implement day grid generator with previous/next month padding days, in-range highlights, start/end badges.
- [ ] **Step 2: Implement Live Debounce for Search Input**
  - Add debounced search function (300ms) so typing automatically filters without requiring a separate "Cari Transaksi" button.

---

### Task 2: Redesign Toolbar & Mobile Responsive Layout

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

- [ ] **Step 1: Redesign Toolbar Row 1 (Search + Product + Sort)**
  - Full-width seamless search input with clear button.
  - Unified `CustomSelect` dropdowns for Product Filter and Sort.
- [ ] **Step 2: Redesign Toolbar Row 2 (Horizontal Scrollable Preset Track)**
  - Smooth horizontal scrolling track for period pills (`no-scrollbar overflow-x-auto`).
  - Active pill indicator with subtle brand glow.
  - Dedicated trigger button for "Kustom Tanggal" showing active selected date range string.
  - Active filter badge & reset button.

---

### Task 3: Redesign Desktop Table & Mobile Transaction Cards

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

- [ ] **Step 1: Elevate Desktop Table Rows**
  - Order ID & channel code badge.
  - Product thumbnail with smooth rounded-xl avatar and duration tag.
  - Price formatting with fee breakdown.
  - Status badge with pulsating dot (Emerald for Lunas, Amber for Pending).
  - License token monospace pill with copy button.
  - Unified action button group with tooltips.
- [ ] **Step 2: Elevate Mobile Card View (< md)**
  - Compact modern card layout with high density, touch-friendly action buttons, and clear status indicators.

---

### Task 4: Verification & Browser-Skill QA

**Files:**
- Test: Build client, TypeScript typecheck, take screenshots on Desktop & Mobile in Light & Dark modes via `browser-skill`.

- [ ] **Step 1: Run `npx tsc --noEmit` and `pnpm run build:client`**
- [ ] **Step 2: Verify in browser with `bsk screenshot` on 1440x900 and 390x844 viewports**
- [ ] **Step 3: Update `ZIQVA_STORE_ANALYSIS.md` & commit to git master**
