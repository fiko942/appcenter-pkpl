# Specification: Member Download Hub Mobile & UI/UX Elevation

- **Document ID**: `docs/superpowers/specs/2026-09-16-member-downloads-mobile-and-ux-elevation.md`
- **Module**: Member Download Hub (`#/member/downloads`)
- **Target Viewports**: Mobile (`< 768px`, tested at 390x844 iPhone 14) & Desktop (`>= 1024px`, tested at 1280x800)
- **Status**: Drafted / Ready for Implementation

---

## 1. Executive Summary & Problem Statement

### 1.1 Context
The Member Download Hub (`#/member/downloads`) serves as the official repository where authenticated members download software installers (Windows `.exe`, macOS `.dmg` / `.zip` / `.pkg`) and jump directly to relevant video tutorial playlists (`#/member/tutorials/:id`).

### 1.2 Identified UI/UX Gaps on Mobile (`390x844`)
1. **Vertical Bloat & Disconnected Filter Controls**:
   - The search input is currently placed as a full-width input taking a whole row.
   - Below it, 4 raw filter buttons (`Semua Software`, `Windows`, `macOS`, `Ada Tutorial`) are rendered in a horizontal row with overflow scroll, creating an awkward 2-row header (~110px height) before any software card appears.
   - This is inconsistent with the modern single-row compact toolbar established across `Orders.svelte`, `Invoices.svelte`, `Licenses.svelte`, and `Tutorials.svelte`.
2. **Software Card Bulkiness**:
   - Each card is excessively tall (~270px-300px), allowing only 1.5 cards on screen at a time.
   - Two stacked full-width buttons (`Unduh Installer` in solid blue + `Buka Video Panduan` in purple) create unnecessary vertical sprawl.
   - Plain text badges without live pulsating status indicators lack visual polish.
3. **Download Modal Tab Switcher Animation**:
   - Inside the pop-up modal (`#showDownloadModal`), platform selector tabs (`Semua Platform`, `Windows`, `macOS`) are rendered as static bordered buttons without fluid sliding pill animation.

---

## 2. Target Design & UI/UX Architecture

### 2.1 Single-Row Compact Mobile Toolbar (`< 768px`)
- **Container**: Elevated `rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] p-2.5 flex items-center justify-between gap-2 shadow-2xs`.
- **Search Input (Left)**: `flex-1 min-w-0 relative` with magnifying glass SVG icon, smooth focus ring, and clear button (`x`).
- **Filter Dropdown (Right)**: Compact `CustomSelect` dropdown with reactive count indicators:
  - `Semua Software (N)` (value: `all`)
  - `Windows (N)` (value: `win`)
  - `macOS (N)` (value: `mac`)
  - `Ada Tutorial (N)` (value: `tutorial`)

### 2.2 Desktop Segmented Filter Tabs (`>= 768px`)
- **Desktop Toolbar**: Clean split header with Title + Subtitle on the left and Search Box on the right.
- **Segmented Filter Bar**: Integrated `SegmentedTabs` component with Framer Motion-style physics sliding pill backdrop and OS platform icons.

### 2.3 Raycast-Style High-Density Software Cards
- **Header**: Product image / high-contrast letter avatar, product title (truncated cleanly), category pill, and OS badges (`Win`, `Mac`).
- **Live Status Indicator**:
  - Available installers: Emerald pill with live pulsating green dot (`• N File Installer`).
  - No installer: Amber warning badge (`Belum Ada Installer`).
- **Ergonomic Action Bar**:
  - Primary button: Solid blue button with download icon (`Unduh Installer`).
  - Secondary tutorial button: If tutorials exist (`parseTutorials(p.tutorials).length > 0`), display a sleek high-contrast purple shortcut button with play icon (`Panduan (N)`).
  - Compact side-by-side or slim stacked layout optimized for one-thumb mobile interaction.

### 2.4 Elevated Download Installer Pop-up Modal
- **Physics Sliding Pill Tab Switcher**:
  - Modern segmented tab switcher (`Semua Platform`, `Windows`, `macOS`) with smooth CSS cubic-bezier sliding pill indicator (`ease-[cubic-bezier(0.16,1,0.3,1)]`).
- **File List Items**:
  - Platform SVG badges (Windows official logo / Apple logo).
  - Monospace uppercase file extension chips (`EXE`, `DMG`, `ZIP`, `PKG`, `APP`).
  - Monospace file size label (`83.99 KB`).
  - High-contrast "Unduh" button with tactile hover/active transitions.
- **Quick Tutorial Link Footer**: Direct shortcut to `#/member/tutorials/:id` for seamless onboarding.

---

## 3. Responsive Breakpoint & Layout Matrix

| Viewport Size | Header & Filter Layout | Software Grid | Modal Layout |
|---|---|---|---|
| **Mobile (`< 768px`)** | Single-row search + `CustomSelect` dropdown | 1-column high-density cards with compact actions | Full-screen / bottom-anchored modal with sliding pill OS tabs |
| **Tablet (`768px - 1023px`)** | Split header (Title + Search) + `SegmentedTabs` | 2-column grid | Centered rounded-3xl dialog |
| **Desktop (`>= 1024px`)** | Split header + `SegmentedTabs` with smooth sliding pill | 3-column grid | Centered rounded-3xl dialog with backdrop blur |

---

## 4. Verification & Testing Protocol

1. **Headless Chrome CDP Automated Tests**:
   - Mobile viewport (`390x844`) emulation.
   - Desktop viewport (`1280x800`) validation.
2. **Interactive Flow Checks**:
   - Real-time search query filtering and instant dropdown filter transitions.
   - Clicking "Unduh Installer" opens modal with correct product files and auto-selected OS tab.
   - Sliding pill animation smoothly transitions between `Semua Platform`, `Windows`, and `macOS`.
   - Direct download links trigger official file downloads (`rel="noopener noreferrer"`).
   - "Buka Video Panduan" navigates seamlessly to `#/member/tutorials/:id`.
