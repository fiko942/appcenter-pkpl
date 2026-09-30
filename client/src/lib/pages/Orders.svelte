<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Layout from '../components/Layout.svelte';
    import CustomSelect from '../components/CustomSelect.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';

    interface InstallerFileInfo {
        id?: string;
        filename: string;
        url: string;
        size: string;
        os?: 'windows' | 'mac' | 'other';
    }

    interface InstallerFilesGroup {
        windows: InstallerFileInfo[];
        mac: InstallerFileInfo[];
    }

    interface OrderItemDetail {
        name: string;
        product_id?: number | string;
        price?: number;
        duration_text?: string | null;
    }

    interface OrderRecord {
        id: number;
        order_no: string;
        product_id?: number | null;
        product_name: string;
        product_image?: string | null;
        has_tutorials?: boolean;
        installer_files?: InstallerFilesGroup;
        items: OrderItemDetail[];
        created: number;
        created_formatted: string;
        status: string;
        status_category: 'paid' | 'pending' | 'expired';
        is_paid: boolean;
        is_expired?: boolean;
        expires_at?: number;
        paid_at: number | null;
        payment_method: string;
        payment_url: string;
        total_amount: number;
        duration_text: string;
    }

    interface LicenseDetail {
        id: number;
        key: string;
        product_name: string;
        product_id: number | null;
        status: 'active' | 'unused' | 'expired';
        status_label: string;
        is_applied: boolean;
        machine_id: string | null;
        duration_text: string;
        activated_at: number | null;
        activated_at_formatted: string | null;
        expires_at: number | null;
        expires_at_formatted: string | null;
        remaining_days: number | null;
        remaining_text: string;
        tutorial_url: string | null;
        has_tutorials: boolean;
        product_image?: string | null;
        installer_files?: InstallerFilesGroup;
    }

    interface PaginationMeta {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
    }

    interface StatusCounts {
        all: number;
        paid: number;
        pending: number;
        expired: number;
    }

    let orders: OrderRecord[] = [];
    let pagination: PaginationMeta = { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 };
    let counts: StatusCounts = { all: 0, paid: 0, pending: 0, expired: 0 };
    let loading: boolean = true;
    let imgErrorMap: Record<number | string, boolean> = {};

    function isValidImg(url: string | null | undefined): boolean {
        if (!url || typeof url !== 'string') return false;
        const trimmed = url.trim();
        if (!trimmed) return false;
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/favicon') || trimmed.startsWith('data:image/');
    }

    // Filter & Sort State
    let searchQuery: string = '';
    let statusFilter: 'all' | 'paid' | 'pending' | 'expired' = 'all';
    let sortBy: 'created' | 'duration' | 'total_amount' = 'created';
    let sortOrder: 'asc' | 'desc' = 'desc';
    let searchTimeout: any = null;
    let copyTokenTimer: ReturnType<typeof setTimeout> | null = null;
    let copyHwidTimer: ReturnType<typeof setTimeout> | null = null;

    // License Modal State
    let showLicenseModal: boolean = false;
    let modalLoading: boolean = false;
    let modalError: string = '';
    let selectedOrderForModal: OrderRecord | null = null;
    let modalLicenses: LicenseDetail[] = [];
    let copiedKeyId: number | null = null;
    let copiedHwidId: number | null = null;

    // Download Installer Modal State
    let showDownloadModal: boolean = false;
    let selectedOrderForDownload: OrderRecord | null = null;
    let downloadOsFilter: 'all' | 'windows' | 'mac' = 'all';

    const pageSizeOptions = [
        { value: 10, label: '10 / hal' },
        { value: 25, label: '25 / hal' },
        { value: 50, label: '50 / hal' }
    ];

    function formatRupiah(val: number | null | undefined): string {
        if (val === 0) return 'GRATIS (Rp 0)';
        if (!val || val < 0) return '-';
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    }

    async function fetchOrders() {
        loading = true;
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                pageSize: pagination.pageSize.toString(),
                status: statusFilter,
                sort: sortBy,
                order: sortOrder,
                search: searchQuery.trim()
            });

            const res = await fetch(`/member/api/orders?${params.toString()}`, {
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
                    orders = json.data.orders || [];
                    pagination = json.data.pagination || pagination;
                    counts = json.data.counts || counts;
                }
            }
        } catch (e) {
            console.error('Gagal mengambil data pesanan:', e);
        } finally {
            loading = false;
        }
    }

    function handleSearchInput() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            pagination.page = 1;
            fetchOrders();
        }, 300);
    }

    function setStatusFilter(status: string) {
        const validStatus = (['all', 'paid', 'pending', 'expired'].includes(status) ? status : 'all') as 'all' | 'paid' | 'pending' | 'expired';
        if (statusFilter === validStatus) return;
        statusFilter = validStatus;
        pagination.page = 1;
        fetchOrders();
    }

    function toggleSort(field: 'created' | 'duration' | 'total_amount') {
        if (sortBy === field) {
            sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        } else {
            sortBy = field;
        }
        pagination.page = 1;
        fetchOrders();
    }

    function goToPage(p: number) {
        if (p < 1 || p > pagination.totalPages || p === pagination.page) return;
        pagination.page = p;
        fetchOrders();
    }

    function handlePageSizeChange(e: CustomEvent<number | string>) {
        pagination.pageSize = Number(e.detail);
        pagination.page = 1;
        fetchOrders();
    }

    // Open & Load License Modal
    async function openLicenseModal(order: OrderRecord) {
        selectedOrderForModal = order;
        showLicenseModal = true;
        modalLoading = true;
        modalError = '';
        modalLicenses = [];

        try {
            const res = await fetch(`/member/api/orders/${order.id}/licenses`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data) {
                modalLicenses = json.data.licenses || [];
            } else {
                modalError = json.message || 'Tidak dapat memuat lisensi untuk pesanan ini.';
            }
        } catch (err) {
            modalError = 'Terjadi kesalahan sistem saat mengambil data lisensi.';
        } finally {
            modalLoading = false;
        }
    }

    function closeLicenseModal() {
        showLicenseModal = false;
        selectedOrderForModal = null;
        modalLicenses = [];
        modalError = '';
        copiedKeyId = null;
        copiedHwidId = null;
    }

    // Open & Manage Download Modal
    function openDownloadModal(order: OrderRecord) {
        selectedOrderForDownload = order;
        downloadOsFilter = 'all';
        showDownloadModal = true;
    }

    function handleDownloadFromLicenseModal(order: OrderRecord | null) {
        if (!order) return;
        const targetOrder: OrderRecord = { ...order };
        if (modalLicenses.length > 0 && modalLicenses[0].installer_files) {
            targetOrder.installer_files = modalLicenses[0].installer_files;
        }
        if (!targetOrder.product_image && modalLicenses.length > 0 && modalLicenses[0].product_image) {
            targetOrder.product_image = modalLicenses[0].product_image;
        }
        closeLicenseModal();
        openDownloadModal(targetOrder);
    }

    function closeDownloadModal() {
        showDownloadModal = false;
        selectedOrderForDownload = null;
        downloadOsFilter = 'all';
    }

    $: modalWindowsFiles = (selectedOrderForDownload?.installer_files?.windows || []).map(f => ({ ...f, os: 'windows' as const }));
    $: modalMacFiles = (selectedOrderForDownload?.installer_files?.mac || []).map(f => ({ ...f, os: 'mac' as const }));
    $: modalTotalFilesCount = modalWindowsFiles.length + modalMacFiles.length;

    $: statusTabs = [
        { id: 'all', label: 'Semua Pesanan', count: counts.all, color: 'brand' as const },
        { id: 'paid', label: 'Selesai / Paid', count: counts.paid, color: 'emerald' as const },
        { id: 'pending', label: 'Menunggu Pembayaran', count: counts.pending, color: 'amber' as const },
        ...(counts.expired > 0 ? [{ id: 'expired', label: 'Kadaluarsa / Batal', count: counts.expired, color: 'rose' as const }] : [])
    ] as TabItem[];

    $: statusFilterOptions = [
        { value: 'all', label: `Semua Pesanan (${counts.all})` },
        { value: 'paid', label: `Selesai / Paid (${counts.paid})` },
        { value: 'pending', label: `Menunggu Pembayaran (${counts.pending})` },
        ...(counts.expired > 0 ? [{ value: 'expired', label: `Kadaluarsa / Batal (${counts.expired})` }] : [])
    ];

    $: modalOsTabs = [
        { id: 'all', label: `Semua File (${modalTotalFilesCount})`, color: 'brand' as const },
        ...(modalWindowsFiles.length > 0 ? [{ id: 'windows', label: `Windows (${modalWindowsFiles.length})`, color: 'blue' as const }] : []),
        ...(modalMacFiles.length > 0 ? [{ id: 'mac', label: `macOS (${modalMacFiles.length})`, color: 'slate' as const }] : [])
    ] as TabItem[];

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

    async function copyToken(id: number, text: string) {
        try {
            await navigator.clipboard.writeText(text);
            copiedKeyId = id;
            if (copyTokenTimer) clearTimeout(copyTokenTimer);
            copyTokenTimer = setTimeout(() => {
                if (copiedKeyId === id) copiedKeyId = null;
            }, 2000);
        } catch (e) {
            console.error('Gagal menyalin token:', e);
        }
    }

    async function copyHwid(id: number, text: string) {
        try {
            await navigator.clipboard.writeText(text);
            copiedHwidId = id;
            if (copyHwidTimer) clearTimeout(copyHwidTimer);
            copyHwidTimer = setTimeout(() => {
                if (copiedHwidId === id) copiedHwidId = null;
            }, 2000);
        } catch (e) {
            console.error('Gagal menyalin HWID:', e);
        }
    }

    // Dynamic Pagination Range Generator
    $: pageNumbers = (() => {
        const total = pagination.totalPages;
        const current = pagination.page;
        if (total <= 5) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        const pages: (number | '...')[] = [];
        pages.push(1);
        if (current > 3) pages.push('...');
        const start = Math.max(2, current - 1);
        const end = Math.min(total - 1, current + 1);
        for (let i = start; i <= end; i++) {
            pages.push(i);
        }
        if (current < total - 2) pages.push('...');
        pages.push(total);
        return pages;
    })();

    $: startRowIndex = (pagination.page - 1) * pagination.pageSize + 1;
    $: endRowIndex = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            if (showDownloadModal) closeDownloadModal();
            else if (showLicenseModal) closeLicenseModal();
        }
    }

    onMount(() => {
        fetchOrders();
    });

    onDestroy(() => {
        if (searchTimeout) clearTimeout(searchTimeout);
        if (copyTokenTimer) clearTimeout(copyTokenTimer);
        if (copyHwidTimer) clearTimeout(copyHwidTimer);
    });
