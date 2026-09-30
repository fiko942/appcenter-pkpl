<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Layout from '../components/Layout.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';

    interface InstallerFile {
        id: string;
        filename: string;
        url: string;
        size: string;
        bytes: number;
        uploaded_at?: string;
    }

    interface ProductDownloadItem {
        id: number;
        name: string;
        description: string | null;
        image?: string | null;
        product_id?: number | null;
        category_id?: number | null;
        category_ids?: number[];
        category_name?: string | null;
        category_icon?: string | null;
        category_slug?: string | null;
        categories?: Array<{ id: number; name: string; slug: string; icon: string | null }>;
        price?: number;
        is_active?: boolean;
        installer_files?: {
            windows: InstallerFile[];
            mac: InstallerFile[];
        } | string | null;
        tutorials?: string | null;
    }

    let products: ProductDownloadItem[] = [];
    let files: any[] = [];
    let activeFilter: string = 'all';
    let searchQuery: string = '';
    let loading: boolean = true;
    let imgErrorMap: Record<number | string, boolean> = {};

    // Backend-driven Pagination State
    let page: number = 1;
    let pageSize: number = 24;
    let totalFiltered: number = 0;
    let totalPages: number = 1;
    let filterCounts = { all: 0, win: 0, mac: 0, tutorial: 0 };

    const pageSizeOptions: OptionItem[] = [
        { value: 6, label: '6 / hal' },
        { value: 9, label: '9 / hal' },
        { value: 12, label: '12 / hal' },
        { value: 24, label: '24 / hal' },
        { value: 0, label: 'Semua' }
    ];

    // Reactive Dropdown Options for Mobile Single-Row Toolbar
    $: catalogDropdownOptions = [
        { value: 'all', label: `Semua Software (${filterCounts.all})` },
        { value: 'win', label: `Windows (${filterCounts.win})` },
        { value: 'mac', label: `macOS (${filterCounts.mac})` },
        ...(filterCounts.tutorial > 0 ? [{ value: 'tutorial', label: `Ada Tutorial (${filterCounts.tutorial})` }] : [])
    ];

    // Reactive Tabs for Desktop Segmented Filter
    $: desktopTabs = [
        { id: 'all', label: 'Semua Software', count: filterCounts.all, color: 'blue' as const },
        { id: 'win', label: 'Windows', count: filterCounts.win, color: 'blue' as const },
        { id: 'mac', label: 'macOS', count: filterCounts.mac, color: 'slate' as const },
        ...(filterCounts.tutorial > 0 ? [{ id: 'tutorial', label: 'Ada Tutorial', count: filterCounts.tutorial, color: 'purple' as const }] : [])
    ];

    // Download Modal State
    let showDownloadModal: boolean = false;
    let selectedProductForDownload: ProductDownloadItem | null = null;
    let downloadOsFilter: 'all' | 'windows' | 'mac' = 'all';

    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;

    function getNormalizedInstallers(item: ProductDownloadItem): { windows: InstallerFile[]; mac: InstallerFile[] } {
        if (!item?.installer_files) return { windows: [], mac: [] };
        if (typeof item.installer_files === 'object') {
            return {
                windows: Array.isArray(item.installer_files.windows) ? item.installer_files.windows : [],
                mac: Array.isArray(item.installer_files.mac) ? item.installer_files.mac : []
            };
        }
        try {
            const parsed = JSON.parse(item.installer_files);
            return {
                windows: Array.isArray(parsed?.windows) ? parsed.windows : [],
                mac: Array.isArray(parsed?.mac) ? parsed.mac : []
            };
        } catch (e) {
            return { windows: [], mac: [] };
        }
    }

    function parseTutorials(raw?: string | null): any[] {
        if (!raw) return [];
        try {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            return Array.isArray(parsed) ? parsed : [];
        } catch (e) {
            return [];
        }
    }

    async function fetchDownloads() {
        loading = true;
        try {
            const params = new URLSearchParams({
                page: String(page),
                limit: String(pageSize),
                search: searchQuery.trim(),
                filter: activeFilter
            });
            const res = await fetch(`/member/api/downloads?${params.toString()}`, {
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
                    files = json.data.files || [];
                    if (json.data.pagination) {
                        page = json.data.pagination.page || 1;
                        totalFiltered = json.data.pagination.totalFiltered ?? products.length;
                        totalPages = json.data.pagination.totalPages || 1;
                        if (json.data.pagination.counts) {
                            filterCounts = json.data.pagination.counts;
                        }
                    }

                    // Check query param for auto-opening modal (e.g. #/member/downloads?id=102)
                    checkQueryParamModal();
                }
            }
        } catch (e) {
            console.error('Failed to load downloads:', e);
        } finally {
            loading = false;
        }
    }

    function checkQueryParamModal() {
        if (typeof window === 'undefined') return;
        const hash = window.location.hash || '';
        const queryIndex = hash.indexOf('?');
        if (queryIndex !== -1) {
            const queryStr = hash.substring(queryIndex + 1);
            const queryParams = new URLSearchParams(queryStr);
            const targetId = queryParams.get('id');
            const targetSearch = queryParams.get('search');

            if (targetSearch && !searchQuery) {
                searchQuery = targetSearch;
                page = 1;
                fetchDownloads();
                return;
            }

            if (targetId) {
                const numId = parseInt(targetId, 10);
                const matched = products.find(p => p.id === numId);
                if (matched) {
                    openDownloadModal(matched);
                    return;
                }
            }

            // Jika hasil pencarian spesifik menyisakan tepat 1 produk (atau ada kata kunci yang cocok), otomatis buka popup modal unduhan
            if (targetSearch && products.length > 0 && !showDownloadModal) {
                const searchLower = targetSearch.toLowerCase().trim();
                const exactMatch = products.find(p => p.name.toLowerCase().trim() === searchLower) || products[0];
                if (exactMatch) {
                    openDownloadModal(exactMatch);
                }
            }
        }
    }

    function setActiveFilter(newFilter: string) {
        if (activeFilter === newFilter) return;
        activeFilter = newFilter;
        page = 1;
        fetchDownloads();
    }

    function handleCatalogDropdownFilter(e: CustomEvent<string | number>) {
        setActiveFilter(String(e.detail));
    }

    function handleDesktopTabChange(e: CustomEvent<string>) {
        setActiveFilter(e.detail);
    }

    function clearSearch() {
        searchQuery = '';
        page = 1;
        fetchDownloads();
    }

    function resetFilters() {
        searchQuery = '';
        activeFilter = 'all';
        page = 1;
        fetchDownloads();
    }

    function handleSearchInput() {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            page = 1;
            fetchDownloads();
        }, 300);
    }

    function handlePageSizeChange(e: CustomEvent<string | number>) {
        pageSize = Number(e.detail);
        page = 1;
        fetchDownloads();
    }

    function goToPage(targetPage: number) {
        if (targetPage < 1 || targetPage > totalPages || targetPage === page) return;
        page = targetPage;
        fetchDownloads();
    }

    onMount(() => {
        fetchDownloads();
        if (typeof window !== 'undefined') {
            window.addEventListener('keydown', handleKeydown);
        }
    });

    onDestroy(() => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', handleKeydown);
        }
    });

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && showDownloadModal) {
            closeDownloadModal();
        }
    }

    function openDownloadModal(p: ProductDownloadItem, defaultOs: 'all' | 'windows' | 'mac' = 'all') {
        selectedProductForDownload = p;
        const inst = getNormalizedInstallers(p);
        if (defaultOs === 'all') {
            if (inst.windows.length > 0 && inst.mac.length === 0) {
                downloadOsFilter = 'windows';
            } else if (inst.mac.length > 0 && inst.windows.length === 0) {
                downloadOsFilter = 'mac';
            } else {
                downloadOsFilter = 'all';
            }
        } else {
            downloadOsFilter = defaultOs;
        }
        showDownloadModal = true;
    }

    function closeDownloadModal() {
        showDownloadModal = false;
        selectedProductForDownload = null;
    }

    $: modalInstallers = selectedProductForDownload ? getNormalizedInstallers(selectedProductForDownload) : { windows: [], mac: [] };
    $: modalWindowsFiles = modalInstallers.windows.map(f => ({ ...f, os: 'windows' as const }));
    $: modalMacFiles = modalInstallers.mac.map(f => ({ ...f, os: 'mac' as const }));
    $: modalTotalFilesCount = modalWindowsFiles.length + modalMacFiles.length;

    $: displayedInstallerFiles = (
        downloadOsFilter === 'windows' ? modalWindowsFiles :
        downloadOsFilter === 'mac' ? modalMacFiles :
        [...modalWindowsFiles, ...modalMacFiles]
    );

    function getFileExtensionBadge(filename: string): string {
        if (!filename) return 'FILE';
        const lower = filename.toLowerCase();
        if (lower.endsWith('.exe')) return 'EXE';
        if (lower.endsWith('.dmg')) return 'DMG';
        if (lower.endsWith('.zip')) return 'ZIP';
        if (lower.endsWith('.pkg')) return 'PKG';
        if (lower.endsWith('.app')) return 'APP';
        return 'FILE';
    }
