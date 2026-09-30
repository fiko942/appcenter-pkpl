# Implementation Plan: Dedicated Public Pages for Terms of Service & Privacy Policy

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or delegate_task to implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create dedicated, standalone, beautifully styled public pages for Terms of Service (`#/terms`) and Privacy Policy (`#/privacy`), and route all footer and legal links to these pages instead of popups.

**Architecture:**
- Create `client/src/lib/pages/Terms.svelte` (Terms of Service page with high-contrast dual-theme glass card, back button, structured sections, human-centric copy, and theme toggle).
- Create `client/src/lib/pages/Privacy.svelte` (Privacy Policy page with data protection clauses, local storage guarantee, and humanized explanations).
- Register `/terms` and `/privacy` routes in `client/src/App.svelte`.
- Remove popup modals and bind footer navigation buttons in `client/src/lib/pages/LandingPage.svelte` to `push('/terms')` and `push('/privacy')`.

**Tech Stack:** Svelte 4, svelte-spa-router, Tailwind CSS, TypeScript.

---

### Task 1: Create `Terms.svelte` and `Privacy.svelte` Components
**Files:**
- Create: `client/src/lib/pages/Terms.svelte`
- Create: `client/src/lib/pages/Privacy.svelte`

- [ ] **Step 1: Write `Terms.svelte` with full legal sections and modern header/footer layout**
- [ ] **Step 2: Write `Privacy.svelte` with privacy clauses and local storage privacy note**

---

### Task 2: Register Routes in `App.svelte` and Connect Landing Page Links
**Files:**
- Modify: `client/src/App.svelte`
- Modify: `client/src/lib/pages/LandingPage.svelte`

- [ ] **Step 1: Import and add `/terms` and `/privacy` in `App.svelte` routes table**
- [ ] **Step 2: Update footer buttons in `LandingPage.svelte` to `push('/terms')` & `push('/privacy')` and remove inline modal markup**
- [ ] **Step 3: Run `pnpm run build` verification**
- [ ] **Step 4: Commit and push changes to `origin/reborn`**
