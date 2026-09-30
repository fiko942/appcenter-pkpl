# Fix Admin Payments Action Buttons Overflow & Responsive Split-Screen Cards

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mengatasi masalah tombol aksi yang meluap keluar dari batas kartu transaksi (*action buttons overflow*), teks produk yang terpotong parah, dan tombol paginasi yang melipat berantakan pada tampilan split-screen Windows (~800px - 1000px) di `AdminPayments.svelte`.

**Root Cause:**
1. Breakpoint `md:grid-cols-2` memaksa kartu dibagi 2 kolom pada lebar layar `768px - 1279px`. Namun karena ada sidebar admin tetap selebar 256px (`md:pl-64`), lebar riil kontainer kartu hanya ~500px, sehingga lebar per kartu hanya ~230px.
2. Keempat tombol aksi (`[Invoice]`, `[Detail]`, `[Durasi]`, `[Lunas]`) membutuhkan lebar minimum ~250px sehingga tembus keluar melewati garis tepi kartu.
3. Deretan 9 tombol paginasi bernomor melipat menjadi 2-3 baris yang berantakan pada kontainer sempit.

**Architecture & Fix Plan:**
1. **Card Grid Breakpoint**:
   - Ubah grid kartu transaksi menjadi `grid-cols-1` untuk seluruh viewport di bawah `xl:` (yaitu mobile, tablet, dan split-screen Windows).
   - Setiap kartu kini memiliki lebar penuh yang lapang (~500px - 900px), memberikan ruang lega untuk nama produk penuh, info pelanggan, lisensi, dan semua tombol aksi tanpa terpotong.
2. **Action Buttons Dock**:
   - Terapkan `flex-wrap` dan tata letak aman: `flex items-center justify-end gap-1.5 flex-wrap pt-2.5 border-t border-[var(--border)]/60`.
   - Pastikan kartu memiliki `overflow-hidden` sehingga tidak ada elemen yang dapat bocor keluar dari border kartu.
3. **Responsive Compact Numbered Pagination**:
   - Sederhanakan generator nomor halaman: tampilkan maksimal 3–5 tombol halaman atau adaptif (`[Sebelumnya] [1] [2] [3] ... [981] [Selanjutnya]`).
   - Buat pagination bar terstruktur rapi pada split screen dan mobile.
4. **Visual Verification**:
   - Uji langsung di resolusi split-screen Windows (850x850), mobile (390x844), dan desktop (1440x900) dengan screenshot QA.
