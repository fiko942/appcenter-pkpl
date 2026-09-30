# Plan: Penyelarasan Tombol Bayar Member Orders (Mobile & Desktop)

- [x] **Task 1: Investigasi dan Root Cause Analysis**
  - [x] Audit `Orders.svelte` untuk tombol Bayar di Desktop View (line 805) dan Mobile View (line 592).
  - [x] Cek penanganan `payment_url` di `src/controllers/memberController.ts` pada method `apiGetOrders` dan `payOrder`.

- [x] **Task 2: Penyesuaian Tombol Bayar Mobile di Orders.svelte**
  - [x] Ubah Mobile Card Action Button agar menggunakan `order.payment_url` dengan atribut `target="_blank"` dan `rel="noopener noreferrer"`.
  - [x] Hapus ternary bypass yang memaksa buka hash invoice sebelum QRIS terbuat.

- [x] **Task 3: Perbaikan Parsing Bundler Vite pada AdminOAuthClients.svelte**
  - [x] Komentari deklarasi import `dart:convert` di template snippet Flutter.
  - [x] Verifikasi `pnpm vite build` bebas error.

- [x] **Task 4: Sinkronisasi dan Build Verification**
  - [x] Jalankan `pnpm run build` dan verifikasi bundle asset terkompilasi bersih.
  - [x] Push perubahan ke GitHub branch `reborn`.
