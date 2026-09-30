# Review & Polish Plan: Elevate Terms and Privacy Pages to Apple/Notion Standard Legal Documents

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform both `#/terms` and `#/privacy` pages into authoritative, clean, executive-standard legal documents with dual-theme high contrast, responsive mobile/desktop layouts, clear typography, and structured document hierarchy.

**Architecture:**
- **Navigation Bar:** Clean floating glass bar with logo, theme switcher, and back button.
- **Hero Title & Metadata Banner:** Document reference pill, official title, last revision date, document ID badge (`REF: DOC-ZL-TOS-2026` / `REF: DOC-ZL-PRIV-2026`), and quick summary callout.
- **Interactive Table of Contents (Quick Jump Links) / Document Index:** Clean sidebar or top chips for mobile & desktop to easily jump to specific clauses.
- **Visual Section Cards:** Elevated legal cards with subtle glass sheen, clear numbering badges, bold subsection headers, and crisp humanized explanations (no confusing jargon).
- **Responsive & Dual-Theme:** High contrast (`--text`, `--text-2`, `--border`, `--surface-1`), mobile-friendly padding and touch targets.
- **Authoritative Sign-off & Support Callout:** Official issuer footer box with Ziqva Labs entity stamp and help desk link.

**Tech Stack:** Svelte 4, Tailwind CSS, TypeScript.

---

### Task 1: Polish `Terms.svelte` (Syarat & Ketentuan Layanan)
**Files:**
- Modify: `client/src/lib/pages/Terms.svelte`

- [ ] **Step 1: Refactor `Terms.svelte` with executive legal layout, document index, and human-friendly clauses**

---

### Task 2: Polish `Privacy.svelte` (Kebijakan Privasi Pengguna)
**Files:**
- Modify: `client/src/lib/pages/Privacy.svelte`

- [ ] **Step 1: Refactor `Privacy.svelte` with data sovereignty callouts, local storage guarantee, and structured privacy rights**

---

### Task 3: Build Verification & Git Sync
**Files:**
- Run: `pnpm run build`
- Git Commit & Push to `origin/reborn`
