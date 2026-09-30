# Full Production Release Documentation: Legal Sovereignty, Mandatory Auth Agreement, & Tutorials Overhaul

**Release Date:** August 31, 2026  
**Branch:** `reborn`  
**Repository:** `https://github.com/fiko942/appcenterv2`  

---

## 1. Summary of Changes

### A. Privacy Policy & Local Data Sovereignty (`Privacy.svelte`)
- Enforced **Zero Cloud Bot Storage** architecture.
- Explicitly documented that TikTok, Google, YouTube, and Marketplace account credentials, cookies, cache, rendering files, and local automation databases (SQLite / `userData`) are strictly stored 100% locally on the user's computer.
- Server-side storage is restricted to essential account authentication, active license verification, and Machine ID (HWID).

### B. Terms of Service & No-Refund Policy (`Terms.svelte`)
- **Clause 4 (No-Refund Policy)**: Strict zero tolerance for cash refunds once digital licenses are issued, including errors such as wrong product selection, wrong duration package, wrong promo code, or device incompatibility.
- **Discretionary License Adjustment**: Outlined non-cash adjustments (re-issuance, license swaps to equal-value software, or duration corrections) only when supported by concrete, verified proof within 24 hours.

### C. Mandatory Legal Consent on Authentication (`Login.svelte` & `Register.svelte`)
- Added a required checkbox on both Member Login and Register pages.
- Submit action is disabled until the user explicitly agrees to the Terms of Service (including No-Refund clause) and Local Data Privacy Policy.
- Fully responsive across desktop & mobile in dark and light themes.

### D. Member Tutorials & Installer Download Flow (`Tutorials.svelte`, `Downloads.svelte`, `memberController.ts`)
- Neutralized the tutorial progress tracking bar and replaced video icons with clean solid play SVGs.
- Added previous/next video navigation buttons.
- Integrated "Download File Software" deep-link parameter (`#/member/downloads?id=<id>`), which automatically opens the official installer pop-up modal on the downloads page.
- Included `installer_files` in the backend database selection query.

---

## 2. Verification & Build
- **Client Build**: `vite build` completed successfully.
- **Backend Build**: `tsc` and asset packaging verified in `dist/`.
- **Git Push**: All commits up to `f40146d` successfully synchronized to GitHub (`origin/reborn`).
