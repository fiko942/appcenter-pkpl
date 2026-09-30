<script lang="ts">
    import { onMount } from 'svelte';
    import Layout from '../components/Layout.svelte';

    interface ProductItem {
        id: number;
        name: string;
        description: string;
        price: number;
        is_discount: boolean;
        discount_percent: number;
        image?: string;
        product_id?: number;
        tutorials?: string | null;
        category_id?: number | null;
        category_ids?: number[];
        category_name?: string | null;
        category_icon?: string | null;
        category_slug?: string | null;
        categories?: Array<{ id: number; name: string; slug: string; icon: string | null }>;
        is_bundle?: boolean;
        bundle_items?: string | null;
    }

    interface CategoryItem {
        id: number | 'all' | 'bundle';
        name: string;
        slug?: string;
        icon?: string | null;
        description?: string;
        count: number;
        href?: string;
    }

    interface ActiveLicenseItem {
        id: number;
        productId?: number | null;
        token: string;
        productName: string;
        productImage: string | null;
        isActivated: boolean;
        isExpired: boolean;
        daysLeft: number;
        durationMonths: number;
        expiresAtFormatted: string;
        downloadUrl: string;
        tutorialsUrl: string | null;
    }

    interface PendingInvoiceItem {
        id: number;
        productName: string;
        totalAmount: number;
        paymentRequestId: string | null;
        vaNumber: string | null;
        expiresAt: number;
        minutesLeft?: number;
        expiresAtFormatted?: string;
        invoiceToken: string | null;
    }

    let products: ProductItem[] = [];
    let rawCategories: CategoryItem[] = [];
    let selectedCategoryId: number | 'all' | 'bundle' = 'all';
    let searchQuery: string = '';
    let quickFilter: 'all' | 'bundle' | 'free' = 'all';
    let totalOrders: number = 0;
    let totalLicenses: number = 0;
    let myActiveLicenses: ActiveLicenseItem[] = [];
    let pendingInvoices: PendingInvoiceItem[] = [];
    let copiedLicenseId: number | null = null;
    let copiedToastTimer: any = null;
    let loading: boolean = true;
    let imgErrorMap: Record<number | string, boolean> = {};

    let activeTooltip: { text: string; x: number; y: number } | null = null;

    function handleMouseEnterTooltip(e: MouseEvent, text: string) {
        const target = e.currentTarget as HTMLElement;
        if (!target) return;
        const rect = target.getBoundingClientRect();
        activeTooltip = {
            text,
            x: rect.left + rect.width / 2,
            y: rect.top - 10
        };
    }

    function handleMouseLeaveTooltip() {
        activeTooltip = null;
    }

    const tones = ['blue', 'violet', 'cyan', 'green', 'orange', 'indigo'];

    $: productCount = products.length;
    $: bundleProducts = products.filter(p => Boolean(p.is_bundle));
    $: bundleCount = bundleProducts.length;
    $: freeProducts = products.filter(p => p.price === 0);
    $: freeToolsCount = freeProducts.length;

    $: categories = [
        { id: 'all', name: 'Semua Produk', count: productCount, icon: 'grid', href: '#products' } as CategoryItem,
        ...(bundleCount > 0 ? [{ id: 'bundle', name: 'Paket Bundle', count: bundleCount, icon: 'bundle', href: '#products' } as CategoryItem] : []),
        ...rawCategories.map(c => ({
            ...c,
            href: '#products'
        }))
    ];

    $: filteredProducts = products.filter(p => {
        // Quick filter
        if (quickFilter === 'bundle' && !p.is_bundle) return false;
        if (quickFilter === 'free' && p.price !== 0) return false;

        // Category filter
        if (selectedCategoryId !== 'all') {
            if (selectedCategoryId === 'bundle') {
                if (!p.is_bundle) return false;
            } else {
                const matchCategory = (p.category_ids && Array.isArray(p.category_ids))
                    ? p.category_ids.includes(selectedCategoryId as number)
                    : p.category_id === selectedCategoryId;
                if (!matchCategory) return false;
            }
        }

        // Live search filter
        if (searchQuery.trim()) {
            const q = searchQuery.trim().toLowerCase();
            const nameMatch = (p.name || '').toLowerCase().includes(q);
            const descMatch = (p.description || '').toLowerCase().includes(q);
            const catMatch = (p.category_name || '').toLowerCase().includes(q);
            if (!nameMatch && !descMatch && !catMatch) return false;
        }

        return true;
    });

    function resetFilters() {
        selectedCategoryId = 'all';
        quickFilter = 'all';
        searchQuery = '';
    }

    function getIncludedTools(bundleItemsJson: string | null): string[] {
        if (!bundleItemsJson) return [];
        try {
            const itemIds: number[] = typeof bundleItemsJson === 'string' ? JSON.parse(bundleItemsJson) : bundleItemsJson;
            if (!Array.isArray(itemIds)) return [];
            const names: string[] = [];
            for (const id of itemIds) {
                const matched = products.find(p => p.id === id || p.product_id === id);
                if (matched) names.push(matched.name);
            }
            return names;
        } catch {
            return [];
        }
    }

    function getIncludedProductItems(bundleItemsJson: string | null): ProductItem[] {
        if (!bundleItemsJson) return [];
        try {
            const itemIds: number[] = typeof bundleItemsJson === 'string' ? JSON.parse(bundleItemsJson) : bundleItemsJson;
            if (!Array.isArray(itemIds)) return [];
            const result: ProductItem[] = [];
            for (const id of itemIds) {
                const matched = products.find(p => p.id === id || p.product_id === id);
                if (matched) result.push(matched);
            }
            return result;
        } catch {
            return [];
        }
    }

    function selectCategory(catId: number | 'all' | 'bundle') {
        selectedCategoryId = catId;
        const el = document.getElementById('products');
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function formatRupiah(val: number): string {
        if (!val || val === 0) return 'Gratis';
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    }

    function copyToken(token: string, id: number) {
        if (!token) return;
        navigator.clipboard.writeText(token).then(() => {
            copiedLicenseId = id;
            if (copiedToastTimer) clearTimeout(copiedToastTimer);
            copiedToastTimer = setTimeout(() => {
                copiedLicenseId = null;
            }, 2500);
        });
    }

    onMount(async () => {
        try {
            const res = await fetch('/member/api/dashboard', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (res.status === 401 || res.status === 403) {
                window.location.hash = '/member/login';
                return;
            }
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'success' && json.data) {
                    products = json.data.products || [];
                    rawCategories = json.data.categories || [];
                    totalOrders = json.data.totalOrders || 0;
                    totalLicenses = json.data.totalLicenses || 0;
                    myActiveLicenses = json.data.myActiveLicenses || [];
                    pendingInvoices = json.data.pendingInvoices || [];
                }
            }
        } catch (e) {
            console.error('Failed to load dashboard data:', e);
        } finally {
            loading = false;
        }
    });
