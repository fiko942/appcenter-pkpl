# DOKUMEN RENCANA PENGUJIAN (TEST PLAN)
## APPCENTER OF ZIQVA LABS

---

### Informasi Dokumen
| Bidang | Detail |
| :--- | :--- |
| **Identifikasi Test Plan** | `TP-APPCENTER-MOD1-202310370311437` |
| **Nama Aplikasi** | AppCenter of Ziqva Labs |
| **Versi** | 2.0.0-pkpl |
| **Peran yang Dipilih untuk Diuji** | Member (Pengguna Terdaftar / Pembeli Lisensi Software) |
| **Nama Praktikan** | Wiji Fiko Teren |
| **NIM** | 202310370311437 |
| **Kelas** | Informatika AD |
| **Tanggal Dibuat** | 02 Oktober 2026 |
| **Tanggal Terakhir Diperbarui** | 02 Oktober 2026 |
| **Status** | Final |

---

### Riwayat Revisi
| Versi | Tanggal Revisi | Diperbarui Oleh | Deskripsi Perubahan |
| :---: | :---: | :---: | :--- |
| 1.0 | 02 Oktober 2026 | Wiji Fiko Teren | Penyusunan draf awal Rencana Pengujian Modul 1 berbasis standar ISO/IEC/IEEE 29119-3 untuk peran Member. |

---

## DAFTAR ISI
- 1. Konteks Pengujian
  - 1.1 Item Uji
  - 1.2 Cakupan Pengujian
  - 1.3 Peran yang Dipilih untuk Diuji
  - 1.4 Asumsi dan Batasan
- 2. Daftar Risiko
- 3. Strategi Pengujian
  - 3.1 Pendekatan Keseluruhan
  - 3.2 Arah Pengujian yang Direncanakan
  - 3.3 Kriteria
- 4. Lingkungan Pengujian
  - 4.1 Perangkat dan Perangkat Keras
  - 4.2 Perangkat Lunak dan Alat
  - 4.3 Jaringan dan Backend
  - 4.4 Data Uji
- 5. Jadwal Pengujian
- 6. Luaran Pengujian
- Lampiran A: Glosarium

---

## 1. Konteks Pengujian

Dokumen kebutuhan awal merupakan salah satu item kesiapan yang digunakan pada rangkaian pengujian perangkat lunak. Pada Modul 1, identifikasi sumber kebutuhan awal ditujukan untuk memetakan batasan operasional sistem, arsitektur dasar, dan perilaku fungsional yang disepakati untuk peran Member sebelum memasuki tahapan perancangan *test case* mendalam pada Modul 2.

### 1.1 Item Uji
| Bidang | Deskripsi |
| :--- | :--- |
| **Nama Aplikasi** | AppCenter of Ziqva Labs |
| **Platform** | Web Application (Single Page Application terintegrasi REST API) |
| **Versi** | 2.0.0-pkpl (Branch: reborn) |
| **URL Deployment / Akses** | `http://localhost:4829` (Akses Lokal Port Tunggal) / `https://appcenter.ziqva.com` |
| **Tumpukan Teknologi** | Svelte 4.2, TypeScript, Express 5, Prisma ORM 6.19.3, MySQL 8.0, Vite 6, Tailwind CSS |
| **Deskripsi Singkat** | AppCenter of Ziqva Labs merupakan platform portal distribusi software digital, manajemen lisensi berbasis perangkat keras (Hardware ID / HWID), pemrosesan transaksi otomatis multi-gateway, dan portal kemitraan afiliasi. |

### 1.2 Cakupan Pengujian

#### Fitur dalam Cakupan (In-Scope)
Pengujian difokuskan pada peran **Member** dengan total 8 fitur yang mencakup 3 fitur autentikasi dan 5 fitur operasional utama:

