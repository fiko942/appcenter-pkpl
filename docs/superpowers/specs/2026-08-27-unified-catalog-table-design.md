# Design Specification: Unified Enterprise Catalog Products Table Hub

## 1. Executive Summary & Problems Addressed
The previous catalog layout suffered from:
1. **Redundant dual filters**: Top stat cards and sub-search pills competed for status filtering.
2. **Fragmented 3-tier card stack**: Disconnected stat boxes, detached search box, and separated table.
3. **Outdated action icons**: Floating thin outline icons.
4. **Poor categorization UX**: Missing dedicated category selector in toolbar.

This design consolidates the entire page into a **Single Unified Data Hub Surface** inspired by modern enterprise SaaS standards (Linear, Stripe).

---

## 2. Structural & Visual Architecture

### 2.1 Unified Page Layout
```
+---------------------------------------------------------------------------------------------------+
|  [Header]: Katalog Produk (Count)                                               [+ Tambah Produk] |
+---------------------------------------------------------------------------------------------------+
|  [UNIFIED TABLE CARD]                                                                             |
|  +---------------------------------------------------------------------------------------------+  |
|  | [Segmented Status Tabs]: Semua (22) | Aktif (3) | Nonaktif (19) | Diskon (0)                 |  |
|  +---------------------------------------------------------------------------------------------+  |
|  | [Unified Toolbar]:                                                                          |  |
|  | [🔍 Cari software...]          [Kategori: Semua ▾]   [Urutkan: Terbaru ▾]  [Tampilkan: 10/hal ▾]|  |
|  +---------------------------------------------------------------------------------------------+  |
|  | [HIGH-DENSITY DATA TABLE]                                                                   |  |
|  | SOFTWARE / PRODUK           | KATEGORI        | HARGA & DISKON   | STATUS TAYANG | AKSI        |  |
|  | [Icon] Name + SKU/ID        | [Tag Badge]     | Rp 49.900        | [🟢 Aktif]    | [✏️] [🗑️]   |  |
|  +---------------------------------------------------------------------------------------------+  |
|  | [FOOTER PAGINATION BAR]                                                                     |  |
|  | Menampilkan 1-10 dari 22 produk                                 [< Prev] [1] [2] [3] [Next >]|  |
+--+---------------------------------------------------------------------------------------------+--+
```

### 2.2 Component Specifications
1. **Segmented Status Tabs**:
   - Single unified segmented tab bar at the top of the table container:
     - `Semua ({stats.total})`
     - `Aktif ({stats.active})`
     - `Nonaktif ({stats.inactive})`
     - `Promo Diskon ({stats.discount})`
   - Active tab: Solid brand background or clean elevated pill with subtle shadow.
2. **Unified Toolbar (Single Row)**:
   - Search Input (with search SVG, 300ms server debounce, and clear button).
   - Category Filter: `CustomSelect` (`Semua Kategori`, `#Kategori A`, `#Kategori B`).
   - Sort Selector: `CustomSelect` (`Terbaru`, `Nama A-Z`, `Harga Termurah`, `Harga Termahal`).
   - Items Per Page: `CustomSelect` (`10`, `25`, `50`, `100 per hal`).
3. **High-Density Table Cells**:
   - **Software / Produk**: Rounded-xl `36x36px` icon/avatar, bold title, monospace SKU & ID tag, single-line description.
   - **Kategori**: Crisp category pill (`bg-purple-500/10 text-purple-400 border border-purple-500/20`) or neutral `-` if unassigned.
   - **Harga & Diskon**: Effective selling price in bold, optional strikethrough price, and `-XX%` badge.
   - **Status Tayang**: 1-click interactive toggle pill with live pulsing dot indicator.
   - **Aksi**: Modern rounded action buttons with refined SVGs:
     - **Edit**: `p-2 rounded-xl bg-[var(--surface-2)] text-[var(--text-2)] hover:bg-[var(--brand)] hover:text-white transition-all` with SVG pencil.
     - **Hapus**: `p-2 rounded-xl bg-[var(--surface-2)] text-red-400 hover:bg-red-500 hover:text-white transition-all` with SVG trash bin.
4. **Footer Pagination Bar**:
   - Entry counter, previous button, page number pills, next button.

---

## 3. Implementation Verification Checklist
- [x] Unified single-card structure.
- [x] Segmented status tabs (no duplicate stat cards).
- [x] Category dropdown integrated into single toolbar with search & sort.
- [x] Modernized action button icons.
- [x] All native select dropdowns replaced with Svelte `CustomSelect`.
- [x] 100% theme adaptive across Light and Dark modes.
