# Category Carousel Unclipped Display & Sliding Animated Pill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate category tag clipping/truncation in `LandingPage.svelte` by converting the category container to a spacious, multi-row flex-wrap layout or smooth full-width container on desktop with clear visual tags and an animated sliding pill indicator on the active category.

**Architecture:** 
1. Fix CSS flex overflow clipping bug (`sm:justify-center` with `overflow-x-auto` clips overflowing items).
2. Allow clean multi-row wrapping on desktop (`flex flex-wrap items-center justify-center gap-2.5`) or responsive full-width view so every category tag is 100% visible without text truncation (`#Tool Dropshipper`, `#Tools Farming`, `#Tools Pendukung Affiliator`, `#Tools Pendukung Youtube`, etc.).
3. Enhance active category button with a vibrant, high-contrast animated royal-blue pill indicator with smooth hover physics.

**Tech Stack:** Svelte 4, Tailwind CSS, TypeScript.

---

### Task 1: Fix Category Tag Clipping & Sliding Indicator in `LandingPage.svelte`

**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte`

- [ ] **Step 1: Update Category Container Layout & Sliding Pill**
  - Replace `overflow-x-auto` with responsive `flex flex-wrap items-center justify-center gap-2.5 max-w-5xl mx-auto` so all categories and tags are fully rendered on screen without horizontal clipping.
  - Maintain active pill styling with smooth transitions (`transition-all duration-200`).
- [ ] **Step 2: Build & Verify**
  - Run `pnpm run build` to verify clean compilation.