| No. | Nama Fitur | Jenis Fitur | Deskripsi Singkat |
| :---: | :--- | :---: | :--- |
| 1 | **Login Member** | Fitur Autentikasi | Autentikasi kredensial email dan password pengguna terdaftar dengan mekanisme proteksi rate limiting berbasis IP untuk mitigasi brute force. |
| 2 | **Register Member** | Fitur Autentikasi | Pendaftaran akun pengguna baru dengan validasi keunikan format email, verifikasi panjang kata sandi minimal 6 karakter, dan inisialisasi profil pengguna. |
| 3 | **Forgot Password** | Fitur Autentikasi | Pengiriman token pemulihan kata sandi menuju alamat email terdaftar untuk mengatur ulang kata sandi akun yang terlupakan. |
| 4 | **Order & Checkout Produk** | Fitur Tambahan | Penelusuran katalog produk, pemilihan lisensi aplikasi, penerapan voucher kupon diskon, kalkulasi nominal tagihan, dan pembuatan invoice multi-channel (GoQRIS / Xendit). |
| 5 | **Manajemen Lisensi & Rebind HWID** | Fitur Tambahan | Monitoring status lisensi aktif, pengikatan identitas mesin perangkat (*Machine ID / HWID*), serta eksekusi pelepasan lisensi (*unbind/rebind*) saat pengguna berpindah perangkat kerja. |
| 6 | **Software Download Center** | Fitur Tambahan | Akses repositori berkas binary installer aplikasi yang diamankan dengan validasi status lisensi aktif dan token unduhan temporer. |
| 7 | **Portal Afiliasi & Payout** | Fitur Tambahan | Pelacakan statistik konversi tautan referensi mitra, pemantauan saldo komisi penjualan, pencatatan rekening penarikan bank/e-wallet, serta pengajuan pencairan dana (*payout request*). |
| 8 | **Tutorial Hub & Video Player** | Fitur Tambahan | Akses repositori materi dokumentasi penggunaan software, filtering materi berdasarkan kategori aplikasi, dan pemutaran video panduan pada modal terintegrasi. |

#### Di Luar Cakupan (Out-of-Scope)
| No. | Fitur / Aspek | Alasan Pengecualian |
| :---: | :--- | :--- |
| 1 | **Manajemen Master Produk oleh Administrator** | Berada di luar batasan hak akses peran Member; fitur dikhususkan untuk peran Administrator dengan otorisasi PIN keamanan terpisah. |
| 2 | **Konfigurasi Server SFTP & Backup Database Otomatis** | Aspek operasional infrastruktur sistem internal backend yang tidak memiliki interaksi antarmuka langsung dengan peran Member. |
| 3 | **Persetujuan Pencairan Dana (Payout Approval) oleh Admin** | Alur kerja persetujuan mutasi saldo berada pada kewenangan administrator keuangan, pengujian peran Member hanya mencakup tahapan pengajuan pencairan. |
| 4 | **Pengujian Beban Skala Besar (Load Testing > 10.000 RPS)** | Di luar cakupan pengujian fungsional dasar Modul 1; pengujian kinerja non-fungsional dijadwalkan pada modul tingkat lanjut. |

### 1.3 Peran yang Dipilih untuk Diuji
| Bidang | Detail |
| :--- | :--- |
| **Nama Peran** | Member (Pelanggan / Pengguna Terdaftar) |
| **Deskripsi Peran** | Pengguna yang memiliki akun terdaftar pada sistem, bertindak sebagai pembeli software, pemilik lisensi resmi, pengunduh binary aplikasi, dan mitra penerima komisi program afiliasi. |
| **Fitur yang Dapat Diakses** | Login, Register, Forgot Password, Dashboard Pengguna, Katalog Pembelian, Riwayat Transaksi & Pembayaran, Manajemen Lisensi & Rebind HWID, Download Center, Portal Afiliasi & Permintaan Payout, serta Tutorial Hub. |
| **Alasan Pemilihan** | Peran Member merepresentasikan alur bisnis utama (*core business value*) platform AppCenter. Seluruh siklus transaksi, validasi lisensi kriptografis, dan retensi pengguna berpusat pada peran ini sehingga menyediakan variasi skenario fungsional yang kaya untuk seluruh rangkaian praktikum PKPL. |

### 1.4 Asumsi dan Batasan
| Jenis | Deskripsi |
| :--- | :--- |
| **Asumsi** | Seluruh dependensi aplikasi monorepo (Express, Svelte, Prisma) berjalan normal pada lingkungan pengujian lokal port 4829. |
| **Asumsi** | Basis data MySQL lokal (`ziqva_labs`) telah terisi skema database dan data awalan produk untuk mendukung alur pemesanan. |
| **Asumsi** | Simulator / sandbox payment gateway (GoQRIS & Xendit) dapat merespons pembuatan tagihan uji secara deterministik. |
| **Batasan** | Pengujian fungsional dibatasi secara eksklusif pada antarmuka dan API yang memiliki hak otorisasi peran Member. |
| **Batasan** | Pengujian tidak menyentuh database produksi dan tidak melakukan transaksi finansial riil menggunakan dana perbankan aktual. |
| **Batasan** | Pengiriman surat elektronik (email verifikasi dan reset password) menggunakan konfigurasi Mailtrap/SMTP staging lokal. |

