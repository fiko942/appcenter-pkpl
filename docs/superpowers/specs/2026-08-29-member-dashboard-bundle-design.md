# Design Specification: Member Dashboard Bundle Product Integration

## Overview
Menambahkan integrasi visual dan fungsionalitas **Paket Bundle** pada Member Dashboard (`client/src/lib/pages/Dashboard.svelte`). Pengguna memilih **Pendekatan 2**: Seksi Highlight Terpisah ("🔥 Paket Bundle Hemat Pilihan") di bawah Welcome Hero, serta kartu filter kategori khusus "📦 Paket Bundle" di seksi kategori.

---

## Key Features & Visual Layout

### 1. Seksi Highlight Terpisah: "🔥 Paket Bundle Hemat Pilihan"
- **Lokasi**: Di bawah *Welcome Hero Section* dan di atas *Jelajahi Kategori*.
- **Kondisi Tampil**: Muncul secara otomatis jika terdapat produk aktif yang memiliki flag `is_bundle === true`.
- **Desain Cards**:
  - Kartu bundel menggunakan gradien bernuansa premium (emas/purple glow border, badge "📦 BUNDEL HEMAT").
  - Menampilkan ringkasan daftar software bot yang termasuk di dalam bundel (parsed dari `bundle_items`).
  - Menampilkan harga hemat dan tombol aksi langsung *"Lihat Paket Bundel →"*.

### 2. Kartu Filter Kategori Khusus: "📦 Paket Bundle"
- **Lokasi**: Di seksi *Jelajahi Kategori*.
- **Fungsi**: Menjadi opsi filter bersama kategori reguler lainnya.
- **Perilaku Filter**:
  - Memilih filter "Paket Bundle" menyaring grid produk utama untuk hanya menampilkan produk dengan `is_bundle === true`.
  - Menampilkan badge counter jumlah paket bundel yang tersedia.

### 3. Backend & Frontend Compatibility
- `memberController.ts` (`apiGetDashboard`):
  - Memastikan query `prisma.products` tetap mengembalikan seluruh produk aktif (termasuk `is_bundle` & `bundle_items`).
  - Memasukkan nama-nama produk penyusun bundel ke dalam payload dashboard atau melakukan pencocokan langsung di frontend.

---

## Verification Plan

1. Run `pnpm run build` to verify 0 TypeScript/Svelte compilation errors.
2. Run visual Chrome inspection test to ensure the new section renders cleanly on desktop and mobile viewports.
