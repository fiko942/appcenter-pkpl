<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import AdminLayout from '../components/AdminLayout.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';

    interface PayoutItem {
        id: number;
        created_timestamp?: number;
        created: string;
        affiliate_email: string;
        affiliate_name?: string;
        whatsapp?: string | null;
        bank_name?: string | null;
        no_rek?: string | null;
        payout_name?: string | null;
        kupon?: string | null;
        amount: number;
        note: string;
        accepted_by: string;
    }

    interface PayoutStats {
        totalPaidAllTime: number;
        totalPayoutsCount: number;
        avgPayoutAllTime: number;
        totalPaidThisMonth: number;
        totalPayoutsThisMonth: number;
    }

    interface HistoryData {
        payouts: PayoutItem[];
        stats?: PayoutStats;
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
        filterEmail?: string;
        sort: string;
        order: string;
    }

    let loading: boolean = true;
    let error: string = '';
    let historyData: HistoryData | null = null;

    let emailFilter: string = '';
    let currentPage: number = 1;
    let pageSize: number = 10;
    let sortValue: string = 'created_desc';

    // Toast/Copied feedback
    let copiedText: string = '';
    let copyToastTimer: any = null;

    // Detail Modal state
    let detailModalOpen: boolean = false;
    let selectedPayout: PayoutItem | null = null;

    const sortOptions: OptionItem[] = [
        { value: 'created_desc', label: 'Waktu Transfer (Terbaru)' },
        { value: 'created_asc', label: 'Waktu Transfer (Terlama)' },
        { value: 'amount_desc', label: 'Nominal Payout (Terbesar)' },
        { value: 'amount_asc', label: 'Nominal Payout (Terkecil)' }
    ];

    const pageSizeOptions: OptionItem[] = [
        { value: 10, label: '10 baris / hal' },
        { value: 20, label: '20 baris / hal' },
        { value: 50, label: '50 baris / hal' },
        { value: 100, label: '100 baris / hal' }
    ];

    onMount(async () => {
        await loadHistory();
    });

    onDestroy(() => {
        if (searchTimeout) clearTimeout(searchTimeout);
        if (copyToastTimer) clearTimeout(copyToastTimer);
    });

    async function loadHistory() {
        loading = true;
        error = '';
        try {
            const [sortField, sortOrder] = sortValue.split('_');
            const query = new URLSearchParams({
                page: currentPage.toString(),
                limit: pageSize.toString(),
                sort: sortField || 'created',
                order: sortOrder || 'desc'
            });

            if (emailFilter.trim()) {
                query.set('email', emailFilter.trim());
            }

            const res = await fetch(`/admin/api/affiliate/history?${query.toString()}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/#/admin/login';
                return;
            }

            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data) {
                historyData = json.data;
                currentPage = json.data.pagination.page;
            } else {
                error = json.message || 'Gagal memuat riwayat payout.';
            }
        } catch (err) {
            console.error('Fetch payout history error:', err);
            error = 'Terjadi kesalahan jaringan saat memuat riwayat payout.';
        } finally {
            loading = false;
        }
    }

    let searchTimeout: any = null;

    function handleSearchInput() {
        if (searchTimeout) clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            currentPage = 1;
            loadHistory();
        }, 300);
    }

    function handleFilterSubmit(e: Event) {
        e.preventDefault();
        if (searchTimeout) clearTimeout(searchTimeout);
        currentPage = 1;
        loadHistory();
    }

    function handleSortChange(newSort: number | string) {
        sortValue = String(newSort);
        currentPage = 1;
        loadHistory();
    }

    function handlePageSizeChange(newLimit: number | string) {
        pageSize = Number(newLimit);
        currentPage = 1;
        loadHistory();
    }

    function handlePageChange(newPage: number) {
        if (newPage >= 1 && (!historyData || newPage <= historyData.pagination.totalPages)) {
            currentPage = newPage;
            loadHistory();
        }
    }

    function copyToClipboard(text: string, label: string) {
        if (!text || text === '-') return;
        navigator.clipboard.writeText(text);
        copiedText = label;
        if (copyToastTimer) clearTimeout(copyToastTimer);
        copyToastTimer = setTimeout(() => {
            copiedText = '';
        }, 2200);
    }

    function getBankLogo(bank: string): string | null {
        const b = (bank || '').trim().toUpperCase();
        if (b.includes('BCA')) return '/images/banks/bca.svg';
        if (b.includes('BNI')) return '/images/banks/bni.svg';
        if (b.includes('BRI')) return '/images/banks/bri.svg';
        if (b.includes('MANDIRI')) return '/images/banks/mandiri.svg';
        if (b.includes('CIMB')) return '/images/banks/cimb.svg';
        if (b.includes('JAGO')) return '/images/banks/jago.svg';
        if (b.includes('SEABANK')) return '/images/banks/seabank.svg';
        if (b.includes('DANA')) return '/images/banks/dana.svg';
        if (b.includes('OVO')) return '/images/banks/ovo.svg';
        if (b.includes('GOPAY')) return '/images/banks/gopay.svg';
        return null;
    }

    function getBankBadgeStyle(bank: string): string {
        const b = (bank || '').trim().toUpperCase();
        if (b.includes('BCA')) return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30';
        if (b.includes('BNI')) return 'bg-teal-500/10 text-teal-800 dark:text-teal-400 border-teal-500/30';
        if (b.includes('BRI')) return 'bg-sky-500/10 text-sky-800 dark:text-sky-400 border-sky-500/30';
        if (b.includes('MANDIRI')) return 'bg-amber-500/10 text-amber-800 dark:text-amber-400 border-amber-500/30';
        if (b.includes('JAGO') || b.includes('SEABANK') || b.includes('DANA') || b.includes('OVO') || b.includes('GOPAY')) {
            return 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30';
        }
        return 'bg-[var(--surface-2)] text-[var(--text)] border-[var(--border)]';
    }

    function formatCurrency(amount: number): string {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    function getInitial(nameOrEmail: string): string {
        return (nameOrEmail || 'A').charAt(0).toUpperCase();
    }

    function formatWhatsApp(rawPhone: string | null | undefined): string | null {
        if (!rawPhone) return null;
        let clean = rawPhone.replace(/\D/g, '');
        if (clean.startsWith('0')) {
            clean = '62' + clean.slice(1);
        }
        return clean;
    }

    function openDetailModal(item: PayoutItem) {
        selectedPayout = item;
        detailModalOpen = true;
    }

    function closeDetailModal() {
        detailModalOpen = false;
        selectedPayout = null;
    }

    function generateWaConfirmationLink(item: PayoutItem): string | null {
        const phone = formatWhatsApp(item.whatsapp);
        if (!phone) return null;
        const msg = `Halo Kak ${item.affiliate_name || item.payout_name || 'Mitra'},\n\nKami informasikan bahwa komisi affiliate AppCenter sebesar *${formatCurrency(item.amount)}* telah berhasil ditransfer ke rekening:\n• Bank: *${item.bank_name || '-'}*\n• No. Rekening: *${item.no_rek || '-'}*\n• Atas Nama: *${item.payout_name || '-'}*\n• ID Transfer: *#${item.id}*\n• Waktu: ${item.created}\n\nTerima kasih atas kerja samanya!`;
        return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
    }

    function copyReceiptText(item: PayoutItem) {
        const msg = `BUKTI PENCAIRAN KOMISI AFFILIATE\nID Transaksi: #${item.id}\nWaktu: ${item.created}\nMitra: ${item.affiliate_name || item.payout_name || '-'} (${item.affiliate_email})\nNominal: ${formatCurrency(item.amount)}\nRekening: ${item.bank_name || '-'} - ${item.no_rek || '-'} a.n. ${item.payout_name || '-'}\nOperator: ${item.accepted_by}\nStatus: BERHASIL DITRANSFER`;
        copyToClipboard(msg, 'Format Bukti Transfer');
    }
</script>

<svelte:head>
    <title>Riwayat Pembayaran Komisi - Admin Appcenter</title>
</svelte:head>

<AdminLayout activePage="affiliate-history">
    <main class="page-body p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        <!-- Floating Copy Toast -->
        {#if copiedText}
            <div class="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold shadow-2xl border border-slate-700 flex items-center gap-2 animate-bounce">
                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{copiedText} berhasil disalin!</span>
            </div>
        {/if}

        <!-- Top Header & Breadcrumb -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div class="flex items-start justify-between gap-3 min-w-0">
                <div class="min-w-0">
                    <div class="flex items-center gap-2 mb-1">
                        <a
                            href="#/admin/affiliate"
                            class="inline-flex items-center gap-1 text-xs text-[var(--brand)] hover:underline font-bold uppercase tracking-wider"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                            <span>Affiliate Management</span>
                        </a>
                        <span class="text-xs text-[var(--text-3)] hidden xs:inline">/</span>
                        <span class="text-xs text-[var(--text-2)] font-medium hidden xs:inline">Riwayat Pembayaran</span>
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">
                        Riwayat Pembayaran Komisi
                    </h1>
                    <p class="text-xs sm:text-sm text-[var(--text-3)] mt-0.5 max-w-xl">
                        Log audit transaksi transfer dana komisi kepada partner affiliasi yang telah diproses.
                    </p>
                </div>

                <!-- Mobile Action Button (Top Right Refresh Icon) -->
                <div class="sm:hidden flex-shrink-0 pt-1">
                    <button
                        type="button"
                        on:click={() => loadHistory()}
                        class="p-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-all shadow-xs cursor-pointer active:scale-95 flex items-center justify-center"
                        title="Refresh Data"
                        aria-label="Refresh Data"
                    >
                        <svg class="w-4 h-4 text-[var(--text-2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Desktop Action Button -->
            <div class="hidden sm:flex items-center gap-2.5 flex-shrink-0">
                <button
                    type="button"
                    on:click={() => loadHistory()}
                    class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-all shadow-xs cursor-pointer"
                    title="Refresh Data"
                >
                    <svg class="w-4 h-4 text-[var(--text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                </button>
            </div>
        </div>

        {#if error}
            <div class="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-2.5">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                </div>
                <button type="button" on:click={loadHistory} class="underline text-xs font-bold cursor-pointer">Coba Lagi</button>
            </div>
        {/if}

        <!-- 4 Metric Overview Cards (Compact 2x2 Grid on Mobile, 4-Cols on Desktop) -->
        {#if historyData}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <!-- Total Akumulasi Dana Dicairkan (Emerald) -->
                <div class="p-3.5 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <span class="text-[10px] sm:text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider truncate">Dana Dicairkan</span>
                        <div class="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-sm xs:text-base sm:text-2xl font-extrabold text-emerald-700 dark:text-emerald-400 tracking-tight truncate" title={formatCurrency(historyData.stats?.totalPaidAllTime || 0)}>
                            {formatCurrency(historyData.stats?.totalPaidAllTime || 0)}
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-[var(--text-3)] mt-0.5 sm:mt-1 flex items-center gap-1 truncate">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                            <span class="truncate">Kumulatif transfer</span>
                        </p>
                    </div>
                </div>

                <!-- Total Payout Berhasil (Blue) -->
                <div class="p-3.5 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <span class="text-[10px] sm:text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider truncate">Total Payout</span>
                        <div class="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-blue-500/15 dark:bg-blue-500/10 border border-blue-500/30 text-blue-700 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-sm xs:text-base sm:text-2xl font-extrabold text-blue-700 dark:text-blue-400 tracking-tight truncate">
                            {historyData.stats?.totalPayoutsCount || historyData.pagination.total} <span class="text-[10px] sm:text-xs font-medium text-[var(--text-3)]">trx</span>
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-[var(--text-3)] mt-0.5 sm:mt-1 flex items-center gap-1 truncate">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                            <span class="truncate">Log transaksi</span>
                        </p>
                    </div>
                </div>

                <!-- Rata-rata per Payout (Purple) -->
                <div class="p-3.5 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <span class="text-[10px] sm:text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider truncate">Rata-Rata / Trx</span>
                        <div class="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-purple-500/15 dark:bg-purple-500/10 border border-purple-500/30 text-purple-700 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-sm xs:text-base sm:text-2xl font-extrabold text-purple-700 dark:text-purple-400 tracking-tight truncate" title={formatCurrency(historyData.stats?.avgPayoutAllTime || 0)}>
                            {formatCurrency(historyData.stats?.avgPayoutAllTime || 0)}
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-[var(--text-3)] mt-0.5 sm:mt-1 flex items-center gap-1 truncate">
                            <span class="w-1.5 h-1.5 rounded-full bg-purple-500 flex-shrink-0"></span>
                            <span class="truncate">Nominal rata-rata</span>
                        </p>
                    </div>
                </div>

                <!-- Dicairkan Bulan Ini (Amber) -->
                <div class="p-3.5 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <span class="text-[10px] sm:text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider truncate">Bulan Ini</span>
                        <div class="w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-amber-500/15 dark:bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-sm xs:text-base sm:text-2xl font-extrabold text-amber-700 dark:text-amber-400 tracking-tight truncate" title={formatCurrency(historyData.stats?.totalPaidThisMonth || 0)}>
                            {formatCurrency(historyData.stats?.totalPaidThisMonth || 0)}
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-[var(--text-3)] mt-0.5 sm:mt-1 flex items-center gap-1 truncate">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                            <span class="truncate"><b class="text-amber-800 dark:text-amber-300 font-bold">{historyData.stats?.totalPayoutsThisMonth || 0}</b> transfer</span>
                        </p>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Unified Enterprise Toolbar & Table Card -->
        <div class="rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
            <!-- Toolbar -->
            <div class="p-4 sm:p-5 border-b border-[var(--border)] space-y-4">
                <form on:submit={handleFilterSubmit} class="relative w-full">
                    <input
                        type="text"
                        bind:value={emailFilter}
                        on:input={handleSearchInput}
                        placeholder="Cari affiliator email, nama, catatan, nomor rekening, atau admin..."
                        class="w-full pl-10 pr-9 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                    />
                    <svg class="w-4 h-4 text-[var(--text-3)] absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {#if emailFilter}
                        <button
                            type="button"
                            on:click={() => { emailFilter = ''; currentPage = 1; loadHistory(); }}
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] text-xs font-bold p-1 cursor-pointer"
                            aria-label="Clear Filter"
                        >
                            ✕
                        </button>
                    {/if}
                </form>

                <!-- Row 2: Sort Controls & Active Counts -->
                <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div class="text-[var(--text-3)] flex items-center gap-2">
                        <span>Menampilkan <b class="text-[var(--text)]">{historyData?.payouts.length || 0}</b> dari {historyData?.pagination.total || 0} riwayat pencairan</span>
                        {#if emailFilter || sortValue !== 'created_desc'}
                            <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-[var(--surface-2)] text-[var(--brand)] border border-[var(--border)]">
                                Filter Aktif
                            </span>
                        {/if}
                    </div>

                    <div class="flex items-center gap-2.5 flex-wrap">
                        <div class="flex items-center gap-1.5">
                            <span class="text-[var(--text-3)]">Urutan:</span>
                            <CustomSelect
                                options={sortOptions}
                                bind:value={sortValue}
                                on:change={(e) => handleSortChange(e.detail)}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Area -->
            {#if loading}
                <div class="p-16 text-center">
                    <div class="w-9 h-9 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p class="text-xs font-medium text-[var(--text-3)]">Memuat log riwayat payout...</p>
                </div>
            {:else if !historyData || historyData.payouts.length === 0}
                <div class="p-16 text-center">
                    <div class="w-14 h-14 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)] mx-auto mb-3 flex items-center justify-center">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p class="text-sm font-bold text-[var(--text)]">Belum ada riwayat pembayaran</p>
                    <p class="text-xs text-[var(--text-3)] mt-1 max-w-sm mx-auto">
                        {emailFilter ? 'Tidak ditemukan transaksi yang cocok dengan kata kunci pencarian.' : 'Seluruh log transfer komisi yang diproses akan otomatis tercatat di sini.'}
                    </p>
                </div>
            {:else}
                <!-- Desktop Table View (md and up) -->
                <div class="hidden md:block overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-[var(--surface-2)] text-[var(--text-3)] uppercase tracking-wider font-bold border-b border-[var(--border)] select-none">
                                <th class="py-3.5 px-4 w-20 whitespace-nowrap">ID</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">WAKTU TRANSFER</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">AFFILIATOR</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">REKENING TUJUAN</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">NOMINAL</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">OPERATOR & CATATAN</th>
                                <th class="py-3.5 px-4 text-right whitespace-nowrap">AKSI</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)]">
                            {#each historyData.payouts as item (item.id)}
                                <tr class="hover:bg-[var(--surface-2)]/40 transition-colors group">
                                    <!-- ID -->
                                    <td class="py-3.5 px-4">
                                        <button
                                            type="button"
                                            on:click={() => openDetailModal(item)}
                                            class="font-mono font-bold text-[var(--brand)] hover:underline flex items-center gap-1 cursor-pointer"
                                            title="Klik untuk lihat detail transaksi"
                                        >
                                            <span>#{item.id}</span>
                                        </button>
                                    </td>

                                    <!-- Created At -->
                                    <td class="py-3.5 px-4 text-[var(--text-2)] whitespace-nowrap">
                                        <div class="flex items-center gap-1.5">
                                            <svg class="w-3.5 h-3.5 text-[var(--text-3)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <span class="font-medium">{item.created}</span>
                                        </div>
                                    </td>

                                    <!-- Affiliator & Contact -->
                                    <td class="py-3.5 px-4">
                                        <div class="flex items-center gap-2.5">
                                            <div class="w-7 h-7 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--brand)] font-bold flex items-center justify-center flex-shrink-0 text-[11px]">
                                                {getInitial(item.affiliate_name || item.affiliate_email)}
                                            </div>
                                            <div class="space-y-0.5">
                                                <div class="flex items-center gap-1.5">
                                                    <span class="font-bold text-[var(--text)]">{item.affiliate_name || 'Mitra'}</span>
                                                    {#if item.kupon}
                                                        <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-blue-500/10 text-[var(--brand)] border border-blue-500/20 font-bold">
                                                            {item.kupon}
                                                        </span>
                                                    {/if}
                                                </div>
                                                <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-3)]">
                                                    <button
                                                        type="button"
                                                        on:click={() => copyToClipboard(item.affiliate_email, `Email ${item.affiliate_email}`)}
                                                        class="hover:text-[var(--text)] transition-colors cursor-pointer truncate max-w-[180px]"
                                                        title="Klik untuk salin email"
                                                    >
                                                        {item.affiliate_email}
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Rekening Tujuan -->
                                    <td class="py-3.5 px-4">
                                        {#if item.bank_name && item.no_rek}
                                            <div class="space-y-1">
                                                <div class="flex items-center gap-2">
                                                    {#if getBankLogo(item.bank_name)}
                                                        <div class="h-6 px-1.5 py-0.5 rounded-lg bg-white border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-center flex-shrink-0" title="{item.bank_name}">
                                                            <img src="{getBankLogo(item.bank_name)}" alt="{item.bank_name}" class="h-3.5 w-auto max-w-[44px] object-contain" />
                                                        </div>
                                                    {:else}
                                                        <span class="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border {getBankBadgeStyle(item.bank_name)}">
                                                            {item.bank_name}
                                                        </span>
                                                    {/if}
                                                    <button
                                                        type="button"
                                                        on:click={() => copyToClipboard(item.no_rek || '', 'Nomor Rekening')}
                                                        class="font-mono font-bold text-xs text-[var(--text)] hover:text-[var(--brand)] transition-colors cursor-pointer flex items-center gap-1.5 group/btn"
                                                        title="Klik untuk salin no rekening"
                                                    >
                                                        <span class="tracking-wide">{item.no_rek}</span>
                                                        <svg class="w-3.5 h-3.5 text-[var(--text-3)] group-hover/btn:text-[var(--brand)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                        </svg>
                                                    </button>
                                                </div>
                                                {#if item.payout_name}
                                                    <div class="text-[11px] text-[var(--text-2)] truncate max-w-[200px]">
                                                        a.n. <strong class="text-[var(--text)] font-bold">{item.payout_name}</strong>
                                                    </div>
                                                {/if}
                                            </div>
                                        {:else}
                                            <span class="text-[var(--text-3)] italic text-[11px]">Rekening Tidak Tercatat</span>
                                        {/if}
                                    </td>

                                    <!-- Nominal Transfer -->
                                    <td class="py-3.5 px-4 whitespace-nowrap">
                                        <div class="space-y-1">
                                            <div class="font-extrabold text-emerald-700 dark:text-emerald-400 text-sm">
                                                {formatCurrency(item.amount)}
                                            </div>
                                            <div>
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 shadow-2xs">
                                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                    <span>Ditransfer</span>
                                                </span>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Operator & Note -->
                                    <td class="py-3.5 px-4">
                                        <div class="space-y-0.5 text-[11px]">
                                            <span class="inline-flex items-center px-1.5 py-0.5 rounded font-semibold bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]">
                                                {item.accepted_by}
                                            </span>
                                            {#if item.note}
                                                <p class="text-[var(--text-3)] italic truncate max-w-[160px] font-medium" title={item.note}>
                                                    {item.note}
                                                </p>
                                            {/if}
                                        </div>
                                    </td>

                                    <!-- Actions -->
                                    <td class="py-3.5 px-4 text-right">
                                        <div class="flex items-center justify-end gap-1.5">
                                            <!-- Detail Button -->
                                            <button
                                                type="button"
                                                on:click={() => openDetailModal(item)}
                                                class="p-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--brand)] hover:border-[var(--brand)]/40 transition-all cursor-pointer relative group/btn"
                                                title="Lihat Detail Transaksi"
                                            >
                                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            </button>

                                            <!-- WA Confirmation Button -->
                                            {#if item.whatsapp}
                                                {@const waLink = generateWaConfirmationLink(item)}
                                                {#if waLink}
                                                    <a
                                                        href={waLink}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        class="p-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-all cursor-pointer"
                                                        title="Kirim Konfirmasi via WhatsApp"
                                                    >
                                                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                                                        </svg>
                                                    </a>
                                                {/if}
                                            {/if}
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Mobile Card View (< md) -->
                <div class="md:hidden divide-y divide-[var(--border)]">
                    {#each historyData.payouts as item (item.id)}
                        <div class="p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <button
                                    type="button"
                                    on:click={() => openDetailModal(item)}
                                    class="font-mono font-bold text-xs text-[var(--brand)] hover:underline cursor-pointer"
                                >
                                    #{item.id}
                                </button>
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 shadow-2xs">
                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                    <span>Ditransfer</span>
                                </span>
                            </div>

                            <div class="flex items-center justify-between text-xs">
                                <div class="space-y-0.5">
                                    <div class="font-bold text-[var(--text)]">{item.affiliate_name || 'Mitra'}</div>
                                    <div class="text-[11px] text-[var(--text-3)]">{item.affiliate_email}</div>
                                </div>
                                <span class="font-extrabold text-emerald-700 dark:text-emerald-400 text-base">{formatCurrency(item.amount)}</span>
                            </div>

                            {#if item.bank_name && item.no_rek}
                                <div class="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[11px] space-y-1">
                                    <div class="flex items-center justify-between">
                                        <span class="text-[var(--text-3)] font-medium">Rekening:</span>
                                        <div class="flex items-center gap-1.5 font-bold text-[var(--text)]">
                                            {#if getBankLogo(item.bank_name)}
                                                <div class="h-5 px-1 rounded bg-white border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-center flex-shrink-0">
                                                    <img src="{getBankLogo(item.bank_name)}" alt="{item.bank_name}" class="h-3 w-auto max-w-[34px] object-contain" />
                                                </div>
                                            {:else}
                                                <span>{item.bank_name}</span>
                                            {/if}
                                            <span class="font-mono">{item.no_rek}</span>
                                        </div>
                                    </div>
                                    {#if item.payout_name}
                                        <div class="flex items-center justify-between">
                                            <span class="text-[var(--text-3)] font-medium">Atas Nama:</span>
                                            <span class="text-[var(--text)] font-semibold">{item.payout_name}</span>
                                        </div>
                                    {/if}
                                </div>
                            {/if}

                            <div class="flex items-center justify-between pt-1 text-[11px] text-[var(--text-3)]">
                                <span>{item.created}</span>
                                <div class="flex items-center gap-2">
                                    <button
                                        type="button"
                                        on:click={() => openDetailModal(item)}
                                        class="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold text-[11px] hover:border-[var(--brand)]/40 transition-colors"
                                    >
                                        Detail
                                    </button>
                                    {#if item.whatsapp}
                                        {@const waLink = generateWaConfirmationLink(item)}
                                        {#if waLink}
                                            <a
                                                href={waLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors flex items-center gap-1"
                                            >
                                                <span>WA</span>
                                            </a>
                                        {/if}
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Pagination Footer with PageSize Selector -->
                {#if historyData && historyData.payouts.length > 0}
                    <div class="p-4 border-t border-[var(--border)] bg-[var(--surface-2)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div class="flex items-center gap-3 flex-wrap">
                            <div class="text-[var(--text-3)]">
                                Halaman <b class="text-[var(--text)]">{historyData.pagination.page}</b> dari <b class="text-[var(--text)]">{historyData.pagination.totalPages}</b>
                                ({historyData.pagination.total} total log payout)
                            </div>
                            <div class="flex items-center gap-1.5">
                                <CustomSelect
                                    options={pageSizeOptions}
                                    bind:value={pageSize}
                                    on:change={(e) => handlePageSizeChange(e.detail)}
                                />
                            </div>
                        </div>

                        {#if historyData && historyData.pagination && historyData.pagination.totalPages > 1}
                            <div class="flex items-center justify-center gap-1 self-center sm:self-auto flex-wrap">
                                <!-- Prev Button (Arrow Icon Only) -->
                                <button
                                    type="button"
                                    on:click={() => historyData && handlePageChange(historyData.pagination.page - 1)}
                                    disabled={historyData.pagination.page <= 1}
                                    class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-white dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                    title="Halaman sebelumnya"
                                    aria-label="Halaman sebelumnya"
                                >
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                    </svg>
                                </button>

                                <!-- Page Numbers -->
                                <div class="flex items-center gap-1">
                                    {#each Array.from({ length: historyData.pagination.totalPages }, (_, i) => i + 1) as p}
                                        {#if p === 1 || p === historyData.pagination.totalPages || (p >= historyData.pagination.page - 1 && p <= historyData.pagination.page + 1)}
                                            <button
                                                type="button"
                                                on:click={() => handlePageChange(p)}
                                                class="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center {p === historyData.pagination.page ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border-0' : 'bg-white dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[var(--border)] dark:border-slate-700 shadow-2xs'}"
                                            >
                                                {p}
                                            </button>
                                        {:else if p === historyData.pagination.page - 2 || p === historyData.pagination.page + 2}
                                            <span class="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-3)] dark:text-slate-500 font-bold select-none">...</span>
                                        {/if}
                                    {/each}
                                </div>

                                <!-- Next Button (Arrow Icon Only) -->
                                <button
                                    type="button"
                                    on:click={() => historyData && handlePageChange(historyData.pagination.page + 1)}
                                    disabled={historyData.pagination.page >= historyData.pagination.totalPages}
                                    class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-white dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
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
            {/if}
        </div>
    </main>
</AdminLayout>

<!-- Modal Detail Bukti Pembayaran Payout -->
{#if detailModalOpen && selectedPayout}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
        <div class="w-full max-w-lg p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-5 overflow-hidden flex flex-col">
            <!-- Modal Header -->
            <div class="flex items-start justify-between pb-3.5 border-b border-[var(--border)] gap-2">
                <div class="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div class="px-2.5 py-1 sm:px-3.5 sm:py-1.5 min-w-[2.8rem] sm:min-w-[3.2rem] rounded-xl sm:rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-mono font-bold text-xs sm:text-sm flex-shrink-0 shadow-2xs">
                        #{selectedPayout.id}
                    </div>
                    <div class="min-w-0 flex-1">
                        <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                            <h3 class="text-sm sm:text-base font-bold text-[var(--text)] whitespace-nowrap">Bukti Payout Komisi</h3>
                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                                <span>Ditransfer</span>
                            </span>
                        </div>
                        <p class="text-[11px] sm:text-xs text-[var(--text-3)] mt-0.5 line-clamp-1 sm:line-clamp-none">Rincian transfer dana komisi partner affiliasi.</p>
                    </div>
                </div>
                <button
                    type="button"
                    on:click={closeDetailModal}
                    class="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] flex items-center justify-center cursor-pointer flex-shrink-0 transition-colors shadow-2xs"
                    aria-label="Tutup"
                >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Modal Body Content -->
            <div class="space-y-4 text-xs">
                <!-- Nominal Card -->
                <div class="p-4 rounded-2xl bg-emerald-500/15 dark:bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
                    <div>
                        <span class="text-[11px] font-bold text-emerald-800 dark:text-emerald-400 uppercase tracking-wider block">Total Dana Ditransfer</span>
                        <div class="text-2xl font-black text-emerald-700 dark:text-emerald-400 tracking-tight mt-0.5">
                            {formatCurrency(selectedPayout.amount)}
                        </div>
                    </div>
                    <div class="text-right text-[11px] text-[var(--text-3)]">
                        <div>Waktu Eksekusi:</div>
                        <div class="font-semibold text-[var(--text-2)]">{selectedPayout.created}</div>
                    </div>
                </div>

                <!-- Recipient Info -->
                <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2.5">
                    <div class="font-bold text-[var(--text-3)] uppercase tracking-wider text-[10px]">
                        Informasi Penerima Komisi
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                            <span class="text-[var(--text-3)] block text-[11px]">Nama Partner:</span>
                            <span class="font-bold text-[var(--text)]">{selectedPayout.affiliate_name || selectedPayout.payout_name || '-'}</span>
                        </div>
                        <div>
                            <span class="text-[var(--text-3)] block text-[11px]">Email Terdaftar:</span>
                            <span class="font-semibold text-[var(--text)]">{selectedPayout.affiliate_email}</span>
                        </div>
                        {#if selectedPayout.kupon}
                            <div>
                                <span class="text-[var(--text-3)] block text-[11px]">Kode Kupon:</span>
                                <span class="font-mono font-bold text-[var(--brand)]">{selectedPayout.kupon}</span>
                            </div>
                        {/if}
                        {#if selectedPayout.whatsapp}
                            <div>
                                <span class="text-[var(--text-3)] block text-[11px]">Nomor WhatsApp:</span>
                                <span class="font-mono font-semibold text-emerald-700 dark:text-emerald-400">{selectedPayout.whatsapp}</span>
                            </div>
                        {/if}
                    </div>
                </div>

                <!-- Destination Bank Account -->
                <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2.5">
                    <div class="font-bold text-[var(--text-3)] uppercase tracking-wider text-[10px]">
                        Rekening Bank Tujuan Payout
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div>
                            <span class="text-[var(--text-3)] block text-[11px]">Nama Bank / E-Wallet:</span>
                            <div class="flex items-center gap-2 mt-0.5">
                                {#if getBankLogo(selectedPayout.bank_name || '')}
                                    <div class="h-6 px-1.5 py-0.5 rounded-lg bg-white border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-center">
                                        <img src="{getBankLogo(selectedPayout.bank_name || '')}" alt="{selectedPayout.bank_name}" class="h-3.5 w-auto max-w-[44px] object-contain" />
                                    </div>
                                {/if}
                                <span class="font-bold text-[var(--text)]">{selectedPayout.bank_name || '-'}</span>
                            </div>
                        </div>
                        <div>
                            <span class="text-[var(--text-3)] block text-[11px]">Nomor Rekening:</span>
                            <div class="flex items-center gap-1.5">
                                <span class="font-mono font-black text-sm text-[var(--brand)]">{selectedPayout.no_rek || '-'}</span>
                                {#if selectedPayout.no_rek}
                                    <button
                                        type="button"
                                        on:click={() => copyToClipboard(selectedPayout?.no_rek || '', 'Nomor Rekening')}
                                        class="px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface)] text-[var(--text)] hover:bg-[var(--border)] font-semibold cursor-pointer"
                                    >
                                        Salin
                                    </button>
                                {/if}
                            </div>
                        </div>
                        <div class="sm:col-span-2">
                            <span class="text-[var(--text-3)] block text-[11px]">Atas Nama Rekening:</span>
                            <span class="font-semibold text-[var(--text)]">{selectedPayout.payout_name || selectedPayout.affiliate_name || '-'}</span>
                        </div>
                    </div>
                </div>

                <!-- Transaction Meta -->
                <div class="p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-1">
                    <div class="flex items-center justify-between text-[11px] text-[var(--text-3)]">
                        <span>Diproses oleh: <b class="text-[var(--text-2)]">{selectedPayout.accepted_by}</b></span>
                    </div>
                    {#if selectedPayout.note}
                        <p class="text-[var(--text-2)] italic text-[11px]">Catatan: "{selectedPayout.note}"</p>
                    {/if}
                </div>
            </div>

            <!-- Modal Footer Actions -->
            <div class="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2">
                <button
                    type="button"
                    on:click={() => selectedPayout && copyReceiptText(selectedPayout)}
                    class="px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--border)] transition-all cursor-pointer inline-flex items-center gap-1.5"
                >
                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    <span>Salin Format Bukti</span>
                </button>

                <div class="flex items-center gap-2">
                    {#if selectedPayout.whatsapp}
                        {@const waLink = generateWaConfirmationLink(selectedPayout)}
                        {#if waLink}
                            <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="px-4 py-2 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-xs inline-flex items-center gap-1.5"
                            >
                                <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                                </svg>
                                <span>Kirim WA</span>
                            </a>
                        {/if}
                    {/if}
                    <button
                        type="button"
                        on:click={closeDetailModal}
                        class="px-5 py-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text)] font-bold text-xs shadow-xs hover:shadow transition-all cursor-pointer inline-flex items-center gap-1.5 active:scale-95"
                    >
                        <svg class="w-3.5 h-3.5 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Tutup</span>
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

