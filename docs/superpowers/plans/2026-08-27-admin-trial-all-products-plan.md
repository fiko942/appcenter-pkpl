# Admin Create Trial All Products & 1 Month Default Duration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Memastikan seluruh produk (aktif maupun nonaktif) tersedia pada form Buat Trial di Admin Panel (`#/admin/trials/create`), dengan nilai default durasi diatur menjadi **1 Bulan** (`duration: 1`, `unit: 'month'`).

**Architecture:** Backend API `AdminController.apiGetTrialProducts` menghapus filter `is_active: true` dan menyertakan flag `is_active` dalam response JSON. Frontend Svelte `AdminCreateTrial.svelte` menginisialisasi state dengan durasi 1 bulan dan menampilkan label `(Nonaktif)` jika produk nonaktif.

**Architecture Diagram:**

```mermaid
graph TD
    subgraph "Admin Svelte SPA (client/)"
        A[AdminCreateTrial.svelte] -->|Default duration: 1, unit: month| A
        A -->|Fetch GET /admin/api/trials/products| B[Express Backend Route]
    end

    subgraph "Express Backend"
        B --> C[AdminController.apiGetTrialProducts]
        C --> D[(Prisma MySQL: products table - ALL products)]
        D -->|Return all products with is_active flag| C
        C -->|JSON: { status: 'success', data: { products } }| A
    end
```

**Tech Stack:** Svelte 4, Vite 5, TypeScript 5.9, Express.js 5, Prisma ORM, MySQL.

## Global Constraints

- Single Port Invariant: Express backend dan Svelte client bundle tetap berjalan pada port `4829`.
- Git Branch Invariant: Seluruh commit dan push wajib ditujukan ke branch `reborn`. Jangan push ke `master`.
- Member Area Invariant: Endpoint produk member (`/member/api/products`) tetap memfilter `where: { is_active: true }` tanpa perubahan.

---

### Task 1: Backend `apiGetTrialProducts` Update

**Files:**
- Modify: `src/controllers/adminController.ts:125-136`

**Interfaces:**
- Produces: `GET /admin/api/trials/products` -> JSON `{ status: 'success', data: { products: Array<{ id: number, name: string, price: number, is_active: boolean }> } }`

- [ ] **Step 1: Modify `apiGetTrialProducts` in `src/controllers/adminController.ts`**

```diff
     async apiGetTrialProducts(req: Request, res: Response) {
         try {
             const products = await prisma.products.findMany({
-                where: { is_active: true },
-                select: { id: true, name: true, price: true }
+                select: { id: true, name: true, price: true, is_active: true },
+                orderBy: { id: 'asc' }
             });
             return res.json({ status: 'success', data: { products } });
         } catch (error) {
```

- [ ] **Step 2: Run TypeScript typecheck**

Run: `npx tsc --noEmit`  
Expected: 0 errors.

---

### Task 2: Frontend `AdminCreateTrial.svelte` & SSR View Update

**Files:**
- Modify: `client/src/lib/pages/AdminCreateTrial.svelte`
- Modify: `src/views/admin-create-trial.ts`

**Interfaces:**
- Consumes: `products` array from `GET /admin/api/trials/products`.
- Produces: Default state `duration: 1`, `unit: 'month'`, option labels with `(Nonaktif)` tag if inactive, and updated empty state message.

- [ ] **Step 1: Update initial state and interface in `client/src/lib/pages/AdminCreateTrial.svelte`**

```diff
     interface ProductItem {
         id: number;
         name: string;
         price: number;
+        is_active?: boolean;
     }

     let loadingProducts: boolean = true;
     let products: ProductItem[] = [];
     let error: string = '';

     let selectedProduct: string = '';
     let duration: number = 1;
-    let unit: string = 'day';
+    let unit: string = 'month';
```

- [ ] **Step 2: Update template dropdown and empty state in `client/src/lib/pages/AdminCreateTrial.svelte`**

```diff
                     {#if loadingProducts}
                         <div class="h-10 rounded-xl bg-[var(--surface-2)] animate-pulse"></div>
                     {:else if products.length === 0}
-                        <p class="text-xs text-red-400">Tidak ada produk aktif ditemukan di katalog.</p>
+                        <p class="text-xs text-red-400">Tidak ada produk ditemukan di database.</p>
                     {:else}
                         <select
                             id="productSelect"
                             bind:value={selectedProduct}
                             class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                         >
                             {#each products as prod}
-                                <option value={prod.name}>{prod.name}</option>
+                                <option value={prod.name}>
+                                    {prod.name}{prod.is_active === false ? ' (Nonaktif)' : ''}
+                                </option>
                             {/each}
                         </select>
                     {/if}
```

- [ ] **Step 3: Update SSR template default selected option in `src/views/admin-create-trial.ts`**

```diff
                     <select name="unit" required class="w-full bg-gray-800/50 border border-gray-700 focus:border-blue-500 text-white rounded-xl py-3 px-4 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium">
                         <option value="hour">Jam</option>
-                        <option value="day" selected>Hari</option>
-                        <option value="month">Bulan</option>
+                        <option value="day">Hari</option>
+                        <option value="month" selected>Bulan</option>
                     </select>
```

---

### Task 3: Build & Automated Verification

**Files:**
- Test / Build execution

- [ ] **Step 1: Run full production build**

Run: `npm run build`  
Expected: Client Vite build + server tsc compile complete with exit code 0.

- [ ] **Step 2: Verify API endpoint response**

Run: `curl -s http://localhost:4829/admin/api/trials/products`  
Expected: JSON contains all products including inactive products with `is_active: false`.

---

### Task 4: Documentation & Git Commit

**Files:**
- Modify: `docs/CONTEXT_SNAPSHOT.yaml`
- Modify: `ZIQVA_STORE_ANALYSIS.md`

- [ ] **Step 1: Update context snapshot & development log**
- [ ] **Step 2: Commit and push to branch `reborn`**

Run: `git add . && git commit -m "feat(admin): enable all products on create trial page and set default duration to 1 month"`  
Run: `git push origin reborn`
