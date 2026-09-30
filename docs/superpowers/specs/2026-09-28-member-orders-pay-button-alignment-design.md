# Spec: Penyelarasan Tombol Bayar Member Orders (Mobile & Desktop)

## Latar Belakang & Masalah
Pada portal member bagian daftar pesanan (`Orders.svelte`), terjadi perbedaan alur aksi saat pengguna menekan tombol **"Bayar"**:
1. **Mode Desktop (`>= 768px`)**:
   - Menghubungkan langsung `href` ke `order.payment_url`.
   - `order.payment_url` dari controller (`memberController.ts`) secara dinamis mengarahkan ke endpoint generator QRIS (`/member/orders/:id/pay`) bila pesanan belum memiliki QR aktif, atau ke halaman invoice jika sudah tersedia.
   - Menggunakan atribut `target="_blank"` dan `rel="noopener noreferrer"`.
2. **Mode Mobile (`< 768px`)**:
   - Sebelumnya menggunakan ternary `href={order.invoice_token ? '#/invoice/' + order.invoice_token : order.payment_url}` tanpa `target="_blank"`.
   - Jika order memiliki `invoice_token` namun belum di-generate QR string-nya (pesanan pending baru), pengguna langsung dilempar ke halaman hash invoice yang kosong/belum ada QR, bukan memicu pembuatan tagihan QRIS GoQRIS.

## Perubahan Desain
1. **Orders.svelte (Mobile Card Toolbar)**:
   - Menyelaraskan atribut tautan tombol Bayar di mobile dengan desktop:
     ```svelte
     <a
         href={order.payment_url.startsWith('http') || order.payment_url.startsWith('/member/orders') ? order.payment_url : `/${order.payment_url.replace(/^\/?/, '')}`}
         target="_blank"
         rel="noopener noreferrer"
         class="h-8 px-3.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 active:bg-blue-700 shadow-xs inline-flex items-center gap-1.5 transition-all border-0 shadow-blue-500/20"
     >
         <span>Bayar</span>
         ...
     </a>
     ```
2. **AdminOAuthClients.svelte**:
   - Memberikan komentar pada deklarasi `import 'dart:convert';` dan `import 'package:http/http.dart' as http;` di dalam snippet panduan kode Flutter agar tidak memicu deteksi modul hilang pada bundler Vite saat development.
