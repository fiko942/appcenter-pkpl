# Implementation Plan: Member Area Affiliate Program with Enrollment Gate, Payouts & SPA Integration

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build full-featured Member Area Affiliate Module in Svelte SPA with Enrollment Gate (6 completed orders requirement within 6 months), interactive Payout & Coupon Management, Transaction History, and Payout History.

**Architecture:** 
1. Server-side: Add JSON REST endpoints in `src/controllers/memberController.ts` & `src/routes/memberRoutes.ts` (`/member/api/affiliate`, `/member/api/affiliate/join`, `/member/api/affiliate/update-payout`, `/member/api/affiliate/update-coupon`, `/member/api/affiliate/payouts`).
2. Client-side: Create `Affiliate.svelte` and `AffiliatePayouts.svelte` in `client/src/lib/pages/`, register routes in `client/src/App.svelte`, and add menu item in `client/src/lib/components/Sidebar.svelte`.

**Tech Stack:** Express 5 + TypeScript + Prisma ORM + MySQL + Svelte 4 / TailwindCSS

---

### Task 1: Add Member Affiliate JSON REST API Endpoints

**Files:**
- Modify: `src/controllers/memberController.ts`
- Modify: `src/routes/memberRoutes.ts`

- [ ] **Step 1: Implement `apiGetAffiliate` in `memberController.ts`**
  Add JSON response returning:
  - `isEnrolled`: Boolean
  - `isEligible`: Boolean (`ordersCount >= 6` in past 180 days with `status: 'Order has been complete'`)
  - `ordersCount`: Number
  - `requiredOrders`: 6
  - `profile`: `{ kupon, created, payout_bank_name, payout_no_rek, payout_name }`
  - `stats`: `{ totalIncome, totalPending }`
  - `lastPayout`: `{ amount, created }`
  - `transactions`: Enriched list with pagination and sorting.

- [ ] **Step 2: Implement `apiJoinAffiliate`, `apiUpdateAffiliatePayout`, `apiUpdateAffiliateCoupon`, `apiGetAffiliatePayouts` in `memberController.ts`**
  - Ensure all endpoints return structured `{ status: 'success' | 'error', message, data }`.
  - Validate 6-order eligibility on join before creating `affiliate_member` record.
  - Coupon formatting (uppercase, alphanumeric, min 3 chars, uniqueness check against `voucers` and `affiliate_member`).

- [ ] **Step 3: Register API routes in `memberRoutes.ts`**
  ```typescript
  router.get('/api/affiliate', (req, res) => memberController.apiGetAffiliate(req, res));
  router.post('/api/affiliate/join', (req, res) => memberController.apiJoinAffiliate(req, res));
  router.post('/api/affiliate/update-payout', (req, res) => memberController.apiUpdateAffiliatePayout(req, res));
  router.post('/api/affiliate/update-coupon', (req, res) => memberController.apiUpdateAffiliateCoupon(req, res));
  router.get('/api/affiliate/payouts', (req, res) => memberController.apiGetAffiliatePayouts(req, res));
  ```

- [ ] **Step 4: Verify build**
  Run: `pnpm run build`
  Expected: PASS (Exit code 0)

---

### Task 2: Create Svelte Member Affiliate View (`Affiliate.svelte`)

**Files:**
- Create: `client/src/lib/pages/Affiliate.svelte`

- [ ] **Step 1: Build Enrollment Gate State (Locked / Unlocked)**
  - If `!isEnrolled`:
    - Display locked enrollment card with activity progress bar (`ordersCount / 6 Order`).
    - If `isEligible`: Show active gradient CTA **"DAFTAR SEKARANG"**.
    - If `!isEligible`: Show amber warning banner detailing missing order count and button **"Beli Produk"** (`#/member/orders/create`).

- [ ] **Step 2: Build Unlocked Affiliate Dashboard State**
  - 5 Stat Cards:
    1. **Kupon**: Display active coupon code, copy button, edit modal trigger.
    2. **Rekening Bank**: Bank name, account number, owner name, edit modal trigger.
    3. **Total Order**: Referral transaction count.
    4. **Total Komisi**: Rp amount formatted.
    5. **Pencairan Terakhir / Payout**: Rp amount, date, and link to `#/member/affiliate/payouts`.
  - Performance Banner: Dynamic comparison between current pending income vs last payout.
  - Transaction History Table: Search query, sort by date/commission/price/duration, status, customer email/name, and pagination.

- [ ] **Step 3: Build Interactive Modals (Edit Coupon & Edit Bank Info)**
  - Modal Edit Kupon: Input with live validation, check availability against backend.
  - Modal Edit Bank: Bank selector (BCA, BNI, BRI, Mandiri, etc.), account number, account owner name.

- [ ] **Step 4: Verify build**
  Run: `pnpm run build`
  Expected: PASS (Exit code 0)

---

### Task 3: Create Svelte Member Affiliate Payouts View (`AffiliatePayouts.svelte`)

**Files:**
- Create: `client/src/lib/pages/AffiliatePayouts.svelte`

- [ ] **Step 1: Implement Payout History Table & Metrics**
  - Summary stats: Total pencairan yang telah ditransfer vs komisi pending yang siap dicairkan.
  - History list: Date, amount, status badge (*Paid / Pending*), payout notes, bank details.
  - Back button navigating to `#/member/affiliate`.

- [ ] **Step 2: Verify build**
  Run: `pnpm run build`
  Expected: PASS (Exit code 0)

---

### Task 4: Integrate Routes & Member Sidebar Navigation

**Files:**
- Modify: `client/src/App.svelte`
- Modify: `client/src/lib/components/Sidebar.svelte`

- [ ] **Step 1: Add routes in `App.svelte`**
  ```typescript
  '/member/affiliate': wrap({
      component: Affiliate,
      conditions: [() => requireAuth('/member/login')]
  }),
  '/member/affiliate/payouts': wrap({
      component: AffiliatePayouts,
      conditions: [() => requireAuth('/member/login')]
  }),
  ```

- [ ] **Step 2: Add "Mitra Afiliasi" item to `Sidebar.svelte`**
  - Place between `Download Hub` and `Order Baru`.
  - Icon: Trending / Dollar / Gift referral icon.
  - Label: `Mitra Afiliasi` (active state on `activePage === 'affiliate' || activePage === 'affiliate-payouts'`).
  - Animated sliding pill indicator support.

- [ ] **Step 3: Build & Full Verification**
  Run: `pnpm run build`
  Expected: PASS (Exit code 0)
