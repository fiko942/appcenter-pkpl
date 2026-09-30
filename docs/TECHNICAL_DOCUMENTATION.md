# DOKUMENTASI TEKNIS MENDALAM SISTEM APPCENTER V2
## Deep-Dive Arsitektur, Backend, Frontend, Basis Data, Keamanan, & Seluruh Fitur Sistem

**Versi**: 2.0.0 (Production Release)  
**Target Branch**: `reborn`  
**Stack Utama**: Express 5 (TypeScript) + Prisma ORM 6 + MySQL 8 + Svelte 4 / Vite SPA + PNPM  
**Port Layanan**: `4829` (Single-Port Monorepo Architecture)  

---

---

## BAB 1: TEKNOLOGI, TECH STACK, & DEPENDENSI

### 1.1 Core Backend Tech Stack
- **Runtime & Bahasa**: Node.js (v20+ LTS recommended) + TypeScript 5.9.
- **Web Framework**: Express 5.1 (Single-Port Architecture on Port `4829`).
- **ORM & Basis Data**: Prisma ORM 6.19.3 terhubung ke MySQL 8.0 (`ziqva_labs`).
- **Sesi & Keamanan**: `express-session` + `express-mysql-session` + `helmet` + `cors` + `morgan` + `@dotenvx/dotenvx`.
- **Protokol Eksternal**: `ssh2-sftp-client` (SFTP Chunked Uploader), `axios` & native `fetch` (Xendit Invoices & YouTube RSS), `multer` (Upload multipart form-data).

### 1.2 Core Frontend Tech Stack
- **UI Framework**: Svelte 4.2.20 (Reaktif, Tanpa Virtual DOM Overhead).
- **Bundler & Build Tool**: Vite 6.4.1 + `@sveltejs/vite-plugin-svelte`.
- **Router**: `svelte-spa-router` (Hash-based Routing `#/member/...`, `#/admin/...`).
- **Styling & CSS**: Tailwind CSS 4.13 + Vendor Shadcn CSS + Custom CSS Variables Dual-Theme Engine (`appcenter-theme.css`).

### 1.3 Production Single Page Application (SPA) Serving Architecture
- **Express SPA Handler**: Seluruh rute GET tampilan halaman member dan admin (`/member/*`, `/admin/*`, `/`) dilayani langsung oleh Express dengan mengirimkan berkas `client_dist/index.html` (HTTP 200 OK) tanpa HTTP 302 Redirect.
- **Client-Side Path-to-Hash Converter**: Script inline pada `client/index.html` mendeteksi URL non-hash (seperti `https://appcenter.ziqva.com/member/orders?page=1...`) dan mensinkronkan fragment hash browser ke `/#/member/orders?page=1...` secara instan sebelum Svelte SPA di-mount.
- **Static Assets Middleware**: Static middleware `express.static(path.join(process.cwd(), 'client_dist'))` pada `src/app.ts` memastikan seluruh aset CSS & JS Vite ter-serve dengan HTTP status 200 OK.

### 1.4 Package Manager Invariant
- **Package Manager**: Strictly **PNPM (v11.23.0)** dengan `pnpm-workspace.yaml` monorepo (`client/` workspace).
- **Dilarang**: Menggunakan `npm` atau `yarn`.

---

## BAB 2: PANDUAN INSTALASI, SETUP ENV, & DEPLOYMENT RUNBOOK

### 2.1 Prasyarat Sistem
- Node.js >= 20.0.0
- PNPM >= 10.0.0 (`npm install -g pnpm`)
- MySQL >= 8.0 / MariaDB >= 10.5
- Akses SSH/SFTP ke remote server (untuk upload installer aplikasi)

### 2.2 Konfigurasi Environment (`.env`)
```env
# Server Port
PORT=4829
NODE_ENV=development

# MySQL Database (Connection Limit WAJIB 5)
DATABASE_URL="mysql://username:password@127.0.0.1:3306/ziqva_labs?connection_limit=5"

# Session Secret Key
SESSION_SECRET="ziqva-admin-secret-key-2026"

# Xendit Payment Gateway
XENDIT_SECRET_KEY="xnd_development_..."
XENDIT_WEBHOOK_TOKEN="ziqva_xendit_webhook_token_2026"
XENDIT_CALLBACK_URL="https://appcenter.ziqva.com/payment"
XENDIT_EXPIRY_HOURS=24
```

### 2.3 Langkah Instalasi & Kompilasi
```bash
# 1. Clone repositori & switch ke branch reborn
git checkout reborn

# 2. Instal seluruh dependensi monorepo
pnpm install

# 3. Generate Prisma Client ORM
pnpm prisma:generate

# 4. Buat cadangan skema database awal
pnpm run backupdb:scheme

# 5. Kompilasi build frontend Svelte & backend TypeScript
pnpm run build

# 6. Menjalankan server dalam mode development
pnpm run dev

# 7. Menjalankan server dalam mode production
pnpm start
```

### 2.4 Production Deployment Runbook (PM2 & Nginx)
- **Process Manager (PM2)**:
  ```bash
  pm2 start dist/src/server.js --name "appcenter-v2" --max-memory-restart 500M
  pm2 save
  ```
- **Nginx Reverse Proxy Config (`/etc/nginx/sites-available/appcenter`)**:
  ```nginx
  server {
      server_name appcenter.ziqva.com;
      client_max_body_size 500M;

      location / {
          proxy_pass http://127.0.0.1:4829;
          proxy_http_version 1.1;
          proxy_set_header Upgrade $http_upgrade;
          proxy_set_header Connection 'upgrade';
          proxy_set_header Host $host;
          proxy_cache_bypass $http_upgrade;
          proxy_set_header X-Real-IP $remote_addr;
          proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
          proxy_set_header X-Forwarded-Proto $scheme;
      }
  }
  ```

---

## BAB 3: BEDAH TEKNIS GRANULAR PER FITUR SISTEM (22 SUBSISTEM)

### Fitur 1: Otentikasi & Keamanan Login Administrator
- **Berkas Terkait**:
  - Backend Controller: `src/controllers/adminController.ts` (`showLogin`, `processLogin`, `apiGetLoginStatus`, `apiGetSession`, `logout`).
  - Rate Limiter Service: `src/services/adminRateLimiter.ts`.
  - Frontend SPA View: `client/src/lib/pages/AdminLogin.svelte`.
  - Auth Middleware: `src/middlewares/adminAuth.ts`.
