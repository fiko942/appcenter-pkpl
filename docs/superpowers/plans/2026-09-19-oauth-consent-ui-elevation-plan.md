# OAuth Consent Screen UI Elevation & Brand Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the Ziqva OAuth 2.0 / SSO Consent Screen (`OAuthConsent.svelte`) to high-end, professional enterprise design standards (Linear/Google/Stripe aesthetic), replacing generic emoji symbols with clean SVG vector icons, aligning header branding with the official AppCenter logo (`/favicon.svg`), removing tacky multi-color button gradients in favor of solid professional brand blues, and refining scope descriptions in the backend controller.

**Architecture:** 
- Frontend UI overhaul in `client/src/lib/pages/OAuthConsent.svelte` using Tailwind CSS and standardized inline SVG vector icons.
- Header logo alignment with official `/favicon.svg` mark.
- Backend scope description refinement in `src/controllers/oauthController.ts`.
- Full verification via Vite build and automated OAuth E2E test suite.

**Tech Stack:** Svelte 4, Tailwind CSS 4, TypeScript 5.9, Express 5.

**Spec:** `docs/superpowers/specs/2026-09-19-oauth2-sso-provider-design.md` & `docs/ZIQVA_OAUTH2_VIBE_CODER_SPEC.md`

## Global Constraints
- Strictly on `reborn` git branch.
- Monorepo architecture on single port 4829.
- No AI slop: no tacky gradient buttons, no random emoji symbols in place of UI icons, no broken layouts.
- Dual-mode consistent typography and contrast (WCAG AA compliant).

---

### Task 1: Refine Backend Scope Description
**Files:**
- Modify: `src/controllers/oauthController.ts:135-155`

- [ ] **Step 1: Update scope descriptions in `oauthController.ts`**
  Refine `'Melihat nama dan foto profil akun Ziqva Anda'` to `'Melihat nama dan identitas akun Ziqva Anda'` to reflect that avatar photos are not uploaded for standard accounts.

- [ ] **Step 2: Run build to verify TypeScript compilation**
  Run: `npm run build`
  Expected: exit code 0.

- [ ] **Step 3: Commit backend refinement**
  ```bash
  git add src/controllers/oauthController.ts
  git commit -m "refactor(oauth): refine scope descriptions in auth context"
  ```

---

### Task 2: Redesign OAuth Consent UI (`OAuthConsent.svelte`)
**Files:**
- Modify: `client/src/lib/pages/OAuthConsent.svelte`

- [ ] **Step 1: Replace top header logo**
  Replace the letter "Z" circular badge with the official AppCenter geometric logo (`/favicon.svg`) in a sleek, glassmorphic container (`w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center p-1.5`).

- [ ] **Step 2: Replace emoji symbols with professional SVG vector icons**
  - Replace `👤`, `✉️`, `📱`, `🛡️`, `🔑` with crisp SVG vector icons with stroke-width 1.75.
  - Replace error state `⚠️` with a clean SVG warning alert icon.
  - Replace trusted app emoji `🛡️` with a clean SVG shield check icon.

- [ ] **Step 3: Replace tacky button gradients with solid corporate styling**
  - Replace primary button gradient (`bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600`) with solid brand royal blue (`bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-2.5 sm:py-3 rounded-xl shadow-xs transition-all`).
  - Style secondary "Batalkan" button with sleek slate ghost styling (`bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 font-medium py-2.5 rounded-xl transition-all`).
  - Style "Ganti Akun" button with clean subtle border and slate hover.
  - Clean up Account Chooser card and input focus rings.

- [ ] **Step 4: Build client and backend**
  Run: `npm run build`
  Expected: exit code 0.

- [ ] **Step 5: Run full OAuth E2E test suite**
  Run: `npx ts-node scripts/test-oauth-sso.ts`
  Expected: 23 / 23 tests pass.

- [ ] **Step 6: Commit and push changes**
  ```bash
  git add client/src/lib/pages/OAuthConsent.svelte
  git commit -m "style(oauth): elevate SSO consent screen with official brand logo, clean SVG icons, and professional button styling"
  git push origin reborn
  ```
