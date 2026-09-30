# Admin Payments Advanced Filtering, Date Range Presets & Sorting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan filter periode tanggal dengan preset cepat (Bulan Ini, Bulan Kemarin, 3 Bulan Terakhir, 1 Tahun Terakhir, Kustom Range), filter produk software dinamis, serta opsi sorting lengkap pada halaman Daftar Pembayaran Admin (`AdminPayments.svelte` & `adminController.ts`).

**Architecture:**
- **Backend (`src/controllers/adminController.ts`)**: Method `apiGetPayments` diperluas untuk menerima parameter query `period`, `startDate`, `endDate`, `product`, `sort`, `order`. Backend menghitung rentang epoch timestamp secara akurat berdasarkan zona waktu lokal, memfilter kolom `created`/`items`, serta mengembalikan daftar `availableProducts` untuk dropdown frontend.
- **Frontend (`client/src/lib/pages/AdminPayments.svelte`)**: Mengimplementasikan **Toolbar 2 Baris Terpadu (Opsi A)**:
  - Baris 1: Pencarian live, Dropdown Filter Produk (`CustomSelect`), Dropdown Pengurutan (`CustomSelect`), dan tombol Refresh.
  - Baris 2: Segmented Preset Pills (`Semua Waktu`, `Bulan Ini`, `Bulan Kemarin`, `3 Bulan Terakhir`, `1 Tahun Terakhir`, `Kustom`) + Input date range (*Dari Tanggal* s/d *Sampai Tanggal*) dan tombol Reset Filter cepat.

**Tech Stack:** Express 5, TypeScript 5.9, Prisma ORM 6, MySQL, Svelte 4, Tailwind CSS, CustomSelect.

---

## Global Constraints
- **Single Port Invariant**: Server berjalan di port `4829`.
- **Git Branch Invariant**: Target branch adalah `master`.
- **Database Connection Pool**: Tetap maksimal 5 koneksi.
- **Custom Svelte Components**: Wajib menggunakan `CustomSelect.svelte` untuk dropdown sorting dan filter produk.

---

### Task 1: Backend `apiGetPayments` Enhancement

**Files:**
- Modify: `src/controllers/adminController.ts:1375-1540`

**Interfaces:**
- Consumes: `req.query.period`, `req.query.startDate`, `req.query.endDate`, `req.query.product`, `req.query.sort`, `req.query.order`, `req.query.timezone`
- Produces: JSON `{ status: 'success', data: { payments, totalPayments, page, totalPages, availableProducts, stats } }`

- [ ] **Step 1: Update `apiGetPayments` in `src/controllers/adminController.ts`**
  - Parse `period`, `startDate`, `endDate`, `product`, `sort`, `order`, `timezone`.
  - Build date range filter on `created` (epoch seconds):
    - `this_month`: start of current month (00:00:00) to now.
    - `last_month`: start of previous month (00:00:00) to end of previous month (23:59:59).
    - `last_3_months`: now minus 90 days (7,776,000 seconds) to now.
    - `last_1_year`: now minus 365 days (31,536,000 seconds) to now.
    - `custom`: parse `startDate` (00:00:00) and `endDate` (23:59:59).
  - Build product filter on `items` (JSON contains product name or ID).
  - Fetch `availableProducts` (`prisma.products.findMany({ select: { id: true, name: true, image: true }, orderBy: { name: 'asc' } })`).
  - Support sorting by `created`, `total_amount`, `paid_at`, `id`.

- [ ] **Step 2: Run TypeScript typecheck**
  Run: `npx tsc --noEmit`
  Expected: 0 errors.

---

### Task 2: Frontend `AdminPayments.svelte` UI & Reactive Filters

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: `GET /admin/api/payments` with expanded query parameters.
- Produces: 2-Row Integrated Toolbar with Period Preset Pills, Product Filter Dropdown, Sort Dropdown, and Custom Date Range picker.

- [ ] **Step 1: Add State Variables & Options in `AdminPayments.svelte`**
  - `periodPreset`: `'all' | 'this_month' | 'last_month' | 'last_3_months' | 'last_1_year' | 'custom'` (default `'all'`).
  - `customStartDate`: `string` (YYYY-MM-DD).
  - `customEndDate`: `string` (YYYY-MM-DD).
  - `selectedProduct`: `string` (default `'all'`).
  - `availableProducts`: array of product items.
  - `sortOptions`: expanded options (Waktu Transaksi Terbaru/Terlama, Nominal Tertinggi/Terendah, Tanggal Lunas Terkini, Order ID Terbesar/Terkecil).

- [ ] **Step 2: Implement Reactive Filter Handlers**
  - `handlePeriodChange(preset)`: Updates preset, resets page to 1, fetches data.
  - `handleCustomDateSubmit()`: Validates and triggers fetch for custom range.
  - `handleProductChange(val)`: Updates selected product, resets page to 1, fetches data.
  - `handleResetFilters()`: Clears search, resets product to `'all'`, resets period to `'all'`, resets sort to default.

- [ ] **Step 3: Render 2-Row Integrated Toolbar Markup**
  - Row 1: Search bar, Product `CustomSelect`, Sort `CustomSelect`, Refresh button.
  - Row 2: Period Preset Pills with smooth active highlight, Custom date inputs when 'custom' is active, and Reset Filter badge when active filters exist.

- [ ] **Step 4: Build Client Verification**
  Run: `cd client && pnpm run build`
  Expected: 0 errors.

---

### Task 3: Full End-to-End Verification & Documentation

**Files:**
- Modify: `ZIQVA_STORE_ANALYSIS.md`

- [ ] **Step 1: Test TypeScript and Svelte Compilation**
  Run: `npx tsc --noEmit` and `pnpm run build:client`
- [ ] **Step 2: Test API query execution with curl/fetch**
- [ ] **Step 3: Update documentation in `ZIQVA_STORE_ANALYSIS.md`**
