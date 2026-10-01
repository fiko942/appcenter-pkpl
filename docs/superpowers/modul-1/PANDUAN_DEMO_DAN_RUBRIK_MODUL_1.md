# PANDUAN PRAKTIKUM & DEMO PENGUJIAN MODUL 1 PKPL
## STUDI KASUS: APPCENTER OF ZIQVA LABS (ROLE: MEMBER)

Panduan ini disusun untuk membantu **Wiji Fiko Teren (NIM: 202310370311437)** dalam mempresentasikan hasil pengerjaan **Modul 1: SQA Fundamentals, ISO/IEC/IEEE 29119, and Project Readiness** kepada Asisten Laboratorium Pengujian Kualitas Perangkat Lunak (PKPL).

---

### 1. Ringkasan Dokumen & Luaran yang Telah Selesai
1. **Dokumen Rencana Pengujian (*Test Plan Document*)**:
   - Berkas Word Resmi: `Modul 1/TP-APPCENTER-MOD1-202310370311437.docx`
   - Berkas Markdown: `Modul 1/TEST_PLAN_APPCENTER_V2_MEMBER.md`
   - Kepatuhan Standar: ISO/IEC/IEEE 29119-3, Margin 4-4-3-3 cm, Times New Roman 12 pt, Spasi 1.5, Tabel Ilmiah 3 Garis.
2. **Entri Lembar Registrasi Proyek (*Project Registration Spreadsheet*)**:
   - Berkas: `/Users/fiko942/Downloads/List Proyek Praktikum PKPL.xlsx` (Sheet `AD`, Baris 4)
   - Status Checklist: **13/13 Terpenuhi (TRUE)** tanpa catatan minus (`-`).
3. **Repositori Publik Bersih & Tersanitasi**:
   - URL GitHub: `https://github.com/fiko942/appcenter-pkpl` (Branch: `reborn`)

---

### 2. Strategi Menjawab Pertanyaan Asisten Sesuai Rubrik Penilaian (Tabel 7.1)

#### A. Kelengkapan dan Koherensi Test Plan (Bobot 40%)
- **Pertanyaan Asisten:** *"Mengapa Test Plan ini menggunakan standar ISO/IEC/IEEE 29119-3 dan apa saja komponen utamanya?"*
- **Poin Jawaban:**
  - Standar ISO/IEC/IEEE 29119-3 merupakan standar internasional untuk dokumentasi pengujian perangkat lunak terstruktur.
  - Test Plan mencakup 6 bagian inti:
    1. **Konteks Pengujian (*Context of Testing*)**: Menjelaskan batasan sistem, arsitektur monorepo Svelte + Express, serta 8 fitur peran Member (3 autentikasi + 5 fitur operasional).
    2. **Daftar Risiko (*Risk Register*)**: Pemetaan 6 risiko teknis dan proyek terukur menggunakan formula $\text{Prioritas} = \text{Dampak} \times \text{Kemungkinan}$.
    3. **Strategi Pengujian (*Test Strategy*)**: Pendekatan pengujian fungsional tingkat sistem (*System Functional Testing*), kriteria masuk/keluar (*entry/exit criteria*), serta strategi retesting dan regresi.
    4. **Lingkungan Pengujian (*Test Environment*)**: Spesifikasi perangkat keras, runtime Node.js v20, database MySQL 8.0, dan browser Chromium.
    5. **Jadwal Pengujian (*Test Schedule*)**: Rencana kontinuitas pengujian dari Modul 1 hingga UAP.
    6. **Luaran Pengujian (*Test Deliverables*)**: Artefak luaran dokumen Test Plan dan entri registrasi.

#### B. Kualitas Analisis Risiko / Risk Register (Bobot 25%)
- **Pertanyaan Asisten:** *"Jelaskan risiko tertinggi yang diidentifikasi pada sistem ini dan bagaimana mitigasinya!"*
- **Poin Jawaban:**
  - **Risiko Tertinggi 1 (`R-01`, Prioritas 10):** Kegagalan validasi Machine ID (HWID) saat pengguna berganti laptop/perangkat. Mitigasi: Pengujian ketat pada format string HWID, batasan maksimal slot device, dan endpoint unbind/rebind lisensi.
  - **Risiko Tertinggi 2 (`R-02`, Prioritas 10):** Kegagalan webhook callback notifikasi pembayaran otomatis dari payment gateway. Mitigasi: Pengujian simulasi webhook lokal dengan validasi signature kriptografis dan fallback polling invoice.
  - **Risiko Keamanan Unduhan (`R-03`, Prioritas 8):** Kebocoran link file binary software oleh non-member. Mitigasi: Pengujian token unduhan temporer yang terikat lisensi database aktif.

