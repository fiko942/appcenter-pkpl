<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Layout from '../components/Layout.svelte';
    import CustomSelect from '../components/CustomSelect.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';
    import Tooltip from '../components/Tooltip.svelte';

    interface InvoiceRecord {
        id: number;
        invoiceNumber: string;
        token: string;
        productName: string;
        created: number;
        createdDateStr: string;
        status: string;
        isPaid: boolean;
        statusCategory: 'paid' | 'pending';
        totalAmount: number;
    }

    interface Counts {
        all: number;
        paid: number;
        pending: number;
    }

    let invoices: InvoiceRecord[] = [];
    let loading = true;
    let counts: Counts = { all: 0, paid: 0, pending: 0 };

    let searchQuery = '';
    let searchTimeout: any = null;
    let statusFilter: 'all' | 'paid' | 'pending' = 'all';
    let sortValue = 'created_desc';

    let pagination = {
        page: 1,
        pageSize: 10,
        totalItems: 0,
        totalPages: 1
    };

    const sortOptions = [
        { value: 'created_desc', label: 'Terbaru' },
        { value: 'created_asc', label: 'Terlama' },
        { value: 'total_desc', label: 'Tagihan Tertinggi' },
        { value: 'total_asc', label: 'Tagihan Terendah' }
    ];

    const pageSizeOptions = [
        { value: '10', label: '10 / halaman' },
        { value: '25', label: '25 / halaman' },
        { value: '50', label: '50 / halaman' }
    ];

    $: statusTabs = [
        { id: 'all', label: 'Semua Faktur', count: counts.all },
        { id: 'paid', label: 'Lunas / Paid', count: counts.paid },
        { id: 'pending', label: 'Menunggu Pembayaran', count: counts.pending }
    ] as TabItem[];

    $: statusFilterOptions = [
        { value: 'all', label: `Semua Faktur (${counts.all})` },
        { value: 'paid', label: `Lunas / Paid (${counts.paid})` },
        { value: 'pending', label: `Menunggu Pembayaran (${counts.pending})` }
    ];

    function handleSearchInput() {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            pagination.page = 1;
            fetchInvoices();
        }, 300);
    }

    function setStatusFilter(status: string) {
        statusFilter = status as any;
        pagination.page = 1;
        fetchInvoices();
    }

    function handleSortChange(val: string) {
        sortValue = val;
        pagination.page = 1;
        fetchInvoices();
    }

    function handlePageSizeChange(val: string) {
        pagination.pageSize = parseInt(val, 10);
        pagination.page = 1;
        fetchInvoices();
    }

    function goToPage(p: number) {
        if (p < 1 || p > pagination.totalPages || p === pagination.page) return;
        pagination.page = p;
        fetchInvoices();
    }

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

    async function fetchInvoices() {
        loading = true;
        try {
            const [sort, order] = sortValue.split('_');
            const params = new URLSearchParams({
                page: String(pagination.page),
                pageSize: String(pagination.pageSize),
                search: searchQuery,
                status: statusFilter,
                sort,
                order
            });

            const res = await fetch(`/member/api/invoices?${params.toString()}`);
            const json = await res.json();
            if (json.status === 'success') {
                invoices = json.data.invoices || [];
                pagination = json.data.pagination || pagination;
                counts = json.data.counts || counts;
            }
        } catch (e) {
            console.error('Failed to fetch invoices:', e);
        } finally {
            loading = false;
        }
    }

    onMount(() => {
        fetchInvoices();
    });

    onDestroy(() => {
        if (searchTimeout) clearTimeout(searchTimeout);
    });
</script>