- **Mekanisme & Logika Kerja**:
  1. Otentikasi Admin tidak menggunakan password teks panjang biasa, melainkan **PIN Keamanan 6-Digit** (Default dev: `085213`) yang disimpan pada kolom `pin` tabel `admin`.
  2. **IP-Based Escalating Rate Limiting**:
     - Dikelola oleh `AdminRateLimiter` (`src/services/adminRateLimiter.ts`).
     - Maksimal 3 kali percobaan salah per IP.
     - Tingkat penguncian (Lockout Escalation):
       - Level 1: Penguncian selama **3 Menit** (180 detik).
       - Level 2: Penguncian selama **5 Menit** (300 detik).
       - Level 3: Penguncian selama **10 Menit** (600 detik).
       - Level 4+: Penguncian selama **15 Menit** (900 detik).
     - Frontend meminta status kuota percobaan via `GET /admin/api/login-status` untuk merender countdown timer secara real-time.
  3. **Manajemen Sesi**:
     - Sesi disimpan ke dalam tabel MySQL `app_admin_session` melalui `express-mysql-session`.
     - Parameter sesi: `req.session.adminId = admin.id`, `req.session.adminName = admin.username`, `req.session.isAuthenticated = true`.
     - Cookie berdurasi 3 hari dengan flag `httpOnly: true`.

---

### Fitur 2: Otentikasi & Registrasi Member
- **Berkas Terkait**:
  - Backend Controller: `src/controllers/memberController.ts` (`showLogin`, `processLogin`, `showRegister`, `processRegister`, `logout`).
  - Frontend Views: `client/src/lib/pages/Login.svelte`, `client/src/lib/pages/Register.svelte`.
  - Auth Store: `client/src/lib/stores/auth.ts`.
- **Mekanisme & Logika Kerja**:
  1. **Registrasi Akun Baru**:
     - Menerima payload: `name`, `email`, `password`, `confirm_password`, `company`, `whatsapp`.
     - Validasi keunikan email pada tabel `user`.
     - Auto-verifikasi: Record dibuat dengan status `verified: true`, `banned: false`, `avatar` otomatis di-generate via UI-Avatars API (`https://ui-avatars.com/api/?name=...`).
  2. **Immutable User Email Invariant**:
     - Email member terkunci permanen pasca pendaftaran. Tidak ada endpoint update email pada member maupun admin untuk menjamin integritas relasi lisensi, order, dan audit transaksi.
  3. **Login Member**:
     - Pencarian data di tabel `user` berdasarkan email.
     - Validasi status akun: jika `!user.verified` mengembalikan error 403; jika `user.banned` mengembalikan error 403.
     - Sesi diikat pada `labs_membership_session` dan memori sesi Express (`session.isMemberAuthenticated = true`).

---

### Fitur 3: Dashboard Member & Dynamic Categories
- **Berkas Terkait**:
  - Backend: `src/controllers/memberController.ts` (`apiGetDashboard`).
  - Frontend: `client/src/lib/pages/Dashboard.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **3D Centerpiece Hero**:
     - Menampilkan visual centerpiece kubus 3D (`.cube`) dengan platter kontras tinggi (`.cube-inner-platter`), ambient glow, dan animasi melayang (`heroFloat` keyframes).
     - Merender logo vektor resmi SVG website (`/favicon.svg`).
  2. **Dynamic Categories Integration**:
     - Mengambil data dari `prisma.categories.findMany({ where: { is_active: true } })`.
     - Menghitung jumlah produk aktif per kategori menggunakan $O(1)$ Hash Map indexing di backend (`productCountsMap`).
     - Menyediakan tombol filter interaktif di frontend: klik pada chip kategori otomatis memfilter katalog software di bawahnya tanpa reload halaman.
  3. **Section Tools Gratis Dinamis (`#free`)**:
     - Memfilter secara reaktif produk dari payload yang memiliki nilai `price === 0`.
     - Menampilkan kartu produk gratis dengan tombol aksi instan `"Klaim Gratis"`.

---

### Fitur 4: Pesanan Saya / Member Orders
- **Berkas Terkait**:
  - Backend: `src/controllers/memberController.ts` (`apiGetOrders`, `apiGetOrderLicenses`).
  - Frontend: `client/src/lib/pages/Orders.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Server-Side Driven Pagination & Search**:
     - Endpoint `GET /member/api/orders` menerima parameter: `page`, `pageSize` (default 10), `search`, `sort`, `order`.
     - Query Prisma mencari kecocokan pada nama produk di dalam JSON `items`, `payment`, `status`, atau `note`.
  2. **Modal Aksi Terpadu**:
     - **Modal Unduh Installer**: Menampilkan opsi installer multi-OS (Windows `.exe` dan macOS `.dmg`) yang di-parse dari kolom `products.installer_files`.
     - **Modal Detail Lisensi**: Memanggil `GET /member/api/orders/:orderId/licenses` untuk mengambil token serial key yang terikat pada order tersebut beserta status binding HWID.
  3. **Formatting & Sanitasi**:
     - Pesanan gratis diformat sebagai `GRATIS (Rp 0)`.
     - Tombol clear search (`✕`), keyboard navigation `Escape`, dan memory cleanup timer di hook `onDestroy`.

---

### Fitur 5: Lisensi Aplikasi & HWID Machine Binding
- **Berkas Terkait**:
  - Backend: `src/controllers/memberController.ts` (`apiGetLicenses`).
  - Frontend: `client/src/lib/pages/Licenses.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Tabel Lisensi Berbasis Urutan Dinamis ('No')**:
     - Kolom nomor urut dihitung secara matematis `(pagination.page - 1) * pagination.pageSize + idx + 1`.
  2. **Resolusi Entitas Lisensi $O(1)$**:
     - Mengambil data dari `token_device_activation` yang dimiliki email pengguna.
     - Melakukan indexing produk (`productByName`, `productByProductId`) dan perangkat (`deviceByKey`, `deviceByOrderId`) dalam single-pass Map untuk menyajikan data lisensi instan tanpa nested query berulang.
  3. **Visualisasi Status Perangkat**:
     - Serial Key disajikan dengan fitur 1-klik copy ke clipboard dengan toast feedback.
     - HWID Machine ID: Menampilkan badge `Terkunci: [MachineID]` (hijau) atau `Belum Diaktivasi` (amber).
     - Masa Aktif: Menghitung selisih epoch expired vs timestamp saat ini dalam format Hari/Jam/Menit.