---

## 2. Daftar Risiko

Matriks risiko disusun untuk mengidentifikasi potensi kegagalan teknis produk maupun kendala manajemen pengujian. Nilai Prioritas dihitung menggunakan formula:
$$\text{Prioritas} = \text{Dampak} \times \text{Kemungkinan}$$
Skala penilaian menggunakan rentang 1 (Sangat Rendah) hingga 5 (Sangat Tinggi).

| ID Risiko | Deskripsi Risiko | Jenis | Dampak (1-5) | Kemungkinan (1-5) | Prioritas | Strategi Mitigasi |
| :---: | :--- | :---: | :---: | :---: | :---: | :--- |
| **R-01** | Kegagalan validasi Machine ID (HWID) saat pengguna melakukan aktivasi atau migrasi lisensi perangkat baru, menyebabkan software tidak dapat digunakan pembeli. | Risiko Produk | 5 | 2 | **10** | Menyusun skenario pengujian ketat terkait format string HWID, validasi limit perangkat maksimal, dan mekanisme unbind lisensi sebelum aktivasi ulang. |
| **R-02** | Keterlambatan atau kegagalan penerimaan notifikasi webhook dari penyedia payment gateway saat status pembayaran invoice berhasil, mengakibatkan lisensi tidak terbit otomatis. | Risiko Produk | 5 | 2 | **10** | Menyiapkan pengujian integrasi callback webhook payment gateway dengan verifikasi signature kriptografis dan mekanisme polling status invoice fallback. |
| **R-03** | Akses tidak sah terhadap tautan unduhan binary software oleh pengguna non-pembeli akibat kelemahan validasi sesi pada endpoint file storage. | Risiko Produk | 4 | 2 | **8** | Menerapkan pengujian pengamanan URL unduhan menggunakan token temporer terenkripsi yang memvalidasi kepemilikan lisensi aktif pada database. |
| **R-04** | Ketergantungan terhadap koneksi internet eksternal saat memanggil API sandbox pihak ketiga (SMTP Email & Payment Gateway) pada pengujian lokal. | Risiko Proyek | 4 | 2 | **8** | Mengonfigurasi mock service lokal dan penyediaan rute simulasi callback pembayaran internal untuk isolasi pengujian tanpa konektivitas luar. |
| **R-05** | Inkonsistensi perhitungan saldo komisi referral afiliasi saat terjadi pembatalan transaksi order atau pengajuan payout simultan. | Risiko Produk | 4 | 2 | **8** | Menguji transaksi basis data menggunakan isolasi transaksi Prisma ORM dan verifikasi mutasi debit-kredit saldo secara atomik. |
| **R-06** | Penguncian akun (*account lockout*) atau pemblokiran IP palsu (*false positive*) pada pengguna sah akibat ambang batas rate limiter yang terlalu sensitif. | Risiko Produk | 3 | 2 | **6** | Menguji toleransi batasan frekuensi request pada modul `securityRateLimiter` dan memverifikasi fungsionalitas bypass IP whitelist lokal pengujian. |

---

## 3. Strategi Pengujian

### 3.1 Pendekatan Keseluruhan
| Bidang | Deskripsi |
| :--- | :--- |
| **Pendekatan Pengujian** | Belum ditetapkan; dilengkapi pada modul berikutnya. |
| **Tingkat Pengujian** | Pengujian Tingkat Sistem (*System Testing*). |
| **Jenis Pengujian Utama** | Pengujian Fungsional (*Functional Testing*). |
| **Fitur Berprioritas Tinggi** | Manajemen Lisensi & Rebind HWID (`R-01`), Order & Checkout Produk Digital (`R-02`), dan Software Download Center (`R-03`). |

### 3.2 Arah Pengujian yang Direncanakan
Pada Modul 1, arah dan teknik pengujian belum perlu ditentukan. Bagian ini dilengkapi secara bertahap setelah materi terkait dipelajari pada modul berikutnya.

| Aspek | Status | Catatan |
| :--- | :---: | :--- |
| **Arah dan Teknik Pengujian** | Belum ditetapkan | Dilengkapi setelah materi terkait dipelajari pada modul berikutnya. |