<Layout activePage="invoices" eyebrow="ZIQVA DIGITAL INVOICE">
    <main class="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-2xl font-extrabold text-[var(--text)]">Faktur & Invoice</h1>
                <p class="text-[var(--text-3)] text-sm mt-1">Kelola dan unduh seluruh bukti pembayaran resmi pesanan Anda.</p>
            </div>
        </div>

        <!-- Filter Controls: SegmentedTabs on Desktop (md+), CustomSelect Dropdown on Mobile (< md) -->
        <div class="w-full">
            <!-- 1. Desktop Tabs (>= md screens) -->
            <div class="hidden md:flex items-center gap-2">
                <SegmentedTabs
                    tabs={statusTabs}
                    activeTab={statusFilter}
                    on:tabChange={(e) => setStatusFilter(e.detail)}
                    on:change={(e) => setStatusFilter(e.detail)}
                />
            </div>

            <!-- 2. Mobile Dropdown (< md screens, right-aligned & content-fitted) -->
            <div class="block md:hidden">
                <div class="flex items-center justify-between gap-3">
                    <span class="text-xs font-bold text-[var(--text-3)] dark:text-slate-400 shrink-0">Filter Status:</span>
                    <div class="shrink-0">
                        <CustomSelect
                            options={statusFilterOptions}
                            value={statusFilter}
                            fullWidth={false}
                            on:change={(e) => setStatusFilter(String(e.detail))}
                        />
                    </div>
                </div>
            </div>
        </div>

        <!-- Table Container Card -->
        <div class="bg-[var(--surface)] shadow rounded-2xl border border-[var(--border)] dark:border-[#22314d] relative">
            <!-- Search & Controls Bar (Compact Single Line on Mobile & Desktop) -->
            <div class="p-3 sm:p-4 border-b border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-2.5 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-t-2xl relative z-20">
                <div class="flex-1 min-w-0 sm:max-w-xs relative">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        on:input={handleSearchInput}
                        placeholder="Cari No Invoice, Produk..."
                        class="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)] transition-colors"
                    />
                    <svg class="w-3.5 h-3.5 text-[var(--text-3)] dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {#if searchQuery}
                        <button
                            type="button"
                            on:click={() => { searchQuery = ''; pagination.page = 1; fetchInvoices(); }}
                            class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)] dark:text-slate-400 hover:text-[var(--text)] dark:hover:text-white bg-transparent border-0 cursor-pointer p-0.5"
                        >
                            &times;
                        </button>
                    {/if}
                </div>

                <div class="flex items-center gap-1.5 shrink-0 text-xs text-[var(--text-3)] dark:text-slate-300">
                    <span class="hidden sm:inline font-semibold">Urutan:</span>
                    <CustomSelect
                        options={sortOptions}
                        value={sortValue}
                        fullWidth={false}
                        on:change={(e) => handleSortChange(String(e.detail))}
                    />
                </div>
            </div>

            <!-- Table Body -->
            {#if loading}
                <div class="p-12 text-center text-[var(--text-3)] dark:text-slate-400 space-y-3">
                    <div class="w-8 h-8 mx-auto border-3 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
                    <p class="text-xs">Memuat data invoice...</p>
                </div>
            {:else if invoices.length === 0}
                <div class="p-12 text-center space-y-4">
                    <div class="w-14 h-14 mx-auto rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 flex items-center justify-center text-[var(--text-3)] dark:text-slate-400">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-bold text-sm text-[var(--text)] dark:text-white">Tidak ada faktur ditemukan</h3>
                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau tab filter Anda.</p>
                    </div>
                </div>
            {:else}
                <!-- 1. Mobile Card List (Visible on mobile < md screens, zero horizontal scroll) -->
                <div class="block md:hidden divide-y divide-[var(--border)] dark:divide-[#22314d]">
                    {#each invoices as inv, idx (inv.id)}
                        <div class="p-4 space-y-3 {idx % 2 === 1 ? 'bg-slate-100/80 dark:bg-[#141f36]' : 'bg-[var(--surface)] dark:bg-[#0c1322]'} hover:bg-blue-50/70 dark:hover:bg-[#1a2845] transition-colors">
                            <!-- Card Header: Product Icon, Invoice No, Product Name, Date & Status -->
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-center gap-3 min-w-0 flex-1">
                                    {#if inv.productImage}
                                        <div class="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700 shadow-xs">
                                            <img src="{inv.productImage}" alt="{inv.productName}" class="w-full h-full object-cover" />
                                        </div>
                                    {:else}
                                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center flex-shrink-0 shadow-xs">
                                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                    {/if}
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <a
                                                href="/api/v1/invoice/{inv.token}/pdf"
                                                target="_blank"
                                                class="font-mono font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 text-xs hover:underline inline-flex items-center gap-1"
                                            >
                                                <span>{inv.invoiceNumber}</span>
                                                <svg class="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                            </a>
                                        </div>
                                        <span class="font-bold text-xs text-[var(--text)] dark:text-white truncate block mt-0.5" title="{inv.productName}">
                                            {inv.productName}
                                        </span>
                                        <span class="text-[11px] text-[var(--text-3)] dark:text-slate-400 block mt-0.5">
                                            {inv.createdDateStr}
                                        </span>
                                    </div>
                                </div>

                                <!-- Status Badge -->
                                <div class="shrink-0">
                                    {#if inv.isPaid}
                                        <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                            LUNAS
                                        </span>
                                    {:else}
                                        <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                            UNPAID
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Card Bottom: Total Amount & Actions -->
                            <div class="flex items-center justify-between pt-2.5 border-t border-[var(--border)] dark:border-[#22314d]">
                                <div>
                                    <span class="text-[10px] uppercase font-bold text-[var(--text-3)] block">Total Tagihan</span>
                                    <span class="text-xs font-bold font-mono {inv.totalAmount === 0 ? 'text-emerald-500' : 'text-[var(--text)] dark:text-white'}">
                                        {#if inv.totalAmount === 0}
                                            GRATIS
                                        {:else}
                                            Rp {inv.totalAmount.toLocaleString('id-ID')}
                                        {/if}
                                    </span>
                                </div>

                                <!-- Action Buttons on Mobile -->
                                <div class="flex items-center gap-1.5">
                                    <a
                                        href="#/invoice/{inv.token}"
                                        target="_blank"
                                        class="h-8 px-2.5 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-blue-600 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center transition-all shadow-xs text-xs font-semibold gap-1"
                                        title="Buka Faktur Digital"
                                    >
                                        <svg class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                        </svg>
                                        <span>Faktur</span>
                                    </a>
                                    <a
                                        href="/api/v1/invoice/{inv.token}/pdf"
                                        target="_blank"
                                        class="h-8 px-2.5 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-rose-600 dark:hover:bg-rose-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 inline-flex items-center justify-center transition-all shadow-xs text-xs font-semibold gap-1"
                                        title="Unduh Dokumen PDF"
                                    >
                                        <svg class="w-3.5 h-3.5 text-rose-500 dark:text-rose-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                        </svg>
                                        <span>PDF</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- 2. Desktop Full Table (Visible on md and larger screens >= 768px) -->
                <div class="hidden md:block overflow-x-auto">
                    <table class="min-w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="border-b border-[var(--border)] dark:border-[#22314d] text-[var(--text-3)] dark:text-slate-400 font-bold uppercase tracking-wider bg-[var(--surface-2)] dark:bg-[#131d31] whitespace-nowrap">
                                <th class="px-6 py-4 whitespace-nowrap w-[150px] min-w-[150px] max-w-[150px]">Nomor Faktur</th>
                                <th class="px-6 py-4 whitespace-nowrap">Produk / Layanan</th>
                                <th class="px-6 py-4 whitespace-nowrap">Tanggal Terbit</th>
                                <th class="px-6 py-4 whitespace-nowrap">Total Amount</th>
                                <th class="px-6 py-4 whitespace-nowrap">Status</th>
                                <th class="px-6 py-4 text-right whitespace-nowrap">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)] dark:divide-[#22314d]">
                            {#each invoices as inv, idx (inv.id)}
                                <tr class="{idx % 2 === 1 ? 'bg-slate-100/70 dark:bg-[#141f36]' : 'bg-[var(--surface)] dark:bg-[#0c1322]'} hover:bg-blue-50/70 dark:hover:bg-[#1a2845] transition-colors">
                                    <td class="px-6 py-4 whitespace-nowrap w-[150px] min-w-[150px] max-w-[150px]">
                                        <Tooltip text="Buka Dokumen PDF (Tab Baru)" position="top">
                                            <a
                                                href="/api/v1/invoice/{inv.token}/pdf"
                                                target="_blank"
                                                class="font-mono font-bold text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 hover:underline inline-flex items-center gap-1 transition-colors"
                                            >
                                                <span>{inv.invoiceNumber}</span>
                                                <svg class="w-3 h-3 opacity-70 hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                </svg>
                                            </a>
                                        </Tooltip>
                                    </td>
                                    <td class="px-6 py-4 font-bold text-[var(--text)] dark:text-white whitespace-nowrap">
                                        <div class="flex items-center gap-3">
                                            {#if inv.productImage}
                                                <div class="w-10 h-10 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 border border-slate-200 dark:border-slate-700">
                                                    <img src="{inv.productImage}" alt="{inv.productName}" class="w-full h-full object-cover" />
                                                </div>
                                            {:else}
                                                <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center flex-shrink-0">
                                                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                    </svg>
                                                </div>
                                            {/if}
                                            <div class="flex flex-col max-w-[200px] sm:max-w-[250px]">
                                                <span class="truncate" title="{inv.productName}">{inv.productName}</span>
                                                {#if inv.productDescription}
                                                    <span class="text-[10px] text-[var(--text-3)] font-normal truncate mt-0.5" title="{inv.productDescription}">{inv.productDescription}</span>
                                                {/if}
                                            </div>
                                        </div>
                                    </td>
                                    <td class="px-6 py-4 text-[var(--text-3)] dark:text-slate-300 whitespace-nowrap">
                                        {inv.createdDateStr}
                                    </td>
                                    <td class="px-6 py-4 font-extrabold text-[var(--text)] dark:text-white whitespace-nowrap">
                                        {#if inv.totalAmount === 0}
                                            <span class="text-emerald-500 font-bold">GRATIS</span>
                                        {:else}
                                            Rp {inv.totalAmount.toLocaleString('id-ID')}
                                        {/if}
                                    </td>
                                    <td class="px-6 py-4 whitespace-nowrap">
                                        {#if inv.isPaid}
                                            <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                                                LUNAS
                                            </span>
                                        {:else}
                                            <span class="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30">
                                                UNPAID
                                            </span>
                                        {/if}
                                    </td>
                                    <td class="px-6 py-4 text-right whitespace-nowrap">
                                        <div class="inline-flex items-center gap-1.5 justify-end">
                                            <Tooltip text="Lihat Detail Faktur (Tab Baru)" position="top">
                                                <a
                                                    href="#/invoice/{inv.token}"
                                                    target="_blank"
                                                    class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-blue-600 dark:hover:bg-blue-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-blue-600 dark:hover:border-blue-600 inline-flex items-center justify-center transition-all shadow-xs cursor-pointer group"
                                                >
                                                    <svg class="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 group-hover:text-white transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </a>
                                            </Tooltip>
                                            <Tooltip text="Unduh Dokumen PDF" position="top">
                                                <a
                                                    href="/api/v1/invoice/{inv.token}/pdf"
                                                    target="_blank"
                                                    class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-rose-600 dark:hover:bg-rose-600 text-slate-700 dark:text-slate-200 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-rose-600 dark:hover:border-rose-600 inline-flex items-center justify-center transition-all shadow-xs cursor-pointer group"
                                                >
                                                    <svg class="w-3.5 h-3.5 text-rose-500 dark:text-rose-400 group-hover:text-white transition-colors flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                    </svg>
                                                </a>
                                            </Tooltip>
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Dynamic Pagination Footer -->
                {#if pagination.totalPages > 1 || pagination.totalItems > 0}
                    <div class="p-4 border-t border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row items-center justify-between gap-4 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-b-2xl relative z-20">
                        <div class="flex items-center gap-3 flex-wrap">
                            <div class="text-xs text-[var(--text-3)] dark:text-slate-300">
                                Menampilkan <strong class="text-[var(--text)] dark:text-white font-bold">{startRowIndex} - {endRowIndex}</strong> dari <strong class="text-[var(--text)] dark:text-white font-bold">{pagination.totalItems}</strong> invoice
                            </div>
                            <div class="flex items-center gap-1.5">
                                <CustomSelect
                                    options={pageSizeOptions}
                                    value={String(pagination.pageSize)}
                                    on:change={(e) => handlePageSizeChange(e.detail)}
                                />
                            </div>
                        </div>

                        <!-- Numbered Pagination Buttons -->
                        <div class="flex items-center gap-1">
                            <button
                                type="button"
                                on:click={() => goToPage(pagination.page - 1)}
                                disabled={pagination.page <= 1}
                                class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                title="Halaman sebelumnya"
                                aria-label="Halaman sebelumnya"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            {#each pageNumbers as p}
                                {#if p === '...'}
                                    <span class="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-3)] dark:text-slate-500 font-bold select-none">...</span>
                                {:else}
                                    <button
                                        type="button"
                                        on:click={() => goToPage(p)}
                                        class="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center {pagination.page === p ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border-0' : 'border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs'}"
                                    >
                                        {p}
                                    </button>
                                {/if}
                            {/each}

                            <button
                                type="button"
                                on:click={() => goToPage(pagination.page + 1)}
                                disabled={pagination.page >= pagination.totalPages}
                                class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                title="Halaman berikutnya"
                                aria-label="Halaman berikutnya"
                            >
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    </div>
                {/if}
            {/if}
        </div>
    </main>
</Layout>
