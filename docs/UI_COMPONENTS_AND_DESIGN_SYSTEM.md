# DOKUMENTASI KOMPONEN UI, STYLE SYSTEM, & MOTION DESIGN APPCENTER V2
## Spesifikasi Komprehensif Seluruh Komponen Svelte, Design Tokens, & Interaksi Animasi

**Versi**: 2.0.0 (Production Release)  
**Framework**: Svelte 4.2 + Tailwind CSS 4.13 + CSS Custom Properties  
**Master Style Sheet**: `public/css/appcenter-theme.css`  

---

## DAFTAR ISI
1. [Arsitektur Design System & Dual-Theme Tokens](#1-arsitektur-design-system--dual-theme-tokens)
2. [Spesifikasi Komponen Kustom Svelte (Component-by-Component Deep Dive)](#2-spesifikasi-komponen-kustom-svelte-component-by-component-deep-dive)
   - 2.1 `CustomSelect.svelte` — Dropdown Pintar dengan Collision Detection
   - 2.2 `CustomCheckbox.svelte` — Checkbox Taktil Multitematik
   - 2.3 `CustomDropdown.svelte` — Dropdown Pemilih Produk Kaya Media
   - 2.4 `SegmentedTabs.svelte` — Tab Navigasi Horizontal dengan Sliding Pill Easing
   - 2.5 `ThemeToggle.svelte` — Tombol Pengalih Tema Dual-Knob Gradient
   - 2.6 `Tooltip.svelte` — Tooltip Mikro-Interaksi Hover
   - 2.7 `Sidebar.svelte` — Navigasi Samping Portal Member dengan Active Dot
   - 2.8 `AdminSidebar.svelte` — Navigasi Samping Admin dengan Accordion Submenu Slide
   - 2.9 `Topbar.svelte` — Header Bar dengan Scoping Help Button & Profil Pill
   - 2.10 `Layout.svelte` & `AdminLayout.svelte` — Shell Tata Letak Responsif
3. [Sistem Animasi, Keyframes, & Kurva Easing](#3-sistem-animasi-keyframes--kurva-easing)
4. [Pedoman Desain & Invariant Komponen UI](#4-pedoman-desain--invariant-komponen-ui)

---

## 1. ARSITEKTUR DESIGN SYSTEM & DUAL-THEME TOKENS

### 1.1 Variabel CSS Global (`public/css/appcenter-theme.css`)
AppCenter V2 beroperasi dengan sistem variabel CSS murni yang merespons perubahan atribut `data-theme` pada elemen root `<html>`:

```css
/* Mode Terang (Light Theme - Default) */
:root, [data-theme="light"] {
  --bg: #f8fafc;
  --surface: #ffffff;
  --surface-2: #f1f5f9;
  --border: #e2e8f0;
  --brand: #2563eb;
  --brand-soft: rgba(37, 99, 235, 0.08);
  --text: #0f172a;
  --text-2: #334155;
  --text-3: #64748b;
  --success: #10b981;
  --warning: #f59e0b;
  --danger: #ef4444;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
}

/* Mode Gelap (Dark Theme - High Contrast Blue/Indigo Cyberdeck) */
[data-theme="dark"] {
  --bg: #070c16;
  --surface: #0c1426;
  --surface-2: #101827;
  --border: #22314d;
  --brand: #3b82f6;
  --brand-soft: rgba(59, 130, 246, 0.12);
  --text: #f8fafc;
  --text-2: #cbd5e1;
  --text-3: #94a3b8;
  --success: #34d399;
  --warning: #fbbf24;
  --danger: #f87171;
  --shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.5);
  --shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.4), 0 2px 4px -1px rgba(0, 0, 0, 0.3);
}
```

---

## 2. SPESIFIKASI KOMPONEN KUSTOM SVELTE (COMPONENT-BY-COMPONENT DEEP DIVE)

### 2.1 `CustomSelect.svelte`
- **Lokasi Berkas**: `client/src/lib/components/CustomSelect.svelte`
- **Tujuan**: Menggantikan elemen native browser `<select>` dengan menu dropdown berperforma tinggi, mendukung sliding pill backdrop, deteksi batas viewport vertikal, dan ikon gambar bank/pilihan.
- **Props**:
  | Nama Prop | Tipe Data | Nilai Default | Deskripsi |
  | :--- | :--- | :--- | :--- |
  | `options` | `OptionItem[]` | `[]` | Array opsi: `{ value, label, description?, warning?, icon? }` |
  | `value` | `number \| string` | `10` | Nilai terpilih aktif (two-way bindable) |
  | `prefix` | `string` | `''` | Label awalan teks (misal: "Urutkan:", "Bank:") |
  | `fullWidth` | `boolean` | `false` | Menyesuaikan lebar 100% container |
- **Event Dispatched**: `dispatch('change', value)` saat opsi dipilih.
- **Fitur Kunci & Logika Algoritmik**:
  1. **Smart Upward Collision Detection**: Saat tombol pemicu diklik, komponen menghitung sisa ruang viewport vertikal melalui `dropdownRef.getBoundingClientRect()`. Jika `spaceBelow < 260px` dan `spaceAbove > spaceBelow`, menu popover otomatis membuka ke atas (`openUpward = true` -> `bottom-full mb-1.5`) sehingga tidak terpotong tepi layar bawah.
  2. **Sliding Pill Indicator**: Posisi `top` dan `height` pill background dihitung secara dinamis dari `optionElements[val].offsetTop` dan `offsetHeight` dengan transisi easing `cubic-bezier(0.16, 1, 0.3, 1)`.
  3. **Auto-Close on Click Outside**: Event listener terdaftar pada `document` saat mount dan dibersihkan di unmount.

---

### 2.2 `CustomCheckbox.svelte`
- **Lokasi Berkas**: `client/src/lib/components/CustomCheckbox.svelte`
- **Tujuan**: Checkbox kustom dengan umpan balik taktil, bebas elemen input checkbox default browser, mendukung aksesibilitas keyboard dan tema warna fleksibel.
- **Props**:
  | Nama Prop | Tipe Data | Nilai Default | Deskripsi |
  | :--- | :--- | :--- | :--- |
  | `checked` | `boolean` | `false` | Status centang aktif (bindable) |
  | `label` | `string` | `''` | Label teks di samping checkbox |
  | `description`| `string` | `''` | Teks keterangan sekunder di bawah label |
  | `disabled` | `boolean` | `false` | Menonaktifkan interaksi |
  | `color` | `'brand' \| 'emerald' \| 'amber' \| 'rose'` | `'brand'` | Pilihan palet warna aksen kotak centang |
- **Event Dispatched**: `dispatch('change', checked)`.
- **Aksesibilitas & Animasi**:
  - Mendukung penekanan tombol `Space` dan `Enter` via handler `handleKeyDown`.
  - Ikon centang SVG memiliki transisi animasi skala `scale-0` ke `scale-100` berdurasi 200ms.

---

### 2.3 `CustomDropdown.svelte`
- **Lokasi Berkas**: `client/src/lib/components/CustomDropdown.svelte`
- **Tujuan**: Menu dropdown khusus pemilihan produk software yang kaya media pada form checkout, trial generator, dan modal.
- **Props**:
  | Nama Prop | Tipe Data | Nilai Default | Deskripsi |
  | :--- | :--- | :--- | :--- |
  | `items` | `DropdownItem[]`| `[]` | Daftar produk: `{ id, name, price, image, active_users }` |
  | `selectedId` | `number` | `0` | ID produk terpilih |
  | `disabled` | `boolean` | `false` | Kunci interaksi |
  | `loading` | `boolean` | `false` | Menampilkan spinner loading state |
- **Fitur Kunci**:
  - **Live Debounced Search Filter**: Menyediakan input pencarian instan di dalam popup menu.
  - **Fallback Gambar Terproteksi (`brokenImgMap`)**: Jika gambar produk gagal dimuat (error 404), komponen otomatis merender kotak inisial avatar gradien yang rapi.
  - **Currency Formatter**: Mengonversi angka ke format Rupiah standar (`Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' })`).

---

### 2.4 `SegmentedTabs.svelte`
- **Lokasi Berkas**: `client/src/lib/components/SegmentedTabs.svelte`
- **Tujuan**: Kontrol filter tab horizontal dengan sliding pill indicator yang meluncur mulus mengikuti tab aktif.
- **Props**:
  | Nama Prop | Tipe Data | Nilai Default | Deskripsi |
  | :--- | :--- | :--- | :--- |
  | `tabs` | `TabItem[]` | `[]` | Array tab: `{ id, label, count?, color? }` |
  | `activeTab`| `string` | `''` | ID tab aktif (bindable) |
- **Event Dispatched**: `dispatch('change', activeTab)` dan `dispatch('tabChange', activeTab)`.
- **Logika Penyelarasan Pill**:
  - Dilengkapi integrasi `ResizeObserver` untuk mendeteksi perubahan lebar container atau font web (`document.fonts.ready`), mencegah pill backdrop meleset saat window di-resize.
  - Kurva transisi: `transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]`.

---

### 2.5 `ThemeToggle.svelte`
- **Lokasi Berkas**: `client/src/lib/components/ThemeToggle.svelte`
- **Tujuan**: Tombol switch pengalih tema Dark/Light mode dengan hierarki visual kontras tinggi dan slider dua knob.
- **Mekanisme Kerja**:
  - **Mode Gelap Aktif**: Knob slider kanan menyala dengan gradien biru-indigo vibran (`linear-gradient(135deg, #3b82f6, #6366f1)`), glow shadow halus (`box-shadow: 0 0 12px rgba(99, 102, 241, 0.4)`), dan icon Bulan putih bersih. Icon Matahari kiri diredupkan (`opacity: 0.4`).
  - **Mode Terang Aktif**: Knob slider kiri menyala putih bersih beraksen amber (`#ffffff` + border/glow `#f59e0b`), icon Bulan kanan diredupkan (`opacity: 0.4`).
  - Nilai tema disinkronkan secara reaktif dengan Svelte store `theme` (`client/src/lib/stores/theme.ts`) dan disimpan ke `localStorage.getItem('appcenter_theme')`.

---

### 2.6 `Tooltip.svelte`
- **Lokasi Berkas**: `client/src/lib/components/Tooltip.svelte`
- **Tujuan**: Menampilkan petunjuk kontekstual ringkas saat kursor diarahkan ke tombol aksi atau ikon status dengan posisi responsif (top, bottom, left, right).

---

### 2.7 `Sidebar.svelte` (Member Portal Navigation)
- **Lokasi Berkas**: `client/src/lib/components/Sidebar.svelte`
- **Tujuan**: Navigasi utama member area dengan sliding pill indicator, moving active dot, mobile responsive drawer, dan widget promosi Tools Gratis.
- **Invariant**:
  - Label teks navigasi (`white-space: nowrap`) dilarang turun ke baris kedua.
  - Titik putih aktif (`.sidebar-active-dot`) bergerak menyatu di dalam pill backdrop biru saat berpindah menu.

---

### 2.8 `AdminSidebar.svelte` (Admin Panel Navigation)
- **Lokasi Berkas**: `client/src/lib/components/AdminSidebar.svelte`
- **Tujuan**: Pusat kendali navigasi administrator dengan multi-open accordion submenu (Produk & Affiliate Management) yang transisinya beranimasi halus via Svelte `slide` transition.
- **Fitur Khusus**:
  - **Multi-Open Accordion State Retention**: Status terbukanya submenu disimpan di `localStorage` (`admin_sidebar_products`, `admin_sidebar_affiliate`), sehingga tidak saling menutup saat pengguna membuka submenu lain.
  - **Akses Cepat Console**: Tautan langsung ke portal member dengan indikator status hijau pulsating dot.
  - **Footer Profil Admin Interaktif**: Klik pada avatar footer langsung mengarahkan ke `#/admin/profile`.

---

### 2.9 `Topbar.svelte`
- **Lokasi Berkas**: `client/src/lib/components/Topbar.svelte`
- **Tujuan**: Header atas aplikasi yang menampilkan judul halaman dinamis, breadcrumb, tombol bantuan, pengalih tema, dan profile dropdown.
- **Invariant Khusus**:
  - Tombol **Help / Pusat Bantuan & Tutorial** (`showHelp = true`) HANYA diizinkan muncul pada Member area dan DILARANG MUNCUL pada halaman Admin (`showHelp = false`).
  - Ikon Help distandarisasikan menggunakan icon SVG resmi *Question Mark Circle* (`question-mark-circle`).

---

### 2.10 `Layout.svelte` & `AdminLayout.svelte`
- **Lokasi Berkas**: `client/src/lib/components/Layout.svelte`, `client/src/lib/components/AdminLayout.svelte`
- **Tujuan**: Wrapper tata letak utama yang membungkus sidebar, topbar, dan area konten utama dengan scrollbar terisolasi, backdrop blur, dan responsive padding (mobile `p-3 sm:p-4`, desktop `md:p-6 lg:p-8`).

---

## 3. SISTEM ANIMASI, KEYFRAMES, & KURVA EASING

```css
/* 1. Animasi Levitation 3D Hero Centerpiece */
@keyframes heroFloat {
  0%, 100% {
    transform: translateY(0px) rotate(8deg);
  }
  50% {
    transform: translateY(-8px) rotate(8deg);
  }
}

/* 2. Dropdown Spring Drop-In */
@keyframes dropInSpring {
  0% {
    opacity: 0;
    transform: translateY(-6px) scale(0.98);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* 3. Scale-In Check Icon */
@keyframes scaleInCheck {
  0% {
    opacity: 0;
    transform: scale(0.6);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

/* 4. Pulsating Status Dot */
@keyframes pulseDot {
  0%, 100% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.4;
    transform: scale(0.85);
  }
}
```

---

## 4. PEDOMAN DESAIN & INVARIANT KOMPONEN UI

1. **Zero Native Form Elements Invariant**: Wajib selalu menggunakan `CustomSelect`, `CustomCheckbox`, `CustomDropdown`, dan `SegmentedTabs` alih-alih elemen native `<select>` atau checkbox HTML polos.
2. **Sidebar Single-Line Invariant**: Teks label menu sidebar wajib `white-space: nowrap`, `gap: 10px`, dan item margin dinormalisasi `margin: 4px 0`.
3. **Contrast Compliance Invariant**: Seluruh teks status badge (Lunas, Belum Diset, Gratis, Expired) wajib memiliki kontras tajam di tema terang maupun gelap.
4. **Lifecycle Timer Cleanup**: Setiap komponen yang menggunakan `setTimeout` atau listener window wajib membersihkan handle timer pada hook `onDestroy` Svelte.