---

### Fitur 6: Pusat Unduhan / Member & Public Downloads Hub
- **Berkas Terkait**:
  - Backend Service: `src/services/downloadService.ts`.
  - Public Controller: `src/controllers/publicController.ts`.
  - Member Controller: `src/controllers/memberController.ts` (`apiGetDownloads`).
  - Frontend: `client/src/lib/pages/Downloads.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Apache Autoindex HTML Parsing**:
     - `DownloadService` melakukan request HTTP GET ke server unduhan `http://download.ziqva.com` dengan timeout 5 detik.
     - Melakukan parsing regex pada output indeks HTML untuk mengekstrak nama file, tanggal rilis, ukuran berkas (`formatSize`), dan tipe file (`.exe`, `.dmg`, `.zip`, `.rar`).
  2. **Pengayaan Data Produk**:
     - Backend mencocokkan nama berkas unduhan dengan katalog produk aktif di MySQL untuk menyematkan deskripsi, ikon cover, dan link tutorial terkait.

---

### Fitur 7: Tutorial Video Learning Hub & RSS Auto-Expansion
- **Berkas Terkait**:
  - Backend Utility: `src/utils/youtube.ts`.
  - Member Controller: `src/controllers/memberController.ts` (`apiGetTutorials`, `apiGetProductTutorial`).
  - Frontend: `client/src/lib/pages/Tutorials.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Normalisasi Embed YouTube & Privacy-Enhanced**:
     - `parseYouTubeEmbedUrl()` mendeteksi URL YouTube reguler, shorts, playlist, shortened (`youtu.be`), maupun embed langsung, lalu mengubahnya secara otomatis ke domain `https://www.youtube-nocookie.com/embed/...`.
  2. **Auto-Expansion Playlist via YouTube RSS Feed**:
     - `fetchYouTubePlaylistVideos(playlistId)` mengambil feed XML `https://www.youtube.com/feeds/videos.xml?playlist_id=...` dengan timeout 8 detik dan soket destruction otomatis.
     - Memecah playlist menjadi daftar video individual lengkap dengan judul video asli tanpa memerlukan API Key Google Cloud berbayar.
  3. **Cinema Modal Player**:
     - Frontend menyediakan modal bioskop video dengan rasio 16:9, responsive iframe, dan daftar playlist di sidebar modal.

---

### Fitur 8: Detail Produk, Checkout Xendit, & Klaim Gratis Rp 0
- **Berkas Terkait**:
  - Backend: `src/controllers/memberController.ts` (`processCreateOrder`, `payOrder`, `apiCheckVoucher`).
  - Payment Service: `src/services/xenditService.ts`.
  - Frontend: `client/src/lib/pages/ProductDetail.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Validasi Kupon Diskon**:
     - Memeriksa keabsahan kupon di `affiliate_member` via `POST /member/api/check-voucher`.
     - Menghitung potongan harga `kupon_decrease_value` secara transparan.
  2. **Logika Jalur Pembayaran Ganda**:
     - **Jalur A (Produk Berbayar / Price > 0)**:
       - Membuat record `order_list` berstatus `Order awaiting payment`.
       - Memanggil `xenditService.createInvoice()` untuk membuat invoice pembayaran Xendit.
       - Menyimpan `payment_request_id` dan `payment_url` di order, lalu mengarahkan pembeli ke URL pembayaran resmi.
     - **Jalur B (Produk Gratis / Price === 0)**:
       - Melewati gateway Xendit secara total.
       - Membuat record `order_list` langsung dengan `status = 'Order has been complete'`, `payment = 'PAID'`, dan `paid_at = now`.
       - Menerbitkan token serial key seketika di `token_device_activation`.
       - Mengarahkan member langsung ke `/#/member/licenses`.

---

### Fitur 9: Profil Pengguna & Keamanan Member
- **Berkas Terkait**:
  - Backend: `src/controllers/memberController.ts` (`apiGetProfile`, `apiUpdateProfile`, `apiChangePassword`).
  - Frontend: `client/src/lib/pages/Profile.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Pembaruan Profil Identitas**:
     - Member dapat memperbarui Nama Lengkap, Nomor WhatsApp, dan Nama Perusahaan.
     - Email ditampilkan dalam kondisi disabled dan terkunci permanen.
  2. **Ubah Kata Sandi**:
     - Memeriksa kata sandi lama, memvalidasi konfirmasi kata sandi baru (minimal 6 karakter), dan memperbarui record pengguna di database.

---

### Fitur 10: Program Kemitraan Afiliasi Member
- **Berkas Terkait**:
  - Backend: `src/controllers/memberController.ts` (`showAffiliate`, `processJoinAffiliate`, `updateAffiliateProfile`, `updateAffiliateCoupon`).
  - Frontend Views: `src/views/member-affiliate.ts`, `src/views/member-payout-history.ts`.
- **Mekanisme & Logika Kerja**:
  1. **Pendaftaran Program Afiliasi**:
     - Pengguna mendaftar dengan membuat kode kupon unik (`kupon`).
     - Menyimpan data rekening penarikan dana (`payout_bank_name`, `payout_no_rek`, `payout_name`).
  2. **Pelacakan Komisi**:
     - Sistem mencatat transaksi yang menggunakan kupon affiliator ke tabel `affiliate_transaksi`.
     - Menghitung total pendapatan komisi yang belum dicairkan (`already_paid = 0`) dan yang sudah dicairkan (`already_paid = 1`).

---

### Fitur 11: Admin Dashboard & Global Analytics Engine
- **Berkas Terkait**:
  - Backend: `src/controllers/adminController.ts` (`apiGetDashboard`, `apiGetPaymentDetail`).
  - Frontend: `client/src/lib/pages/AdminDashboard.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Agregasi Metrik Finansial & Operasional**:
     - Menghitung Total Omset Masuk, Omset Bulan Ini, Total Pesanan Sukses, Total Lisensi Aktif, dan Total Pengguna Terdaftar dalam eksekusi paralel `Promise.all`.
  2. **Tabel Transaksi Terbaru & Modal Rincian**:
     - Menampilkan 10 transaksi terakhir dengan badge status pembayaran (`PAID`, `FREE CLAIM`, `PENDING`).
     - Menyediakan modal detail pembayaran interaktif yang disinkronkan ke `/admin/api/payments/detail/:id`.
  3. **Diagnostik Server**:
     - Menampilkan uptime Node.js, RSS Memory Heap, dan batas pool database aktif.

