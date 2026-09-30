<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import AdminLayout from '../components/AdminLayout.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';

    interface DashboardData {
        adminName: string;
        timezone?: string;
        period?: string;
        stats: {
            totalOrders: number;
            pendingPayments: number;
            completedPayments: number;
            totalRevenue: number;
            grossRevenue: number;
            affiliateCost: number;
            totalAffiliates: number;
            newAffiliatesThisMonth: number;
            activeAffiliates: number;
            totalCommissionPaid: number;
        };
        quickAlerts?: {
            pendingCount: number;
            expiringCount: number;
            unpaidPayoutCount: number;
            unpaidPayoutAmount: number;
        };
        growthPercent?: number;
        topProducts: Array<{
            name: string;
            count: number;
            image: string | null;
            price: number;
        }>;
        revenueGraphData: Array<{ date: string; amount: number }>;
        recentOrders: Array<{
            id: number;
            user: string;
            email: string;
            productName: string;
            productImage: string | null;
            durationDisplay: string;
            totalAmount: number;
            status: string;
            channelCode: string | null;
            createdAt: string;
            paidAt: string | null;
        }>;
        expiringLicenses?: Array<{
            id: number;
            token: string;
            product: string;
            user: string;
            userEmail?: string;
            whatsapp?: string | null;
            expiresAt: string;
            expiresEpoch: number;
            daysLeft: number;
        }>;
        topAffiliates?: Array<{
            email: string;
            income: number;
            count: number;
        }>;
    }

    interface PaymentDetailData {
        order: {
            id: number;
            status: string;
            statusBadge: string | null;
            isPaid: boolean;
            totalAmount: number;
            adminFee: number;
            channelCode: string;
            paymentMethod: string;
            paymentRequestId: string | null;
            paymentId: string | null;
            vaNumber: string | null;
            qrString: string | null;
            paymentUrl: string | null;
            duration: number;
            durationMonths: number;
            durationDisplay: string;
            voucer: string | null;
            note: string;
            confirmedBy: string;
            lastUpdated: string | null;
            createdAt: string;
            createdEpoch: number;
            expiresAt: string | null;
            paidAt: string | null;
        };
        items: Array<{
            name: string;
            image?: string | null;
            price: number;
            discountPercent: number;
            finalPrice: number;
            durationText: string;
            count: number;
        }>;
        customer: {
            name: string;
            email: string;
            whatsapp: string | null;
            company: string | null;
            verified: boolean;
            registeredAt: string | null;
        };
        tokens: Array<{
            id: number;
            token: string;
            product: string;
            duration: number;
            isActivated: boolean;
            takedAt: string | null;
            takedIp: string | null;
            user: string | null;
            createdAt: string;
        }>;
        affiliate: {
            affiliatorEmail: string;
            affiliateIncome: number;
            alreadyPaid: boolean;
            productName: string;
            createdAt: string | null;
            paidAt: string | null;
        } | null;
    }

    let loading: boolean = true;
    let error: string = '';
    let dashboardData: DashboardData | null = null;
    let selectedPeriod: '7d' | '30d' | 'this_month' | 'this_year' = '7d';

    const periodTabs: TabItem[] = [
        { id: '7d', label: '7 Hari', color: 'blue' },
        { id: '30d', label: '30 Hari', color: 'blue' },
        { id: 'this_month', label: 'Bulan Ini', color: 'blue' },
        { id: 'this_year', label: 'Tahun Ini', color: 'blue' }
    ];

    // Detail Modal State
    let detailModalOpen: boolean = false;
    let loadingDetail: boolean = false;
    let detailError: string = '';
    let detailData: PaymentDetailData | null = null;

    // Toast Copied Feedback
    let copiedText: string = '';
    let copyToastTimer: any = null;
    let imgErrorMap: Record<string, boolean> = {};
    let hoveredGraphIndex: number | null = null;

    // Duration Modal State
    let durationModalOpen: boolean = false;
    let editingPayment: { id: number; productName: string; durationMonths: number } | null = null;
    let newDuration: number = 1;
    let isUpdatingDuration: boolean = false;

    function isValidImg(url: string | null | undefined): boolean {
        if (!url || typeof url !== 'string') return false;
        const trimmed = url.trim();
        if (!trimmed) return false;
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/favicon') || trimmed.startsWith('data:image/');
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            if (durationModalOpen) closeDurationModal();
            else if (detailModalOpen) closeDetailModal();
        }
    }

    onMount(async () => {
        await loadDashboard();
    });

    onDestroy(() => {
        if (copyToastTimer) clearTimeout(copyToastTimer);
    });

    async function handlePeriodChange(period: string) {
        selectedPeriod = period as '7d' | '30d' | 'this_month' | 'this_year';
        await loadDashboard();
    }

    async function loadDashboard() {
        loading = true;
        error = '';
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
            const res = await fetch(`/admin/api/dashboard?timezone=${encodeURIComponent(tz)}&period=${selectedPeriod}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/#/admin/login';
                return;
            }

            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data) {
                dashboardData = json.data;
            } else {
                error = json.message || 'Gagal memuat data dashboard.';
            }
        } catch (err) {
            console.error('Fetch dashboard error:', err);
            error = 'Terjadi kesalahan jaringan saat memuat data.';
        } finally {
            loading = false;
        }
    }

    function copyToClipboard(text: string, label: string = '') {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            copiedText = label || text;
            if (copyToastTimer) clearTimeout(copyToastTimer);
            copyToastTimer = setTimeout(() => {
                copiedText = '';
            }, 2500);
        }).catch(err => {
            console.error('Copy failed:', err);
        });
    }

    async function openDetailModal(id: number) {
        detailModalOpen = true;
        loadingDetail = true;
        detailError = '';
        detailData = null;

        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
            const res = await fetch(`/admin/api/payments/detail/${id}?timezone=${encodeURIComponent(tz)}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data) {
                detailData = json.data;
            } else {
                detailError = json.message || 'Gagal memuat rincian transaksi.';
            }
        } catch (err) {
            console.error('Detail payment error:', err);
            detailError = 'Terjadi kesalahan jaringan saat memuat rincian.';
        } finally {
            loadingDetail = false;
        }
    }

    function closeDetailModal() {
        detailModalOpen = false;
        detailData = null;
        detailError = '';
    }

    function openDurationModal(payment: { id: number; productName: string; durationMonths: number }) {
        editingPayment = payment;
        newDuration = payment.durationMonths || 1;
        durationModalOpen = true;
    }

    function closeDurationModal() {
        durationModalOpen = false;
        editingPayment = null;
    }

    async function executeUpdateDuration() {
        if (!editingPayment) return;
        isUpdatingDuration = true;
        try {
            const res = await fetch(`/admin/api/payments/update-duration/${editingPayment.id}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ durationMonths: newDuration })
            });
            const json = await res.json();
            if (res.ok && (json.success || json.status === 'success')) {
                closeDurationModal();
                if (detailModalOpen && detailData?.order.id === editingPayment.id) {
                    await openDetailModal(editingPayment.id);
                }
                await loadDashboard();
            } else {
                alert(json.message || json.error || 'Gagal memperbarui durasi');
            }
        } catch (err) {
            console.error('Update duration error:', err);
            alert('Kesalahan jaringan saat mengubah durasi.');
        } finally {
            isUpdatingDuration = false;
        }
    }

    function formatCurrency(amount: number): string {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    function calculateChartCeiling(maxVal: number): number {
        if (maxVal <= 0) return 1_000_000;
        const target = maxVal * 1.15;
        const magnitude = Math.pow(10, Math.floor(Math.log10(target)));
        const normalized = target / magnitude;
        let roundMultiplier = 1;
        if (normalized <= 1) roundMultiplier = 1;
        else if (normalized <= 1.5) roundMultiplier = 1.5;
        else if (normalized <= 2) roundMultiplier = 2;
        else if (normalized <= 2.5) roundMultiplier = 2.5;
        else if (normalized <= 3) roundMultiplier = 3;
        else if (normalized <= 4) roundMultiplier = 4;
        else if (normalized <= 5) roundMultiplier = 5;
        else if (normalized <= 7.5) roundMultiplier = 7.5;
        else roundMultiplier = 10;
        return Math.round(roundMultiplier * magnitude);
    }

    function formatShortCurrency(amount: number): string {
        if (!amount || amount <= 0) return 'Rp 0';
        if (amount >= 1_000_000_000) {
            return 'Rp ' + (amount / 1_000_000_000).toFixed(1).replace('.0', '').replace('.', ',') + ' M';
        }
        if (amount >= 1_000_000) {
            return 'Rp ' + (amount / 1_000_000).toFixed(1).replace('.0', '').replace('.', ',') + ' Jt';
        }
        if (amount >= 1_000) {
            return 'Rp ' + (amount / 1_000).toFixed(0) + ' Rb';
        }
        return 'Rp ' + amount.toString();
    }

    $: revenueData = dashboardData?.revenueGraphData || [];

    $: maxGraphAmount = revenueData.length > 0
        ? Math.max(...revenueData.map((d) => d.amount), 0)
        : 0;

    $: chartCeiling = calculateChartCeiling(maxGraphAmount);

    $: totalRevenueSum = revenueData.reduce((acc, curr) => acc + curr.amount, 0);

    $: avgRevenue = revenueData.length > 0
        ? Math.round(totalRevenueSum / revenueData.length)
        : 0;

    $: peakRevenueItem = revenueData.length > 0
        ? revenueData.reduce((max, curr) => curr.amount > max.amount ? curr : max, revenueData[0])
        : null;

    $: activeDaysCount = revenueData.filter(d => d.amount > 0).length;

    $: maxProductCount = dashboardData && dashboardData.topProducts.length > 0
        ? Math.max(...dashboardData.topProducts.map((p) => p.count), 1)
        : 1;
</script>

<svelte:window on:keydown={handleKeydown} />

<AdminLayout activePage="dashboard" adminName={dashboardData?.adminName || 'Admin'}>
    <main class="page-body p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
        <!-- Toast Copied Feedback -->
        {#if copiedText}
            <div class="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold shadow-2xl border border-slate-700/50 dark:border-slate-200 transition-all duration-300 transform translate-y-0">
                <svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span>Tersalin: {copiedText}</span>
            </div>
        {/if}

        <!-- Header Banner -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] uppercase tracking-wider">
                        PANEL UTAMA
                    </span>
                    <span class="text-xs text-[var(--text-3)] font-medium">Ringkasan Sistem</span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">
                    Dashboard Admin
                </h1>
                <p class="text-xs sm:text-sm text-[var(--text-3)] mt-0.5">
                    Statistik penjualan, analitik pendapatan, dan aktivitas platform Ziqva.
                </p>
            </div>

            <!-- Header Actions (Posisikan di Kanan) -->
            <div class="flex items-center justify-end gap-2 shrink-0 self-end sm:self-center">
                <button
                    type="button"
                    on:click={loadDashboard}
                    class="inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--surface-2)] active:scale-95 border border-[var(--border)] text-[var(--text)] transition-all shadow-xs cursor-pointer whitespace-nowrap"
                >
                    <svg class="w-4 h-4 text-[var(--text-3)]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Segarkan</span>
                </button>
                <a
                    href="#/admin/trials/create"
                    class="inline-flex items-center gap-1.5 min-h-[38px] sm:min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 active:scale-95 text-white transition-all shadow-xs border-0 no-underline whitespace-nowrap"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Buat Trial</span>
                </a>
            </div>
        </div>

        <!-- 1. Quick Action Dock (5 Action Shortcuts) -->
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <a href="#/admin/trials/create" class="p-3.5 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-blue-500/50 shadow-xs flex items-center gap-3 transition-all duration-200 group">
                <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
                </div>
                <div class="min-w-0">
                    <div class="text-xs font-bold text-[var(--text)] group-hover:text-blue-500 transition-colors truncate">Buat Trial</div>
                    <div class="text-[10px] text-[var(--text-3)] truncate">Lisensi demo instan</div>
                </div>
            </a>
            <a href="#/admin/payments" class="p-3.5 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-emerald-500/50 shadow-xs flex items-center gap-3 transition-all duration-200 group">
                <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <div class="min-w-0">
                    <div class="text-xs font-bold text-[var(--text)] group-hover:text-emerald-500 transition-colors truncate">Verifikasi Bayar</div>
                    <div class="text-[10px] text-[var(--text-3)] truncate">Audit invoice masuk</div>
                </div>
            </a>
            <a href="#/admin/products" class="p-3.5 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-indigo-500/50 shadow-xs flex items-center gap-3 transition-all duration-200 group">
                <div class="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
                </div>
                <div class="min-w-0">
                    <div class="text-xs font-bold text-[var(--text)] group-hover:text-indigo-500 transition-colors truncate">Katalog Software</div>
                    <div class="text-[10px] text-[var(--text-3)] truncate">Kelola produk & harga</div>
                </div>
            </a>
            <a href="#/admin/affiliate" class="p-3.5 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-purple-500/50 shadow-xs flex items-center gap-3 transition-all duration-200 group">
                <div class="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                </div>
                <div class="min-w-0">
                    <div class="text-xs font-bold text-[var(--text)] group-hover:text-purple-500 transition-colors truncate">Payout Afiliasi</div>
                    <div class="text-[10px] text-[var(--text-3)] truncate">Cairkan komisi mitra</div>
                </div>
            </a>
            <a href="#/admin/settings" class="p-3.5 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-amber-500/50 shadow-xs flex items-center gap-3 transition-all duration-200 group col-span-2 sm:col-span-1 justify-self-center mx-auto w-full max-w-[calc(50%-0.375rem)] sm:max-w-none">
                <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
                </div>
                <div class="min-w-0">
                    <div class="text-xs font-bold text-[var(--text)] group-hover:text-amber-500 transition-colors truncate">Backup & Sistem</div>
                    <div class="text-[10px] text-[var(--text-3)] truncate">Konfigurasi & audit</div>
                </div>
            </a>
        </div>

        <!-- 2. Actionable Health & Pending Alerts Banner -->
        {#if dashboardData && dashboardData.quickAlerts && (dashboardData.quickAlerts.pendingCount > 0 || dashboardData.quickAlerts.expiringCount > 0 || dashboardData.quickAlerts.unpaidPayoutCount > 0)}
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
                {#if dashboardData.quickAlerts.pendingCount > 0}
                    <div class="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-500 flex items-center justify-center shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                            </div>
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-amber-500 dark:text-amber-400">{dashboardData.quickAlerts.pendingCount} Transaksi Pending</div>
                                <div class="text-[11px] text-[var(--text-3)]">Menunggu verifikasi manual</div>
                            </div>
                        </div>
                        <a href="#/admin/payments?status=pending" class="px-2.5 py-1.5 rounded-lg bg-amber-500 text-white text-[11px] font-bold hover:bg-amber-600 transition-colors shrink-0">Audit</a>
                    </div>
                {/if}

                {#if dashboardData.quickAlerts.expiringCount > 0}
                    <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                            </div>
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-rose-500 dark:text-rose-400">{dashboardData.quickAlerts.expiringCount} Lisensi Akan Habis</div>
                                <div class="text-[11px] text-[var(--text-3)]">Expired dlm 7 hari ke depan</div>
                            </div>
                        </div>
                        <a href="#/admin/users" class="px-2.5 py-1.5 rounded-lg bg-rose-500 text-white text-[11px] font-bold hover:bg-rose-600 transition-colors shrink-0">Pantau</a>
                    </div>
                {/if}

                {#if dashboardData.quickAlerts.unpaidPayoutCount > 0}
                    <div class="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/25 flex items-center justify-between gap-3">
                        <div class="flex items-center gap-3 min-w-0">
                            <div class="w-9 h-9 rounded-xl bg-purple-500/20 text-purple-500 flex items-center justify-center shrink-0">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>
                            </div>
                            <div class="min-w-0">
                                <div class="text-xs font-bold text-purple-500 dark:text-purple-400">{dashboardData.quickAlerts.unpaidPayoutCount} Payout Pending</div>
                                <div class="text-[11px] text-[var(--text-3)]">{formatCurrency(dashboardData.quickAlerts.unpaidPayoutAmount)}</div>
                            </div>
                        </div>
                        <a href="#/admin/affiliate" class="px-2.5 py-1.5 rounded-lg bg-purple-600 text-white text-[11px] font-bold hover:bg-purple-700 transition-colors shrink-0">Cairkan</a>
                    </div>
                {/if}
            </div>
        {/if}

        {#if loading}
            <!-- Skeleton Loading State -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                {#each [1, 2, 3, 4] as _}
                    <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] animate-pulse">
                        <div class="h-4 bg-[var(--surface-2)] rounded w-1/2 mb-3"></div>
                        <div class="h-7 bg-[var(--surface-2)] rounded w-3/4 mb-2"></div>
                        <div class="h-3 bg-[var(--surface-2)] rounded w-1/3"></div>
                    </div>
                {/each}
            </div>
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <div class="lg:col-span-2 p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] h-72 animate-pulse"></div>
                <div class="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] h-72 animate-pulse"></div>
            </div>
        {:else if error}
            <!-- Error State -->
            <div class="p-6 rounded-2xl bg-red-500/10 border border-red-500/20 text-center text-red-400 mb-8">
                <p class="text-sm font-semibold mb-2">{error}</p>
                <button
                    type="button"
                    on:click={loadDashboard}
                    class="px-4 py-2 bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] rounded-xl text-xs font-semibold cursor-pointer"
                >
                    Coba Muat Ulang
                </button>
            </div>
        {:else if dashboardData}
            <!-- 1. Stats Grid (4 Cards) -->
            <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <!-- Card 1: Pendapatan Bersih -->
                <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-medium text-[var(--text-3)]">Pendapatan Bersih (Bulan Ini)</span>
                        <div class="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-xl sm:text-2xl font-bold text-[var(--text)] tracking-tight">
                            {formatCurrency(dashboardData.stats.totalRevenue)}
                        </div>
                        <div class="flex items-center gap-1.5 text-[11px] text-[var(--text-3)] mt-1.5">
                            <span>Gross: <b class="text-[var(--text-2)]">{formatShortCurrency(dashboardData.stats.grossRevenue)}</b></span>
                            <span>•</span>
                            <span>Aff: <b class="text-red-400">-{formatShortCurrency(dashboardData.stats.affiliateCost)}</b></span>
                        </div>
                    </div>
                </div>

                <!-- Card 2: Pesanan -->
                <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-medium text-[var(--text-3)]">Total Pesanan (Bulan Ini)</span>
                        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-xl sm:text-2xl font-bold text-[var(--text)] tracking-tight">
                            {dashboardData.stats.totalOrders.toLocaleString('id-ID')}
                        </div>
                        <div class="flex items-center gap-2 text-[11px] mt-1.5">
                            <span class="text-emerald-500 font-semibold">{dashboardData.stats.completedPayments} lunas</span>
                            <span class="text-[var(--text-3)]">•</span>
                            <a href="#/admin/payments?status=pending" class="text-amber-600 dark:text-amber-400 font-semibold hover:underline" title="Lihat transaksi pending">{dashboardData.stats.pendingPayments} pending</a>
                        </div>
                    </div>
                </div>

                <!-- Card 3: Mitra Afiliasi -->
                <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-medium text-[var(--text-3)]">Mitra Afiliasi</span>
                        <div class="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-500">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-xl sm:text-2xl font-bold text-[var(--text)] tracking-tight">
                            {dashboardData.stats.totalAffiliates.toLocaleString('id-ID')} <span class="text-xs sm:text-sm font-semibold text-[var(--text-3)]">Mitra</span>
                        </div>
                        <div class="text-[11px] text-[var(--text-3)] mt-1.5 flex items-center gap-1.5 flex-wrap">
                            <span class="text-purple-600 dark:text-purple-400 font-semibold">+{dashboardData.stats.newAffiliatesThisMonth} baru bulan ini</span>
                            <span>•</span>
                            <span><b class="text-[var(--text-2)]">{dashboardData.stats.activeAffiliates}</b> aktif (30h)</span>
                        </div>
                    </div>
                </div>

                <!-- Card 4: Komisi Pending -->
                <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div class="flex items-center justify-between mb-3">
                        <span class="text-xs font-medium text-[var(--text-3)]">Komisi Belum Dibayar</span>
                        <div class="w-8 h-8 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                        </div>
                    </div>
                    <div>
                        <div class="text-xl sm:text-2xl font-bold text-orange-500 dark:text-orange-400 tracking-tight">
                            {formatCurrency(dashboardData.stats.totalCommissionPaid)}
                        </div>
                        <a href="#/admin/affiliate" class="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline mt-1.5">
                            <span>Bayar Komisi</span>
                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>
                </div>
            </div>

            <!-- Revenue Trend Chart & Top Selling Products -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                <!-- Dynamic Revenue Trend (2 Cols) -->
                <div class="lg:col-span-2 p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div>
                        <!-- Card Header & Period Filters -->
                        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                            <div>
                                <div class="flex items-center gap-2 flex-wrap">
                                    <h2 class="text-base sm:text-lg font-bold text-[var(--text)] tracking-tight">Trend Pendapatan</h2>
                                    {#if dashboardData.growthPercent !== undefined}
                                        <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold {dashboardData.growthPercent >= 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20'}">
                                            {#if dashboardData.growthPercent >= 0}
                                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                                <span>+{dashboardData.growthPercent}% vs periode lalu</span>
                                            {:else}
                                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M13 17h8m0 0v-8m0 8l-8-8-4 4-6-6" /></svg>
                                                <span>{dashboardData.growthPercent}% vs periode lalu</span>
                                            {/if}
                                        </span>
                                    {/if}
                                </div>
                                <p class="text-xs text-[var(--text-3)] mt-0.5">
                                    Visualisasi arus kas masuk & performa penjualan berkala
                                </p>
                            </div>

                            <!-- Period Selector Toolbar (Right Aligned on Mobile & Desktop with Smooth Sliding Pill Animation) -->
                            <div class="flex justify-end w-full sm:w-auto">
                                <SegmentedTabs
                                    tabs={periodTabs}
                                    bind:activeTab={selectedPeriod}
                                    on:change={(e) => handlePeriodChange(e.detail)}
                                    on:tabChange={(e) => handlePeriodChange(e.detail)}
                                />
                            </div>
                        </div>

                        <!-- Metric Highlights Strip (4 KPIs) -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] mb-6">
                            <div class="min-w-0">
                                <div class="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">Total Omset</div>
                                <div class="text-xs sm:text-sm font-extrabold text-[var(--text)] truncate">{formatCurrency(totalRevenueSum)}</div>
                            </div>
                            <div class="min-w-0">
                                <div class="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">Rata-Rata / {selectedPeriod === 'this_year' ? 'Bulan' : 'Hari'}</div>
                                <div class="text-xs sm:text-sm font-extrabold text-[var(--text)] truncate">{formatCurrency(avgRevenue)}</div>
                            </div>
                            <div class="min-w-0">
                                <div class="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">Puncak Penjualan</div>
                                <div class="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 truncate">
                                    {peakRevenueItem && peakRevenueItem.amount > 0 ? formatCurrency(peakRevenueItem.amount) : 'Rp 0'}
                                    {#if peakRevenueItem && peakRevenueItem.amount > 0}
                                        <span class="text-[10px] font-medium text-[var(--text-3)]">({peakRevenueItem.date})</span>
                                    {/if}
                                </div>
                            </div>
                            <div class="min-w-0">
                                <div class="text-[10px] font-semibold text-[var(--text-3)] uppercase tracking-wider">Aktivitas Transaksi</div>
                                <div class="text-xs sm:text-sm font-extrabold text-[var(--text)] truncate">
                                    {activeDaysCount} <span class="text-[11px] font-normal text-[var(--text-3)]">/ {revenueData.length} {selectedPeriod === 'this_year' ? 'bln' : 'hari'}</span>
                                </div>
                            </div>
                        </div>

                        <!-- Dynamic Chart Box with Y-Axis & Gridlines -->
                        <div class="relative pt-2 pb-1">
                            <!-- Chart Container -->
                            <div class="flex items-stretch gap-2 sm:gap-3 h-52 sm:h-60">
                                <!-- Y-Axis Scale Column -->
                                <div class="w-14 sm:w-16 shrink-0 flex flex-col justify-between items-end pb-7 text-[10px] font-semibold text-[var(--text-3)] select-none pointer-events-none">
                                    <span>{formatShortCurrency(chartCeiling)}</span>
                                    <span>{formatShortCurrency(chartCeiling * 0.75)}</span>
                                    <span>{formatShortCurrency(chartCeiling * 0.50)}</span>
                                    <span>{formatShortCurrency(chartCeiling * 0.25)}</span>
                                    <span>Rp 0</span>
                                </div>

                                <!-- Canvas Area (Gridlines + Bars + X-Axis) -->
                                <div class="relative flex-1 flex flex-col justify-between min-w-0 h-full">
                                    <!-- Background Horizontal Gridlines -->
                                    <div class="absolute inset-x-0 top-0 bottom-7 flex flex-col justify-between pointer-events-none z-0">
                                        <div class="w-full border-b border-dashed border-[var(--border)] opacity-60"></div>
                                        <div class="w-full border-b border-dashed border-[var(--border)] opacity-60"></div>
                                        <div class="w-full border-b border-dashed border-[var(--border)] opacity-60"></div>
                                        <div class="w-full border-b border-dashed border-[var(--border)] opacity-60"></div>
                                        <div class="w-full border-b border-[var(--border)]"></div>
                                    </div>

                                    <!-- Bars Row -->
                                    <div class="relative z-10 flex-1 flex items-end justify-between gap-1 sm:gap-2 pb-0">
                                        {#if revenueData.length === 0}
                                            <div class="w-full h-full flex items-center justify-center text-xs text-[var(--text-3)]">
                                                Tidak ada data grafik untuk periode ini.
                                            </div>
                                        {:else}
                                            {#each revenueData as item, idx}
                                                {@const isPeak = peakRevenueItem && peakRevenueItem.amount > 0 && item.amount === peakRevenueItem.amount}
                                                {@const heightPct = chartCeiling > 0 ? Math.min(100, Math.round((item.amount / chartCeiling) * 100)) : 0}
                                                {@const isHovered = hoveredGraphIndex === idx}

                                                <div
                                                    class="flex-1 flex flex-col items-center justify-end h-full relative group cursor-pointer"
                                                    on:mouseenter={() => hoveredGraphIndex = idx}
                                                    on:mouseleave={() => hoveredGraphIndex = null}
                                                    on:focus={() => hoveredGraphIndex = idx}
                                                    on:blur={() => hoveredGraphIndex = null}
                                                    tabindex="0"
                                                    role="button"
                                                    aria-label="{item.date}: {formatCurrency(item.amount)}"
                                                >
                                                    <!-- Hover / Focus Tooltip (Smart Centered Floating Popover) -->
                                                    {#if isHovered}
                                                        <div class="absolute bottom-[calc(100%+8px)] z-30 flex flex-col items-center pointer-events-none animate-in fade-in zoom-in-95 duration-150">
                                                            <div class="px-3 py-2 bg-slate-900 dark:bg-slate-800 text-white rounded-xl shadow-xl border border-slate-700/80 whitespace-nowrap text-left text-[11px] leading-tight space-y-1">
                                                                <div class="flex items-center justify-between gap-3 text-slate-300 text-[10px] font-semibold">
                                                                    <span>{item.date}</span>
                                                                    {#if isPeak}
                                                                        <span class="text-amber-400 font-bold text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20">TERTINGGI</span>
                                                                    {/if}
                                                                </div>
                                                                <div class="font-black text-sm text-emerald-400">
                                                                    {formatCurrency(item.amount)}
                                                                </div>
                                                                <div class="text-[9px] text-slate-400">
                                                                    {totalRevenueSum > 0 ? Math.round((item.amount / totalRevenueSum) * 100) : 0}% dari total omset periode
                                                                </div>
                                                            </div>
                                                            <!-- Tooltip Triangle Arrow -->
                                                            <div class="w-2 h-2 bg-slate-900 dark:bg-slate-800 rotate-45 border-r border-b border-slate-700/80 -mt-1"></div>
                                                        </div>
                                                    {/if}

                                                    <!-- Hover Column Track Highlight -->
                                                    <div class="absolute inset-x-0 inset-y-0 rounded-lg transition-colors {isHovered ? 'bg-blue-500/10 dark:bg-blue-400/10' : 'bg-transparent'}"></div>

                                                    <!-- Peak Badge / Sparkle on top of peak bar -->
                                                    {#if isPeak && heightPct > 15}
                                                        <div class="absolute text-[9px] font-extrabold text-amber-500 dark:text-amber-400 transition-transform group-hover:scale-110 pointer-events-none" style="bottom: calc({heightPct}% + 4px);">
                                                            ★
                                                        </div>
                                                    {/if}

                                                    <!-- The Bar / Indicator -->
                                                    {#if item.amount === 0}
                                                        <!-- Zero Amount Baseline Indicator (Clean pill, NOT a misleading colored tall bar) -->
                                                        <div class="w-full max-w-[28px] h-[3px] rounded-full bg-[var(--border)] dark:bg-slate-700/60 mb-0 transition-all {isHovered ? 'bg-blue-400 dark:bg-blue-500 scale-x-125' : ''}"></div>
                                                    {:else}
                                                        <!-- Real Revenue Bar with Height Proportional to Y-Scale -->
                                                        <div class="w-full max-w-[32px] sm:max-w-[40px] flex items-end justify-center h-full relative z-10">
                                                            <div
                                                                class="w-full rounded-t-md sm:rounded-t-lg transition-all duration-300 {isPeak ? 'bg-gradient-to-t from-blue-600 via-indigo-600 to-amber-500 shadow-md shadow-blue-500/20' : 'bg-gradient-to-t from-blue-600 to-indigo-500 dark:from-blue-500 dark:to-cyan-400'} {isHovered ? 'brightness-125 scale-y-[1.02] shadow-lg shadow-blue-500/30' : 'hover:brightness-110'}"
                                                                style="height: {Math.max(4, heightPct)}%;"
                                                            ></div>
                                                        </div>
                                                    {/if}
                                                </div>
                                            {/each}
                                        {/if}
                                    </div>

                                    <!-- X-Axis Labels Row -->
                                    <div class="h-6 flex items-center justify-between gap-1 sm:gap-2 pt-2 border-t border-[var(--border)]">
                                        {#each revenueData as item, idx}
                                            {@const showLabel = revenueData.length <= 12 || idx === 0 || idx === revenueData.length - 1 || idx % Math.ceil(revenueData.length / 6) === 0}
                                            <div class="flex-1 text-center min-w-0">
                                                {#if showLabel}
                                                    <span class="text-[10px] font-medium text-[var(--text-3)] block truncate {hoveredGraphIndex === idx ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}">
                                                        {item.date}
                                                    </span>
                                                {:else}
                                                    <span class="w-1 h-1 rounded-full bg-[var(--border)] mx-auto block"></span>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Top 5 Products (1 Col) -->
                <div class="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs flex flex-col justify-between">
                    <div>
                        <div class="flex items-center justify-between mb-4">
                            <div>
                                <h2 class="text-base font-bold text-[var(--text)]">Produk Terlaris</h2>
                                <p class="text-xs text-[var(--text-3)] mt-0.5">Peringkat penjualan bulan ini</p>
                            </div>
                            <a href="#/admin/products" class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1">
                                <span>Katalog</span>
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </a>
                        </div>

                        <div class="space-y-3">
                            {#if dashboardData.topProducts.length === 0}
                                <div class="p-6 text-center text-xs text-[var(--text-3)] bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                                    Belum ada data penjualan produk bulan ini.
                                </div>
                            {:else}
                                {#each dashboardData.topProducts as prod, idx}
                                    {@const progressPct = maxProductCount > 0 ? Math.round((prod.count / maxProductCount) * 100) : 0}
                                    <div class="p-2.5 sm:p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] transition-all hover:border-blue-500/40 space-y-2">
                                        <div class="flex items-center justify-between gap-2.5">
                                            <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                                <!-- Rank Badge -->
                                                <div class="w-6 h-6 rounded-lg text-[11px] font-extrabold flex items-center justify-center flex-shrink-0 {idx === 0 ? 'bg-amber-500/15 dark:bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/30' : idx === 1 ? 'bg-slate-200 dark:bg-slate-700/60 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600' : idx === 2 ? 'bg-orange-500/15 dark:bg-orange-500/25 text-orange-600 dark:text-orange-400 border border-orange-500/30' : 'bg-[var(--surface)] text-[var(--text-2)] border border-[var(--border)]'}">
                                                    #{idx + 1}
                                                </div>

                                                <!-- Product Thumbnail / Icon -->
                                                {#if prod.image && !imgErrorMap[`top_${prod.name}`]}
                                                    <img
                                                        src={prod.image}
                                                        alt={prod.name}
                                                        class="w-8 h-8 rounded-lg object-cover bg-[var(--surface)] border border-[var(--border)] flex-shrink-0"
                                                        on:error={() => imgErrorMap[`top_${prod.name}`] = true}
                                                    />
                                                {:else}
                                                    <div class="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 text-blue-500 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                                        </svg>
                                                    </div>
                                                {/if}

                                                <div class="min-w-0 flex-1">
                                                    <h3 class="text-xs font-bold text-[var(--text)] truncate">{prod.name}</h3>
                                                    {#if prod.price > 0}
                                                        <p class="text-[11px] text-[var(--text-3)] font-medium truncate">{formatCurrency(prod.price)} / lisensi</p>
                                                    {/if}
                                                </div>
                                            </div>

                                            <div class="text-right flex-shrink-0">
                                                <span class="inline-flex items-center px-2.5 py-0.5 rounded-lg text-[11px] font-extrabold bg-blue-50 dark:bg-blue-950/50 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/60 whitespace-nowrap shadow-2xs">
                                                    {prod.count} Order
                                                </span>
                                            </div>
                                        </div>

                                        <!-- Progress Bar -->
                                        <div class="w-full bg-[var(--surface)] h-1.5 rounded-full overflow-hidden">
                                            <div class="bg-blue-600 dark:bg-blue-500 h-full rounded-full transition-all duration-500" style="width: {progressPct}%;"></div>
                                        </div>
                                    </div>
                                {/each}
                            {/if}
                        </div>
                    </div>
                </div>
            </div>

            <!-- 5. Expiring Licenses Watchlist & Top Affiliates Leaderboard (2 Columns) -->
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                <!-- Expiring Licenses Watchlist -->
                <div class="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="text-base font-bold text-[var(--text)]">Lisensi Segera Habis</h2>
                                <span class="px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-500 text-[10px] font-bold">7 Hari Ke Depan</span>
                            </div>
                            <p class="text-xs text-[var(--text-3)] mt-0.5">Daftar pelanggan untuk follow up perpanjangan lisensi</p>
                        </div>
                        <a href="#/admin/users" class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Lihat Pengguna</a>
                    </div>

                    <div class="space-y-2.5">
                        {#if !dashboardData.expiringLicenses || dashboardData.expiringLicenses.length === 0}
                            <div class="p-6 text-center text-xs text-[var(--text-3)] bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                                Tidak ada lisensi yang akan kedaluwarsa dalam 7 hari ke depan.
                            </div>
                        {:else}
                            {#each dashboardData.expiringLicenses as lic}
                                <div class="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-3 text-xs">
                                    <div class="min-w-0 flex-1">
                                        <div class="flex items-center gap-2">
                                            <span class="font-bold text-[var(--text)] truncate">{lic.product}</span>
                                            <span class="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)]">{lic.token.substring(0, 10)}...</span>
                                        </div>
                                        <div class="text-[11px] text-[var(--text-3)] truncate mt-0.5">User: {lic.user} • Habis: {lic.expiresAt}</div>
                                    </div>
                                    <div class="flex items-center gap-1.5 shrink-0">
                                        <span class="px-2 py-1 rounded-lg text-[11px] font-bold {lic.daysLeft === 0 ? 'bg-red-500/15 text-red-500 border border-red-500/30' : lic.daysLeft === 1 ? 'bg-rose-500/15 text-rose-500 border border-rose-500/30' : lic.daysLeft <= 3 ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30' : 'bg-blue-500/15 text-blue-500 border border-blue-500/30'}">
                                            {lic.daysLeft === 0 ? 'Hari Ini' : lic.daysLeft === 1 ? 'Besok' : `${lic.daysLeft} Hari Lagi`}
                                        </span>
                                        {#if lic.whatsapp}
                                            <a
                                                href="https://wa.me/{lic.whatsapp.replace(/[^0-9]/g, '')}?text={encodeURIComponent(`Halo Kak ${lic.user.split(' ')[0] || ''}, kami dari Ziqva Labs menginfokan bahwa lisensi ${lic.product} Anda akan berakhir pada ${lic.expiresAt}. Segera lakukan perpanjangan lisensi agar operasional tetap lancar. Terima kasih!`)}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 transition-colors"
                                                title="Hubungi via WhatsApp ({lic.whatsapp})"
                                            >
                                                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/></svg>
                                            </a>
                                        {/if}
                                        <button
                                            type="button"
                                            on:click={() => copyToClipboard(lic.token, 'Token Lisensi')}
                                            class="p-1.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--border)] text-[var(--text-2)] transition-colors cursor-pointer"
                                            title="Salin Token"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>
                                        </button>
                                    </div>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>

                <!-- Top Affiliates Leaderboard -->
                <div class="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                    <div class="flex items-center justify-between">
                        <div>
                            <div class="flex items-center gap-2">
                                <h2 class="text-base font-bold text-[var(--text)]">Top Mitra Afiliasi</h2>
                                <span class="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 text-[10px] font-bold">Bulan Ini</span>
                            </div>
                            <p class="text-xs text-[var(--text-3)] mt-0.5">Peringkat perolehan komisi mitra afiliasi</p>
                        </div>
                        <a href="#/admin/affiliate" class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">Kelola Payout</a>
                    </div>

                    <div class="space-y-2.5">
                        {#if !dashboardData.topAffiliates || dashboardData.topAffiliates.length === 0}
                            <div class="p-6 text-center text-xs text-[var(--text-3)] bg-[var(--surface-2)] rounded-xl border border-[var(--border)]">
                                Belum ada komisi afiliasi tercatat bulan ini.
                            </div>
                        {:else}
                            {#each dashboardData.topAffiliates as aff, idx}
                                <div class="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-3 text-xs">
                                    <div class="flex items-center gap-2.5 min-w-0 flex-1">
                                        <div class="w-6 h-6 rounded-lg text-[11px] font-extrabold flex items-center justify-center shrink-0 {idx === 0 ? 'bg-amber-500/20 text-amber-500' : 'bg-[var(--surface)] text-[var(--text-3)]'}">
                                            #{idx + 1}
                                        </div>
                                        <div class="min-w-0 flex-1">
                                            <div class="font-bold text-[var(--text)] truncate">{aff.email}</div>
                                            <div class="text-[11px] text-[var(--text-3)]">{aff.count} transaksi terkonversi</div>
                                        </div>
                                    </div>
                                    <div class="text-right shrink-0">
                                        <div class="font-black text-purple-600 dark:text-purple-400">{formatCurrency(aff.income)}</div>
                                    </div>
                                </div>
                            {/each}
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Recent Orders Interactive Section -->
            <div class="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div>
                        <h2 class="text-base font-bold text-[var(--text)]">Transaksi Terkini</h2>
                        <p class="text-xs text-[var(--text-3)] mt-0.5">5 pesanan pembayaran lunas terakhir • Klik untuk melihat detail transaksi</p>
                    </div>
                    <a href="#/admin/payments" class="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:underline flex items-center gap-1">
                        <span>Lihat Semua Transaksi</span>
                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>

                <!-- Interactive Transaction Rows -->
                <div class="space-y-2.5">
                    {#if dashboardData.recentOrders.length === 0}
                        <div class="p-8 text-center text-xs text-[var(--text-3)] bg-[var(--surface-2)] rounded-2xl border border-[var(--border)]">
                            Belum ada riwayat transaksi lunas.
                        </div>
                    {:else}
                        {#each dashboardData.recentOrders as order}
                            <button
                                type="button"
                                on:click={() => openDetailModal(order.id)}
                                class="w-full text-left p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] hover:bg-[var(--surface)] border border-[var(--border)] hover:border-blue-500/40 transition-all duration-200 shadow-2xs hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 group cursor-pointer"
                            >
                                <div class="flex items-center gap-3 min-w-0 flex-1">
                                    <!-- Order ID Badge -->
                                    <div class="px-2.5 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-mono font-bold text-[var(--text)] flex-shrink-0 whitespace-nowrap shadow-2xs">
                                        #{order.id}
                                    </div>

                                    <!-- Product Thumbnail -->
                                    {#if isValidImg(order.productImage) && !imgErrorMap[`order_${order.id}`]}
                                        <img
                                            src={order.productImage}
                                            alt={order.productName}
                                            class="w-10 h-10 rounded-xl object-cover bg-[var(--surface)] border border-[var(--border)] flex-shrink-0"
                                            on:error={() => imgErrorMap[`order_${order.id}`] = true}
                                        />
                                    {:else}
                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 text-blue-500 dark:text-blue-400 border border-blue-500/30 flex items-center justify-center flex-shrink-0">
                                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                    {/if}

                                    <div class="min-w-0 flex-1">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <span class="text-xs sm:text-sm font-bold text-[var(--text)] truncate">{order.productName}</span>
                                            {#if order.durationDisplay && order.durationDisplay !== '-'}
                                                <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/50 text-blue-600 dark:text-blue-400 whitespace-nowrap">
                                                    {order.durationDisplay}
                                                </span>
                                            {/if}
                                        </div>
                                        <div class="flex items-center gap-2 text-[11px] text-[var(--text-3)] mt-0.5 truncate">
                                            <span class="font-semibold text-[var(--text-2)]">{order.user}</span>
                                            {#if order.email}
                                                <span>•</span>
                                                <span class="font-mono text-[var(--text-3)]">{order.email}</span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>

                                <div class="flex items-center justify-between md:justify-end gap-3 flex-shrink-0 border-t md:border-t-0 border-[var(--border)] pt-2 md:pt-0">
                                    <div class="text-left md:text-right">
                                        {#if order.totalAmount === 0}
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                GRATIS (Rp 0)
                                            </span>
                                        {:else}
                                            <div class="text-xs sm:text-sm font-extrabold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                                {formatCurrency(order.totalAmount)}
                                            </div>
                                        {/if}
                                        <div class="text-[10px] text-[var(--text-3)] font-medium mt-0.5 whitespace-nowrap">
                                            {order.createdAt}
                                        </div>
                                    </div>

                                    <div class="flex items-center gap-2 flex-shrink-0">
                                        <span class="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-[var(--surface)] border border-[var(--border)] text-[var(--text-2)] whitespace-nowrap">
                                            {order.channelCode || 'Xendit'}
                                        </span>
                                        <span class="inline-flex items-center px-2 py-1 rounded-lg text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 dark:border-emerald-500/40 whitespace-nowrap">
                                            LUNAS
                                        </span>
                                        <div class="w-7 h-7 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-3)] group-hover:text-blue-600 dark:group-hover:text-blue-400 group-hover:border-blue-500/50 transition-colors flex-shrink-0">
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>
                            </button>
                        {/each}
                    {/if}
                </div>
            </div>
        {/if}
    </main>

    <!-- Modal Detail Pembayaran Interaktif -->
    {#if detailModalOpen}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/70 backdrop-blur-xs" role="dialog" aria-modal="true" on:click|self={closeDetailModal}>
            <div class="w-full max-w-2xl max-h-[92vh] overflow-hidden rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl flex flex-col p-4 sm:p-6 space-y-4">
                <!-- Header -->
                <div class="flex items-center justify-between pb-3 border-b border-[var(--border)] flex-shrink-0 gap-2">
                    <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div class="px-2.5 py-1.5 sm:px-3 sm:py-2 min-w-[3.2rem] rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm font-mono font-extrabold text-blue-600 dark:text-blue-400 flex items-center justify-center shadow-xs flex-shrink-0 whitespace-nowrap">
                            #{detailData?.order.id || '...'}
                        </div>
                        <div class="min-w-0">
                            <h3 class="font-extrabold text-[var(--text)] text-sm sm:text-base truncate whitespace-nowrap">
                                Detail Transaksi Pembayaran
                            </h3>
                            <div class="flex items-center gap-2 mt-0.5 flex-wrap">
                                {#if detailData}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold {detailData.order.isPaid ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'} whitespace-nowrap">
                                        ● {detailData.order.isPaid ? 'Lunas' : 'Menunggu Pembayaran'}
                                    </span>
                                    <span class="text-[10px] text-[var(--text-3)] font-medium whitespace-nowrap">{detailData.order.createdAt}</span>
                                {/if}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer flex-shrink-0"
                        on:click={closeDetailModal}
                        aria-label="Tutup"
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Modal Body -->
                <div class="space-y-4 overflow-y-auto pr-1 flex-1 text-xs">
                    {#if loadingDetail}
                        <div class="py-12 text-center text-[var(--text-3)] space-y-2">
                            <div class="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                            <p class="font-medium text-xs">Memuat detail transaksi...</p>
                        </div>
                    {:else if detailError}
                        <div class="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-center space-y-2">
                            <p class="font-semibold">{detailError}</p>
                            <button
                                type="button"
                                on:click={() => detailData?.order.id && openDetailModal(detailData.order.id)}
                                class="px-3 py-1.5 bg-[var(--surface)] hover:bg-[var(--surface-2)] rounded-lg font-bold text-xs"
                            >
                                Coba Lagi
                            </button>
                        </div>
                    {:else if detailData}
                        <!-- Section 1: Customer Information -->
                        <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2.5">
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block whitespace-nowrap">Informasi Pelanggan</span>
                                {#if detailData.customer.verified}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 whitespace-nowrap">
                                        ✓ Terverifikasi
                                    </span>
                                {/if}
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <div>
                                    <span class="text-[10px] text-[var(--text-3)] block font-medium">Nama Pelanggan:</span>
                                    <span class="font-bold text-[var(--text)] truncate block">{detailData.customer.name}</span>
                                </div>
                                <div>
                                    <span class="text-[10px] text-[var(--text-3)] block font-medium">Email Akun:</span>
                                    <div class="flex items-center gap-1.5">
                                        <span class="font-mono font-semibold text-[var(--text-2)] truncate">{detailData.customer.email}</span>
                                        <button
                                            type="button"
                                            on:click={() => copyToClipboard(detailData?.customer.email || '', 'Email Pelanggan')}
                                            class="text-[var(--text-3)] hover:text-blue-600 dark:hover:text-blue-400 p-0.5 cursor-pointer flex-shrink-0"
                                            title="Salin Email"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Section 2: Payment Gateway & Channel Details -->
                        <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                            <div class="flex items-center justify-between">
                                <span class="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block whitespace-nowrap">Rincian Pembayaran & Gateway</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--surface)] text-[var(--text-2)] border border-[var(--border)] whitespace-nowrap">
                                    {detailData.order.channelCode}
                                </span>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div class="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                                    <span class="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block whitespace-nowrap">Total Tagihan</span>
                                    <div class="font-extrabold text-base sm:text-lg text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                                        {formatCurrency(detailData.order.totalAmount)}
                                    </div>
                                </div>

                                <div class="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-1">
                                    <span class="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block whitespace-nowrap">Status Pembayaran</span>
                                    <div class="font-bold text-sm text-[var(--text)] whitespace-nowrap">
                                        {detailData.order.isPaid ? 'LUNAS (Terbayar)' : 'MENUNGGU PEMBAYARAN'}
                                    </div>
                                </div>

                                {#if detailData.order.vaNumber}
                                    <div class="sm:col-span-2 flex items-center justify-between gap-2 p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                                        <div class="min-w-0">
                                            <span class="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block whitespace-nowrap">Nomor Virtual Account</span>
                                            <span class="font-mono font-extrabold text-xs sm:text-sm text-blue-600 dark:text-blue-400 whitespace-nowrap">{detailData.order.vaNumber}</span>
                                        </div>
                                        <button
                                            type="button"
                                            on:click={() => copyToClipboard(detailData?.order.vaNumber || '', `No. VA ${detailData?.order.vaNumber}`)}
                                            class="px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--text)] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap flex-shrink-0"
                                        >
                                            <svg class="w-3 h-3 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            <span>Salin VA</span>
                                        </button>
                                    </div>
                                {/if}
                            </div>
                        </div>

                        <!-- Section 3: Items & License Tokens -->
                        <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                            <span class="text-[10px] font-bold text-[var(--text-3)] uppercase tracking-wider block whitespace-nowrap">Rincian Produk & Lisensi</span>
                            
                            <div class="space-y-2.5">
                                {#each detailData.items as it}
                                    <div class="p-3 sm:p-3.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs gap-3">
                                        <div class="flex items-center gap-3 min-w-0 flex-1">
                                            {#if it.image && !imgErrorMap['item_' + it.name]}
                                                <img
                                                    src={it.image}
                                                    alt={it.name}
                                                    class="w-10 h-10 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0 shadow-xs"
                                                    on:error={() => imgErrorMap['item_' + it.name] = true}
                                                />
                                            {:else}
                                                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 font-black text-sm flex items-center justify-center flex-shrink-0">
                                                    {it.name.charAt(0).toUpperCase()}
                                                </div>
                                            {/if}
                                            <div class="min-w-0 flex-1">
                                                <div class="font-bold text-sm text-[var(--text)] truncate">{it.name}</div>
                                                <div class="text-[11px] font-bold text-blue-600 dark:text-blue-400 mt-0.5 whitespace-nowrap">
                                                    Durasi: {it.durationText}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="text-right flex-shrink-0">
                                            <div class="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{formatCurrency(it.finalPrice)}</div>
                                            {#if it.discountPercent > 0}
                                                <div class="text-[10px] font-bold text-rose-500 whitespace-nowrap">Diskon {it.discountPercent}%</div>
                                            {/if}
                                        </div>
                                    </div>
                                {/each}
                            </div>

                            {#if detailData.tokens.length > 0}
                                <div class="space-y-2.5 pt-2 border-t border-[var(--border)]">
                                    <span class="text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider block whitespace-nowrap">Kunci Lisensi Token</span>
                                    {#each detailData.tokens as tok}
                                        <div class="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2 text-xs">
                                            <div class="flex items-center justify-between gap-2">
                                                <span class="font-mono font-bold text-xs text-blue-600 dark:text-blue-400 break-all">{tok.token}</span>
                                                <button
                                                    type="button"
                                                    on:click={() => copyToClipboard(tok.token, 'Token Lisensi')}
                                                    class="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)] transition-all cursor-pointer flex items-center gap-1 flex-shrink-0 whitespace-nowrap"
                                                >
                                                    <svg class="w-3 h-3 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    <span>Salin Token</span>
                                                </button>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                </div>

                <!-- Footer -->
                {#if detailData}
                    <div class="pt-3 border-t border-[var(--border)] flex items-center justify-between gap-2 flex-shrink-0">
                        <button
                            type="button"
                            on:click={() => openDurationModal({ id: detailData?.order.id || 0, productName: detailData?.items[0]?.name || 'Produk', durationMonths: detailData?.order.durationMonths || 1 })}
                            class="px-3 sm:px-4 py-2 rounded-xl text-xs font-bold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--border)] transition-all cursor-pointer inline-flex items-center gap-1.5 shadow-2xs whitespace-nowrap"
                        >
                            <svg class="w-3.5 h-3.5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                            </svg>
                            <span>Ubah Durasi</span>
                        </button>

                        <button
                            type="button"
                            on:click={closeDetailModal}
                            class="px-3.5 sm:px-4 py-2 rounded-xl text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--text)] transition-all cursor-pointer shadow-2xs whitespace-nowrap"
                        >
                            Tutup
                        </button>
                    </div>
                {/if}
            </div>
        </div>
    {/if}

    <!-- Modal Ubah Durasi Lisensi -->
    {#if durationModalOpen && editingPayment}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
            <div class="w-full max-w-md p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xl space-y-4">
                <div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
                    <h3 class="font-bold text-[var(--text)] text-sm">
                        Ubah Durasi Lisensi #{editingPayment.id}
                    </h3>
                    <button type="button" on:click={closeDurationModal} class="text-[var(--text-3)] hover:text-[var(--text)] text-sm">✕</button>
                </div>

                <div class="space-y-3 text-xs">
                    <p class="text-[var(--text-2)]">
                        Produk: <b class="text-[var(--text)]">{editingPayment.productName}</b>
                    </p>
                    <div>
                        <label for="durationInput" class="block font-semibold text-[var(--text-3)] mb-1">Durasi Baru (Bulan):</label>
                        <input
                            id="durationInput"
                            type="number"
                            min="1"
                            max="120"
                            bind:value={newDuration}
                            class="w-full px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-bold text-sm focus:outline-none focus:border-[var(--brand)]"
                        />
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                    <button
                        type="button"
                        on:click={closeDurationModal}
                        class="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)] cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        type="button"
                        on:click={executeUpdateDuration}
                        disabled={isUpdatingDuration}
                        class="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 border-0"
                    >
                        {isUpdatingDuration ? 'Menyimpan...' : 'Simpan Durasi'}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</AdminLayout>
