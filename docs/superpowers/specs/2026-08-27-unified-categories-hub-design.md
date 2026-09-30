# Design Specification: Unified Product Categories Hub (`AdminCategories.svelte`)

## 1. Problem Statement
1. **Light Mode Hover Bug**: The `+ Tambah Kategori` button used `hover:bg-[var(--brand-dark)]`, which was undefined in CSS, causing the background to vanish into white-on-white text when hovered in light mode.
2. **Fragmented 3-Card Stack**: Disjointed stat cards, detached search bar, and separated table container.
3. **Outdated Actions & Modal styling**: Non-solid modals and missing modern table layout.

---

## 2. Target Design & Components
1. **Header & Fixed Primary Button**:
   - Header with eyebrow `Katalog Software / Manajemen Kategori`.
   - Title: `Kategori Produk` + Total Count badge.
   - Primary button `+ Tambah Kategori Baru` with reliable, solid hover styling: `bg-[var(--brand)] hover:opacity-90 text-white shadow-md shadow-blue-500/20`.
2. **Single Unified Surface Card**:
   - **SegmentedTabs (Framer-Motion Sliding Pill)**: Top bar using `SegmentedTabs.svelte` (`Semua`, `Aktif`, `Nonaktif`).
   - **Single-Row Toolbar**: Search box (with live filter & clear button) + Sort selector (`CustomSelect`: `Nama A-Z`, `Produk Terbanyak`, `Terbaru`).
   - **High-Density Categories Table**:
     - Column 1: **Kategori & Identifier** (36x36px icon/monogram, Name bold, `#slug` subtext monospace).
     - Column 2: **Deskripsi** (clean clamped text).
     - Column 3: **Produk Terhubung** (purple pill `X Produk`).
     - Column 4: **Status Tayang** (1-click active/inactive toggle with pulsing dot).
     - Column 5: **Aksi** (32x32px rounded modern buttons: Edit pencil & Delete trash).
   - **Footer Counter**: `Menampilkan X dari Y kategori`.
3. **Polished Solid Modals**:
   - Add/Edit Category Modal: Solid `bg-white dark:bg-[#101827]`, icon uploader with live preview, auto slug generation, `CustomCheckbox` for active status.
   - Delete Confirmation Modal: Red warning badge, connection warnings if linked products exist, solid red confirmation button.
