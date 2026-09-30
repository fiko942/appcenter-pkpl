# Admin Payments Responsive Split-Screen & Card-First Layout Elevation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memperbaiki masalah tampilan yang terpotong/overflow pada jendela split-screen, tablet, dan mobile di halaman Daftar Pembayaran Admin (`AdminPayments.svelte`), menghilangkan scrollbar default browser yang kaku pada preset pills, serta mengaktifkan layout kartu elegan (*Card-First*) pada seluruh layar `< 1200px` saat sidebar aktif.

**Architecture:**
- **Breakpoint Re-architecture (`AdminPayments.svelte`)**:
  - Karena sidebar admin memakan lebar `256px` (`md:pl-64`), konten area pada layar `< 1200px` (termasuk split-screen ~900px di Windows) hanya tersisa `~650px-900px`.
  - Mengubah breakpoint tabel desktop menjadi `hidden xl:block` dan mengaktifkan tampilan kartu modern pada `xl:hidden` agar split-screen dan tablet menampilkan kartu transaksi yang rapi tanpa terpotong (*zero horizontal overflow*).
- **Toolbar Responsive Grid**:
  - Pada layar `< xl` (split-screen / mobile), kotak pencarian mengambil lebar penuh (`w-full`), sementara dropdown *Produk* dan *Urutan* berjejer 50:50 di bawahnya sehingga teks *"Semua Produk"* dan *"Waktu Transaksi (Terbaru)"* tidak terpotong (*no ellipsis truncation*).
  - Pada layar `xl:` (desktop lebar), toolbar tersusun 1 baris yang luas.
- **Scrollbar Elimination**:
  - Menambahkan aturan CSS `.no-scrollbar` (`scrollbar-width: none; -ms-overflow-style: none; &::-webkit-scrollbar { display: none; }`) agar track preset periode dapat digeser dengan mulus tanpa memunculkan scrollbar abu-abu tebal khas OS.
- **Enhanced Mobile & Split-Screen Transaction Cards**:
  - Menata kartu transaksi dengan visual hierarchy yang jelas (Order ID, channel code, status badge berpulsasi, thumbnail produk, durasi, total bayar, token lisensi, dan tombol aksi seragam).

**Tech Stack:** Svelte 4, TypeScript, Tailwind CSS, CustomSelect.

---

### Task 1: Fix Scrollbar Elimination & Custom Themed Styles

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`
- Modify: `public/css/appcenter-theme.css`

- [ ] **Step 1: Add `.no-scrollbar` utility in `public/css/appcenter-theme.css` and local `<style>` in `AdminPayments.svelte`**
- [ ] **Step 2: Ensure Date Picker Popover is responsive and centered on narrow screens**

---

### Task 2: Re-architect Breakpoints and Toolbar Layout

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

- [ ] **Step 1: Toolbar Row 1 layout update**
  - Grid: `grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 gap-2.5`
  - Search: `sm:col-span-2 xl:col-span-6`
  - Product: `sm:col-span-1 xl:col-span-3`
  - Sort: `sm:col-span-1 xl:col-span-3`
- [ ] **Step 2: Update Table/Card breakpoint to `xl`**
  - Desktop Table: `hidden xl:block overflow-x-auto`
  - Mobile/Split-Screen Card View: `xl:hidden space-y-3`

---

### Task 3: Refine Card View for High-Density Split Screen & Mobile

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

- [ ] **Step 1: Build sleek card items with clean spacing, token copy button, and action buttons**
- [ ] **Step 2: Run typecheck and client build**
  Run: `npx tsc --noEmit` and `pnpm run build:client`

---

### Task 4: Visual Verification via Browser-Skill

**Files:**
- Test: Use `browser-skill` (`bsk`) on 950x850 (split-screen), 1440x900 (full desktop), and 390x844 (mobile).

- [ ] **Step 1: Capture screenshot on split screen (~950px width) to confirm zero overflow and perfect card rendering**
- [ ] **Step 2: Update `ZIQVA_STORE_ANALYSIS.md` & commit to git master**
