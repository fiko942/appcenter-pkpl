<script lang="ts">
    import { onMount, tick, afterUpdate } from 'svelte';
    import { auth, logout } from '../stores/auth';

    export let activePage: string = 'dashboard';
    export let mobileOpen: boolean = false;

    $: user = $auth.user || { name: 'Member', email: '' };

    let navRef: HTMLElement;
    let itemElements: Record<string, HTMLAnchorElement> = {};
    let hoveredPage: string | null = null;
    let pillTop: number = 0;
    let pillHeight: number = 0;
    let pillOpacity: number = 0;

    function getInitial(name: string): string {
        return (name || 'M').charAt(0).toUpperCase();
    }

    function syncPill(targetId?: string | null) {
        const id = targetId || hoveredPage || activePage;
        const el = itemElements[id];
        if (el) {
            pillTop = el.offsetTop;
            pillHeight = el.offsetHeight;
            pillOpacity = 1;
        } else {
            pillOpacity = 0;
        }
    }

    function handleMouseEnter(id: string) {
        hoveredPage = id;
        syncPill(id);
    }

    function handleMouseLeave() {
        hoveredPage = null;
        syncPill(activePage);
    }

    $: if (activePage) {
        tick().then(() => {
            syncPill(hoveredPage || activePage);
        });
    }

    afterUpdate(() => {
        syncPill(hoveredPage || activePage);
    });

    onMount(() => {
        tick().then(() => {
            syncPill(activePage);
            requestAnimationFrame(() => syncPill(activePage));
        });

        if (document.fonts) {
            document.fonts.ready.then(() => syncPill(activePage));
        }

        window.addEventListener('resize', () => syncPill(hoveredPage || activePage));
        return () => {
            window.removeEventListener('resize', () => syncPill(hoveredPage || activePage));
        };
    });
</script>

<!-- Mobile Overlay Backdrop -->
{#if mobileOpen}
    <div
        class="fixed inset-0 z-40 bg-[#070c16]/80 backdrop-blur-sm md:hidden transition-opacity"
        on:click={() => mobileOpen = false}
        aria-hidden="true"
    ></div>
{/if}

<aside class="app-sidebar fixed inset-y-0 left-0 z-50 w-64 flex flex-col justify-between transition-transform duration-300 ease-in-out {mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}">
    <div class="flex flex-col flex-1 overflow-y-auto">
        <!-- Brand Header -->
        <div class="px-4 py-3.5 border-b border-[#22314d]">
            <div class="flex items-center justify-between">
                <a href="#/member/dashboard" class="flex items-center gap-3 no-underline group" on:click={() => mobileOpen = false}>
                    <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-md shadow-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <div class="w-full h-full rounded-[14px] bg-[#0c1426] flex items-center justify-center">
                            <img src="/favicon.svg" alt="Appcenter Logo" class="w-5 h-5 object-contain" />
                        </div>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                            <span class="text-white text-sm font-extrabold tracking-tight">Appcenter</span>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-400/30">
                                MEMBER
                            </span>
                        </div>
                        <div class="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span class="truncate">Ziqva Ecosystem</span>
                        </div>
                    </div>
                </a>

                <button
                    type="button"
                    class="md:hidden w-8 h-8 rounded-xl bg-[#142038] hover:bg-[#1f2f4e] text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-[#27334a]"
                    aria-label="Tutup Menu"
                    on:click={() => mobileOpen = false}
                >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        </div>

        <!-- Menu Utama -->
        <p class="nav-label">MENU UTAMA</p>
        <nav
            bind:this={navRef}
            class="relative space-y-1 px-3 select-none"
            on:mouseleave={handleMouseLeave}
        >
            <!-- Animated Sliding Pill Backdrop with Moving Active Dot Indicator -->
            {#if pillHeight > 0}
                <div
                    class="sidebar-sliding-pill {hoveredPage && hoveredPage !== activePage ? 'bg-white/10 dark:bg-[#1e2c47]/80 border border-white/10 shadow-xs' : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/30 border border-blue-400/30'}"
                    style="top: {pillTop}px; height: {pillHeight}px; opacity: {pillOpacity};"
                >
                    <span
                        class="sidebar-active-dot"
                        style="opacity: {!hoveredPage || hoveredPage === activePage ? 1 : 0}; transform: scale({!hoveredPage || hoveredPage === activePage ? 1 : 0.4});"
                    ></span>
                </div>
            {/if}

            <a
                href="#/member/dashboard"
                bind:this={itemElements['dashboard']}
                class="sidebar-nav-item {activePage === 'dashboard' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('dashboard')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
                <span class="whitespace-nowrap flex-1">Beranda</span>
            </a>

            <a
                href="#/member/orders"
                bind:this={itemElements['orders']}
                class="sidebar-nav-item {activePage === 'orders' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('orders')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Pesanan Saya</span>
            </a>

            <a
                href="#/member/invoices"
                bind:this={itemElements['invoices']}
                class="sidebar-nav-item {activePage === 'invoices' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('invoices')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Faktur & Invoice</span>
            </a>

            <a
                href="#/member/licenses"
                bind:this={itemElements['licenses']}
                class="sidebar-nav-item {activePage === 'licenses' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('licenses')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Lisensi Aplikasi</span>
            </a>

            <a
                href="#/member/tutorials"
                bind:this={itemElements['tutorials']}
                class="sidebar-nav-item {activePage === 'tutorials' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('tutorials')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                <span class="whitespace-nowrap flex-1">Tutorial Video</span>
            </a>

            <a
                href="#/member/downloads"
                bind:this={itemElements['downloads']}
                class="sidebar-nav-item {activePage === 'downloads' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('downloads')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span class="whitespace-nowrap flex-1">Download Hub</span>
            </a>

            <a
                href="#/member/orders/create"
                bind:this={itemElements['create-order']}
                class="sidebar-nav-item {activePage === 'create-order' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('create-order')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span class="whitespace-nowrap flex-1">Order Baru</span>
            </a>

            <a
                href="#/member/profile"
                bind:this={itemElements['profile']}
                class="sidebar-nav-item {activePage === 'profile' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('profile')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Profil Saya</span>
            </a>

            <a
                href="#/member/affiliate"
                bind:this={itemElements['affiliate']}
                class="sidebar-nav-item {activePage === 'affiliate' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('affiliate')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Mitra Afiliasi</span>
            </a>
        </nav>

        <!-- Free Tools Promo Widget -->
        <div class="free-card">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
            </svg>
            <div>
                <strong>Tools Gratis</strong>
                <p>Coba alat pilihan tanpa biaya tambahan.</p>
            </div>
            <a href="#/member/downloads" on:click={() => mobileOpen = false}>
                Lihat Semua
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                </svg>
            </a>
        </div>
    </div>

    <!-- User Profile Footer -->
    <div class="flex items-center justify-between p-3 border-t border-[#22314d] bg-[#0c1426]/80 backdrop-blur-xs">
        <a href="#/member/profile" class="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90 transition-opacity group cursor-pointer text-inherit no-underline" on:click={() => mobileOpen = false}>
            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                {getInitial(user.name)}
            </div>
            <div class="truncate min-w-0">
                <div class="text-xs font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                    {user.name}
                </div>
                <div class="text-[10px] text-slate-400 font-medium truncate">
                    Member Aktif
                </div>
            </div>
        </a>
        <button type="button" on:click={logout} class="w-8 h-8 rounded-xl text-slate-400 hover:text-red-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-0 flex-shrink-0 ml-1" title="Keluar dari akun" aria-label="Keluar dari akun">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
        </button>
    </div>
</aside>
