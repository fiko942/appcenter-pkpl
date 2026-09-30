# Unified Categories Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform `AdminCategories.svelte` into a Single Unified Category Hub with Framer-motion sliding tabs, clean single-row toolbar, high-density category table, fixed hover button state, and solid modals.

**Architecture:** Refactor `client/src/lib/pages/AdminCategories.svelte` to remove disjointed stat cards and search blocks, integrating `SegmentedTabs.svelte`, `CustomSelect.svelte`, and `CustomCheckbox.svelte`.

---

### Task 1: Rewrite `client/src/lib/pages/AdminCategories.svelte`

**Files:**
- Modify: `client/src/lib/pages/AdminCategories.svelte`

- [ ] **Step 1: Fix Header Button & Eyebrow**:
  Update primary button styling to `bg-[var(--brand)] hover:opacity-90 text-white shadow-md shadow-blue-500/20`.
- [ ] **Step 2: Integrate SegmentedTabs**:
  Add Framer-motion sliding pill tabs (`Semua`, `Aktif`, `Nonaktif`).
- [ ] **Step 3: Single-Row Toolbar**:
  Add search bar + `CustomSelect` sort options (`Nama A-Z`, `Produk Terbanyak`, `Terbaru`).
- [ ] **Step 4: High-Density Table**:
  Build modern table rows (36x36px icon/monogram, Name bold, `#slug`, Description, Linked products badge, 1-click status toggle, 32x32px action buttons).
- [ ] **Step 5: Solid Modals**:
  Refine Add/Edit and Delete modals with solid background `bg-white dark:bg-[#101827]`, icon uploader with preview, and `CustomCheckbox`.

---

### Task 2: Verification

- [ ] **Step 1: Run build & lint**:
  `npm run lint && npm run build`
- [ ] **Step 2: Commit & push**:
  Commit to branch `reborn` and push.
