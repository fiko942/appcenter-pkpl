# Design Specification: Product Video Tutorials (YouTube & Playlists)

**Date**: 2026-08-24  
**Status**: Proposed / Review  
**Subsystem**: Admin Products Management & Member/Public Video Tutorial Viewer  

---

## 1. Overview & Goal
Fitur ini memungkinkan Admin untuk mengelola banyak link tutorial video YouTube (video tunggal, video shorts, maupun playlist YouTube) untuk setiap produk di AppCenter V2, serta menyediakan modal interaktif YouTube embed player bagi user/member untuk menonton tutorial langsung di tempat.

---

## 2. Database Schema Changes
Pada tabel MySQL `products`, ditambahkan kolom opsional `tutorials`:

```prisma
model products {
  id               Int     @id @default(autoincrement())
  name             String  @db.LongText
  image            String  @db.LongText
  product_id       Int
  description      String  @db.LongText
  price            Float   @db.Float
  is_discount      Boolean
  discount_percent Int
  is_active        Boolean @default(true)
  tutorials        String? @db.LongText  // JSON String: Array of { id: string, title: string, url: string }
}
```

### JSON Data Structure:
```json
[
  {
    "id": "tut_1724500000_1",
    "title": "Tutorial Instalasi & Setup Awal",
    "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
  },
  {
    "id": "tut_1724500000_2",
    "title": "Playlist Panduan Lengkap Bot 2026",
    "url": "https://www.youtube.com/playlist?list=PLxxxxxxxxxxxxxxxx"
  }
]
```

---

## 3. YouTube Embed Parser Engine
Sistem menyediakan fungsi parser client-side & server-side yang mendukung seluruh format URL YouTube:
1. **Standard Video**: `https://www.youtube.com/watch?v=VIDEO_ID` $\rightarrow$ `https://www.youtube.com/embed/VIDEO_ID`
2. **Short URL**: `https://youtu.be/VIDEO_ID` $\rightarrow$ `https://www.youtube.com/embed/VIDEO_ID`
3. **Shorts URL**: `https://www.youtube.com/shorts/VIDEO_ID` $\rightarrow$ `https://www.youtube.com/embed/VIDEO_ID`
4. **Playlist URL**: `https://www.youtube.com/playlist?list=PLAYLIST_ID` $\rightarrow$ `https://www.youtube.com/embed/videoseries?list=PLAYLIST_ID`
5. **Video dalam Playlist**: `https://www.youtube.com/watch?v=VIDEO_ID&list=PLAYLIST_ID` $\rightarrow$ `https://www.youtube.com/embed/VIDEO_ID?list=PLAYLIST_ID`

---

## 4. UI/UX Workflow & Components

### A. Admin Panel (`/admin/products`):
1. **Tabel Produk**:
   - Kolom baru / Badge indikator jumlah tutorial (e.g. `🎬 3 Video`).
   - Tombol aksi "Kelola Tutorial" dan tombol view langsung.
2. **Modal Tambah & Edit Produk**:
   - Bagian dinamis "Daftar Tutorial Video".
   - Tombol "+ Tambah Video Tutorial" (menambahkan baris Judul Video + URL YouTube secara dinamis di form).
   - Tombol hapus baris per video tutorial.
   - Validasi URL YouTube otomatis sebelum submit.

### B. Interactive Tutorial Modal (Member & Admin):
1. **Modal Overlay Glassmorphism**:
   - Header: Nama Produk & Badge jumlah video.
   - **Split View / Playlist Drawer**:
     - Sisi Kiri / Atas: Frame Iframe YouTube Embed responsif (16:9 aspect ratio).
     - Sisi Kanan / Bawah: Daftar list playlist video tutorial yang bisa diklik untuk langsung berpindah video secara instan tanpa reload halaman.
   - Tombol external link untuk membuka langsung di tab baru YouTube jika diinginkan.

---

## 5. Security & Safety Controls
- **XSS Sanitization**: Validasi format URL hanya mengizinkan domain `youtube.com` dan `youtu.be`.
- **Safe JSON Parsing**: Fallback array kosong `[]` jika data `tutorials` kosong atau bernilai null.
- **Backward Compatibility**: Tidak mengubah flow produk yang sudah ada, produk tanpa tutorial tetap berjalan normal.

---

## 6. Implementation Plan Matrix

| File Target | Tipe Perubahan | Deskripsi |
| :--- | :--- | :--- |
| `prisma/schema.prisma` | Schema Update | Tambah field `tutorials String? @db.LongText` pada model `products`. |
| `src/controllers/adminController.ts` | Controller Logic | Update `showProductsList`, `processCreateProduct`, dan `processEditProduct` untuk handle parsing dan penyimpanan JSON tutorials. |
| `src/views/admin-products.ts` | UI View | Tambah dynamic tutorial rows repeater pada modal Add/Edit + tombol/modal tutorial player di Admin. |
| `src/views/member-licenses.ts` & `src/views/member-create-order.ts` | UI View | Tambah tombol "🎬 Lihat Tutorial" untuk produk yang memiliki tutorial. |
| `docs/CONTEXT_SNAPSHOT.yaml` & `ZIQVA_STORE_ANALYSIS.md` | Documentation | Update dokumentasi arsitektur setelah fitur selesai diimplementasikan. |
