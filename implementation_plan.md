# Implementation Plan — User Detail Modal Mobile UI/UX & Data Display Fix

Thorough overhaul of the User Detail Modal (`Detail Pengguna`) in `client/src/lib/pages/AdminUsers.svelte` and backend `src/controllers/adminController.ts` to eliminate `#undefined` data rendering bugs, refine mobile responsiveness, enhance typography and information hierarchy, and provide a clean, high-contrast experience across both dark and light modes.

## User Request
> "ini juga gajelas, ini ada di tampilan detail manajemen pengguna yang ada di appcenter, di tampilan mobile, ini gajelas banget, aku minta kamu teliti bagian ini"
> [Screenshot showing Admin > Detail Pengguna modal on mobile viewport with `#undefined` product tags and cramped/unclear layout]

---

## 1. Root Cause Analysis
1. **`#undefined` Display Bug in PC Licenses**:
   - In `src/controllers/adminController.ts` (`apiGetUserDetail`), the `order_id` field from Prisma `device` model was omitted in the returned JSON object.
   - In `AdminUsers.svelte`, the template referenced `#{d.order_id}`, which evaluated to `#undefined`.
2. **Mobile Viewport Cramping & Layout Anomalies**:
   - Modal padding (`p-6` inside `p-4` backdrop) consumed excessive horizontal space on 320px–390px mobile screens.
   - Inner tabs ("Lisensi PC", "Riwayat Pesanan", "Lokasi IP") lacked responsive text adaptation and wrapped awkwardly on narrow viewports.
   - Machine ID strings had no dedicated copy button and overflowed horizontally.
   - Order history status badges were monotone grey rather than semantically color-coded (Paid, Pending, Expired).
   - Profile grid cards (WhatsApp, Status Email, Status Akun, Afiliasi) had text truncation and awkward vertical heights.

---

## 2. Technical Modifications

### A. Backend (`src/controllers/adminController.ts`)
- In `apiGetUserDetail`:
  - Include `order_id: d.order_id` in the `devices` mapping.

### B. Frontend (`client/src/lib/pages/AdminUsers.svelte`)
- **Modal Container & Structure**:
  - Convert modal into a flex column dialog (`flex flex-col max-h-[92vh]`) with responsive padding (`p-3 sm:p-5`).
  - Sticky header with user avatar, name, company badge, user email, and close button.
  - Scrollable body with custom scrollbar.
  - Sticky footer with responsive action buttons ("Hubungi WhatsApp", "Edit Data", "Tutup").
- **Profile Summary Cards (2x2 Mobile Grid)**:
  - WhatsApp: Direct clickable link with icon and copy button.
  - Status Email: Emerald (Terverifikasi) or Amber (Belum Verifikasi) badge with icons.
  - Status Akun: Blue (Aktif Normal) or Rose (Diblokir) badge.
  - Afiliasi: Purple badge with coupon code or "Bukan Mitra".
- **Responsive Tab Switcher**:
  - Responsive tab labels ("Lisensi PC" / "Lisensi", "Riwayat Pesanan" / "Pesanan", "Lokasi IP" / "Lokasi").
  - Smooth active indicator and badge counters.
- **PC Licenses Tab (`devices`)**:
  - Product title with order badge fallback (`Order #{d.order_id}` or `Lisensi #{d.id}`).
  - Status badge (Emerald for Aktif, Rose for Expired) + duration badge.
  - Dedicated Hardware Machine ID chip with 1-click touch copy button.
  - Clear registered date and expiration date with calendar icons.
- **Order History Tab (`orders`)**:
  - Order ID, payment channel badge, and semantic status badge (`PAID` = emerald, `PENDING`/`UNPAID` = amber, `EXPIRED`/`FAILED` = rose).
  - Total amount in formatted Rupiah and clear order date.
- **Location Tab (`locations`)**:
  - Map pin icon, IP address, City/Region/Country, and Timezone.
- **Direct Edit Integration**:
  - Add "Edit Data" button in detail modal footer to open user edit form seamlessly.

---

## 3. Verification Plan
1. **Compilation**: `pnpm run build` or Vite build check.
2. **Browser Verification (Mobile & Desktop)**:
   - Mobile Viewports: Extra small (`320px`), iPhone SE (`375px`), iPhone 14 (`390px`), Android (`412px`).
   - Desktop Viewports: Standard desktop (`1440px`).
   - Both Dark Mode and Light Mode.
   - Verify modal opens, data loads, tabs switch, copy buttons work, `#undefined` is completely gone, and layout is crisp and legible.
