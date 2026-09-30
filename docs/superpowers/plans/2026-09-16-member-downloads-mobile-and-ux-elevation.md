# Implementation Plan: Member Download Hub Mobile & UI/UX Elevation

- **Document ID**: `docs/superpowers/plans/2026-09-16-member-downloads-mobile-and-ux-elevation.md`
- **Spec Reference**: `docs/superpowers/specs/2026-09-16-member-downloads-mobile-and-ux-elevation.md`
- **Module**: `client/src/lib/pages/Downloads.svelte`
- **Goal**: Elevate Member Download Hub (`#/member/downloads`) on mobile (`390x844`) and desktop (`1280x800`) with compact toolbar, Raycast-style high-density cards, pulsating status dots, and physics sliding pill tab animations.

---

## Proposed Changes & Step-by-Step Plan

### Step 1: Reactive State & Tab Configurations (`Downloads.svelte`)
- Import `SegmentedTabs.svelte` alongside `CustomSelect.svelte`.
- Construct reactive `dropdownFilterOptions` for the mobile dropdown:
  - `Semua Software (${filterCounts.all})` -> `all`
  - `Windows (${filterCounts.win})` -> `win`
  - `macOS (${filterCounts.mac})` -> `mac`
  - `Ada Tutorial (${filterCounts.tutorial})` -> `tutorial`
- Construct reactive `desktopTabs` for `SegmentedTabs`:
  - `id: 'all'`, `label: 'Semua Software'`, `count: filterCounts.all`, `color: 'blue'`
  - `id: 'win'`, `label: 'Windows'`, `count: filterCounts.win`, `color: 'blue'`
  - `id: 'mac'`, `label: 'macOS'`, `count: filterCounts.mac`, `color: 'slate'`
  - `id: 'tutorial'`, `label: 'Ada Tutorial'`, `count: filterCounts.tutorial`, `color: 'purple'`
- Add modal sliding pill index calculation for 3-way platform switching (`all` -> `0%`, `windows` -> `100%`, `mac` -> `200%`).

### Step 2: Responsive Single-Row Toolbar & Desktop Tabs
- Replace the 2-row mobile search & raw button bar with a **Single-Row Compact Toolbar**:
  - `block md:hidden`: Single container housing flex-1 search input + right-aligned `CustomSelect`.
- In `hidden md:block`:
  - Split header with Title/Description on left, search box on right.
  - Sleek `SegmentedTabs` component with sliding pill backdrop animation.

### Step 3: Raycast-Style High-Density Software Cards
- Elevate software cards into sleek `rounded-2xl` containers:
  - Top row: Software Icon (with fallback gradient avatar) + Title & Category badge + Platform tags (`Win`, `Mac`).
  - Pulsating status dot: Emerald `• N File Installer` for available software, amber badge for pending uploads.
  - Action Bar:
    - Primary solid blue `Unduh Installer (N)` button.
    - Secondary purple `Buka Video Panduan (N)` button (when tutorial chapters exist).
    - Compact, high-contrast, tactile styling.

### Step 4: Download Installer Pop-up Modal Elevation
- Upgrade the OS platform tabs inside `#showDownloadModal`:
  - 3-segment sliding pill switcher (`Semua Platform`, `Windows`, `macOS`) with smooth CSS cubic-bezier transition `ease-[cubic-bezier(0.16,1,0.3,1)]`.
- Style file rows:
  - Official Windows and Apple SVGs in rounded badge containers.
  - File extension badges (`EXE`, `DMG`, `ZIP`, `PKG`, `APP`).
  - Monospace file size indicators.
  - Tactile "Unduh" button.
  - Direct tutorial link in footer.

### Step 5: Verification & Browser Testing
- Run automated headless Chrome CDP scripts across:
  - Mobile viewport: `390x844` (iPhone 14 emulation).
  - Desktop viewport: `1280x800`.
- Verify search debounce, dropdown switching, modal opening/closing, sliding pill transitions, and direct download links.

### Step 6: Memory Update & Push
- Update `docs/CONTEXT_SNAPSHOT.yaml` and `ZIQVA_STORE_ANALYSIS.md`.
- Commit changes and push strictly to branch `reborn`.
