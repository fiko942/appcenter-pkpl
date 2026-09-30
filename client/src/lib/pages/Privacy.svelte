<script lang="ts">
    import { push } from 'svelte-spa-router';
    import PublicNavbar from '../components/PublicNavbar.svelte';
    import PublicFooter from '../components/PublicFooter.svelte';
    import { onMount } from 'svelte';

    onMount(() => {
        window.scrollTo(0, 0);
    });

    function scrollToSection(id: string) {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
</script>

<svelte:head>
    <title>Kebijakan Privasi & Kedaulatan Data - Ziqva Labs</title>
</svelte:head>

<div class="min-h-screen bg-[var(--page)] text-[var(--text)] transition-colors duration-300 flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-500">
    <!-- Navbar Header with Top Announcement Bar -->
    <PublicNavbar activePage="privacy" />

    <!-- Main Content Container -->
    <main class="max-w-5xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full space-y-10">
        <!-- Page Title Header -->
        <div class="space-y-4 border-b border-[var(--border)] pb-8">
            <div class="flex flex-wrap items-center gap-2.5">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                    KEBIJAKAN RESMI PRIVASI DATA
                </span>
                <span class="text-xs text-[var(--text-3)] font-mono">REF: DOC-ZL-PRIV-2026</span>
            </div>
            
            <h1 class="text-2xl sm:text-4xl font-black tracking-tight text-[var(--text)] leading-tight">
                Kebijakan Privasi & Kedaulatan Data Lokal
            </h1>
            
            <p class="text-sm sm:text-base text-[var(--text-2)] leading-relaxed">
                Pembaruan Terakhir: <strong class="text-[var(--text)]">30 Agustus 2026</strong>. Ziqva Labs memprioritaskan keamanan privasi Anda melalui prinsip kedaulatan data: <strong class="text-[var(--text)]">Zero Cloud Bot Storage</strong> (seluruh data operasional bot tersimpan 100% lokal di komputer Anda).
            </p>
        </div>

        <!-- Symmetrical Data Sovereignty Comparison (2 Columns Clean) -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
            <!-- Card 1: 100% Local Data (Green Accent) -->
            <div class="bg-[var(--surface-1)] border border-emerald-500/30 rounded-2xl p-6 space-y-4 shadow-xs">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    </div>
                    <div>
                        <h2 class="text-sm sm:text-base font-bold text-[var(--text)]">Tersimpan 100% Lokal di PC Anda</h2>
                        <span class="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Zero Cloud Bot Storage</span>
                    </div>
                </div>

                <ul class="space-y-2 text-xs text-[var(--text-2)]">
                    <li class="flex items-start gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                        <span>Akun TikTok, YouTube, Google, & Marketplace yang dimasukkan ke software desktop.</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                        <span>Cookie login, session cache, token autentikasi, dan riwayat upload video otomatis.</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                        <span>File konten, video rendering, gambar produk, dan konfigurasi database automasi lokal (SQLite / userData).</span>
                    </li>
                </ul>
            </div>

            <!-- Card 2: Server-Side Data (Blue Accent) -->
            <div class="bg-[var(--surface-1)] border border-blue-500/30 rounded-2xl p-6 space-y-4 shadow-xs">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" /></svg>
                    </div>
                    <div>
                        <h2 class="text-sm sm:text-base font-bold text-[var(--text)]">Data Akun di Server Resmi</h2>
                        <span class="text-xs font-semibold text-blue-600 dark:text-blue-400">Enkripsi & Manajemen Lisensi</span>
                    </div>
                </div>

                <ul class="space-y-2 text-xs text-[var(--text-2)]">
                    <li class="flex items-start gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                        <span>Alamat email terdaftar dan kata sandi terenkripsi (Salted Hash).</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                        <span>Kode lisensi (serial key), status langganan, dan Machine ID.</span>
                    </li>
                    <li class="flex items-start gap-2">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 shrink-0"></span>
                        <span>Nomor rekening bank terdaftar khusus mitra afiliasi.</span>
                    </li>
                </ul>
            </div>
        </div>

        <!-- Quick Jump Navigation Index -->
        <div class="space-y-2.5">
            <span class="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider block">Daftar Isi Kebijakan Privasi:</span>
            <div class="flex flex-wrap gap-2">
                <button on:click={() => scrollToSection('priv-1')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">1. Data yang Dikumpulkan</button>
                <button on:click={() => scrollToSection('priv-2')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">2. Kedaulatan & Backup</button>
                <button on:click={() => scrollToSection('priv-3')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">3. Keamanan Sandi & Finansial</button>
                <button on:click={() => scrollToSection('priv-4')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">4. Hak Akses & Anti-Spam</button>
            </div>
        </div>

        <!-- Privacy Articles (Symmetrical Grid & Document Standard) -->
        <div class="space-y-6 text-sm text-[var(--text-2)] leading-relaxed">
            <!-- Article 1 -->
            <section id="priv-1" class="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Informasi yang Kami Kumpulkan & Tujuannya
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Ziqva Labs hanya mengumpulkan informasi yang esensial untuk mengoperasikan layanan platform dan memverifikasi keabsahan lisensi software Anda:
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
                        <div class="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                            <strong class="text-[var(--text)] block font-bold">Informasi Akun</strong>
                            <p class="text-[var(--text-3)]">Nama lengkap dan email aktif untuk autentikasi login serta penerbitan lisensi.</p>
                        </div>
                        <div class="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                            <strong class="text-[var(--text)] block font-bold">Catatan Transaksi</strong>
                            <p class="text-[var(--text-3)]">ID pesanan, status pembayaran gateway, dan tanggal aktif masa berlangganan.</p>
                        </div>
                        <div class="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                            <strong class="text-[var(--text)] block font-bold">Identifikasi Machine ID</strong>
                            <p class="text-[var(--text-3)]">Identifier unik hardware PC Anda untuk memastikan lisensi aktif pada 1 perangkat.</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Article 2 -->
            <section id="priv-2" class="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Kedaulatan Data Lokal & Tanggung Jawab Cadangan (Backup)
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Software bot Ziqva Labs beroperasi secara mandiri di komputer Anda. Seluruh file pengaturan, session cookies akun media sosial, file video, dan histori scraping tidak pernah dikirimkan ke server Ziqva Labs demi menjamin privasi absolut.
                    </p>
                    <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs text-[var(--text-2)] flex items-start gap-3">
                        <svg class="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        <div>
                            <strong class="text-[var(--text)] block mb-0.5">Pentingnya Cadangan Mandiri:</strong>
                            Karena data bot tidak disimpan di cloud, kami sangat menyarankan pengguna untuk mencadangkan (<em>backup</em>) folder data bot dan file lisensi secara berkala ke flashdisk atau cloud pribadi Anda guna mengantisipasi kerusakan komputer.
                        </div>
                    </div>
                </div>
            </section>

            <!-- Article 3 -->
            <section id="priv-3" class="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Keamanan Kata Sandi & Pembayaran
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Kami menerapkan standar industri ketat untuk melindungi keamanan akun dan privasi transaksi Anda:
                    </p>
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs pt-1">
                        <div class="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                            <strong class="text-[var(--text)] block font-bold">Enkripsi Salted Hash</strong>
                            <p class="text-[var(--text-3)]">Kata sandi akun Anda tidak pernah disimpan dalam bentuk teks biasa.</p>
                        </div>
                        <div class="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                            <strong class="text-[var(--text)] block font-bold">Payment Gateway Berizin BI</strong>
                            <p class="text-[var(--text-3)]">Proses transaksi QRIS dan Virtual Account dilakukan melalui server bank resmi.</p>
                        </div>
                        <div class="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                            <strong class="text-[var(--text)] block font-bold">Tanpa Data Kartu Kredit</strong>
                            <p class="text-[var(--text-3)]">Kami tidak menyimpan nomor kartu kredit atau detail pembayaran sensitif pengguna.</p>
                        </div>
                    </div>
                </div>
            </section>

            <!-- Article 4 -->
            <section id="priv-4" class="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Hak Pengguna & Komitmen Anti Jual-Beli Data
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Ziqva Labs berkomitmen penuh untuk <strong class="text-[var(--text)]">tidak akan pernah menjual, menyewakan, atau membagikan data pribadi pengguna kepada pihak ketiga mana pun</strong> untuk tujuan periklanan atau monetisasi data.
                    </p>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                        <div class="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                            <span><strong>Akses Mandiri:</strong> Melihat riwayat serial key dan invoice kapan saja di Member Area.</span>
                        </div>
                        <div class="flex items-start gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)]">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0"></span>
                            <span><strong>Bebas Pindah Device:</strong> Memindahkan lisensi ke komputer baru secara mandiri 24/7.</span>
                        </div>
                    </div>
                </div>
            </section>
        </div>

        <!-- Official Seal Banner -->
        <div class="p-6 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] text-center space-y-3 shadow-xs">
            <div class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                KOMITMEN KEDAULATAN DATA ZIQVA LABS
            </div>
            <p class="text-xs text-[var(--text-2)] max-w-xl mx-auto leading-relaxed">
                Kami percaya bahwa alat produktivitas terbaik adalah alat yang menghormati privasi dan kedaulatan data penggunanya secara penuh.
            </p>
            <div class="pt-2 flex justify-center gap-3">
                <button on:click={() => push('/')} class="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm shadow-emerald-500/20">
                    Kembali ke Beranda
                </button>
                <button on:click={() => push('/terms')} class="px-5 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] text-xs font-bold transition-all cursor-pointer border border-[var(--border)]">
                    Baca Syarat & Ketentuan
                </button>
            </div>
        </div>
    </main>

    <!-- Unified Footer -->
    <PublicFooter />
</div>
