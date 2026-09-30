<script lang="ts">
    import { onMount } from 'svelte';
    import Layout from '../components/Layout.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';

    interface AffiliateProfile {
        kupon: string;
        created: number;
        payout_bank_name: string;
        payout_no_rek: string;
        payout_name: string;
        kupon_decrease_value: number;
        kupon_income_idr: number;
    }

    interface AffiliateStats {
        totalIncome: number;
        totalPending: number;
        totalTransactions: number;
    }

    interface LastPayout {
        amount: number;
        created: number;
    }

    interface AffiliateTransaction {
        id: number;
        invoice_code: string;
        customer_email: string;
        customer_name?: string;
        product_name: string;
        customer_paid_price: number;
        affiliate_income: number;
        created_at: number;
        already_paid: number;
    }

    interface PaginationMeta {
        page: number;
        pageSize: number;
        totalTransactions: number;
        totalPages: number;
    }

    let loading = true;
    let tableLoading = false;
    let isEnrolled = false;
    let isEligible = false;
    let ordersCount = 0;
    let requiredOrders = 6;
    let profile: AffiliateProfile | null = null;
    let stats: AffiliateStats = { totalIncome: 0, totalPending: 0, totalTransactions: 0 };
    let lastPayout: LastPayout | null = null;
    let transactions: AffiliateTransaction[] = [];
    let pagination: PaginationMeta = { page: 1, pageSize: 10, totalTransactions: 0, totalPages: 1 };

    // Search & Filter State
    let searchQuery = '';
    let sortField = 'tanggal';
    let sortOrder: 'desc' | 'asc' = 'desc';
    let searchDebounceTimer: any;

    // Modals
    let showPayoutModal = false;
    let showCouponModal = false;
    let submittingModal = false;
    let modalError = '';
    let toastMessage = '';
    let toastType: 'success' | 'error' = 'success';
    let toastTimer: any;

    // Form inputs
    let formBankName = '';
    let formNoRek = '';
    let formOwnerName = '';
    let formCoupon = '';

    // Bank list and account validation configuration
    interface BankConfig {
        name: string;
        code: string;
        regex: RegExp;
        digitsLength: string;
        example: string;
        gradient: string;
        tagline: string;
    }

    const availableBanks: BankConfig[] = [
        { name: 'BCA (Bank Central Asia)', code: 'BCA', regex: /^\d{10}$/, digitsLength: '10 digit', example: '1234567890', gradient: 'from-[#003882] via-[#0052b4] to-[#002868]', tagline: 'Bank Central Asia' },
        { name: 'Bank Mandiri', code: 'Mandiri', regex: /^\d{13}$/, digitsLength: '13 digit', example: '1440017737203', gradient: 'from-[#002d62] via-[#0a3871] to-[#001f44]', tagline: 'Bank Mandiri Terverifikasi' },
        { name: 'BNI (Bank Negara Indonesia)', code: 'BNI', regex: /^\d{10}$/, digitsLength: '10 digit', example: '0382081235', gradient: 'from-[#005e6a] via-[#007b8a] to-[#004852]', tagline: 'Bank Negara Indonesia' },
        { name: 'BRI (Bank Rakyat Indonesia)', code: 'BRI', regex: /^\d{15}$/, digitsLength: '15 digit', example: '685001027930534', gradient: 'from-[#083e8a] via-[#0a52b8] to-[#002766]', tagline: 'Bank Rakyat Indonesia' }
    ];

    const bankSelectOptions: OptionItem[] = availableBanks.map(b => ({
        value: b.code,
        label: b.name,
        description: `Format: ${b.digitsLength}`
    }));

    let selectedBankCode = 'BCA';
    $: activeBankConfig = availableBanks.find(b => b.code === selectedBankCode) || availableBanks[0];

    function handleBankChange(e: CustomEvent<string | number>) {
        selectedBankCode = String(e.detail);
        formBankName = activeBankConfig.code;
    }

    function formatCardNumber(numStr: string): string {
        const clean = (numStr || '').replace(/\s+/g, '');
        return clean.replace(/(\d{4})/g, '$1 ').trim();
    }

    // Joining State
    let joining = false;

    function showToast(msg: string, type: 'success' | 'error' = 'success') {
        toastMessage = msg;
        toastType = type;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            toastMessage = '';
        }, 4000);
    }

    function formatRupiah(val: number): string {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(val || 0);
    }

    function formatDate(ts: number): string {
        if (!ts) return '-';
        return new Date(ts * 1000).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function copyToClipboard(text: string, label = 'Teks') {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(text);
            showToast(`${label} berhasil disalin ke clipboard!`, 'success');
        }
    }

    async function loadAffiliateData(onlyTable = false) {
        if (!onlyTable) {
            loading = true;
        } else {
            tableLoading = true;
        }
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                pageSize: pagination.pageSize.toString(),
                search: searchQuery,
                sort: sortField,
                order: sortOrder
            });

            const res = await fetch(`/member/api/affiliate?${params.toString()}`);
            if (res.status === 401) {
                window.location.hash = '/member/login';
                return;
            }

            const json = await res.json();
            if (json.status === 'success' && json.data) {
                if (!onlyTable) {
                    isEnrolled = json.data.isEnrolled;
                    isEligible = json.data.isEligible;
                    ordersCount = json.data.ordersCount;
                    requiredOrders = json.data.requiredOrders;
                    profile = json.data.profile;
                    stats = json.data.stats || { totalIncome: 0, totalPending: 0, totalTransactions: 0 };
                    lastPayout = json.data.lastPayout;

                    if (profile) {
                        formBankName = profile.payout_bank_name || '';
                        formNoRek = profile.payout_no_rek || '';
                        formOwnerName = profile.payout_name || '';
                        formCoupon = profile.kupon || '';
                    }
                }

                transactions = json.data.transactions || [];
                pagination = json.data.pagination || { page: 1, pageSize: 10, totalTransactions: 0, totalPages: 1 };
            } else {
                showToast(json.message || 'Gagal memuat data affiliate', 'error');
            }
        } catch (err) {
            console.error('Fetch affiliate error:', err);
            showToast('Koneksi bermasalah saat memuat data affiliate', 'error');
        } finally {
            loading = false;
            tableLoading = false;
        }
    }

    async function handleJoinAffiliate() {
        if (joining) return;
        joining = true;
        try {
            const res = await fetch('/member/api/affiliate/join', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
            const json = await res.json();
            if (json.status === 'success') {
                showToast('Selamat! Anda resmi terdaftar sebagai mitra affiliate Ziqva Labs.', 'success');
                await loadAffiliateData();
            } else {
                showToast(json.message || 'Pendaftaran gagal', 'error');
            }
        } catch (err) {
            console.error('Join error:', err);
            showToast('Terjadi kesalahan saat mendaftar', 'error');
        } finally {
            joining = false;
        }
    }

    function openPayoutModal() {
        if (profile) {
            formBankName = profile.payout_bank_name || 'BCA';
            formNoRek = profile.payout_no_rek || '';
            formOwnerName = profile.payout_name || '';

            const matchedBank = availableBanks.find(b =>
                b.code.toUpperCase() === (profile?.payout_bank_name || '').toUpperCase() ||
                b.name.toLowerCase().includes((profile?.payout_bank_name || '').toLowerCase())
            );
            if (matchedBank) {
                selectedBankCode = matchedBank.code;
            } else {
                selectedBankCode = 'BCA';
            }
        } else {
            selectedBankCode = 'BCA';
        }
        modalError = '';
        showPayoutModal = true;
    }

    function openCouponModal() {
        if (profile) {
            formCoupon = profile.kupon || '';
        }
        modalError = '';
        showCouponModal = true;
    }

    async function handleSavePayout() {
        const cleanNoRek = formNoRek.replace(/\s+/g, '');
        if (!cleanNoRek) {
            modalError = 'Nomor rekening wajib diisi.';
            return;
        }

        if (!activeBankConfig.regex.test(cleanNoRek)) {
            modalError = `Format nomor rekening ${activeBankConfig.name} tidak valid. Diperlukan ${activeBankConfig.digitsLength} angka (contoh: ${activeBankConfig.example}).`;
            return;
        }

        if (!formOwnerName.trim()) {
            modalError = 'Nama pemilik rekening wajib diisi sesuai buku tabungan.';
            return;
        }

        submittingModal = true;
        modalError = '';
        try {
            const res = await fetch('/member/api/affiliate/update-payout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    bank_name: activeBankConfig.code,
                    no_rek: cleanNoRek,
                    owner_name: formOwnerName.trim().toUpperCase()
                })
            });
            const json = await res.json();
            if (json.status === 'success') {
                showToast('Informasi rekening penarikan berhasil disimpan.', 'success');
                showPayoutModal = false;
                await loadAffiliateData();
            } else {
                modalError = json.message || 'Gagal menyimpan rekening';
            }
        } catch (err) {
            modalError = 'Terjadi kesalahan jaringan saat menyimpan rekening.';
        } finally {
            submittingModal = false;
        }
    }

    async function handleSaveCoupon() {
        if (!formCoupon.trim() || formCoupon.trim().length < 3) {
            modalError = 'Kode kupon minimal 3 karakter alfanumerik.';
            return;
        }
        submittingModal = true;
        modalError = '';
        try {
            const res = await fetch('/member/api/affiliate/update-coupon', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ coupon: formCoupon.trim().toUpperCase() })
            });
            const json = await res.json();
            if (json.status === 'success') {
                showToast(`Kode kupon berhasil diubah menjadi ${json.coupon}.`, 'success');
                showCouponModal = false;
                await loadAffiliateData();
            } else {
                modalError = json.message || 'Gagal memperbarui kupon';
            }
        } catch (err) {
            modalError = 'Terjadi kesalahan jaringan saat memperbarui kupon.';
        } finally {
            submittingModal = false;
        }
    }

    const pageSizeOptions = [
        { value: 10, label: '10' },
        { value: 20, label: '20' },
        { value: 50, label: '50' }
    ];

    const mobileSortOptions = [
        { value: 'tanggal-desc', label: 'Terbaru (Tanggal ↓)' },
        { value: 'tanggal-asc', label: 'Terlama (Tanggal ↑)' },
        { value: 'komisi-desc', label: 'Komisi Tertinggi' },
        { value: 'komisi-asc', label: 'Komisi Terendah' },
        { value: 'harga-desc', label: 'Transaksi Terbesar' },
        { value: 'harga-asc', label: 'Transaksi Terkecil' }
    ];

    $: selectedMobileSort = `${sortField}-${sortOrder}`;

    function handleMobileSortChange(e: CustomEvent<string | number>) {
        const val = String(e.detail);
        const [field, order] = val.split('-');
        sortField = field;
        sortOrder = order as 'desc' | 'asc';
        pagination.page = 1;
        loadAffiliateData(true);
    }

    function handlePageSizeChange(e: CustomEvent<string | number>) {
        pagination.pageSize = Number(e.detail);
        pagination.page = 1;
        loadAffiliateData(true);
    }

    function handleSearchInput() {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            pagination.page = 1;
            loadAffiliateData(true);
        }, 350);
    }

    function handleSortChange(sort: string) {
        if (sortField === sort) {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = sort;
            sortOrder = 'desc';
        }
        pagination.page = 1;
        loadAffiliateData(true);
    }

    function changePage(newPage: number) {
        if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.page) {
            pagination.page = newPage;
            loadAffiliateData(true);
        }
    }

    function getPageNumbers(current: number, total: number): (number | string)[] {
        if (total <= 5) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        if (current <= 3) {
            return [1, 2, 3, 4, '...', total];
        }
        if (current >= total - 2) {
            return [1, '...', total - 3, total - 2, total - 1, total];
        }
        return [1, '...', current - 1, current, current + 1, '...', total];
    }

    $: pageNumbers = getPageNumbers(pagination.page, Math.max(1, pagination.totalPages));

    onMount(() => {
        loadAffiliateData();
    });
