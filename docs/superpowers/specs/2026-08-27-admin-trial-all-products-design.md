# Design Specification: Admin Create Trial All Products & 1 Month Default Duration

**Date:** 2026-08-27  
**Status:** In Review  
**Target:** `/admin/trials/create` & `GET /admin/api/trials/products`  
**Subsystem:** Admin Panel & Trial Management  

---

## 1. Overview & Goals

Secara default, pembuatan kode trial di panel admin (`#/admin/trials/create`) harus dapat digunakan untuk **seluruh produk** yang terdaftar di database (baik aktif maupun nonaktif di katalog publik), dengan nilai default durasi diatur menjadi **1 Bulan** (`duration: 1`, `unit: 'month'`).

### Requirements:
1. **Ketersediaan Produk**:
   - Backend `GET /admin/api/trials/products` menghapus batasan `where: { is_active: true }` sehingga mengambil semua produk dari tabel `products`.
   - Mengurutkan produk secara rapi (`orderBy: { id: 'asc' }`).
2. **Indikator Status**:
   - Menampilkan penanda `(Nonaktif)` pada dropdown produk jika `is_active === false` agar admin memiliki visibilitas penuh terhadap status produk tanpa menghambat proses generate kode trial.
3. **Default Durasi**:
   - Default nilai input durasi: `1`.
   - Default pilihan satuan waktu: `Bulan` (`unit = 'month'`).

---

## 2. Architecture & Changes

### A. Backend (`src/controllers/adminController.ts`)
- **Method `apiGetTrialProducts`**:
  ```typescript
  const products = await prisma.products.findMany({
      select: { id: true, name: true, price: true, is_active: true },
      orderBy: { id: 'asc' }
  });
  return res.json({ status: 'success', data: { products } });
  ```

### B. Frontend Svelte SPA (`client/src/lib/pages/AdminCreateTrial.svelte`)
- Set default initial state:
  ```typescript
  let duration: number = 1;
  let unit: string = 'month';
  ```
- Render dropdown options:
  ```svelte
  {#each products as prod}
      <option value={prod.name}>
          {prod.name}{prod.is_active === false ? ' (Nonaktif)' : ''}
      </option>
  {/each}
  ```

### C. SSR Fallback View (`src/views/admin-create-trial.ts`)
- Update `unit` dropdown default selected ke `month`:
  ```html
  <option value="hour">Jam</option>
  <option value="day">Hari</option>
  <option value="month" selected>Bulan</option>
  ```

---

## 3. Verification Plan
1. **API Check**: Verifikasi `GET /admin/api/trials/products` mengembalikan seluruh produk beserta flag `is_active`.
2. **Build Check**: `npm run build` (client Vite + server TypeScript) lolos 100% (0 errors).
3. **UI / Functional Check**: Form inisialisasi dengan durasi `1 Bulan` dan dropdown menampilkan seluruh produk.
