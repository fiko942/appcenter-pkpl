# Implementation Plan: Elevate Privacy Policy Page (`Privacy.svelte`) to Sovereign Executive Standard

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign and polish `Privacy.svelte` into a symmetrical, highly polished, executive-grade legal and data privacy document with structured data-flow cards, clear visual distinction between local vs cloud data, interactive TOC, and dual-theme high contrast.

## Key Improvements:
1. **Document Header & Metadata Badge:**
   - Clean metadata cluster: `PERLINDUNGAN PRIVASI DATA`, `DOC-ZL-PRIV-2026`, `Pembaruan: 30 Agustus 2026`, `Status: Aktif & Berlaku`.
   - Title: *Kebijakan Privasi & Perlindungan Data*.
2. **Hero Sovereign Callout (Zero-Cloud Storage Architecture):**
   - High-contrast 2-column comparative visual card:
     - **Tersimpan 100% di Komputer Anda (Lokal):** Data akun bot, sesi browser, file download, pengaturan workflow.
     - **Tersimpan di Server Resmi Ziqva Labs (Minim):** Nama, Email, Riwayat Transaksi & Serial Key.
3. **Structured & Symmetrical Clause Cards:**
   - **Pasal 1 (Data yang Dikumpulkan):** 3-column micro card grid for *Informasi Akun*, *Data Transaksi*, and *Machine ID*.
   - **Pasal 2 (Kedaulatan Data Lokal & Backup):** Visual architecture diagram callout & formatted backup guidelines.
   - **Pasal 3 (Keamanan Finansial & Enkripsi):** 3 trust badges (*Bcrypt Hash Encryption*, *BI-Licensed Payment Gateways*, *Zero Financial Storage*).
   - **Pasal 4 (Hak Pengguna & Kemitraan):** 4 rights checklist grid (*Akses Mandiri*, *Bebas Pindah Device*, *Ganti Password*, *Anti Jual-Beli Data*).
4. **Interactive Quick Jump TOC & Document Index:**
   - Symmetrical 4-button navigation index with clause numbers and icons.
5. **Official Compliance Sign-off & Support Desk:**
   - Symmetrical enterprise-class footer callout card.

**Tech Stack:** Svelte 4, Tailwind CSS, TypeScript.

---

### Task 1: Redesign `client/src/lib/pages/Privacy.svelte`
**Files:**
- Modify: `client/src/lib/pages/Privacy.svelte`

- [ ] **Step 1: Write elevated markup with symmetrical cards and clean typography**
- [ ] **Step 2: Verify build via `pnpm run build`**
- [ ] **Step 3: Commit and push changes to `origin/reborn`**
