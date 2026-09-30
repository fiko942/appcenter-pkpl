# Implementation Plan: Admin Products Tutorial Video Management & Interactive Player

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore and enhance full product video tutorial management in Admin Products (`client/src/lib/pages/AdminProducts.svelte`), including dynamic multi-video repeater with YouTube URL & playlist validation, video count badge in the table, and interactive embedded YouTube player modal with playlist sidebar.

**Architecture:** Integrate dynamic tutorial rows (`[{id, title, url}]`) directly into Admin Products Add/Edit modal, send clean parsed JSON to backend endpoints (`/admin/api/products` and `/admin/api/products/edit/:id`), add tutorial counter badges in table row actions, and provide an interactive YouTube player modal with playlist selection and `youtube-nocookie.com` embed parsing.

**Tech Stack:** Svelte, TypeScript, Tailwind CSS, YouTube Embed API (`src/utils/youtube.ts`), Express REST API.

**Spec:** `docs/superpowers/specs/2026-08-24-product-tutorials-design.md`

## Global Constraints
- Do not remove or break existing SFTP installer upload or Bundle features in Admin Products.
- Support standard YouTube links, Shorts, and Playlists using `src/utils/youtube.ts` conventions.
- Maintain Svelte single-file reactive patterns with clean theme variables (`var(--surface)`, `var(--text)`, `var(--border)`, etc.).
- Validate YouTube URLs before submit with instant inline feedback.

---

### Task 1: Add Dynamic Tutorial Repeater & State in AdminProducts Modal
**Files:**
- Modify: `client/src/lib/pages/AdminProducts.svelte`

- [x] **Step 1: Declare tutorial item interface and form state**
  Add `TutorialItem` interface (`id`, `title`, `url`) and state `formTutorials: TutorialItem[] = []`.
  Initialize in `openAddModal()` (with 1 empty row) and `openEditModal(prod)` (parse `prod.tutorials`).
- [x] **Step 2: Add helper functions for adding, removing, and validating tutorial rows**
  Implement `addTutorialRow()`, `removeTutorialRow(index)`, and update `handleFormSubmit()` to serialize `formTutorials` into payload.
- [x] **Step 3: Add Tutorial Videos UI section inside Product Add/Edit Modal**
  Add repeater cards with Title input, YouTube URL input, remove button, and "+ Tambah Video Tutorial" button.

### Task 2: Add Tutorial Counter Badge & Table Action in AdminProducts Table
**Files:**
- Modify: `client/src/lib/pages/AdminProducts.svelte`

- [x] **Step 1: Parse tutorial count per product in table**
  Create helper `getTutorialCount(tutorials: string | any[] | null | undefined): number`.
- [x] **Step 2: Render tutorial badge / button in table**
  In the table actions and/or dedicated column, display a video badge (e.g. `🎬 3 Video` or `+ Tutorial`) with click handler to open tutorial player modal or edit modal.

### Task 3: Add Interactive YouTube Embed Player Modal with Playlist Drawer in AdminProducts
**Files:**
- Modify: `client/src/lib/pages/AdminProducts.svelte`

- [x] **Step 1: Declare player modal state**
  Add `tutorialPlayerModalOpen: boolean = false`, `playerProduct: ProductItem | null = null`, `playerTutorials: TutorialItem[] = []`, `selectedVideoIndex: number = 0`.
- [x] **Step 2: Implement YouTube embed URL parser and video selector**
  Parse YouTube embed URL for iframe (`youtube-nocookie.com/embed/...` supporting watch, shorts, playlist).
- [x] **Step 3: Render responsive YouTube Player Modal**
  Implement 16:9 video iframe on left/top and interactive playlist drawer on right/bottom.

### Task 4: Verify Full Build & Test Suite
**Files:**
- Verify: `pnpm run build` and `pnpm run lint`

- [x] **Step 1: Run client build**
  Execute `pnpm run build` to ensure zero Svelte/TypeScript syntax errors.
- [ ] **Step 2: Commit changes**
  Commit verified changes to git repository.
