# Spesifikasi & Konteks Modul 1 PKPL: Test Plan Berbasis ISO/IEC/IEEE 29119-3 & Kesiapan Proyek

## 1. Ringkasan Eksekutif
- **Nama Proyek:** AppCenter of Ziqva Labs
- **Repositori Pengujian:** `https://github.com/fiko942/appcenter-pkpl` (Branch: `reborn`)
- **Praktikan:** Wiji Fiko Teren (NIM: 202310370311437)
- **Kelas:** Informatika AD (Fakultas Teknik - Universitas Muhammadiyah Malang)
- **Identifikasi Test Plan:** `TP-APPCENTER-MOD1-202310370311437`
- **Peran Terpilih (Role Under Test):** `Member` (Pengguna Terdaftar / Pembeli Lisensi Software)

---

## 2. Cakupan 8 Fitur Peran Member
1. **Fitur Autentikasi (3 Fitur Wajib):**
   - **Login Member:** Autentikasi kredensial email/password dengan rate limiter berbasis IP.
   - **Register Member:** Pendaftaran akun baru dengan validasi email unik dan panjang password minimal 6 karakter.
   - **Forgot Password Member:** Pengiriman token pemulihan kata sandi ke email terdaftar.
2. **Fitur Operasional (5 Fitur Tambahan Terpilih):**
   - **Order & Checkout Produk Digital:** Pembelian software, kalkulasi voucher diskon kupon, pembuatan tagihan multi-gateway (GoQRIS / Xendit).
   - **Manajemen Lisensi & Rebind Machine ID (HWID):** Pemantauan status lisensi aktif, pengikatan HWID mesin, dan pelepasan (unbind) saat migrasi perangkat.
   - **Software Download Center:** Unduhan binary installer terenkripsi dengan validasi hak akses lisensi aktif.
   - **Portal Mitra Afiliasi & Permintaan Payout:** Pelacakan statistik konversi referral, saldo komisi penjualan, dan pengajuan penarikan dana.
   - **Tutorial Hub & Video Player:** Repositori panduan penggunaan software dengan filtering kategori dan pemutar video interaktif.

---

## 3. Matriks Risiko (Risk Register Terukur)
Formula: $\text{Prioritas} = \text{Dampak} \times \text{Kemungkinan}$
- `R-01` (Produk): Kegagalan validasi Machine ID (HWID) saat aktivasi/rebind lisensi (Dampak: 5, Kemungkinan: 2, Prioritas: 10).
- `R-02` (Produk): Keterlambatan atau kegagalan penerimaan notifikasi webhook payment gateway (Dampak: 5, Kemungkinan: 2, Prioritas: 10).
- `R-03` (Produk): Akses tidak sah terhadap file installer software binary tanpa lisensi aktif (Dampak: 4, Kemungkinan: 2, Prioritas: 8).
- `R-04` (Proyek): Ketergantungan API pihak ketiga (SMTP & Payment Sandbox) saat tes lokal (Dampak: 4, Kemungkinan: 2, Prioritas: 8).
- `R-05` (Produk): Inkonsistensi perhitungan saldo komisi referral afiliasi saat mutasi paralel (Dampak: 4, Kemungkinan: 2, Prioritas: 8).
- `R-06` (Produk): Penguncian akun sah (false positive) akibat sensitivitas rate limiter (Dampak: 3, Kemungkinan: 2, Prioritas: 6).

---

## 4. Status 13 Kriteria Kesiapan Proyek (Project Readiness Checklist)
Pada spreadsheet pendaftaran laboratorium (`/Users/fiko942/Downloads/List Proyek Praktikum PKPL.xlsx` - Sheet `AD` Baris 4):
- `PRJ-1` (Dibuat/dipahami): TRUE
- `PRJ-2` (Dapat dijalankan): TRUE
- `PRJ-3` (Interaksi, proses, output): TRUE
- `ROL-1` (Fokus 1 peran Member): TRUE
- `FTR-1` (Minimal 8 fitur): TRUE
- `FTR-2` (Login, Register, Forgot Password): TRUE
- `FTR-3` (5 fitur tambahan berbobot): TRUE
- `UNQ-1` (Keunikan produk pada platform Web): TRUE
- `RDY-3` (Variasi input untuk Black-Box EP/BVA): TRUE
- `RDY-4` (Source code tersedia untuk White-Box): TRUE
- `RDY-5` (Alur kerja siap diotomatisasi E2E): TRUE
- `RDY-6` (Memiliki CRUD, status change, validasi): TRUE
- `REQ-1` (Sumber kebutuhan awal teridentifikasi): TRUE
- **Progres Akhir:** **13/13 (Lengkap)**

---

## 5. Indeks Berkas Luaran Modul 1
1. **Word Dokumen Hasil Template Resmi:** `Modul 1/Test_Plan_AppCenter_Wiji_Fiko_Teren_202310370311437.docx`
2. **Word Dokumen Standar UMM (4-4-3-3 cm):** `Modul 1/TP-APPCENTER-MOD1-202310370311437.docx`
3. **Markdown Test Plan:** `Modul 1/TEST_PLAN_APPCENTER_V2_MEMBER.md`
4. **Panduan Demo & Rubrik Penilaian:** `Modul 1/PANDUAN_DEMO_DAN_RUBRIK_MODUL_1.md`
5. **Spreadsheet Pendaftaran:** `/Users/fiko942/Downloads/List Proyek Praktikum PKPL.xlsx` (Sheet AD Baris 4)