### 3.3 Kriteria
| Jenis Kriteria | Deskripsi |
| :--- | :--- |
| **Kriteria Masuk (*Entry Criteria*)** | 1. Lingkungan server Express dan klien Svelte berjalan stabil pada port 4829 tanpa galat kompilasi.<br>2. Basis data MySQL lokal telah terhubung dan memiliki skema tabel terverifikasi melalui Prisma.<br>3. Tersedia akun uji Member aktif dan data master katalog produk siap transaksi. |
| **Kriteria Keluar (*Exit Criteria*)** | 1. Seluruh skenario pengujian fungsional peran Member yang direncanakan telah dieksekusi 100%.<br>2. Tidak ditemukan cacat perangkat lunak berstatus kritis (*severity blocker / critical*) pada fitur utama.<br>3. Seluruh bukti pengujian (*test log* dan tangkapan layar antarmuka) terdokumentasi lengkap. |
| **Kriteria Lolos (*Pass Criteria*)** | Hasil aktual interaksi aplikasi dan respons API bersesuaian tepat dengan perilaku yang diharapkan (*expected result*) pada spesifikasi fungsional. |
| **Kriteria Gagal (*Fail Criteria*)** | Hasil aktual menyimpang dari perilaku yang diharapkan, antarmuka mengalami pembekuan (*freeze*), terjadi unhandled exception 500, atau lisensi gagal terbit setelah pembayaran valid. |
| **Pengujian Ulang (*Retesting*)** | Eksekusi ulang secara spesifik terhadap kasus uji yang sebelumnya gagal setelah perbaikan kode sumber diterapkan oleh pengembang. |
| **Pengujian Regresi (*Regression Testing*)** | Eksekusi rangkaian uji pada modul terkait untuk memastikan perbaikan cacat tidak menimbulkan efek samping atau kerusakan pada fungsionalitas lain yang sebelumnya berjalan normal. |

---

## 4. Lingkungan Pengujian

### 4.1 Perangkat dan Perangkat Keras
| Item | Detail |
| :--- | :--- |
| **Jenis Perangkat** | Laptop (Apple Silicon Workstation) |
| **Processor** | Apple M-Series Chip (ARM64 Architecture) |
| **RAM** | 16 GB Unified Memory |
| **Sistem Operasi** | macOS Sequoia (Version 15.x / Darwin Kernel) |

### 4.2 Perangkat Lunak dan Alat
| Alat / Perangkat Lunak | Versi / Detail | Tujuan |
| :--- | :--- | :--- |
| **Web Browser** | Google Chrome Versi 128+ / Chromium | Media eksekusi pengujian antarmuka pengguna (UI) |
| **Runtime & Package Manager** | Node.js v20.x LTS, pnpm v9.x, ts-node | Lingkungan eksekusi server backend dan dependensi |
| **Database Server** | MySQL Community Server 8.0 / MariaDB | Penyimpanan basis data relasional sistem lokal |
| **Database Management Client** | Prisma Studio / DBeaver / TablePlus | Inspeksi struktur tabel dan verifikasi integritas data |
| **Alat Dokumentasi** | Microsoft Word (.docx), VS Code, Markdown | Penyusunan laporan Test Plan dan matriks penelusuran |
| **Alat Tangkapan Layar & Log** | macOS Native Screenshot Tool / CleanShot X | Perekaman bukti eksekusi pengujian (*evidence capture*) |

### 4.3 Jaringan dan Backend
| Item | Detail |
| :--- | :--- |
| **Jaringan** | Localhost Loopback Network (127.0.0.1) & Koneksi Wi-Fi Berkecepatan Stabil |
| **Backend / API** | Express.js 5 RESTful API terintegrasi Prisma Client |
| **URL Dasar Pengujian** | `http://localhost:4829` (Klien Svelte SPA & Rute REST API Terpadu) |

### 4.4 Data Uji
| Jenis Data | Deskripsi |
| :--- | :--- |
| **Akun Uji Valid** | Akun Member terdaftar: `testuser@ziqva.com` dengan kata sandi valid `Password123!`. |
| **Akun Uji Tidak Valid** | 1. Email belum terdaftar: `unregistered_user@example.com`.<br>2. Format email salah: `invalid-email-format`.<br>3. Kata sandi salah atau tidak memenuhi batas minimal 6 karakter. |
| **Contoh Data Input** | 1. String Machine ID (HWID): `BFEBFBFF000906EA-UUID-7729-AZ`.<br>2. Kode Kupon Diskon: `PROMOHEMAT10`.<br>3. Data Rekening Penarikan Afiliasi: Bank BCA, Nomor Rekening `8735091234`, Nama Pemilik `Wiji Fiko Teren`. |
| **Data Uji Tambahan** | Belum ditetapkan; dilengkapi pada modul berikutnya sesuai kebutuhan teknik pengujian dinamis. |

---

## 5. Jadwal Pengujian