</script>

<Layout activePage="downloads" eyebrow="PUSAT UNDUHAN & INSTALLER">
    <main class="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 animate-fade-in">
        
        <!-- Mobile Header & Compact 1-Row Toolbar (< md) -->
        <div class="block md:hidden space-y-3">
            <div>
                <h1 class="text-xl font-extrabold text-[var(--text)] dark:text-white">Pusat Unduhan</h1>
                <p class="text-[var(--text-3)] dark:text-slate-400 text-xs mt-0.5">Unduh installer resmi software Windows & macOS.</p>
            </div>

            <!-- Compact Single-Row Toolbar -->
            <div class="p-2.5 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-2 shadow-2xs">
                <div class="flex-1 min-w-0 relative">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        on:input={handleSearchInput}
                        placeholder="Cari software..."
                        class="w-full pl-8 pr-7 py-1.5 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)] transition-colors"
                    />
                    <svg class="w-3.5 h-3.5 text-[var(--text-3)] dark:text-slate-400 absolute left-2.5 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {#if searchQuery}
                        <button
                            type="button"
                            on:click={clearSearch}
                            class="absolute right-2 top-1.5 text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white p-0.5 rounded-md transition-colors cursor-pointer"
                            title="Bersihkan"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    {/if}
                </div>
                <div class="shrink-0">
                    <CustomSelect
                        options={catalogDropdownOptions}
                        value={activeFilter}
                        fullWidth={false}
                        on:change={handleCatalogDropdownFilter}
                    />
                </div>
            </div>
        </div>

        <!-- Desktop Header & Segmented Tabs (>= md) -->
        <div class="hidden md:block space-y-4">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                    <h1 class="text-2xl font-extrabold text-[var(--text)] dark:text-white">Pusat Unduhan Software</h1>
                    <p class="text-[var(--text-3)] dark:text-slate-400 text-sm mt-1">Unduh installer resmi software untuk Windows & macOS dalam berbagai versi rilis.</p>
                </div>

                <!-- Desktop Search Box -->
                <div class="relative w-full md:w-72">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        on:input={handleSearchInput}
                        placeholder="Cari nama software..."
                        class="w-full pl-9 pr-9 py-2.5 bg-[var(--surface-2)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)] transition-colors"
                    />
                    <svg class="w-4 h-4 text-[var(--text-3)] dark:text-slate-400 absolute left-3 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {#if searchQuery}
                        <button
                            type="button"
                            on:click={clearSearch}
                            class="absolute right-3 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white p-0.5 rounded-md transition-colors cursor-pointer"
                            title="Bersihkan pencarian"
                        >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Segmented Tabs for Desktop -->
            <SegmentedTabs
                tabs={desktopTabs}
                activeTab={activeFilter}
                on:change={handleDesktopTabChange}
                on:tabChange={handleDesktopTabChange}
            />
        </div>

        <!-- Product Software Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {#if loading}
                {#each Array(6) as _}
                    <div class="bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] rounded-2xl p-5 space-y-4 animate-pulse">
                        <div class="flex items-start justify-between gap-3">
                            <div class="w-12 h-12 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                            <div class="w-16 h-5 rounded-full bg-slate-200 dark:bg-slate-800"></div>
                        </div>
                        <div class="space-y-2">
                            <div class="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800"></div>
                            <div class="h-3 w-full rounded bg-slate-200 dark:bg-slate-800"></div>
                        </div>
                        <div class="pt-3 border-t border-[var(--border)] dark:border-[#22314d] flex justify-between items-center">
                            <div class="h-6 w-20 rounded bg-slate-200 dark:bg-slate-800"></div>
                            <div class="h-8 w-28 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
                        </div>
                    </div>
                {/each}
            {:else if products.length === 0}
                <div class="col-span-full py-16 text-center bg-[var(--surface)] dark:bg-[#101827] rounded-2xl border border-[var(--border)] dark:border-[#22314d] border-dashed flex flex-col items-center justify-center space-y-3">
                    <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-sm font-bold text-[var(--text-2)] dark:text-white">Tidak ada software yang cocok</h3>
                        <p class="text-[var(--text-3)] dark:text-slate-400 text-xs mt-1">Coba kata kunci pencarian atau filter yang lain.</p>
                    </div>
                    {#if searchQuery || activeFilter !== 'all'}
                        <button
                            type="button"
                            on:click={resetFilters}
                            class="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-md shadow-blue-500/20"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                            <span>Reset Filter & Pencarian</span>
                        </button>
                    {/if}
                </div>
            {:else}
                {#each products as p}
                    {@const installers = getNormalizedInstallers(p)}
                    {@const tuts = parseTutorials(p.tutorials)}
                    {@const winCount = installers.windows.length}
                    {@const macCount = installers.mac.length}
                    {@const totalFiles = winCount + macCount}

                    <div class="bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] rounded-2xl p-4 sm:p-5 shadow-xs hover:border-[var(--brand)] dark:hover:border-blue-500 transition-all flex flex-col justify-between space-y-3.5">
                        <div>
                            <!-- Card Header: Image + Name + Category + Status Badge -->
                            <div class="flex items-start gap-3 mb-2.5">
                                {#if p.image && !imgErrorMap[p.id]}
                                    <img
                                        src={p.image}
                                        alt={p.name}
                                        class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-slate-800 flex-shrink-0 shadow-xs"
                                        on:error={() => imgErrorMap[p.id] = true}
                                    />
                                {:else}
                                    <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 dark:from-blue-500/20 dark:to-indigo-500/20 border border-blue-500/20 dark:border-blue-500/40 flex items-center justify-center text-[var(--brand)] dark:text-blue-400 font-black text-sm flex-shrink-0 shadow-2xs">
                                        {p.name.charAt(0).toUpperCase()}
                                    </div>
                                {/if}

                                <div class="flex-1 min-w-0">
                                    <div class="flex items-center justify-between gap-1.5 flex-wrap">
                                        <h3 class="text-sm font-bold text-[var(--text)] dark:text-white truncate" title={p.name}>{p.name}</h3>
                                        {#if p.category_name}
                                            <span class="text-[10px] px-2 py-0.5 rounded-md bg-[var(--surface-2)] dark:bg-[#1e293b] text-[var(--text-3)] dark:text-slate-300 font-semibold border border-[var(--border)] dark:border-slate-700 whitespace-nowrap flex-shrink-0">
                                                {p.category_name}
                                            </span>
                                        {/if}
                                    </div>

                                    <!-- Platform & File Status Badges -->
                                    <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        {#if totalFiles > 0}
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 dark:border-emerald-500/40 shadow-2xs">
                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                <span>{totalFiles} File Tersedia</span>
                                            </span>
                                        {:else}
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/25 dark:border-amber-500/40">
                                                Belum Ada File
                                            </span>
                                        {/if}

                                        {#if winCount > 0}
                                            <span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-blue-500/10 dark:bg-blue-500/20 text-blue-500 dark:text-blue-400 font-bold border border-blue-500/20 dark:border-blue-500/40" title="Windows Installer">
                                                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.901-1.799"/>
                                                </svg>
                                                <span>Win</span>
                                            </span>
                                        {/if}

                                        {#if macCount > 0}
                                            <span class="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-500/10 dark:bg-slate-800 text-[var(--text-2)] dark:text-slate-300 font-bold border border-[var(--border)] dark:border-slate-700" title="macOS Installer">
                                                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.87.96-2.96-1 .04-2.16.67-2.85 1.48-.58.68-.97 1.76-.84 2.82 1.11.09 2.09-.56 2.73-1.34z"/>
                                                </svg>
                                                <span>Mac</span>
                                            </span>
                                        {/if}
                                    </div>
                                </div>
                            </div>

                            <!-- Description -->
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 line-clamp-2 leading-relaxed">{p.description || 'Aplikasi software resmi Ziqva Store dengan pembaruan dan tutorial berkala.'}</p>
                        </div>

                        <!-- Buttons Row: Compact, responsive and tactile -->
                        <div class="pt-3 border-t border-[var(--border)] dark:border-[#22314d] flex items-center gap-2">
                            <!-- Download Modal Opener Button -->
                            {#if totalFiles > 0}
                                <button
                                    type="button"
                                    on:click={() => openDownloadModal(p)}
                                    class="flex-1 py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/20 border-0"
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>Unduh ({totalFiles})</span>
                                </button>
                            {:else}
                                <button disabled class="flex-1 py-2 px-3 rounded-xl bg-[var(--surface-2)] dark:bg-[#1e293b] text-[var(--text-3)] dark:text-slate-400 border border-[var(--border)] dark:border-slate-700 text-xs font-semibold opacity-75 cursor-not-allowed flex items-center justify-center gap-1.5">
                                    <span>Belum Ada File</span>
                                </button>
                            {/if}

                            <!-- Tutorial Link Button -->
                            {#if tuts.length > 0}
                                <a
                                    href="#/member/tutorials/{p.id}"
                                    class="py-2 px-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 hover:bg-purple-100 dark:hover:bg-purple-900/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/80 transition-all font-bold text-xs flex items-center justify-center gap-1.5 shadow-2xs group flex-shrink-0"
                                    title="Buka Video Panduan ({tuts.length} Video)"
                                >
                                    <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span class="hidden sm:inline">Panduan ({tuts.length})</span>
                                    <span class="inline sm:hidden">({tuts.length})</span>
                                </a>
                            {/if}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>

        <!-- Interactive Pagination Footer Bar -->
        {#if !loading && totalFiltered > 0}
            <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs mt-4">
                <!-- Left: Info & Per Page selector -->
                <div class="flex flex-wrap items-center gap-3">
                    <span class="text-[var(--text-3)] dark:text-slate-300 text-center sm:text-left text-[11px] sm:text-xs">
                        Menampilkan <strong class="text-[var(--text)] dark:text-white font-bold">{pageSize === 0 ? 1 : (page - 1) * pageSize + 1} - {pageSize === 0 ? totalFiltered : Math.min(page * pageSize, totalFiltered)}</strong> dari <strong class="text-[var(--text)] dark:text-white font-bold">{totalFiltered}</strong> software
                    </span>

                    <div class="flex items-center gap-2 pl-3 border-l border-[var(--border)] dark:border-[#22314d]">
                        <span class="text-[11px] text-[var(--text-3)] dark:text-slate-300 font-medium">Per Hal:</span>
                        <CustomSelect
                            options={pageSizeOptions}
                            bind:value={pageSize}
                            on:change={handlePageSizeChange}
                        />
                    </div>
                </div>

                <!-- Right: Page Numbers -->
                {#if totalPages > 1 && pageSize > 0}
                    <div class="flex items-center justify-center gap-1 self-center sm:self-auto">
                        <!-- Prev Button (Arrow Icon Only) -->
                        <button
                            type="button"
                            on:click={() => goToPage(page - 1)}
                            disabled={page <= 1}
                            class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-[#1e293b] text-[var(--text)] dark:text-slate-200 hover:bg-[var(--surface)] dark:hover:bg-slate-700 font-bold transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center shadow-xs"
                            title="Halaman sebelumnya"
                            aria-label="Halaman sebelumnya"
                        >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <!-- Numbers -->
                        <div class="flex items-center gap-1">
                            {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
                                {#if p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)}
                                    <button
                                        type="button"
                                        on:click={() => goToPage(p)}
                                        class="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center {p === page ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border-0' : 'bg-[var(--surface-2)] dark:bg-[#1e293b] text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white border border-[var(--border)] dark:border-slate-700 shadow-2xs'}"
                                    >
                                        {p}
                                    </button>
                                {:else if p === page - 2 || p === page + 2}
                                    <span class="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-3)] dark:text-slate-500 font-bold select-none">...</span>
                                {/if}
                            {/each}
                        </div>

                        <!-- Next Button (Arrow Icon Only) -->
                        <button
                            type="button"
                            on:click={() => goToPage(page + 1)}
                            disabled={page >= totalPages}
                            class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-[#1e293b] text-[var(--text)] dark:text-slate-200 hover:bg-[var(--surface)] dark:hover:bg-slate-700 font-bold transition-all disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed flex items-center justify-center shadow-xs"
                            title="Halaman berikutnya"
                            aria-label="Halaman berikutnya"
                        >
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </button>
                    </div>
                {/if}
            </div>
        {/if}
    </main>
</Layout>

<!-- ================= DOWNLOAD INSTALLER POP-UP MODAL ================= -->
{#if showDownloadModal && selectedProductForDownload}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm overflow-y-auto animate-fade-in"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
    >
        <!-- Modal Backdrop Click Dismiss Layer -->
        <button
            type="button"
            class="fixed inset-0 w-full h-full cursor-default bg-transparent border-0 focus:outline-none"
            aria-label="Tutup modal unduh installer"
            on:click={closeDownloadModal}
        ></button>

        <div class="relative w-full max-w-lg bg-[var(--surface)] dark:bg-[#0f172a] border border-[var(--border)] dark:border-[#22314d] rounded-3xl shadow-2xl p-5 sm:p-6 overflow-hidden my-8 z-10">
            <!-- Modal Header -->
            <div class="flex items-start justify-between gap-4 pb-4 border-b border-[var(--border)] dark:border-[#22314d]">
                <div class="flex items-center gap-3">
                    {#if selectedProductForDownload.image && !imgErrorMap[selectedProductForDownload.id]}
                        <img
                            src={selectedProductForDownload.image}
                            alt={selectedProductForDownload.name}
                            class="w-11 h-11 rounded-xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-slate-800 flex-shrink-0 shadow-xs"
                            on:error={() => imgErrorMap[selectedProductForDownload.id] = true}
                        />
                    {:else}
                        <div class="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-sm flex-shrink-0">
                            {selectedProductForDownload.name.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <div>
                        <h3 class="text-base font-extrabold text-[var(--text)] dark:text-white flex items-center gap-2">
                            <span>Installer Resmi Software</span>
                        </h3>
                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">
                            {selectedProductForDownload.name}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    on:click={closeDownloadModal}
                    class="w-8 h-8 rounded-xl bg-[var(--surface-2)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 hover:bg-[var(--surface)] dark:hover:bg-slate-700 text-[var(--text-3)] dark:text-slate-400 hover:text-[var(--text)] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                    aria-label="Tutup"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- OS Platform Selector Tabs with Sliding Pill Animation -->
            <div class="mt-4 p-1 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] relative flex items-center select-none overflow-hidden">
                <!-- Sliding Pill Backdrop -->
                <div
                    class="absolute top-1 bottom-1 left-1 w-[calc(33.333%-2.67px)] rounded-lg {downloadOsFilter === 'mac' ? 'bg-slate-700 shadow-md shadow-slate-600/25' : 'bg-blue-600 shadow-md shadow-blue-500/25'} transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
                    style="transform: translateX({downloadOsFilter === 'all' ? '0%' : downloadOsFilter === 'windows' ? '100%' : '200%'});"
                ></div>

                <button
                    type="button"
                    on:click={() => downloadOsFilter = 'all'}
                    class="relative z-10 flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors duration-200 text-center flex items-center justify-center gap-1 cursor-pointer border-0 bg-transparent {downloadOsFilter === 'all' ? 'text-white font-bold' : 'text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white'}"
                >
                    <span>Semua</span>
                    <span class="text-[10px] opacity-80">({modalTotalFilesCount})</span>
                </button>

                <button
                    type="button"
                    on:click={() => downloadOsFilter = 'windows'}
                    class="relative z-10 flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 cursor-pointer border-0 bg-transparent {downloadOsFilter === 'windows' ? 'text-white font-bold' : 'text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white'}"
                >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.901-1.799"/>
                    </svg>
                    <span>Win</span>
                    <span class="text-[10px] opacity-80 font-normal">({modalWindowsFiles.length})</span>
                </button>

                <button
                    type="button"
                    on:click={() => downloadOsFilter = 'mac'}
                    class="relative z-10 flex-1 py-1.5 rounded-lg text-xs font-bold transition-colors duration-200 text-center flex items-center justify-center gap-1.5 cursor-pointer border-0 bg-transparent {downloadOsFilter === 'mac' ? 'text-white font-bold' : 'text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white'}"
                >
                    <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.87.96-2.96-1 .04-2.16.67-2.85 1.48-.58.68-.97 1.76-.84 2.82 1.11.09 2.09-.56 2.73-1.34z"/>
                    </svg>
                    <span>Mac</span>
                    <span class="text-[10px] opacity-80 font-normal">({modalMacFiles.length})</span>
                </button>
            </div>

            <!-- List of Files -->
            <div class="mt-4 space-y-2.5 max-h-72 overflow-y-auto pr-1">
                {#if displayedInstallerFiles.length === 0}
                    <div class="py-8 text-center bg-[var(--surface-2)] dark:bg-[#131d31] rounded-2xl border border-[var(--border)] dark:border-[#22314d]">
                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400">Tidak ada file installer untuk platform ini.</p>
                    </div>
                {:else}
                    {#each displayedInstallerFiles as file}
                        <div class="p-3.5 bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] rounded-2xl flex items-center justify-between gap-3 hover:border-[var(--brand)] dark:hover:border-blue-500 transition-colors">
                            <div class="flex items-center gap-3 min-w-0">
                                <!-- Platform & Extension Badge -->
                                <div class="flex flex-col items-center gap-1 flex-shrink-0">
                                    {#if file.os === 'windows'}
                                        <div class="w-8 h-8 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/40 flex items-center justify-center shadow-xs" title="Windows Installer">
                                            <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.901-1.799"/>
                                            </svg>
                                        </div>
                                    {:else}
                                        <div class="w-8 h-8 rounded-xl bg-slate-500/10 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 flex items-center justify-center shadow-xs" title="macOS Installer">
                                            <svg class="w-4 h-4 text-slate-700 dark:text-slate-200" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.87.96-2.96-1 .04-2.16.67-2.85 1.48-.58.68-.97 1.76-.84 2.82 1.11.09 2.09-.56 2.73-1.34z"/>
                                            </svg>
                                        </div>
                                    {/if}
                                    <span class="text-[9px] font-mono font-black text-[var(--text-3)] dark:text-slate-400 uppercase">
                                        {getFileExtensionBadge(file.filename)}
                                    </span>
                                </div>

                                <div class="min-w-0">
                                    <p class="text-xs font-bold text-[var(--text)] dark:text-white truncate" title={file.filename}>
                                        {file.filename}
                                    </p>
                                    <p class="text-[10px] text-[var(--text-3)] dark:text-slate-400 mt-0.5">
                                        Ukuran: <span class="font-mono font-semibold text-[var(--text-2)] dark:text-slate-300">{file.size || 'N/A'}</span>
                                    </p>
                                </div>
                            </div>

                            <!-- Direct Download Link Button -->
                            <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 flex-shrink-0 shadow-xs border-0"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                                <span>Unduh</span>
                            </a>
                        </div>
                    {/each}
                {/if}
            </div>

            <!-- Modal Footer with Tutorial Quick-Link -->
            <div class="mt-5 pt-4 border-t border-[var(--border)] dark:border-[#22314d] flex items-center justify-between">
                {#if selectedProductForDownload}
                    <a
                        href="#/member/tutorials/{selectedProductForDownload.id}"
                        class="text-xs font-bold text-[var(--brand)] dark:text-blue-400 hover:underline inline-flex items-center gap-1.5"
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Video Panduan &rarr;</span>
                    </a>
                {/if}

                <button
                    type="button"
                    on:click={closeDownloadModal}
                    class="px-4 py-2 rounded-xl bg-[var(--surface-2)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 hover:bg-[var(--border)] dark:hover:bg-slate-700 text-[var(--text-2)] dark:text-slate-200 font-bold text-xs transition-colors cursor-pointer"
                >
                    Tutup
                </button>
            </div>
        </div>
    </div>
{/if}
