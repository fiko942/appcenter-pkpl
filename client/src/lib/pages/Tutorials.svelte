<script lang="ts">
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import Layout from '../components/Layout.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';

    export let params: { id?: string } = {};

    interface RawTutorialItem {
        id?: string;
        title?: string;
        url: string;
        embedUrl?: string;
        videoId?: string;
        isPlaylist?: boolean;
        playlistId?: string;
    }

    interface ProductCatalogItem {
        id: number;
        name: string;
        description: string;
        image?: string | null;
        installer_files?: string | { windows?: any[]; mac?: any[] } | null;
        video_count: number;
        has_tutorials: boolean;
    }

    let products: ProductCatalogItem[] = [];
    let selectedProductId: number = 0; // 0 = Catalog Grid View, > 0 = Detail Video View
    let selectedVideoIndex: number = 0;
    let catalogSearchQuery: string = '';
    let chapterSearchQuery: string = '';
    let catalogFilter: 'all' | 'has_video' | 'no_video' = 'all';
    let mobileDetailTab: 'playlist' | 'info' = 'playlist';
    let loading: boolean = true;
    let detailLoading: boolean = false;
    let detailError: string = '';
    let imgErrorMap: Record<number | string, boolean> = {};

    // Cache of loaded tutorials per product to prevent re-fetching
    let tutorialsCache: Record<number, RawTutorialItem[]> = {};

    function parseYouTube(url: string, embed?: string, videoId?: string): string {
        if (embed) {
            return embed.includes('youtube-nocookie.com') ? embed : embed.replace('youtube.com', 'youtube-nocookie.com');
        }
        if (!url) return '';
        const clean = url.trim();
        const listMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
        if (clean.includes('/playlist') && listMatch) {
            return `https://www.youtube-nocookie.com/embed/videoseries?list=${listMatch[1]}`;
        }
        const shortsMatch = clean.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i);
        if (shortsMatch) {
            return `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}`;
        }
        const youtuMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i);
        if (youtuMatch) {
            return `https://www.youtube-nocookie.com/embed/${youtuMatch[1]}${listMatch ? `?list=${listMatch[1]}` : ''}`;
        }
        const watchMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]+)/i);
        if (watchMatch) {
            return `https://www.youtube-nocookie.com/embed/${watchMatch[1]}${listMatch ? `?list=${listMatch[1]}` : ''}`;
        }
        return clean;
    }

    $: selectedProduct = products.find(p => p.id === selectedProductId) || null;

    $: currentTutorials = selectedProductId ? (tutorialsCache[selectedProductId] || []) : [];

    $: filteredTutorials = currentTutorials.filter(t => {
        if (!chapterSearchQuery.trim()) return true;
        const q = chapterSearchQuery.toLowerCase().trim();
        return (t.title || '').toLowerCase().includes(q);
    });

    $: currentVideo = currentTutorials[selectedVideoIndex] || currentTutorials[0] || null;

    $: currentEmbedUrl = currentVideo ? parseYouTube(currentVideo.url, currentVideo.embedUrl, currentVideo.videoId) : '';

    // Catalog filtering
    $: productsWithVideoCount = products.filter(p => p.has_tutorials).length;
    $: productsWithoutVideoCount = products.filter(p => !p.has_tutorials).length;

    $: catalogDropdownOptions = [
        { value: 'all', label: `Semua Software (${products.length})` },
        { value: 'has_video', label: `Ada Video (${productsWithVideoCount})` },
        ...(productsWithoutVideoCount > 0 ? [{ value: 'no_video', label: `Belum Ada (${productsWithoutVideoCount})` }] : [])
    ];

    $: catalogTabs = [
        { id: 'all', label: 'Semua Software', count: products.length, color: 'blue' as const },
        { id: 'has_video', label: 'Tersedia Video Panduan', count: productsWithVideoCount, color: 'emerald' as const },
        ...(productsWithoutVideoCount > 0 ? [{ id: 'no_video', label: 'Belum Ada Video', count: productsWithoutVideoCount, color: 'slate' as const }] : [])
    ];

    $: filteredCatalogProducts = products.filter(p => {
        const matchFilter =
            catalogFilter === 'all' ? true :
            catalogFilter === 'has_video' ? p.has_tutorials :
            !p.has_tutorials;

        const q = catalogSearchQuery.toLowerCase().trim();
        const matchSearch = !q || p.name.toLowerCase().includes(q) || (p.description && p.description.toLowerCase().includes(q));

        return matchFilter && matchSearch;
    });

    // Reactive route sync: handles #/member/tutorials/:id and browser back/forward buttons
    $: routeProdId = params?.id ? parseInt(params.id, 10) : 0;

    $: if (routeProdId && routeProdId !== selectedProductId) {
        selectedProductId = routeProdId;
        selectedVideoIndex = 0;
        mobileDetailTab = 'playlist';
        loadProductTutorials(routeProdId);
    } else if (!routeProdId && selectedProductId !== 0) {
        selectedProductId = 0;
        selectedVideoIndex = 0;
        mobileDetailTab = 'playlist';
    }

    async function loadProductTutorials(prodId: number) {
        if (tutorialsCache[prodId]) {
            detailLoading = false;
            return;
        }

        detailLoading = true;
        detailError = '';

        try {
            const res = await fetch(`/member/api/tutorials/${prodId}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (res.status === 401 || res.status === 403) {
                window.location.hash = '/member/login';
                return;
            }
            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data && json.data.product) {
                tutorialsCache[prodId] = json.data.product.tutorials || [];
                // Update cached count & installer_files in products list
                const idx = products.findIndex(p => p.id === prodId);
                if (idx !== -1) {
                    products[idx].video_count = tutorialsCache[prodId].length;
                    products[idx].has_tutorials = tutorialsCache[prodId].length > 0;
                    if (json.data.product.installer_files !== undefined) {
                        products[idx].installer_files = json.data.product.installer_files;
                    }
                    products = [...products];
                }
            } else {
                detailError = json.message || 'Gagal memuat materi tutorial.';
            }
        } catch (err) {
            console.error('Error loading product tutorials:', err);
            detailError = 'Terjadi kesalahan sistem saat mengambil video tutorial.';
        } finally {
            detailLoading = false;
        }
    }

    onMount(async () => {
        try {
            const res = await fetch('/member/api/tutorials', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (res.status === 401 || res.status === 403) {
                window.location.hash = '/member/login';
                return;
            }
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'success' && json.data && json.data.products) {
                    products = json.data.products || [];

                    // If route has an ID on initial page load
                    const initialId = params?.id ? parseInt(params.id, 10) : 0;
                    if (initialId) {
                        selectedProductId = initialId;
                        await loadProductTutorials(initialId);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to fetch tutorials catalog:', e);
        } finally {
            loading = false;
        }
    });

    function selectProduct(prod: ProductCatalogItem) {
        window.scrollTo({ top: 0, behavior: 'smooth' });
        push(`/member/tutorials/${prod.id}`);
    }

    function backToCatalog() {
        detailError = '';
        chapterSearchQuery = '';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        push('/member/tutorials');
    }

    function selectLesson(idx: number) {
        selectedVideoIndex = idx;
        const playerEl = document.getElementById('tutorial-video-player');
        if (playerEl && typeof window !== 'undefined' && window.innerWidth < 1024) {
            playerEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function handleCatalogDropdownFilter(e: CustomEvent<string | number>) {
        catalogFilter = String(e.detail) as 'all' | 'has_video' | 'no_video';
    }
</script>

<Layout activePage="tutorials" eyebrow="PUSAT BELAJAR & PANDUAN TOOL">
    <main class="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-5 md:space-y-6">
        {#if loading}
            <div class="p-16 text-center text-[var(--text-3)] space-y-3">
                <div class="w-9 h-9 mx-auto border-3 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
                <p class="text-xs font-semibold">Memuat pusat belajar & software...</p>
            </div>
        {:else if selectedProductId === 0 || !selectedProduct}
            <!-- ================= VIEW 1: CATALOG GRID OVERVIEW (URL: #/member/tutorials) ================= -->
            <div class="space-y-4 md:space-y-6 animate-fade-in">
                <!-- Page Header -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white shadow-md shrink-0">
                            <svg class="w-5 h-5 md:w-6 md:h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </div>
                        <div>
                            <span class="text-[10px] font-black uppercase tracking-wider text-[var(--brand)]">VIDEO TUTORIAL RESMI</span>
                            <h1 class="text-xl md:text-2xl font-extrabold text-[var(--text)]">Pusat Belajar & Panduan Produk</h1>
                            <p class="text-[var(--text-3)] text-xs md:text-sm mt-0.5">Pilih produk software di bawah untuk membuka daftar materi dan memutar video panduan resminya.</p>
                        </div>
                    </div>

                    <!-- Desktop Search Input -->
                    <div class="hidden md:block w-72 lg:w-80 relative">
                        <input
                            type="text"
                            bind:value={catalogSearchQuery}
                            placeholder="Cari software atau tutorial..."
                            class="w-full pl-9 pr-4 py-2 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)] shadow-xs transition-colors"
                        />
                        <svg class="w-4 h-4 text-[var(--text-3)] dark:text-slate-400 absolute left-3 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                <!-- Mobile Single-Row Search + Dropdown Toolbar (block md:hidden) -->
                <div class="block md:hidden">
                    <div class="p-2.5 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-2 shadow-2xs">
                        <div class="flex-1 min-w-0 relative">
                            <input
                                type="text"
                                bind:value={catalogSearchQuery}
                                placeholder="Cari software..."
                                class="w-full pl-8 pr-2.5 py-1.5 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)] transition-colors"
                            />
                            <svg class="w-3.5 h-3.5 text-[var(--text-3)] dark:text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <div class="shrink-0">
                            <CustomSelect
                                options={catalogDropdownOptions}
                                value={catalogFilter}
                                fullWidth={false}
                                on:change={handleCatalogDropdownFilter}
                            />
                        </div>
                    </div>
                </div>

                <!-- Desktop Filter Tabs (hidden md:flex) -->
                <div class="hidden md:flex items-center gap-2">
                    <SegmentedTabs
                        tabs={catalogTabs}
                        activeTab={catalogFilter}
                        on:change={(e) => catalogFilter = e.detail}
                    />
                </div>

                <!-- Product Catalog Grid -->
                {#if filteredCatalogProducts.length === 0}
                    <div class="p-12 md:p-16 text-center bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] border-dashed rounded-3xl space-y-3">
                        <div class="w-12 h-12 mx-auto rounded-2xl bg-[var(--surface-2)] dark:bg-slate-800 border border-[var(--border)] dark:border-slate-700 flex items-center justify-center text-[var(--text-3)] dark:text-slate-400">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </div>
                        <h3 class="font-bold text-sm text-[var(--text)] dark:text-white">Tidak Ada Software Ditemukan</h3>
                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400 max-w-sm mx-auto">
                            {#if catalogSearchQuery}
                                Tidak ditemukan software yang cocok dengan kata kunci "{catalogSearchQuery}".
                            {:else}
                                Belum ada daftar software pada filter yang dipilih.
                            {/if}
                        </p>
                    </div>
                {:else}
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 sm:gap-5">
                        {#each filteredCatalogProducts as prod (prod.id)}
                            {@const hasVideos = prod.has_tutorials}
                            <a
                                href="#/member/tutorials/{prod.id}"
                                class="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] hover:border-blue-500/80 dark:hover:border-blue-500/80 hover:shadow-md transition-all flex flex-col justify-between space-y-3 sm:space-y-4 group block text-left"
                            >
                                <div class="space-y-2.5 sm:space-y-3">
                                    <!-- Top Row: Icon & Status Badge -->
                                    <div class="flex items-start justify-between gap-3">
                                        {#if prod.image && !imgErrorMap[prod.id]}
                                            <img
                                                src={prod.image}
                                                alt={prod.name}
                                                class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-slate-800 shrink-0 group-hover:scale-105 transition-transform shadow-xs"
                                                on:error={() => imgErrorMap[prod.id] = true}
                                            />
                                        {:else}
                                            <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-sm sm:text-base shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                                                {prod.name.charAt(0).toUpperCase()}
                                            </div>
                                        {/if}

                                        <div>
                                            {#if hasVideos}
                                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] sm:text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 dark:border-emerald-500/40 shadow-2xs">
                                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                    <span>{prod.video_count} Video Panduan</span>
                                                </span>
                                            {:else}
                                                <span class="inline-flex items-center gap-1.5 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-[var(--surface-2)] dark:bg-[#1e293b] text-[var(--text-3)] dark:text-slate-400 border border-[var(--border)] dark:border-slate-700">
                                                    Belum Ada Video
                                                </span>
                                            {/if}
                                        </div>
                                    </div>

                                    <!-- Title & Description -->
                                    <div>
                                        <h3 class="font-extrabold text-sm sm:text-base text-[var(--text)] dark:text-white group-hover:text-[var(--brand)] dark:group-hover:text-blue-400 transition-colors line-clamp-1">
                                            {prod.name}
                                        </h3>
                                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400 line-clamp-2 mt-1 leading-relaxed">
                                            {prod.description || 'Panduan video lengkap penggunaan fitur, instalasi, dan tips otomatisasi software.'}
                                        </p>
                                    </div>
                                </div>

                                <!-- Card Action Footer -->
                                <div class="pt-2.5 sm:pt-3 border-t border-[var(--border)]/70 dark:border-[#22314d] flex items-center justify-between">
                                    <span class="text-[11px] font-semibold text-[var(--text-3)] dark:text-slate-400">
                                        {hasVideos ? `${prod.video_count} Bab Materi` : 'Segera Hadir'}
                                    </span>

                                    <div
                                        class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 {hasVideos ? 'bg-blue-600/10 dark:bg-blue-600/20 group-hover:bg-blue-600 dark:group-hover:bg-blue-600 text-blue-600 dark:text-blue-400 group-hover:text-white dark:group-hover:text-white border border-blue-600/30 dark:border-blue-500/40 shadow-2xs' : 'bg-[var(--surface-2)] dark:bg-[#1e293b] text-[var(--text-2)] dark:text-slate-300 border border-[var(--border)] dark:border-slate-700'}"
                                    >
                                        <span>{hasVideos ? 'Buka Materi' : 'Lihat Detail'}</span>
                                        <svg class="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </div>
                                </div>
                            </a>
                        {/each}
                    </div>
                {/if}
            </div>
        {:else}
            <!-- ================= VIEW 2: PRODUCT TUTORIAL DETAIL (URL: #/member/tutorials/<id>) ================= -->
            <div class="space-y-4 md:space-y-6 animate-fade-in">
                <!-- Navigation Header -->
                <div class="p-3 sm:p-4 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-3 shadow-xs">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <button
                            type="button"
                            on:click={backToCatalog}
                            class="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[var(--surface-2)] dark:bg-slate-800 hover:bg-[var(--border)] dark:hover:bg-slate-700 border border-[var(--border)] dark:border-slate-700 text-xs font-bold text-[var(--text)] dark:text-white transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                            title="Kembali ke Katalog"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                            </svg>
                            <span class="hidden sm:inline">Kembali ke Katalog</span>
                            <span class="inline sm:hidden">Katalog</span>
                        </button>

                        <div class="h-4 w-px bg-[var(--border)] dark:bg-slate-700"></div>

                        <div class="flex items-center gap-2 min-w-0">
                            {#if selectedProduct.image && !imgErrorMap[selectedProduct.id]}
                                <img
                                    src={selectedProduct.image}
                                    alt={selectedProduct.name}
                                    class="w-6 h-6 sm:w-7 sm:h-7 rounded-lg object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-slate-800 shrink-0"
                                    on:error={() => imgErrorMap[selectedProduct.id] = true}
                                />
                            {/if}
                            <h1 class="text-sm sm:text-base font-extrabold text-[var(--text)] dark:text-white truncate">{selectedProduct.name}</h1>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>{currentTutorials.length} Bab</span>
                            </span>
                        </div>
                    </div>

                    {#if !detailLoading && currentTutorials.length > 0}
                        <div class="hidden sm:block relative w-56 lg:w-64">
                            <input
                                type="text"
                                bind:value={chapterSearchQuery}
                                placeholder="Cari materi bab..."
                                class="w-full pl-8 pr-3 py-1.5 bg-[var(--surface-2)] dark:bg-slate-800/80 border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)]"
                            />
                            <svg class="w-3.5 h-3.5 text-[var(--text-3)] dark:text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                    {/if}
                </div>

                {#if detailLoading}
                    <!-- Loading Skeleton -->
                    <div class="p-16 text-center space-y-4 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] rounded-3xl">
                        <div class="w-10 h-10 mx-auto border-3 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
                        <div>
                            <h3 class="text-sm font-bold text-[var(--text)] dark:text-white">Memuat Video Tutorial {selectedProduct.name}...</h3>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-1">Mengambil daftar materi video & playlist resmi...</p>
                        </div>
                    </div>
                {:else if detailError}
                    <div class="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between gap-4">
                        <span>{detailError}</span>
                        <button
                            type="button"
                            on:click={() => loadProductTutorials(selectedProduct.id)}
                            class="px-3 py-1.5 rounded-xl bg-rose-500/20 text-rose-300 font-bold hover:bg-rose-500/30 transition-colors"
                        >
                            Coba Lagi
                        </button>
                    </div>
                {:else if currentTutorials.length > 0}
                    <!-- Video Hero Section & Top Controller (Anchor for smooth scroll) -->
                    <div id="tutorial-video-player" class="scroll-mt-20 space-y-3 sm:space-y-4">
                        <!-- 16:9 Video Box -->
                        <div class="relative w-full pb-[56.25%] rounded-2xl sm:rounded-3xl overflow-hidden bg-black border border-[var(--border)] dark:border-[#22314d] shadow-2xl">
                            {#if currentEmbedUrl}
                                <iframe
                                    src={currentEmbedUrl.includes('?') ? `${currentEmbedUrl}&autoplay=0&rel=0` : `${currentEmbedUrl}?autoplay=0&rel=0`}
                                    title={currentVideo ? currentVideo.title : selectedProduct.name}
                                    class="absolute inset-0 w-full h-full border-0"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                    referrerpolicy="strict-origin-when-cross-origin"
                                    allowfullscreen
                                ></iframe>
                            {:else}
                                <div class="absolute inset-0 flex items-center justify-center text-gray-400 bg-black text-xs">
                                    <p>Video tidak dapat dimuat atau URL belum valid.</p>
                                </div>
                            {/if}
                        </div>

                        <!-- Unified Media Controller Strip (Directly Below Video) -->
                        <div class="p-3 sm:p-4 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-3 shadow-xs">
                            <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                <div class="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 border border-blue-500/20">
                                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                </div>
                                <div class="min-w-0 flex-1">
                                    <div class="flex items-center gap-2">
                                        <span class="text-[11px] font-bold text-[var(--text)] dark:text-white truncate">
                                            Bab {selectedVideoIndex + 1} dari {currentTutorials.length}
                                        </span>
                                        <span class="text-[10px] font-mono text-[var(--text-3)] dark:text-slate-400 font-bold shrink-0">
                                            {Math.round(((selectedVideoIndex + 1) / currentTutorials.length) * 100)}%
                                        </span>
                                    </div>
                                    <!-- Mini Progress Bar -->
                                    <div class="w-full bg-[var(--surface-2)] dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1 border border-[var(--border)] dark:border-slate-700">
                                        <div class="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300 rounded-full" style="width: {((selectedVideoIndex + 1) / currentTutorials.length) * 100}%;"></div>
                                    </div>
                                </div>
                            </div>

                            <div class="flex items-center gap-1.5 shrink-0">
                                <button
                                    type="button"
                                    disabled={selectedVideoIndex === 0}
                                    on:click={() => selectLesson(selectedVideoIndex - 1)}
                                    class="p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer {selectedVideoIndex === 0 ? 'opacity-40 cursor-not-allowed bg-[var(--surface-2)] dark:bg-slate-800 text-[var(--text-3)] dark:text-slate-500 border-[var(--border)] dark:border-slate-800' : 'bg-[var(--surface-2)] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-[var(--text)] dark:text-white border-[var(--border)] dark:border-slate-700 active:scale-95'}"
                                    title="Bab Sebelumnya"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
                                    <span class="hidden sm:inline">Sebelumnya</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={selectedVideoIndex === currentTutorials.length - 1}
                                    on:click={() => selectLesson(selectedVideoIndex + 1)}
                                    class="p-2 sm:px-3 sm:py-1.5 rounded-xl border text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer {selectedVideoIndex === currentTutorials.length - 1 ? 'opacity-40 cursor-not-allowed bg-[var(--surface-2)] dark:bg-slate-800 text-[var(--text-3)] dark:text-slate-500 border-[var(--border)] dark:border-slate-800' : 'bg-blue-600 hover:bg-blue-500 text-white border-blue-600 shadow-xs active:scale-95'}"
                                    title="Bab Selanjutnya"
                                >
                                    <span class="hidden sm:inline">Selanjutnya</span>
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Mobile Segmented Tabs & Content (block lg:hidden) -->
                    <div class="block lg:hidden space-y-3.5">
                        <!-- Segmented Tab Switcher with Sliding Pill Animation -->
                        <div class="p-1 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] relative flex items-center select-none overflow-hidden">
                            <!-- Sliding Pill Backdrop -->
                            <div
                                class="absolute top-1 bottom-1 left-1 w-[calc(50%-4px)] rounded-lg bg-blue-600 shadow-md shadow-blue-500/25 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
                                style="transform: translateX({mobileDetailTab === 'playlist' ? '0%' : '100%'});"
                            ></div>

                            <button
                                type="button"
                                on:click={() => mobileDetailTab = 'playlist'}
                                class="relative z-10 flex-1 py-2 rounded-lg text-xs font-bold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 cursor-pointer border-0 bg-transparent {mobileDetailTab === 'playlist' ? 'text-white font-bold' : 'text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white'}"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
                                <span>Daftar Bab ({currentTutorials.length})</span>
                            </button>
                            <button
                                type="button"
                                on:click={() => mobileDetailTab = 'info'}
                                class="relative z-10 flex-1 py-2 rounded-lg text-xs font-bold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 cursor-pointer border-0 bg-transparent {mobileDetailTab === 'info' ? 'text-white font-bold' : 'text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white'}"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                <span>Detail & Download</span>
                            </button>
                        </div>

                        {#if mobileDetailTab === 'playlist'}
                            <!-- Chapter Playlist (Mobile Tab 1) -->
                            <div class="p-3 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] space-y-2.5">
                                <div class="relative w-full">
                                    <input
                                        type="text"
                                        bind:value={chapterSearchQuery}
                                        placeholder="Cari materi bab..."
                                        class="w-full pl-8 pr-3 py-1.5 bg-[var(--surface-2)] dark:bg-[#070d19] border border-[var(--border)] dark:border-slate-800 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)]"
                                    />
                                    <svg class="w-3.5 h-3.5 text-[var(--text-3)] dark:text-slate-400 absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                    </svg>
                                </div>

                                <div class="space-y-1.5">
                                    {#if filteredTutorials.length === 0}
                                        <div class="p-6 text-center text-xs text-[var(--text-3)] dark:text-slate-400">
                                            Tidak ada materi yang cocok dengan pencarian.
                                        </div>
                                    {:else}
                                        {#each filteredTutorials as tut, idx}
                                            {@const isCurrent = idx === selectedVideoIndex}
                                            <button
                                                type="button"
                                                class="w-full p-3 rounded-xl text-left transition-all flex items-start gap-3 cursor-pointer {isCurrent ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : idx % 2 === 1 ? 'bg-slate-100/70 dark:bg-[#141f36] hover:bg-blue-50/70 dark:hover:bg-[#1a2845] text-[var(--text-2)] dark:text-slate-300' : 'bg-[var(--surface)] dark:bg-[#0c1322] hover:bg-blue-50/70 dark:hover:bg-[#1a2845] text-[var(--text-2)] dark:text-slate-300'} border border-[var(--border)]/60 dark:border-[#22314d]/70"
                                                on:click={() => selectLesson(idx)}
                                            >
                                                <div class="w-6 h-6 rounded-lg {isCurrent ? 'bg-white text-blue-600 font-black' : 'bg-[var(--surface-2)] dark:bg-slate-800 text-[var(--text-3)] dark:text-slate-400'} flex items-center justify-center font-bold text-[11px] shrink-0 mt-0.5 shadow-xs">
                                                    {#if isCurrent}
                                                        <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                                    {:else}
                                                        {idx + 1 < 10 ? '0' + (idx + 1) : (idx + 1)}
                                                    {/if}
                                                </div>
                                                <div class="min-w-0 flex-1">
                                                    <strong class="text-xs font-bold block truncate leading-snug {isCurrent ? 'text-white' : 'text-[var(--text)] dark:text-white'}">
                                                        {tut.title || `${selectedProduct.name} - Part ${idx + 1}`}
                                                    </strong>
                                                    <p class="text-[10.5px] {isCurrent ? 'text-white/90' : 'text-[var(--text-3)] dark:text-slate-400'} mt-0.5 truncate">
                                                        Materi Video Bab {idx + 1}
                                                    </p>
                                                </div>
                                            </button>
                                        {/each}
                                    {/if}
                                </div>
                            </div>
                        {:else}
                            <!-- Info & Download (Mobile Tab 2) -->
                            <div class="p-4 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] space-y-4 shadow-xs">
                                <div>
                                    <div class="flex items-center gap-2 mb-1.5">
                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                            Bab {selectedVideoIndex + 1}
                                        </span>
                                        <span class="text-xs font-semibold text-[var(--text-3)] dark:text-slate-400">{selectedProduct.name}</span>
                                    </div>
                                    <h2 class="text-base font-extrabold text-[var(--text)] dark:text-white leading-snug">
                                        {currentVideo ? (currentVideo.title || `${selectedProduct.name} - Part ${selectedVideoIndex + 1}`) : 'Video Panduan'}
                                    </h2>
                                    <p class="text-xs text-[var(--text-3)] dark:text-slate-400 leading-relaxed mt-2">
                                        {selectedProduct.description || `Panduan resmi langkah demi langkah untuk mengoperasikan fitur software ${selectedProduct.name}.`}
                                    </p>
                                </div>

                                <div class="pt-3 border-t border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                    <div class="flex items-center gap-3 text-xs text-[var(--text-3)] dark:text-slate-400">
                                        <span class="inline-flex items-center gap-1.5">
                                            <svg class="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                            <span>Official Tutorial</span>
                                        </span>
                                        <span class="inline-flex items-center gap-1.5">
                                            <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                            <span>1080p HD</span>
                                        </span>
                                    </div>

                                    <a
                                        href="#/member/downloads?id={selectedProduct.id}"
                                        class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition-all shadow-xs inline-flex items-center justify-center gap-2 border-0"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                                        <span>Download File Software</span>
                                    </a>
                                </div>
                            </div>
                        {/if}
                    </div>

                    <!-- Desktop Split Layout (hidden lg:grid lg:grid-cols-12) -->
                    <div class="hidden lg:grid lg:grid-cols-12 gap-6 items-start">
                        <!-- Left/Center: Now Playing Info (8 Cols) -->
                        <div class="lg:col-span-8">
                            <div class="p-6 rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] space-y-4 shadow-xs">
                                <div class="flex items-center justify-between gap-3">
                                    <div class="flex items-center gap-2">
                                        <span class="px-2.5 py-1 rounded-xl text-xs font-mono font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                            Bab {selectedVideoIndex + 1}
                                        </span>
                                        <span class="text-xs font-semibold text-[var(--text-3)] dark:text-slate-400">{selectedProduct.name}</span>
                                    </div>

                                    <div class="flex items-center gap-2">
                                        {#if selectedVideoIndex > 0}
                                            <button
                                                type="button"
                                                on:click={() => selectLesson(selectedVideoIndex - 1)}
                                                class="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] dark:bg-slate-800 hover:bg-[var(--border)] dark:hover:bg-slate-700 text-[var(--text)] dark:text-white border border-[var(--border)] dark:border-slate-700 text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer"
                                            >
                                                ← Sebelumnya
                                            </button>
                                        {/if}
                                        {#if selectedVideoIndex < currentTutorials.length - 1}
                                            <button
                                                type="button"
                                                on:click={() => selectLesson(selectedVideoIndex + 1)}
                                                class="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all inline-flex items-center gap-1 cursor-pointer shadow-xs"
                                            >
                                                Selanjutnya →
                                            </button>
                                        {/if}
                                    </div>
                                </div>

                                <div>
                                    <h2 class="text-lg font-extrabold text-[var(--text)] dark:text-white leading-snug">
                                        {currentVideo ? (currentVideo.title || `${selectedProduct.name} - Part ${selectedVideoIndex + 1}`) : 'Video Panduan'}
                                    </h2>
                                    <p class="text-xs text-[var(--text-3)] dark:text-slate-400 leading-relaxed mt-1.5">
                                        {selectedProduct.description || `Panduan resmi langkah demi langkah untuk mengoperasikan fitur software ${selectedProduct.name}.`}
                                    </p>
                                </div>

                                <div class="pt-3 border-t border-[var(--border)] dark:border-[#22314d] flex items-center justify-between text-xs text-[var(--text-3)] dark:text-slate-400">
                                    <div class="flex items-center gap-4">
                                        <span class="flex items-center gap-1.5">
                                            <svg class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            Official Tutorial
                                        </span>
                                        <span class="flex items-center gap-1.5">
                                            <svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            1080p HD
                                        </span>
                                    </div>

                                    <a
                                        href="#/member/downloads?id={selectedProduct.id}"
                                        class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline inline-flex items-center gap-1"
                                    >
                                        <span>Download File Software</span>
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </a>
                                </div>
                            </div>
                        </div>

                        <!-- Right/Sidebar: Playlist of Chapters (4 Cols) -->
                        <div class="lg:col-span-4 rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] overflow-hidden shadow-xs">
                            <div class="p-4 border-b border-[var(--border)] dark:border-[#22314d] flex items-center justify-between bg-[var(--surface-2)] dark:bg-[#131d31]">
                                <div>
                                    <span class="text-[10px] font-bold text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider">DAFTAR BAB</span>
                                    <h3 class="text-sm font-extrabold text-[var(--text)] dark:text-white">{selectedProduct.name}</h3>
                                </div>
                                <span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 text-[var(--text-2)] dark:text-slate-300">
                                    {filteredTutorials.length} Video
                                </span>
                            </div>

                            <div class="p-2 max-h-[580px] overflow-y-auto space-y-1.5">
                                {#if filteredTutorials.length === 0}
                                    <div class="p-8 text-center text-xs text-[var(--text-3)] dark:text-slate-400">
                                        Tidak ada materi yang cocok dengan pencarian.
                                    </div>
                                {:else}
                                    {#each filteredTutorials as tut, idx}
                                        {@const isCurrent = idx === selectedVideoIndex}
                                        <button
                                            type="button"
                                            class="w-full p-3 rounded-2xl text-left transition-all flex items-start gap-3 cursor-pointer {isCurrent ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20' : idx % 2 === 1 ? 'bg-slate-100/70 dark:bg-[#141f36] hover:bg-blue-50/70 dark:hover:bg-[#1a2845] text-[var(--text-2)] dark:text-slate-300' : 'bg-[var(--surface)] dark:bg-[#0c1322] hover:bg-blue-50/70 dark:hover:bg-[#1a2845] text-[var(--text-2)] dark:text-slate-300'}"
                                            on:click={() => selectLesson(idx)}
                                        >
                                            <div class="w-7 h-7 rounded-xl {isCurrent ? 'bg-white text-blue-600 font-black' : 'bg-[var(--surface-2)] dark:bg-slate-800 text-[var(--text-3)] dark:text-slate-400'} flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 shadow-xs">
                                                {#if isCurrent}
                                                    <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                                                {:else}
                                                    {idx + 1 < 10 ? '0' + (idx + 1) : (idx + 1)}
                                                {/if}
                                            </div>

                                            <div class="min-w-0 flex-1">
                                                <strong class="text-xs font-bold block truncate leading-snug {isCurrent ? 'text-white font-bold' : 'text-[var(--text)] dark:text-white'}">
                                                    {tut.title || `${selectedProduct.name} - Part ${idx + 1}`}
                                                </strong>
                                                <p class="text-[11px] {isCurrent ? 'text-white/90' : 'text-[var(--text-3)] dark:text-slate-400'} mt-0.5 truncate">
                                                    Panduan Penggunaan Bab {idx + 1}
                                                </p>
                                            </div>
                                        </button>
                                    {/each}
                                {/if}
                            </div>
                        </div>
                    </div>
                {:else}
                    <!-- Empty State for Product with 0 Tutorials -->
                    <div class="p-8 sm:p-12 text-center bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] rounded-3xl space-y-4 max-w-lg mx-auto my-6 sm:my-8 shadow-xs">
                        <div class="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20 dark:border-amber-500/30 flex items-center justify-center text-amber-500 dark:text-amber-400">
                            <svg class="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-base font-extrabold text-[var(--text)] dark:text-white">Belum Ada Video untuk {selectedProduct.name}</h3>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-1.5 max-w-sm mx-auto leading-relaxed">
                                Materi video tutorial untuk software ini sedang dipersiapkan oleh tim Ziqva. Anda tetap dapat mengunduh installer resmi atau menghubungi support.
                            </p>
                        </div>
                        <div class="flex items-center justify-center gap-3 pt-2">
                            <button
                                type="button"
                                on:click={backToCatalog}
                                class="px-4 py-2 bg-[var(--surface-2)] dark:bg-slate-800 hover:bg-[var(--border)] dark:hover:bg-slate-700 text-[var(--text)] dark:text-white border border-[var(--border)] dark:border-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                            >
                                ← Kembali ke Katalog
                            </button>
                            <a
                                href="#/member/downloads?id={selectedProduct.id}"
                                class="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs border-0"
                            >
                                Download Installer
                            </a>
                        </div>
                    </div>
                {/if}
            </div>
        {/if}

        <!-- Support Help Banner -->
        <div class="p-4 sm:p-5 rounded-2xl sm:rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs">
            <div class="flex items-center gap-3.5">
                <div class="w-10 h-10 rounded-2xl bg-purple-500/10 dark:bg-purple-950/40 border border-purple-500/20 dark:border-purple-800/80 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0 shadow-xs">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <h3 class="text-sm font-bold text-[var(--text)] dark:text-white">Masih butuh bantuan seputar software?</h3>
                    <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">Tim support Ziqva siap membantu jika Anda mengalami kendala instalasi atau penggunaan.</p>
                </div>
            </div>
            <a
                href="#/member/profile"
                class="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80 text-xs font-bold transition-all whitespace-nowrap shadow-xs inline-flex items-center justify-center gap-1.5"
            >
                <svg class="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>Bantuan & Support</span>
            </a>
        </div>
    </main>
</Layout>

<style>
    @keyframes fadeIn {
        from { opacity: 0; transform: translateY(6px); }
        to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
        animation: fadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
</style>