Rencana jadwal pengujian dirancang mencakup keseluruhan tahapan praktikum SQA untuk memastikan konsistensi proyek:

| Modul | Aktivitas Pengujian Utama | Perkiraan Waktu | Luaran Utama |
| :---: | :--- | :---: | :--- |
| **Modul 1** | Perencanaan pengujian, analisis risiko perangkat lunak, dan registrasi proyek studi kasus | Minggu 1 - 2 | Dokumen Test Plan resmi dan entri lembar registrasi proyek terverifikasi (13/13 TRUE) |
| **Modul 2** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **Modul 3** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **Modul 4** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **Modul 5** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **Modul 6** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **UAP** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |

---

## 6. Luaran Pengujian

| Modul | Luaran | Format | Status |
| :---: | :--- | :---: | :---: |
| **Modul 1** | Dokumen Rencana Pengujian (*Test Plan Document*) | DOCX / PDF | Selesai |
| **Modul 1** | Entri Lembar Registrasi Proyek Praktikum | Spreadsheet | Selesai |
| **Modul 2** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **Modul 3** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **Modul 4** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **Modul 5** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **Modul 6** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |
| **UAP** | *Belum ditetapkan* | *Belum ditetapkan* | *Belum ditetapkan* |

---

## Lampiran A: Glosarium

Istilah kunci yang digunakan dalam dokumen ini mengacu pada standar internasional **ISO/IEC/IEEE 29119-1 (Concepts and Definitions)**:

| Istilah | Definisi Menurut ISO/IEC/IEEE 29119-1 |
| :--- | :--- |
| **Item Uji (*Test Item*)** | Objek yang diuji. Pada konteks praktikum ini, objek uji adalah aplikasi web *AppCenter of Ziqva Labs*. |
| **Dasar Pengujian (*Test Basis*)** | Sumber informasi yang digunakan sebagai acuan perancangan pengujian, mencakup kebutuhan fungsional, arsitektur sistem, dan alur proses bisnis yang disepakati. |
| **Kondisi Pengujian (*Test Condition*)** | Aspek atau variabel sistem yang dapat diuji untuk memverifikasi pemenuhan suatu kebutuhan tertentu. |
| **Kasus Uji (*Test Case*)** | Sekumpulan nilai masukan (*input*), prasyarat eksekusi (*preconditions*), langkah tindakan (*test steps*), dan hasil yang diharapkan (*expected results*) untuk menguji kondisi tertentu. |
| **Lingkungan Pengujian (*Test Environment*)** | Fasilitas perangkat keras, instrumen perangkat lunak, konfigurasi jaringan, dan data uji pendukung yang disiapkan untuk menjalankan pengujian. |
| **Risiko (*Risk*)** | Probabilitas terjadinya suatu kejadian yang tidak diharapkan yang berpotensi menimbulkan dampak negatif pada mutu produk (*Product Risk*) atau keberhasilan proyek pengujian (*Project Risk*). |
| **Insiden (*Test Incident*)** | Setiap kejadian atau anomali yang terjadi selama pelaksanaan pengujian yang memerlukan penyelidikan dan klarifikasi lebih lanjut. |
| **Keterlacakan (*Traceability*)** | Kemampuan untuk melacak keterhubungan timbal balik antara spesifikasi kebutuhan, modul sistem, kasus uji, hingga laporan hasil eksekusi. |
| **Dampak (*Impact*)** | Tingkat keseriusan kerugian atau gangguan operasional apabila suatu risiko benar-benar terjadi, dinilai dengan skala ordinal 1 hingga 5. |
| **Kemungkinan (*Likelihood*)** | Derajat peluang terjadinya suatu kejadian risiko dalam periode operasional atau pengujian, dinilai dengan skala ordinal 1 hingga 5. |
| **Prioritas (*Priority*)** | Bobot kepentingan penanganan risiko yang dihitung dari perkalian nilai Dampak dan Kemungkinan ($\text{Dampak} \times \text{Kemungkinan}$). |
| **Strategi Mitigasi (*Mitigation Strategy*)** | Langkah terencana yang dirancang untuk mencegah terjadinya risiko atau mereduksi konsekuensi buruk yang ditimbulkannya. |
| **Kriteria Masuk (*Entry Criteria*)** | Himpunan kondisi prasyarat yang wajib dipenuhi secara mutlak sebelum suatu tahapan pengujian diizinkan untuk dimulai. |
| **Kriteria Keluar (*Exit Criteria*)** | Himpunan kondisi verifikasi yang menandakan bahwa tahapan pengujian telah selesai dilaksanakan secara tuntas. |
