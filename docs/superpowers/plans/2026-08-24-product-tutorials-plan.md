# Product Video Tutorials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menambahkan manajemen video tutorial multi-link YouTube (single, shorts, playlist) per produk pada Admin Panel dan interactive modal player di Member/Admin area.

**Architecture:** Simpan JSON array `{id, title, url}` pada kolom `products.tutorials`. Buat utility parser YouTube untuk konversi otomatis ke embed URL, dynamic repeater di modal Admin Products, dan interactive player modal dengan playlist selector di view.

**Tech Stack:** TypeScript, Express.js, Prisma ORM, MySQL, Tailwind CSS (SSR Templates), YouTube Iframe Embed API.

---

### Task 1: Database Schema Update & Prisma Client Generation
- [ ] Tambahkan field `tutorials String? @db.LongText` ke model `products` di `prisma/schema.prisma`.
- [ ] Jalankan `npx prisma generate`.

### Task 2: YouTube URL Parser Utility
- [ ] Buat `src/utils/youtube.ts` dengan fungsi `parseYouTubeEmbedUrl` dan `validateTutorialList`.
- [ ] Buat unit test/script verifikasi parser untuk menguji semua format URL YouTube.

### Task 3: Admin Controller & Product CRUD Update
- [ ] Update `processCreateProduct` di `src/controllers/adminController.ts` untuk memproses input tutorials.
- [ ] Update `processEditProduct` di `src/controllers/adminController.ts` untuk memproses update tutorials.
- [ ] Update `showProductsList` di `src/controllers/adminController.ts`.

### Task 4: Admin Products View Enhancement
- [ ] Tambahkan dynamic tutorial rows repeater di `src/views/admin-products.ts` pada modal Add dan Edit.
- [ ] Tambahkan badge jumlah video dan tombol "🎬 Tutorial" pada tabel produk.
- [ ] Tambahkan Interactive YouTube Embed Player Modal dengan playlist drawer.

### Task 5: Member Area Integration
- [ ] Tambahkan tombol "🎬 Tutorial" dan player modal di `src/views/member-licenses.ts`.
- [ ] Tambahkan preview tutorial di `src/views/member-create-order.ts`.

### Task 6: Verification & Documentation Sync
- [ ] Jalankan typecheck `npx tsc --noEmit` & linting.
- [ ] Update `docs/CONTEXT_SNAPSHOT.yaml`, `docs/SYSTEM_FEATURE_MATRIX.md`, dan `ZIQVA_STORE_ANALYSIS.md`.
