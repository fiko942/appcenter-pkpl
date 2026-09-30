# Admin Payments (Daftar Pembayaran) UI/UX Elevation Design

**Date:** 2026-09-17  
**Status:** Approved  
**Scope:** Frontend UI/UX (`client/src/lib/pages/AdminPayments.svelte`) & Component Polishing  

---

## 1. Overview & Objectives

The Admin Payments page (`Daftar Pembayaran` at `#/admin/payments`) is the central control surface for monitoring revenue, order lifecycle, manual confirmation, license auditing, and transaction filtering.

Following the design standards established in `AdminUsers.svelte` and adhering to `design-taste-frontend`, this elevation enhances:
1. **Toolbar & Filter Controls:** Responsive segmented status tabs, horizontal sliding period presets, custom calendar popover, and clean dropdown filters.
2. **Mobile Card List (`< xl`):** Highly readable transaction cards with clear visual hierarchy, copy chips, and tactile action buttons.
3. **Modal Detail Pembayaran (Rincian Transaksi):** Complete revamp with an animated sliding pill tab switcher across 4 sections:
   - 📦 **Rincian & Produk**
   - 🔑 **Token Lisensi**
   - 👤 **Pelanggan & Afiliasi**
   - 📋 **Audit & Teknis**
4. **Modal Detail Pembayaran (Rincian Transaksi):** Complete revamp with an animated sliding pill tab switcher across 4 sections:
   - 📦 **Rincian & Produk**
   - 🔑 **Token Lisensi**
   - 👤 **Pelanggan & Afiliasi**
   - 📋 **Audit & Teknis**
5. **Sub-modals (Konfirmasi Lunas & Ubah Durasi):** Polished modals with clear typography, input steppers, and accessible buttons.
6. **IDM-Proof In-App A4 Invoice Document Viewer:** Replacing raw PDF iframes with authentic client-rendered HTML/CSS A4 Invoice Sheets fetched via JSON `/api/v1/invoice/:token`, fully immune to download manager popups, complete with 1-click Print (`@media print`), bilingual (ID/EN) toggle, license token copy, and manual PDF download links.

---

## 2. Design System & Dial Configuration

- **Dial Settings:** `DESIGN_VARIANCE: 6` | `MOTION_INTENSITY: 6` | `VISUAL_DENSITY: 5`
- **Color Palette:**
  - Base: Slate / Zinc neutral scales with light & dark theme parity (`bg-[var(--surface)]`, `bg-[var(--surface-2)]`, `border-[var(--border)]`).
  - Accent / Primary: Electric Blue (`#2563eb` / `#3b82f6` / `var(--brand)`).
  - Status Semantics: Emerald for Lunas/Success, Amber for Pending, Rose for Expired/Failed, Indigo for Invoices.
- **Typography:** Sans-serif display with tight tracking on headings (`tracking-tight font-black`), monospaced tokens and IDs (`font-mono font-bold`), clean label hierarchy.
- **Motion & Physics:** Smooth sliding pill backdrop with `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]` driven by `ResizeObserver` and Svelte `tick()`.

---

## 3. Detailed Specifications

### 3.1 Status & Period Filter Toolbar
- **Segmented Tabs:** Status filter (`Semua Transaksi`, `Pending / Verifikasi`, `Lunas / Selesai`, `Kadaluarsa`) with sliding pill backdrop and responsive badge counts.
- **Period Filter:** Horizontal scroll container on mobile with quick buttons (`Semua Waktu`, `Bulan Ini`, `Bulan Kemarin`, `3 Bulan Terakhir`, `1 Tahun Terakhir`) and date range calendar picker trigger.
- **Search & Sort:** Search input with live debounce spinner, clear button, and custom styled select dropdowns.

### 3.2 Mobile & Responsive Cards (`< xl`)
- **Header:** Order ID mono link badge `#<id>`, channel code (e.g. `Xendit Gateway`), and status badge with pulsing dot.
- **Product & Price Row:** Product icon with initial fallback, name, duration badge, total price formatted in IDR currency, and admin fee notice if applicable.
- **Customer & License Metadata:** Customer name, email with 1-click copy, and license token chip with 1-click copy and toast notification.
- **Actions Dock:** Action buttons with minimum 38px touch targets: `Invoice`, `Detail`, `Durasi`, and `Konfirmasi Lunas` (for pending orders).

### 3.3 Modal Detail Pembayaran Revamp
- **Header:** Order ID badge `#<id>`, created timestamp, and close button.
- **Sliding Pill Tab Switcher:**
  1. `order`: **Rincian & Produk** — Metric summary cards (Total, Fee, Method, Payment Dates) and purchased product item table.
  2. `tokens`: **Token Lisensi** — Machine license tokens, activation status, HWID/IP binding, and copy button.
  3. `customer`: **Pelanggan & Afiliasi** — Customer name, verified email, one-tap WhatsApp link (`https://wa.me/...`), and affiliate earnings details.
  4. `technical`: **Audit & Teknis** — Payment Request ID, VA Number / QRIS string, voucher, admin notes, confirmation author, and last updated epoch.
- **Tab Animations:** Pill indicator transitions smoothly using `offsetLeft` and `offsetWidth` measurements, with Svelte `in:fade={{ duration: 150 }}` on content panes.

### 3.4 Modal Konfirmasi Manual & Ubah Durasi
- **Konfirmasi Lunas:** Modal displaying clear transaction summary, warning notice, and confirm/cancel buttons.
- **Ubah Durasi:** Modal with product name, current duration in months, number input, and save/cancel actions.

### 3.5 In-App A4 Digital Document Viewer (IDM-Proof)
- **JSON-Driven Rendering:** Fetches `/api/v1/invoice/:token` via standard JSON API rather than raw PDF binary streams to eliminate Internet Download Manager (IDM) interception.
- **A4 Digital Sheet:** Recreates the exact high-fidelity Ziqva Labs official invoice layout (branding header, payment status stamp, 2-column customer/billing cards, item breakdown table, calculation summary, and license activation container).
- **Print Optimization:** Embedded `@media print` CSS rules targeting `#invoice-print-sheet` for clean physical printing or browser *Save as PDF* export.
- **Bilingual Switch:** Live `ID` / `EN` toggle to preview and print documents in either Indonesian or English.
- **Explicit Downloads:** Retains dedicated toolbar actions for manual PDF file downloads (`/api/v1/invoice/:token/download`) and external new-tab preview (`/api/v1/invoice/:token/pdf`).

---

## 4. Verification & Testing Checklist

- [x] SegmentedTabs render properly on both desktop and mobile viewports.
- [x] Period filter switches smoothly and calendar picker opens/closes cleanly.
- [x] Mobile card view displays all necessary fields without overflow or clipped text on 320px–390px screens.
- [x] Detail modal opens and displays all 4 tabs with smooth sliding pill animation.
- [x] Copy-to-clipboard functionality triggers feedback toast for email, tokens, and technical IDs.
- [x] Modals (Detail, Confirm, Duration, Invoice Preview) close on ESC key and backdrop click.
- [x] Light mode and dark mode color contrast comply with WCAG AA.
- [x] Invoice preview renders cleanly without IDM interception and prints via `window.print()`.
