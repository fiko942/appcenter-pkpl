# Comprehensive UI/UX Review: Member Dashboard (Desktop vs Mobile, Light vs Dark Theme)

Dokumen ini berisi hasil peninjauan dan evaluasi antarmuka pengguna (UI/UX) pada **Member Dashboard (`client/src/lib/pages/Dashboard.svelte`)** menggunakan browser **Google Chrome** nyata pada 4 variasi tampilan:
1. **Desktop Light Theme** (1440px × 900px)
2. **Desktop Dark Theme** (1440px × 900px)
3. **Mobile Light Theme** (390px × 844px — Viewport Mobile)
4. **Mobile Dark Theme** (390px × 844px — Viewport Mobile)

---

## 🔍 Temuan Evaluasi UI/UX & Rekomendasi Perbaikan

### 1. Banner Hero Welcome Section
- **Tampilan Mobile (Light & Dark)**:
  - *Masalah Spasi*: Judul `h1` ("Tools digital untuk ide yang lebih besar") memiliki `line-height` sedikit terlalu renggang di layar HP (390px), membuat tombol aksi *"Jelajahi Produk"* dan *"Coba Tools Gratis"* terdorong jauh ke bawah.
  - *Kontras Tombol Sekunder*: Tombol *"Coba Tools Gratis"* di Light Mode memiliki kontras border yang agak redup terhadap latar belakang putih netral.
  - **Rekomendasi**: Sesuaikan `line-height: 1.2` pada mobile (`@media (max-width: 640px)`) dan tingkatkan ketebalan border tombol sekunder.

### 2. Seksi Highlight Paket Bundel ("🔥 Paket Bundle Hemat Pilihan")
- **Tampilan Light Mode**:
  - *Latar Belakang Gradien*: Gradien kartu bundel di Light Mode (`from-amber-500/10`) terlihat sedikit pudar di atas background body terang.
  - *Chip Software Penyusun*: Chip software bot di Light Mode memuat `bg-slate-100` dengan border tipis yang kurang memiliki *elevation shadow*.
  - **Rekomendasi**: Tingkatkan ketegasan border kartu bundel di Light Mode menjadi `border-amber-400/50 shadow-md` dan tambahkan `shadow-2xs` pada chip produk.

### 3. Opsi Kategori Filter ("Jelajahi Kategori")
- **Responsivitas Grid Mobile**:
  - *Jumlah Kolom*: Di mobile, kartu kategori berjumlah 2 kolom (`grid-cols-2`). Namun, nama kategori panjang atau tag counter (`X produk`) berisiko *overflow* atau terpotong jika nama kategori terlalu panjang.
  - *Kejelasan Status Aktif*: Kartu kategori yang aktif (`selectedCategoryId === c.id`) di Light Mode memerlukan penanda border kiri/bawah yang lebih kontras agar pengguna langsung tahu filter mana yang sedang terpilih.
  - **Rekomendasi**: Tambahkan penanda garis indikator bercahaya (`border-l-4 border-amber-500` atau `ring-2 ring-amber-500/50`) pada kartu kategori yang sedang aktif.

### 4. Kartu Katalog Produk (`product-card`)
- **Penyelarasan Tinggi Kartu (Equal Height Alignment)**:
  - *Masalah Variasi Konten*: Produk yang memiliki deskripsi 3 baris vs 1 baris menyebabkan posisi baris harga (`price-row`) di bagian bawah kartu tidak sejajar sempurna secara horizontal di tampilan grid Desktop.
  - *Kartu Bundel VS Non-Bundel*: Kartu produk bundel memiliki seksi chip *Included Software Bot* yang membuat kartu bundel lebih tinggi dibanding kartu produk tunggal reguler.
  - **Rekomendasi**: Gunakan `display: flex; flex-direction: column; justify-content: space-between; height: 100%;` pada `.product-copy` agar tombol aksi dan harga selalu terkunci sejajar rata bawah di seluruh kartu.

---

## 🛠️ Rencana Eksekusi Perbaikan (Implementation Steps)

1. **Penyelarasan Spasi & Flex Layout Kartu Katalog**:
   - Kunci posisi `price-row` agar selalu berada di paling bawah kartu produk.
2. **Kategori Active Indicator & Contrast Enhancement**:
   - Berikan aksen visual `ring-2 ring-amber-500` & indicator aktif pada kartu kategori yang terpilih.
3. **Optimasi Mobile Typography & Hero Section**:
   - Rapikan `welcome-copy h1` line-height di mobile breakpoint dan optimasikan responsivitas tombol CTA.
4. **Verifikasi Build & Tampilan Visual Chrome**:
   - Jalankan `pnpm run build` dan verifikasi bahwa 0 error kompilasi terjadi.