---

### Fitur 12: Manajemen Pengguna / Admin User Management
- **Berkas Terkait**:
  - Backend: `src/controllers/adminController.ts` (`apiGetUsers`, `apiGetUserDetail`, `apiToggleUserBan`, `apiToggleUserVerified`, `apiResetUserPassword`, `apiUpdateUser`).
  - Frontend: `client/src/lib/pages/AdminUsers.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Server-Side Filtering & Sorting**:
     - Menerapkan filter tab: `Semua`, `Terverifikasi`, `Belum Verifikasi`, `Diblokir`, `Mitra Afiliasi`.
     - Live search debounced 300ms mencari Nama, Email, WhatsApp, atau Perusahaan.
  2. **Aksi Kontrol Administrator**:
     - **Banned / Unban**: Mengubah status `banned` secara instan, memutus akses login member seketika.
     - **Toggle Verified**: Mengubah status verifikasi akun.
     - **Reset Password**: Mengatur ulang kata sandi pengguna langsung dari admin.
     - **Modal Detail Pengguna**: Menampilkan relasi lisensi software yang dimiliki pengguna dan riwayat pesanannya.

---

### Fitur 13: Manajemen Transaksi / Admin Payments Control
- **Berkas Terkait**:
  - Backend: `src/controllers/adminController.ts` (`apiGetPayments`, `apiGetPaymentDetail`, `confirmPaymentManually`, `updateOrderDuration`).
  - Frontend: `client/src/lib/pages/AdminPayments.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Server-Side Transaction Ledger**:
     - Mendukung filter tab status: `Semua`, `Lunas (PAID)`, `Menunggu Pembayaran`, `Gratis (FREE CLAIM)`.
  2. **Konfirmasi Manual Pembayaran (`confirmPaymentManually`)**:
     - Admin dapat menyetujui transaksi secara manual jika pembayaran dilakukan melalui transfer langsung luar gateway.
     - Menerbitkan token serial key dan mencatat komisi afiliasi secara otomatis.
  3. **Sinkronisasi Durasi Lisensi (`updateOrderDuration`)**:
     - Saat admin mengubah durasi order, sistem secara otomatis memperbarui masa aktif `expired` dan `duration` pada tabel `device` terkait agar perangkat klien tetap sinkron.

---

### Fitur 14: Generator Lisensi Uji Coba / Admin Create Trial
- **Berkas Terkait**:
  - Backend: `src/controllers/adminController.ts` (`apiGetTrialProducts`, `processCreateTrial`, `processDeleteTrial`).
  - Frontend: `client/src/lib/pages/AdminCreateTrial.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Generator Multi-Durasi Fleksibel**:
     - Mendukung durasi preset cepat: `15 Menit`, `1 Jam`, `1 Hari`, `3 Hari`, `7 Hari`, `14 Hari`, `1 Bulan`, `3 Bulan`, `6 Bulan`, `1 Tahun`.
     - Mendukung input durasi kustom (Menit, Jam, Hari, Bulan, Tahun).
  2. **Siklus Token Trial**:
     - Token di-generate dengan format acak unik 16-karakter dan disimpan di tabel `trial` dengan nilai `user = 'WAITING_ACTIVATION'` dan `machine_id = ''`.
     - Saat token diaktifkan di PC klien melalui `/device/activation`, `machine_id` diikat ke HWID mesin tersebut dan status berubah menjadi aktif. Token trial tidak dapat digunakan di PC lain.
  3. **Template WhatsApp Siap Kirim**:
     - Menyediakan template pesan chat ramah & formal lengkap dengan estimasi expired WIB, instruksi 1-2-3 aktivasi, dan klausul single-device lock.

---

### Fitur 15: Katalog Produk & Multi-Chunk SFTP Uploader
- **Berkas Terkait**:
  - Backend: `src/controllers/adminController.ts` (`apiGetProducts`, `processCreateProduct`, `processEditProduct`, `processDeleteProduct`, `processToggleProductStatus`, `uploadProductInstallerChunk`, `deleteProductInstaller`, `uploadProductImage`).
  - SFTP Service: `src/services/sftpService.ts`.
  - Frontend: `client/src/lib/pages/AdminProducts.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Dukungan Produk Gratis Rp 0 & Diskon**:
     - Form mendukung harga `0` dengan badge visual `GRATIS (Rp 0)` dan diskon persentase.
  2. **Engine Upload SFTP Multi-Chunk 5MB**:
     - Berkas installer diunggah dalam potongan 5MB ke folder temporary `os.tmpdir()/installer_chunks/[uploadId]`.
     - Penggabungan potongan menggunakan stream pipe berurutan dengan backpressure drain (`fs.createReadStream` + `pipe` + `writeStream`).
     - Berkas akhir ditransfer ke server remote `127.0.0.1:22` di `/var/www/html/setup-windows-bin/x86` menggunakan SFTP `fastPut`.
     - Metadata berkas disimpan dalam format JSON `installer_files` (`windows: []`, `mac: []`).
     - Folder temporary orphan otomatis dibersihkan.

---

### Fitur 16: Kategori Produk & Deep-Linking Filter
- **Berkas Terkait**:
  - Backend: `src/controllers/adminController.ts` (`apiGetCategories`, `processCreateCategory`, `processEditCategory`, `processDeleteCategory`, `processToggleCategoryStatus`, `uploadCategoryIcon`).
  - Frontend: `client/src/lib/pages/AdminCategories.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **CRUD Kategori & Upload Icon**:
     - Pengelolaan nama, slug unik, deskripsi, icon gambar kustom, dan toggle status aktif/nonaktif.
  2. **Deep-Linking Navigasi**:
     - Klik pada badge jumlah produk di tabel kategori memicu navigasi langsung ke `#/admin/products?category_id=[id]`, yang secara otomatis memfilter katalog produk di halaman tujuan.

---

