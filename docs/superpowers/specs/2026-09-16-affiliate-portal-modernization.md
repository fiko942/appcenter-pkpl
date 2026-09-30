# Superpowers Specification: Affiliate Portal Modernization & UI/UX Elevation (Affiliate & AffiliatePayouts)

## 1. Overview & Context
The Member Affiliate Portal (`#/member/affiliate` and `#/member/affiliate/payouts`) enables members of the Ziqva platform to participate in the partnership/affiliate program, customize referral discount coupons, track customer purchases made using their coupons, monitor real-time commission earnings (5% net commission), manage bank disbursement accounts, and audit historical payout disbursement logs.

### Addressed Issues & Eliminated AI Tropes
1. **Bulky Floating Header Banner**: Replaced the detached floating box with 3 generic silhouette icons by a native, integrated page header matching the clean typography of Orders and Licenses.
2. **Generic Card Icons & Pastels**: Replaced abstract icons and arbitrary rainbow colors with purposeful domain icons (Ticket voucher, Settlement hourglass, Growth chart, Bank building).
3. **Clipped Dropdown Menus**: Moved the page size selector to the table footer pagination bar and added intelligent auto-alignment (`align: auto`) and upward expansion (`openUpward`) to eliminate horizontal or vertical clipping.
4. **Awkward Pagination Controls**: Standardized all member and admin tables with arrow-only (`<` and `>`) previous/next buttons, centered numbered pills, and ellipsis support.
5. **Generic Modals**: Transformed flat modal dialogs into a bespoke Pro Max Fintech experience featuring a real-time interactive virtual ATM card preview (BCA, Mandiri, BNI, BRI) with metallic EMV chip and contactless wave, as well as an interactive live ticket voucher preview.

## 2. Component Specifications

### 2.1 Native Page Header (`Affiliate.svelte` & `AffiliatePayouts.svelte`)
- **Eyebrow**: Layout prop `eyebrow="PROGRAM KEMITRAAN & AFILIASI"`.
- **Title**: `text-2xl font-extrabold text-[var(--text)] tracking-tight`.
- **Subtitle**: `text-sm text-[var(--text-muted)] max-w-2xl leading-relaxed` with authentic Indonesian business copy.
- **Header Actions**: Clean outline action button (`border border-[var(--border-subtle)] hover:bg-[var(--surface-2)] text-xs font-semibold rounded-xl px-4 py-2`).

### 2.2 Hero Stat Cards (4-Card Grid)
- **Grid Layout**: `grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5`.
- **Card Anatomy**:
  - **Card 1 (Kupon Anda)**:
    - Header: Ticket icon (`bg-blue-500/10 text-blue-600`) with "KODE KUPON ANDA" label and "Aktif" status badge.
    - Code Display: Monospace high-contrast container with copy-to-clipboard button and tooltip feedback.
    - Footer: "Diskon 10% • Komisi 5%" badge.
  - **Card 2 (Komisi Berjalan / Pending Settlement)**:
    - Header: Hourglass icon (`bg-amber-500/10 text-amber-600`) with "KOMISI BERJALAN" label and pulsing amber status pill.
    - Value: High-contrast currency format (`Rp XX.XXX`).
    - Footer: "Pencairan otomatis awal bulan" informational note.
  - **Card 3 (Total Komisi Cair / Revenue Growth)**:
    - Header: Growth chart icon (`bg-emerald-500/10 text-emerald-600`) with "TOTAL KOMISI CAIR" label and "Sukses" badge.
    - Value: Emerald bold currency format.
    - Footer: Number of verified orders.
  - **Card 4 (Rekening Pencairan / Bank Widget)**:
    - Header: Bank building icon (`bg-indigo-500/10 text-indigo-600`) with "REKENING PENCAIRAN" label and official bank badge.
    - Account Info: Formatted account number (`XXXX XXXX XXXX`) and uppercase account holder name.
    - Action: "Atur / Ubah Rekening" trigger opening the Fintech modal.

### 2.3 Bespoke Fintech Payout Modal (`#payoutModal`)
- **Live Interactive Virtual Bank Card**:
  - Proportional debit card aspect ratio (`aspect-[1.58/1]`) with 3D depth and subtle outer glow.
  - Bank-specific gradient palettes:
    - **BCA**: Deep royal blue (`from-[#003399] to-[#001f5c]`) with BCA wordmark.
    - **Mandiri**: Navy and gold shimmer (`from-[#00204d] via-[#003366] to-[#b8860b]`) with Mandiri wordmark.
    - **BNI**: Teal-cyan and tangerine gradient (`from-[#005e6a] to-[#f15a24]`) with BNI wordmark.
    - **BRI**: Vibrant sapphire blue (`from-[#083e87] to-[#041c3d]`) with BRI wordmark.
  - Metallic gold EMV chip with circuit micro-lines.
  - Contactless payment wave icon.
  - Formatted live 10-16 digit account number spaced in 4-digit clusters.
  - Embossed cardholder name in uppercase letters.
  - Live validation pill (`Format Sesuai` in emerald or `Wajib X digit` in amber).
- **Fast Bank Selector Grid**:
  - 4 grid buttons with official bank names, hover effects, and active ring highlights.
- **Form Fields & Security Trust Banner**:
  - Bank account number input with dynamic length counter (`XX / XX digit`).
  - Account holder name input with m-banking synchronization note.
  - 256-bit encryption trust badge assuring zero deduction payout.

### 2.4 Interactive Ticket Voucher Coupon Modal (`#couponModal`)
- **Live Ticket Voucher**:
  - Indigo/violet gradient card with perforated dashed divider line.
  - 10% buyer discount pill and 5% net affiliate commission pill.
  - Live uppercase coupon preview.
- **Code Quick Suggestions**:
  - 4 quick-click chip suggestions based on member name and common promotional prefixes (`PROMO`, `VIP`, `DISKON`).

### 2.5 Standardized Table Footer Pagination
- **Flex Layout**: `flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-[var(--border-subtle)]`.
- **Page Size Selector**: `CustomSelect` placed on the left side with upward opening and auto-alignment.
- **Navigation Controls**:
  - Arrow-only Previous and Next icon buttons (`w-8 h-8 rounded-xl flex items-center justify-center`).
  - Centered page number pills (`w-8 h-8 rounded-xl text-xs font-bold`) with active highlight (`bg-blue-600 text-white shadow-sm shadow-blue-500/30`).
  - Responsive ellipsis (`...`) for navigation across many pages.

## 3. Verification & Compliance
- **Compilation**: `pnpm run build` exits 0 with 0 errors.
- **Browser Automation**: End-to-end verified with `bsk` on Chromium desktop and mobile viewports.
- **Git Invariant**: Strictly committed and pushed to remote branch `origin reborn`.
