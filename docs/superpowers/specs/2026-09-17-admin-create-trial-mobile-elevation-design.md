# Admin Create Trial (Buat Token Trial) Clean Single-Form Elevation Design

**Date:** 2026-09-17  
**Status:** Approved  
**Scope:** Frontend UI/UX (`client/src/lib/pages/AdminCreateTrial.svelte`)  

---

## 1. Overview & Objectives

The Admin Create Trial page (`Buat Token Trial` at `#/admin/trials/create`) is the specialized tool for administrators to generate and dispatch software trial tokens to prospective clients.

Following user feedback:
1. **Zero Raw Emojis / Symbols:** All emoji characters have been completely replaced with sleek, minimalist SVG stroke icons.
2. **Removed Metric Counter Chips:** Removed the unnecessary `TOTAL`, `HARI INI`, `BELUM AKTIF`, and `AKTIF DI PC` badges from the header.
3. **Removed Tab Overload:** Eliminated the tab navigation bar entirely. The page is now a single focused, clean, centered card for generating trial tokens.
4. **Natural, Human Copywriting:** Replaced robotic AI jargon with clean, polite, and standard Indonesian.
5. **Redesigned Success Modal:**
   - Crisp SVG checkmark header with clear typography.
   - Software and duration metadata chip.
   - Clean dark monospace token card with 1-click `Salin` button (and `Tersalin` feedback).
   - Direct `Kirim ke WhatsApp` button and `Salin Format Pesan WA` action.
   - Collapsible draft message preview.
   - Action buttons for `+ Buat Token Lain` and `Selesai`.

---

## 2. Design Specifications

- **Form Fields:**
  - Software selector (`CustomDropdown`)
  - Quick duration presets (4x2 grid: `1 Hari`, `3 Hari`, `7 Hari`, `14 Hari`, `1 Bulan`, `3 Bulan`, `6 Bulan`, `1 Tahun`)
  - Stepper & unit selector (`[-] [ 3 ] [+]` & `Hari / Bulan / Tahun / Jam`)
  - Optional client WhatsApp phone number (`08xxxxxxxxxx`)
  - Primary button: `Buat Token Trial Sekarang`
- **Theme Parity:** Full dark and light theme support with WCAG AA contrast.
