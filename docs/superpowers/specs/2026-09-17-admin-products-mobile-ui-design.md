# Specification: Admin Products Catalog Mobile & Desktop UI/UX Redesign

## 1. Overview
The Admin Product Catalog (`client/src/lib/pages/AdminProducts.svelte`) requires responsive mobile and desktop UI/UX refinements:
1. **Header & Badge**: The "Katalog Produk" heading and `{totalCount} Produk` badge sit in a clean inline layout with `whitespace-nowrap`, while the "+ Tambah Produk Baru" CTA is aligned to the right on both desktop and mobile.
2. **Segmented Tabs Status Filter**: A top-level segmented status bar (`Semua`, `Aktif`, `Nonaktif`, `Promo Diskon`) with smooth sliding pill animations, horizontally swipeable on mobile and cleanly integrated at the top of the card.
3. **Balanced Filter & Sort Toolbar**: Category and Sort dropdowns are arranged in a balanced 2-column grid on mobile (`grid grid-cols-2 gap-2.5 w-full`) and an inline flex row on desktop (`md:flex`), eliminating awkward wrapping.
4. **Product List (Card/Item View on Mobile)**: Mobile screens (< 768px / `md`) render a sleek, responsive touch-optimized card/list item view, while retaining the high-density table view on desktop (`hidden md:block`).

## 2. Requirements & Visual Design

### 2.1 Header Row Layout
- **Mobile (< 640px / `sm`)**:
  - Left: Eyebrow pill ("Katalog Software"), Main Title "Katalog Produk" with inline counter badge ("{totalCount} Produk" with `whitespace-nowrap`).
  - Right: "+ Produk" CTA button with icon.
  - Subtitle: "Kelola software aplikasi, lisensi, penyesuaian harga..." placed directly underneath.
- **Desktop (>= 640px / `sm`)**:
  - Full title with badge inline, subtitle below, and "Tambah Produk Baru" button aligned on the far right.

### 2.2 Segmented Tabs & Toolbar
- **Segmented Tabs Bar**:
  - Placed at the top of the card (`p-3 sm:p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/30 overflow-x-auto no-scrollbar`).
  - Tab items: `Semua ({totalCount})`, `Aktif ({activeCount})`, `Nonaktif ({inactiveCount})`, `Promo Diskon ({discountCount})`.
- **Toolbar**:
  - Live Search Box: Full width on mobile, flexible (`flex-1`) on desktop.
  - Category & Sort dropdowns:
    - Mobile (< 768px): 2-column grid (`grid grid-cols-2 gap-2.5 w-full`) with `fullWidth={true}` so both dropdowns take exactly 50% width and align with the search bar above.
    - Desktop (>= 768px): Inline flex (`w-52` for Category and `w-56` for Sort).
  - Sort options clearly labeled: `Status: Aktif Dahulu`, `Status: Nonaktif Dahulu`, `Terbaru Ditambahkan`, `Nama Produk (A - Z)`, `Harga: Termurah`, `Harga: Termahal`.

### 2.3 Mobile Product Cards (`md:hidden`)
On mobile devices (< 768px / `md`), each product renders as a modern, high-touch card inside a responsive stack (`space-y-3 p-3 sm:p-4`):
- **Header row in card**:
  - Product Avatar/Icon (40x40px rounded-xl border with fallback initial).
  - Title & Bundle badge (`📦 BUNDEL`).
  - ID & SKU monospace chips.
  - Active/Inactive toggle button (pill status switch, 1-tap toggling `toggleStatus(prod)`).
- **Middle section**:
  - Multi-category badges with category icons.
  - Description (2-line clamp, small font).
  - Pricing display:
    - If free (0): "GRATIS (Rp 0)" badge in emerald.
    - If discounted: Bold discounted price + strikethrough original price + discount percent badge (`-{prod.discount_percent}%`).
    - If regular: Bold formatted Rupiah price.
- **Interactive Action Badges**:
  - Video Tutorial button (purple badge showing count e.g. "2 Video" or "+ Tutorial", clicking opens `openTutorialPlayer(prod)` or edit).
  - Setup / Installer Files button (shows Windows and macOS badge counters, clicking opens `openInstallerModal(prod)`).
- **Card Footer**:
  - Edit button (`openEditModal(prod)`) and Delete button (`openDeleteModal(prod)`) with clear SVG stroke icons.

### 2.4 Desktop Table View (`hidden md:block`)
- Preserves the full high-density table for desktop viewports (>= 768px).

### 2.5 Pagination Bar
- Responsive layout ensuring page numbers, previous/next buttons, and per-page select adapt smoothly across all screen widths.

## 3. Verification Strategy
- Browser automation with `bsk` emulating iPhone 14 (390x844) and desktop (1280x800).
- Visual verification of single-line header, segmented tabs, 2-column mobile dropdowns, and high-density desktop toolbar.
- Production build validation (`npm run build` in `client`).
