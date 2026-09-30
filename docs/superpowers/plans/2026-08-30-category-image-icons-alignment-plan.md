# Category Real Image Icon Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace placeholder vector SVG icons on the category pills with actual category icon images (`cat.icon` e.g. `/uploads/categories/cat-...png`) as used across the member area and admin dashboard, with fallback support for bundle and free tools.

**Architecture:**
1. Update `LandingPage.svelte` category filter buttons:
   - For regular categories (`cat.icon`): render `<img src="{cat.icon}" alt="{cat.name}" class="w-4 h-4 rounded-md object-cover flex-shrink-0" />`.
   - Add image error fallback handling (`imgErrorMap['cat_' + cat.id] = true`).
   - For tags (`availableTags`): lookup matching category object from `categories` to retrieve the database image icon; fallback to dynamic icon if not matched.
2. In Product Cards (`#category_name` badge):
   - Render the small category image icon next to the `#category_name` tag on cards just like in member area / `AdminProducts.svelte`.

**Tech Stack:** Svelte 4, Vite, Tailwind CSS.

---

### Task 1: Update Category Filter & Product Cards to Load Real Category Image Icons

**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte`

- [ ] **Step 1: Implement Image Error Map & Icon Renderer**
  - Add `let catImgErrorMap: Record<string, boolean> = {};`
  - Update category pills to display `<img src={cat.icon} class="w-4 h-4 rounded object-cover shrink-0" />`
  - Update tag buttons to resolve category image icon if tag matches a category name.
  - Update product card category badge to display category icon thumbnail.
- [ ] **Step 2: Build & Verify**
  - Run `pnpm run build` to ensure clean compilation.
