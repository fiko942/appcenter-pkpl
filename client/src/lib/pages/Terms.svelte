<script lang="ts">
    import { push } from 'svelte-spa-router';
    import PublicNavbar from '../components/PublicNavbar.svelte';
    import PublicFooter from '../components/PublicFooter.svelte';
    import { onMount } from 'svelte';

    onMount(() => {
        window.scrollTo(0, 0);
    });

    function scrollToClause(id: string) {
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }
</script>

<svelte:head>
    <title>Syarat & Ketentuan Layanan - Ziqva Labs</title>
</svelte:head>

<div class="min-h-screen bg-[var(--page)] text-[var(--text)] transition-colors duration-300 flex flex-col justify-between selection:bg-blue-500/20 selection:text-blue-500">
    <!-- Navbar Header with Top Announcement Bar -->
    <PublicNavbar activePage="terms" />

    <!-- Main Content Container -->
    <main class="max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 w-full space-y-10">
        <!-- Page Title Header -->
        <div class="space-y-4 border-b border-[var(--border)] pb-8">
            <div class="flex flex-wrap items-center gap-2.5">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    DOKUMEN HUKUM RESMI
                </span>
                <span class="text-xs text-[var(--text-3)] font-mono">REF: DOC-ZL-TOS-2026</span>
            </div>
            
            <h1 class="text-2xl sm:text-4xl font-black tracking-tight text-[var(--text)] leading-tight">
                Syarat & Ketentuan Layanan
            </h1>
            
            <p class="text-sm sm:text-base text-[var(--text-2)] leading-relaxed">
                Pembaruan Terakhir: <strong class="text-[var(--text)]">30 Agustus 2026</strong>. Dokumen ini memuat ketentuan resmi yang mengatur hak penggunaan software bot otomatisasi, manajemen lisensi, dan layanan Ziqva Labs.
            </p>

            <!-- Quick Summary Notice Box -->
            <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-[var(--text-2)] flex items-start gap-3 leading-relaxed">
                <svg class="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                <div>
                    <strong class="text-[var(--text)] block mb-0.5">Ringkasan Singkat:</strong>
                    Dengan mengakses dan memesan software di Ziqva Labs, Anda mendapatkan lisensi penggunaan resmi yang fleksibel (bebas dipindahkan ke PC/Laptop baru kapan saja melalui Member Area), aktivasi 24/7 otomatis, dan pembaruan berkala.
                </div>
            </div>
        </div>

        <!-- Quick Jump Navigation Index -->
        <div class="space-y-2.5">
            <span class="text-xs font-bold text-[var(--text-3)] uppercase tracking-wider block">Daftar Isi Ketentuan:</span>
            <div class="flex flex-wrap gap-2">
                <button on:click={() => scrollToClause('clause-1')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">1. Hak Lisensi & Durasi</button>
                <button on:click={() => scrollToClause('clause-2')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">2. Pindah Perangkat</button>
                <button on:click={() => scrollToClause('clause-3')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">3. Pembayaran & Aktivasi</button>
                <button on:click={() => scrollToClause('clause-4')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">4. Kebijakan No Refund</button>
                <button on:click={() => scrollToClause('clause-5')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">5. Update & Tutorial</button>
                <button on:click={() => scrollToClause('clause-6')} class="px-3 py-1.5 rounded-lg bg-[var(--surface-1)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold transition-colors cursor-pointer">6. Larangan Penggunaan</button>
            </div>
        </div>

        <!-- Terms Clauses -->
        <div class="space-y-6 text-sm text-[var(--text-2)] leading-relaxed">
            <!-- Clause 1 -->
            <section id="clause-1" class="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">1</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Hak Lisensi & Ketentuan Berlangganan
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Setiap transaksi lisensi memberikan hak non-eksklusif kepada pengguna untuk mengoperasikan software bot pada sistem operasi yang didukung (Windows atau macOS) sesuai paket masa aktif yang dipilih (<strong>2 Bulan</strong>, <strong>4 Bulan</strong>, atau <strong>6 Bulan</strong>).
                    </p>
                    <p>
                        Satu kode lisensi (serial key) aktif berlaku untuk <strong>1 (satu) komputer aktif dalam satu waktu</strong> guna menjamin stabilitas kinerja software dan perlindungan akun Anda.
                    </p>
                </div>
            </section>

            <!-- Clause 2 -->
            <section id="clause-2" class="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">2</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Kebebasan Memindahkan Lisensi (Ganti Perangkat)
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Ziqva Labs memberlakukan kebijakan lisensi fleksibel (<em>Zero Lock-in</em>). Jika Anda mengganti komputer, membeli laptop baru, atau melakukan install ulang sistem operasi, Anda dapat memindahkan lisensi secara mandiri 24/7 tanpa perlu persetujuan admin.
                    </p>
                    <div class="p-4 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                        <strong class="text-xs font-bold text-[var(--text)] block">Alur Perpindahan Mandiri:</strong>
                        <ol class="list-decimal list-inside space-y-1 text-xs">
                            <li>Buka software di laptop baru untuk menyalin <strong>Machine ID</strong> baru.</li>
                            <li>Login ke <strong>Portal Member</strong> &gt; pilih menu <strong>Lisensi Saya</strong>.</li>
                            <li>Klik tombol <strong>Ubah Machine ID</strong> dan simpan Machine ID baru Anda.</li>
                            <li>Software di perangkat baru langsung aktif seketika.</li>
                        </ol>
                    </div>
                </div>
            </section>

            <!-- Clause 3 -->
            <section id="clause-3" class="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">3</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Pembayaran Resmi & Aktivasi Instan
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Seluruh transaksi pembayaran diproses secara aman melalui payment gateway resmi berizin Bank Indonesia (QRIS otomatis, GoPay, DANA, OVO, Virtual Account BCA, Mandiri, BRI, BNI).
                    </p>
                    <p>
                        Sistem bekerja otomatis 24/7. Setelah transaksi berhasil, serial key dan akses download installer langsung tersedia di Member Area tanpa perlu konfirmasi bukti transfer manual.
                    </p>
                </div>
            </section>

            <!-- Clause 4: No Refund Policy & Discretionary Replacement -->
            <section id="clause-4" class="bg-[var(--surface-1)] border border-amber-500/30 dark:border-amber-500/20 rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center text-xs font-bold shrink-0">4</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Kebijakan Pengembalian Dana (No-Refund Policy) & Penyesuaian Lisensi
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Seluruh transaksi pembelian software di Ziqva Labs bersifat <strong>final, mutlak, dan mengikat</strong>. Setelah pembayaran lunas dan kode lisensi digital (serial key) diterbitkan oleh sistem, <strong>tidak ada toleransi pengembalian dana (uang kembali) dalam bentuk apa pun</strong>.
                    </p>
                    <div class="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2.5 text-xs">
                        <strong class="text-amber-700 dark:text-amber-400 font-bold block">1. Ketentuan Penolakan Pengembalian Dana (No Refund):</strong>
                        <ul class="list-disc list-inside space-y-1.5 text-[var(--text-2)]">
                            <li><strong>Kesalahan Pengguna:</strong> Permintaan refund akibat salah memilih produk software, salah memilih durasi paket lisensi, keliru memasukkan kupon promo, atau salah input data akun akan <strong>ditolak sepenuhnya</strong>. Uang yang telah dibayarkan tidak dapat dikembalikan.</li>
                            <li><strong>Produk Digital Terbit:</strong> Mengingat produk berupa hak akses software digital dan serial key yang langsung aktif secara instan 24/7, transaksi yang telah berstatus lunas tidak dapat dibatalkan atau ditarik kembali.</li>
                            <li><strong>Ketidakcocokan Perangkat:</strong> Pengguna wajib membaca spesifikasi sistem operasi (Windows / macOS) sebelum menyelesaikan pembayaran.</li>
                        </ul>
                    </div>

                    <div class="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20 space-y-2 text-xs">
                        <strong class="text-blue-700 dark:text-blue-400 font-bold block">2. Toleransi Kebijakan Penyesuaian Lisensi (Non-Cash):</strong>
                        <p class="text-[var(--text-2)] leading-relaxed">
                            Meskipun pengembalian dana dalam bentuk uang tunai/saldo ditolak mutlak, manajemen Ziqva Labs dapat memberikan toleransi berupa <strong>penerbitan ulang serial key, penggantian lisensi ke produk lain yang setara nilainya, atau penyesuaian masa aktif lisensi</strong>, dengan syarat:
                        </p>
                        <ul class="list-disc list-inside space-y-1 text-[var(--text-2)]">
                            <li>Pengguna melampirkan <strong>bukti konkret dan valid</strong> (nomor invoice resmi, screenshot kendala, dan riwayat pesanan).</li>
                            <li>Permintaan diajukan maksimal 1x24 jam sejak transaksi dan telah disetujui oleh tim verifikasi teknis Ziqva Labs.</li>
                            <li>Pengajuan tanpa bukti pendukung yang jelas dan valid akan langsung ditolak.</li>
                        </ul>
                    </div>
                </div>
            </section>

            <!-- Clause 5 -->
            <section id="clause-5" class="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-xs font-bold shrink-0">5</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Pembaruan Software & Modul Video Tutorial
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Pengguna berhak menerima pembaruan software (<em>in-app auto-update</em>) selama masa aktif lisensi masih berlaku. Pembaruan meliputi penyesuaian algoritma platform pihak ketiga, perbaikan performa, dan penambahan fitur baru.
                    </p>
                    <p>
                        Setiap produk dilengkapi modul video panduan instalasi dan penggunaan yang dapat diakses kapan saja melalui portal member resmi.
                    </p>
                </div>
            </section>

            <!-- Clause 6 -->
            <section id="clause-6" class="bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 space-y-4 shadow-xs scroll-mt-24">
                <div class="flex items-center gap-3">
                    <span class="w-7 h-7 rounded-lg bg-red-600/10 text-red-600 dark:text-red-400 flex items-center justify-center text-xs font-bold shrink-0">6</span>
                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)]">
                        Batasan Penggunaan & Kebijakan Anti-Pembajakan
                    </h2>
                </div>
                <div class="space-y-3 pl-0 sm:pl-10">
                    <p>
                        Pengguna dilarang keras melakukan rekayasa balik (<em>reverse engineering</em>), dekompilasi binary aplikasi, mendistribusikan ulang file installer tanpa izin, atau memperjualbelikan serial key kepada pihak ketiga di luar program kemitraan afiliasi resmi Ziqva Labs.
                    </p>
                    <p>
                        Pelanggaran terhadap ketentuan ini dapat mengakibatkan penonaktifan lisensi secara permanen tanpa pengembalian dana (<em>refund</em>).
                    </p>
                </div>
            </section>
        </div>

        <!-- Official Seal Banner -->
        <div class="p-6 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] text-center space-y-3 shadow-xs">
            <div class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                KOMITMEN LAYANAN & DUKUNGAN RESMI
            </div>
            <p class="text-xs text-[var(--text-2)] max-w-xl mx-auto leading-relaxed">
                Pertanyaan mengenai ketentuan lisensi atau bantuan teknis dapat disampaikan melalui portal resmi Ziqva Labs atau kanal bantuan WhatsApp terdaftar.
            </p>
            <div class="pt-2 flex justify-center gap-3">
                <button on:click={() => push('/')} class="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-all cursor-pointer shadow-sm shadow-blue-500/20">
                    Kembali ke Beranda
                </button>
                <button on:click={() => push('/privacy')} class="px-5 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text)] text-xs font-bold transition-all cursor-pointer border border-[var(--border)]">
                    Baca Kebijakan Privasi
                </button>
            </div>
        </div>
    </main>

    <!-- Unified Footer -->
    <PublicFooter />
</div>
