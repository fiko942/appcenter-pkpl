# Human-Centric Language & FAQ Step-by-Step Polish Plan

## Classification: Bounded
A well-scoped refinement of copy, terminology, and FAQ instructions in `LandingPage.svelte` to remove overly technical jargon ("HWID", "Zero Lock-in Policy", "Auto-Provisioning Webhook", "Low CPU Footprint", "Portal Administrator") and replace them with natural, human-friendly Indonesian terms anyone can understand.

## Detailed Plan:

### 1. Remove "Portal Administrator" from Public Footer
- In `LandingPage.svelte` footer, remove `<li>Portal Administrator</li>` so public visitors only see Member Login and Register.

### 2. Overhaul FAQ Item 2 & 3 (Device Transfer & OS Reinstall):
- Update FAQ Answer 2 ("Apakah lisensi bisa dipindahkan ke komputer lain?") with exact 4-step instructions:
  1. Login ke akun Anda di **Portal Member**.
  2. Buka menu **Lisensi Saya** dan pilih lisensi yang ingin dipindahkan.
  3. Klik tombol **Pindahkan Perangkat** untuk melepas lisensi dari PC lama.
  4. Buka aplikasi di PC/Laptop baru dan masukkan serial key Anda. Lisensi langsung aktif seketika.
- Update FAQ Answer 3 ("Bagaimana jika komputer saya rusak atau install ulang OS?"):
  - Sampaikan dengan ramah bahwa serial key tersimpan aman di akun member dan dapat diaktifkan kembali tanpa perlu beli ulang.

### 3. Humanize Technical Jargon Across Features & Cards:
- `Zero Lock-in Policy` -> `Bisa Dipindahkan Kapan Saja`
- `Low CPU & RAM Footprint` -> `Ringan & Tidak Bikin Komputer Lemot`
- `Auto-Provisioning Webhook` -> `Serial Key Otomatis Terbit`
- `Hotfix In-App Patching` -> `Update Otomatis Tanpa Instal Ulang`
- `Proteksi HWID SHA-256` -> `Proteksi Keamanan Lisensi Resmi`
- `Single Machine Locking Policy` -> `Gunakan di 1 Komputer Aktif`
- `Self-Service Machine Re-bind` -> `Pindah Perangkat Secara Mandiri`

## Verification:
- Run `pnpm run build` (Exit code 0).
