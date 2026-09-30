# Design Specification: Floating Glassmorphic App Stack UI for Bundle Products

## Overview
Merombak total tampilan visual produk Paket Bundle di **Member Dashboard** (`client/src/lib/pages/Dashboard.svelte`) dari tampilan orbit melingkar yang cluttered menjadi **Floating Glassmorphic App Stack (Tumpukan Ikon Melayang 3D)** yang ultra-modern, rapi, dan elegan (Apple/Stripe-level aesthetic).

---

## Detailed Visual UI Specification (Opsi 1)

### 1. Banner Header Visual (`product-visual` untuk Bundel)
- **Background Atmosphere**:
  - Menggunakan latar gradien **Aurora Glow Premium** (campuran `indigo-900/40`, `purple-900/30`, dan `amber-500/10` dengan `radial glow shadow`).
  - Badge sudut `"📦 BUNDEL HEMAT"` berdesain pil kaca (*glass pill*) berwarna ungu/emas dengan efek bercahaya (*glow accent*).

- **Floating Glassmorphic App Stack**:
  - Di tengah banner header, terdapat kontainer kaca transparan (`backdrop-blur-md bg-white/10 dark:bg-slate-900/40 border border-white/20 dark:border-white/10 rounded-2xl px-4 py-3 shadow-2xl flex items-center justify-center`).
  - Di dalam kontainer kaca tersebut, ikon-ikon software bot penyusun (hingga 4 produk) ditampilkan secara **Overlapping Avatar Stack**:
    - Kelas CSS: `-space-x-3.5 hover:space-x-1.5 transition-all duration-300 ease-out group/stack`.
    - Setiap ikon aplikasi berukuran **40px × 40px** (`w-10 h-10 rounded-xl object-cover border-2 border-white dark:border-slate-900 shadow-lg ring-1 ring-black/10 transition-all duration-300 transform group-hover/stack:hover:-translate-y-1 group-hover/stack:hover:scale-110`).
    - Apabila gambar tidak tersedia, menampilkan inisial huruf dengan gradien warna modern.

### 2. Tag List Software Penyusun (`product-copy` Body Card)
- **Label Header**:
  - `"📦 TERMASUK X SOFTWARE BOT:"` menggunakan font font-mono / font-sans tebal berukuran 10px uppercase dengan warna emas (`text-amber-500 dark:text-amber-400 font-extrabold tracking-wider`).
- **Included Tools Chips**:
  - Chip software bot menggunakan latar belakang *frosted glass* halus (`bg-slate-100 dark:bg-slate-800/80 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/60 rounded-lg px-2.5 py-1 text-xs font-semibold flex items-center gap-1.5 shadow-2xs hover:border-amber-500/50 transition-colors`).
  - Setiap chip memuat thumbnail mini ikon asli berukuran **16px × 16px** (atau centang hijau `✓`).

### 3. Seksi Highlight Bundel ("🔥 Paket Bundle Hemat Pilihan")
- Menerapkan desain *Floating Glassmorphic App Stack* yang sama pada kartu-kartu di seksi highlight atas agar tampilan konsisten di seluruh dashboard.

---

## Verification Plan

1. Jalankan `pnpm run build` untuk memverifikasi 0 error kompilasi Svelte & TypeScript.
2. Lakukan pengujian visual untuk memastikan tumpukan ikon *hover animation* berjalan mulus di desktop & mobile viewports.