### Fitur 17: Manajemen Afiliasi & Payout / Admin Affiliate
- **Berkas Terkait**:
  - Backend: `src/controllers/adminController.ts` (`apiGetAffiliate`, `markAffiliateAsPaid`).
  - Frontend: `client/src/lib/pages/AdminAffiliate.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Server-Side Driven $O(1)$ Hash Map Aggregation**:
     - Mengagregasi saldo komisi belum dibayar (`pending_payout`) dan total komisi historis menggunakan single-pass hash indexing `Map<affiliator_email, summary>`.
  2. **Filter Rekening Bank & Eksekusi Payout**:
     - Dropdown filter bank tujuan transfer (BCA, Mandiri, BRI, BNI, Dana, GoPay, OVO, SeaBank, Jago, dll.).
     - Tombol aksi `Tandai Ditransfer`: Membuka modal konfirmasi transfer, memvalidasi nominal, dan mengeksekusi pencatatan `affiliate_payouts` serta menyetel `already_paid = 1` pada transaksi terkait.

---

### Fitur 18: Riwayat Pencairan Komisi / Admin Affiliate History
- **Berkas Terkait**:
  - Backend: `src/controllers/adminController.ts` (`apiGetAffiliateHistory`).
  - Frontend: `client/src/lib/pages/AdminAffiliateHistory.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Audit Payout & Logo Bank Resmi**:
     - Menampilkan tabel riwayat transfer komisi dengan logo vektor SVG resmi per institusi bank / e-wallet.
     - Live search debounced 300ms mencari email affiliator, nama penerima, atau catatan transfer operator.

---

### Fitur 19: Profil Admin & Super Admin Multi-Account
- **Berkas Terkait**:
  - Backend: `src/controllers/adminController.ts` (`apiGetProfile`, `apiUpdatePin`, `apiUpdateUsername`, `apiGetAdmins`, `apiCreateAdmin`, `apiDeleteAdmin`, `apiResetAdminPin`).
  - Frontend: `client/src/lib/pages/AdminProfile.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Manajemen Akun Administrator Jamak**:
     - Super Admin dapat membuat akun administrator baru dengan PIN awal.
     - Mengubah username tampilan dan memperbarui PIN 6-digit keamanan mandiri dengan verifikasi PIN lama.
     - Reset PIN darurat untuk admin sekunder.

---

### Fitur 20: Pencadangan Database Raw SQL & Audit Log
- **Berkas Terkait**:
  - Backend Service: `src/services/backupService.ts`.
  - Backend Controller: `src/controllers/adminController.ts` (`apiGetBackups`, `apiCreateBackup`, `apiGetBackupStatus`, `apiDownloadBackup`, `apiDeleteBackup`).
  - Frontend: `client/src/lib/pages/AdminSettings.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Asynchronous Background Streaming**:
     - Proses backup dijalankan di latar belakang tanpa memblokir request HTTP lainnya.
     - Menyimpan progress real-time (0% s/d 100%) dan deskripsi langkah (`current_step`) di tabel `database_backups` untuk di-polling oleh frontend.
  2. **Format Raw SQL Murni Anti-Korupsi**:
     - Berkas diekspor dalam format `.sql` uncompressed (tanpa gzip) untuk menjamin kompatibilitas restorasi dan mencegah file corrupt.
     - Menghitung checksum SHA-256 saat streaming selesai untuk verifikasi integritas berkas.
  3. **Audit Logger Pengunduhan**:
     - Setiap kali berkas backup diunduh via `GET /admin/api/settings/backup/download/:id`, sistem mencatat timestamp, username admin, IP address, dan string User-Agent browser ke dalam kolom JSON `download_history`.

---

### Fitur 21: Protokol API Desktop Client & HWID Locking
- **Berkas Terkait**:
  - Backend Controller: `src/controllers/deviceController.ts` (`checkDeviceStatus`, `activateLicense`).
  - Route: `src/routes/deviceRoutes.ts`.
- **Mekanisme & Logika Kerja**:
  1. **Endpoint Status Perangkat (`POST /device/status`)**:
     - Menerima query parameter: `product` dan `machine_id` (HWID mesin desktop).
     - Memeriksa keaktifan di tabel `device` (pengguna berbayar) dan tabel `trial` (pengguna trial) terhadap timestamp saat ini `now < expired`.
     - Mengembalikan payload respons status registrasi, identitas lisensi, sisa hari/jam aktif, dan label lisensi.
  2. **Endpoint Aktivasi Lisensi (`POST /device/activation`)**:
     - Menerima query parameter: `token`, `product`, `machine_id`.
     - **Skenario Lisensi Resmi (`token_device_activation`)**:
       - Jika device belum ada: Membuat record baru di `device` dengan `expired = now + duration*60` dan mengikat `machine_id`.
       - Jika device sudah ada (migrasi PC): Memperbarui `machine_id` pada record `device` yang ada ke HWID baru (Self-Service License Transfer).
     - **Skenario Lisensi Trial (`trial`)**:
       - Memeriksa apakah trial sudah pernah diaktifkan (`trial.machine_id !== ''`). Jika sudah, penolakan aktivasi ganda diterapkan (*"Kode trial tidak bisa diaktifkan 2x"*).
       - Mengikat `machine_id` pertama kali dan mengunci masa aktif.

---

### Fitur 22: Frontend Svelte 4 Design System & UI Tokens
- **Berkas Terkait**:
  - CSS Master: `public/css/appcenter-theme.css`.
  - Komponen Kustom: `client/src/lib/components/CustomSelect.svelte`, `CustomCheckbox.svelte`, `CustomDropdown.svelte`, `SegmentedTabs.svelte`, `ThemeToggle.svelte`, `Tooltip.svelte`.
  - Layout Wrapper: `client/src/lib/components/Layout.svelte`, `client/src/lib/components/AdminLayout.svelte`.
- **Mekanisme & Logika Kerja**:
  1. **Dual-Theme Design Tokens**:
     - Beroperasi dengan CSS Variables (`--bg`, `--surface`, `--surface-2`, `--border`, `--brand`, `--text`, `--text-2`, `--text-3`) yang otomatis berganti saat atribut `data-theme="dark"` atau `data-theme="light"` dipasang pada `<html>`.
  2. **Motion Engine (Sliding Pills & Active Dots)**:
     - Backdrop pil bergerak mulus mengikuti elemen yang di-hover atau aktif dengan kurva transisi `cubic-bezier(0.16, 1, 0.3, 1)`.
     - Titik status bergerak sinkron di dalam container pil.
  3. **Zero Native HTML Elements**:
     - Bebas dari elemen native `<select>` atau checkbox browser polos, menjamin keseragaman visual 100% di semua browser (Chrome, Safari, Firefox, Edge).

