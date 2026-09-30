# Admin Payments Full UI/UX & Responsiveness Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki seluruh masalah UI/UX dan responsivitas pada halaman Daftar Pembayaran Admin (`AdminPayments.svelte`), mencakup perombakan layout split-screen & mobile card grid, live search loading indicator, popover kalender dengan target sentuh lebih besar dan navigasi tahun/bulan cepat, standarisasi numbered pagination, penataan action dock & salin data, serta penyelarasan kontras Light & Dark mode.

**Architecture:**
1. **Responsive Layout & Card Grid**:
   - Split-screen Windows (~950px dengan sidebar 256px menyisakan ~694px) menggunakan `grid-cols-1 md:grid-cols-2` yang proporsional sehingga teks dan tombol aksi tidak berdesakan.
   - Mobile (< 640px) menggunakan `grid-cols-1` dengan card padding yang rapi (`p-4`) dan visual hierarchy yang tegas.
2. **Toolbar & Filter Controls**:
   - Live Search: Menyematkan mikro loading spinner saat proses fetch berlangsung (`loading`), serta tombol clear `✕`.
   - Preset Periode: Track horizontal `no-scrollbar` dengan tombol **✕ Reset Filter** yang selalu terlihat di sisi kanan tanpa terdorong keluar viewport.
3. **Custom Themed Calendar Popover (Datepicker)**:
   - Target sentuh tanggal diperbesar menjadi `h-9` (36px) untuk kemudahan klik di desktop dan mobile.
   - Navigasi Cepat: Tambahkan tombol lompat tahun (`<<` dan `>>`) atau selector cepat tahun/bulan.
4. **Data Presentation (Table & Cards)**:
   - Desktop: Tambahkan salin email pelanggan, status token lisensi yang jelas, hit area tombol aksi `w-8 h-8` dengan tooltip rapi.
   - Mobile: Tata ulang Action Dock dengan tombol terstruktur yang tidak melipat baris secara canggung.
5. **Numbered Pagination**:
   - Terapkan generator `getPageNumbers(currentPage, totalPages)` untuk menampilkan tombol nomor halaman (`1, 2, ..., N`) yang konsisten dengan halaman admin lainnya.

**Tech Stack:** Svelte 4, TypeScript, Tailwind CSS, CustomSelect.

---

## Tasks

- [ ] **Task 1: Update Toolbar, Search Loading State, and Reset Pill**
- [ ] **Task 2: Overhaul Calendar Popover with Large Touch Targets & Year Controls**
- [ ] **Task 3: Refine Desktop Table, Mobile Card Grid, and Actions Dock**
- [ ] **Task 4: Implement Numbered Pagination Logic and Controls**
- [ ] **Task 5: Compile & Build Verification**
- [ ] **Task 6: Browser QA Verification across 1440px, 950px, and 390px Viewports**
