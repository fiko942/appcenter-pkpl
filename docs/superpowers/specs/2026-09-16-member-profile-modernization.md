# Spec: Modernisasi & Elevasi Halaman Profil Member (Profile.svelte)

## 1. Background & Tujuan
Halaman Profil Member (`#/member/profile`) sebelumnya memiliki beberapa inkonsistensi desain dan 'AI tropes':
- Duplikasi tema warna (kartu data diri bernuansa biru, kartu password bernuansa amber).
- Asimetri tinggi pada layout 2-kolom desktop (kartu kiri 4 field, kartu kanan 3 field) sehingga tombol aksi kanan mengambang canggung.
- Redundansi ikon dan badge gembok pada field email.
- Mobile scroll fatigue di mana pengguna harus menggulir sangat jauh (>1800px) untuk mengakses pengaturan password.
- Ketiadaan validasi kekuatan password dan match checker secara real-time.

## 2. Solusi Desain (ui-ux-pro-max)
1. **Header Profil Modern**:
   - Avatar inisial dengan status ring verifikasi emerald dan badge level "Member Aktif".
   - Metadata pengguna terintegrasi (email dengan status permanen, tanggal bergabung).
   - Quick stat capsules terpadu untuk total pesanan dan total lisensi.
2. **Sliding Pill Tab Switcher**:
   - Navigasi tab geser halus 2-segment (`[ 👤 Informasi Profil | 🔒 Keamanan & Password ]`) dengan fisika `cubic-bezier(0.16,1,0.3,1)` berkecepatan 300ms.
   - Mengatasi asimetri tinggi pada desktop dan mengeliminasi scroll fatigue pada mobile.
3. **Form Input Ergonomis & Prefiks Ikon**:
   - Setiap input memiliki ikon kontekstual (User, Locked Mail, Phone/WA, Building, Lock/Key).
   - Standardisasi tema warna biru konsisten (`blue-600` brand token).
4. **Live Password Security & Match Indicators**:
   - Real-time validation checklist (Panjang minimal 6 karakter, Konfirmasi password sesuai, Berbeda dari password saat ini).
   - Badge status interaktif ("✔ Cocok", "✕ Tidak Cocok", "Min 6 char").
5. **Standardized Layout Wrapper**:
   - `<Layout activePage="profile" eyebrow="PROFIL AKUN & KEAMANAN">`
   - `<main class="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-12">`