</script>

<svelte:head>
    <title>Program Mitra Afiliasi — Ziqva Labs</title>
</svelte:head>

<Layout activePage="affiliate" eyebrow="PROGRAM KEMITRAAN & AFILIASI">
    <main class="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-12">
        <!-- Toast Notification -->
        {#if toastMessage}
            <div class="fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md border text-xs sm:text-sm font-semibold transition-all animate-slide-up {toastType === 'success' ? 'bg-emerald-600 text-white border-emerald-400/40 shadow-emerald-500/20' : 'bg-rose-600 text-white border-rose-400/40 shadow-rose-500/20'}">
                {#if toastType === 'success'}
                    <svg class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                {:else}
                    <svg class="w-4 h-4 sm:w-5 sm:h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                {/if}
                <span>{toastMessage}</span>
            </div>
        {/if}

        <!-- Page Header Section -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-2xl font-extrabold text-[var(--text)] dark:text-white tracking-tight">
                    Program Kemitraan Afiliasi
                </h1>
                <p class="text-xs sm:text-sm text-[var(--text-3)] dark:text-slate-400 mt-1">
                    Bagikan kode kupon Anda ke calon pembeli & dapatkan komisi bersih 5% langsung pada setiap transaksi sukses.
                </p>
            </div>

            {#if isEnrolled}
                <a
                    href="#/member/affiliate/payouts"
                    class="self-stretch sm:self-auto bg-[var(--surface)] dark:bg-[#101827] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--text-2)] dark:text-slate-200 border border-[var(--border)] dark:border-[#22314d] px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-2xs shrink-0 cursor-pointer"
                >
                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Riwayat Penarikan Dana</span>
                </a>
            {/if}
        </div>

        {#if loading}
            <!-- Skeleton Loading Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 animate-pulse">
                <div class="h-32 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d]"></div>
                <div class="h-32 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d]"></div>
                <div class="h-32 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d]"></div>
                <div class="h-32 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d]"></div>
            </div>
        {:else if !isEnrolled}
            <!-- ================= STATE 1: AFFILIATE ENROLLMENT GATE ================= -->
            <div class="max-w-4xl mx-auto space-y-5">
                <!-- Status & Progress Qualification Card -->
                <div class="rounded-2xl sm:rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] p-5 sm:p-7 md:p-8 space-y-6 shadow-xs">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--border)] dark:border-[#22314d] pb-5">
                        <div class="space-y-1">
                            <div class="flex items-center gap-2">
                                <span class="w-2.5 h-2.5 rounded-full {isEligible ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}"></span>
                                <span class="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] dark:text-slate-400">
                                    Status Kemitraan: {isEligible ? 'Terbuka (Kualifikasi Terpenuhi)' : 'Terkunci (Belum Memenuhi Syarat)'}
                                </span>
                            </div>
                            <h2 class="text-lg sm:text-xl md:text-2xl font-black text-[var(--text)] dark:text-white tracking-tight">
                                {isEligible ? 'Siap Mengaktifkan Akun Kemitraan Afiliasi' : 'Ketentuan Bergabung Mitra Afiliasi'}
                            </h2>
                        </div>

                        <div class="text-left sm:text-right bg-[var(--surface-2)] dark:bg-[#131d31] px-3.5 py-2 rounded-xl border border-[var(--border)] dark:border-[#22314d] self-start sm:self-auto">
                            <div class="text-[11px] font-bold text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider">Akumulasi Order (6 Bulan)</div>
                            <div class="text-base sm:text-lg font-black text-blue-600 dark:text-blue-400 font-mono mt-0.5">
                                {ordersCount} / {requiredOrders} Selesai
                            </div>
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div class="space-y-2">
                        <div class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] h-2.5 rounded-full overflow-hidden border border-[var(--border)] dark:border-[#22314d]">
                            <div
                                class="h-full rounded-full transition-all duration-500 bg-blue-600 dark:bg-blue-500"
                                style="width: {Math.min(100, (ordersCount / requiredOrders) * 100)}%;"
                            ></div>
                        </div>
                        <div class="flex items-center justify-between text-xs text-[var(--text-3)] dark:text-slate-400 font-mono">
                            <span>0 Order</span>
                            <span>Target: {requiredOrders} Order Sukses</span>
                        </div>
                    </div>

                    <!-- Informational Callout -->
                    <div class="p-4 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] text-xs text-[var(--text-2)] dark:text-slate-300 leading-relaxed">
                        {#if isEligible}
                            Selamat! Akun Anda telah memenuhi kualifikasi dengan menyelesaikan minimal {requiredOrders} pesanan software. Anda dapat segera mengaktifkan kode kupon referral dan mulai memperoleh komisi langsung.
                        {:else}
                            Fitur pendaftaran kemitraan afiliasi akan <strong>terbuka secara otomatis</strong> setelah akun Anda menyelesaikan minimal <strong>{requiredOrders} transaksi software</strong> dalam 6 bulan terakhir (tersisa <strong>{Math.max(0, requiredOrders - ordersCount)} order</strong> lagi).
                        {/if}
                    </div>

                    <!-- Action Button -->
                    <div class="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-3">
                        {#if isEligible}
                            <button
                                type="button"
                                on:click={handleJoinAffiliate}
                                disabled={joining}
                                class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-bold text-xs sm:text-sm shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer border-0"
                            >
                                {#if joining}
                                    <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                    <span>Mendaftarkan...</span>
                                {:else}
                                    <span>Aktifkan Akun Afiliasi Sekarang →</span>
                                {/if}
                            </button>
                        {:else}
                            <a
                                href="/#catalog"
                                class="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs sm:text-sm transition-colors text-center shadow-sm cursor-pointer"
                            >
                                Belanja Software di Katalog →
                            </a>
                        {/if}
                    </div>
                </div>

                <!-- 3 Value Proposition Cards (Refined Visuals) -->
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
                    <div class="p-5 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] space-y-3 shadow-xs">
                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xs sm:text-sm font-bold text-[var(--text)] dark:text-white">Diskon 10% untuk Pembeli</h3>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 leading-relaxed mt-1">
                                Setiap pembeli yang menggunakan kode kupon referral Anda langsung mendapatkan potongan harga 10%.
                            </p>
                        </div>
                    </div>

                    <div class="p-5 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] space-y-3 shadow-xs">
                        <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xs sm:text-sm font-bold text-[var(--text)] dark:text-white">Komisi Bersih 5% Penjualan</h3>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 leading-relaxed mt-1">
                                Anda memperoleh komisi bersih 5% dari total nilai transaksi pada setiap invoice yang terbayar.
                            </p>
                        </div>
                    </div>

                    <div class="p-5 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] space-y-3 shadow-xs">
                        <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="text-xs sm:text-sm font-bold text-[var(--text)] dark:text-white">Pencairan Otomatis Tiap Bulan</h3>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 leading-relaxed mt-1">
                                Komisi ditransfer otomatis ke rekening bank Anda setiap akhir bulan hingga tanggal 2 tanpa potongan admin.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        {:else}
            <!-- ================= STATE 2: ACTIVE AFFILIATE DASHBOARD ================= -->
            
            <!-- 4 Compact Metric Stat Cards -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-3.5">
                <!-- Card 1: Kupon Referral -->
                <div class="rounded-xl sm:rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-blue-500/40 transition-colors">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <span class="text-[11px] font-bold text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider">Kupon Anda</span>
                        </div>
                        <button
                            type="button"
                            on:click={openCouponModal}
                            class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline cursor-pointer bg-transparent border-0 p-0"
                        >
                            Ubah
                        </button>
                    </div>

                    <div class="flex items-center justify-between gap-2 my-1.5">
                        <span class="font-mono text-base sm:text-lg font-bold tracking-wider text-blue-600 dark:text-blue-400 truncate">
                            {profile?.kupon || '-'}
                        </span>
                        <button
                            type="button"
                            on:click={() => copyToClipboard(profile?.kupon || '', 'Kode Kupon')}
                            class="p-1 rounded-md text-[var(--text-3)] hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-500/10 transition-colors cursor-pointer shrink-0"
                            title="Salin Kode Kupon"
                            aria-label="Salin Kode Kupon"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                        </button>
                    </div>

                    <p class="text-[11px] text-[var(--text-3)] dark:text-slate-400 truncate">
                        Diskon {profile?.kupon_decrease_value || 10}% • Komisi {profile?.kupon_income_idr || 5}%
                    </p>
                </div>

                <!-- Card 2: Komisi Menunggu (Pending Payout) -->
                <div class="rounded-xl sm:rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-amber-500/40 transition-colors">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            <span class="text-[11px] font-bold text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider">Komisi Berjalan</span>
                        </div>
                        <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            Pending
                        </span>
                    </div>

                    <div class="text-base sm:text-lg font-bold text-[var(--text)] dark:text-white font-mono my-1.5">
                        {formatRupiah(stats.totalPending)}
                    </div>

                    <p class="text-[11px] text-[var(--text-3)] dark:text-slate-400 truncate">
                        Cair tgl 1 - 2 tiap bulan
                    </p>
                </div>

                <!-- Card 3: Total Komisi Bersih (Revenue Growth) -->
                <div class="rounded-xl sm:rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-emerald-500/40 transition-colors">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center justify-center shrink-0">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                </svg>
                            </div>
                            <span class="text-[11px] font-bold text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider">Total Komisi Cair</span>
                        </div>
                        <span class="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            Berhasil
                        </span>
                    </div>

                    <div class="text-base sm:text-lg font-bold text-emerald-600 dark:text-emerald-400 font-mono my-1.5">
                        {formatRupiah(stats.totalIncome)}
                    </div>

                    <p class="text-[11px] text-[var(--text-3)] dark:text-slate-400 truncate">
                        {stats.totalTransactions} transaksi berhasil
                    </p>
                </div>

                <!-- Card 4: Rekening Penarikan (Official Bank Account) -->
                <div class="rounded-xl sm:rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] p-3.5 sm:p-4 flex flex-col justify-between shadow-2xs hover:border-indigo-500/40 transition-colors">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <div class="w-6 h-6 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20 flex items-center justify-center shrink-0">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                            <span class="text-[11px] font-bold text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider">Rekening Payout</span>
                        </div>
                        <button
                            type="button"
                            on:click={openPayoutModal}
                            class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 hover:underline cursor-pointer bg-transparent border-0 p-0"
                        >
                            {profile?.payout_no_rek ? 'Ubah' : 'Atur'}
                        </button>
                    </div>

                    {#if profile?.payout_no_rek}
                        <div class="flex items-center gap-1.5 my-1.5 min-w-0">
                            <span class="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono font-bold text-[9px] tracking-wider uppercase shrink-0">
                                {profile.payout_bank_name}
                            </span>
                            <span class="text-xs sm:text-sm font-bold text-[var(--text)] dark:text-white truncate font-mono tracking-tight">
                                {formatCardNumber(profile.payout_no_rek)}
                            </span>
                        </div>
                        <p class="text-[11px] text-[var(--text-3)] dark:text-slate-400 truncate uppercase">
                            a.n {profile.payout_name}
                        </p>
                    {:else}
                        <div class="text-xs text-amber-600 dark:text-amber-400 font-semibold my-1.5 flex items-center gap-1">
                            <span>Belum diatur</span>
                        </div>
                        <p class="text-[11px] text-[var(--text-3)] dark:text-slate-400 truncate">
                            Klik atur untuk klaim
                        </p>
                    {/if}
                </div>
            </div>

            <!-- Transactions Section (Bordered Container with Controls & Card/Table Views) -->
            <div class="bg-[var(--surface)] dark:bg-[#101827] rounded-2xl sm:rounded-3xl border border-[var(--border)] dark:border-[#22314d] shadow-xs space-y-0 relative">
                <!-- Search & Controls Bar -->
                <div class="p-4 border-b border-[var(--border)] dark:border-[#22314d] flex flex-col md:flex-row gap-3.5 justify-between items-center bg-[var(--surface-2)] dark:bg-[#131d31] rounded-t-2xl sm:rounded-t-3xl relative z-20">
                    <div class="w-full md:w-80 relative">
                        <input
                            type="text"
                            bind:value={searchQuery}
                            on:input={handleSearchInput}
                            placeholder="Cari email pembeli, invoice, produk..."
                            class="w-full pl-9 pr-8 py-2 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
                        />
                        <svg class="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        {#if searchQuery}
                            <button
                                type="button"
                                on:click={() => { searchQuery = ''; pagination.page = 1; loadAffiliateData(); }}
                                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white bg-transparent border-0 cursor-pointer p-1"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        {/if}
                    </div>

                    <div class="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end flex-wrap">
                        <!-- Mobile Sort Selector (Visible on Mobile Only) -->
                        <div class="block sm:hidden w-full sm:w-auto">
                            <CustomSelect
                                options={mobileSortOptions}
                                value={selectedMobileSort}
                                prefix="Urutkan:"
                                on:change={handleMobileSortChange}
                            />
                        </div>

                        <div class="text-xs text-[var(--text-3)] dark:text-slate-400">
                            Total: <strong class="text-[var(--text)] dark:text-white font-mono">{pagination.totalTransactions}</strong> transaksi
                        </div>
                    </div>
                </div>

                <!-- Desktop Table Container (Hidden on Mobile) -->
                <div class="hidden sm:block overflow-x-auto">
                    <table class="w-full text-left text-xs">
                        <thead class="bg-[var(--surface-2)] dark:bg-[#131d31] text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider font-bold border-b border-[var(--border)] dark:border-[#22314d] select-none text-[11px]">
                            <tr>
                                <th class="py-3 px-5">Invoice / Produk</th>
                                <th class="py-3 px-5">Pembeli</th>
                                <th
                                    class="py-3 px-5 cursor-pointer hover:bg-blue-500/5 transition-colors group"
                                    on:click={() => handleSortChange('harga')}
                                    title="Urutkan Nilai Transaksi"
                                >
                                    <div class="inline-flex items-center gap-1.5">
                                        <span class={sortField === 'harga' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>Nilai Transaksi</span>
                                        <svg class="w-3.5 h-3.5 transition-transform {sortField === 'harga' ? 'text-blue-600 dark:text-blue-400 ' + (sortOrder === 'asc' ? 'rotate-180' : '') : 'text-slate-400/40 group-hover:text-slate-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </th>
                                <th
                                    class="py-3 px-5 cursor-pointer hover:bg-blue-500/5 transition-colors group"
                                    on:click={() => handleSortChange('komisi')}
                                    title="Urutkan Komisi"
                                >
                                    <div class="inline-flex items-center gap-1.5">
                                        <span class={sortField === 'komisi' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>Komisi Anda</span>
                                        <svg class="w-3.5 h-3.5 transition-transform {sortField === 'komisi' ? 'text-blue-600 dark:text-blue-400 ' + (sortOrder === 'asc' ? 'rotate-180' : '') : 'text-slate-400/40 group-hover:text-slate-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </th>
                                <th class="py-3 px-5 text-center">Status Pencairan</th>
                                <th
                                    class="py-3 px-5 cursor-pointer hover:bg-blue-500/5 transition-colors group"
                                    on:click={() => handleSortChange('tanggal')}
                                    title="Urutkan Tanggal"
                                >
                                    <div class="inline-flex items-center gap-1.5">
                                        <span class={sortField === 'tanggal' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>Tanggal</span>
                                        <svg class="w-3.5 h-3.5 transition-transform {sortField === 'tanggal' ? 'text-blue-600 dark:text-blue-400 ' + (sortOrder === 'asc' ? 'rotate-180' : '') : 'text-slate-400/40 group-hover:text-slate-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                                    </div>
                                </th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)] dark:divide-[#22314d] text-[var(--text)] dark:text-slate-200">
                            {#if tableLoading}
                                <tr>
                                    <td colspan="6" class="py-12 text-center text-[var(--text-3)] dark:text-slate-400">
                                        <div class="flex items-center justify-center gap-2">
                                            <span class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                                            <span>Memuat data transaksi...</span>
                                        </div>
                                    </td>
                                </tr>
                            {:else if transactions.length === 0}
                                <tr>
                                    <td colspan="6" class="py-12 text-center text-[var(--text-3)] dark:text-slate-400">
                                        <div class="space-y-2">
                                            <svg class="w-8 h-8 mx-auto text-slate-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                                            <p class="text-sm font-bold text-[var(--text)] dark:text-white">Belum ada transaksi affiliate</p>
                                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 max-w-sm mx-auto">Bagikan kode kupon {profile?.kupon} kepada rekan atau audiens Anda untuk mulai memperoleh komisi.</p>
                                        </div>
                                    </td>
                                </tr>
                            {:else}
                                {#each transactions as tx, idx (tx.id)}
                                    <tr class="transition-colors {idx % 2 === 0 ? 'bg-[var(--surface)] dark:bg-[#101827]' : 'bg-[var(--surface-2)]/40 dark:bg-[#131d31]/50'} hover:bg-blue-500/5">
                                        <td class="py-3.5 px-5">
                                            <div class="font-bold text-[var(--text)] dark:text-white">{tx.product_name || 'Software Bot'}</div>
                                            <div class="text-[11px] font-mono text-[var(--text-3)] dark:text-slate-400 mt-0.5">{tx.invoice_code}</div>
                                        </td>
                                        <td class="py-3.5 px-5">
                                            <div class="font-semibold text-[var(--text-2)] dark:text-slate-300">{tx.customer_name || 'Customer'}</div>
                                            <div class="text-[11px] text-[var(--text-3)] dark:text-slate-400 font-mono">{tx.customer_email}</div>
                                        </td>
                                        <td class="py-3.5 px-5 font-semibold text-[var(--text-2)] dark:text-slate-300 font-mono">
                                            {formatRupiah(tx.customer_paid_price)}
                                        </td>
                                        <td class="py-3.5 px-5">
                                            <span class="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                                                +{formatRupiah(tx.affiliate_income)}
                                            </span>
                                        </td>
                                        <td class="py-3.5 px-5 text-center">
                                            {#if tx.already_paid === 1}
                                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                    <svg class="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                                                    Sudah Ditransfer
                                                </span>
                                            {:else}
                                                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                    <svg class="w-3 h-3 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                    Belum Dicairkan
                                                </span>
                                            {/if}
                                        </td>
                                        <td class="py-3.5 px-5 text-[var(--text-3)] dark:text-slate-400 whitespace-nowrap font-mono text-[11px]">
                                            {formatDate(tx.created_at)}
                                        </td>
                                    </tr>
                                {/each}
                            {/if}
                        </tbody>
                    </table>
                </div>

                <!-- Mobile Card-Based Transaction List (Distinct Zebra Contrast Cards) -->
                <div class="block sm:hidden p-3.5 space-y-3">
                    {#if tableLoading}
                        <div class="py-8 text-center text-xs text-[var(--text-3)] dark:text-slate-400 flex items-center justify-center gap-2">
                            <span class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                            <span>Memuat data transaksi...</span>
                        </div>
                    {:else if transactions.length === 0}
                        <div class="py-10 text-center text-[var(--text-3)] dark:text-slate-400 space-y-2">
                            <svg class="w-8 h-8 mx-auto text-slate-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            <p class="text-sm font-bold text-[var(--text)] dark:text-white">Belum ada transaksi affiliate</p>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 max-w-xs mx-auto">Bagikan kode kupon {profile?.kupon} kepada rekan atau audiens Anda.</p>
                        </div>
                    {:else}
                        {#each transactions as tx, idx (tx.id)}
                            <div class="p-4 rounded-2xl {idx % 2 === 0 ? 'bg-[var(--surface)] dark:bg-[#101827]' : 'bg-[var(--surface-2)] dark:bg-[#131d31]'} border border-[var(--border)] dark:border-[#22314d] space-y-3 shadow-xs">
                                <div class="flex items-start justify-between gap-2">
                                    <div class="min-w-0">
                                        <div class="font-bold text-xs text-[var(--text)] dark:text-white truncate">{tx.product_name || 'Software Bot'}</div>
                                        <div class="text-[10px] font-mono text-[var(--text-3)] dark:text-slate-400 mt-0.5">{tx.invoice_code}</div>
                                    </div>
                                    <div class="text-right shrink-0">
                                        <div class="font-black text-xs text-emerald-600 dark:text-emerald-400 font-mono">+{formatRupiah(tx.affiliate_income)}</div>
                                        <div class="text-[10px] text-[var(--text-3)] dark:text-slate-400 font-mono">{formatDate(tx.created_at)}</div>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between text-xs pt-2.5 border-t border-[var(--border)] dark:border-[#22314d]">
                                    <div class="text-[11px] text-[var(--text-2)] dark:text-slate-300 truncate max-w-[180px] flex items-center gap-1.5">
                                        <svg class="w-3.5 h-3.5 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                                        <span class="truncate">{tx.customer_name || tx.customer_email}</span>
                                    </div>
                                    <div>
                                        {#if tx.already_paid === 1}
                                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                <svg class="w-2.5 h-2.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                                                Cair
                                            </span>
                                        {:else}
                                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                <svg class="w-2.5 h-2.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                Pending
                                            </span>
                                        {/if}
                                    </div>
                                </div>
                            </div>
                        {/each}
                    {/if}
                </div>

                <!-- Pagination Footer Bar with PageSize Selector -->
                <div class="p-4 border-t border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-[var(--text-3)] dark:text-slate-400 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-b-2xl sm:rounded-b-3xl relative z-20">
                    <div class="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                        <span>Halaman <strong class="text-[var(--text)] dark:text-white font-mono">{pagination.page}</strong> dari <strong class="text-[var(--text)] dark:text-white font-mono">{Math.max(1, pagination.totalPages)}</strong> ({pagination.totalTransactions} total transaksi)</span>
                        <div class="flex items-center gap-1.5">
                            <CustomSelect
                                options={pageSizeOptions}
                                value={pagination.pageSize}
                                prefix="Tampilkan:"
                                on:change={handlePageSizeChange}
                            />
                        </div>
                    </div>
                    <div class="flex items-center gap-1">
                        <!-- Prev Button (Arrow Icon Only) -->
                        <button
                            type="button"
                            on:click={() => changePage(pagination.page - 1)}
                            disabled={pagination.page <= 1}
                            class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                            title="Halaman sebelumnya"
                            aria-label="Halaman sebelumnya"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                            </svg>
                        </button>

                        <!-- Numbered Buttons -->
                        {#each pageNumbers as p}
                            {#if p === '...'}
                                <span class="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-3)] dark:text-slate-500 font-bold select-none">...</span>
                            {:else}
                                <button
                                    type="button"
                                    on:click={() => changePage(Number(p))}
                                    class="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center {pagination.page === p ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border-0' : 'border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs'}"
                                >
                                    {p}
                                </button>
                            {/if}
                        {/each}

                        <!-- Next Button (Arrow Icon Only) -->
                        <button
                            type="button"
                            on:click={() => changePage(pagination.page + 1)}
                            disabled={pagination.page >= pagination.totalPages || pagination.totalPages <= 1}
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
            </div>
        {/if}
    </main>

    <!-- ================= MODAL 1: EDIT REKENING PENARIKAN ================= -->
    {#if showPayoutModal}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true">
            <div class="w-full max-w-lg rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                <!-- Modal Header -->
                <div class="p-5 sm:p-6 pb-4 flex items-start justify-between border-b border-[var(--border)] dark:border-[#22314d] bg-[var(--surface-2)]/40 dark:bg-[#131d31]/40">
                    <div class="flex items-center gap-3.5">
                        <div class="w-10 h-10 rounded-2xl bg-blue-600/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0 shadow-2xs">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="font-bold text-base sm:text-lg text-[var(--text)] dark:text-white tracking-tight">
                                Pengaturan Rekening Penarikan
                            </h3>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">
                                Rekening resmi untuk pengiriman transfer komisi afiliasi berkala.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        on:click={() => showPayoutModal = false}
                        class="w-8 h-8 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer border-0 bg-transparent shrink-0"
                        title="Tutup dialog"
                        aria-label="Tutup dialog"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <!-- Modal Body Scrollable Content -->
                <div class="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                    {#if modalError}
                        <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2.5 animate-shake">
                            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>{modalError}</span>
                        </div>
                    {/if}

                    <!-- Interactive Live Virtual Bank Passbook/Debit Card Preview -->
                    <div class="relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white shadow-xl transition-all duration-300 bg-gradient-to-br {activeBankConfig.gradient} border border-white/20">
                        <!-- Atmospheric Ambient Glows -->
                        <div class="absolute -right-8 -bottom-8 w-36 h-36 rounded-full bg-white/10 blur-2xl pointer-events-none"></div>
                        <div class="absolute -left-8 -top-8 w-28 h-28 rounded-full bg-black/20 blur-xl pointer-events-none"></div>

                        <div class="flex items-center justify-between relative z-10">
                            <!-- Metallic EMV Chip & Contactless Wave -->
                            <div class="flex items-center gap-2">
                                <div class="w-9 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-amber-200 to-yellow-400 border border-amber-400/60 shadow-xs flex items-center justify-center p-1">
                                    <div class="w-full h-full border border-amber-700/30 rounded-xs grid grid-cols-2 gap-0.5 opacity-80">
                                        <div class="border-r border-b border-amber-700/40"></div>
                                        <div class="border-b border-amber-700/40"></div>
                                        <div class="border-r border-amber-700/40"></div>
                                        <div></div>
                                    </div>
                                </div>
                                <svg class="w-4 h-4 text-white/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071a10 10 0 0114.142 0M1.393 9.393a15 15 0 0121.214 0" />
                                </svg>
                            </div>

                            <!-- Official Bank Code Badge -->
                            <div class="px-3 py-1 rounded-xl bg-white/20 backdrop-blur-md border border-white/30 text-xs font-black tracking-widest uppercase font-mono shadow-xs">
                                {activeBankConfig.code}
                            </div>
                        </div>

                        <!-- Account Number Live Display -->
                        <div class="mt-4 mb-3 relative z-10">
                            <div class="text-[9px] font-bold text-white/70 uppercase tracking-widest">Nomor Rekening Payout</div>
                            <div class="text-base sm:text-xl font-mono font-bold tracking-widest text-white truncate drop-shadow-sm mt-0.5">
                                {formNoRek ? formatCardNumber(formNoRek) : '•••• •••• •••• ' + activeBankConfig.example.slice(-3)}
                            </div>
                        </div>

                        <!-- Cardholder & Live Validation Status Footer -->
                        <div class="flex items-end justify-between relative z-10 pt-2 border-t border-white/15 text-xs">
                            <div class="min-w-0 flex-1 pr-2">
                                <div class="text-[9px] font-bold text-white/70 uppercase tracking-wider">Pemilik Rekening</div>
                                <div class="font-bold text-white tracking-wide truncate uppercase text-[11px] sm:text-xs">
                                    {formOwnerName.trim() || 'NAMA PEMILIK REKENING'}
                                </div>
                            </div>
                            <div class="shrink-0">
                                {#if activeBankConfig.regex.test(formNoRek.replace(/\s/g, ''))}
                                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-400/25 text-emerald-200 border border-emerald-300/40 backdrop-blur-xs">
                                        <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                                        Format Sesuai
                                    </span>
                                {:else}
                                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-white/15 text-white/80 border border-white/20">
                                        Wajib {activeBankConfig.digitsLength}
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- Fast Bank Selector Grid -->
                    <div class="space-y-1.5">
                        <label class="block font-bold text-[var(--text-2)] dark:text-slate-300 text-xs">
                            Pilih Bank Resmi
                        </label>
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {#each availableBanks as bank}
                                {@const isSelected = selectedBankCode === bank.code}
                                <button
                                    type="button"
                                    on:click={() => { selectedBankCode = bank.code; formBankName = bank.code; }}
                                    class="px-3 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer flex flex-col items-center justify-center gap-0.5 text-center {
                                        isSelected 
                                            ? 'bg-blue-500/10 dark:bg-blue-500/20 border-blue-500 text-blue-600 dark:text-blue-400 shadow-xs ring-2 ring-blue-500/20'
                                            : 'bg-[var(--surface-2)] dark:bg-[#131d31] border-[var(--border)] dark:border-slate-700 text-[var(--text-2)] dark:text-slate-300 hover:bg-[var(--surface)] dark:hover:bg-[#1e293b]'
                                    }"
                                >
                                    <span class="font-mono text-xs">{bank.code}</span>
                                    <span class="text-[10px] font-normal text-[var(--text-3)] dark:text-slate-400">{bank.digitsLength}</span>
                                </button>
                            {/each}
                        </div>
                    </div>

                    <!-- Form Inputs -->
                    <div class="space-y-4 text-xs">
                        <!-- Field 1: Nomor Rekening -->
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <label for="payout-norek" class="font-bold text-[var(--text-2)] dark:text-slate-300 text-xs">
                                    Nomor Rekening
                                </label>
                                <span class="text-[10px] font-mono font-medium text-[var(--text-3)] dark:text-slate-400">
                                    {formNoRek.replace(/\s/g, '').length} / {activeBankConfig.digitsLength}
                                </span>
                            </div>
                            <div class="relative">
                                <input
                                    id="payout-norek"
                                    type="text"
                                    inputmode="numeric"
                                    bind:value={formNoRek}
                                    placeholder="Contoh: {activeBankConfig.example}"
                                    class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 text-[var(--text)] dark:text-white font-mono text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                />
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                            </div>
                            <p class="text-[10px] text-[var(--text-3)] dark:text-slate-400">
                                Pastikan format sesuai standar resmi {activeBankConfig.name} ({activeBankConfig.digitsLength}).
                            </p>
                        </div>

                        <!-- Field 2: Nama Pemilik Rekening -->
                        <div class="space-y-1.5">
                            <label for="payout-name" class="block font-bold text-[var(--text-2)] dark:text-slate-300 text-xs">
                                Nama Lengkap Pemilik Rekening
                            </label>
                            <div class="relative">
                                <input
                                    id="payout-name"
                                    type="text"
                                    bind:value={formOwnerName}
                                    placeholder="Sesuai nama yang tertera di buku tabungan / m-banking"
                                    class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 text-[var(--text)] dark:text-white uppercase text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                                />
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        </div>

                        <!-- Trust & Security Banner -->
                        <div class="p-3 rounded-xl bg-blue-500/5 dark:bg-blue-500/10 border border-blue-500/20 flex items-center gap-2.5 text-[11px] text-[var(--text-2)] dark:text-slate-300">
                            <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span>Data rekening tersimpan dengan enkripsi aman untuk pencairan otomatis tanpa potongan biaya admin.</span>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer Actions -->
                <div class="p-4 sm:p-5 border-t border-[var(--border)] dark:border-[#22314d] bg-[var(--surface-2)]/60 dark:bg-[#0c1424] flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        on:click={() => showPayoutModal = false}
                        class="px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white hover:bg-[var(--surface-2)] dark:hover:bg-slate-800 transition-all cursor-pointer border border-transparent"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        on:click={handleSavePayout}
                        disabled={submittingModal}
                        class="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-blue-500/25 transition-all disabled:opacity-50 cursor-pointer border-0 flex items-center gap-2"
                    >
                        {#if submittingModal}
                            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Menyimpan Rekening...</span>
                        {:else}
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                            <span>Simpan Rekening</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- ================= MODAL 2: EDIT KODE KUPON ================= -->
    {#if showCouponModal}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true">
            <div class="w-full max-w-md rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                <!-- Modal Header -->
                <div class="p-5 sm:p-6 pb-4 flex items-start justify-between border-b border-[var(--border)] dark:border-[#22314d] bg-[var(--surface-2)]/40 dark:bg-[#131d31]/40">
                    <div class="flex items-center gap-3.5">
                        <div class="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0 shadow-2xs">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="font-bold text-base sm:text-lg text-[var(--text)] dark:text-white tracking-tight">
                                Kustomisasi Kupon Referral
                            </h3>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">
                                Atur kode unik yang dibagikan untuk diskon pembeli 10%.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        on:click={() => showCouponModal = false}
                        class="w-8 h-8 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors flex items-center justify-center cursor-pointer border-0 bg-transparent shrink-0"
                        title="Tutup dialog"
                        aria-label="Tutup dialog"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <!-- Modal Body Scrollable Content -->
                <div class="p-5 sm:p-6 space-y-5 overflow-y-auto max-h-[75vh]">
                    {#if modalError}
                        <div class="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2.5 animate-shake">
                            <svg class="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>{modalError}</span>
                        </div>
                    {/if}

                    <!-- Interactive Live Ticket Voucher Preview Card -->
                    <div class="relative overflow-hidden rounded-2xl p-4 sm:p-5 text-white shadow-xl bg-gradient-to-tr from-indigo-900 via-blue-900 to-indigo-800 border border-indigo-400/30">
                        <div class="flex items-center justify-between border-b border-dashed border-white/20 pb-3">
                            <div class="space-y-0.5">
                                <div class="text-[9px] font-bold uppercase tracking-widest text-indigo-300">Voucher Afiliasi Resmi</div>
                                <div class="text-sm sm:text-base font-black tracking-wide text-white">Diskon 10% Pembeli</div>
                            </div>
                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-400/20 text-emerald-300 border border-emerald-400/30">
                                Komisi 5% Anda
                            </span>
                        </div>
                        <div class="mt-3.5 flex items-center justify-between">
                            <div>
                                <div class="text-[9px] font-bold uppercase tracking-wider text-white/60">Kode Kupon Aktif</div>
                                <div class="font-mono text-base sm:text-lg font-black tracking-widest text-yellow-300 drop-shadow-xs">
                                    {formCoupon.trim().toUpperCase() || 'KODEKUPON'}
                                </div>
                            </div>
                            <div class="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center text-white/75">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <!-- Form Input -->
                    <div class="space-y-3 text-xs">
                        <div class="space-y-1.5">
                            <label for="input-custom-coupon" class="block font-bold text-[var(--text-2)] dark:text-slate-300 text-xs">
                                Kode Kupon Kustom
                            </label>
                            <div class="relative">
                                <input
                                    id="input-custom-coupon"
                                    type="text"
                                    bind:value={formCoupon}
                                    placeholder="Contoh: BISNISHEBAT, ZIQVA10"
                                    class="w-full pl-10 pr-4 py-2.5 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 text-[var(--text)] dark:text-white font-mono uppercase text-xs sm:text-sm focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all"
                                />
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                            </div>
                            <p class="text-[10px] text-[var(--text-3)] dark:text-slate-400">
                                Gunakan kombinasi huruf dan angka tanpa spasi (minimal 3 karakter).
                            </p>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer Actions -->
                <div class="p-4 sm:p-5 border-t border-[var(--border)] dark:border-[#22314d] bg-[var(--surface-2)]/60 dark:bg-[#0c1424] flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        on:click={() => showCouponModal = false}
                        class="px-4 py-2.5 rounded-xl text-xs font-bold text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white hover:bg-[var(--surface-2)] dark:hover:bg-slate-800 transition-all cursor-pointer border border-transparent"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        on:click={handleSaveCoupon}
                        disabled={submittingModal}
                        class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white font-bold text-xs sm:text-sm shadow-md shadow-indigo-500/25 transition-all disabled:opacity-50 cursor-pointer border-0 flex items-center gap-2"
                    >
                        {#if submittingModal}
                            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Menyimpan Kupon...</span>
                        {:else}
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
                            <span>Simpan Kupon</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</Layout>
