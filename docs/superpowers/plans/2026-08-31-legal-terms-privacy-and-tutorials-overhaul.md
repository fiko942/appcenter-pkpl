# Implementation Plan: Legal Terms, Privacy Data Sovereignty, and Member Tutorials Overhaul

**Goal:** Establish strict local data sovereignty and no-refund legal agreements across the public pages, enforce mandatory terms checkboxes on member authentication flows (Login & Register), and elevate the Member Tutorial video player with integrated deep-link installer downloads.

**Architecture:**
1. **Legal Clauses**:
   - `client/src/lib/pages/Privacy.svelte`: Clarify Zero Cloud Bot Storage (100% local SQLite / userData for TikTok, Google, and marketplace automation; zero credential/session cloud transfer).
   - `client/src/lib/pages/Terms.svelte`: Add Clause 4 explicitly establishing a strict No-Refund policy (final digital transactions, zero refund for wrong purchase or user device incompatibility).
2. **Auth Mandatory Checkboxes**:
   - `client/src/lib/pages/Login.svelte` & `client/src/lib/pages/Register.svelte`: Add interactive required consent checkbox before form submission with deep links to `/terms` and `/privacy`.
3. **Tutorial Player & Downloads Deep Link**:
   - `client/src/lib/pages/Tutorials.svelte`: Neutralize progress track styling, update play SVG icon, link "Download File Software" to `#/member/downloads?id=<id>`.
   - `src/controllers/memberController.ts`: Ensure `installer_files` is included in product select queries.
   - `client/src/lib/pages/Downloads.svelte`: Implement automatic pop-up opening when URL contains `?id=<id>`.

---

### Task Breakdown & Execution Status

- [x] **Task 1: Privacy Policy & Terms of Service Overhaul**
  - [x] State Zero Cloud Bot Storage in `Privacy.svelte` with explicit coverage of TikTok and Google data.
  - [x] Add Clause 4 No-Refund Policy in `Terms.svelte`.
  - [x] Align table of contents and quick jump buttons.

- [x] **Task 2: Mandatory Terms & Privacy Consent in Auth Pages**
  - [x] Add `agreeTerms` boolean state in `Login.svelte` and `Register.svelte`.
  - [x] Add styled, accessible checkbox UI in light and dark mode with target blank links to legal documents.
  - [x] Prevent submission when `agreeTerms` is false.

- [x] **Task 3: Member Tutorials & Installer Download Flow**
  - [x] Clean up and modernize tutorial progress bar in `Tutorials.svelte`.
  - [x] Query `installer_files` in `src/controllers/memberController.ts`.
  - [x] Implement deep link parameter handler in `Downloads.svelte` to auto-open installer modal.

- [x] **Task 4: Build & Production Verification**
  - [x] Verify client build: `pnpm --filter appcenter-client run build`.
  - [x] Verify backend build: `npm run build` / TypeScript validation.
  - [x] Deploy live production bundle and push commits to GitHub.
