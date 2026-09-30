# Full Admin Svelte SPA Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memigrasikan seluruh modul halaman admin ke **Svelte SPA** (`#/admin/...`) tanpa reload halaman, dengan layout, topbar, sidebar, dan tema (`AdminLayout.svelte`, `AdminSidebar.svelte`, `Topbar.svelte`) yang 100% konsisten dengan Member Area.

**Architecture:**
- **Routing**: `svelte-spa-router` mengelola seluruh rute admin:
  - `#/admin/dashboard` -> `AdminDashboard.svelte`
  - `#/admin/payments` -> `AdminPayments.svelte`
  - `#/admin/trials/create` -> `AdminCreateTrial.svelte`
  - `#/admin/products` -> `AdminProducts.svelte`
  - `#/admin/affiliate` -> `AdminAffiliate.svelte`
  - `#/admin/affiliate/history` -> `AdminAffiliateHistory.svelte`
- **Sidebar**: `AdminSidebar.svelte` menggunakan navigasi SPA `href="#/admin/..."` dengan active-tab tracking otomatis tanpa page refresh.
- **Backend API**: `AdminController` menyediakan endpoint JSON API (`/admin/api/*`) untuk seluruh operasi CRUD dan query data, serta me-redirect request browser `text/html` ke `/#/admin/*`.

---

### Task 1: Admin JSON API Endpoints in Backend

**Files:**
- Modify: `src/controllers/adminController.ts`
- Modify: `src/routes/adminRoutes.ts`

**Endpoints:**
1. `GET /admin/api/payments` -> `{ payments, totalPayments, page, totalPages, search, sort, order }`
2. `GET /admin/api/trials/products` -> `{ products: [{ id, name }] }`
3. `GET /admin/api/products` -> `{ products, totalProducts, stats }`
4. `GET /admin/api/affiliate` -> `{ stats, members, total, page, totalPages }`
5. `GET /admin/api/affiliate/history` -> `{ payouts, pagination }`

- [ ] **Step 1: Implement JSON API methods in `adminController.ts`**
- [ ] **Step 2: Register API routes in `adminRoutes.ts`**
- [ ] **Step 3: Test backend compilation with `npx tsc --noEmit`**

---

### Task 2: Update `AdminSidebar.svelte` to SPA Hash Links

**Files:**
- Modify: `client/src/lib/components/AdminSidebar.svelte`

- [ ] **Step 1: Change all `href="/admin/..."` to `href="#/admin/..."`**
- [ ] **Step 2: Verify active page highlighting**

---

### Task 3: Build Admin Svelte SPA Pages

**Files:**
- Create: `client/src/lib/pages/AdminPayments.svelte`
- Create: `client/src/lib/pages/AdminCreateTrial.svelte`
- Create: `client/src/lib/pages/AdminProducts.svelte`
- Create: `client/src/lib/pages/AdminAffiliate.svelte`
- Create: `client/src/lib/pages/AdminAffiliateHistory.svelte`

- [ ] **Step 1: Create `AdminPayments.svelte` with live search, pagination, confirmation modal, duration edit modal**
- [ ] **Step 2: Create `AdminCreateTrial.svelte` with product selector and instant code generation**
- [ ] **Step 3: Create `AdminProducts.svelte` with product catalog, add/edit modal, toggle status, delete modal**
- [ ] **Step 4: Create `AdminAffiliate.svelte` with metric cards, search, mark-as-paid modal**
- [ ] **Step 5: Create `AdminAffiliateHistory.svelte` with payout logs table and filters**

---

### Task 4: Register Routes in `App.svelte` & Build Bundle

**Files:**
- Modify: `client/src/App.svelte`

- [ ] **Step 1: Register all admin SPA routes in `client/src/App.svelte`**
- [ ] **Step 2: Build project with `npm run build`**

---

### Task 5: Automated Verification & Video/Screenshot Testing

**Files:**
- Create/Update: `scripts/verify-all-admin-pages.js`

- [ ] **Step 1: Update verification script to navigate via `#/...` hash without page reload**
- [ ] **Step 2: Test SPA navigation between tabs and capture screenshots**

---

### Task 6: Documentation & Git Commit

**Files:**
- Modify: `docs/CONTEXT_SNAPSHOT.yaml`
- Modify: `ZIQVA_STORE_ANALYSIS.md`

- [ ] **Step 1: Update context snapshot v15**
- [ ] **Step 2: Commit and push to `reborn` branch**
