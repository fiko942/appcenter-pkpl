# Implementation Plan: Update FAQ Device Transfer Steps Based on AppCenter Member Area Reality

## Real Member Flow in `Licenses.svelte`:
In the member portal:
1. User logs in to **Portal Member** and goes to the **Lisensi Saya** menu.
2. User clicks the **Ubah Machine ID (Perangkat)** button on the license card.
3. User opens the application on their new PC/Laptop to get the new Machine ID.
4. User pastes the new Machine ID into the modal in Member Portal and confirms the change.
5. The license is immediately activated on the new computer (with a generous limit of 3x per day and 1 active computer at a time).

## Proposed Clean FAQ Update in `LandingPage.svelte`:
- **Question**: `Bagaimana cara memindahkan lisensi jika saya berganti PC atau Laptop?`
- **Detailed Step-by-Step Answer**:
  "Anda dapat memindahkan lisensi ke laptop atau komputer baru secara mandiri tanpa perlu bantuan admin. Langkahnya:"
  1. Buka aplikasi di PC/Laptop baru untuk melihat **Machine ID** perangkat baru Anda.
  2. Masuk ke **Portal Member**, lalu buka menu **Lisensi Saya**.
  3. Klik tombol **Ubah Machine ID** pada lisensi yang ingin dipindahkan.
  4. Masukkan Machine ID baru dan klik Simpan. Lisensi langsung aktif di perangkat baru seketika.

## Verification:
- Check `pnpm run build` (Exit code 0).