---

### Fitur 23: Public Landing Page Anti-AI-Slop Architecture & Apple TV-Class Frosted Glass Engine
- **Berkas Terkait**:
  - Main Landing View: `client/src/lib/pages/LandingPage.svelte`.
  - Design Tokens & Royal Blue Realignment: `client/index.html` (`--brand: #2563eb`).
- **Mekanisme & Logika Kerja**:
  1. **Apple TV-Class Frosted Glass Navbar Bar**:
     - Menggunakan `backdrop-blur-2xl bg-[#0a0f1d]/80 dark:bg-[#060b18]/85 border-b border-white/10 dark:border-blue-500/15 shadow-xl shadow-black/10` untuk menyajikan bar navigasi *translucent glass* khas Apple TV.
     - Menghadirkan *hover underline indicator* interaktif (`h-0.5 bg-blue-500 group-hover:w-full transition-all duration-200`) pada link navigasi desktop.
     - Tombol pendaftaran/portal menggunakan *Apple Rounded Pill* (`px-6 py-2.5 rounded-full font-bold text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30 hover:scale-105 active:scale-95`).
  2. **Zero AI-Slop & 100% SVG Vector Invariant**:
     - Mengeliminasi total animasi pinging dot generik (`animate-ping`) dan seluruh karakter emoji. Seluruh indikator diganti dengan ikon SVG vektor presisi.
  3. **Pro Hero Section & Double-Layered 3D Platter**:
     - Tombol CTA utama menggunakan *glossy top edge* (`border-t border-white/25`) dan *deep aura shadow* (`shadow-xl shadow-blue-600/35`).
     - 3 Micro metric widgets (`Pengguna Aktif`, `Software & Bot`, `Lisensi Resmi`) menggunakan panel *TV-Class Frosted Glass* (`bg-[#0e172e]/60 dark:bg-[#0a1226]/80 border border-white/15`) dengan container ikon SVG terisolasi (`w-11 h-11 rounded-xl bg-blue-500/15`).
     - Platter pusat 3D dikelilingi kartu satelit floating `Tools Gratis` (`top-3 -left-2`) dan `HWID Lock` (`bottom-3 -right-2`) dengan material kaca cair ganda berkedalaman 3D tinggi.
  4. **Framer Motion & Svelte Transition Choreography**:
     - Choreography transisi masukan (`in:fly={{ y: 25, duration: 500, delay: 200, easing: cubicOut }}`) pada headline, copy, dan FAQ accordion.

---

## BAB 4: RANGKAIAN PENGUJIAN & TESTING SUITE LENGKAP

### 4.1 Arsitektur Testing Suite (`scripts/e2e-simulation-test.ts`)
- **Perintah CLI**:
  - `pnpm run test:simulation`
  - `pnpm run test:e2e`
- **Tujuan**: Menguji integritas fungsional 100% dari backend, otentikasi sesi, relasi basis data, validasi skenario positif dan skenario penolakan (negatif/error injection), serta memastikan data produksi aman.

### 4.2 Auto-Booting Embedded Server
- Test runner memeriksa apakah server pada `http://localhost:4829` sedang aktif.
- Jika server offline, runner secara otomatis melakukan bootstrap instance embedded Express dari `src/app.ts` pada port bebas, menjalankan seluruh pengujian, dan mematikan server secara graceful setelah pengujian selesai.

### 4.3 Matriks 15 Skenario Uji Komprehensif (Positif & Negatif)

| No | Skenario Uji | Tipe Pengujian | Penjelasan & Asersi Validasi |
| :--- | :--- | :--- | :--- |
| 1 | **Server Health & Diagnostics** | Positif | Memeriksa endpoint `/health`, memvalidasi status 200 OK, dan mengecek uptime server. |
| 2 | **Member Registration & Negative Duplicate Check** | Positif & Negatif | Mendaftarkan akun user uji baru. Menguji skenario negatif: mencoba mendaftarkan email yang sama dan memvalidasi penolakan error 400. |
| 3 | **Member Login & Negative Password Check** | Positif & Negatif | Menguji login dengan password salah (harus 401). Menguji login dengan kredensial benar dan memvalidasi penyimpanan session cookie. |
| 4 | **Session Persistence & Route Protection** | Positif & Negatif | Mengakses endpoint terproteksi `/member/api/session` tanpa cookie (harus `authenticated: false` / 401). Mengakses dengan cookie sesi (harus `authenticated: true`). |
| 5 | **Catalog & Category Filter** | Positif | Mengambil data `/member/api/products` dan `/member/api/dashboard`, memvalidasi pengayaan kategori dinamis dan struktur data. |
| 6 | **Order Creation & Duration Validation** | Positif & Negatif | Menguji skenario negatif: mengirim durasi tidak valid (harus 400). Menguji pembuatan pesanan normal dan verifikasi record di `order_list`. |
| 7 | **Instant Free Claim Rp 0 Order** | Positif | Menguji klaim produk Rp 0, memvalidasi bypass gateway Xendit, status langsung `Order has been complete`, dan `paid_at: now`. |
| 8 | **License Token Generation** | Positif | Memeriksa tabel `token_device_activation`, memastikan token serial key unik terbit sesuai pesanan. |
| 9 | **Device API `/device/status` Validation** | Positif & Negatif | Menguji parameter query kosong (harus 400). Menguji query parameter valid dan memvalidasi payload status keaktifan mesin. |
| 10| **Device API `/device/activation` & HWID Lock** | Positif | Mengaktifkan token pada mesin desktop uji (HWID A), memvalidasi pengikatan ke tabel `device`. Menguji transfer lisensi mandiri ke HWID B. |
| 11| **Negative Activation: Fake/Expired Token** | Negatif | Menguji aktivasi menggunakan token acak palsu (harus `error: true, message: 'License/Trial invalid or not found'`). |
| 12| **Tutorials RSS & Downloads File Integrity** | Positif | Memvalidasi endpoint `/member/api/tutorials` (ekspansi playlist YouTube RSS) dan `/member/api/downloads` (daftar berkas installer). |
| 13| **Admin PIN Auth & Negative Lockout Check** | Positif & Negatif | Menguji login admin dengan PIN salah (harus 401/400). Menguji login dengan PIN default `085213` dan memvalidasi sesi admin. |
| 14| **Admin Analytics & User Search Control** | Positif | Mengakses metrik dashboard admin, mencari user uji di `/admin/api/users`, memvalidasi pagination dan filtering. |
| 15| **Database Backup Engine & Data Cleanup** | Positif | Memvalidasi endpoint `/admin/api/settings/backups` dan eksekusi pembersihan data uji secara tuntas. |

