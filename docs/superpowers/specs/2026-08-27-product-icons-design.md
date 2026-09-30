# Design Specification: Product Icons & Images Management Across Admin and Member Surfaces

**Date:** 2026-08-27  
**Status:** Approved  
**Target:** Product Catalog & UI Visuals (Admin & Member)  
**Subsystem:** Products Management, Asset Storage, and Component UI Design  

---

## 1. Overview & Goals

Menyediakan sistem pengelolaan dan tampilan icon/gambar produk yang komprehensif untuk seluruh aplikasi AppCenter V2. Administrator dapat mengunggah file gambar (PNG, JPG, WEBP, SVG), memasukkan URL gambar, atau memilih preset icon pada form tambah/edit produk di panel admin (`#/admin/products`). Gambar produk tersebut ditampilkan secara konsisten di seluruh antarmuka Member dan Admin dengan fallback inisial huruf yang anggun jika gambar belum tersedia atau gagal dimuat.

---

## 2. Architecture & Data Flow

```mermaid
graph TD
    subgraph "Admin Management (#/admin/products)"
        AdminUI[AdminProducts.svelte Form Modal] -->|Upload File / Input URL / Pick Preset| UploadAPI[POST /admin/api/products/:id/upload-image OR create/edit payload]
        UploadAPI -->|Store File locally| StaticDir[public/uploads/products/prod-id-timestamp.png]
        UploadAPI -->|Save image path/url| DB[(Prisma MySQL: products.image)]
    end

    subgraph "Express Static Server"
        StaticDir -->|Serve Static| HTTPStatic[/uploads/products/*]
    end

    subgraph "Member & Admin UI Presentation"
        DB --> MemberAPIs[GET /member/api/products, /dashboard, /downloads, etc]
        DB --> AdminAPIs[GET /admin/api/products, /admin/api/trials/products]
        MemberAPIs --> CustomDropdown[CustomDropdown.svelte: w-9 h-9 & w-7 h-7 thumbnail]
        MemberAPIs --> Dashboard[Dashboard.svelte: Product Orbit Card icon]
        MemberAPIs --> ProductDetail[ProductDetail.svelte: 3D Visual Hero icon]
        MemberAPIs --> Downloads[Downloads.svelte: Software Card icon]
        MemberAPIs --> Tutorials[Tutorials.svelte: Tool Tab selector icon]
        MemberAPIs --> Licenses[Licenses.svelte: License Card icon]
        AdminAPIs --> AdminProductsTable[AdminProducts.svelte: Table avatar 40x40px]
    end
```

---

## 3. UI/UX Specification

### A. Admin Products Management (`AdminProducts.svelte`):
1. **Tabel Katalog Produk**:
   - Kolom Produk menampilkan thumbnail persegi `w-10 h-10` (`40x40px`) rounded-xl dengan `border border-[var(--border)]`, `bg-[var(--surface-2)]`, dan `object-cover`.
   - Jika `image` null/kosong atau broken (`on:error`), otomatis render inisial huruf produk dengan gradasi biru-indigo yang serasi.
2. **Modal Tambah & Edit Produk**:
   - Section **Icon / Gambar Software**:
     - **Live Preview Box** (`64x64px rounded-2xl border shadow-inner`): Menampilkan gambar saat ini secara instan.
     - **File Upload Button**: Upload file gambar (PNG, JPG, WEBP, SVG max 2MB) langsung dari komputer.
     - **Image URL Field**: Input teks link gambar eksternal opsional.
     - **Preset Icon Selector**: Pilihan 8 icon SVG software modern (Bot/Automation, Scraper, Social Media, E-commerce, Stream, Video, Marketing, Security).
     - Tombol **Hapus / Reset**: Mengosongkan icon produk.

### B. Member Area Components:
1. **`CustomDropdown.svelte`**:
   - Menampilkan icon produk pada trigger button (`w-9 h-9`) dan setiap item option (`w-7 h-7`).
   - Dilengkapi fallback `on:error` ke huruf inisial.
2. **`ProductDetail.svelte` (Checkout)**:
   - Menampilkan icon produk resolusi tinggi di tengah orbit visual kiri (`w-20 h-20` atau centered icon).
3. **`Dashboard.svelte`**:
   - Kartu produk populer menampilkan icon software di dalam orbit lingkaran dengan efek glow.
4. **`Downloads.svelte` & `Licenses.svelte`**:
   - Menampilkan thumbnail icon produk `w-10 h-10` di header kartu software dan daftar lisensi.
5. **`Tutorials.svelte`**:
   - Menampilkan icon produk pada tab pemilih software di Video Learning Hub.

---

## 4. Backend & Storage Details

1. **Storage Directory**:
   - Direktori lokal: `public/uploads/products/` (di-copy ke `dist/public/uploads/products/` saat build).
   - Dilayani oleh Express static middleware `app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')))`.
2. **Controller & Route**:
   - Multer middleware untuk handling file upload gambar pada endpoint `POST /admin/api/products/:id/upload-image`.
   - `AdminController.uploadProductImage`: Menyimpan file dengan nama aman `prod-[id]-[timestamp].[ext]`, menghapus file lama jika ada di server, dan mengupdate field `image` di database.
   - `AdminController.processCreateProduct` & `processEditProduct`: Mendukung pengisian field `image` baik path lokal `/uploads/products/...` maupun URL HTTPS eksternal.

---

## 5. Security & Validation
- Validasi ekstensi file: Hanya menerima `.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`.
- Batasan ukuran file: Maksimum 2MB per gambar.
- Sanitasi nama file untuk mencegah directory traversal.
