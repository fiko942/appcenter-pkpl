# Admin Login UI/UX Elevation & Admin Portal Deep Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate and polish `client/src/lib/pages/AdminLogin.svelte` for flawless mobile and desktop responsiveness, zero anomalies, high-contrast aesthetics, and document a complete breakdown of all pages and features in the AppCenter Admin Portal.

**Architecture:** Refine Svelte 4 template and Tailwind CSS styling on `client/src/lib/pages/AdminLogin.svelte` to ensure fluid adaptive padding, responsive typography, tactile keypads, and seamless dual-theme integration with CSS tokens. Verify end-to-end PIN authentication (`085213`) and audit all administrative subsystems.

**Tech Stack:** Svelte 4, Tailwind CSS 4, Vite, Express 5, TypeScript, Prisma ORM 6, Browser Testing

## Global Constraints
- Target branch is STRICTLY `reborn`. Never push to `master`.
- Package manager is STRICTLY `pnpm`.
- Admin default dev PIN is `085213`.
- No extraneous temporary files left behind (Zero Storage Footprint).

---

### Task 1: Audit All Admin Portal Pages and Subsystems

**Files:**
- Inspect: `client/src/lib/pages/Admin*.svelte`
- Inspect: `client/src/App.svelte`
- Inspect: `src/controllers/adminController.ts`

- [x] **Step 1: Inspect Admin Routes and Components**
- [x] **Step 2: Map all 10 Admin Sections, Data Models, and Actions**

---

### Task 2: Polish & Elevate Admin Login Responsiveness & UI/UX

**Files:**
- Modify: `client/src/lib/pages/AdminLogin.svelte`

- [x] **Step 1: Optimize mobile container padding, fluid card constraints, and ambient background lighting**
- [x] **Step 2: Enhance 6-digit PIN input grid for small mobile screens (320px - 390px) to prevent clipping**
- [x] **Step 3: Refine keypad touch targets, active press feedback, and accessibility aria-labels**
- [x] **Step 4: Build client bundle with `pnpm run build`**

---

### Task 3: Browser Verification & Validation

**Files:**
- Test via browser headless / bsk automation across mobile and desktop viewports

- [x] **Step 1: Test Desktop Viewport (1440x900) light & dark theme**
- [x] **Step 2: Test Mobile Viewport (375x812 / 390x844) light & dark theme**
- [x] **Step 3: Verify PIN authentication `085213` and redirection to `/admin/dashboard`**
- [x] **Step 4: Document and complete verification**
