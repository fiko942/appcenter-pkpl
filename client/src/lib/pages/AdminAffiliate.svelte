<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import AdminLayout from '../components/AdminLayout.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';

    interface UnpaidTransaction {
        affiliator_email: string;
        affiliate_income: number;
        product_name: string;
        product_image?: string | null;
        invoice_code: string;
        created_at: number;
    }

    interface AffiliateMember {
        id: number;
        email: string;
        memberSince?: string;
        created?: string;
        kupon?: string;
        coupon?: string;
        bank_name?: string;
        bank?: string;
        no_rek?: string;
        rek?: string;
        owner_name?: string;
        an?: string;
        pendingCommission?: number;
        unpaidCommission?: number;
        unpaidCount?: number;
        unpaidTransactions?: UnpaidTransaction[];
        paidCommission?: number;
        incomeThisMonth?: number;
        incomeLastMonth?: number;
        trend?: 'UP' | 'DOWN' | 'SAME';
        percentageChange?: number;
    }

    interface AffiliateStats {
        totalPaid: number;
        totalUnpaid: number;
        incomeThisMonth: number;
        incomeLastMonth: number;
    }

    interface TabCounts {
        all: number;
        unpaid: number;
        bank_set: number;
        no_bank: number;
    }

    interface AffiliateData {
        stats: AffiliateStats;
        tabCounts?: TabCounts;
        availableBanks?: string[];
        hasUnsetBank?: boolean;
        members: AffiliateMember[];
        pagination: {
            page: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
        search?: string;
    }

    let loading: boolean = true;
    let error: string = '';
    let successMessage: string = '';
    let affiliateData: AffiliateData | null = null;
    let searchInput: string = '';
    let prodImgErrorMap: Record<string, boolean> = {};

    // Filter & Sorting states
    let activeFilterTab: string = 'all';
    let selectedBankFilter: string = 'all';
    let sortValue: string = 'pending_desc';
    let pageSize: number = 10;
    let currentPage: number = 1;
    let searchDebounceTimer: any = null;

    // Toast/Copied feedback
    let copiedText: string = '';
    let copyToastTimer: any = null;

    // Modal state for Mark As Paid
    let payoutModalOpen: boolean = false;
    let payingMember: AffiliateMember | null = null;
    let isProcessingPayout: boolean = false;

    // Modal state for viewing Unpaid Breakdown
    let breakdownModalOpen: boolean = false;
    let breakdownMember: AffiliateMember | null = null;

    // Modal state for Editing Member Bank Account (Admin)
    let editBankModalOpen: boolean = false;
    let editingMember: AffiliateMember | null = null;
    let editBankCode: string = 'BCA';
    let editBankNoRek: string = '';
    let editBankOwner: string = '';
    let editBankError: string = '';
    let isSavingBank: boolean = false;

    // Strict 4 banks specification matching real database
    interface BankConfig {
        name: string;
        code: string;
        regex: RegExp;
        digitsLength: string;
        example: string;
    }

    const availableBanks: BankConfig[] = [
        { name: 'BCA (Bank Central Asia)', code: 'BCA', regex: /^\d{10}$/, digitsLength: '10 digit', example: '1234567890' },
        { name: 'BNI (Bank Negara Indonesia)', code: 'BNI', regex: /^\d{10}$/, digitsLength: '10 digit', example: '0382081235' },
        { name: 'BRI (Bank Rakyat Indonesia)', code: 'BRI', regex: /^\d{15}$/, digitsLength: '15 digit', example: '685001027930534' },
        { name: 'Bank Mandiri', code: 'Mandiri', regex: /^\d{13}$/, digitsLength: '13 digit', example: '1440017737203' }
    ];

    const bankSelectOptions: OptionItem[] = availableBanks.map(b => ({
        value: b.code,
        label: b.name,
        description: `Format: ${b.digitsLength}`
    }));

    $: activeEditBankConfig = availableBanks.find(b => b.code.toUpperCase() === editBankCode.toUpperCase()) || availableBanks[0];

    const sortOptions: OptionItem[] = [
        { value: 'pending_desc', label: 'Komisi Tertunda (Tertinggi)' },
        { value: 'pending_asc', label: 'Komisi Tertunda (Terendah)' },
        { value: 'income_desc', label: 'Komisi Bulan Ini (Tertinggi)' },
        { value: 'paid_desc', label: 'Total Sudah Dicairkan (Tertinggi)' },
        { value: 'bank_status', label: 'Status Bank (Lengkap Dahulu)' },
        { value: 'bank_unset_first', label: 'Status Bank (Belum Diset Dahulu)' },
        { value: 'email_asc', label: 'Email Affiliator (A - Z)' },
        { value: 'email_desc', label: 'Email Affiliator (Z - A)' },
        { value: 'kupon_asc', label: 'Kode Kupon (A - Z)' },
        { value: 'newest', label: 'Waktu Bergabung (Terbaru)' }
    ];

    const pageSizeOptions: OptionItem[] = [
        { value: 10, label: '10 baris / hal' },
        { value: 20, label: '20 baris / hal' },
        { value: 50, label: '50 baris / hal' },
        { value: 100, label: '100 baris / hal' }
    ];

    $: isBankSetFn = (m: AffiliateMember) => {
        const b = (m.bank_name || m.bank || '').trim();
        const r = (m.no_rek || m.rek || '').trim();
        return Boolean(b && b !== '-' && r && r !== '-');
    };

    $: bankOptions = (() => {
        const opts: OptionItem[] = [
            { value: 'all', label: 'Semua Bank' }
        ];
        if (affiliateData?.availableBanks) {
            affiliateData.availableBanks.forEach(b => {
                opts.push({
                    value: b,
                    label: `Bank ${b}`,
                    icon: getBankLogo(b) || undefined
                });
            });
        }
        if (affiliateData?.hasUnsetBank) {
            opts.push({ value: 'unset', label: 'Belum Diset', warning: true });
        }
        return opts;
    })();

    $: filterTabs = [
        { id: 'all', label: 'Semua', count: affiliateData?.tabCounts?.all ?? (affiliateData?.pagination?.total || 0), color: 'brand' as const },
        {
            id: 'unpaid',
            label: 'Menunggu Payout',
            count: affiliateData?.tabCounts?.unpaid ?? 0,
            color: 'amber' as const
        },
        {
            id: 'bank_set',
            label: 'Bank Lengkap',
            count: affiliateData?.tabCounts?.bank_set ?? 0,
            color: 'blue' as const
        },
        {
            id: 'no_bank',
            label: 'Belum Set Bank',
            count: affiliateData?.tabCounts?.no_bank ?? 0,
            color: 'rose' as const
        }
    ] as TabItem[];

    $: statusFilterOptions = filterTabs.map(t => ({
        value: t.id,
        label: `${t.label}${t.count !== undefined ? ` (${t.count})` : ''}`
    })) as OptionItem[];

    $: paginatedMembers = affiliateData?.members || [];
    $: totalPages = affiliateData?.pagination?.totalPages || 1;
    $: totalItems = affiliateData?.pagination?.total || 0;

    onMount(() => {
        loadAffiliateData();
    });

    onDestroy(() => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        if (copyToastTimer) clearTimeout(copyToastTimer);
    });

    async function loadAffiliateData() {
        loading = true;
        error = '';
        try {
            const query = new URLSearchParams({
                page: String(currentPage),
                limit: String(pageSize),
                search: searchInput.trim(),
                tab: activeFilterTab,
                bank: selectedBankFilter,
                sort: sortValue
            });

            const res = await fetch(`/admin/api/affiliate?${query.toString()}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/#/admin/login';
                return;
            }

            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data) {
                affiliateData = json.data;
                currentPage = json.data.pagination?.page || currentPage;
            } else {
                error = json.message || 'Gagal memuat data affiliate.';
            }
        } catch (err) {
            console.error('Fetch affiliate error:', err);
            error = 'Terjadi kesalahan jaringan saat memuat affiliate.';
        } finally {
            loading = false;
        }
    }

    function handleSearchInput(e: Event) {
        searchInput = (e.target as HTMLInputElement).value;
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            currentPage = 1;
            loadAffiliateData();
        }, 300);
    }

    function clearSearch() {
        searchInput = '';
        currentPage = 1;
        loadAffiliateData();
    }

    function handleTabChange(e: CustomEvent<string | number> | string | number) {
        const tabId = typeof e === 'string' || typeof e === 'number' ? String(e) : (e?.detail !== undefined ? String(e.detail) : 'all');
        activeFilterTab = tabId;
        currentPage = 1;
        loadAffiliateData();
    }

    function handleBankFilterChange(e: CustomEvent<string | number>) {
        selectedBankFilter = String(e.detail);
        currentPage = 1;
        loadAffiliateData();
    }

    function handleSortChange(e: CustomEvent<string | number>) {
        sortValue = String(e.detail);
        currentPage = 1;
        loadAffiliateData();
    }

    function handlePageSizeChange(e: CustomEvent<string | number>) {
        pageSize = Number(e.detail);
        currentPage = 1;
        loadAffiliateData();
    }

    function goToPage(page: number) {
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        loadAffiliateData();
    }

    function copyToClipboard(text: string, label: string) {
        if (!text || text === '-') return;
        navigator.clipboard.writeText(text);
        copiedText = label;
        if (copyToastTimer) clearTimeout(copyToastTimer);
        copyToastTimer = setTimeout(() => {
            copiedText = '';
        }, 2000);
    }

    function getBankLogo(bank: string): string | null {
        const b = (bank || '').trim().toUpperCase();
        if (b.includes('BCA')) return '/images/banks/bca.svg';
        if (b.includes('BNI')) return '/images/banks/bni.svg';
        if (b.includes('BRI')) return '/images/banks/bri.svg';
        if (b.includes('MANDIRI')) return '/images/banks/mandiri.svg';
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

    function openBreakdownModal(member: AffiliateMember) {
        breakdownMember = member;
        breakdownModalOpen = true;
    }

    function closeBreakdownModal() {
        breakdownModalOpen = false;
        breakdownMember = null;
    }

    function openPayoutModal(member: AffiliateMember) {
        payingMember = member;
        payoutModalOpen = true;
    }

    function closePayoutModal() {
        payoutModalOpen = false;
        payingMember = null;
    }

    function openEditBankModal(member: AffiliateMember) {
        editingMember = member;
        editBankError = '';
        editBankNoRek = (member.no_rek || member.rek || '').replace(/-/g, '').trim();
        editBankOwner = (member.owner_name || member.an || '').replace(/-/g, '').trim();

        const rawBank = (member.bank_name || member.bank || '').trim().toUpperCase();
        const matched = availableBanks.find(b =>
            b.code.toUpperCase() === rawBank ||
            rawBank.includes(b.code.toUpperCase()) ||
            b.name.toUpperCase().includes(rawBank)
        );

        editBankCode = matched ? matched.code : 'BCA';
        editBankModalOpen = true;
    }

    function closeEditBankModal() {
        editBankModalOpen = false;
        editingMember = null;
        editBankError = '';
        isSavingBank = false;
    }

    function handleEditBankSelect(e: CustomEvent<string | number>) {
        editBankCode = String(e.detail);
    }

    async function handleSaveMemberBank() {
        if (!editingMember) return;

        const cleanRek = editBankNoRek.replace(/\s+/g, '');
        if (!cleanRek) {
            editBankError = 'Nomor rekening wajib diisi.';
            return;
        }

        if (!activeEditBankConfig.regex.test(cleanRek)) {
            editBankError = `Format nomor rekening ${activeEditBankConfig.name} tidak valid. Wajib ${activeEditBankConfig.digitsLength} (contoh: ${activeEditBankConfig.example}).`;
            return;
        }

        if (!editBankOwner.trim()) {
            editBankError = 'Nama pemilik rekening wajib diisi sesuai buku tabungan.';
            return;
        }

        isSavingBank = true;
        editBankError = '';

        try {
            const res = await fetch('/admin/api/affiliate/update-bank', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    id: editingMember.id,
                    email: editingMember.email,
                    bank_name: activeEditBankConfig.code,
                    no_rek: cleanRek,
                    owner_name: editBankOwner.trim().toUpperCase()
                })
            });

            const json = await res.json();
            if (res.ok && json.status === 'success') {
                successMessage = `Rekening bank untuk ${editingMember.email} berhasil diperbarui.`;
                closeEditBankModal();
                await loadAffiliateData();
                setTimeout(() => { successMessage = ''; }, 4000);
            } else {
                editBankError = json.message || 'Gagal menyimpan data rekening bank.';
            }
        } catch (err) {
            console.error('Save bank error:', err);
            editBankError = 'Terjadi kesalahan jaringan saat menyimpan rekening bank.';
        } finally {
            isSavingBank = false;
        }
    }

    async function executePayout() {
        if (!payingMember) return;
        isProcessingPayout = true;
        try {
            const res = await fetch('/admin/api/affiliate/mark-paid', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email: payingMember.email })
            });

            const json = await res.json();
            if (res.ok && (json.status === 'success' || json.success)) {
                successMessage = json.message || `Komisi untuk ${payingMember.email} berhasil dicairkan.`;
                closePayoutModal();
                await loadAffiliateData();
                setTimeout(() => { successMessage = ''; }, 4500);
            } else {
                alert(json.message || json.error || 'Gagal mencairkan komisi');
            }
        } catch (err) {
            console.error('Payout error:', err);
            alert('Terjadi kesalahan jaringan.');
        } finally {
            isProcessingPayout = false;
        }
    }

    function formatCurrency(amount: number): string {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    function formatDate(timestampOrDate: number | string | undefined): string {
        if (!timestampOrDate) return '-';
        if (typeof timestampOrDate === 'number') {
            return new Date(timestampOrDate * 1000).toLocaleDateString('id-ID', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
            });
        }
        return timestampOrDate;
    }

    function getInitial(email: string): string {
        return (email || 'A').charAt(0).toUpperCase();
    }
</script>

<AdminLayout activePage="affiliate">
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
                        <span class="text-xs text-[var(--brand)] font-bold uppercase tracking-wider">
                            Affiliate Management
                        </span>
                        <span class="text-xs text-[var(--text-3)] hidden xs:inline">/</span>
                        <span class="text-xs text-[var(--text-2)] font-medium hidden xs:inline">Program Afiliasi</span>
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">
                        Affiliate Management
                    </h1>
                    <p class="text-xs sm:text-sm text-[var(--text-3)] mt-0.5 max-w-xl">
                        Kelola mitra affiliasi, rincian komisi penjualan, dan pemrosesan transfer payout secara real-time.
                    </p>
                </div>

                <!-- Mobile Action Buttons (Right-aligned: Refresh Icon Button & Payout History Button) -->
                <div class="flex sm:hidden items-center gap-1.5 flex-shrink-0 pt-1">
                    <button
                        type="button"
                        on:click={loadAffiliateData}
                        class="p-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-all shadow-xs cursor-pointer active:scale-95 flex items-center justify-center"
                        title="Refresh Data"
                        aria-label="Refresh Data"
                    >
                        <svg class="w-4 h-4 text-[var(--text-2)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>

                    <a
                        href="#/admin/affiliate/history"
                        class="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer border-0"
                        title="Riwayat Payout"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Payout</span>
                    </a>
                </div>
            </div>

            <!-- Desktop Action Buttons -->
            <div class="hidden sm:flex items-center gap-2.5 flex-shrink-0">
                <button
                    type="button"
                    on:click={loadAffiliateData}
                    class="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-all shadow-xs cursor-pointer"
                    title="Refresh Data"
                >
                    <svg class="w-4 h-4 text-[var(--text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Refresh</span>
                </button>

                <a
                    href="#/admin/affiliate/history"
                    class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer border-0"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Riwayat Payout</span>
                </a>
            </div>
        </div>

        <!-- Feedback Alert Messages -->
        {#if successMessage}
            <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs sm:text-sm flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-2.5">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="font-medium">{successMessage}</span>
                </div>
                <button type="button" on:click={() => successMessage = ''} class="text-emerald-400/80 hover:text-emerald-300 text-xs font-bold">✕</button>
            </div>
        {/if}

        {#if error}
            <div class="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-2.5">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                </div>
                <button type="button" on:click={loadAffiliateData} class="underline text-xs font-bold cursor-pointer">Coba Lagi</button>
            </div>
        {/if}

        <!-- 4 Top Metric Cards (Compact 2x2 Grid on Mobile, 4-Cols on Desktop) -->
        {#if affiliateData}
            <div class="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                <!-- Komisi Menunggu Payout -->
                <div class="p-3.5 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <span class="text-[10px] sm:text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider truncate">Menunggu Payout</span>
                        <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-amber-500/15 dark:bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-sm xs:text-base sm:text-2xl lg:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tracking-tight truncate" title={formatCurrency(affiliateData.stats.totalUnpaid)}>
                            {formatCurrency(affiliateData.stats.totalUnpaid)}
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-[var(--text-3)] mt-0.5 sm:mt-1.5 flex items-center gap-1 truncate">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                            <span class="truncate">{affiliateData.members.filter(m => (m.pendingCommission || m.unpaidCommission || 0) > 0).length} mitra siap dicairkan</span>
                        </p>
                    </div>
                </div>

                <!-- Total Komisi Dicairkan -->
                <div class="p-3.5 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <span class="text-[10px] sm:text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider truncate">Sudah Dicairkan</span>
                        <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-sm xs:text-base sm:text-2xl lg:text-3xl font-extrabold text-emerald-400 tracking-tight truncate" title={formatCurrency(affiliateData.stats.totalPaid)}>
                            {formatCurrency(affiliateData.stats.totalPaid)}
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-[var(--text-3)] mt-0.5 sm:mt-1.5 flex items-center gap-1 truncate">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                            <span class="truncate">Kumulatif transfer</span>
                        </p>
                    </div>
                </div>

                <!-- Komisi Bulan Ini -->
                <div class="p-3.5 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <span class="text-[10px] sm:text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider truncate">Bulan Ini</span>
                        <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-sm xs:text-base sm:text-2xl lg:text-3xl font-extrabold text-[var(--text)] tracking-tight truncate" title={formatCurrency(affiliateData.stats.incomeThisMonth)}>
                            {formatCurrency(affiliateData.stats.incomeThisMonth)}
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-[var(--text-3)] mt-0.5 sm:mt-1.5 truncate">
                            Bulan lalu: <span class="font-semibold text-[var(--text-2)]">{formatCurrency(affiliateData.stats.incomeLastMonth)}</span>
                        </p>
                    </div>
                </div>

                <!-- Total Affiliator Terdaftar -->
                <div class="p-3.5 sm:p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs relative overflow-hidden flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-2 sm:mb-3">
                        <span class="text-[10px] sm:text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider truncate">Mitra Affiliasi</span>
                        <div class="w-7 h-7 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0">
                            <svg class="w-3.5 h-3.5 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-sm xs:text-base sm:text-2xl lg:text-3xl font-extrabold text-[var(--text)] tracking-tight truncate">
                            {affiliateData.tabCounts?.all ?? (affiliateData.pagination?.total || 0)}
                        </div>
                        <p class="text-[10px] sm:text-[11px] text-[var(--text-3)] mt-0.5 sm:mt-1.5 flex items-center gap-1 truncate">
                            <span class="text-purple-400 font-semibold">{affiliateData.tabCounts?.bank_set ?? 0}</span> mitra ada bank
                        </p>
                    </div>
                </div>
            </div>
        {/if}

        <!-- Unified Enterprise Toolbar & Table Card -->
        <div class="rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs">
            <!-- Toolbar -->
            <div class="p-3.5 sm:p-5 border-b border-[var(--border)] space-y-3 sm:space-y-4">
                <!-- Row 1: Search & Desktop Filter Tabs / Mobile Layout -->
                <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 lg:gap-4">
                    <!-- Live Search Input -->
                    <div class="relative flex-1 w-full lg:max-w-lg">
                        <input
                            type="text"
                            bind:value={searchInput}
                            on:input={handleSearchInput}
                            placeholder="Cari affiliator berdasarkan email, kupon, rekening, bank..."
                            class="w-full pl-9 sm:pl-10 pr-9 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                        />
                        <svg class="w-4 h-4 text-[var(--text-3)] absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {#if searchInput}
                            <button
                                type="button"
                                on:click={clearSearch}
                                class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] text-xs font-bold p-1 cursor-pointer"
                                aria-label="Clear Search"
                            >
                                ✕
                            </button>
                        {/if}
                    </div>

                    <!-- Desktop Status Filter Tabs (Visible on lg+ screens) -->
                    <div class="hidden lg:block flex-shrink-0">
                        <SegmentedTabs
                            tabs={filterTabs}
                            activeTab={activeFilterTab}
                            on:tabChange={handleTabChange}
                        />
                    </div>
                </div>

                <!-- Mobile Filter Controls (< lg screens: Status dropdown + Grid 2 cols for Bank & Sort) -->
                <div class="block lg:hidden space-y-2.5">
                    <!-- Status Filter Dropdown on Mobile (Eliminates horizontal scrolling) -->
                    <div class="flex items-center gap-2">
                        <span class="text-xs font-semibold text-[var(--text-3)] whitespace-nowrap min-w-[50px]">Status:</span>
                        <div class="flex-1 min-w-0">
                            <CustomSelect
                                options={statusFilterOptions}
                                value={activeFilterTab}
                                fullWidth={true}
                                on:change={handleTabChange}
                            />
                        </div>
                    </div>

                    <!-- Bank & Sort 2-Col Grid on Mobile -->
                    <div class="grid grid-cols-2 gap-2">
                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="text-xs font-semibold text-[var(--text-3)] whitespace-nowrap hidden xs:inline">Bank:</span>
                            <div class="flex-1 min-w-0">
                                <CustomSelect
                                    options={bankOptions}
                                    value={selectedBankFilter}
                                    fullWidth={true}
                                    on:change={handleBankFilterChange}
                                />
                            </div>
                        </div>

                        <div class="flex items-center gap-1.5 min-w-0">
                            <span class="text-xs font-semibold text-[var(--text-3)] whitespace-nowrap hidden xs:inline">Urutan:</span>
                            <div class="flex-1 min-w-0">
                                <CustomSelect
                                    options={sortOptions}
                                    value={sortValue}
                                    fullWidth={true}
                                    align="right"
                                    on:change={handleSortChange}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Row 2: Active Counts & Desktop Sort/Bank Controls -->
                <div class="flex items-center justify-between gap-3 text-xs pt-1 sm:pt-0">
                    <div class="text-[var(--text-3)] flex items-center gap-2">
                        <span class="text-[11px] sm:text-xs">Menampilkan <b class="text-[var(--text)]">{paginatedMembers.length}</b> dari {totalItems} mitra</span>
                        {#if searchInput || activeFilterTab !== 'all' || selectedBankFilter !== 'all'}
                            <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Filter Aktif
                            </span>
                        {/if}
                    </div>

                    <!-- Desktop Bank & Sort Controls (Hidden on mobile because shown above) -->
                    <div class="hidden lg:flex items-center gap-2.5 flex-wrap">
                        <!-- Filter Bank Selector -->
                        <div class="flex items-center gap-1.5">
                            <span class="text-[var(--text-3)]">Bank:</span>
                            <CustomSelect
                                options={bankOptions}
                                value={selectedBankFilter}
                                on:change={handleBankFilterChange}
                            />
                        </div>

                        <!-- Sorter -->
                        <div class="flex items-center gap-1.5">
                            <span class="text-[var(--text-3)]">Urutan:</span>
                            <CustomSelect
                                options={sortOptions}
                                value={sortValue}
                                on:change={handleSortChange}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Area -->
            {#if loading}
                <div class="p-16 text-center">
                    <div class="w-9 h-9 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p class="text-xs font-medium text-[var(--text-3)]">Memuat data mitra affiliate...</p>
                </div>
            {:else if paginatedMembers.length === 0}
                <div class="p-16 text-center">
                    <div class="w-14 h-14 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)] mx-auto mb-3 flex items-center justify-center">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <p class="text-sm font-bold text-[var(--text)]">Tidak ada data partner affiliate</p>
                    <p class="text-xs text-[var(--text-3)] mt-1 max-w-sm mx-auto">
                        {searchInput ? 'Tidak ditemukan data yang sesuai kata kunci pencarian.' : 'Belum ada data untuk filter kategori atau bank yang dipilih.'}
                    </p>
                </div>
            {:else}
                <!-- Desktop Table View (md and up) -->
                <div class="hidden md:block overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-[var(--surface-2)] text-[var(--text-3)] uppercase tracking-wider font-bold border-b border-[var(--border)] select-none">
                                <th class="py-3.5 px-4 whitespace-nowrap">Affiliator</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Rekening Payout</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Komisi Tertunda</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Komisi Bulan Ini</th>
                                <th class="py-3.5 px-4 text-right whitespace-nowrap">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)]">
                            {#each paginatedMembers as m (m.id || m.email)}
                                {@const unpaid = m.pendingCommission !== undefined ? m.pendingCommission : (m.unpaidCommission || 0)}
                                {@const couponCode = m.kupon || m.coupon || '-'}
                                {@const bankName = (m.bank_name || m.bank || '').trim()}
                                {@const bankRek = (m.no_rek || m.rek || '').trim()}
                                {@const bankOwner = (m.owner_name || m.an || '').trim()}
                                {@const hasValidBank = isBankSetFn(m)}
                                <tr class="hover:bg-[var(--surface-2)]/40 transition-colors group">
                                    <!-- Affiliator & Kupon -->
                                    <td class="py-3.5 px-4">
                                        <div class="flex items-center gap-3">
                                            <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-extrabold flex items-center justify-center text-xs flex-shrink-0 shadow-2xs">
                                                {getInitial(m.email)}
                                            </div>
                                            <div class="min-w-0">
                                                <div class="font-bold text-[var(--text)] truncate max-w-[200px]" title={m.email}>
                                                    {m.email}
                                                </div>
                                                <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                                                    {#if couponCode !== '-'}
                                                        <button
                                                            type="button"
                                                            on:click={() => copyToClipboard(couponCode, `Kupon ${couponCode}`)}
                                                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-sky-500/15 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30 hover:bg-sky-500/25 transition-colors cursor-pointer shadow-2xs"
                                                            title="Klik untuk salin kupon"
                                                        >
                                                            <span>{couponCode}</span>
                                                            <svg class="w-3 h-3 text-sky-600 dark:text-sky-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                        </button>
                                                    {:else}
                                                        <span class="text-[11px] text-[var(--text-2)]/80 dark:text-[var(--text-3)] italic">Tanpa Kupon</span>
                                                    {/if}
                                                    {#if m.memberSince || m.created}
                                                        <span class="text-[11px] text-[var(--text-2)]/80 dark:text-[var(--text-3)] font-medium">
                                                            • Join {formatDate(m.memberSince || m.created)}
                                                        </span>
                                                    {/if}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Bank Info with 1-Click Copy, Edit Action, & Belum Diset Tag -->
                                    <td class="py-3.5 px-4">
                                        <div class="flex items-center justify-between gap-2">
                                            {#if hasValidBank}
                                                <div class="space-y-1 min-w-0">
                                                    <div class="flex items-center gap-2">
                                                        {#if getBankLogo(bankName)}
                                                            <div class="h-6 px-1.5 py-0.5 rounded-lg bg-white border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-center flex-shrink-0" title="{bankName}">
                                                                <img src="{getBankLogo(bankName)}" alt="{bankName}" class="h-3.5 w-auto max-w-[44px] object-contain" />
                                                            </div>
                                                        {:else}
                                                            <span class="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase tracking-wider border {getBankBadgeStyle(bankName)}">
                                                                {bankName}
                                                            </span>
                                                        {/if}
                                                        <button
                                                            type="button"
                                                            on:click={() => copyToClipboard(bankRek, `Nomor Rekening ${bankRek}`)}
                                                            class="font-mono font-bold text-xs text-[var(--text)] hover:text-[var(--brand)] flex items-center gap-1.5 transition-colors cursor-pointer group/btn"
                                                            title="Klik untuk salin no rekening"
                                                        >
                                                            <span class="tracking-wide">{bankRek}</span>
                                                            <svg class="w-3.5 h-3.5 text-[var(--text-3)] group-hover/btn:text-[var(--brand)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                    {#if bankOwner && bankOwner !== '-'}
                                                        <div class="text-[11px] text-[var(--text-2)] truncate max-w-[180px]">
                                                            a.n. <strong class="text-[var(--text)] font-bold">{bankOwner}</strong>
                                                        </div>
                                                    {/if}
                                                </div>
                                            {:else}
                                                <div class="space-y-0.5">
                                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-500/15 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/40 shadow-2xs">
                                                        <span>Belum Diset</span>
                                                        <svg class="w-3 h-3 text-amber-700 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                        </svg>
                                                    </span>
                                                    <div class="text-[11px] text-[var(--text-2)]/85 dark:text-[var(--text-3)] italic">Mitra belum input rekening</div>
                                                </div>
                                            {/if}
                                            <button
                                                type="button"
                                                on:click={() => openEditBankModal(m)}
                                                class="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-[var(--text-2)] hover:text-blue-600 transition-all flex-shrink-0 cursor-pointer shadow-2xs group/edit"
                                                title="Edit Rekening Bank Mitra"
                                                aria-label="Edit Rekening Bank"
                                            >
                                                <svg class="w-3.5 h-3.5 text-[var(--text-3)] group-hover/edit:text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>

                                    <!-- Unpaid Commission & Breakdown -->
                                    <td class="py-3.5 px-4">
                                        {#if unpaid > 0}
                                            <div class="font-black text-amber-700 dark:text-amber-400 text-sm">
                                                {formatCurrency(unpaid)}
                                            </div>
                                            {#if m.unpaidTransactions && m.unpaidTransactions.length > 0}
                                                <button
                                                    type="button"
                                                    on:click={() => openBreakdownModal(m)}
                                                    class="text-[10px] text-[var(--brand)] hover:underline flex items-center gap-1 mt-0.5 cursor-pointer font-bold"
                                                >
                                                    <span>{m.unpaidTransactions.length} order tertunda</span>
                                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                                    </svg>
                                                </button>
                                            {/if}
                                        {:else}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 shadow-2xs">
                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                <span>Lunas (Rp 0)</span>
                                            </span>
                                        {/if}
                                    </td>

                                    <!-- Income This Month & Trend -->
                                    <td class="py-3.5 px-4">
                                        <div class="font-bold text-[var(--text)]">
                                            {formatCurrency(m.incomeThisMonth || m.paidCommission || 0)}
                                        </div>
                                        {#if m.trend}
                                            <div class="flex items-center gap-1 mt-0.5">
                                                {#if m.trend === 'UP'}
                                                    <span class="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-0.5">
                                                        ↑ +{m.percentageChange || 0}%
                                                    </span>
                                                {:else if m.trend === 'DOWN'}
                                                    <span class="text-[11px] font-bold text-rose-700 dark:text-rose-400 flex items-center gap-0.5">
                                                        ↓ -{m.percentageChange || 0}%
                                                    </span>
                                                {:else}
                                                    <span class="text-[11px] font-medium text-[var(--text-2)] dark:text-[var(--text-3)]">
                                                        = Stabil
                                                    </span>
                                                {/if}
                                                <span class="text-[11px] text-[var(--text-2)]/75 dark:text-[var(--text-3)]">vs bln lalu</span>
                                            </div>
                                        {/if}
                                    </td>

                                    <!-- Actions -->
                                    <td class="py-3.5 px-4 text-right">
                                        {#if unpaid > 0}
                                            <button
                                                type="button"
                                                on:click={() => openPayoutModal(m)}
                                                class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer inline-flex items-center gap-1.5"
                                            >
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                                                </svg>
                                                <span>Cairkan Komisi</span>
                                            </button>
                                        {:else}
                                            <span class="inline-flex items-center px-2.5 py-1 rounded-xl text-[11px] font-semibold bg-[var(--surface-2)] text-[var(--text-2)] dark:text-[var(--text-3)] border border-[var(--border)] select-none">
                                                Tidak Ada Tagihan
                                            </span>
                                        {/if}
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Mobile Card View (< md) -->
                <div class="md:hidden divide-y divide-[var(--border)]">
                    {#each paginatedMembers as m (m.id || m.email)}
                        {@const unpaid = m.pendingCommission !== undefined ? m.pendingCommission : (m.unpaidCommission || 0)}
                        {@const couponCode = m.kupon || m.coupon || '-'}
                        {@const bankName = (m.bank_name || m.bank || '').trim()}
                        {@const bankRek = (m.no_rek || m.rek || '').trim()}
                        {@const bankOwner = (m.owner_name || m.an || '').trim()}
                        {@const hasValidBank = isBankSetFn(m)}
                        <div class="p-4 space-y-3">
                            <!-- Top: Email & Kupon -->
                            <div class="flex items-start justify-between gap-2">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 text-blue-700 dark:text-blue-300 font-extrabold flex items-center justify-center text-xs flex-shrink-0 shadow-2xs">
                                        {getInitial(m.email)}
                                    </div>
                                    <div>
                                        <div class="font-bold text-[var(--text)] text-xs truncate max-w-[190px]">
                                            {m.email}
                                        </div>
                                        <div class="text-[11px] text-[var(--text-2)]/80 dark:text-[var(--text-3)] font-medium">
                                            Join: {formatDate(m.memberSince || m.created)}
                                        </div>
                                    </div>
                                </div>
                                {#if couponCode !== '-'}
                                    <button
                                        type="button"
                                        on:click={() => copyToClipboard(couponCode, `Kupon ${couponCode}`)}
                                        class="px-2 py-0.5 rounded-lg text-[10px] font-mono font-bold bg-sky-500/15 dark:bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/30"
                                    >
                                        {couponCode}
                                    </button>
                                {/if}
                            </div>

                            <!-- Middle: Bank Info with Edit Button -->
                            <div class="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-1.5">
                                <div class="flex items-center justify-between text-[11px]">
                                    <span class="text-[var(--text-3)]">Rekening Tujuan:</span>
                                    <div class="flex items-center gap-1.5">
                                        {#if hasValidBank}
                                            <button
                                                type="button"
                                                on:click={() => copyToClipboard(bankRek, `Nomor Rekening ${bankRek}`)}
                                                class="font-mono font-bold text-[var(--text)] flex items-center gap-1.5 hover:text-[var(--brand)]"
                                            >
                                                {#if getBankLogo(bankName)}
                                                    <div class="h-5 px-1 rounded bg-white border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-center flex-shrink-0">
                                                        <img src="{getBankLogo(bankName)}" alt="{bankName}" class="h-3 w-auto max-w-[34px] object-contain" />
                                                    </div>
                                                {:else}
                                                    <span class="font-bold">{bankName}</span>
                                                {/if}
                                                <span>{bankRek}</span>
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        {:else}
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-amber-500/15 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                                                <span>Belum Diset</span>
                                                <svg class="w-3 h-3 text-amber-700 dark:text-amber-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                                </svg>
                                            </span>
                                        {/if}
                                        <button
                                            type="button"
                                            on:click={() => openEditBankModal(m)}
                                            class="p-1 rounded-md bg-[var(--surface)] hover:bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text-2)] hover:text-blue-600 transition-colors"
                                            title="Edit Rekening Bank Mitra"
                                        >
                                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                                {#if hasValidBank && bankOwner && bankOwner !== '-'}
                                    <div class="flex items-center justify-between text-[11px]">
                                        <span class="text-[var(--text-3)]">Atas Nama:</span>
                                        <span class="text-[var(--text)] font-bold">{bankOwner}</span>
                                    </div>
                                {/if}
                            </div>

                            <!-- Bottom: Commission & Action -->
                            <div class="flex items-center justify-between pt-1">
                                <div>
                                    <span class="text-[10px] text-[var(--text-3)] block">Komisi Tertunda</span>
                                    {#if unpaid > 0}
                                        <span class="text-sm font-black text-amber-700 dark:text-amber-400">{formatCurrency(unpaid)}</span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            <span>Lunas (Rp 0)</span>
                                        </span>
                                    {/if}
                                </div>

                                <div>
                                    {#if unpaid > 0}
                                        <button
                                            type="button"
                                            on:click={() => openPayoutModal(m)}
                                            class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 text-white shadow-xs"
                                        >
                                            Cairkan Komisi
                                        </button>
                                    {:else}
                                        <span class="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-semibold bg-[var(--surface-2)] text-[var(--text-2)] dark:text-[var(--text-3)] border border-[var(--border)]">
                                            Tidak Ada Tagihan
                                        </span>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Pagination Footer with PageSize Selector -->
                {#if totalItems > 0}
                    <div class="p-4 border-t border-[var(--border)] bg-[var(--surface-2)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div class="flex items-center gap-3 flex-wrap">
                            <div class="text-[var(--text-3)]">
                                Halaman <b class="text-[var(--text)]">{currentPage}</b> dari <b class="text-[var(--text)]">{totalPages}</b>
                                ({totalItems} total mitra)
                            </div>
                            <div class="flex items-center gap-1.5">
                                <CustomSelect
                                    options={pageSizeOptions}
                                    value={pageSize}
                                    on:change={handlePageSizeChange}
                                />
                            </div>
                        </div>

                        {#if totalPages > 1}
                            <div class="flex items-center justify-center gap-1 self-center sm:self-auto flex-wrap">
                                <!-- Prev Button (Arrow Icon Only) -->
                                <button
                                    type="button"
                                    on:click={() => goToPage(currentPage - 1)}
                                    disabled={currentPage <= 1}
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
                                    {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
                                        {#if p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)}
                                            <button
                                                type="button"
                                                on:click={() => goToPage(p)}
                                                class="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center {p === currentPage ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border-0' : 'bg-white dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[var(--border)] dark:border-slate-700 shadow-2xs'}"
                                            >
                                                {p}
                                            </button>
                                        {:else if p === currentPage - 2 || p === currentPage + 2}
                                            <span class="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-3)] dark:text-slate-500 font-bold select-none">...</span>
                                        {/if}
                                    {/each}
                                </div>

                                <!-- Next Button (Arrow Icon Only) -->
                                <button
                                    type="button"
                                    on:click={() => goToPage(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
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

<!-- Modal Rincian Komisi Tertunda -->
{#if breakdownModalOpen && breakdownMember}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
        <div class="w-full max-w-xl p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
            <div class="flex items-center justify-between pb-3.5 border-b border-[var(--border)]">
                <div>
                    <h3 class="text-base font-bold text-[var(--text)]">Rincian Transaksi Komisi</h3>
                    <p class="text-xs text-[var(--text-3)] mt-0.5">{breakdownMember.email}</p>
                </div>
                <button
                    type="button"
                    on:click={closeBreakdownModal}
                    class="w-8 h-8 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] flex items-center justify-center transition-all cursor-pointer shadow-2xs font-bold text-sm"
                    title="Tutup Rincian"
                >
                    ✕
                </button>
            </div>

            <div class="overflow-y-auto flex-1 space-y-2 pr-1">
                {#if !breakdownMember.unpaidTransactions || breakdownMember.unpaidTransactions.length === 0}
                    <p class="text-xs text-[var(--text-3)] italic text-center py-6">Tidak ada rincian transaksi tertunda.</p>
                {:else}
                    {#each breakdownMember.unpaidTransactions as t}
                        <div class="p-3 sm:p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between text-xs hover:border-[var(--border)]/80 transition-colors gap-3">
                            <div class="flex items-center gap-3 min-w-0 flex-1">
                                {#if t.product_image && !prodImgErrorMap['aff_' + t.invoice_code]}
                                    <img
                                        src={t.product_image}
                                        alt={t.product_name}
                                        class="w-9 h-9 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface)] flex-shrink-0 shadow-xs"
                                        on:error={() => prodImgErrorMap['aff_' + t.invoice_code] = true}
                                    />
                                {:else}
                                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500/15 to-orange-500/15 border border-amber-500/30 text-amber-600 dark:text-amber-400 font-black text-xs flex items-center justify-center flex-shrink-0">
                                        {(t.product_name || 'P').charAt(0).toUpperCase()}
                                    </div>
                                {/if}
                                <div class="min-w-0 flex-1">
                                    <div class="font-bold text-[var(--text)] text-xs sm:text-sm truncate">{t.product_name}</div>
                                    <div class="text-[11px] text-[var(--text-3)] font-mono mt-0.5">
                                        Invoice: <span class="font-semibold text-[var(--text-2)]">{t.invoice_code}</span> • {formatDate(t.created_at)}
                                    </div>
                                </div>
                            </div>
                            <div class="text-right flex-shrink-0">
                                <span class="font-black text-amber-700 dark:text-amber-400 text-sm sm:text-base">{formatCurrency(t.affiliate_income)}</span>
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

            <div class="pt-3.5 border-t border-[var(--border)] flex items-center justify-between">
                <div class="text-xs">
                    <span class="text-[var(--text-3)] font-medium">Total Komisi:</span>
                    <span class="font-black text-amber-700 dark:text-amber-400 text-base sm:text-lg ml-1.5">
                        {formatCurrency(breakdownMember.pendingCommission || breakdownMember.unpaidCommission || 0)}
                    </span>
                </div>
                <button
                    type="button"
                    on:click={closeBreakdownModal}
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
{/if}

<!-- Modal Konfirmasi Pencairan Komisi -->
{#if payoutModalOpen && payingMember}
    {@const payoutAmount = payingMember.pendingCommission !== undefined ? payingMember.pendingCommission : (payingMember.unpaidCommission || 0)}
    {@const targetBank = payingMember.bank_name || payingMember.bank || '-'}
    {@const targetRek = payingMember.no_rek || payingMember.rek || '-'}
    {@const targetOwner = payingMember.owner_name || payingMember.an || '-'}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
        <div class="w-full max-w-md p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center flex-shrink-0">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                </div>
                <div>
                    <h3 class="text-base font-bold text-[var(--text)]">Konfirmasi Pencairan Payout</h3>
                    <p class="text-xs text-[var(--text-3)] mt-0.5">{payingMember.email}</p>
                </div>
            </div>

            <p class="text-xs text-[var(--text-2)] leading-relaxed">
                Pastikan Anda telah mentransfer saldo komisi ke rekening affiliator berikut sebelum menandai transaksi ini sebagai lunas:
            </p>

            <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-[var(--text-3)]">Bank Tujuan:</span>
                    <div class="flex items-center gap-2">
                        {#if getBankLogo(targetBank)}
                            <div class="h-6 px-1.5 py-0.5 rounded-lg bg-white border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-center">
                                <img src="{getBankLogo(targetBank)}" alt="{targetBank}" class="h-3.5 w-auto max-w-[44px] object-contain" />
                            </div>
                        {/if}
                        <span class="font-bold text-[var(--text)] uppercase">{targetBank}</span>
                    </div>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[var(--text-3)]">No. Rekening:</span>
                    <button
                        type="button"
                        on:click={() => copyToClipboard(targetRek, `No Rekening ${targetRek}`)}
                        class="font-mono font-extrabold text-[var(--brand)] hover:underline flex items-center gap-1 cursor-pointer"
                        title="Klik untuk salin"
                    >
                        <span>{targetRek}</span>
                        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                    </button>
                </div>
                <div class="flex justify-between items-center">
                    <span class="text-[var(--text-3)]">Nama Penerima:</span>
                    <span class="font-bold text-[var(--text)]">{targetOwner}</span>
                </div>
                <div class="flex justify-between items-center pt-2.5 border-t border-[var(--border)]">
                    <span class="text-[var(--text-3)] font-semibold">Total Transfer:</span>
                    <span class="font-extrabold text-emerald-400 text-base">{formatCurrency(payoutAmount)}</span>
                </div>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-2">
                <button
                    type="button"
                    on:click={closePayoutModal}
                    class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--border)] transition-all cursor-pointer"
                >
                    Batal
                </button>
                <button
                    type="button"
                    disabled={isProcessingPayout}
                    on:click={executePayout}
                    class="px-5 py-2.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                >
                    {#if isProcessingPayout}
                        <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Memproses...</span>
                    {:else}
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Tandai Sudah Ditransfer</span>
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Modal Edit Rekening Bank Mitra (Admin) -->
{#if editBankModalOpen && editingMember}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-fade-in">
        <div class="w-full max-w-md p-6 rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl space-y-4">
            <div class="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-[var(--text)]">Edit Rekening Bank Mitra</h3>
                        <p class="text-xs text-[var(--text-3)] truncate max-w-[220px]">{editingMember.email}</p>
                    </div>
                </div>
                <button
                    type="button"
                    on:click={closeEditBankModal}
                    class="w-8 h-8 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] flex items-center justify-center transition-all cursor-pointer font-bold text-sm"
                >
                    ✕
                </button>
            </div>

            {#if editBankError}
                <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                    {editBankError}
                </div>
            {/if}

            <form on:submit|preventDefault={handleSaveMemberBank} class="space-y-4 text-xs">
                <div>
                    <label class="block font-semibold text-[var(--text-2)] mb-1.5">Pilih Bank Resmi</label>
                    <CustomSelect
                        options={bankSelectOptions}
                        value={editBankCode}
                        on:change={handleEditBankSelect}
                    />
                </div>

                <div>
                    <label class="block font-semibold text-[var(--text-2)] mb-1">
                        Nomor Rekening ({activeEditBankConfig.digitsLength})
                    </label>
                    <input
                        type="text"
                        bind:value={editBankNoRek}
                        placeholder="Contoh: {activeEditBankConfig.example}"
                        class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-mono text-sm focus:outline-none focus:border-blue-500 transition-colors"
                        required
                    />
                    <span class="text-[11px] text-[var(--text-3)] mt-1 block">
                        Wajib angka, panjang persis {activeEditBankConfig.digitsLength}.
                    </span>
                </div>

                <div>
                    <label class="block font-semibold text-[var(--text-2)] mb-1">Nama Pemilik Rekening</label>
                    <input
                        type="text"
                        bind:value={editBankOwner}
                        placeholder="Sesuai buku tabungan..."
                        class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-bold uppercase focus:outline-none focus:border-blue-500 transition-colors"
                        required
                    />
                </div>

                <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                    <button
                        type="button"
                        on:click={closeEditBankModal}
                        class="px-4 py-2.5 rounded-xl font-bold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={isSavingBank}
                        class="px-5 py-2.5 rounded-xl font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/20 disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                        {#if isSavingBank}
                            <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Menyimpan...</span>
                        {:else}
                            <span>Simpan Rekening</span>
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}