### 4.4 Isolasi Data Produksi (100% Safe Database Purge Invariant)
- Seluruh ID entitas yang dibuat selama pengujian dicatat ke dalam variabel pelacak: `createdUserId`, `createdOrderId`, `createdTokenId`, `createdDeviceId`, `createdTrialId`.
- Di dalam blok `finally` (yang dieksekusi baik tes berhasil maupun gagal), runner mengeksekusi:
  ```typescript
  await prisma.device.deleteMany({ where: { id: { in: createdDeviceIds } } });
  await prisma.token_device_activation.deleteMany({ where: { id: { in: createdTokenIds } } });
  await prisma.order_list.deleteMany({ where: { id: { in: createdOrderIds } } });
  await prisma.trial.deleteMany({ where: { id: { in: createdTrialIds } } });
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  ```
- **Database produksi 100% aman** karena hanya record dengan ID uji spesifik yang dihapus.

### 4.5 Zero Storage Footprint & Temporary Artifact Purge Invariant
- Fungsi otomatis `purgeTemporaryStorage()` dijalankan di akhir proses pengujian untuk menghapus tuntas:
  - Direktori profil Chrome temporary (`$TMPDIR/puppeteer_*`, `$TMPDIR/chrome-test-profile-*`, `$TMPDIR/temp_chrome_*`).
  - Direktori chunk temporary (`os.tmpdir()/installer_chunks`).
  - Screenshots pengujian dan memory dump.
- Menjamin tidak ada sisa file yang membebani kapasitas disk lokal.

### 4.6 Aturan Eksekusi Test (Section 5 GEMINI.md)
- Test suite simulasi `pnpm run test:simulation` **HANYA DIJALANKAN PADA 2 KONDISI**:
  1. Perubahan **Fitur Besar** (major architectural / core feature updates).
  2. Sesaat sebelum **Preservasi Memori / SAVE v5 Protocol**.
- Dilarang menjalankan test suite pada perubahan kecil (minor UI tweaks, text typos, formatting, simple CSS).

---

## BAB 5: SUBSISTEM ZIQVA OAUTH 2.0 & SINGLE SIGN-ON (SSO) IDENTITY PROVIDER

### 5.1 Latar Belakang & Filosofi Arsitektur
Layanan **Ziqva OAuth 2.0 & SSO** bertindak sebagai penyedia identitas terpusat (*Centralized Identity Provider / IdP*) bagi seluruh ekosistem aplikasi Ziqva (web, desktop Electron, mobile Flutter, CLI, maupun microservice internal), dengan arsitektur modern berstandar industri menyerupai *Google Sign-In (`accounts.google.com`)*.

Pengguna cukup memiliki 1 akun Ziqva terdaftar di AppCenter (`appcenter.ziqva.com`) untuk mengakses seluruh aplikasi ekosistem tanpa perlu registrasi ulang di setiap platform.

### 5.2 Skema Basis Data Prisma (5 Model Opaque Token)
Otentikasi OAuth 2.0 Ziqva menggunakan sistem *Opaque Database Tokens* yang tersimpan di MySQL 8 (`ziqva_labs`) untuk menjamin pencabutan token seketika (*instant revocation*) dan sinkronisasi realtime dengan status user:

1. **`oauth_clients`**: Menyimpan registrasi aplikasi klien (Confidential & Public PKCE).
   - Kolom: `id`, `client_id` (unique `zqv_client_...`), `client_secret_hash` (bcrypt), `name`, `description`, `icon_url`, `allowed_redirect_uris` (JSON array), `allowed_origins` (JSON array), `allowed_scopes`, `is_trusted` (bypass consent), `is_active`, `created_by`, `created_at`, `updated_at`.
2. **`oauth_auth_codes`**: Kode otorisasi sementara (TTL 10 menit, single-use).
   - Kolom: `id`, `code` (unique `zqv_code_...`), `client_id`, `user_id`, `redirect_uri`, `scope`, `code_challenge`, `code_challenge_method`, `is_used`, `expires_at`, `created_at`.
3. **`oauth_access_tokens`**: Bearer token akses resource API (TTL 30 hari).
   - Kolom: `id`, `token` (unique `zqv_at_...`), `client_id`, `user_id`, `scope`, `revoked`, `expires_at`, `created_at`.
4. **`oauth_refresh_tokens`**: Token perpanjangan akses dengan rotasi otomatis (TTL 90 hari).
   - Kolom: `id`, `refresh_token` (unique `zqv_rt_...`), `access_token_id`, `client_id`, `user_id`, `scope`, `revoked`, `expires_at`, `created_at`.
5. **`oauth_user_consents`**: Rekaman persetujuan scope pengguna terhadap aplikasi tertentu agar tidak meminta ulang jika scope belum berubah.
   - Kolom: `id`, `user_id`, `client_id`, `granted_scopes`, `created_at`, `updated_at`.

### 5.3 Matriks Endpoint & Protokol OAuth 2.0

| Endpoint | Method | Deskripsi | Format Header / Body |
| :--- | :--- | :--- | :--- |
| `/oauth/authorize` | `GET` | Memulai alur otorisasi browser. Menampilkan dialog login & consent dedicated. | Query: `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, `code_challenge`, `code_challenge_method` |
| `/oauth/api/auth-context` | `GET` | Mengambil metadata klien & status sesi user aktif untuk render UI consent. | Credentials: `include` (Session Cookie) |
| `/oauth/api/login` | `POST` | Otentikasi langsung di dalam modal SSO tanpa redirect halaman. | JSON: `{ "email", "password", "client_id", "redirect_uri" }` |
| `/oauth/api/logout-current` | `POST` | Logout sesi aktif saat ini agar user dapat berganti akun di dalam modal SSO. | Credentials: `include` |
| `/oauth/consent/decision` | `POST` | Menangani aksi persetujuan (*allow*) atau penolakan (*deny*) user. | JSON: `{ "client_id", "redirect_uri", "allow", "scope", "state", ... }` |
| `/oauth/token` | `POST` | Penukaran authorization code / refresh token menjadi access token baru. | Content-Type: `application/json` / `application/x-www-form-urlencoded` |
| `/oauth/userinfo` | `GET` | Mengambil profil identitas pengguna yang terotentikasi. | Header: `Authorization: Bearer <access_token>` |
| `/oauth/revoke` | `POST` | RFC 7009 Token Revocation untuk mencabut access token atau refresh token. | JSON: `{ "client_id", "client_secret", "token" }` |
| `/oauth/logout` | `GET`/`POST`| Global SSO Logout: Menghancurkan sesi SSO AppCenter & redirect ke aplikasi klien. | Query / Body: `?redirect_uri=https://yourapp.com/login` |

