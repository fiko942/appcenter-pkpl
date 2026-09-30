# Interactive Affiliate Commission Simulator & Transparent Breakdown Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Elevate the Affiliate Program Simulator in `LandingPage.svelte` to feature dynamic software selection, selectable license duration (1, 2, 3, 6, 12 bulan), discount voucher simulation percentage, and transparent financial breakdown matching the backend's real order settlement calculation formula.

## Core Financial Formula from Codebase (`memberController.ts` & `adminController.ts`):
1. **Base Price**: `Product Base Price × License Duration (Months)`
2. **Product Discount (if any)**: `Product.is_discount ? Base Price * (Product.discount_percent / 100) : 0`
3. **Price After Product Discount**: `Gross Price = Base Price - Product Discount`
4. **Voucher / Coupon Discount**: `Discount Amount = Gross Price × (Voucher % / 100)`
5. **Customer Paid Price (`customer_paid_price`)**: `Net Paid = Gross Price - Discount Amount`
6. **Affiliate Commission (`affiliate_income`)**: `Net Paid × (Affiliate Commission % / 100)` (Default 10% - 30%)
7. **Monthly Total Potential**: `Affiliate Commission per Order × Estimated Monthly Sales`

---

### Task 1: Enhance Affiliate State & Multi-Variable Simulator in `LandingPage.svelte`

**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte`

- [ ] **Step 1: Add Reactive Simulator Controls**
  - `selectedSimProduct: ProductItem | null` (defaults to first paid product or fallback).
  - `simDurationMonths: number` (1, 2, 3, 6, 12 bulan selector).
  - `simVoucherPercent: number` (Slider or presets: 0%, 5%, 10%, 15%, 20%).
  - `simAffiliateRate: number = 0.30` (30% commission rate).
  - `simMonthlySales: number = 15` (Slider 1 - 100).
- [ ] **Step 2: Reactive Calculation & Breakdown**
  - Compute `unitBasePrice = selectedSimProduct ? selectedSimProduct.price * simDurationMonths : 149000 * simDurationMonths`
  - Compute `unitVoucherDiscount = Math.round(unitBasePrice * (simVoucherPercent / 100))`
  - Compute `unitCustomerPaid = unitBasePrice - unitVoucherDiscount`
  - Compute `commissionPerOrder = Math.round(unitCustomerPaid * simAffiliateRate)`
  - Compute `totalMonthlyCommission = commissionPerOrder * simMonthlySales`
- [ ] **Step 3: Render Glassmorphic Interactive Simulator UI**
  - Product Dropdown/Pills selector.
  - Duration Pills (1 Bln, 2 Bln, 3 Bln, 6 Bln, 12 Bln).
  - Coupon Discount Selector (0%, 10%, 20%).
  - Monthly Sales Slider (1 - 100 lisensi).
  - Transparent Breakdown Summary Box:
    - Harga Normal per Lisensi
    - Potongan Diskon Kupon
    - Uang Dibayar Pembeli
    - Komisi Bersih / Order (30%)
    - **Total Potensi Komisi / Bulan**
- [ ] **Step 4: Build & Verify**
  - Run `pnpm run build` to verify clean compilation.
