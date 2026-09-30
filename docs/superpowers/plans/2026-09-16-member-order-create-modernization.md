# Implementation Plan: Member Create Order Modernization & Mobile Ergonomics

**Date**: 2026-09-16  
**Target Branch**: `reborn`  
**Files Modified**:
- `client/src/lib/pages/ProductDetail.svelte`
- `docs/CONTEXT_SNAPSHOT.yaml`
- `ZIQVA_STORE_ANALYSIS.md`

---

## Phase 1: Re-architecting `ProductDetail.svelte`
1. **Header & Navigation Bar**:
   - Add modern header with tag pill, title `Buat Pesanan Baru`, subtitle, and top-right navigation button `← Lihat Pesanan Saya` (`#/member/orders`).
2. **Left Column (Configurator & Product Identity)**:
   - Modernize software selector with `CustomDropdown`.
   - Selected software card with icon, title, category badge, user count dot, and description.
   - Bundle software breakdown cards with verification checkmarks.
   - Proportional percentage sliding pill duration switcher (`translateX(0% | 100% | 200%)`).
   - Voucher code input with clear button (`removeVoucher`) and active discount badge.
   - Features & guarantees bullet list.
3. **Right Column (Sticky Checkout Summary Card)**:
   - Transparent price itemization breakdown.
   - Large prominent total price display with savings badge.
   - Big tactile submit button with loading spinner and free/paid icons.
   - Trust and license specs (Masa Aktif, Aktivasi Instan, Machine ID Bound, Video Tutorial quick-link).
4. **Interactive Success Modal**:
   - Clean modern modal for order creation / free claim with direct link to `#/member/orders` or `#/member/licenses`.

---

## Phase 2: Build & Browser Verification
1. Run `cd client; pnpm run build` to verify clean compilation.
2. Launch browser tests using `bsk` across Desktop ($1280\times800$) and Mobile ($390\times844$).
3. Test product selection, duration switching, coupon application & removal, and mobile layout.

---

## Phase 3: Documentation & Commit
1. Update `docs/CONTEXT_SNAPSHOT.yaml` and `ZIQVA_STORE_ANALYSIS.md`.
2. Commit and push to branch `reborn`.
