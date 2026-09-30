# Fix Slider Text Collision and Polish Target Volume Header

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate visual collision between the floating thumb bubble and the header volume badge in the affiliate commission simulator, consolidating into a clean, unified single-source indicator.

**Architecture:** 
- Remove redundant floating bubble above the slider thumb that collides with the top-right header at high values (e.g. 100).
- Elevate the header badge to display `{simMonthlySales} Lisensi / Bulan` clearly with pulse status indicator.
- Maintain custom dynamic gradient fill on the range slider track and quick preset buttons (`5x`, `15x`, `30x`, `50x`, `100x`).

**Tech Stack:** Svelte 4, Tailwind CSS, Vite.

---

### Task 1: Consolidate Slider Volume Label and Fix Overlap in `LandingPage.svelte`

**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte:1522-1569`

- [ ] **Step 1: Update slider markup in `LandingPage.svelte`**
- [ ] **Step 2: Build verification via `pnpm run build`**
- [ ] **Step 3: Commit and push changes**
