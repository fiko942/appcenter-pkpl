# AppCenter V2 — Permanent Agent Guidelines & Developer Preferences

## 1. Core Invariants & Security
- **Git Branch Invariant**: Target branch is STRICTLY `reborn`. Never push to `master`.
- **Package Manager Invariant**: STRICTLY `pnpm`. Never use `npm` or `yarn`. (e.g. `pnpm install`, `pnpm run build`, `pnpm run dev`).
- **Database Connection Pool**: The MySQL connection pool limit is strictly capped at `5` in both `.env` (`DATABASE_URL=...?connection_limit=5`) and `sessionStore` (`connectionLimit: 5` in `src/app.ts`) to avoid socket starvation.
- **Admin PIN**: Default dev PIN is `085213`.
- **Immutable User Email**: User email is permanent and locked after registration.

## 2. UI & Component Architecture
- **Admin Topbar**: The "Help / Pusat Bantuan & Tutorial" icon button is scoped to the Member area (`showHelp = true`) and MUST NOT appear on Admin pages (`showHelp = false`).
- **Sidebar Typography**: Navigation labels (e.g. `Affiliate Management`) must always remain strictly on a single line with `white-space: nowrap`, `gap: 10px`, and normalized zero item margin (`margin: 4px 0`).
- **Custom Svelte Components**: Use `CustomSelect`, `CustomCheckbox`, `CustomDropdown`, and `SegmentedTabs` instead of native browser `<select>` or checkbox elements.

## 3. 9Router Image Generation Workflow
- **Gateway Endpoint**: `http://localhost:20128/v1/images/generations`
- **Default Image Model**: `ag/gemini-3.1-flash-image`
- **API Key**: `your_9router_api_key_here`
- **File Output**: All generated images MUST be placed directly in `/Users/fiko942/Downloads/` without automatic database insertion, allowing the developer to test manual uploads via the web UI.

## 4. Communication & Execution Style
- **Terse, Direct Pair-Programming**: Use Indonesian language, concise technical substance, zero filler or cheerleading slogans ("tanpa bilang gas-gas").
- **Mandatory Implementation Planning**: Untuk SEMUA prompt (perubahan fitur, bugfix, atau tweak sekecil apa pun), WAJIB SELALU membuat `implementation_plan.md` artifact terlebih dahulu, lalu LANGSUNG eksekusi perubahannya secara otonom tanpa menunggu konfirmasi manual ("langsung dikerjain").
- **Single Source of Truth & Deep Documentation Invariant**: Keep `docs/CONTEXT_SNAPSHOT.yaml` and `ZIQVA_STORE_ANALYSIS.md` updated after major milestones. Setiap kali melakukan penyimpanan ke dalam memori (SAVE Protocol), WAJIB memastikan dokumentasi teknis mendalam per seluruh fitur (`docs/TECHNICAL_DOCUMENTATION.md`) dan non-teknis/bisnis (`docs/NON_TECHNICAL_DOCUMENTATION.md`) telah diperbarui utuh dan tersinkronisasi.

## 5. Test Suite Execution Invariant
- **Runner**: `pnpm run test:simulation` (berkas `scripts/e2e-simulation-test.ts`).
- **Execution Triggers**: Test suite simulasi HANYA dijalankan pada 2 kondisi:
  1. Perubahan **Fitur Besar** (major architectural / core feature updates).
  2. Sesaat sebelum **Preservasi Memori / SAVE v5 Protocol**.
- **No Test on Minor Changes**: DILARANG menjalankan test suite pada perubahan kecil (minor UI tweaks, text typos, formatting, simple CSS).
- **Production Database Safety**: Runner wajib mempertahankan pembersihan data terisolasi di blok `finally` (hanya membersihkan ID data uji, database produksi 100% aman).

## 6. Zero Storage Footprint & Temp Artifact Purge
- **Complete Test Cleanup Invariant**: Setiap kali pengujian selesai (E2E, simulasi, browser QA), seluruh berkas sementara, direktori profil Chrome (`userDataDir`, `$TMPDIR/puppeteer_*`, `$TMPDIR/chrome-test-profile-*`, `$TMPDIR/temp_chrome_*`), screenshots temporary, dan file dump WAJIB langsung dihapus tuntas sehingga tidak memakan ruang penyimpanan lokal sama sekali.


