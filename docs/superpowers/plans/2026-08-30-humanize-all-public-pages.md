# Comprehensive Humanized Redesign Plan: De-AI Visual Overhaul Across Public Pages

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Strip all stereotypical "AI-generated UI tropes" (excessive `rounded-3xl`, rainbow neon glows, floating jittery satellite cards, fake pulse dots, over-dramatic marketing slogans, clunky showcase boxes) and replace them with a refined, human, natural design system inspired by Linear, Stripe, and Apple (disciplined palette, clean 1px borders, balanced typography, authentic human copy).

## Core Principles (Anti-AI Design & Humanizer):
1. **Restrained Border Radii & Clean Geometry:**
   - Replace generic `rounded-3xl` with intentional `rounded-xl` (12px) and `rounded-2xl` (16px) for cards, `rounded-lg` (8px) for buttons/inputs.
2. **Color Palette Discipline:**
   - Eliminate noisy competing rainbow badges (no simultaneous neon purple + cyan + emerald + blue on every element).
   - Anchor to a single clean primary accent (`#2563eb` Royal Blue) with neutral high-contrast slates (`#0f172a`, `#334155`, `#64748b` in light; `#090d16`, `#1e293b`, `#94a3b8` in dark).
3. **Human-Centric Copywriting (Zero Marketing Slop):**
   - Replace "Eliminasi Kerja Manual. Eksekusi Workflow 10x Lebih Cepat" $\rightarrow$ "Software bot & otomasi desktop untuk kelola toko online, konten, dan afiliasi."
   - Replace "DOKUMEN HUKUM RESMI REF: DOC-ZL-TOS-2026" $\rightarrow$ Clean, professional legal document layout.
4. **Hero 3D Clean Presentation:**
   - Remove the 4 noisy floating cards surrounding the 3D globe. Keep the 3D Earth clean, focused, and responsive.
5. **Clean Auth Pages (Login & Register):**
   - Replace cluttered visual showcase with a clean, focused, professional card layout.

---

### Task 1: Refactor `LandingPage.svelte` (Clean Typography, Natural Copy, Restrained Geometry)
**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte`

- [ ] **Step 1: Simplify hero copy, remove noisy satellite overlays, tighten typography**
- [ ] **Step 2: Clean up Bento Grid cards & Affiliate Simulator with crisp 1px borders and natural spacing**
- [ ] **Step 3: Refine About Ziqva Labs and FAQ sections**

---

### Task 2: Refactor `PublicNavbar.svelte` & `PublicFooter.svelte`
**Files:**
- Modify: `client/src/lib/components/PublicNavbar.svelte`
- Modify: `client/src/lib/components/PublicFooter.svelte`

- [ ] **Step 1: Clean up navbar border, buttons, and brand header**
- [ ] **Step 2: Clean up footer grid and links**

---

### Task 3: Refactor `Terms.svelte` & `Privacy.svelte` (Authentic Executive Document Design)
**Files:**
- Modify: `client/src/lib/pages/Terms.svelte`
- Modify: `client/src/lib/pages/Privacy.svelte`

- [ ] **Step 1: Simplify Terms of Service with clean article formatting**
- [ ] **Step 2: Simplify Privacy Policy with direct, honest data statements**

---

### Task 4: Refactor `Login.svelte` & `Register.svelte` (Minimalist, Natural Auth Flow)
**Files:**
- Modify: `client/src/lib/pages/Login.svelte`
- Modify: `client/src/lib/pages/Register.svelte`

- [ ] **Step 1: Clean up Login form and showcase card**
- [ ] **Step 2: Clean up Register form and showcase card**

---

### Task 5: Build Verification & Final Review
**Files:**
- Run: `pnpm run build`
- Git Commit & Push to `origin/reborn`