#### C. Kesesuaian & Kesiapan Proyek / 13 Checklist (Bobot 15%)
- **Pertanyaan Asisten:** *"Mengapa proyek AppCenter V2 ini dinyatakan lolos 13/13 Project Readiness Checklist?"*
- **Poin Jawaban:**
  1. **PRJ-1, PRJ-2, PRJ-3**: Sistem dikembangkan sendiri, dapat dijalankan secara lokal di port 4829, serta memiliki interaksi transaksi dan mutasi data riil (bukan template statis).
  2. **ROL-1**: Fokus pengujian konsisten pada 1 peran, yaitu **Member**.
  3. **FTR-1, FTR-2, FTR-3**: Memiliki 8 fitur terpadu:
     - 3 Autentikasi: Login, Register, Forgot Password.
     - 5 Tambahan: (1) Order & Checkout Produk, (2) Lisensi & Rebind Machine ID, (3) Download Center, (4) Mitra Afiliasi & Payout, (5) Tutorial Hub.
  4. **UNQ-1**: Proyek unik pada platform Web.
  5. **RDY-3**: Menyediakan variasi input (email, password, kupon diskon, HWID mesin, nomor rekening bank) untuk pengujian Equivalence Partitioning (EP) dan Boundary Value Analysis (BVA) pada Modul 2.
  6. **RDY-4**: Kode sumber lengkap (TypeScript & Svelte) tersedia untuk pengujian White-Box pada Modul 3.
  7. **RDY-5**: Alur kerja checkout hingga penerbitan lisensi dapat diotomatisasi (*E2E Automation*) pada Modul 4.
  8. **RDY-6**: Terdapat siklus CRUD, perubahan status invoice (`PENDING` $\rightarrow$ `PAID` $\rightarrow$ `SETTLED`), dan mutasi saldo afiliasi.
  9. **REQ-1**: Spesifikasi kebutuhan dan matriks fitur sistem terdokumentasi lengkap pada `docs/SYSTEM_FEATURE_MATRIX.md`.

#### D. Penjelasan Alur Demonstrasi Aplikasi Lokal (Bobot 20%)
- **Langkah Praktis Demo di Depan Asisten:**
  1. Buka terminal dan jalankan server:
     ```bash
     cd "/Users/fiko942/Desktop/Prak. PKPL/appcenterv2"
     pnpm run dev
     ```
  2. Buka browser pada alamat: `http://localhost:4829`.
  3. **Demokan Alur Autentikasi**:
     - Masuk ke halaman `/login` $\rightarrow$ perlihatkan form Login Member, tombol Register, dan link Forgot Password.
  4. **Demokan Dashboard Member & 5 Fitur Utama**:
     - Login dengan akun uji: `testuser@ziqva.com` / `Password123!`
     - **Fitur 1 (Catalog & Checkout)**: Buka menu Produk $\rightarrow$ pilih aplikasi $\rightarrow$ buat pesanan $\rightarrow$ tampil halaman invoice pembayaran QRIS / Bank.
     - **Fitur 2 (Manajemen Lisensi & HWID)**: Buka menu Lisensi Saya $\rightarrow$ perlihatkan kode lisensi aktif $\rightarrow$ tunjukkan aksi bind & rebind Machine ID perangkat.
     - **Fitur 3 (Download Center)**: Buka menu Unduhan $\rightarrow$ perlihatkan file binary software yang hanya dapat diunduh jika memiliki lisensi aktif.
     - **Fitur 4 (Afiliasi & Payout)**: Buka menu Program Afiliasi $\rightarrow$ tunjukkan link referral, statistik klik, saldo komisi, dan form pengajuan penarikan dana (payout).
     - **Fitur 5 (Tutorial Hub)**: Buka menu Tutorial $\rightarrow$ tunjukkan filter materi berdasarkan kategori dan pemutar video interaktif.
