# Design Specification: Bundle Satellite Product Icons & Included Products List

## Overview
Menambahkan tampilan **Ikon Satelit Orbit** di sekeliling lingkaran ikon bundel utama serta **Daftar Nama Software Bot** yang termasuk di dalam Paket Bundle pada Member Dashboard (`Dashboard.svelte`) dan halaman Detail Produk (`ProductDetail.svelte`).

---

## Visual Design & Layout (Pilihan 1)

### 1. Ikon Satelit Orbit di Sekitar Lingkaran Bundel (`Dashboard.svelte`)
- **Visual Orbit Container**:
  - Lingkaran tengah utama menampilkan ikon bundel / 3D box atau gambar utama bundel.
  - Jika produk bertipe bundel (`is_bundle === true`) dan memiliki `bundle_items`, sistem mengambil hingga 3-4 ikon/gambar produk penyusun.
  - Ikon-ikon mini tersebut ditempatkan secara melingkar di sekeliling ikon bundel utama (posisi orbit jam 10, jam 2, dan jam 6 atau melingkar dengan CSS absolute positioning `-top-2 -left-2`, `-top-2 -right-2`, `-bottom-2 right-4`).
  - Setiap ikon mini (ukuran 20px - 22px) memiliki border melingkar putih/dark (`border-2 border-slate-900 shadow-md rounded-full object-cover`).

### 2. Tag Pill List pada Kartu Produk Katalog
- **Di Seksi Katalog Grid Member**:
  - Di bawah deskripsi singkat kartu produk bundel, terdapat seksi ringkas *"📦 Termasuk (X Software Bot):"* dengan pill-pill tag berlatar belakang semi-transparan dan centang hijau (`✓`) untuk setiap nama software bot penyusun.

### 3. Detail Produk Bundel (`ProductDetail.svelte`)
- **Detail View Update**:
  - Halaman detail produk bundel memuat daftar lengkap produk penyusun lengkap dengan ikon, deskripsi singkat, dan badge status terverifikasi.

---

## Verification Plan

1. Jalankan `pnpm run build` untuk memverifikasi 0 error kompilasi TypeScript/Svelte.
2. Lakukan inspeksi visual UI browser Google Chrome untuk memastikan posisi ikon satelit orbit dan tag pill list terlihat presisi dan responsif.
