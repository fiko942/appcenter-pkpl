# Rencana Kerja Modul 1 Praktikum Kualitas Perangkat Lunak (PKPL) - Test Plan & Project Readiness

> **Untuk Pekerja Agentic:** Dikerjakan secara terstruktur dengan pelacakan checkbox (`- [ ]`). Dokumen luaran mematuhi standar ISO/IEC/IEEE 29119-3 dan tipografi akademik Universitas Muhammadiyah Malang (UMM).

**Tujuan:** Menyusun dokumen Rencana Pengujian (*Test Plan*) resmi Modul 1 berbasis ISO/IEC/IEEE 29119-3 untuk aplikasi **AppCenter of Ziqva Labs** (Fokus Peran: **Member**), memperbarui entri registrasi spreadsheet (13/13 Checklist TRUE), serta menyiapkan verifikasi demo sistem lokal.

**Arsitektur Proyek Uji:** Monorepo Express 5 (TypeScript) + Svelte 4.2 SPA + Vite 6 + Prisma ORM 6.19.3 + MySQL (`ziqva_labs`). Arsitektur port tunggal (`PORT=4829`, Vite dev `5173`).
**Peran Uji Terpilih:** **Member** (Pengguna Terdaftar / Pembeli).
**Repositori Uji Publik Bersih:** `https://github.com/fiko942/appcenter-pkpl` (Branch: `reborn`).

---

## Batasan Global & Standar Dokumen
- **Standar Pengujian:** ISO/IEC/IEEE 29119 Bagian 1 (Konsep), Bagian 2 (Proses), dan Bagian 3 (Dokumentasi Test Plan).
- **Standar Tipografi UMM:** Ukuran kertas A4, margin 4 cm (Kiri), 4 cm (Atas), 3 cm (Kanan), 3 cm (Bawah), font Times New Roman 12 pt, spasi 1.5 baris, first-line indent 1.27 cm, tabel 3 garis tanpa garis vertikal.
- **Kepatuhan Anti-AI-Slop:** Mengintegrasikan sub-skill `humanizer` dan `no-ai-slop`. Menghapus frasa klise, formula kontras biner (*not X but Y*), dan menjaga nada ilmiah analitis objektif.
- **Identitas Baku Mahasiswa:**
  - Nama: **Wiji Fiko Teren**
  - NIM: **202310370311437**
  - Program Studi: **Teknik Informatika - Fakultas Teknik UMM**
  - Kelas Praktikum: **Informatika AD**

---

## Struktur Tugas (Task Breakdown)

### Task 1: Pemetaan & Finalisasi Data Spesifikasi Test Plan Modul 1
Memetakan seluruh atribut pengujian proyek AppCenter V2 ke dalam struktur template resmi ISO 29119-3.

**Files:**
- Output Dokumen Markdown: `Modul 1/TEST_PLAN_APPCENTER_V2_MEMBER.md`

- [ ] **Step 1: Identifikasi Item Uji & Konteks Pengujian**
  - Nama Proyek: AppCenter of Ziqva Labs
  - Identifikasi Dokumen: `TP-APPCENTER-MOD1-202310370311437`
  - Platform: Aplikasi Web (SPA Svelte 4.2 + REST API Express TypeScript)
  - Versi: 2.0.0-pkpl (Branch: `reborn`)
  - URL Akses Pengujian: `http://localhost:4829`
  - Tumpukan Teknologi: Express 5, TypeScript 5, Svelte 4.2, Vite 6, Prisma ORM, MySQL 8.0, Xendit API & GoQRIS SDK.

