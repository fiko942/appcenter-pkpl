# Member Tutorials Page: Mobile Ergonomics & UI/UX Elevation Specification

**Date**: 2026-09-16  
**Status**: Completed & Verified  
**Target Route**: `#/member/tutorials` & `#/member/tutorials/:id`  
**Primary File**: `client/src/lib/pages/Tutorials.svelte`

---

## 1. Executive Summary & Problem Analysis

### Current State
The Member Video Tutorials module serves as the primary onboarding and learning portal for all software and automation bots. However, on mobile viewports (`< 768px`, e.g. 390x844 iPhone / Android devices), several critical UX friction points exist:

1. **Catalog Overview (`#/member/tutorials`)**:
   - Excessive vertical header padding and oversized decorative icons push product cards too far below the fold.
   - Filter tabs use horizontally overflowing scroll containers (`overflow-x-auto`) which can be awkward to swipe on small screens.
   - Product catalog cards are oversized (~230px height each) with generic button styles, fitting only 1–2 items per viewport.

2. **Product Detail & Video Player (`#/member/tutorials/:id`)**:
   - Top breadcrumb and title take up ~150px of vertical height.
   - A separate "Learning Progress Bar" card sits directly between header and video player, pushing the YouTube video player completely below the fold on mobile.
   - The chapter playlist stacks beneath both the video player and the "Now Playing" metadata card. To change chapters, mobile users must scroll past the entire player and info section.
   - Tab switching was abrupt without smooth sliding indicator physics.

---

## 2. Design Vision & Architectural Solution (UI/UX Pro Max)

We will re-architect `client/src/lib/pages/Tutorials.svelte` into a high-density, modern Raycast/Linear-style learning experience:

### A. Catalog Grid Overview (`#/member/tutorials`)
- **Compact Hero Toolbar**:
  - High-density header with product category badge and concise copy.
  - Single-row mobile toolbar combining reactive search input (`Cari software...`) and a `CustomSelect` status filter dropdown (`Semua Software`, `Tersedia Video Panduan`, `Belum Ada Video`).
- **Unified Desktop SegmentedTabs**:
  - Desktop catalog filters upgraded to `SegmentedTabs` with synchronized sliding pill animation.
- **High-Density Mobile Software Cards**:
  - Compact 44x44 icon container with subtle shadow and border.
  - Pulsating emerald badge (`• X Video Panduan`) for products with active video materials.
  - Clean two-line typography with category badges.
  - Tactile action button (`Buka Materi →`) with active press state.

### B. Product Detail & Video Player View (`#/member/tutorials/:id`)
- **Video-First Sticky Layout**:
  - Ultra-compact navigation bar (back button + product name + video counter pill) occupying minimal vertical height.
  - Top-anchored 16:9 video player with rounded corners and dark shadow.
- **Unified Media Controller Strip**:
  - Placed directly beneath video player: displays "Bab X dari Y", a mini progress bar, and instant Previous/Next buttons.
- **Framer Motion Sliding Pill Segmented Tab Switcher**:
  - On mobile (`block lg:hidden`), two tabs powered by a GPU-accelerated sliding backdrop pill (`transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`):
    1. **Daftar Bab & Playlist ({N})**: Searchable chapter list with active indicators, pulsing play icon, and 1-tap chapter jump.
    2. **Detail & Download**: Full lesson notes, software description, and direct "Download Installer" CTA button.
- **Desktop Grid Preservation**:
  - On desktop (`lg:grid-cols-12`), maintain the classic 8-col player + 4-col playlist layout with enhanced visual contrast and zebra striping.

---

## 3. Visual & Token Specifications

| Element | Dark Mode Token | Light Mode Token |
| :--- | :--- | :--- |
| **Card Surface (Odd)** | `#0c1322` (`rgb(12, 19, 34)`) | `#ffffff` |
| **Card Surface (Even)** | `#141f36` (`rgb(20, 31, 54)`) | `rgba(241, 245, 249, 0.70)` |
| **Borders** | `#22314d` / `slate-800` | `#e2e8f0` / `slate-200` |
| **Active Chapter Item** | `bg-blue-600 text-white` | `bg-blue-600 text-white` |
| **Inactive Chapter Item** | `#101827` / `#131d31` | `#f8fafc` / `#f1f5f9` |
| **Video Status Pulse** | `bg-emerald-500 animate-pulse` | `bg-emerald-500 animate-pulse` |
| **Toolbar Search** | `#101827` border `slate-700` | `#ffffff` border `slate-200` |

---

## 4. Verification & Testing Strategy

- **Automated Headless Chrome CDP Tests**:
  - Mobile Viewport (390x844): Verify zero horizontal overflow, responsive single-row toolbar, chapter switching, and tab toggling.
  - Desktop Viewport (1280x800): Verify 12-column layout integrity, 8-col player, 4-col playlist sidebar, and search filtering.
- **Zero Storage Footprint**: Clean up temporary profiles and test scripts immediately.
