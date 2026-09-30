# Plan: Modernisasi & Elevasi Halaman Profil Member (Profile.svelte)

## Implementation Steps
1. [x] Audit UI/UX mendalam pada halaman Profile desktop dan mobile dengan `browser-skill`.
2. [x] Refactor `Profile.svelte` dengan:
   - Header profil terpadu dengan status ring & capsule stats.
   - Sliding pill tab switcher (`activeTab = 'info' | 'security'`).
   - Form Data Profil dengan input prefix icons dan email immutable styling.
   - Form Keamanan & Password dengan live validation and confirmation match checker.
   - Penyelarasan wrapper layout `<main class="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-12">`.
3. [x] Verifikasi kompilasi frontend (`pnpm run build`).
4. [x] Verifikasi browser headless di Desktop ($1440\times900$) dan Mobile ($490\times543$).
5. [x] Update snapshots dan sinkronisasi ke remote branch `reborn`.