- [ ] **Step 2: Definisikan Cakupan Pengujian (8 Fitur Peran Member)**
  - *Fitur Autentikasi (3 Fitur Wajib):*
    1. **Login Member**: Autentikasi kredensial email/password dengan proteksi rate limiter dan proteksi brute force.
    2. **Register Member**: Registrasi akun pembeli baru dengan validasi format email unik dan password minimal 6 karakter.
    3. **Forgot Password Member**: Pengiriman tautan reset kata sandi ke email pengguna terdaftar.
  - *Fitur Tambahan (5 Fitur Tambahan Terpilih):*
    4. **Order & Checkout Produk Digital**: Pemilihan lisensi software, kalkulasi diskon voucher kupon, serta pemilihan payment gateway (GoQRIS / Xendit).
    5. **Manajemen Lisensi & Rebind Machine ID (HWID)**: Akses daftar lisensi aktif, pengikatan HWID mesin, dan pergantian identifier perangkat.
    6. **Software Download Center**: Unduhan installer aplikasi binary terlindungi token sesi dan validasi hak akses pengguna.
    7. **Portal Mitra Afiliasi & Permintaan Payout**: Pengecekan saldo komisi referral, pencatatan rekening penarikan, dan pengajuan pencairan dana.
    8. **Tutorial Hub & Video Player**: Akses materi panduan interaktif, filter video berbasis kategori software, dan pemutaran video modal.

- [ ] **Step 3: Susun Daftar Risiko (Risk Register >= 5 Risiko Terukur)**
  - `R-01` (Product Risk): Kegagalan validasi Machine ID (HWID) ganda atau bentrok saat aktivasi lisensi software (Dampak: 5, Kemungkinan: 2, Prioritas: 10).
  - `R-02` (Product Risk): Keterlambatan atau kegagalan webhook notifikasi pembayaran dari payment gateway (Dampak: 5, Kemungkinan: 2, Prioritas: 10).
  - `R-03` (Product Risk): Akses tidak sah terhadap file installer software berbayar tanpa kepemilikan lisensi valid (Dampak: 4, Kemungkinan: 2, Prioritas: 8).
  - `R-04` (Project Risk): Ketergantungan layanan email SMTP dan sandbox payment gateway pihak ketiga saat pengujian lokal (Dampak: 4, Kemungkinan: 2, Prioritas: 8).
  - `R-05` (Product Risk): Inkonsistensi perhitungan saldo afiliasi dan batas minimal penarikan (payout threshold) saat mutasi bersamaan (Dampak: 4, Kemungkinan: 2, Prioritas: 8).
  - `R-06` (Product Risk): Lockout proteksi brute-force login pengguna valid akibat kesalahan pencatatan IP helper (Dampak: 3, Kemungkinan: 2, Prioritas: 6).

- [ ] **Step 4: Rancang Strategi Pengujian, Kriteria, dan Lingkungan Uji**
  - Tingkat Pengujian: Pengujian Tingkat Sistem (*System Testing*).
  - Jenis Pengujian Utama: Pengujian Fungsional (*Functional Testing*).
  - Kriteria Masuk (*Entry Criteria*): Server lokal running di port 4829, basis data MySQL terhubung, dan akun uji Member aktif.
  - Kriteria Keluar (*Exit Criteria*): 100% skenario pengujian utama peran Member telah dieksekusi dan tidak ada defect berstatus kritis (*critical/blocker*).
  - Lingkungan Uji: macOS / Windows 11, Browser Google Chrome, Node.js v20, MySQL 8.0, pnpm.

---

### Task 2: Pembangkitan Dokumen Test Plan Resmi (.docx & .md)
Menghasilkan dokumen resmi yang siap diserahkan kepada asisten laboratorium PKPL.

**Files:**
- Generator Script: `scripts/generate_test_plan_docx.py`
- Markdown Output: `Modul 1/TEST_PLAN_APPCENTER_V2_MEMBER.md`
- Word Document Output: `Modul 1/TP-APPCENTER-MOD1-202310370311437.docx`

- [ ] **Step 1: Tulis Dokumen Markdown Lengkap Standar ISO 29119-3**
  Menyusun isi naskah utuh tanpa singkatan atau teks placeholder.

