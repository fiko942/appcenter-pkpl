<script lang="ts">
    import { onMount, tick, afterUpdate } from 'svelte';
    import { slide } from 'svelte/transition';
    import { cubicOut } from 'svelte/easing';
    import { adminLogout } from '../stores/auth';

    export let activePage: string = 'dashboard';
    export let mobileOpen: boolean = false;
    export let adminName: string = 'Admin';

    let productsMenuOpen: boolean = false;
    let affiliateMenuOpen: boolean = false;

    let navRef: HTMLElement;
    let itemElements: Record<string, HTMLElement> = {};
    let hoveredPage: string | null = null;
    let pillTop: number = 0;
    let pillHeight: number = 0;
    let pillOpacity: number = 0;

    // Load initial accordion state from localStorage or activePage
    try {
        const savedProd = localStorage.getItem('admin_sidebar_products');
        const savedAff = localStorage.getItem('admin_sidebar_affiliate');
        productsMenuOpen = savedProd !== null ? savedProd === 'true' : (activePage === 'products' || activePage === 'categories');
        affiliateMenuOpen = savedAff !== null ? savedAff === 'true' : (activePage === 'affiliate' || activePage === 'affiliate-history' || activePage === 'payout-history');
    } catch (e) {
        productsMenuOpen = activePage === 'products' || activePage === 'categories';
        affiliateMenuOpen = activePage === 'affiliate' || activePage === 'affiliate-history' || activePage === 'payout-history';
    }

    // Keep active menu open without auto-collapsing other opened menus
    $: if (activePage === 'products' || activePage === 'categories') {
        productsMenuOpen = true;
        try { localStorage.setItem('admin_sidebar_products', 'true'); } catch (e) {}
    }

    $: if (activePage === 'affiliate' || activePage === 'affiliate-history' || activePage === 'payout-history') {
        affiliateMenuOpen = true;
        try { localStorage.setItem('admin_sidebar_affiliate', 'true'); } catch (e) {}
    }

    let prodSubItemElements: Record<string, HTMLElement> = {};
    let hoveredProdSub: string | null = null;
    let prodPillTop: number = 0;
    let prodPillHeight: number = 0;
    let prodPillOpacity: number = 0;

    let affSubItemElements: Record<string, HTMLElement> = {};
    let hoveredAffSub: string | null = null;
    let affPillTop: number = 0;
    let affPillHeight: number = 0;
    let affPillOpacity: number = 0;

    function getTargetId(page: string): string {
        if (page === 'products' || page === 'categories') return 'products-btn';
        if (page === 'affiliate' || page === 'affiliate-history' || page === 'payout-history') return 'affiliate-btn';
        return page;
    }

    function syncPill(targetId?: string | null) {
        const id = targetId || hoveredPage || getTargetId(activePage);
        const el = itemElements[id];
        if (el) {
            pillTop = el.offsetTop;
            pillHeight = el.offsetHeight;
            pillOpacity = 1;
        } else {
            pillOpacity = 0;
        }
    }

    function syncProdSubPill(targetId?: string | null) {
        const id = targetId || hoveredProdSub || (activePage === 'products' || activePage === 'categories' ? activePage : null);
        if (!id) {
            prodPillOpacity = 0;
            return;
        }
        const el = prodSubItemElements[id];
        if (el) {
            prodPillTop = el.offsetTop;
            prodPillHeight = el.offsetHeight;
            prodPillOpacity = 1;
        } else {
            prodPillOpacity = 0;
        }
    }

    function handleProdSubMouseEnter(id: string) {
        hoveredProdSub = id;
        syncProdSubPill(id);
    }

    function handleProdSubMouseLeave() {
        hoveredProdSub = null;
        syncProdSubPill(activePage === 'products' || activePage === 'categories' ? activePage : null);
    }

    function getAffActiveId(page: string): string | null {
        if (page === 'affiliate') return 'affiliate';
        if (page === 'affiliate-history' || page === 'payout-history') return 'affiliate-history';
        return null;
    }

    function syncAffSubPill(targetId?: string | null) {
        const id = targetId || hoveredAffSub || getAffActiveId(activePage);
        if (!id) {
            affPillOpacity = 0;
            return;
        }
        const el = affSubItemElements[id];
        if (el) {
            affPillTop = el.offsetTop;
            affPillHeight = el.offsetHeight;
            affPillOpacity = 1;
        } else {
            affPillOpacity = 0;
        }
    }

    function handleAffSubMouseEnter(id: string) {
        hoveredAffSub = id;
        syncAffSubPill(id);
    }

    function handleAffSubMouseLeave() {
        hoveredAffSub = null;
        syncAffSubPill(getAffActiveId(activePage));
    }

    function handleMouseEnter(id: string) {
        hoveredPage = id;
        syncPill(id);
    }

    function handleMouseLeave() {
        hoveredPage = null;
        syncPill(getTargetId(activePage));
    }

    function toggleProductsMenu() {
        productsMenuOpen = !productsMenuOpen;
        try { localStorage.setItem('admin_sidebar_products', String(productsMenuOpen)); } catch (e) {}
        tick().then(() => {
            syncPill(hoveredPage || getTargetId(activePage));
            syncProdSubPill();
            setTimeout(() => {
                syncPill(hoveredPage || getTargetId(activePage));
                syncProdSubPill();
            }, 260);
        });
    }

    function toggleAffiliateMenu() {
        affiliateMenuOpen = !affiliateMenuOpen;
        try { localStorage.setItem('admin_sidebar_affiliate', String(affiliateMenuOpen)); } catch (e) {}
        tick().then(() => {
            syncPill(hoveredPage || getTargetId(activePage));
            syncAffSubPill();
            setTimeout(() => {
                syncPill(hoveredPage || getTargetId(activePage));
                syncAffSubPill();
            }, 260);
        });
    }

    $: if (activePage || productsMenuOpen || affiliateMenuOpen) {
        tick().then(() => {
            syncPill(hoveredPage || getTargetId(activePage));
            if (productsMenuOpen) syncProdSubPill();
            if (affiliateMenuOpen) syncAffSubPill();
        });
    }

    afterUpdate(() => {
        syncPill(hoveredPage || getTargetId(activePage));
        if (productsMenuOpen) syncProdSubPill();
        if (affiliateMenuOpen) syncAffSubPill();
    });

    onMount(() => {
        tick().then(() => {
            syncPill(getTargetId(activePage));
            if (productsMenuOpen) syncProdSubPill();
            if (affiliateMenuOpen) syncAffSubPill();
            requestAnimationFrame(() => {
                syncPill(getTargetId(activePage));
                if (productsMenuOpen) syncProdSubPill();
                if (affiliateMenuOpen) syncAffSubPill();
            });
        });

        if (document.fonts) {
            document.fonts.ready.then(() => {
                syncPill(getTargetId(activePage));
                if (productsMenuOpen) syncProdSubPill();
                if (affiliateMenuOpen) syncAffSubPill();
            });
        }

        const handleResize = () => {
            syncPill(hoveredPage || getTargetId(activePage));
            if (productsMenuOpen) syncProdSubPill();
            if (affiliateMenuOpen) syncAffSubPill();
        };

        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('resize', handleResize);
        };
    });

    function getInitial(name: string): string {
        return (name || 'A').charAt(0).toUpperCase();
    }

    async function handleLogout() {
        await adminLogout();
    }
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
                <a href="#/admin/dashboard" class="flex items-center gap-3 no-underline group" on:click={() => mobileOpen = false}>
                    <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 p-0.5 shadow-md shadow-blue-500/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
                        <div class="w-full h-full rounded-[14px] bg-[#0c1426] flex items-center justify-center">
                            <img src="/favicon.svg" alt="Appcenter Logo" class="w-5 h-5 object-contain" />
                        </div>
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex items-center gap-1.5">
                            <span class="text-white text-sm font-extrabold tracking-tight">Appcenter</span>
                            <span class="px-1.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-400/30">
                                ADMIN
                            </span>
                        </div>
                        <div class="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5 font-medium">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span class="truncate">Ziqva Control Hub</span>
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
        <p class="nav-label">MANAJEMEN SISTEM</p>
        <nav
            bind:this={navRef}
            class="relative space-y-1 px-3 select-none"
            on:mouseleave={handleMouseLeave}
        >
            <!-- Animated Sliding Pill Backdrop with Moving Active Dot Indicator -->
            {#if pillHeight > 0}
                <div
                    class="sidebar-sliding-pill {hoveredPage && hoveredPage !== getTargetId(activePage) ? 'bg-white/10 dark:bg-[#1e2c47]/80 border border-white/10 shadow-xs' : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/30 border border-blue-400/30'}"
                    style="top: {pillTop}px; height: {pillHeight}px; opacity: {pillOpacity};"
                >
                    <span
                        class="sidebar-active-dot"
                        style="opacity: {!hoveredPage || hoveredPage === getTargetId(activePage) ? 1 : 0}; transform: scale({!hoveredPage || hoveredPage === getTargetId(activePage) ? 1 : 0.4});"
                    ></span>
                </div>
            {/if}

            <a
                href="#/admin/dashboard"
                bind:this={itemElements['dashboard']}
                class="sidebar-nav-item {activePage === 'dashboard' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('dashboard')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Dashboard</span>
            </a>

            <a
                href="#/admin/users"
                bind:this={itemElements['users']}
                class="sidebar-nav-item {activePage === 'users' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('users')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Manajemen Pengguna</span>
            </a>

            <a
                href="#/admin/payments"
                bind:this={itemElements['payments']}
                class="sidebar-nav-item {activePage === 'payments' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('payments')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <span class="whitespace-nowrap flex-1">Daftar Pembayaran</span>
            </a>

            <a
                href="#/admin/trials/create"
                bind:this={itemElements['create-trial']}
                class="sidebar-nav-item {activePage === 'create-trial' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('create-trial')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Buat Trial</span>
            </a>

            <!-- Menu Produk dengan Submenu Accordion Animasi -->
            <div>
                <button
                    type="button"
                    bind:this={itemElements['products-btn']}
                    class="sidebar-nav-item w-full flex items-center justify-between {activePage === 'products' || activePage === 'categories' ? 'active' : ''} cursor-pointer select-none"
                    on:mouseenter={() => handleMouseEnter('products-btn')}
                    on:click={toggleProductsMenu}
                    aria-expanded={productsMenuOpen}
                >
                    <div class="flex items-center gap-2.5">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                        </svg>
                        <span class="whitespace-nowrap">Produk</span>
                    </div>
                    <svg
                        class="w-3.5 h-3.5 text-[var(--text-3)] transition-transform duration-300 ease-out {productsMenuOpen ? 'rotate-180 text-[var(--brand)]' : ''}"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {#if productsMenuOpen}
                    <div
                        transition:slide={{ duration: 250, easing: cubicOut }}
                        class="relative overflow-hidden mt-1.5 p-1.5 rounded-2xl bg-[#0b1324] border border-[#22314d] space-y-1 shadow-inner select-none"
                        role="group"
                        aria-label="Submenu Produk"
                        on:mouseleave={handleProdSubMouseLeave}
                    >
                        <!-- Submenu Sliding Pill with Active Dot -->
                        {#if prodPillHeight > 0}
                            <div
                                class="sidebar-sub-sliding-pill {hoveredProdSub && hoveredProdSub !== activePage ? 'bg-white/10 border border-white/10 shadow-xs' : 'bg-blue-600 shadow-md shadow-blue-600/35 ring-1 ring-blue-400/40'}"
                                style="top: {prodPillTop}px; height: {prodPillHeight}px; opacity: {prodPillOpacity};"
                            >
                                <span
                                    class="sidebar-active-dot"
                                    style="opacity: {!hoveredProdSub || hoveredProdSub === activePage ? 1 : 0}; transform: scale({!hoveredProdSub || hoveredProdSub === activePage ? 1 : 0.4});"
                                ></span>
                            </div>
                        {/if}

                        <a
                            href="#/admin/products"
                            bind:this={prodSubItemElements['products']}
                            class="relative z-10 flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors duration-200 {activePage === 'products' ? 'text-white font-bold' : 'text-slate-300 hover:text-white font-medium'}"
                            on:mouseenter={() => handleProdSubMouseEnter('products')}
                            on:click={() => mobileOpen = false}
                        >
                            <div class="flex items-center gap-2.5">
                                <svg class="w-4 h-4 {activePage === 'products' ? 'text-white' : 'text-blue-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <span class="whitespace-nowrap">Katalog Produk</span>
                            </div>
                        </a>
                        <a
                            href="#/admin/categories"
                            bind:this={prodSubItemElements['categories']}
                            class="relative z-10 flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors duration-200 {activePage === 'categories' ? 'text-white font-bold' : 'text-slate-300 hover:text-white font-medium'}"
                            on:mouseenter={() => handleProdSubMouseEnter('categories')}
                            on:click={() => mobileOpen = false}
                        >
                            <div class="flex items-center gap-2.5">
                                <svg class="w-4 h-4 {activePage === 'categories' ? 'text-white' : 'text-purple-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                <span class="whitespace-nowrap">Kategori Produk</span>
                            </div>
                        </a>
                    </div>
                {/if}
            </div>

            <!-- Menu Afiliasi dengan Submenu Accordion Animasi -->
            <div>
                <button
                    type="button"
                    bind:this={itemElements['affiliate-btn']}
                    class="sidebar-nav-item w-full flex items-center justify-between {activePage === 'affiliate' || activePage === 'affiliate-history' || activePage === 'payout-history' ? 'active' : ''} cursor-pointer select-none"
                    on:mouseenter={() => handleMouseEnter('affiliate-btn')}
                    on:click={toggleAffiliateMenu}
                    aria-expanded={affiliateMenuOpen}
                >
                    <div class="flex items-center gap-2.5">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span class="whitespace-nowrap">Affiliate Management</span>
                    </div>
                    <svg
                        class="w-3.5 h-3.5 text-[var(--text-3)] transition-transform duration-300 ease-out {affiliateMenuOpen ? 'rotate-180 text-[var(--brand)]' : ''}"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                    >
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </button>

                {#if affiliateMenuOpen}
                    <div
                        transition:slide={{ duration: 250, easing: cubicOut }}
                        class="relative overflow-hidden mt-1.5 p-1.5 rounded-2xl bg-[#0b1324] border border-[#22314d] space-y-1 shadow-inner select-none"
                        role="group"
                        aria-label="Submenu Afiliasi"
                        on:mouseleave={handleAffSubMouseLeave}
                    >
                        <!-- Submenu Sliding Pill with Active Dot -->
                        {#if affPillHeight > 0}
                            <div
                                class="sidebar-sub-sliding-pill {hoveredAffSub && hoveredAffSub !== getAffActiveId(activePage) ? 'bg-white/10 border border-white/10 shadow-xs' : 'bg-blue-600 shadow-md shadow-blue-600/35 ring-1 ring-blue-400/40'}"
                                style="top: {affPillTop}px; height: {affPillHeight}px; opacity: {affPillOpacity};"
                            >
                                <span
                                    class="sidebar-active-dot"
                                    style="opacity: {!hoveredAffSub || hoveredAffSub === getAffActiveId(activePage) ? 1 : 0}; transform: scale({!hoveredAffSub || hoveredAffSub === getAffActiveId(activePage) ? 1 : 0.4});"
                                ></span>
                            </div>
                        {/if}

                        <a
                            href="#/admin/affiliate"
                            bind:this={affSubItemElements['affiliate']}
                            class="relative z-10 flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors duration-200 {activePage === 'affiliate' ? 'text-white font-bold' : 'text-slate-300 hover:text-white font-medium'}"
                            on:mouseenter={() => handleAffSubMouseEnter('affiliate')}
                            on:click={() => mobileOpen = false}
                        >
                            <div class="flex items-center gap-2.5">
                                <svg class="w-4 h-4 {activePage === 'affiliate' ? 'text-white' : 'text-emerald-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                                <span class="whitespace-nowrap">Daftar Mitra & Payout</span>
                            </div>
                        </a>
                        <a
                            href="#/admin/affiliate/history"
                            bind:this={affSubItemElements['affiliate-history']}
                            class="relative z-10 flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors duration-200 {activePage === 'affiliate-history' || activePage === 'payout-history' ? 'text-white font-bold' : 'text-slate-300 hover:text-white font-medium'}"
                            on:mouseenter={() => handleAffSubMouseEnter('affiliate-history')}
                            on:click={() => mobileOpen = false}
                        >
                            <div class="flex items-center gap-2.5">
                                <svg class="w-4 h-4 {activePage === 'affiliate-history' || activePage === 'payout-history' ? 'text-white' : 'text-amber-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span class="whitespace-nowrap">Riwayat Pencairan</span>
                            </div>
                        </a>
                    </div>
                {/if}
            </div>

            <a
                href="#/admin/profile"
                bind:this={itemElements['profile']}
                class="sidebar-nav-item {activePage === 'profile' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('profile')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Profil Admin</span>
            </a>

            <a
                href="#/admin/oauth-clients"
                bind:this={itemElements['oauth-clients']}
                class="sidebar-nav-item {activePage === 'oauth-clients' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('oauth-clients')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
                <span class="whitespace-nowrap flex-1">OAuth & SSO</span>
                {#if activePage === 'oauth-clients'}
                    <span class="w-1.5 h-1.5 rounded-full bg-white shadow-xs"></span>
                {/if}
            </a>

            <a
                href="#/admin/settings"
                bind:this={itemElements['settings']}
                class="sidebar-nav-item {activePage === 'settings' ? 'active' : ''}"
                on:mouseenter={() => handleMouseEnter('settings')}
                on:click={() => mobileOpen = false}
            >
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span class="whitespace-nowrap flex-1">Pengaturan</span>
                {#if activePage === 'settings'}
                    <span class="w-1.5 h-1.5 rounded-full bg-white shadow-xs"></span>
                {/if}
            </a>
        </nav>

        <!-- Switch to Member Portal Link -->
        <div class="px-3 mt-4 mb-2">
            <div class="p-3 rounded-2xl bg-[#0b1324] border border-[#22314d] shadow-sm space-y-2">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Akses Cepat</span>
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                </div>
                <a
                    href="#/member/dashboard"
                    class="flex items-center justify-between px-2.5 py-2 rounded-xl bg-[#142038] hover:bg-blue-600/25 text-blue-400 hover:text-blue-300 border border-blue-500/25 hover:border-blue-500/50 text-xs font-bold transition-all group no-underline shadow-xs"
                    title="Buka Portal Member Area"
                    on:click={() => mobileOpen = false}
                >
                    <div class="flex items-center gap-2">
                        <svg class="w-3.5 h-3.5 text-blue-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span>Portal Member</span>
                    </div>
                    <svg class="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-blue-300 transition-all" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                </a>
            </div>
        </div>
    </div>

    <!-- Admin Profile Footer (Clickable to /#/admin/profile) -->
    <div class="flex items-center justify-between p-3 border-t border-[#22314d] bg-[#0c1426]/80 backdrop-blur-xs">
        <a
            href="#/admin/profile"
            class="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-90 transition-opacity group cursor-pointer text-inherit no-underline"
            title="Buka Profil Admin"
            on:click={() => mobileOpen = false}
        >
            <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-extrabold text-xs flex items-center justify-center shadow-xs flex-shrink-0">
                {getInitial(adminName)}
            </div>
            <div class="truncate min-w-0">
                <div class="text-xs font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                    Admin {adminName}
                </div>
                <div class="text-[10px] text-slate-400 font-medium truncate">
                    Super Administrator
                </div>
            </div>
        </a>
        <button
            type="button"
            on:click={handleLogout}
            class="w-8 h-8 rounded-xl text-slate-400 hover:text-red-400 hover:bg-rose-500/10 flex items-center justify-center transition-colors cursor-pointer bg-transparent border-0 flex-shrink-0 ml-1"
            title="Keluar dari Admin"
            aria-label="Keluar dari Admin"
        >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
        </button>
    </div>
</aside>