</script>

<Layout activePage="dashboard" eyebrow="ZIQVA DIGITAL MARKETPLACE">
    <main class="content">
        <!-- Floating Copy Toast -->
        {#if copiedLicenseId}
            <div class="fixed bottom-6 left-4 right-4 sm:left-auto sm:right-6 z-50 flex items-center justify-center pointer-events-none">
                <div class="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold shadow-2xl border border-slate-700/50 dark:border-slate-200 animate-bounce pointer-events-auto">
                    <svg class="w-4 h-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Token lisensi berhasil disalin!</span>
                </div>
            </div>
        {/if}

        <!-- 0. High-Density Pending Order Action Bar -->
        {#if pendingInvoices && pendingInvoices.length > 0}
            <div class="mb-5 space-y-2.5">
                {#each pendingInvoices as inv}
                    <div class="rounded-2xl bg-[var(--surface-1)] dark:bg-[#0c1426] border border-[var(--border)] dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 p-3.5 sm:px-4 sm:py-3.5 transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 group">
                        <div class="flex items-center gap-3 min-w-0 flex-1">
                            <!-- Amber Clock/Bill Mini Icon -->
                            <div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0 shadow-2xs">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>

                            <!-- Content Details -->
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
                                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        <span>Menunggu Pembayaran #{inv.id}</span>
                                    </span>
                                    {#if inv.expiresAtFormatted}
                                        <span class="text-[11px] text-[var(--text-3)] font-medium">
                                            • Batas: {inv.expiresAtFormatted} WIB
                                        </span>
                                    {/if}
                                </div>
                                <div class="text-xs text-[var(--text)] font-semibold mt-1 truncate">
                                    Selesaikan pesanan <span class="font-bold text-blue-600 dark:text-blue-400">{inv.productName}</span> senilai <span class="font-mono font-bold text-[var(--text)]">{formatRupiah(inv.totalAmount)}</span>
                                </div>
                            </div>
                        </div>

                        <!-- CTA Button -->
                        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <a
                                href={inv.invoiceToken ? `#/invoice/${inv.invoiceToken}` : `#/invoice/${inv.id}`}
                                class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center gap-1.5 group/btn border-0 cursor-pointer"
                            >
                                <span>Bayar Pesanan</span>
                                <svg class="w-3.5 h-3.5 transition-transform group-hover/btn:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                                </svg>
                            </a>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        <!-- 1. Welcome Hero Section with 3D Art -->
        <section class="welcome mb-6 sm:mb-8 lg:mb-10">
            <div class="welcome-copy">
                <span class="welcome-pill">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                    </svg>
                    WELCOME TO APPCENTER ZIQVA
                </span>
                <h1>Tools digital untuk<br><em>ide yang lebih besar.</em></h1>
                <p>Temukan produk dan tools digital pilihan yang membuat pekerjaanmu lebih cepat, mudah, otomatis, dan produktif.</p>
                <div class="welcome-actions">
                    <a href="#products">
                        Jelajahi Produk
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </a>
                    <a href="#free">Coba Tools Gratis</a>
                </div>
            </div>

            <div class="welcome-art">
                <div class="glow"></div>
                <div class="float-card fc-one">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>Auto Flow</span>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div class="float-card fc-two">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <span>100% Aman</span>
                </div>
                <div class="cube">
                    <div class="cube-inner-platter">
                        <img src="/favicon.svg" alt="Appcenter Logo" />
                    </div>
                </div>
                <div class="mini-stat">
                    <strong>{productCount}+</strong>
                    <span>Produk digital</span>
                </div>
            </div>
        </section>

        <!-- 1.5. My Active Software Hub -->
        {#if myActiveLicenses && myActiveLicenses.length > 0}
            <section class="mb-10">
                <div class="flex items-center justify-between mb-4">
                    <div class="flex items-center gap-2.5">
                        <div class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <div>
                            <span class="text-[11px] font-bold text-[var(--brand)] uppercase tracking-wider block mb-0.5">LISENSI TERDAFTAR</span>
                            <h2 class="text-xl font-black text-[var(--text)] tracking-tight">Software Aktif Saya <span class="text-xs font-semibold text-[var(--text-3)] font-mono ml-1">({myActiveLicenses.length})</span></h2>
                        </div>
                    </div>
                    <a href="#/member/licenses" class="text-xs font-semibold text-[var(--brand)] hover:underline flex items-center gap-1 group">
                        <span>Kelola Semua Lisensi</span>
                        <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                    </a>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {#each myActiveLicenses as lic}
                        <div class="rounded-2xl bg-[var(--surface-1)] dark:bg-[#0c1426] border border-[var(--border)] dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 shadow-xs hover:shadow-md transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between gap-4 group">
                            <!-- Top Information -->
                            <div>
                                <div class="flex items-start justify-between gap-3 mb-3.5">
                                    <div class="flex items-center gap-3 min-w-0 flex-1">
                                        {#if lic.productImage}
                                            <img src={lic.productImage} alt={lic.productName} class="w-11 h-11 rounded-xl object-cover bg-[var(--surface-2)] border border-[var(--border)] shrink-0 shadow-2xs" />
                                        {:else}
                                            <div class="w-11 h-11 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                                                {lic.productName.charAt(0)}
                                            </div>
                                        {/if}
                                        <div class="min-w-0 flex-1">
                                            <h3 class="text-sm font-bold text-[var(--text)] truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">{lic.productName}</h3>
                                            <p class="text-[11px] text-[var(--text-3)] mt-0.5">{lic.durationMonths} Bulan Durasi</p>
                                        </div>
                                    </div>
                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold shrink-0 {lic.isExpired ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25' : 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/25'}">
                                        <span class="w-1.5 h-1.5 rounded-full {lic.isExpired ? 'bg-rose-500' : 'bg-emerald-500 animate-pulse'}"></span>
                                        <span>{lic.isExpired ? 'Kedaluwarsa' : `Aktif • ${lic.daysLeft} Hari`}</span>
                                    </span>
                                </div>

                                <!-- Sleek Serial Key Box -->
                                <div class="p-2 px-3 rounded-xl bg-[var(--surface-2)] dark:bg-[#070d19] border border-[var(--border)] dark:border-slate-800/90 flex items-center justify-between gap-2">
                                    <div class="flex items-center gap-2 min-w-0 flex-1">
                                        <svg class="w-3.5 h-3.5 text-[var(--text-3)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                        <code class="text-xs font-mono font-semibold text-[var(--text-2)] dark:text-slate-300 truncate select-all">{lic.token}</code>
                                    </div>
                                    <button
                                        type="button"
                                        on:click={() => copyToken(lic.token, lic.id)}
                                        class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-1 {copiedLicenseId === lic.id ? 'bg-emerald-600 text-white border-transparent shadow-xs' : 'bg-[var(--surface-1)] dark:bg-[#111c30] hover:bg-[var(--border)] dark:hover:bg-slate-800 text-[var(--text)] border border-[var(--border)] dark:border-slate-700'}"
                                        title="Salin Kunci Serial"
                                    >
                                        {#if copiedLicenseId === lic.id}
                                            <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                                            <span>Tersalin!</span>
                                        {:else}
                                            <svg class="w-3 h-3 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            <span>Salin</span>
                                        {/if}
                                    </button>
                                </div>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex items-center gap-2 pt-3 border-t border-[var(--border)] dark:border-slate-800/80">
                                <a
                                    href={lic.downloadUrl || (lic.productId ? `#/member/downloads?id=${lic.productId}` : `#/member/downloads?search=${encodeURIComponent(lic.productName)}`)}
                                    class="flex-1 py-2 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 group/btn"
                                >
                                    <svg class="w-3.5 h-3.5 transition-transform group-hover/btn:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                                    <span>Unduh Installer</span>
                                </a>
                                {#if lic.tutorialsUrl}
                                    <a
                                        href={lic.tutorialsUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="py-2 px-3 rounded-xl bg-[var(--surface-2)] dark:bg-[#111c30] hover:bg-[var(--border)] dark:hover:bg-slate-800 border border-[var(--border)] dark:border-slate-700 text-xs font-medium text-[var(--text-2)] dark:text-slate-300 transition-colors flex items-center justify-center gap-1.5"
                                        title="Panduan Video Tutorial"
                                    >
                                        <svg class="w-3.5 h-3.5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                        <span class="hidden sm:inline">Tutorial</span>
                                    </a>
                                {/if}
                            </div>
                        </div>
                    {/each}
                </div>
            </section>
        {/if}

        <!-- 1.6. Getting Started & Quick Activation Guide -->
        <section class="mb-10 p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-purple-500/10 border border-blue-500/20">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                <div>
                    <span class="text-[10px] font-bold text-blue-500 uppercase tracking-wider block">PANDUAN PENGGUNA</span>
                    <h3 class="text-base sm:text-lg font-bold text-[var(--text)]">Cara Cepat Memulai di AppCenter</h3>
                </div>
                <a href="#/member/licenses" class="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors inline-flex items-center gap-1.5 w-max">
                    <span>Lihat Semua Lisensi</span>
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                </a>
            </div>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div class="p-3.5 rounded-2xl bg-[var(--surface)]/80 border border-[var(--border)] flex items-start gap-3">
                    <span class="w-6 h-6 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 font-extrabold flex items-center justify-center shrink-0">1</span>
                    <div>
                        <div class="font-bold text-[var(--text)]">Pilih Software</div>
                        <div class="text-[11px] text-[var(--text-3)] mt-0.5">Temukan tools otomatisasi yang sesuai kebutuhanmu.</div>
                    </div>
                </div>
                <div class="p-3.5 rounded-2xl bg-[var(--surface)]/80 border border-[var(--border)] flex items-start gap-3">
                    <span class="w-6 h-6 rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 font-extrabold flex items-center justify-center shrink-0">2</span>
                    <div>
                        <div class="font-bold text-[var(--text)]">Salin Token Lisensi</div>
                        <div class="text-[11px] text-[var(--text-3)] mt-0.5">Token lisensi diterbitkan instan setelah pembayaran.</div>
                    </div>
                </div>
                <div class="p-3.5 rounded-2xl bg-[var(--surface)]/80 border border-[var(--border)] flex items-start gap-3">
                    <span class="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-extrabold flex items-center justify-center shrink-0">3</span>
                    <div>
                        <div class="font-bold text-[var(--text)]">Aktivasi & Jalankan</div>
                        <div class="text-[11px] text-[var(--text-3)] mt-0.5">Unduh installer, masukkan token lisensi, dan mulai bekerja!</div>
                    </div>
                </div>
            </div>
        </section>



        <!-- 2. Category Section -->
        <section class="category-section">
            <div class="section-heading">
                <div>
                    <span class="kicker">TEMUKAN KEBUTUHANMU</span>
                    <h2>Jelajahi kategori</h2>
                </div>
                <a href="#products" class="hidden sm:inline-flex">
                    Lihat semua
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </a>
            </div>

            <!-- Mobile Horizontal Swipeable Category Pills Carousel (sm:hidden) -->
            <div class="sm:hidden w-full overflow-x-auto no-scrollbar py-2 px-0.5 flex items-center gap-2 touch-pan-x overscroll-x-contain">
                {#each categories as c}
                    <button
                        type="button"
                        class="px-3.5 py-2 rounded-2xl text-xs font-semibold whitespace-nowrap shrink-0 transition-all flex items-center gap-2 border cursor-pointer active:scale-95 {selectedCategoryId === c.id ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-500/25 font-bold scale-[1.02]' : 'bg-[var(--surface-1)] hover:bg-[var(--surface-2)] text-[var(--text-2)] border-[var(--border)] shadow-2xs'}"
                        on:click={() => selectCategory(c.id)}
                    >
                        <span class="w-4 h-4 flex items-center justify-center shrink-0">
                            {#if c.icon && (c.icon.startsWith('/') || c.icon.startsWith('http')) && !imgErrorMap['mob_cat_' + c.id]}
                                <img
                                    src={c.icon}
                                    alt={c.name}
                                    class="w-4 h-4 rounded object-cover"
                                    on:error={() => imgErrorMap['mob_cat_' + c.id] = true}
                                />
                            {:else if c.icon === 'bundle'}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            {:else if c.icon === 'bot'}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            {:else if c.icon === 'sparkles'}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                            {:else if c.icon === 'search'}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {:else if c.icon === 'code'}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                            {:else if c.icon === 'gift'}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                            {:else}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            {/if}
                        </span>
                        <span>{c.name}</span>
                        <span class="text-[10px] px-1.5 py-0.2 rounded-full {selectedCategoryId === c.id ? 'bg-white/20 text-white' : 'bg-[var(--surface-2)] text-[var(--text-3)]'}">
                            {c.count}
                        </span>
                    </button>
                {/each}
            </div>

            <!-- Desktop Category Grid (hidden sm:grid) -->
            <div class="hidden sm:grid category-grid">
                {#each categories as c}
                    <button
                        type="button"
                        class="category-card {selectedCategoryId === c.id ? 'active ring-2 ring-amber-500/80 dark:ring-amber-400/90 shadow-md scale-[1.02]' : 'hover:border-slate-300 dark:hover:border-slate-700'} text-left cursor-pointer transition-all duration-200 w-full"
                        on:click={() => selectCategory(c.id)}
                    >
                        <span>
                            {#if c.icon && (c.icon.startsWith('/') || c.icon.startsWith('http')) && !imgErrorMap['cat_' + c.id]}
                                <img
                                    src={c.icon}
                                    alt={c.name}
                                    class="w-5 h-5 rounded object-cover"
                                    on:error={() => imgErrorMap['cat_' + c.id] = true}
                                />
                            {:else if c.icon === 'bundle'}
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            {:else if c.icon === 'bot'}
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                            {:else if c.icon === 'sparkles'}
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
                            {:else if c.icon === 'search'}
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            {:else if c.icon === 'code'}
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>
                            {:else if c.icon === 'gift'}
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
                            {:else}
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            {/if}
                        </span>
                        <div>
                            <strong>{c.name}</strong>
                            <small>{c.count} produk</small>
                        </div>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                {/each}
            </div>
        </section>

        <!-- 3. Products Section -->
        <section id="products" class="products-section">
            <div class="section-heading mb-4 sm:mb-6">
                <div>
                    <span class="kicker">PILIHAN TERBAIK</span>
                    <h2>
                        {#if selectedCategoryId === 'all'}
                            Produk Populer
                        {:else}
                            {@const activeCat = rawCategories.find(c => c.id === selectedCategoryId)}
                            Kategori: {activeCat ? activeCat.name : (selectedCategoryId === 'bundle' ? 'Paket Bundle' : 'Produk')}
                        {/if}
                        <span class="text-xs font-semibold text-[var(--text-3)] font-mono ml-1.5">({filteredProducts.length})</span>
                    </h2>
                </div>
                {#if selectedCategoryId !== 'all' || searchQuery || quickFilter !== 'all'}
                    <button
                        type="button"
                        on:click={resetFilters}
                        class="text-xs font-semibold text-[var(--brand)] hover:underline cursor-pointer flex items-center gap-1"
                    >
                        <span>Reset Semua Filter</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                {:else}
                    <a href="#/member/orders/create" class="hidden sm:inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand)] hover:underline">
                        <span>Pesan Lisensi Lainnya</span>
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                {/if}
            </div>

            <!-- Unified Search & Quick Filter Toolbar (Mobile & Desktop) -->
            <div class="mb-5 p-2.5 sm:p-3 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs flex flex-col sm:flex-row items-center gap-2.5 w-full max-w-full overflow-hidden">
                <!-- Search Box -->
                <div class="relative w-full sm:flex-1 min-w-0">
                    <svg class="w-4 h-4 text-[var(--text-3)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Cari software, bot, atau tools otomatisasi..."
                        class="w-full pl-9 pr-8 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                    />
                    {#if searchQuery}
                        <button
                            type="button"
                            on:click={() => searchQuery = ''}
                            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer p-1"
                        >
                            &times;
                        </button>
                    {/if}
                </div>

                <!-- Quick Filter Chips -->
                <div class="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar py-0.5 touch-pan-x overscroll-x-contain shrink-0">
                    <button
                        type="button"
                        on:click={() => quickFilter = 'all'}
                        class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border active:scale-95 {quickFilter === 'all' ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent font-bold shadow-xs' : 'bg-[var(--surface-2)] text-[var(--text-2)] border-[var(--border)] hover:text-[var(--text)]'}"
                    >
                        Semua ({products.length})
                    </button>
                    {#if bundleCount > 0}
                        <button
                            type="button"
                            on:click={() => quickFilter = 'bundle'}
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 active:scale-95 {quickFilter === 'bundle' ? 'bg-indigo-600 text-white border-indigo-500 font-bold shadow-xs' : 'bg-[var(--surface-2)] text-[var(--text-2)] border-[var(--border)] hover:text-[var(--text)]'}"
                        >
                            <svg class="w-3.5 h-3.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                            <span>Bundel ({bundleCount})</span>
                        </button>
                    {/if}
                    {#if freeToolsCount > 0}
                        <button
                            type="button"
                            on:click={() => quickFilter = 'free'}
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer border flex items-center gap-1.5 active:scale-95 {quickFilter === 'free' ? 'bg-emerald-600 text-white border-emerald-500 font-bold shadow-xs' : 'bg-[var(--surface-2)] text-[var(--text-2)] border-[var(--border)] hover:text-[var(--text)]'}"
                        >
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            <span>Gratis ({freeToolsCount})</span>
                        </button>
                    {/if}
                </div>
            </div>

            {#if loading}
                <div class="py-16 text-center text-gray-400">
                    <div class="inline-block animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mb-3"></div>
                    <p class="text-xs text-[var(--text-3)]">Memuat katalog produk...</p>
                </div>
            {:else if filteredProducts.length === 0}
                <div class="py-16 text-center text-[var(--text-3)] rounded-3xl bg-[var(--surface-1)] border border-[var(--border)] p-6 space-y-2">
                    <div class="w-12 h-12 rounded-2xl bg-[var(--surface-2)] text-[var(--text-3)] mx-auto flex items-center justify-center">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p class="text-sm font-bold text-[var(--text)]">Tidak ada software yang cocok</p>
                    <p class="text-xs text-[var(--text-3)]">Coba sesuaikan kata kunci pencarian atau reset filter di atas.</p>
                    <button type="button" on:click={resetFilters} class="mt-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors shadow-xs cursor-pointer">Reset Filter</button>
                </div>
            {:else}
                <!-- Mobile 2-Column Grid Card Layout (md:hidden) -->
                <div class="md:hidden grid grid-cols-2 gap-2.5 sm:gap-3.5">
                    {#each filteredProducts as p, idx}
                        {@const isFree = p.price === 0}
                        {@const origPrice = (p.is_discount && p.discount_percent > 0) ? formatRupiah(p.price) : null}
                        {@const finalPrice = (p.is_discount && p.discount_percent > 0) ? p.price - (p.price * p.discount_percent / 100) : p.price}
                        {@const bundledItems = p.is_bundle ? getIncludedProductItems(p.bundle_items) : []}
                        <div class="rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-2xs hover:border-[var(--brand)] hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group min-w-0">
                            <!-- Visual Top Box -->
                            <div class="relative w-full aspect-[4/3] bg-gradient-to-b from-[var(--surface-2)]/90 to-[var(--surface-1)] border-b border-[var(--border)]/60 flex items-center justify-center p-2.5 overflow-hidden shrink-0">
                                {#if p.is_bundle}
                                    <!-- Bundle Stack Visual -->
                                    <div class="relative w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-indigo-950 via-purple-950 to-slate-900 border border-white/20 shadow-md flex items-center justify-center">
                                        {#if bundledItems.length > 0}
                                            <div class="flex items-center -space-x-2">
                                                {#each bundledItems.slice(0, 2) as item}
                                                    <div class="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-slate-900 border border-white/20 overflow-hidden flex items-center justify-center shrink-0">
                                                        {#if item.image && !imgErrorMap['mob_stack_' + item.id]}
                                                            <img src={item.image} alt={item.name} class="w-full h-full object-cover" on:error={() => imgErrorMap['mob_stack_' + item.id] = true} />
                                                        {:else}
                                                            <span class="text-[8px] font-black text-amber-300">{item.name.charAt(0)}</span>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            </div>
                                        {:else}
                                            <svg class="w-5 h-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                        {/if}
                                    </div>
                                {:else}
                                    <!-- Software Icon Avatar -->
                                    <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] shadow-2xs flex items-center justify-center shrink-0 overflow-hidden">
                                        {#if p.image && !imgErrorMap['mob_prod_' + p.id]}
                                            <img src={p.image} alt={p.name} class="w-full h-full object-cover" on:error={() => imgErrorMap['mob_prod_' + p.id] = true} />
                                        {:else}
                                            <div class="w-full h-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-sm flex items-center justify-center">
                                                {p.name.charAt(0)}
                                            </div>
                                        {/if}
                                    </div>
                                {/if}

                                <!-- Top Right Corner Badge -->
                                <div class="absolute top-1.5 right-1.5 z-10">
                                    {#if p.is_bundle}
                                        <span class="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 uppercase tracking-tight shadow-2xs">
                                            BUNDEL
                                        </span>
                                    {:else if p.is_discount && p.discount_percent > 0}
                                        <span class="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-tight shadow-2xs">
                                            -{p.discount_percent}%
                                        </span>
                                    {:else if isFree}
                                        <span class="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-tight shadow-2xs">
                                            FREE
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Body Information -->
                            <div class="p-2.5 sm:p-3 flex-1 flex flex-col justify-between gap-2 min-w-0">
                                <div>
                                    <div class="flex items-center justify-between gap-1 text-[9px] text-[var(--text-3)] font-semibold mb-1">
                                        <span class="truncate max-w-[70%] font-mono">#{p.category_name || (p.is_bundle ? 'Bundel' : 'Software')}</span>
                                        <span class="text-amber-500 font-bold shrink-0">★ 5.0</span>
                                    </div>
                                    <h3 class="text-xs sm:text-sm font-bold text-[var(--text)] line-clamp-1 sm:line-clamp-2 leading-snug group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                                        {p.name}
                                    </h3>
                                    {#if p.is_bundle && bundledItems.length > 0}
                                        <div class="mt-1 flex items-center gap-1 text-[9px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded-md w-max max-w-full truncate">
                                            <span>{bundledItems.length} Tools Termasuk</span>
                                        </div>
                                    {:else}
                                        <p class="text-[10px] text-[var(--text-3)] line-clamp-2 mt-1 leading-tight">
                                            {p.description || 'Solusi otomatisasi digital untuk produktivitas Anda.'}
                                        </p>
                                    {/if}
                                </div>

                                <!-- Price & CTA Button -->
                                <div class="pt-2 border-t border-[var(--border)]/60 flex flex-col gap-1.5 mt-1">
                                    <div class="min-w-0">
                                        <div class="text-[11px] sm:text-xs font-black truncate {isFree ? 'text-emerald-600 dark:text-emerald-400' : 'text-[var(--text)]'}">
                                            {isFree ? 'GRATIS' : formatRupiah(finalPrice)}
                                            {#if !isFree}
                                                <span class="text-[9px] font-normal text-[var(--text-3)]">/bln</span>
                                            {/if}
                                        </div>
                                        {#if origPrice}
                                            <del class="text-[9px] text-[var(--text-3)] font-mono block leading-none">{origPrice}</del>
                                        {/if}
                                    </div>

                                    <a
                                        href="#/member/orders/create?product_id={p.id}"
                                        class="w-full py-1.5 sm:py-2 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-95 cursor-pointer {isFree ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-500/20'}"
                                    >
                                        <span>{isFree ? 'Klaim' : 'Beli'}</span>
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Desktop 3-Column Bento Grid (hidden md:grid) -->
                <div class="hidden md:grid products-grid">
                    {#each filteredProducts as p, idx}
                        {@const tone = tones[idx % tones.length]}
                        {@const isFree = p.price === 0}
                        {@const origPrice = (p.is_discount && p.discount_percent > 0) ? formatRupiah(p.price) : null}
                        {@const finalPrice = (p.is_discount && p.discount_percent > 0) ? p.price - (p.price * p.discount_percent / 100) : p.price}
                        {@const bundledItems = p.is_bundle ? getIncludedProductItems(p.bundle_items) : []}
                        <article class="product-card flex flex-col justify-between h-full">
                            {#if p.is_bundle}
                                <!-- Glassmorphic Floating App Stack Header for Bundle Products (Opsi 1) -->
                                <div class="product-visual relative overflow-hidden bg-gradient-to-br from-indigo-950/70 via-purple-950/60 to-slate-900 border-b border-white/10 flex items-center justify-center p-6 min-h-[150px]">
                                    <span class="corner-label yellow">BUNDEL</span>

                                    <div class="relative z-10 backdrop-blur-md bg-white/10 dark:bg-slate-900/60 border border-white/20 dark:border-white/10 rounded-2xl px-5 py-3.5 shadow-2xl flex items-center justify-center">
                                        {#if bundledItems.length > 0}
                                            <div class="flex items-center -space-x-3 hover:space-x-1.5 transition-all duration-300 ease-out group/stack">
                                                {#each bundledItems.slice(0, 4) as item, bIdx}
                                                    <div
                                                        role="img"
                                                        aria-label={item.name}
                                                        class="relative w-10 h-10 rounded-xl bg-slate-900 border-2 border-white dark:border-slate-800 shadow-xl overflow-hidden transition-all duration-300 transform group-hover/stack:hover:-translate-y-1.5 group-hover/stack:hover:scale-110 flex items-center justify-center cursor-pointer"
                                                        style="z-index: {20 - bIdx};"
                                                        on:mouseenter={(e) => handleMouseEnterTooltip(e, item.name)}
                                                        on:mouseleave={handleMouseLeaveTooltip}
                                                    >
                                                        {#if item.image && !imgErrorMap['stack_' + item.id]}
                                                            <img
                                                                src={item.image}
                                                                alt={item.name}
                                                                class="w-full h-full object-cover"
                                                                on:error={() => imgErrorMap['stack_' + item.id] = true}
                                                            />
                                                        {:else}
                                                            <span class="text-xs font-black text-amber-300">
                                                                {item.name.charAt(0).toUpperCase()}
                                                            </span>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            </div>
                                        {:else}
                                            <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-300">
                                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                </svg>
                                            </div>
                                        {/if}
                                    </div>

                                    <span class="visual-brand">ZIQVA</span>
                                </div>
                            {:else}
                                <div class="product-visual {tone}">
                                    {#if p.is_discount && p.discount_percent > 0}
                                        <span class="corner-label red">DISKON {p.discount_percent}%</span>
                                    {:else if isFree}
                                        <span class="corner-label green">FREE</span>
                                    {:else if idx === 0}
                                        <span class="corner-label">POPULER</span>
                                    {/if}
                                    <div class="product-orbit relative">
                                        {#if p.image && !imgErrorMap[p.id]}
                                            <img
                                                src={p.image}
                                                alt={p.name}
                                                class="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/20 relative z-10"
                                                on:error={() => imgErrorMap[p.id] = true}
                                            />
                                        {:else}
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                            </svg>
                                        {/if}
                                    </div>
                                    <span class="visual-brand">ZIQVA</span>
                                </div>
                            {/if}

                            <div class="product-copy flex-1 flex flex-col justify-between">
                                <div class="product-meta">
                                    <span>{p.category_name || (p.is_bundle ? 'Paket Bundel Hemat' : (isFree ? 'Tools Gratis' : 'Software Bot'))}</span>
                                    <span>
                                        <svg fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                        5.0
                                    </span>
                                </div>
                                <h3>{p.name}</h3>
                                <p>{p.description || 'Solusi digital otomatis untuk meningkatkan produktivitas dan efisiensi bisnis Anda.'}</p>

                                <!-- Included Software Bot List Container with Clean Card Styling & Spacing -->
                                {#if p.is_bundle && bundledItems.length > 0}
                                    <div class="my-3.5 p-3 rounded-2xl bg-slate-500/5 dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700/60 space-y-2 shadow-2xs">
                                        <span class="text-[10px] font-black uppercase tracking-wider text-amber-500 dark:text-amber-400 flex items-center gap-1.5">
                                            <svg class="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                            Include:
                                        </span>
                                        <div class="flex flex-wrap gap-1.5">
                                            {#each bundledItems as item}
                                                <span class="px-2.5 py-1 rounded-lg text-xs font-semibold bg-white dark:bg-slate-900/90 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700/80 flex items-center gap-1.5 shadow-2xs hover:border-amber-500/50 transition-colors">
                                                    {#if item.image && !imgErrorMap['pill_' + item.id]}
                                                        <img
                                                            src={item.image}
                                                            alt={item.name}
                                                            class="w-4 h-4 rounded-md object-cover"
                                                            on:error={() => imgErrorMap['pill_' + item.id] = true}
                                                        />
                                                    {:else}
                                                        <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                                                    {/if}
                                                    {item.name}
                                                </span>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                                <div class="price-row">
                                    <div>
                                        <small>Harga</small>
                                        <div class="flex items-baseline gap-1">
                                            <strong class={isFree ? 'free-price' : ''}>{isFree ? 'GRATIS' : formatRupiah(finalPrice)}</strong>
                                            {#if !isFree}
                                                <span class="text-[11px] font-medium text-[var(--text-3)] dark:text-slate-400">
                                                    / bulan
                                                </span>
                                            {/if}
                                        </div>
                                        {#if origPrice}
                                            <del>{origPrice}</del>
                                        {/if}
                                    </div>
                                    <a href="#/member/orders/create?product_id={p.id}">
                                        {isFree ? 'Klaim Lisensi Gratis' : 'Beli Lisensi'}
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </article>
                    {/each}
                </div>
            {/if}
        </section>

        <!-- 4. Free Tools Section -->
        <section id="free" class="products-section free-section">
            <div class="section-heading">
                <div>
                    <span class="kicker">LISENSI FREEMIUM</span>
                    <h2>Software & Tools Gratis</h2>
                </div>
                <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)]">
                    Akses Gratis
                </span>
            </div>

            {#if freeProducts.length > 0}
                <!-- Mobile Free Products 2-Column Grid (md:hidden) -->
                <div class="md:hidden grid grid-cols-2 gap-2.5 sm:gap-3.5">
                    {#each freeProducts as p}
                        <div class="rounded-2xl bg-[var(--surface-1)] border border-emerald-500/20 dark:border-emerald-500/30 shadow-2xs hover:border-emerald-500 hover:shadow-md transition-all duration-200 overflow-hidden flex flex-col justify-between group min-w-0">
                            <!-- Visual Top -->
                            <div class="relative w-full aspect-[4/3] bg-gradient-to-b from-emerald-500/10 to-transparent border-b border-emerald-500/15 flex items-center justify-center p-2.5 overflow-hidden shrink-0">
                                <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center shrink-0 overflow-hidden">
                                    {#if p.image && !imgErrorMap['mob_free_' + p.id]}
                                        <img src={p.image} alt={p.name} class="w-full h-full object-cover" on:error={() => imgErrorMap['mob_free_' + p.id] = true} />
                                    {:else}
                                        <span class="font-black text-emerald-600 dark:text-emerald-400 text-sm sm:text-base">{p.name.charAt(0)}</span>
                                    {/if}
                                </div>
                                <div class="absolute top-1.5 right-1.5 z-10">
                                    <span class="px-1.5 py-0.5 rounded-md text-[8px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 uppercase tracking-tight shadow-2xs">
                                        FREE
                                    </span>
                                </div>
                            </div>

                            <!-- Body -->
                            <div class="p-2.5 sm:p-3 flex-1 flex flex-col justify-between gap-2 min-w-0">
                                <div>
                                    <div class="flex items-center justify-between gap-1 text-[9px] text-[var(--text-3)] font-semibold mb-1">
                                        <span class="truncate max-w-[70%] font-mono">#{p.category_name || 'Freemium'}</span>
                                        <span class="text-amber-500 font-bold shrink-0">★ 5.0</span>
                                    </div>
                                    <h3 class="text-xs sm:text-sm font-bold text-[var(--text)] line-clamp-1 sm:line-clamp-2 leading-snug group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                                        {p.name}
                                    </h3>
                                    <p class="text-[10px] text-[var(--text-3)] line-clamp-2 mt-1 leading-tight">
                                        {p.description || 'Gunakan tools gratis ini untuk kebutuhan bisnis Anda.'}
                                    </p>
                                </div>

                                <div class="pt-2 border-t border-[var(--border)]/60 flex flex-col gap-1.5 mt-1">
                                    <div class="min-w-0">
                                        <span class="text-[11px] sm:text-xs font-black text-emerald-600 dark:text-emerald-400 block truncate">
                                            GRATIS (Rp 0)
                                        </span>
                                    </div>
                                    <a
                                        href="#/member/orders/create?product_id={p.id}"
                                        class="w-full py-1.5 sm:py-2 px-2 rounded-xl text-[10px] sm:text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-2xs active:scale-95 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer shadow-emerald-500/20"
                                    >
                                        <span>Klaim Gratis</span>
                                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Desktop Free Products Grid (hidden md:grid) -->
                <div class="hidden md:grid products-grid">
                    {#each freeProducts as p, idx}
                        {@const tone = tones[idx % tones.length]}
                        <article class="product-card">
                            <div class="product-visual {tone}">
                                <span class="corner-label green">FREE</span>
                                <div class="product-orbit">
                                    {#if p.image && !imgErrorMap[p.id]}
                                        <img
                                            src={p.image}
                                            alt={p.name}
                                            class="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/20 relative z-10"
                                            on:error={() => imgErrorMap[p.id] = true}
                                        />
                                    {:else}
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                        </svg>
                                    {/if}
                                </div>
                                <span class="visual-brand">ZIQVA</span>
                            </div>
                            <div class="product-copy">
                                <div class="product-meta">
                                    <span>{p.category_name || 'Tools Gratis'}</span>
                                    <span>
                                        <svg fill="currentColor" viewBox="0 0 20 20">
                                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                                        </svg>
                                        5.0
                                    </span>
                                </div>
                                <h3>{p.name}</h3>
                                <p>{p.description || 'Gunakan software gratis ini untuk mendukung kebutuhan operasional harian Anda.'}</p>
                                <div class="price-row">
                                    <div>
                                        <small>Harga</small>
                                        <div class="flex items-baseline gap-1">
                                            <strong class="free-price">GRATIS</strong>
                                        </div>
                                    </div>
                                    <a href="#/member/orders/create?product_id={p.id}">
                                        Klaim Lisensi Gratis
                                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </article>
                    {/each}
                </div>
            {:else}
                <div class="p-4 sm:p-5 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                    <div class="flex items-center gap-3.5">
                        <div class="w-9 h-9 rounded-xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] flex items-center justify-center text-[var(--text-3)] flex-shrink-0">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                        </div>
                        <div>
                            <strong class="text-[var(--text)] dark:text-white block font-bold text-xs sm:text-sm">Belum ada software gratis aktif</strong>
                            <span class="text-[var(--text-3)] dark:text-slate-400 text-xs mt-0.5 block">
                                Software dengan lisensi gratis akan langsung muncul di katalog ini saat dirilis.
                            </span>
                        </div>
                    </div>
                    <a
                        href="#/member/orders/create"
                        class="px-4 py-2 rounded-xl bg-[var(--surface)] dark:bg-[#101827] hover:bg-[var(--surface-2)] text-[var(--text)] dark:text-slate-200 border border-[var(--border)] dark:border-[#22314d] font-bold text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0"
                    >
                        <span>Katalog Lisensi</span>
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>
            {/if}
        </section>

        <!-- Footer -->
        <footer class="app-footer">
            <a href="#/member/dashboard" class="brand">
                <span class="brand-mark">
                    <img src="/favicon.svg" alt="Appcenter Logo" class="w-5 h-5 object-contain" />
                </span>
                <span>Appcenter <b>Ziqva</b></span>
            </a>
            <span>© 2026 Appcenter Ziqva. Solusi digital, tanpa ribet.</span>
            <div>
                <a href="#/terms">Syarat</a>
                <a href="#/privacy">Privasi</a>
            </div>
        </footer>
    </main>

    <!-- Svelte Reactive Global Floating Tooltip Portal -->
    {#if activeTooltip}
        <div
            class="fixed z-[9999] pointer-events-none transform -translate-x-1/2 -translate-y-full px-2.5 py-1 text-[11px] font-semibold text-slate-100 bg-[#0f172a]/95 dark:bg-[#1e293b]/95 border border-slate-700/80 rounded-lg shadow-2xl backdrop-blur-md flex items-center gap-1.5 tracking-wide transition-all duration-150 animate-fade-in"
            style="left: {activeTooltip.x}px; top: {activeTooltip.y}px;"
        >
            <span>{activeTooltip.text}</span>
            <div class="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-[#0f172a]/95 dark:border-t-[#1e293b]/95"></div>
        </div>
    {/if}
</Layout>
