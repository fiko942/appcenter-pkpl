# Implementation Plan: About Section (Tentang Ziqva Labs) - Sejak 2022, Bagian dari Kampung Songo

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement a modern, high-contrast, narrative-driven "Tentang Kami" (About Us) section between the Affiliate Section (`#affiliate`) and the FAQ Section (`#faq`) on the Landing Page (`LandingPage.svelte`), and synchronize navbar/footer navigation across the entire web ecosystem (`PublicNavbar.svelte`, `PublicFooter.svelte`, `LandingPage.svelte`).

## Narrative & Brand Heritage:
- **Entitas:** Ziqva Labs (tim & anak cabang inovasi teknologi yang dibangun oleh **Kampung Songo**).
- **Didirikan:** Sejak tahun **2022**.
- **Evolusi & Perjalanan Produk:**
  1. **2022 (Awal Mula):** Dikembangkan khusus untuk membantu efisiensi dan eliminasi kerja manual pelaku usaha **Dropshipper**.
  2. **2023 - 2024 (Ekspansi Kreator):** Berkembang menyediakan otomatisasi bagi para **Afiliator** dan **YouTuber / Content Creator** (video workflow, scrap, & otomatisasi upload).
  3. **2025 - 2026 (Era AI & Modern Marketplace):** Berekspansi mendukung para **AI Enthusiast & Praktisi Otomatisasi**, dilengkapi proteksi lisensi fleksibel, transfer mandiri, dan prinsip *Privacy-First* (data tersimpan 100% lokal).

## Architecture & Layout Design:
- **Location:** Placed directly after `#affiliate` and before `#faq`.
- **Visual Design:**
  - Header: Kicker badge (`SEJAK 2022 • BAGIAN DARI KAMPUNG SONGO`), title with blue-cyan gradient, and human-friendly intro.
  - Asymmetrical Story Bento Grid (3 Pillars of Evolution):
    - **Card 1 (2022 - Fondasi Dropshipper):** "Lahir dari Kebutuhan Riil Lapangan" - Solusi awal untuk pegiat e-commerce dan dropshipper.
    - **Card 2 (2023-2024 - Era Afiliator & YouTuber):** "Ekspansi Otomatisasi Konten & Traffic" - Menjawab kebutuhan kreator dan affiliate marketer.
    - **Card 3 (2025-2026 - AI Enthusiast & Ekosistem Modern):** "Otomatisasi Cerdas & Privasi Mandiri" - Bot cerdas berarsitektur lokal tanpa server cloud.
  - **Company Identity Banner / Trust Footer Box:** Info badge kolaborasi resmi *Kampung Songo & Ziqva Labs* dengan uptime & stats.
- **Scroll-Driven Animation:** Integration with `use:viewportReveal` for replayable scroll triggers.
- **Navigation Sync:**
  - `LandingPage.svelte`: Add `{ id: 'about', label: 'Tentang Kami' }` to `navLinks`.
  - `PublicNavbar.svelte`: Add `Tentang Kami` button navigating to `/#about`.
  - `PublicFooter.svelte`: Add `Tentang Kami` button under "Navigasi Utama".

**Tech Stack:** Svelte 4, Tailwind CSS, TypeScript.

---

### Task 1: Add About Section to `LandingPage.svelte`
**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte`

- [ ] **Step 1: Update `navLinks` in `LandingPage.svelte` to include `{ id: 'about', label: 'Tentang Kami' }`**
- [ ] **Step 2: Add Section 5.5 `#about` with rich storytelling bento grid and visual timeline cards**

---

### Task 2: Sync Navigation in `PublicNavbar.svelte` and `PublicFooter.svelte`
**Files:**
- Modify: `client/src/lib/components/PublicNavbar.svelte`
- Modify: `client/src/lib/components/PublicFooter.svelte`

- [ ] **Step 1: Add `Tentang Kami` button to desktop and mobile menus in `PublicNavbar.svelte`**
- [ ] **Step 2: Add `Tentang Kami` button under Navigasi Utama in `PublicFooter.svelte`**

---

### Task 3: Build Verification & Dual-Theme Review
**Files:**
- Run: `pnpm run build`
- Git Commit & Push to `origin/reborn`
