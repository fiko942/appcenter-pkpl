# Affiliate Hero Section Proportional Balancing Plan

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebalance the affiliate section layout to eliminate the large empty gap on the left, making the proportions balanced, compact, and visually rich to match the height of the right calculator card.

**Architecture:**
1. **Grid Ratio:** Adjust grid from `lg:grid-cols-12` (7 vs 5) to `lg:grid-cols-12` (6 vs 6 or 7 vs 5 with vertical centering `items-stretch` / `items-center`).
2. **Left Column Enrichment:**
   - Transform the 3 flat checkmarks into 3 structured mini feature cards / step cards (`Kupon Diskon Khusus`, `Tracking Real-Time`, `Pencairan Otomatis`) with background glass styling and clear descriptions.
   - Add a trust summary badge or stats highlight bar below to balance vertical footprint with the calculator card.
3. **Compact Spacing:** Tighten vertical gaps and padding so the whole section feels cohesive and deliberate.

**Tech Stack:** Svelte 4, Tailwind CSS, Vite.

---

### Task 1: Rebalance Left Column Layout & Visual Hierarchy in `LandingPage.svelte`

**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte:1465-1486`

- [ ] **Step 1: Apply rich balanced left cards in `LandingPage.svelte`**
- [ ] **Step 2: Build verification via `pnpm run build`**
- [ ] **Step 3: Commit and push changes**