### 5.4 Dedicated In-Place SSO Login & Google-Style Account Chooser
- **Self-Contained UI (`OAuthConsent.svelte`)**: Alur otorisasi `/oauth/authorize` dilayani pada hash SPA `/#/oauth/authorize` tanpa pernah mengarahkan user ke halaman login portal member (`/member/login`).
- **Mode Unauthenticated (Login Mandiri)**: Jika user belum memiliki sesi login, modal SSO menampilkan form login inline dengan proteksi *Rate Limiting IP & Akun* dan pesan error instan.
- **Mode Authenticated (Account Chooser)**: Jika user telah login, ditampilkan kartu ringkasan akun aktif (nama, email, status verified, badge avatar inisial) dengan tombol tindakan:
  - **"Lanjutkan sebagai [Nama]"**: Mengonfirmasi akses dan menerbitkan auth code.
  - **"Ganti Akun"**: Menghapus sesi lokal via `/oauth/api/logout-current` dan beralih ke form login di tempat tanpa merusak parameter URL OAuth.
  - **"Batalkan"**: Mengembalikan redirect ke aplikasi klien dengan parameter `error=access_denied`.
- **No Silent Auto-Login**: Pengguna selalu diberikan kendali penuh untuk mengonfirmasi identitas yang akan dipakai.

### 5.5 Zero Database Integer ID Leakage Policy (Security Hardening)
- **Mitigasi Serangan Enumerasi & IDOR**: Endpoint publik `GET /oauth/userinfo` dan `authContext` **TIDAK PERNAH** membocorkan integer auto-increment ID database (`id` atau `sub`).
- **Kontrak Identitas User**:
  ```json
  {
    "name": "Ahmad Pratama",
    "email": "ahmad@example.com",
    "avatar": null,
    "verified": true,
    "whatsapp": "081234567890",
    "created_at": 1726740000
  }
  ```
- Aplikasi klien menggunakan alamat `email` terverifikasi sebagai kunci identitas unik pengguna.

### 5.6 Global SSO Logout & End-Session Handling
- Untuk mengatasi masalah *infinite re-login loop* saat user logout dari aplikasi klien, endpoint `GET /oauth/logout` dan `POST /oauth/logout` menghancurkan session cookie `ziqva_session` pada AppCenter dan mengarahkan kembali browser pengguna ke parameter `redirect_uri` / `post_logout_redirect_uri`.

### 5.7 Avatar UI/UX: Badge Inisial Dinamis
- Karena profil standar member AppCenter tidak menyimpan URL foto berkas gambar terpisah, tag `<img>` pada antarmuka dialog consent dihilangkan dan digantikan dengan *dynamic initial avatar badge* bergradasi (`{(user.name || 'U').charAt(0).toUpperCase()}`) yang elegan dan anti-broken-image.

### 5.8 Dukungan RFC 7636 PKCE (S256 & Plain)
- Mendukung aplikasi publik (SPA, Flutter Mobile, Electron Desktop) yang tidak dapat menyimpan `client_secret` secara aman.
- Parameter `code_challenge` (Base64URL SHA-256) diverifikasi ketat terhadap `code_verifier` saat penukaran token di `/oauth/token`.

### 5.9 Admin Developer Hub & AI Vibe-Coder Integration Prompt (`AdminOAuthClients.svelte`)
- Menu Admin **OAuth SSO Clients** memungkinkan Administrator membuat, memperbarui, mencabut secret, mengelola whitelist redirect URI, serta mengatur status *Trusted App*.
- Menyediakan generator prompt AI otomatis (*Vibe-Coder Master Brief*) siap pakai untuk instruksi `/writing-plans` di Cursor Composer, Windsurf, Claude Code, Grok, ChatGPT, dan Copilot pada berbagai framework:
  1. Next.js 14/15 App Router & Route Handlers
  2. Python FastAPI Async
  3. Flutter Mobile & Desktop (PKCE)
  4. Node.js Express & TypeScript
  5. Laravel 11/12 Socialite / Custom SSO
  6. Golang Backend (`golang.org/x/oauth2`)

### 5.10 Testing Suite 23 Skenario E2E (`scripts/test-oauth-sso.ts`)
- Pengujian otomatis end-to-end mencakup 23 skenario:
  1. Alur Confidential Client (Generate code, verifikasi Bearer token, prefix validation `zqv_at_`/`zqv_rt_`, expiry 30 hari, UserInfo fetching, refresh token rotation, RFC 7009 revocation).
  2. Alur Public PKCE Client (S256 challenge, verifikasi penolakan verifier salah, penukaran tanpa secret).
  3. Mitigasi Serangan (Replay attack blocking, whitelist redirect URI enforcement, trusted client auto-grant bypass, consent persistence memory, dan pembersihan artefak uji).

---

## BAB 6: REKOMENDASI ARSITEKTURAL & EVOLUSI MASA DEPAN

1. **Password Hashing Modernization**: Melakukan upgrade transisi dari penyimpanan teks langsung ke `bcrypt` (salt rounds 10) atau `argon2id` dengan backward-compatible re-hash pada login pertama.
2. **In-Memory Caching (Redis / Local Memory LRU)**: Mengintegrasikan cache memory pada endpoint publik yang jarang berubah (`/member/api/products`, `/member/api/tutorials`, `/member/api/downloads`) dengan auto-invalidation saat admin melakukan mutasi produk atau kategori.
3. **Advanced Analytics & Charting**: Mengintegrasikan visualisasi grafik tren omset 12 bulan dan metrik rasio konversi trial-to-paid di `AdminDashboard.svelte`.