- [ ] **Step 2: Bangun Script Python OpenXML Builder**
  Menggunakan `python-docx` untuk memformat dokumen `.docx` sesuai aturan UMM:
  - Margin 4-4-3-3 cm
  - Font Times New Roman 12 pt, spasi 1.5
  - Heading 1 (14 pt Bold Kapital Center), Heading 2 (12 pt Bold Left)
  - Tabel ilmiah 3 garis horizontal dengan cell padding rapi
  - Penomoran halaman romawi (Front Matter) dan Arab (Batang Tubuh).

- [ ] **Step 3: Eksekusi Generator & Validasi Integritas File .docx**
  Memastikan berkas `.docx` terbuat tanpa error dan dapat dibuka dengan sempurna di Microsoft Word / LibreOffice.

---

### Task 3: Pembaruan Entri Spreadsheet Registrasi Proyek (Sheet AD Baris 4)
Memperbarui berkas Excel pendaftaran `/Users/fiko942/Downloads/List Proyek Praktikum PKPL.xlsx`.

**Files:**
- Script Updater: `scripts/update_excel_registration.py`
- Target Excel: `/Users/fiko942/Downloads/List Proyek Praktikum PKPL.xlsx`

- [ ] **Step 1: Definisikan Payload Data Registrasi Baris 4**
  - `F4` (Fitur Tambahan): "1. Order & Checkout Produk Digital, 2. Manajemen Lisensi & Rebind Machine ID, 3. Software Download Center, 4. Portal Mitra Afiliasi & Payout, 5. Tutorial Hub & Video Player"
  - `G4` (Tautan Repo / Web): "https://github.com/fiko942/appcenter-pkpl"
  - `H4` (Catatan Praktikan): "Fokus pengujian peran Member pada platform web AppCenter V2 monorepo Svelte + Express. Repositori publik telah disanitasi dari seluruh kredensial rahasia."
  - `S4` s.d. `AE4` (13 Checklist Item): Seluruhnya bernilai `TRUE` (1).
    - PRJ-1: TRUE
    - PRJ-2: TRUE
    - PRJ-3: TRUE
    - ROL-1: TRUE
    - FTR-1: TRUE
    - FTR-2: TRUE
    - FTR-3: TRUE
    - UNQ-1: TRUE
    - RDY-3: TRUE
    - RDY-4: TRUE
    - RDY-5: TRUE
    - RDY-6: TRUE
    - REQ-1: TRUE

- [ ] **Step 2: Jalankan Script Injeksi XML Spreadsheet**
  Menyimpan perubahan langsung ke berkas `.xlsx` dengan mempertahankan integritas formula dan format cell.

- [ ] **Step 3: Verifikasi Nilai Akhir Sheet AD Baris 4**
  Memastikan progres daftar periksa bernilai `13/13` dan tidak ada item FALSE.

---

### Task 4: Panduan Presentasi & Demonstrasi Pengujian (Rubrik 100%)
Menyusun cheatsheet demonstrasi untuk praktikan saat sesi demo di depan asisten lab.

**Files:**
- Panduan Demo: `Modul 1/PANDUAN_DEMO_DAN_RUBRIK_MODUL_1.md`

- [ ] **Step 1: Petakan Alur Demo Sesuai Rubrik Penilaian Tabel 7.1**
  1. Penjelasan item uji & kesesuaian peran Member (Bobot 15%).
  2. Penjelasan arsitektur Test Plan ISO 29119-3 (Bobot 40%).
  3. Pembuktian matriks risiko & strategi mitigasi (Bobot 25%).
  4. Demonstrasi interaktif eksekusi aplikasi lokal di port 4829 (Bobot 20%).

- [ ] **Step 2: Sediakan Kredensial Uji & Langkah Demo Praktis**
  - Akun Member: `testuser@ziqva.com` / `Password123!`
  - Navigasi alur 8 fitur: Auth -> Dashboard -> Catalog -> Checkout -> License & HWID -> Download -> Affiliate -> Tutorials.
