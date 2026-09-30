<script lang="ts">
    import { slide } from 'svelte/transition';
    import { push, location } from 'svelte-spa-router';
    import ThemeToggle from './ThemeToggle.svelte';
    import { onMount } from 'svelte';
    import { checkSession, checkAdminSession } from '../stores/auth';

    export let activePage: 'home' | 'catalog' | 'features' | 'affiliate' | 'terms' | 'privacy' | 'login' | 'register' = 'home';
    export let showAnnouncement: boolean = true;

    let isAuthenticated = false;
    let isAdminAuthenticated = false;
    let mobileMenuOpen = false;

    onMount(async () => {
        const [isAuth, isAdmin] = await Promise.all([
            checkSession(),
            checkAdminSession()
        ]);
        isAuthenticated = isAuth;
        isAdminAuthenticated = isAdmin;
    });

    function navigateTo(target: string) {
        mobileMenuOpen = false;
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
            // Section on landing page
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

<div class="w-full relative z-50">
    <!-- Top Announcement Bar (Dismissible & Vibrant Accent, Fully Responsive & No Awkward Wrap) -->
    {#if showAnnouncement}
        <div class="bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-600 text-white text-xs font-semibold py-2 px-3 sm:px-4 flex items-center justify-between gap-2 shadow-xs transition-all duration-300">
            <div class="max-w-7xl mx-auto flex items-center gap-2 text-center w-full justify-center min-w-0">
                <span class="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black tracking-wider uppercase backdrop-blur-xs whitespace-nowrap shrink-0">Update v2.0</span>
                <span class="font-medium truncate sm:overflow-visible sm:whitespace-normal">
                    <span class="sm:hidden">Ekosistem software bot desktop resmi.</span>
                    <span class="hidden sm:inline">Ekosistem Software Bot Desktop & Lisensi Resmi Terpadu.</span>
                </span>
                <button on:click={() => navigateTo('/#catalog')} class="underline font-bold text-white hover:text-blue-100 hidden md:inline ml-1 whitespace-nowrap shrink-0 cursor-pointer">Lihat Software →</button>
            </div>
            <button on:click={() => showAnnouncement = false} class="p-1 rounded-md hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer shrink-0" aria-label="Tutup Pengumuman">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    {/if}

    <!-- Navbar Header (Apple TV-Class Frosted Glass Bar) -->
    <header class="sticky top-0 backdrop-blur-2xl bg-[var(--surface)]/90 dark:bg-[#070c18]/90 border-b border-[var(--border)] shadow-xs transition-all duration-300">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
            <!-- Brand Logo -->
            <button on:click={() => push('/')} class="flex items-center gap-3.5 group cursor-pointer text-left shrink-0">
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300 shrink-0">
                    <div class="w-full h-full bg-[var(--surface-1)] dark:bg-[#070c18] rounded-[14px] flex items-center justify-center p-2">
                        <img src="/favicon.svg" alt="AppCenter Logo" class="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(37,99,235,0.6)]" />
                    </div>
                </div>
                <div class="flex flex-col shrink-0">
                    <span class="font-extrabold text-lg sm:text-xl tracking-tight text-[var(--text)] whitespace-nowrap">
                        Ziqva <span class="text-blue-600 dark:text-blue-400">Labs</span>
                    </span>
                    <span class="text-[10px] font-bold text-[var(--text-3)] tracking-wider uppercase whitespace-nowrap">Automated Software Hub</span>
                </div>
            </button>

            <!-- Desktop Navigation Links (100% Identical to Landing Page Nav: Beranda, Software & Bot, Keunggulan, Mitra Afiliasi, Tentang Kami, FAQ) -->
            <nav class="hidden lg:flex items-center gap-1 shrink-0">
                <button
                    on:click={() => navigateTo('/')}
                    class="px-3 py-2 rounded-full text-sm font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap {activePage === 'home' ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10' : 'text-[var(--text-2)] hover:text-[var(--text)]'}"
                >
                    Beranda
                </button>
                <button
                    on:click={() => navigateTo('/#catalog')}
                    class="px-3 py-2 rounded-full text-sm font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap {activePage === 'catalog' ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10' : 'text-[var(--text-2)] hover:text-[var(--text)]'}"
                >
                    Software & Bot
                </button>
                <button
                    on:click={() => navigateTo('/#features')}
                    class="px-3 py-2 rounded-full text-sm font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap {activePage === 'features' ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10' : 'text-[var(--text-2)] hover:text-[var(--text)]'}"
                >
                    Keunggulan
                </button>
                <button
                    on:click={() => navigateTo('/#affiliate')}
                    class="px-3 py-2 rounded-full text-sm font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap {activePage === 'affiliate' ? 'text-blue-600 dark:text-blue-400 bg-blue-500/10' : 'text-[var(--text-2)] hover:text-[var(--text)]'}"
                >
                    Mitra Afiliasi
                </button>
                <button
                    on:click={() => navigateTo('/#about')}
                    class="px-3 py-2 rounded-full text-sm font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap text-[var(--text-2)] hover:text-[var(--text)]"
                >
                    Tentang Kami
                </button>
                <button
                    on:click={() => navigateTo('/#faq')}
                    class="px-3 py-2 rounded-full text-sm font-bold transition-colors duration-200 cursor-pointer whitespace-nowrap text-[var(--text-2)] hover:text-[var(--text)]"
                >
                    FAQ
                </button>
            </nav>

            <!-- Actions Right -->
            <div class="hidden md:flex items-center gap-3 shrink-0">
                <ThemeToggle />

                {#if isAuthenticated}
                    <button
                        on:click={() => push('/member/dashboard')}
                        class="px-5 py-2.5 rounded-full font-bold text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer whitespace-nowrap"
                    >
                        Buka Member Area →
                    </button>
                {:else if isAdminAuthenticated}
                    <button
                        on:click={() => push('/admin/dashboard')}
                        class="px-5 py-2.5 rounded-full font-bold text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer whitespace-nowrap"
                    >
                        Buka Admin Panel →
                    </button>
                {:else}
                    {#if activePage !== 'login'}
                        <button
                            on:click={() => push('/member/login')}
                            class="px-3.5 py-2 rounded-xl text-sm font-semibold text-[var(--text-2)] hover:text-blue-600 dark:hover:text-blue-400 transition-colors cursor-pointer whitespace-nowrap"
                        >
                            Masuk
                        </button>
                    {/if}
                    {#if activePage !== 'register'}
                        <button
                            on:click={() => push('/member/register')}
                            class="px-5 py-2.5 rounded-full font-bold text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer whitespace-nowrap"
                        >
                            Daftar Gratis
                        </button>
                    {/if}
                {/if}
            </div>

            <!-- Mobile Hamburger Button -->
            <div class="flex items-center gap-2 lg:hidden">
                <ThemeToggle />
                <button
                    on:click={() => mobileMenuOpen = !mobileMenuOpen}
                    class="p-2.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] cursor-pointer"
                    aria-label="Toggle Menu"
                >
                    {#if mobileMenuOpen}
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
                    {:else}
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                    {/if}
                </button>
            </div>
        </div>

        <!-- Mobile Drawer Menu with Smooth Slide Animation -->
        {#if mobileMenuOpen}
            <div transition:slide={{ duration: 250 }} class="md:hidden border-t border-[var(--border)] bg-[var(--surface-1)]/95 backdrop-blur-2xl px-4 py-5 space-y-4">
                <div class="flex flex-col space-y-2">
                    <button
                        on:click={() => navigateTo('/')}
                        class="px-4 py-2.5 rounded-xl text-left font-bold text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                    >
                        Beranda
                    </button>
                    <button
                        on:click={() => navigateTo('/#catalog')}
                        class="px-4 py-2.5 rounded-xl text-left font-bold text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                    >
                        Software & Bot
                    </button>
                    <button
                        on:click={() => navigateTo('/#features')}
                        class="px-4 py-2.5 rounded-xl text-left font-bold text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                    >
                        Keunggulan
                    </button>
                    <button
                        on:click={() => navigateTo('/#affiliate')}
                        class="px-4 py-2.5 rounded-xl text-left font-bold text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                    >
                        Mitra Afiliasi
                    </button>
                    <button
                        on:click={() => navigateTo('/#about')}
                        class="px-4 py-2.5 rounded-xl text-left font-bold text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                    >
                        Tentang Kami
                    </button>
                    <button
                        on:click={() => navigateTo('/#faq')}
                        class="px-4 py-2.5 rounded-xl text-left font-bold text-sm text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer"
                    >
                        FAQ
                    </button>
                </div>

                <div class="pt-3 border-t border-[var(--border)] flex flex-col gap-2">
                    {#if isAuthenticated}
                        <button
                            on:click={() => push('/member/dashboard')}
                            class="w-full py-3 rounded-full font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 cursor-pointer"
                        >
                            Buka Member Area →
                        </button>
                    {:else if isAdminAuthenticated}
                        <button
                            on:click={() => push('/admin/dashboard')}
                            class="w-full py-3 rounded-full font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 cursor-pointer"
                        >
                            Buka Admin Panel →
                        </button>
                    {:else}
                        <button
                            on:click={() => push('/member/login')}
                            class="w-full py-3 rounded-xl font-semibold border border-[var(--border)] text-center text-[var(--text)] bg-[var(--surface-2)] cursor-pointer"
                        >
                            Masuk
                        </button>
                        <button
                            on:click={() => push('/member/register')}
                            class="w-full py-3 rounded-full font-bold text-center bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25 cursor-pointer"
                        >
                            Daftar Gratis
                        </button>
                    {/if}
                </div>
            </div>
        {/if}
    </header>
</div>
