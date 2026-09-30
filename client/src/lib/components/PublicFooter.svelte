<script lang="ts">
    import { push, location } from 'svelte-spa-router';

    function navigateTo(target: string) {
        if (target.startsWith('#/')) {
            window.location.hash = target.slice(1);
        } else if (target.startsWith('/')) {
            if (target.includes('#')) {
                const [path, section] = target.split('#');
                if ($location !== path) {
                    push(path + '?section=' + section);
                } else {
                    const el = document.getElementById(section);
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            } else {
                push(target);
            }
        } else {
            // Section link
            if ($location !== '/' && $location !== '/welcome') {
                push('/?section=' + target);
            } else {
                const el = document.getElementById(target);
                if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }
            }
        }
    }
</script>

<footer class="w-full bg-[var(--surface)] border-t border-[var(--border)] pt-16 pb-12 transition-colors duration-300">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div class="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
            <!-- Brand Column -->
            <div class="space-y-4 md:col-span-1">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-xl bg-blue-600 p-0.5 shadow-md shadow-blue-500/25 shrink-0">
                        <div class="w-full h-full bg-[var(--surface-1)] rounded-[10px] flex items-center justify-center p-1.5">
                            <img src="/favicon.svg" alt="Ziqva Labs Logo" class="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
                        </div>
                    </div>
                    <span class="font-black text-lg text-[var(--text)]">Ziqva Labs</span>
                </div>
                <p class="text-xs text-[var(--text-2)] leading-relaxed">
                    Platform software otomatisasi dan bot desktop oleh Kampung Songo sejak 2022. Membantu produktivitas dropshipper, afiliator, YouTuber, dan AI enthusiast dengan privasi data lokal.
                </p>

                <!-- Clean Location Sub-text -->
                <div class="flex items-start gap-2 text-xs text-[var(--text-3)] pt-1">
                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span class="leading-relaxed">Perumahan Tirta Sani, Karangploso, Malang, Jawa Timur 65153</span>
                </div>
            </div>

            <!-- Navigation Links Column -->
            <div>
                <h4 class="font-extrabold text-xs text-[var(--text)] uppercase tracking-wider mb-4">Navigasi Utama</h4>
                <ul class="space-y-2.5 text-xs text-[var(--text-2)]">
                    <li><button on:click={() => navigateTo('hero')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Beranda</button></li>
                    <li><button on:click={() => navigateTo('catalog')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Katalog Software</button></li>
                    <li><button on:click={() => navigateTo('features')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Keunggulan System</button></li>
                    <li><button on:click={() => navigateTo('terms-guarantee')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Ketentuan & Garansi</button></li>
                    <li><button on:click={() => navigateTo('affiliate')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Mitra Afiliasi</button></li>
                    <li><button on:click={() => navigateTo('about')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Tentang Ziqva Labs</button></li>
                </ul>
            </div>

            <!-- Access Portal Column -->
            <div>
                <h4 class="font-extrabold text-xs text-[var(--text)] uppercase tracking-wider mb-4">Portal Akses</h4>
                <ul class="space-y-2.5 text-xs text-[var(--text-2)]">
                    <li><button on:click={() => push('/member/login')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Login Member</button></li>
                    <li><button on:click={() => push('/member/register')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Daftar Akun Baru</button></li>
                </ul>
            </div>

            <!-- Support & Legal Column -->
            <div>
                <h4 class="font-extrabold text-xs text-[var(--text)] uppercase tracking-wider mb-4">Dukungan & Legal</h4>
                <ul class="space-y-2.5 text-xs text-[var(--text-2)]">
                    <li><button on:click={() => push('/member/tutorials')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Pusat Video Tutorial</button></li>
                    <li><button on:click={() => push('/member/downloads')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Pusat Unduhan Installer</button></li>
                    <li><button on:click={() => push('/terms')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Syarat & Ketentuan Layanan</button></li>
                    <li><button on:click={() => push('/privacy')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Kebijakan Privasi</button></li>
                </ul>
            </div>
        </div>

        <div class="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between text-xs text-[var(--text-3)] gap-4">
            <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                <span>© 2026 Ziqva Labs. Hak Cipta Dilindungi Undang-Undang.</span>
                <span class="hidden sm:inline">•</span>
                <span class="text-[11px]">Perumahan Tirta Sani, Karangploso, Malang, Jawa Timur 65153</span>
            </div>
            <div class="flex items-center gap-6">
                <span>Semua hak dilindungi</span>
            </div>
        </div>
    </div>
</footer>