</script>

<svelte:window on:keydown={handleKeydown} />

<Layout activePage="orders" eyebrow="TRANSAKSI & RIWAYAT PEMBELIAN">
    <main class="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-2xl font-extrabold text-[var(--text)]">Pesanan Saya</h1>
                <p class="text-[var(--text-3)] text-sm mt-1">Kelola riwayat pembelian software, unduh installer resmi, dan aktivasi lisensi produk Anda.</p>
            </div>
            <a href="#/member/orders/create" class="self-end md:self-auto bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-md shadow-blue-500/20 flex-shrink-0 border-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Order Software Baru</span>
            </a>
        </div>

        <!-- Desktop Filter Tabs (Visible only on md+ screens) -->
        <div class="hidden md:flex items-center gap-2">
            <SegmentedTabs
                tabs={statusTabs}
                activeTab={statusFilter}
                on:tabChange={(e) => setStatusFilter(e.detail)}
                on:change={(e) => setStatusFilter(e.detail)}
            />
        </div>

        <!-- Table Container Card -->
        <div class="bg-[var(--surface)] shadow rounded-2xl border border-[var(--border)] dark:border-[#22314d] relative">
            <!-- Search & Controls Bar (Compact Single Line on Mobile & Desktop) -->
            <div class="p-3 sm:p-4 border-b border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-2.5 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-t-2xl relative z-20">
                <!-- Search Input -->
                <div class="flex-1 min-w-0 sm:max-w-xs relative">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        on:input={handleSearchInput}
                        placeholder="Cari No Order, Produk..."
                        class="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)] transition-colors"
                    />
                    <svg class="w-3.5 h-3.5 text-[var(--text-3)] dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {#if searchQuery}
                        <button
                            type="button"
                            on:click={() => { searchQuery = ''; pagination.page = 1; fetchOrders(); }}
                            class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)] dark:text-slate-400 hover:text-[var(--text)] dark:hover:text-white bg-transparent border-0 cursor-pointer p-0.5"
                        >
                            &times;
                        </button>
                    {/if}
                </div>

                <!-- Right Side Control: Mobile Status Filter Dropdown (< md) / Desktop Total Count (>= md) -->
                <div class="shrink-0 flex items-center gap-2">
                    <!-- Mobile Status Filter Dropdown (< md) -->
                    <div class="block md:hidden">
                        <CustomSelect
                            options={statusFilterOptions}
                            value={statusFilter}
                            fullWidth={false}
                            on:change={(e) => setStatusFilter(String(e.detail))}
                        />
                    </div>

                    <!-- Desktop Total Count (>= md) -->
                    <div class="hidden md:block text-xs text-[var(--text-3)] dark:text-slate-300 text-right whitespace-nowrap">
                        Total: <strong class="text-[var(--text)] dark:text-white font-bold">{pagination.totalItems}</strong> pesanan
                    </div>
                </div>
            </div>

            {#if loading}
                <div class="p-12 text-center text-[var(--text-3)] dark:text-slate-400 space-y-3">
                    <div class="w-8 h-8 mx-auto border-3 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
                    <p class="text-xs">Memuat data transaksi pesanan...</p>
                </div>
            {:else if orders.length === 0}
                <div class="p-12 text-center space-y-4">
                    <div class="w-14 h-14 mx-auto rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 flex items-center justify-center text-[var(--text-3)] dark:text-slate-400">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-bold text-sm text-[var(--text)] dark:text-white">Tidak ada pesanan ditemukan</h3>
                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-1 max-w-sm mx-auto">
                            {#if searchQuery}
                                Tidak ada transaksi yang cocok dengan kata kunci "{searchQuery}".
                            {:else if statusFilter !== 'all'}
                                Tidak ada pesanan dengan status "{statusFilter === 'paid' ? 'Selesai / Paid' : (statusFilter === 'pending' ? 'Menunggu Pembayaran' : 'Kadaluarsa')}".
                            {:else}
                                Anda belum memiliki riwayat pesanan software di Appcenter Ziqva.
                            {/if}
                        </p>
                    </div>
                    {#if !searchQuery && statusFilter === 'all'}
                        <a href="#/member/orders/create" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 active:bg-blue-700 shadow-md shadow-blue-500/20 border-0">
                            Mulai Belanja Software
                        </a>
                    {/if}
                </div>
            {:else}
                <!-- 1. Mobile Card List (Visible on mobile < md screens, no horizontal scrolling needed) -->
                <div class="block md:hidden divide-y divide-[var(--border)] dark:divide-[#22314d]">
                    {#each orders as order, idx (order.id)}
                        <div class="p-4 space-y-3 {idx % 2 === 1 ? 'bg-slate-100/80 dark:bg-[#141f36]' : 'bg-[var(--surface)] dark:bg-[#0c1322]'} hover:bg-blue-50/70 dark:hover:bg-[#1a2845] transition-colors">
                            <!-- Card Header: Product Icon, Name, Date, and Status -->
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-center gap-3 min-w-0 flex-1">
                                    {#if order.product_image && !imgErrorMap[order.id]}
                                        <img
                                            src={order.product_image}
                                            alt={order.product_name}
                                            class="w-10 h-10 rounded-xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-slate-800 flex-shrink-0 shadow-xs"
                                            on:error={() => imgErrorMap[order.id] = true}
                                        />
                                    {:else}
                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                                            {order.product_name.charAt(0).toUpperCase()}
                                        </div>
                                    {/if}
                                    <div class="min-w-0 flex-1">
                                        <span class="font-bold text-xs text-[var(--text)] dark:text-white truncate block" title={order.product_name}>
                                            {order.product_name}
                                        </span>
                                        <span class="text-[11px] text-[var(--text-3)] dark:text-slate-400 block mt-0.5">
                                            {order.created_formatted} • {order.duration_text}
                                        </span>
                                    </div>
                                </div>

                                <!-- Status Badge -->
                                <div class="shrink-0">
                                    {#if order.is_paid}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/40">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                                            Selesai
                                        </span>
                                    {:else if order.is_expired || order.status_category === 'expired'}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/40">
                                            <span class="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400"></span>
                                            Expired
                                        </span>
                                    {:else if order.status_category === 'pending'}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/20 dark:border-amber-500/40">
                                            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse"></span>
                                            Menunggu Bayar
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/20 dark:border-rose-500/40">
                                            {order.status}
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Card Bottom: Total Price & Actions -->
                            <div class="flex items-center justify-between pt-2.5 border-t border-[var(--border)] dark:border-[#22314d]">
                                <div>
                                    <span class="text-[10px] uppercase font-bold text-[var(--text-3)] block">Total Harga</span>
                                    <span class="text-xs font-bold text-[var(--text)] dark:text-white font-mono">
                                        {formatRupiah(order.total_amount)}
                                    </span>
                                </div>

                                <!-- Action Toolbar on Mobile -->
                                <div class="flex items-center gap-1.5">
                                    {#if order.is_paid}
                                        {#if order.invoice_token}
                                            <a
                                                href="/api/v1/invoice/{order.invoice_token}/pdf"
                                                target="_blank"
                                                class="h-8 px-2.5 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-indigo-600 dark:hover:bg-indigo-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center transition-all shadow-xs text-xs font-semibold gap-1"
                                                title="Lihat Dokumen PDF"
                                            >
                                                <svg class="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                </svg>
                                                <span>PDF</span>
                                            </a>
                                        {/if}
                                        <button
                                            type="button"
                                            on:click={() => openDownloadModal(order)}
                                            class="h-8 px-2.5 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-blue-600 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center transition-all shadow-xs text-xs font-semibold gap-1"
                                            title="Unduh Installer"
                                        >
                                            <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            <span>Unduh</span>
                                        </button>
                                        <button
                                            type="button"
                                            on:click={() => openLicenseModal(order)}
                                            class="h-8 px-2.5 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-emerald-600 dark:hover:bg-emerald-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center transition-all shadow-xs text-xs font-semibold gap-1"
                                            title="Detail Lisensi"
                                        >
                                            <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                            </svg>
                                            <span>Lisensi</span>
                                        </button>
                                    {:else if order.is_expired || order.status_category === 'expired'}
                                        <button
                                            type="button"
                                            disabled
                                            class="h-8 px-3.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-60"
                                        >
                                            <span>Kedaluwarsa</span>
                                        </button>
                                    {:else}
                                        <a
                                            href={order.payment_url.startsWith('http') || order.payment_url.startsWith('/member/orders') ? order.payment_url : `/${order.payment_url.replace(/^\/?/, '')}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="h-8 px-3.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 active:bg-blue-700 shadow-xs inline-flex items-center gap-1.5 transition-all border-0 shadow-blue-500/20"
                                        >
                                            <span>Bayar</span>
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </a>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- 2. Desktop Full Table (Visible on md and larger screens >= 768px) -->
                <div class="hidden md:block overflow-x-auto">
                    <table class="min-w-full text-sm text-left text-[var(--text-2)]">
                        <thead class="bg-[var(--surface-2)] dark:bg-[#131d31] text-[var(--text-3)] dark:text-slate-300 font-bold text-xs border-b border-[var(--border)] dark:border-[#22314d] uppercase tracking-wider select-none">
                            <tr>
                                <th class="px-6 py-4">No</th>
                                <th class="px-6 py-4">Produk</th>
                                
                                <!-- Sortable Header: Tanggal Order -->
                                <th class="px-6 py-4">
                                    <button
                                        type="button"
                                        on:click={() => toggleSort('created')}
                                        class="flex items-center gap-1.5 hover:text-[var(--brand)] transition-colors uppercase font-bold cursor-pointer group"
                                        title="Urutkan berdasarkan Tanggal Order"
                                    >
                                        <span>Tanggal Order</span>
                                        <span class="text-xs {sortBy === 'created' ? 'text-[var(--brand)] font-bold' : 'text-[var(--text-3)] dark:text-slate-400 group-hover:text-[var(--brand)]'}">
                                            {#if sortBy === 'created'}
                                                 {sortOrder === 'asc' ? '▲' : '▼'}
                                            {:else}
                                                ⇅
                                            {/if}
                                        </span>
                                    </button>
                                </th>

                                <!-- Sortable Header: Durasi -->
                                <th class="px-6 py-4">
                                    <button
                                        type="button"
                                        on:click={() => toggleSort('duration')}
                                        class="flex items-center gap-1.5 hover:text-[var(--brand)] transition-colors uppercase font-bold cursor-pointer group"
                                        title="Urutkan berdasarkan Durasi"
                                    >
                                        <span>Durasi</span>
                                        <span class="text-xs {sortBy === 'duration' ? 'text-[var(--brand)] font-bold' : 'text-[var(--text-3)] dark:text-slate-400 group-hover:text-[var(--brand)]'}">
                                            {#if sortBy === 'duration'}
                                                {sortOrder === 'asc' ? '▲' : '▼'}
                                            {:else}
                                                ⇅
                                            {/if}
                                        </span>
                                    </button>
                                </th>

                                <!-- Sortable Header: Total Harga -->
                                <th class="px-6 py-4">
                                    <button
                                        type="button"
                                        on:click={() => toggleSort('total_amount')}
                                        class="flex items-center gap-1.5 hover:text-[var(--brand)] transition-colors uppercase font-bold cursor-pointer group"
                                        title="Urutkan berdasarkan Total Harga"
                                    >
                                        <span>Total</span>
                                        <span class="text-xs {sortBy === 'total_amount' ? 'text-[var(--brand)] font-bold' : 'text-[var(--text-3)] dark:text-slate-400 group-hover:text-[var(--brand)]'}">
                                            {#if sortBy === 'total_amount'}
                                                {sortOrder === 'asc' ? '▲' : '▼'}
                                            {:else}
                                                ⇅
                                            {/if}
                                        </span>
                                    </button>
                                </th>

                                <th class="px-6 py-4">Status</th>
                                <th class="px-6 py-4 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)] dark:divide-[#22314d]">
                            {#each orders as order, idx (order.id)}
                                <tr class="{idx % 2 === 1 ? 'bg-slate-100/70 dark:bg-[#141f36]' : 'bg-[var(--surface)] dark:bg-[#0c1322]'} hover:bg-blue-50/70 dark:hover:bg-[#1a2845] transition-colors">
                                    <td class="px-6 py-4 font-mono font-bold text-[var(--text-2)] dark:text-slate-300 whitespace-nowrap text-xs">
                                        {(pagination.page - 1) * pagination.pageSize + idx + 1}
                                    </td>
                                    <td class="px-6 py-4">
                                        <div class="flex items-center gap-3">
                                            {#if order.product_image && !imgErrorMap[order.id]}
                                                <img
                                                    src={order.product_image}
                                                    alt={order.product_name}
                                                    class="w-9 h-9 rounded-xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-slate-800 flex-shrink-0 shadow-xs"
                                                    on:error={() => imgErrorMap[order.id] = true}
                                                />
                                            {:else}
                                                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-blue-500 dark:text-blue-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                                                    {order.product_name.charAt(0).toUpperCase()}
                                                </div>
                                            {/if}
                                            <div class="min-w-0">
                                                <span class="font-bold text-xs text-[var(--text)] dark:text-white truncate block max-w-[220px]" title={order.product_name}>
                                                    {order.product_name}
                                                </span>
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-xs text-[var(--text-3)] dark:text-slate-300 whitespace-nowrap font-medium">
                                        {order.created_formatted}
                                    </td>
                                    <td class="px-6 py-4 text-xs whitespace-nowrap">
                                        <span class="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 text-[var(--text)] dark:text-slate-200 font-semibold">
                                            {order.duration_text}
                                        </span>
                                    </td>
                                    <td class="px-6 py-4 font-semibold text-[var(--text)] dark:text-white whitespace-nowrap text-xs">
                                        {formatRupiah(order.total_amount)}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        {#if order.is_paid}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/20 dark:border-emerald-500/40">
                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                                                Selesai / Paid
                                            </span>
                                        {:else if order.is_expired || order.status_category === 'expired'}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/40">
                                                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400"></span>
                                                Expired
                                            </span>
                                        {:else if order.status_category === 'pending'}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/20 dark:border-amber-500/40">
                                                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400 animate-pulse"></span>
                                                Menunggu Pembayaran
                                            </span>
                                        {:else}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/20 dark:border-rose-500/40">
                                                {order.status}
                                            </span>
                                        {/if}
                                    </td>
                                    <td class="px-6 py-4 text-right whitespace-nowrap">
                                        {#if order.is_paid}
                                            <div class="inline-flex items-center gap-1.5 justify-end">
                                                {#if order.invoice_token}
                                                    <a
                                                        href="/api/v1/invoice/{order.invoice_token}/pdf"
                                                        target="_blank"
                                                        class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-indigo-600 dark:hover:bg-indigo-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-indigo-600 dark:hover:border-indigo-600 inline-flex items-center justify-center transition-all shadow-xs cursor-pointer group"
                                                        title="Lihat Dokumen PDF"
                                                    >
                                                        <svg class="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 group-hover:text-white transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </a>
                                                {/if}
                                                <!-- Download Installer Icon Button -->
                                                <button
                                                    type="button"
                                                    on:click={() => openDownloadModal(order)}
                                                    class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-blue-600 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-blue-600 dark:hover:border-blue-600 inline-flex items-center justify-center transition-all shadow-xs cursor-pointer group"
                                                    title="Unduh Installer {order.product_name}"
                                                    aria-label="Unduh Installer {order.product_name}"
                                                >
                                                    <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 group-hover:text-white transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                </button>

                                                <!-- License Details Icon Button -->
                                                <button
                                                    type="button"
                                                    on:click={() => openLicenseModal(order)}
                                                    class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-blue-600 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-blue-600 dark:hover:border-blue-600 inline-flex items-center justify-center transition-all shadow-xs cursor-pointer group"
                                                    title="Lihat Detail Lisensi {order.product_name}"
                                                    aria-label="Lihat Detail Lisensi {order.product_name}"
                                                >
                                                    <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 group-hover:text-white transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        {:else}
                                            <div class="inline-flex items-center gap-1.5 justify-end">
                                                {#if order.invoice_token}
                                                    <a
                                                        href="/api/v1/invoice/{order.invoice_token}/pdf"
                                                        target="_blank"
                                                        class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-indigo-600 dark:hover:bg-indigo-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-indigo-600 dark:hover:border-indigo-600 inline-flex items-center justify-center transition-all shadow-xs cursor-pointer group"
                                                        title="Lihat Dokumen PDF"
                                                    >
                                                        <svg class="w-3.5 h-3.5 text-indigo-500 dark:text-indigo-400 group-hover:text-white transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </a>
                                                {/if}
                                                {#if order.is_expired || order.status_category === 'expired'}
                                                    <button
                                                        type="button"
                                                        disabled
                                                        class="h-8 px-3.5 bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 border border-slate-300 dark:border-slate-700 cursor-not-allowed opacity-60"
                                                        title="Pembayaran telah kedaluwarsa"
                                                    >
                                                        <span>Bayar</span>
                                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </button>
                                                {:else}
                                                    <a
                                                        href={order.payment_url.startsWith('http') || order.payment_url.startsWith('/member/orders') ? order.payment_url : `/${order.payment_url.replace(/^\/?/, '')}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="h-8 px-3.5 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 active:bg-blue-700 shadow-xs inline-flex items-center gap-1.5 transition-all border-0 shadow-blue-500/20"
                                                    >
                                                        <span>Bayar</span>
                                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                                        </svg>
                                                    </a>
                                                {/if}
                                            </div>
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Dynamic Pagination Footer with PageSize Selector -->
                {#if pagination.totalPages > 1 || pagination.totalItems > 0}
                    <div class="p-4 border-t border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-b-2xl relative z-20">
                        <div class="flex items-center gap-3 flex-wrap">
                            <div class="text-xs text-[var(--text-3)] dark:text-slate-300">
                                Menampilkan <strong class="text-[var(--text)] dark:text-white font-bold">{startRowIndex} - {endRowIndex}</strong> dari <strong class="text-[var(--text)] dark:text-white font-bold">{pagination.totalItems}</strong> pesanan
                            </div>
                            <div class="flex items-center gap-1.5">
                                <CustomSelect
                                    options={pageSizeOptions}
                                    value={pagination.pageSize}
                                    prefix="Tampilkan:"
                                    on:change={handlePageSizeChange}
                                />
                            </div>
                        </div>

                        {#if pagination.totalPages > 1}
                            <div class="flex items-center gap-1">
                                <!-- Prev Button (Arrow Icon Only) -->
                                <button
                                    type="button"
                                    on:click={() => goToPage(pagination.page - 1)}
                                    disabled={pagination.page <= 1}
                                    class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Halaman sebelumnya"
                                    aria-label="Halaman sebelumnya"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
                                </button>

                                <!-- Page Numbers -->
                                <div class="flex items-center gap-1">
                                    {#each pageNumbers as p}
                                        {#if p === '...'}
                                            <span class="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-3)] dark:text-slate-500 font-bold select-none">...</span>
                                        {:else}
                                            <button
                                                type="button"
                                                on:click={() => goToPage(Number(p))}
                                                class="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center {pagination.page === p ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border-0' : 'border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs'}"
                                            >
                                                {p}
                                            </button>
                                        {/if}
                                    {/each}
                                </div>

                                <!-- Next Button (Arrow Icon Only) -->
                                <button
                                    type="button"
                                    on:click={() => goToPage(pagination.page + 1)}
                                    disabled={pagination.page >= pagination.totalPages}
                                    class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Halaman berikutnya"
                                    aria-label="Halaman berikutnya"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
                                </button>
                            </div>
                        {/if}
                    </div>
                {/if}
            {/if}
        </div>
    </main>
</Layout>

<!-- ================= DOWNLOAD INSTALLER POP-UP MODAL ================= -->
{#if showDownloadModal && selectedOrderForDownload}
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

        <div class="relative z-10 w-full max-w-xl bg-[var(--surface)] dark:bg-[#0f172a] border border-[var(--border)] dark:border-[#22314d] rounded-3xl shadow-2xl overflow-hidden my-8 animate-modal-scale text-left">
            <!-- Modal Header Accent Bar -->
            <div class="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>

            <!-- Modal Header -->
            <div class="p-6 border-b border-[var(--border)] dark:border-[#22314d] flex items-start justify-between gap-4 bg-[var(--surface-2)] dark:bg-[#131d31]">
                <div class="flex items-center gap-3">
                    {#if selectedOrderForDownload.product_image && !imgErrorMap['dl_' + selectedOrderForDownload.id]}
                        <img
                            src={selectedOrderForDownload.product_image}
                            alt={selectedOrderForDownload.product_name}
                            class="w-11 h-11 rounded-2xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-slate-800 shadow-sm flex-shrink-0"
                            on:error={() => imgErrorMap['dl_' + selectedOrderForDownload.id] = true}
                        />
                    {:else}
                        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-sm flex-shrink-0">
                            {selectedOrderForDownload.product_name.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h2 class="text-base font-extrabold text-[var(--text)] dark:text-white">Unduh Installer {selectedOrderForDownload.product_name}</h2>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-soft)] dark:bg-blue-950/60 text-[var(--brand)] dark:text-blue-400 border border-[var(--brand)]/30 dark:border-blue-800/80">
                                {selectedOrderForDownload.duration_text}
                            </span>
                        </div>
                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">
                            Pilih installer resmi software untuk platform OS & versi yang Anda butuhkan ({selectedOrderForDownload.order_no}).
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    on:click={closeDownloadModal}
                    class="w-8 h-8 rounded-xl bg-[var(--surface)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 hover:bg-[var(--surface-2)] dark:hover:bg-slate-700 text-[var(--text-3)] dark:text-slate-400 hover:text-[var(--text)] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                    aria-label="Tutup Modal"
                >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- OS Platform Tabs Inside Modal -->
            {#if modalTotalFilesCount > 0}
                <div class="px-6 pt-4 pb-2 border-b border-[var(--border)] dark:border-[#22314d] bg-[var(--surface)] dark:bg-[#0f172a] flex items-center gap-2 overflow-x-auto">
                    <SegmentedTabs
                        tabs={modalOsTabs}
                        bind:activeTab={downloadOsFilter}
                    />
                </div>
            {/if}

            <!-- Modal Body - List of Installer Files -->
            <div class="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {#if displayedInstallerFiles.length === 0}
                    <div class="py-10 text-center space-y-3 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-2xl border border-[var(--border)] dark:border-[#22314d] border-dashed p-6">
                        <div class="w-12 h-12 mx-auto rounded-2xl bg-[var(--surface)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 flex items-center justify-center text-[var(--text-3)] dark:text-slate-400">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <div>
                            <h4 class="font-bold text-sm text-[var(--text)] dark:text-white">Belum Ada File Installer Khusus</h4>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 max-w-sm mx-auto mt-1">
                                File installer untuk software ini dapat Anda temukan di Pusat Unduhan utama atau silakan hubungi tim support.
                            </p>
                        </div>
                        <a
                            href="#/member/downloads"
                            class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 active:bg-blue-700 shadow-xs border-0"
                        >
                            Buka Pusat Unduhan
                        </a>
                    </div>
                {:else}
                    <div class="space-y-3">
                        {#each displayedInstallerFiles as file (file.id || file.url)}
                            <div class="p-4 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] hover:border-blue-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div class="flex items-start gap-3 min-w-0">
                                    {#if file.os === 'windows'}
                                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 dark:border-blue-500/40 text-blue-400 flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
                                            <svg class="w-4 h-4 text-blue-400" viewBox="0 0 88 88" fill="currentColor">
                                                <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.016 45.728zm4.326-39.027L87.914 0v41.527l-47.918.376zm47.918 43.934v41.528l-47.918-6.762-.024-35.142z"/>
                                            </svg>
                                            <span class="text-[8px] font-black tracking-tight leading-none mt-0.5 text-blue-400">
                                                {getFileExtensionBadge(file.filename)}
                                            </span>
                                        </div>
                                    {:else if file.os === 'mac'}
                                        <div class="w-10 h-10 rounded-xl bg-slate-800 border border-slate-700 text-gray-200 flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
                                            <svg class="w-4 h-4 text-gray-200" viewBox="0 0 24 24" fill="currentColor">
                                                <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.62 1.35-.57.65-1.07 1.71-.93 2.74 1.01.08 2.03-.5 2.63-1.24z"/>
                                            </svg>
                                            <span class="text-[8px] font-black tracking-tight leading-none mt-0.5 text-gray-300">
                                                {getFileExtensionBadge(file.filename)}
                                            </span>
                                        </div>
                                    {:else}
                                        <div class="w-10 h-10 rounded-xl bg-[var(--surface)] dark:bg-slate-800 border border-[var(--border)] dark:border-slate-700 flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
                                            <svg class="w-4 h-4 text-[var(--text-2)] dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                            <span class="text-[8px] font-black text-blue-600 dark:text-blue-400 tracking-tight leading-none mt-0.5">
                                                {getFileExtensionBadge(file.filename)}
                                            </span>
                                        </div>
                                    {/if}

                                    <div class="min-w-0 flex-1">
                                        <div class="font-bold text-xs text-[var(--text)] dark:text-white break-all select-all leading-snug">
                                            {file.filename}
                                        </div>
                                        <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                                            {#if file.os === 'windows'}
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 dark:bg-blue-500/20 text-blue-400 border border-blue-500/20 dark:border-blue-500/40">
                                                    <svg class="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 88 88" fill="currentColor">
                                                        <path d="M0 12.402l35.687-4.86.016 34.423-35.67.203zm35.67 33.529l.028 34.453L.028 75.48.016 45.728zm4.326-39.027L87.914 0v41.527l-47.918.376zm47.918 43.934v41.528l-47.918-6.762-.024-35.142z"/>
                                                    </svg>
                                                    <span>Windows OS</span>
                                                </span>
                                            {:else if file.os === 'mac'}
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-slate-800 text-gray-200 border border-slate-700">
                                                    <svg class="w-2.5 h-2.5 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.37c.62-.75 1.04-1.8 0.92-2.85-.9.04-1.98.6-2.62 1.35-.57.65-1.07 1.71-.93 2.74 1.01.08 2.03-.5 2.63-1.24z"/>
                                                    </svg>
                                                    <span>macOS</span>
                                                </span>
                                            {:else}
                                                <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--surface-2)] dark:bg-slate-800 text-[var(--text-2)] dark:text-slate-300 border border-[var(--border)] dark:border-slate-700">
                                                    Universal
                                                </span>
                                            {/if}
                                            <span class="text-[11px] font-mono text-[var(--text-3)] dark:text-slate-400 font-medium">
                                                {file.size}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Direct Download Button -->
                                <a
                                    href={file.url}
                                    download
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs inline-flex items-center justify-center gap-2 shadow-sm transition-all flex-shrink-0 border-0"
                                >
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    <span>Unduh File</span>
                                </a>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Modal Footer -->
            <div class="p-4 border-t border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-3 bg-[var(--surface-2)] dark:bg-[#131d31]">
                {#if selectedOrderForDownload.has_tutorials && selectedOrderForDownload.product_id}
                    <a
                        href="#/member/tutorials/{selectedOrderForDownload.product_id}"
                        class="text-xs font-bold text-[var(--brand)] dark:text-blue-400 hover:underline inline-flex items-center gap-1.5"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Panduan & Video Tutorial</span>
                    </a>
                {:else}
                    <div></div>
                {/if}

                <button
                    type="button"
                    on:click={closeDownloadModal}
                    class="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 hover:bg-[var(--surface-2)] dark:hover:bg-slate-700 text-[var(--text)] dark:text-slate-200 transition-colors cursor-pointer"
                >
                    Tutup
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- ================= LICENSE DETAIL POP-UP MODAL ================= -->
{#if showLicenseModal && selectedOrderForModal}
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
            aria-label="Tutup modal lisensi"
            on:click={closeLicenseModal}
        ></button>

        <div class="relative z-10 w-full max-w-2xl bg-[var(--surface)] dark:bg-[#0f172a] border border-[var(--border)] dark:border-[#22314d] rounded-3xl shadow-2xl overflow-hidden my-8 animate-modal-scale text-left">
            <!-- Modal Header Accent Bar -->
            <div class="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-blue-500 to-indigo-600"></div>

            <!-- Modal Header -->
            <div class="p-6 border-b border-[var(--border)] dark:border-[#22314d] flex items-start justify-between gap-4 bg-[var(--surface-2)] dark:bg-[#131d31]">
                <div class="flex items-center gap-3">
                    {#if selectedOrderForModal.product_image && !imgErrorMap['lic_' + selectedOrderForModal.id]}
                        <img
                            src={selectedOrderForModal.product_image}
                            alt={selectedOrderForModal.product_name}
                            class="w-11 h-11 rounded-2xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-slate-800 shadow-sm flex-shrink-0"
                            on:error={() => imgErrorMap['lic_' + selectedOrderForModal.id] = true}
                        />
                    {:else if modalLicenses.length > 0 && modalLicenses[0].product_image && !imgErrorMap['lic_first_' + selectedOrderForModal.id]}
                        <img
                            src={modalLicenses[0].product_image}
                            alt={selectedOrderForModal.product_name}
                            class="w-11 h-11 rounded-2xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-slate-800 shadow-sm flex-shrink-0"
                            on:error={() => imgErrorMap['lic_first_' + selectedOrderForModal.id] = true}
                        />
                    {:else}
                        <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-black text-base shadow-sm flex-shrink-0">
                            {selectedOrderForModal.product_name.charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-[var(--surface)] dark:bg-slate-800 text-[var(--brand)] dark:text-blue-400 border border-[var(--border)] dark:border-slate-700">
                                {selectedOrderForModal.order_no}
                            </span>
                            <h2 class="text-base font-extrabold text-[var(--text)] dark:text-white">{selectedOrderForModal.product_name}</h2>
                        </div>
                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">
                            Informasi lisensi resmi, status pengikatan hardware (Machine ID), dan masa aktif ({selectedOrderForModal.duration_text}).
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    on:click={closeLicenseModal}
                    class="w-8 h-8 rounded-xl bg-[var(--surface)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 hover:bg-[var(--surface-2)] dark:hover:bg-slate-700 text-[var(--text-3)] dark:text-slate-400 hover:text-[var(--text)] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                    aria-label="Tutup Modal"
                >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Modal Body -->
            <div class="p-6 max-h-[70vh] overflow-y-auto space-y-4">
                {#if modalLoading}
                    <div class="py-12 text-center text-[var(--text-3)] dark:text-slate-400 space-y-3">
                        <div class="w-8 h-8 mx-auto border-3 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
                        <p class="text-xs">Mengambil informasi lisensi & token perangkat...</p>
                    </div>
                {:else if modalError}
                    <div class="p-4 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/20 dark:border-rose-500/40 text-rose-500 dark:text-rose-400 text-xs">
                        {modalError}
                    </div>
                {:else if modalLicenses.length === 0}
                    <div class="py-10 text-center space-y-2 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-2xl border border-[var(--border)] dark:border-[#22314d] border-dashed p-6">
                        <div class="w-10 h-10 mx-auto rounded-xl bg-[var(--surface)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 flex items-center justify-center text-[var(--text-3)] dark:text-slate-400">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <h4 class="font-bold text-sm text-[var(--text)] dark:text-white">Belum Ada Token Lisensi Terbit</h4>
                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400 max-w-sm mx-auto">
                            Lisensi untuk pesanan ini belum dibuat atau sedang dalam proses penerbitan sistem.
                        </p>
                    </div>
                {:else}
                    <div class="space-y-4">
                        {#each modalLicenses as lic, i (lic.id)}
                            <div class="p-5 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] space-y-3.5 shadow-xs">
                                <!-- License Card Header -->
                                <div class="flex items-center justify-between gap-3 flex-wrap">
                                    <div class="flex items-center gap-2">
                                        <span class="w-6 h-6 rounded-lg bg-[var(--surface)] dark:bg-slate-800 border border-[var(--border)] dark:border-slate-700 flex items-center justify-center text-xs font-bold text-[var(--text-2)] dark:text-slate-200">
                                            #{i + 1}
                                        </span>
                                        <span class="font-bold text-sm text-[var(--text)] dark:text-white">{lic.product_name}</span>
                                        <span class="px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--surface)] dark:bg-slate-800 border border-[var(--border)] dark:border-slate-700 text-[var(--text-3)] dark:text-slate-400">
                                            {lic.duration_text}
                                        </span>
                                    </div>

                                    <div>
                                        {#if lic.status === 'active'}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/40">
                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                                                {lic.status_label}
                                            </span>
                                        {:else if lic.status === 'unused'}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/40">
                                                <span class="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"></span>
                                                {lic.status_label}
                                            </span>
                                        {:else}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/40">
                                                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400"></span>
                                                {lic.status_label}
                                            </span>
                                        {/if}
                                    </div>
                                </div>

                                <!-- License Key Copy Box -->
                                <div class="space-y-1">
                                    <span class="text-[11px] font-bold text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider">Token Lisensi / Serial Key</span>
                                    <div class="flex items-center gap-2 p-2.5 rounded-xl bg-[var(--surface)] dark:bg-[#090e1a] border border-[var(--border)] dark:border-[#22314d]">
                                        <span class="font-mono text-xs text-[var(--text)] dark:text-slate-100 flex-1 truncate font-medium select-all">
                                            {lic.key}
                                        </span>
                                        <button
                                            type="button"
                                            on:click={() => copyToken(lic.id, lic.key)}
                                            class="px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 flex-shrink-0 {copiedKeyId === lic.id ? 'bg-emerald-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-500 active:bg-blue-700'} border-0"
                                        >
                                            {#if copiedKeyId === lic.id}
                                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                                                <span>Tersalin!</span>
                                            {:else}
                                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                                <span>Salin Token</span>
                                            {/if}
                                        </button>
                                    </div>
                                </div>

                                <!-- License Information Details Grid -->
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    <!-- Machine ID Box -->
                                    <div class="p-3 rounded-xl bg-[var(--surface)] dark:bg-[#090e1a] border border-[var(--border)] dark:border-[#22314d] space-y-1 sm:col-span-2">
                                        <div class="text-[11px] font-bold text-[var(--text-3)] dark:text-slate-400 flex items-center justify-between">
                                            <span>Machine ID (Hardware ID)</span>
                                            {#if lic.is_applied && lic.machine_id}
                                                <span class="text-emerald-500 dark:text-emerald-400 font-semibold flex items-center gap-1">
                                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400"></span>
                                                    Tertanam & Terverifikasi
                                                </span>
                                            {:else}
                                                <span class="text-blue-500 dark:text-blue-400 font-semibold">Belum Terikat Perangkat</span>
                                            {/if}
                                        </div>

                                        {#if lic.is_applied && lic.machine_id}
                                            <div class="flex items-center justify-between gap-2 pt-0.5">
                                                <div class="font-mono text-[11px] text-[var(--text)] dark:text-slate-200 break-all truncate select-all">
                                                    {lic.machine_id}
                                                </div>
                                                <button
                                                    type="button"
                                                    on:click={() => copyHwid(lic.id, lic.machine_id || '')}
                                                    class="text-[11px] font-bold text-[var(--brand)] dark:text-blue-400 hover:underline whitespace-nowrap flex-shrink-0 cursor-pointer"
                                                >
                                                    {copiedHwidId === lic.id ? 'Tersalin!' : 'Salin HWID'}
                                                </button>
                                            </div>
                                        {:else}
                                            <p class="text-[11px] text-[var(--text-3)] dark:text-slate-400 pt-0.5">
                                                Hardware ID akan otomatis terpasang saat token dimasukkan ke dalam software pertama kali.
                                            </p>
                                        {/if}
                                    </div>

                                    <!-- Waktu Aktivasi -->
                                    <div class="p-3 rounded-xl bg-[var(--surface)] dark:bg-[#090e1a] border border-[var(--border)] dark:border-[#22314d] space-y-1">
                                        <div class="text-[11px] font-bold text-[var(--text-3)] dark:text-slate-400">Waktu Aktivasi</div>
                                        <div class="font-semibold text-[var(--text)] dark:text-white">
                                            {#if lic.activated_at_formatted}
                                                {lic.activated_at_formatted}
                                            {:else}
                                                <span class="text-[var(--text-3)] dark:text-slate-400 font-normal">Belum pernah diaktivasi</span>
                                            {/if}
                                        </div>
                                    </div>

                                    <!-- Tanggal Kadaluarsa -->
                                    <div class="p-3 rounded-xl bg-[var(--surface)] dark:bg-[#090e1a] border border-[var(--border)] dark:border-[#22314d] space-y-1">
                                        <div class="text-[11px] font-bold text-[var(--text-3)] dark:text-slate-400">Masa Aktif Berakhir</div>
                                        <div class="font-semibold text-[var(--text)] dark:text-white">
                                            {#if lic.expires_at_formatted}
                                                {lic.expires_at_formatted}
                                                <span class="block text-[10px] text-emerald-500 dark:text-emerald-400 font-bold mt-0.5">({lic.remaining_text})</span>
                                            {:else}
                                                <span class="text-[var(--text-3)] dark:text-slate-400 font-normal">{lic.remaining_text}</span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>

                                <!-- Tutorial & Download Quick Links -->
                                <div class="pt-1 flex items-center justify-between flex-wrap gap-2">
                                    <button
                                        type="button"
                                        on:click={() => handleDownloadFromLicenseModal(selectedOrderForModal)}
                                        class="text-xs font-bold text-[var(--brand)] dark:text-blue-400 hover:underline inline-flex items-center gap-1.5 cursor-pointer"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        <span>Unduh Installer Resmi Software</span>
                                    </button>

                                    {#if lic.has_tutorials && lic.product_id}
                                        <a
                                            href="#/member/tutorials/{lic.product_id}"
                                            class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1.5"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            <span>Lihat Panduan & Video Tutorial →</span>
                                        </a>
                                    {/if}
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Modal Footer -->
            <div class="p-4 border-t border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-3 bg-[var(--surface-2)] dark:bg-[#131d31]">
                <a
                    href="#/member/licenses"
                    class="text-xs font-bold text-[var(--text-3)] dark:text-slate-400 hover:text-[var(--brand)] dark:hover:text-blue-400 transition-colors inline-flex items-center gap-1"
                >
                    <span>Buka Halaman Semua Lisensi</span>
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                </a>

                <button
                    type="button"
                    on:click={closeLicenseModal}
                    class="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 hover:bg-[var(--surface-2)] dark:hover:bg-slate-700 text-[var(--text)] dark:text-slate-200 transition-colors cursor-pointer"
                >
                    Tutup
                </button>
            </div>
        </div>
    </div>
{/if}

<style>
    @keyframes fadeIn {
        from { opacity: 0; }
        to { opacity: 1; }
    }
    @keyframes modalScale {
        from {
            opacity: 0;
            transform: scale(0.95) translateY(10px);
        }
        to {
            opacity: 1;
            transform: scale(1) translateY(0);
        }
    }
    .animate-fade-in {
        animation: fadeIn 0.15s ease-out;
    }
    .animate-modal-scale {
        animation: modalScale 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    }
</style>
