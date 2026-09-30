# Design Specification: Modern Compact Catalog Products Page

## 1. Overview & Problem Statement
The current Admin Products Catalog page (`AdminProducts.svelte`) has several visual and UX shortcomings:
- Excessive vertical whitespace occupied by oversized standalone stat cards and a detached search container.
- Redundant table columns (e.g. separate "Diskon" column showing mostly "Tidak ada").
- Lack of instant filtering by product category and publication status (Active / Inactive).
- Dated row formatting and disjointed action icons.

This specification modernizes the catalog into a high-density, clean, and responsive modern SaaS table interface (inspired by Stripe & Linear dashboards).

---

## 2. Key Architecture & Visual Elements

### 2.1 Unified Header & Compact Metric Chips
- **Top Header**:
  - Title: "Katalog Produk" + subtitle with dynamic count badge.
  - Primary Action Button: "Tambah Produk" (`+ Tambah Produk`) with brand styling.
- **Metric Chips Bar**:
  - Instead of 3 heavy card blocks, 4 compact chip pills are rendered horizontally:
    1. **Total Produk**: Total software count.
    2. **Aktif Tayang**: Active software count (emerald).
    3. **Nonaktif / Draft**: Inactive software count (zinc/amber).
    4. **Promo Diskon**: Discounted products count (amber/rose).

### 2.2 Integrated Search & Filter Pills Bar
- **Search Input**:
  - Left-aligned search input with keyboard icon and clear button.
- **Category & Status Quick Pills**:
  - Horizontal pill selector:
    - `Semua` (default)
    - `Aktif` / `Nonaktif`
    - `Kategori: [Category Name]` (dynamic based on available categories)
- **Sorting Dropdown**:
  - Sort by: Nama (A-Z), Harga (Termurah / Termahal), ID / Terkini.

### 2.3 High-Density Smart Table Layout
- **Column 1: Software / Produk**:
  - Thumbnail: Compact `36x36px` rounded-xl image with dynamic fallback monogram.
  - Title: Bold font with high contrast `var(--text)`.
  - Inline Meta: Category badge (purple pill) + ID/SKU badge + single-line truncated description.
- **Column 2: Kategori**:
  - Dedicated crisp category tag or fallback chip.
- **Column 3: Harga & Diskon (Smart Merged Cell)**:
  - Effective Selling Price (bold font).
  - If discounted: Original Price (strikethrough text) + Discount Tag (`-XX%` badge in amber/rose).
- **Column 4: Status Tayang**:
  - Interactive status pill with dot indicator (`Aktif` vs `Nonaktif`) with instant 1-click toggle.
- **Column 5: Aksi (Action Group)**:
  - Edit button (opens modal).
  - Delete button (triggers confirmation modal).

### 2.4 Theme-Adaptive & Responsiveness
- All background, borders, text, and accent colors strictly use CSS custom variables:
  - `var(--surface-1)`, `var(--surface-2)`, `var(--border)`, `var(--text)`, `var(--text-2)`, `var(--text-3)`, `var(--brand)`.
- Fluid horizontal scrolling on mobile/tablet screens with sticky table head.

---

## 3. Implementation Checklist
- [x] Create design spec document.
- [ ] Write detailed implementation plan.
- [ ] Refactor `client/src/lib/pages/AdminProducts.svelte`.
- [ ] Verify build, lint, and responsiveness across light & dark themes.
