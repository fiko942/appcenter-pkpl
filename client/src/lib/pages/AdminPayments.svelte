<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import { fade } from 'svelte/transition';
    import AdminLayout from '../components/AdminLayout.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';

    interface PaymentItem {
        id: number;
        user: string;
        email: string;
        productName: string;
        productImage?: string | null;
        durationDisplay: string;
        durationMonths: number;
        totalAmount: number;
        adminFee: number;
        channelCode: string;
        status: string;
        paymentRequestId: string | null;
        vaNumber: string | null;
        paidAt: string | null;
        createdAt: string;
        expiresAt: string | null;
        licenseToken: string | null;
        invoiceToken?: string | null;
    }

    interface StatusCounts {
        all: number;
        pending: number;
        paid: number;
        expired: number;
    }

    interface PaymentsData {
        payments: PaymentItem[];
        totalPayments: number;
        page: number;
        totalPages: number;
        search: string;
        sort: string;
        order: string;
        status?: string;
        counts?: StatusCounts;
        availableProducts?: Array<{ id: number; name: string; image?: string | null }>;
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
            voucherDetail?: {
                code: string;
                decreaseValue: number;
                voucherType: string;
                displayDiscount?: string;
                affiliateEmail?: string;
                affiliateIncome?: number;
            } | null;
            note: string;
            confirmedBy: string;
            lastUpdated: string | null;
            createdAt: string;
            createdEpoch: number;
            expiresAt: string | null;
            paidAt: string | null;
            invoiceToken?: string | null;
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

    export let params: any = {};
    export let querystring: string = '';

    let paymentsData: PaymentsData | null = null;
    let loading: boolean = true;
    let error: string | null = null;
    let imgErrorMap: Record<number | string, boolean> = {};
    let successMessage: string = '';

    // Search and Pagination
    let searchInput: string = '';
    let searchDebounceTimer: any = null;
    let currentPage: number = 1;
    let pageSize: number = 10;
    let sortValue: string = 'created_desc';
    let currentSort: string = 'created';
    let currentOrder: string = 'desc';

    // Status Filter Tabs
    let statusFilter: string = 'all';
    let statusCounts: StatusCounts = { all: 0, pending: 0, paid: 0, expired: 0 };
    let lastSyncedQuery: string = '';

    $: filterTabs = [
        { id: 'all', label: 'Semua Transaksi', count: statusCounts.all, color: 'brand' as const },
        { id: 'pending', label: 'Pending / Verifikasi', count: statusCounts.pending, color: 'amber' as const },
        { id: 'paid', label: 'Lunas / Selesai', count: statusCounts.paid, color: 'emerald' as const },
        ...(statusCounts.expired > 0 ? [{ id: 'expired', label: 'Kadaluarsa', count: statusCounts.expired, color: 'rose' as const }] : [])
    ] as TabItem[];

    $: statusFilterOptions = [
        { value: 'all', label: `Semua Status (${statusCounts.all})` },
        { value: 'pending', label: `Pending (${statusCounts.pending})` },
        { value: 'paid', label: `Lunas (${statusCounts.paid})` },
        ...(statusCounts.expired > 0 ? [{ value: 'expired', label: `Kadaluarsa (${statusCounts.expired})` }] : [])
    ] as OptionItem[];

    // Reactively watch for querystring prop changes from svelte-spa-router
    $: if (querystring !== undefined && querystring !== lastSyncedQuery) {
        lastSyncedQuery = querystring;
        if (syncStatusFromUrl()) {
            currentPage = 1;
            loadPayments();
        }
    }

    // Product and Period filters
    let selectedProduct: string = 'all';
    let availableProducts: Array<{ id: number; name: string; image?: string | null }> = [];
    let periodPreset: 'all' | 'this_month' | 'last_month' | 'last_3_months' | 'last_1_year' | 'custom' = 'all';
    let customStartDate: string = '';
    let customEndDate: string = '';

    // Custom Themed Date Picker Popover State
    let showDatePickerPopover: boolean = false;
    let calViewYear: number = new Date().getFullYear();
    let calViewMonth: number = new Date().getMonth(); // 0-indexed
    let tempStartDate: string = '';
    let tempEndDate: string = '';
    let hoverDate: string = '';

    const indonesianMonthNames = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];
    const indonesianDayShortNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

    const periodPresets = [
        { id: 'all', label: 'Semua Waktu' },
        { id: 'this_month', label: 'Bulan Ini' },
        { id: 'last_month', label: 'Bulan Kemarin' },
        { id: 'last_3_months', label: '3 Bulan Terakhir' },
        { id: 'last_1_year', label: '1 Tahun Terakhir' }
    ];

    $: productSelectOptions = [
        { value: 'all', label: 'Semua Produk' },
        ...availableProducts.map(p => ({
            value: p.name,
            label: p.name
        }))
    ];

    $: periodSelectOptions = [
        { value: 'all', label: 'Semua Waktu' },
        { value: 'this_month', label: 'Bulan Ini' },
        { value: 'last_month', label: 'Bulan Kemarin' },
        { value: 'last_3_months', label: '3 Bulan Terakhir' },
        { value: 'last_1_year', label: '1 Tahun Terakhir' },
        {
            value: 'custom',
            label: periodPreset === 'custom' && customStartDate
                ? `${formatDateShort(customStartDate)} - ${formatDateShort(customEndDate)}`
                : 'Kustom Tanggal...'
        }
    ] as OptionItem[];

    $: hasActiveFilters = Boolean(
        (searchInput && searchInput.trim() !== '') ||
        selectedProduct !== 'all' ||
        periodPreset !== 'all' ||
        statusFilter !== 'all' ||
        sortValue !== 'created_desc' ||
        (periodPreset === 'custom' && (customStartDate || customEndDate))
    );

    const sortOptions: OptionItem[] = [
        { value: 'created_desc', label: 'Waktu Transaksi (Terbaru)' },
        { value: 'created_asc', label: 'Waktu Transaksi (Terlama)' },
        { value: 'amount_desc', label: 'Nominal Bayar (Tertinggi)' },
        { value: 'amount_asc', label: 'Nominal Bayar (Terendah)' },
        { value: 'paid_desc', label: 'Waktu Lunas (Terkini)' },
        { value: 'id_desc', label: 'Order ID (Terbesar)' },
        { value: 'id_asc', label: 'Order ID (Terkecil)' }
    ];

    const pageSizeOptions: OptionItem[] = [
        { value: 10, label: '10 / hal' },
        { value: 20, label: '20 / hal' },
        { value: 50, label: '50 / hal' },
        { value: 100, label: '100 / hal' }
    ];

    // Detail Modal state
    let detailModalOpen: boolean = false;
    let loadingDetail: boolean = false;
    let detailError: string = '';
    let detailData: PaymentDetailData | null = null;
    let detailActiveTab: 'order' | 'tokens' | 'customer' | 'technical' = 'order';

    // Detail Modal Sliding Pill Tab State
    let detailTabContainer: HTMLDivElement | null = null;
    let detailTabElements: Record<string, HTMLButtonElement | null> = {};
    let detailPillStyle = { left: 0, width: 0 };
    let detailPillInitialized = false;
    let detailResizeObserver: ResizeObserver | null = null;

    function syncDetailPill() {
        if (!detailTabContainer) return;
        const targetId = detailActiveTab || 'order';
        const activeEl = detailTabElements[targetId];
        if (activeEl && detailTabContainer) {
            const left = activeEl.offsetLeft;
            const width = activeEl.offsetWidth;
            if (width > 0 && (detailPillStyle.left !== left || detailPillStyle.width !== width)) {
                detailPillStyle = { left, width };
                detailPillInitialized = true;
            }
        }
    }

    function setDetailTab(tab: 'order' | 'tokens' | 'customer' | 'technical') {
        if (detailActiveTab === tab) return;
        detailActiveTab = tab;
        tick().then(() => {
            syncDetailPill();
        });
    }

    $: if (detailModalOpen && detailData) {
        tick().then(() => {
            syncDetailPill();
            requestAnimationFrame(() => {
                syncDetailPill();
                requestAnimationFrame(syncDetailPill);
            });
        });
    }

    $: if (detailTabContainer && typeof ResizeObserver !== 'undefined' && !detailResizeObserver) {
        detailResizeObserver = new ResizeObserver(() => {
            syncDetailPill();
        });
        detailResizeObserver.observe(detailTabContainer);
    }

    $: detailPillColorClass = {
        order: 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/30 border border-blue-400/30',
        tokens: 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/30 border border-emerald-400/30',
        customer: 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/30 border border-indigo-400/30',
        technical: 'bg-gradient-to-r from-purple-600 to-pink-600 shadow-md shadow-purple-500/30 border border-purple-400/30'
    }[detailActiveTab] || 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/30 border border-blue-400/30';

    // Modal state for Confirm Manual
    let confirmModalOpen: boolean = false;
    let confirmingPayment: { id: number; user: string; totalAmount: number } | null = null;
    let isConfirming: boolean = false;

    // Modal state for Edit Duration
    let durationModalOpen: boolean = false;
    let editingPayment: { id: number; productName: string; durationMonths: number } | null = null;
    let newDuration: number = 1;
    let isUpdatingDuration: boolean = false;

    // PDF / Invoice Document Viewer Modal state
    let pdfModalOpen: boolean = false;
    let pdfModalToken: string = '';
    let pdfModalOrderId: number | string = '';
    let pdfModalLoading: boolean = true;
    let pdfModalData: any = null;
    let pdfModalError: string = '';
    let pdfModalLang: 'id' | 'en' = 'id';
    let pdfModalCopiedToken: boolean = false;

    const invoiceLabels = {
        id: {
            title: 'Faktur Resmi Digital',
            receipt: 'TANDA TERIMA RESMI',
            unpaid: 'FAKTUR BELUM LUNAS',
            paidBadge: 'LUNAS',
            unpaidBadge: 'MENUNGGU PEMBAYARAN',
            billedTo: 'Ditagihkan Kepada (Pelanggan)',
            billingInfo: 'Informasi Tagihan & Tanggal',
            issueDate: 'Tanggal Terbit:',
            dueDate: 'Jatuh Tempo:',
            paymentTime: 'Waktu Pelunasan:',
            paymentStatus: 'Status Transaksi:',
            desc: 'Deskripsi Produk & Layanan',
            duration: 'Durasi Lisensi',
            unitPrice: 'Harga Satuan',
            subtotal: 'Subtotal Produk:',
            discount: 'Diskon Potongan:',
            adminFee: 'Biaya Penanganan (Admin):',
            uniqueCode: 'Kode Unik:',
            total: 'Total Tagihan:',
            licenseKey: 'Kunci Lisensi Produk / Kode Aktivasi',
            thankYouTitle: 'Terima kasih atas pesanan Anda!',
            thankYouDesc: 'Pembayaran telah kami terima. Lisensi Anda sudah aktif dan siap digunakan:',
            downloadInstaller: 'Unduh Installer',
            videoTutorial: 'Video Tutorial',
            actionRequired: 'Tindakan Diperlukan: Selesaikan pembayaran untuk mengaktifkan lisensi',
            payNow: 'Bayar Sekarang / Checkout',
            notes: 'Ini adalah faktur resmi yang dihasilkan sistem dari Ziqva Labs. Tidak diperlukan tanda tangan fisik.',
            defaultDesc: 'Aktivasi lisensi digital eksklusif resmi',
            verifiedSystem: 'Dokumen Digital Terverifikasi',
            copySuccess: 'Tersalin!',
            copyKey: 'Salin Lisensi'
        },
        en: {
            title: 'Official Digital Invoice',
            receipt: 'OFFICIAL RECEIPT',
            unpaid: 'UNPAID INVOICE',
            paidBadge: 'PAID',
            unpaidBadge: 'PENDING PAYMENT',
            billedTo: 'Billed To (Customer)',
            billingInfo: 'Billing Info & Dates',
            issueDate: 'Issue Date:',
            dueDate: 'Due Date:',
            paymentTime: 'Payment Time:',
            paymentStatus: 'Transaction Status:',
            desc: 'Product & Service Description',
            duration: 'License Duration',
            unitPrice: 'Unit Price',
            subtotal: 'Product Subtotal:',
            discount: 'Discount:',
            adminFee: 'Handling Fee (Admin):',
            uniqueCode: 'Unique Code:',
            total: 'Total Amount:',
            licenseKey: 'Product License Key / Activation Code',
            thankYouTitle: 'Thank you for your order!',
            thankYouDesc: 'Payment has been received. Your license is active and ready to use:',
            downloadInstaller: 'Download Installer',
            videoTutorial: 'Video Tutorial',
            actionRequired: 'Action Required: Complete payment to activate license',
            payNow: 'Pay Now / Checkout',
            notes: 'This is an official system-generated invoice from Ziqva Labs. No signature is required.',
            defaultDesc: 'Official exclusive digital license activation',
            verifiedSystem: 'Verified Digital Document',
            copySuccess: 'Copied!',
            copyKey: 'Copy License'
        }
    };

    $: curLabels = invoiceLabels[pdfModalLang] || invoiceLabels.id;

    $: pdfModalUrl = pdfModalToken
        ? `/api/v1/invoice/${encodeURIComponent(pdfModalToken)}/pdf?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
        : '';
    $: pdfDownloadUrl = pdfModalToken
        ? `/api/v1/invoice/${encodeURIComponent(pdfModalToken)}/download?tz=${encodeURIComponent(Intl.DateTimeFormat().resolvedOptions().timeZone)}`
        : '';

    async function openPdfModal(token: string | null | undefined, orderId?: number | string) {
        if (!token) return;
        pdfModalToken = token;
        pdfModalOrderId = orderId || '';
        pdfModalLoading = true;
        pdfModalError = '';
        pdfModalData = null;
        pdfModalLang = 'id';
        pdfModalCopiedToken = false;
        pdfModalOpen = true;

        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const res = await fetch(`/api/v1/invoice/${encodeURIComponent(token)}?tz=${encodeURIComponent(tz)}`);
            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data) {
                pdfModalData = json.data;
            } else {
                pdfModalError = json.message || 'Gagal memuat dokumen invoice.';
            }
        } catch (e: any) {
            console.error('Error fetching invoice preview:', e);
            pdfModalError = e?.message || 'Terjadi gangguan jaringan saat memuat invoice.';
        } finally {
            pdfModalLoading = false;
        }
    }

    function closePdfModal() {
        pdfModalOpen = false;
        pdfModalToken = '';
        pdfModalOrderId = '';
        pdfModalLoading = false;
        pdfModalData = null;
        pdfModalError = '';
        pdfModalCopiedToken = false;
    }

    function printInvoiceDocument() {
        window.print();
    }

    function copyPdfModalLicense() {
        if (!pdfModalData?.licenseToken) return;
        navigator.clipboard.writeText(pdfModalData.licenseToken);
        pdfModalCopiedToken = true;
        setTimeout(() => {
            pdfModalCopiedToken = false;
        }, 2500);
    }

    // Copied feedback toast
    let copiedText: string = '';
    let copyToastTimer: any = null;

    function syncStatusFromUrl(): boolean {
        const hash = window.location.hash || '';
        let qStr = '';
        const qIndex = hash.indexOf('?');
        if (qIndex !== -1) {
            qStr = hash.slice(qIndex + 1);
        } else if (querystring) {
            qStr = querystring;
        }

        if (qStr) {
            const urlParams = new URLSearchParams(qStr);
            const statusParam = urlParams.get('status');
            if (statusParam && ['all', 'pending', 'paid', 'expired'].includes(statusParam.toLowerCase())) {
                const targetStatus = statusParam.toLowerCase();
                if (statusFilter !== targetStatus) {
                    statusFilter = targetStatus;
                    return true;
                }
                return false;
            }
        }
        if (statusFilter !== 'all') {
            statusFilter = 'all';
            return true;
        }
        return false;
    }

    function handleHashChange() {
        if (syncStatusFromUrl()) {
            currentPage = 1;
            loadPayments();
        }
    }

    onMount(async () => {
        syncStatusFromUrl();
        await loadPayments();
        document.addEventListener('click', handleGlobalClick);
        window.addEventListener('hashchange', handleHashChange);
    });

    onDestroy(() => {
        if (copyToastTimer) clearTimeout(copyToastTimer);
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        if (detailResizeObserver) {
            detailResizeObserver.disconnect();
            detailResizeObserver = null;
        }
        document.removeEventListener('click', handleGlobalClick);
        window.removeEventListener('hashchange', handleHashChange);
    });

    function handleGlobalClick(e: MouseEvent) {
        const target = e.target as HTMLElement;
        if (showDatePickerPopover && !target.closest('.datepicker-popover-container') && !target.closest('.datepicker-trigger-btn') && !target.closest('.custom-select-root')) {
            showDatePickerPopover = false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            if (pdfModalOpen) closePdfModal();
            else if (showDatePickerPopover) showDatePickerPopover = false;
            else if (confirmModalOpen) closeConfirmModal();
            else if (durationModalOpen) closeDurationModal();
            else if (detailModalOpen) closeDetailModal();
        }
    }

    function isValidImg(url: string | null | undefined): boolean {
        if (!url || typeof url !== 'string') return false;
        const trimmed = url.trim();
        if (!trimmed) return false;
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/favicon') || trimmed.startsWith('data:image/');
    }

    function toYMD(d: Date): string {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function formatDateShort(ymd: string): string {
        if (!ymd) return '';
        const [y, m, d] = ymd.split('-');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        return `${parseInt(d)} ${months[parseInt(m) - 1]} ${y}`;
    }

    function generateCalendarDays(year: number, month: number) {
        const days = [];
        const firstDayIndex = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const prevMonthDays = new Date(year, month, 0).getDate();

        // Previous month padding
        for (let i = firstDayIndex - 1; i >= 0; i--) {
            const d = new Date(year, month - 1, prevMonthDays - i);
            days.push({
                date: d,
                ymd: toYMD(d),
                dayNum: prevMonthDays - i,
                isCurrentMonth: false
            });
        }
        // Current month
        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i);
            days.push({
                date: d,
                ymd: toYMD(d),
                dayNum: i,
                isCurrentMonth: true
            });
        }
        // Next month padding
        const remaining = 42 - days.length;
        for (let i = 1; i <= remaining; i++) {
            const d = new Date(year, month + 1, i);
            days.push({
                date: d,
                ymd: toYMD(d),
                dayNum: i,
                isCurrentMonth: false
            });
        }
        return days;
    }

    $: calendarDays = generateCalendarDays(calViewYear, calViewMonth);

    function toggleDatePickerPopover() {
        showDatePickerPopover = !showDatePickerPopover;
        if (showDatePickerPopover) {
            tempStartDate = customStartDate;
            tempEndDate = customEndDate;
            if (customStartDate) {
                const [y, m] = customStartDate.split('-').map(Number);
                calViewYear = y;
                calViewMonth = m - 1;
            } else {
                calViewYear = new Date().getFullYear();
                calViewMonth = new Date().getMonth();
            }
        }
    }

    function prevCalMonth() {
        if (calViewMonth === 0) {
            calViewMonth = 11;
            calViewYear -= 1;
        } else {
            calViewMonth -= 1;
        }
    }

    function nextCalMonth() {
        if (calViewMonth === 11) {
            calViewMonth = 0;
            calViewYear += 1;
        } else {
            calViewMonth += 1;
        }
    }

    function prevCalYear() {
        calViewYear -= 1;
    }

    function nextCalYear() {
        calViewYear += 1;
    }

    function handleCalendarDayClick(ymd: string) {
        if (!tempStartDate || (tempStartDate && tempEndDate)) {
            tempStartDate = ymd;
            tempEndDate = '';
        } else if (tempStartDate && !tempEndDate) {
            if (ymd >= tempStartDate) {
                tempEndDate = ymd;
            } else {
                tempEndDate = tempStartDate;
                tempStartDate = ymd;
            }
        }
    }

    function setQuickCalendarPreset(type: 'today' | 'yesterday' | '7days' | '30days' | 'this_month' | 'last_month') {
        const now = new Date();
        if (type === 'today') {
            tempStartDate = toYMD(now);
            tempEndDate = toYMD(now);
        } else if (type === 'yesterday') {
            const yest = new Date(now.getTime() - 86400 * 1000);
            tempStartDate = toYMD(yest);
            tempEndDate = toYMD(yest);
        } else if (type === '7days') {
            const startD = new Date(now.getTime() - (7 * 86400 * 1000));
            tempStartDate = toYMD(startD);
            tempEndDate = toYMD(now);
        } else if (type === '30days') {
            const startD = new Date(now.getTime() - (30 * 86400 * 1000));
            tempStartDate = toYMD(startD);
            tempEndDate = toYMD(now);
        } else if (type === 'this_month') {
            const startD = new Date(now.getFullYear(), now.getMonth(), 1);
            tempStartDate = toYMD(startD);
            tempEndDate = toYMD(now);
        } else if (type === 'last_month') {
            const startD = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            const endD = new Date(now.getFullYear(), now.getMonth(), 0);
            tempStartDate = toYMD(startD);
            tempEndDate = toYMD(endD);
        }
    }

    function applyCustomDateRange() {
        if (!tempStartDate) return;
        customStartDate = tempStartDate;
        customEndDate = tempEndDate || tempStartDate;
        periodPreset = 'custom';
        showDatePickerPopover = false;
        currentPage = 1;
        loadPayments();
    }

    function cancelCustomDateRange() {
        showDatePickerPopover = false;
    }

    function getPageNumbers(current: number, total: number): (number | string)[] {
        if (total <= 5) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        if (current <= 2) {
            return [1, 2, 3, '...', total];
        }
        if (current >= total - 1) {
            return [1, '...', total - 2, total - 1, total];
        }
        return [1, '...', current, '...', total];
    }

    async function loadPayments() {
        loading = true;
        error = '';
        try {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Jakarta';
            const query = new URLSearchParams({
                page: currentPage.toString(),
                limit: pageSize.toString(),
                search: searchInput.trim(),
                sort: currentSort,
                order: currentOrder,
                status: statusFilter,
                period: periodPreset,
                product: selectedProduct,
                timezone: tz
            });

            if (periodPreset === 'custom') {
                if (customStartDate) query.set('startDate', customStartDate);
                if (customEndDate) query.set('endDate', customEndDate);
            }

            const res = await fetch(`/admin/api/payments?${query.toString()}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/#/admin/login';
                return;
            }

            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data) {
                paymentsData = json.data;
                if (json.data.counts) {
                    statusCounts = json.data.counts;
                }
                if (json.data.availableProducts) {
                    availableProducts = json.data.availableProducts;
                }
            } else {
                error = json.message || 'Gagal memuat data pembayaran.';
            }
        } catch (err) {
            console.error('Load payments error:', err);
            error = 'Terjadi kesalahan jaringan saat memuat data.';
        } finally {
            loading = false;
        }
    }

    function handleLiveSearch() {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            currentPage = 1;
            loadPayments();
        }, 300);
    }

    function handleClearSearch() {
        searchInput = '';
        currentPage = 1;
        loadPayments();
    }

    function handleTabChange(tabId: string) {
        if (statusFilter === tabId) return;
        statusFilter = tabId;
        currentPage = 1;
        const targetHash = statusFilter !== 'all' ? `/admin/payments?status=${statusFilter}` : `/admin/payments`;
        window.location.hash = targetHash;
        loadPayments();
    }

    function handleSortChange(val: string | number) {
        sortValue = val.toString();
        if (sortValue === 'created_desc') { currentSort = 'created'; currentOrder = 'desc'; }
        else if (sortValue === 'created_asc') { currentSort = 'created'; currentOrder = 'asc'; }
        else if (sortValue === 'amount_desc') { currentSort = 'total_amount'; currentOrder = 'desc'; }
        else if (sortValue === 'amount_asc') { currentSort = 'total_amount'; currentOrder = 'asc'; }
        else if (sortValue === 'paid_desc') { currentSort = 'paid_at'; currentOrder = 'desc'; }
        else if (sortValue === 'id_desc') { currentSort = 'id'; currentOrder = 'desc'; }
        else if (sortValue === 'id_asc') { currentSort = 'id'; currentOrder = 'asc'; }
        currentPage = 1;
        loadPayments();
    }

    function handleProductChange(val: string | number) {
        selectedProduct = val.toString();
        currentPage = 1;
        loadPayments();
    }

    function handlePageSizeChange(val: string | number) {
        pageSize = Number(val);
        currentPage = 1;
        loadPayments();
    }

    function handlePeriodChange(preset: any) {
        if (preset === 'custom') {
            periodPreset = 'custom';
            setTimeout(() => {
                showDatePickerPopover = true;
                tempStartDate = customStartDate;
                tempEndDate = customEndDate;
            }, 10);
            return;
        }
        periodPreset = preset;
        customStartDate = '';
        customEndDate = '';
        showDatePickerPopover = false;
        currentPage = 1;
        loadPayments();
    }

    function handleResetAllFilters() {
        searchInput = '';
        selectedProduct = 'all';
        periodPreset = 'all';
        customStartDate = '';
        customEndDate = '';
        tempStartDate = '';
        tempEndDate = '';
        sortValue = 'created_desc';
        currentSort = 'created';
        currentOrder = 'desc';
        statusFilter = 'all';
        currentPage = 1;
        window.location.hash = '/admin/payments';
        loadPayments();
    }

    async function openDetailModal(orderId: number) {
        detailModalOpen = true;
        loadingDetail = true;
        detailError = '';
        detailData = null;
        detailActiveTab = 'order';
        try {
            const res = await fetch(`/admin/api/payments/detail/${orderId}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/#/admin/login';
                return;
            }

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
        detailActiveTab = 'order';
        if (detailResizeObserver) {
            detailResizeObserver.disconnect();
            detailResizeObserver = null;
        }
    }

    function handlePageChange(newPage: number) {
        if (newPage >= 1 && (!paymentsData || newPage <= paymentsData.totalPages)) {
            currentPage = newPage;
            loadPayments();
        }
    }

    function openConfirmModal(payment: { id: number; user: string; totalAmount: number }) {
        confirmingPayment = payment;
        confirmModalOpen = true;
    }

    function closeConfirmModal() {
        confirmModalOpen = false;
        confirmingPayment = null;
    }

    async function executeConfirmPayment() {
        if (!confirmingPayment) return;
        isConfirming = true;
        try {
            const res = await fetch(`/admin/api/payments/confirm/${confirmingPayment.id}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const json = await res.json();
            if (res.ok && (json.success || json.status === 'success')) {
                successMessage = `Pembayaran order #${confirmingPayment.id} berhasil dikonfirmasi lunas.`;
                closeConfirmModal();
                if (detailModalOpen && detailData?.order.id === confirmingPayment.id) {
                    await openDetailModal(confirmingPayment.id);
                }
                await loadPayments();
                setTimeout(() => { successMessage = ''; }, 4000);
            } else {
                alert(json.message || json.error || 'Gagal mengonfirmasi pembayaran');
            }
        } catch (err) {
            console.error('Confirm error:', err);
            alert('Kesalahan jaringan saat mengonfirmasi pembayaran.');
        } finally {
            isConfirming = false;
        }
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
                body: JSON.stringify({ duration: newDuration })
            });
            const json = await res.json();
            if (res.ok && (json.success || json.status === 'success')) {
                successMessage = `Durasi order #${editingPayment.id} berhasil diupdate menjadi ${newDuration} bulan.`;
                closeDurationModal();
                if (detailModalOpen && detailData?.order.id === editingPayment.id) {
                    await openDetailModal(editingPayment.id);
                }
                await loadPayments();
                setTimeout(() => { successMessage = ''; }, 4000);
            } else {
                alert(json.message || json.error || 'Gagal mengubah durasi');
            }
        } catch (err) {
            console.error('Update duration error:', err);
            alert('Kesalahan jaringan saat mengubah durasi.');
        } finally {
            isUpdatingDuration = false;
        }
    }

    function copyToClipboard(text: string, label: string = 'Teks') {
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            copiedText = label;
            if (copyToastTimer) clearTimeout(copyToastTimer);
            copyToastTimer = setTimeout(() => {
                copiedText = '';
            }, 2500);
        });
    }

    function formatCurrency(amount: number): string {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            maximumFractionDigits: 0
        }).format(amount || 0);
    }

    function isPaid(status: string | null | undefined, paidAt: string | null | undefined): boolean {
        if (paidAt) return true;
        if (!status) return false;
        const s = status.toLowerCase();
        return s.includes('complete') || s.includes('success') || s.includes('settled') || s.includes('lunas');
    }

    function formatWhatsApp(rawPhone: string | null): string | null {
        if (!rawPhone) return null;
        let clean = rawPhone.replace(/\D/g, '');
        if (clean.startsWith('0')) {
            clean = '62' + clean.slice(1);
        }
        return clean;
    }

    function getInitial(name: string): string {
        if (!name) return 'P';
        return name.charAt(0).toUpperCase();
    }

    function parseVoucherInfo(raw: string | null | undefined, detail?: any): { code: string; discountText?: string; affiliateEmail?: string } | null {
        if (detail && detail.code) {
            return {
                code: String(detail.code),
                discountText: detail.displayDiscount ? `Diskon ${detail.displayDiscount}` : undefined,
                affiliateEmail: detail.affiliateEmail
            };
        }
        if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
        const trimmed = raw.trim();
        if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
                const parsed = JSON.parse(trimmed);
                if (parsed && typeof parsed === 'object') {
                    const code = parsed.code || 'VOUCHER';
                    let discountText = '';
                    if (parsed.decrease_value) {
                        if (parsed.voucer_type === '%') {
                            discountText = `Diskon ${parsed.decrease_value}%`;
                        } else {
                            discountText = `Potongan ${formatCurrency(Number(parsed.decrease_value))}`;
                        }
                    }
                    return {
                        code: String(code),
                        discountText: discountText || undefined,
                        affiliateEmail: parsed.affiliate_email
                    };
                }
            } catch {
                // fallback
            }
        }
        return {
            code: trimmed
        };
    }
</script>

<svelte:window on:keydown={handleKeydown} />

<AdminLayout activePage="payments">
    <main class="page-body p-3 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-4 sm:space-y-6">
        <!-- Floating Copy Toast -->
        {#if copiedText}
            <div class="fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-2xl bg-slate-900 text-white text-xs font-semibold shadow-2xl border border-slate-700 flex items-center gap-2 animate-bounce">
                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{copiedText} berhasil disalin!</span>
            </div>
        {/if}

        <!-- Header Banner -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] uppercase tracking-wider">
                        MANAJEMEN TRANSAKSI
                    </span>
                    <span class="text-xs text-[var(--text-3)] font-medium">/</span>
                    <span class="text-xs text-[var(--brand)] font-medium">Billing & Verifikasi</span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">
                    Daftar Pembayaran
                </h1>
                <p class="text-xs sm:text-sm text-[var(--text-3)] mt-0.5">
                    Kelola seluruh transaksi masuk, audit lisensi produk, dan verifikasi konfirmasi manual.
                </p>
            </div>

            <div class="hidden lg:flex items-center gap-2.5">
                <button
                    type="button"
                    on:click={() => loadPayments()}
                    class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-all shadow-xs cursor-pointer"
                    title="Segarkan data"
                    disabled={loading}
                >
                    <svg class="w-4 h-4 text-[var(--text-3)] {loading ? 'animate-spin text-[var(--brand)]' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Segarkan</span>
                </button>
            </div>
        </div>

        {#if successMessage}
            <div class="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between gap-3 text-emerald-700 dark:text-emerald-300 text-sm">
                <div class="flex items-center gap-2.5">
                    <svg class="w-5 h-5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="font-medium">{successMessage}</span>
                </div>
                <button type="button" class="text-emerald-700 dark:text-emerald-300 hover:opacity-75" on:click={() => successMessage = ''}>✕</button>
            </div>
        {/if}

        {#if error}
            <div class="p-6 text-center text-rose-500 text-sm">
                <p>{error}</p>
                <button type="button" class="mt-2 text-xs font-bold underline" on:click={loadPayments}>Coba Lagi</button>
            </div>
        {/if}

        <!-- Main Card Section -->
        <div class="rounded-2xl bg-white dark:bg-[#111c35] border border-slate-200/80 dark:border-[#22314d] shadow-sm overflow-visible relative">
            <!-- Filter & Toolbar Area -->
            <div class="p-4 sm:p-5 border-b border-slate-200/80 dark:border-[#22314d] space-y-3.5">
                <!-- Desktop View (lg and above): SegmentedTabs on left, Sort Selector on right -->
                <div class="hidden lg:flex items-center justify-between gap-3">
                    <!-- Segmented Tabs -->
                    <div class="overflow-x-auto pb-1 lg:pb-0">
                        <SegmentedTabs
                            tabs={filterTabs}
                            bind:activeTab={statusFilter}
                            on:change={(e) => handleTabChange(e.detail)}
                            on:tabChange={(e) => handleTabChange(e.detail)}
                        />
                    </div>

                    <!-- Right Controls: Sort Selector -->
                    <div class="flex items-center gap-2.5 flex-shrink-0">
                        <div class="w-56">
                            <CustomSelect
                                options={sortOptions}
                                value={sortValue}
                                prefix="Urutan:"
                                on:change={(e) => handleSortChange(e.detail)}
                            />
                        </div>
                    </div>
                </div>

                <!-- Mobile & Tablet View (< lg): Filter Status Dropdown, Filter Produk Dropdown, and Refresh icon button side-by-side on the right -->
                <div class="flex lg:hidden items-center justify-end gap-2 w-full">
                    <!-- Filter Status Dropdown -->
                    <div class="w-auto max-w-[44%] min-w-[115px]">
                        <CustomSelect
                            options={statusFilterOptions}
                            value={statusFilter}
                            on:change={(e) => handleTabChange(String(e.detail))}
                            align="right"
                        />
                    </div>

                    <!-- Filter Produk Dropdown -->
                    <div class="w-auto max-w-[45%] min-w-[120px]">
                        <CustomSelect
                            options={productSelectOptions}
                            value={selectedProduct}
                            on:change={(e) => handleProductChange(e.detail)}
                            align="right"
                        />
                    </div>

                    <!-- Refresh Icon Button -->
                    <button
                        type="button"
                        on:click={() => loadPayments()}
                        class="inline-flex items-center justify-center p-2 rounded-xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--brand)]/60 transition-all shadow-xs active:scale-95 cursor-pointer flex-shrink-0"
                        title="Segarkan data"
                        aria-label="Segarkan data"
                        disabled={loading}
                    >
                        <svg class="w-4 h-4 {loading ? 'animate-spin text-[var(--brand)]' : 'text-[var(--text-3)]'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                    </button>
                </div>

                <!-- Row 2: Search & Filters Grid on Desktop / Integrated Search on Mobile -->
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-2.5 items-center">
                    <!-- Search Input with Live Spinner Indicator -->
                    <div class="col-span-1 lg:col-span-8 relative flex items-center">
                        <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                            type="text"
                            bind:value={searchInput}
                            on:input={handleLiveSearch}
                            placeholder="Cari Order ID, email, nama, lisensi..."
                            class="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        />
                        <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                            {#if loading && searchInput}
                                <div class="w-3.5 h-3.5 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
                            {/if}
                            {#if searchInput}
                                <button
                                    type="button"
                                    on:click={handleClearSearch}
                                    class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm cursor-pointer"
                                    aria-label="Bersihkan pencarian"
                                >
                                    ✕
                                </button>
                            {/if}
                        </div>
                    </div>

                    <!-- Desktop Only: Product Select in Grid -->
                    <div class="hidden lg:block lg:col-span-4">
                        <CustomSelect
                            options={productSelectOptions}
                            value={selectedProduct}
                            prefix="Produk:"
                            fullWidth={true}
                            on:change={(e) => handleProductChange(e.detail)}
                        />
                    </div>
                </div>

                <!-- Row 3 Desktop (lg and above): Horizontal Period Chips & Custom Calendar Popover Trigger -->
                <div class="hidden lg:flex items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-[#22314d] text-xs relative">
                    <!-- Smooth Horizontal Scroll Track for Presets -->
                    <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 flex-1 min-w-0 mr-1.5">
                        <span class="text-[var(--text-3)] font-bold text-[11px] uppercase tracking-wider mr-1 shrink-0 flex items-center gap-1">
                            <svg class="w-3 h-3 text-[var(--text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            Periode:
                        </span>

                        {#each periodPresets as p}
                            <button
                                type="button"
                                on:click={() => handlePeriodChange(p.id)}
                                class="px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border {periodPreset === p.id ? 'bg-[var(--brand)] text-white border-[var(--brand)] shadow-xs font-bold' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-3,var(--border))]'}"
                            >
                                {p.label}
                            </button>
                        {/each}

                        <!-- Custom Date Range Popover Button -->
                        <button
                            type="button"
                            on:click={toggleDatePickerPopover}
                            class="datepicker-trigger-btn px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer shrink-0 border flex items-center gap-1.5 {periodPreset === 'custom' ? 'bg-blue-600 text-white border-blue-600 font-bold shadow-xs' : 'bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] border-[var(--border)] hover:bg-[var(--surface-3,var(--border))]'}"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {#if periodPreset === 'custom' && customStartDate}
                                <span>{formatDateShort(customStartDate)} - {formatDateShort(customEndDate)}</span>
                            {:else}
                                <span>Kustom Tanggal</span>
                            {/if}
                            <svg class="w-3 h-3 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>
                    </div>

                    <!-- Reset Filter Pill on Desktop (Always Visible on the Right when filtered) -->
                    {#if hasActiveFilters}
                        <button
                            type="button"
                            on:click={handleResetAllFilters}
                            class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                            title="Reset seluruh filter pencarian dan tanggal"
                        >
                            ✕ <span>Reset</span>
                        </button>
                    {/if}
                </div>

                <!-- Row 3 Mobile & Tablet (< lg): Period Dropdown, Sort Dropdown & Reset Action -->
                <div class="flex lg:hidden items-center justify-between gap-2 pt-2 border-t border-slate-200/80 dark:border-[#22314d] text-xs relative">
                    <!-- Periode Dropdown on Mobile -->
                    <div class="flex-1 min-w-0">
                        <CustomSelect
                            options={periodSelectOptions}
                            value={periodPreset}
                            prefix="Periode:"
                            fullWidth={true}
                            align="left"
                            on:change={(e) => handlePeriodChange(e.detail)}
                        />
                    </div>

                    <!-- Sort Selector Dropdown on Mobile -->
                    <div class="flex-1 min-w-0">
                        <CustomSelect
                            options={sortOptions}
                            value={sortValue}
                            prefix="Urutan:"
                            fullWidth={true}
                            align="right"
                            on:change={(e) => handleSortChange(e.detail)}
                        />
                    </div>

                    <!-- Reset Filter Button on Mobile -->
                    {#if hasActiveFilters}
                        <button
                            type="button"
                            on:click={handleResetAllFilters}
                            class="shrink-0 inline-flex items-center justify-center p-2 rounded-xl text-xs font-bold bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all cursor-pointer"
                            title="Reset filter"
                            aria-label="Reset filter"
                        >
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    {/if}
                </div>

                    <!-- ================= CUSTOM THEMED DATE RANGE CALENDAR POPOVER ================= -->
                    {#if showDatePickerPopover}
                        <div
                            class="datepicker-popover-container absolute top-full right-0 mt-2 z-50 w-full sm:w-88 max-w-[calc(100vw-2rem)] rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-4 sm:p-5 space-y-3.5 animate-fade-in backdrop-blur-xl"
                            role="dialog"
                            aria-modal="true"
                        >
                            <!-- Month & Year Navigation Header with Fast Jump -->
                            <div class="flex items-center justify-between pb-2.5 border-b border-[var(--border)]">
                                <div class="flex items-center gap-1">
                                    <button
                                        type="button"
                                        on:click={prevCalYear}
                                        class="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer text-xs font-black"
                                        title="Tahun Sebelumnya"
                                        aria-label="Tahun sebelumnya"
                                    >
                                        «
                                    </button>
                                    <button
                                        type="button"
                                        on:click={prevCalMonth}
                                        class="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer"
                                        title="Bulan Sebelumnya"
                                        aria-label="Bulan sebelumnya"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                        </svg>
                                    </button>
                                </div>

                                <span class="text-xs sm:text-sm font-black text-[var(--text)]">
                                    {indonesianMonthNames[calViewMonth]} {calViewYear}
                                </span>

                                <div class="flex items-center gap-1">
                                    <button
                                        type="button"
                                        on:click={nextCalMonth}
                                        class="p-1.5 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer"
                                        title="Bulan Berikutnya"
                                        aria-label="Bulan berikutnya"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        on:click={nextCalYear}
                                        class="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors cursor-pointer text-xs font-black"
                                        title="Tahun Berikutnya"
                                        aria-label="Tahun berikutnya"
                                    >
                                        »
                                    </button>
                                </div>
                            </div>

                            <!-- Day Name Row -->
                            <div class="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-[var(--text-3)] uppercase">
                                {#each indonesianDayShortNames as dname}
                                    <div class="py-0.5">{dname}</div>
                                {/each}
                            </div>

                            <!-- Calendar Day Grid (Comfortable Touch Targets h-8/h-9) -->
                            <div class="grid grid-cols-7 gap-1 text-center text-xs">
                                {#each calendarDays as cday}
                                    {@const isStart = tempStartDate === cday.ymd}
                                    {@const isEnd = tempEndDate === cday.ymd}
                                    {@const inRange = Boolean(
                                        tempStartDate && tempEndDate && cday.ymd > tempStartDate && cday.ymd < tempEndDate ||
                                        tempStartDate && !tempEndDate && hoverDate && (
                                            hoverDate >= tempStartDate ? cday.ymd > tempStartDate && cday.ymd <= hoverDate : cday.ymd >= hoverDate && cday.ymd < tempStartDate
                                        )
                                    )}
                                    <button
                                        type="button"
                                        on:click={() => handleCalendarDayClick(cday.ymd)}
                                        on:mouseenter={() => hoverDate = cday.ymd}
                                        class="h-8 sm:h-9 w-full rounded-lg flex items-center justify-center font-medium transition-colors cursor-pointer text-xs {
                                            isStart || isEnd
                                                ? 'bg-blue-600 text-white font-bold shadow-xs'
                                                : inRange
                                                    ? 'bg-blue-500/20 text-blue-600 dark:text-blue-300 font-semibold'
                                                    : cday.isCurrentMonth
                                                        ? 'text-[var(--text)] hover:bg-[var(--surface-2)]'
                                                        : 'text-[var(--text-3)]/40 hover:bg-[var(--surface-2)]/40'
                                        }"
                                    >
                                        {cday.dayNum}
                                    </button>
                                {/each}
                            </div>

                            <!-- Selected Range Indicator -->
                            <div class="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[11px] text-[var(--text-2)] flex items-center justify-between">
                                <div>
                                    <span class="text-[var(--text-3)] font-medium">Rentang: </span>
                                    <span class="font-bold text-[var(--text)]">
                                        {tempStartDate ? formatDateShort(tempStartDate) : 'Pilih Awal'}
                                        -
                                        {tempEndDate ? formatDateShort(tempEndDate) : (tempStartDate ? 'Pilih Akhir' : '')}
                                    </span>
                                </div>
                            </div>

                            <!-- Quick Presets Inside Popover -->
                            <div class="flex items-center gap-1.5 flex-wrap text-[10px]">
                                <button
                                    type="button"
                                    on:click={() => setQuickCalendarPreset('today')}
                                    class="px-2 py-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer"
                                >
                                    Hari Ini
                                </button>
                                <button
                                    type="button"
                                    on:click={() => setQuickCalendarPreset('yesterday')}
                                    class="px-2 py-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer"
                                >
                                    Kemarin
                                </button>
                                <button
                                    type="button"
                                    on:click={() => setQuickCalendarPreset('7days')}
                                    class="px-2 py-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer"
                                >
                                    7 Hari
                                </button>
                                <button
                                    type="button"
                                    on:click={() => setQuickCalendarPreset('30days')}
                                    class="px-2 py-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer"
                                >
                                    30 Hari
                                </button>
                                <button
                                    type="button"
                                    on:click={() => setQuickCalendarPreset('this_month')}
                                    class="px-2 py-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer"
                                >
                                    Bulan Ini
                                </button>
                                <button
                                    type="button"
                                    on:click={() => setQuickCalendarPreset('last_month')}
                                    class="px-2 py-1 rounded-md bg-[var(--surface-2)] text-[var(--text-2)] hover:text-[var(--text)] border border-[var(--border)] cursor-pointer"
                                >
                                    Bulan Lalu
                                </button>
                            </div>

                            <!-- Action Buttons -->
                            <div class="flex items-center justify-end gap-2 pt-2.5 border-t border-[var(--border)]">
                                <button
                                    type="button"
                                    on:click={cancelCustomDateRange}
                                    class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    on:click={applyCustomDateRange}
                                    disabled={!tempStartDate}
                                    class="px-4 py-1.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors disabled:opacity-40 cursor-pointer border-0"
                                >
                                    Terapkan Rentang
                                </button>
                            </div>
                        </div>
                    {/if}
            </div>

            {#if loading && !paymentsData}
                <div class="p-16 text-center">
                    <div class="w-8 h-8 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
                    <p class="text-xs font-medium text-[var(--text-3)]">Memuat daftar pembayaran...</p>
                </div>
            {:else if !paymentsData || paymentsData.payments.length === 0}
                <div class="p-16 text-center">
                    <div class="w-12 h-12 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)] mx-auto mb-3 flex items-center justify-center">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                    </div>
                    <p class="text-sm font-bold text-[var(--text)]">
                        {#if statusFilter === 'pending'}
                            Tidak Ada Transaksi Pending
                        {:else if statusFilter === 'paid'}
                            Tidak Ada Transaksi Lunas
                        {:else if statusFilter === 'expired'}
                            Tidak Ada Transaksi Kadaluarsa
                        {:else}
                            Tidak Ada Data Pembayaran
                        {/if}
                    </p>
                    <p class="text-xs text-[var(--text-3)] mt-1 max-w-sm mx-auto">
                        {#if statusFilter === 'pending'}
                            Tidak ada antrean pesanan yang berstatus pending atau menunggu verifikasi manual saat ini.
                        {:else if hasActiveFilters}
                            Tidak ditemukan transaksi yang sesuai dengan filter atau rentang tanggal yang dipilih.
                        {:else}
                            Seluruh transaksi yang dipesan akan muncul di sini.
                        {/if}
                    </p>
                    {#if hasActiveFilters}
                        <button
                            type="button"
                            on:click={handleResetAllFilters}
                            class="mt-3 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[var(--surface-2)] hover:bg-[var(--border)] text-[var(--brand)] border border-[var(--border)] transition-all cursor-pointer"
                        >
                            Reset Filter & Muat Ulang
                        </button>
                    {/if}
                </div>
            {:else}
                <!-- Desktop Table (xl and up) -->
                <div class="hidden xl:block overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-[var(--surface-2)] text-[var(--text-3)] uppercase tracking-wider font-bold border-b border-[var(--border)] select-none">
                                <th class="py-3.5 px-4 w-32 whitespace-nowrap">Order ID</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Pelanggan</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Produk</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Total Bayar</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Status</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Lisensi Token</th>
                                <th class="py-3.5 px-4 text-right whitespace-nowrap">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)]">
                            {#each paymentsData.payments as p (p.id)}
                                {@const paid = isPaid(p.status, p.paidAt)}
                                <tr class="hover:bg-[var(--surface-2)]/40 transition-colors group">
                                    <!-- Order ID (Clickable to open Detail) -->
                                    <td class="py-3.5 px-4">
                                        <button
                                            type="button"
                                            on:click={() => openDetailModal(p.id)}
                                            class="font-mono font-bold text-[var(--brand)] hover:underline flex items-center gap-1 cursor-pointer"
                                            title="Klik untuk lihat detail transaksi"
                                        >
                                            <span>#{p.id}</span>
                                            <svg class="w-3 h-3 opacity-70 group-hover:opacity-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                            </svg>
                                        </button>
                                        <div class="text-[10px] text-[var(--text-3)] font-medium mt-0.5 truncate max-w-[120px]">
                                            {p.channelCode}
                                        </div>
                                    </td>

                                    <!-- User & Email with Copy on Hover -->
                                    <td class="py-3.5 px-4">
                                        <div class="font-bold text-[var(--text)] max-w-[180px] truncate" title={p.user}>
                                            {p.user}
                                        </div>
                                        {#if p.email}
                                            <div class="text-[11px] text-[var(--text-3)] max-w-[180px] truncate flex items-center gap-1" title={p.email}>
                                                <span class="truncate font-mono">{p.email}</span>
                                                <button
                                                    type="button"
                                                    on:click={() => copyToClipboard(p.email, 'Email')}
                                                    class="opacity-0 group-hover:opacity-100 hover:text-[var(--brand)] transition-opacity p-0.5 cursor-pointer"
                                                    title="Salin Email"
                                                >
                                                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        {/if}
                                    </td>

                                    <!-- Product -->
                                    <td class="py-3.5 px-4">
                                        <div class="flex items-center gap-2.5">
                                            {#if isValidImg(p.productImage) && !imgErrorMap[p.id]}
                                                <img
                                                    src={p.productImage}
                                                    alt={p.productName}
                                                    class="w-8 h-8 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0 shadow-xs"
                                                    on:error={() => imgErrorMap[p.id] = true}
                                                />
                                            {:else}
                                                <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 text-[var(--brand)] font-black text-xs flex items-center justify-center flex-shrink-0">
                                                    {p.productName.charAt(0).toUpperCase()}
                                                </div>
                                            {/if}
                                            <div class="min-w-0">
                                                <div class="font-semibold text-[var(--text)] max-w-[180px] truncate" title={p.productName}>
                                                    {p.productName}
                                                </div>
                                                <div class="text-[10px] text-[var(--brand)] font-semibold mt-0.5 whitespace-nowrap">
                                                    {p.durationDisplay || `${p.durationMonths} Bulan`}
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Total -->
                                    <td class="py-3.5 px-4">
                                        {#if p.totalAmount === 0}
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap">
                                                GRATIS (Rp 0)
                                            </span>
                                        {:else}
                                            <div class="font-extrabold text-[var(--text)] text-xs">{formatCurrency(p.totalAmount)}</div>
                                            {#if p.adminFee > 0}
                                                <div class="text-[10px] text-[var(--text-3)]">Fee: {formatCurrency(p.adminFee)}</div>
                                            {/if}
                                        {/if}
                                    </td>

                                    <!-- Status -->
                                    <td class="py-3.5 px-4">
                                        {#if paid}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20">
                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                                <span>Lunas</span>
                                            </span>
                                        {:else}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/15 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                                <span>Pending</span>
                                            </span>
                                        {/if}
                                        <div class="text-[10px] text-[var(--text-3)] mt-0.5">{p.createdAt}</div>
                                    </td>

                                    <!-- Token -->
                                    <td class="py-3.5 px-4">
                                        {#if p.licenseToken}
                                            <div class="flex items-center gap-1.5">
                                                <span class="font-mono text-[11px] bg-[var(--surface-2)] px-2 py-0.5 rounded-lg border border-[var(--border)] text-[var(--text)] font-bold">
                                                    {p.licenseToken.substring(0, 10)}...
                                                </span>
                                                <button
                                                    type="button"
                                                    on:click={() => copyToClipboard(p.licenseToken || '', 'Token Lisensi')}
                                                    class="p-1 rounded-lg hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--brand)] transition-colors cursor-pointer"
                                                    title="Salin Token Lisensi"
                                                >
                                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        {:else}
                                            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)]">
                                                Belum digenerate
                                            </span>
                                        {/if}
                                    </td>

                                    <!-- Actions with Tooltip Badges (Comfortable w-8 h-8 buttons) -->
                                    <td class="py-3.5 px-4 text-right">
                                        <div class="flex items-center justify-end gap-1.5">
                                            <!-- Action: PDF Invoice -->
                                            {#if p.invoiceToken}
                                                <div class="relative group/tip">
                                                    <button
                                                        type="button"
                                                        on:click={() => openPdfModal(p.invoiceToken, p.id)}
                                                        class="w-8 h-8 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:text-indigo-400 hover:border-indigo-500/40 hover:bg-indigo-500/10 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                                                        aria-label="Lihat Invoice PDF"
                                                    >
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                                        </svg>
                                                    </button>
                                                    <div class="absolute bottom-full right-0 mb-1.5 hidden group-hover/tip:flex flex-col items-center pointer-events-none z-30">
                                                        <span class="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[9px] font-semibold whitespace-nowrap shadow-lg border border-slate-700">
                                                            Lihat Invoice PDF
                                                        </span>
                                                        <div class="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                                                    </div>
                                                </div>
                                            {/if}

                                            <!-- Action: Detail (Eye) -->
                                            <div class="relative group/tip">
                                                <button
                                                    type="button"
                                                    on:click={() => openDetailModal(p.id)}
                                                    class="w-8 h-8 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:text-[var(--brand)] hover:border-[var(--brand)]/40 hover:bg-[var(--brand)]/10 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                                                    aria-label="Lihat Detail Pembayaran"
                                                >
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </button>
                                                <div class="absolute bottom-full right-0 mb-1.5 hidden group-hover/tip:flex flex-col items-center pointer-events-none z-30">
                                                    <span class="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[9px] font-semibold whitespace-nowrap shadow-lg border border-slate-700">
                                                        Lihat Detail
                                                    </span>
                                                    <div class="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                                                </div>
                                            </div>

                                            <!-- Action: Edit Duration (Pen) -->
                                            <div class="relative group/tip">
                                                <button
                                                    type="button"
                                                    on:click={() => openDurationModal(p)}
                                                    class="w-8 h-8 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:text-blue-400 hover:border-blue-500/40 hover:bg-blue-500/10 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                                                    aria-label="Edit Durasi Lisensi"
                                                >
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                                <div class="absolute bottom-full right-0 mb-1.5 hidden group-hover/tip:flex flex-col items-center pointer-events-none z-30">
                                                    <span class="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[9px] font-semibold whitespace-nowrap shadow-lg border border-slate-700">
                                                        Ubah Durasi
                                                    </span>
                                                    <div class="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                                                </div>
                                            </div>

                                            <!-- Action: Confirm Manual (Check) -->
                                            {#if !paid}
                                                <div class="relative group/tip">
                                                    <button
                                                        type="button"
                                                        on:click={() => openConfirmModal(p)}
                                                        class="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center cursor-pointer shadow-xs"
                                                        aria-label="Konfirmasi Lunas Manual"
                                                    >
                                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    </button>
                                                    <div class="absolute bottom-full right-0 mb-1.5 hidden group-hover/tip:flex flex-col items-center pointer-events-none z-30">
                                                        <span class="px-2 py-0.5 rounded-md bg-slate-900 text-white text-[9px] font-semibold whitespace-nowrap shadow-lg border border-slate-700">
                                                            Konfirmasi Lunas
                                                        </span>
                                                        <div class="w-1.5 h-1.5 bg-slate-900 rotate-45 -mt-1 border-r border-b border-slate-700"></div>
                                                    </div>
                                                </div>
                                            {/if}
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Mobile Card List View (< xl) - Clean Divided List Matching AdminUsers -->
                <div class="block xl:hidden divide-y divide-slate-200/80 dark:divide-[#22314d]">
                    {#each paymentsData.payments as p (p.id)}
                        {@const paid = isPaid(p.status, p.paidAt)}
                        <div class="p-4 space-y-3">
                            <!-- Card Header: Product Avatar + Product Name & Order ID + Status Pill -->
                            <div class="flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2.5 min-w-0">
                                    {#if isValidImg(p.productImage) && !imgErrorMap['m_' + p.id]}
                                        <img
                                            src={p.productImage}
                                            alt={p.productName}
                                            class="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-[#22314d] bg-slate-100 dark:bg-[#0b1324] shrink-0 shadow-xs"
                                            on:error={() => imgErrorMap['m_' + p.id] = true}
                                        />
                                    {:else}
                                        <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs shrink-0">
                                            {getInitial(p.productName)}
                                        </div>
                                    {/if}
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-1.5">
                                            <h4 class="font-bold text-slate-900 dark:text-white text-xs truncate max-w-[170px]" title={p.productName}>
                                                {p.productName}
                                            </h4>
                                            <button
                                                type="button"
                                                on:click={() => openDetailModal(p.id)}
                                                class="text-[11px] font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline shrink-0"
                                            >
                                                #{p.id}
                                            </button>
                                        </div>
                                        <p class="text-[10px] text-slate-400 font-mono truncate">
                                            {p.channelCode || 'Gateway'} • {p.createdAt}
                                        </p>
                                    </div>
                                </div>

                                <div class="shrink-0">
                                    {#if paid}
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 inline-flex items-center gap-1 border border-emerald-500/20">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span>Lunas</span>
                                        </span>
                                    {:else}
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 inline-flex items-center gap-1 border border-amber-500/20">
                                            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                            <span>Pending</span>
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Two-Column Information Box -->
                            <div class="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d]">
                                <div class="min-w-0">
                                    <span class="text-slate-400">Pelanggan:</span>
                                    <p class="font-bold text-slate-800 dark:text-slate-200 truncate">{p.user}</p>
                                    {#if p.email}
                                        <div class="flex items-center gap-1 text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                                            <span class="truncate">{p.email}</span>
                                            <button
                                                type="button"
                                                on:click={() => copyToClipboard(p.email, 'Email')}
                                                class="text-slate-400 hover:text-blue-500 cursor-pointer shrink-0"
                                                title="Salin Email"
                                            >
                                                <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    {/if}
                                </div>
                                <div>
                                    <span class="text-slate-400">Total & Durasi:</span>
                                    <p class="font-bold text-slate-800 dark:text-slate-200">
                                        {p.totalAmount === 0 ? 'GRATIS' : formatCurrency(p.totalAmount)}
                                    </p>
                                    <p class="text-[10px] font-semibold text-blue-600 dark:text-blue-400">
                                        {p.durationDisplay || `${p.durationMonths} Bulan`}
                                    </p>
                                </div>

                                {#if p.licenseToken}
                                    <div class="col-span-2 pt-1.5 border-t border-slate-200/60 dark:border-[#1e2a42] flex items-center justify-between">
                                        <span class="text-slate-400 text-[10px]">Token Lisensi:</span>
                                        <div class="flex items-center gap-1">
                                            <span class="font-mono text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-500/15 px-2 py-0.5 rounded border border-emerald-500/20">
                                                {p.licenseToken.substring(0, 14)}...
                                            </span>
                                            <button
                                                type="button"
                                                on:click={() => copyToClipboard(p.licenseToken || '', 'Token Lisensi')}
                                                class="p-0.5 text-slate-400 hover:text-emerald-500 transition-colors cursor-pointer"
                                                title="Salin Token Lisensi"
                                            >
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                {/if}
                            </div>

                            <!-- Mobile Footer & Action Buttons Pill Dock -->
                            <div class="flex items-center justify-between pt-1">
                                <span class="text-[10px] text-slate-400 font-mono">
                                    {#if p.adminFee > 0}Fee: {formatCurrency(p.adminFee)}{:else}#{p.id}{/if}
                                </span>
                                <div class="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0a1120] border border-slate-200/80 dark:border-[#1e2a42]">
                                    <button
                                        type="button"
                                        class="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-xs hover:bg-blue-700 transition-colors cursor-pointer"
                                        on:click={() => openDetailModal(p.id)}
                                    >
                                        Detail
                                    </button>

                                    {#if p.invoiceToken}
                                        <button
                                            type="button"
                                            class="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#15223e] transition-all cursor-pointer"
                                            on:click={() => openPdfModal(p.invoiceToken, p.id)}
                                            aria-label="Lihat Invoice PDF"
                                            title="Lihat Invoice PDF"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                            </svg>
                                        </button>
                                    {/if}

                                    <button
                                        type="button"
                                        class="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#15223e] transition-all cursor-pointer"
                                        on:click={() => openDurationModal(p)}
                                        aria-label="Ubah Durasi"
                                        title="Ubah Durasi"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>

                                    {#if !paid}
                                        <button
                                            type="button"
                                            class="p-1 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15 transition-all cursor-pointer"
                                            on:click={() => openConfirmModal(p)}
                                            aria-label="Konfirmasi Lunas"
                                            title="Konfirmasi Lunas"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                        </button>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}

            <!-- Numbered Pagination Bar with PageSize Selector -->
            {#if paymentsData}
                <div class="p-4 border-t border-slate-200/80 dark:border-[#22314d] flex flex-col sm:flex-row items-center justify-between gap-4 relative z-20">
                    <div class="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                        <p class="text-xs text-slate-500 dark:text-slate-400">
                            Menampilkan <span class="font-bold text-slate-700 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</span> - <span class="font-bold text-slate-700 dark:text-slate-200">{Math.min(currentPage * pageSize, paymentsData.totalPayments)}</span> dari <span class="font-bold text-slate-700 dark:text-slate-200">{paymentsData.totalPayments}</span> pembayaran
                        </p>
                        <div class="flex items-center gap-1.5">
                            <CustomSelect
                                options={pageSizeOptions}
                                value={pageSize}
                                on:change={(e) => handlePageSizeChange(e.detail)}
                            />
                        </div>
                    </div>

                    {#if paymentsData.totalPages > 1}
                        <div class="flex items-center gap-1.5">
                            <!-- Prev Button -->
                            <button
                                type="button"
                                class="p-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#22314d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a263e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                disabled={currentPage <= 1}
                                on:click={() => handlePageChange(currentPage - 1)}
                                aria-label="Halaman sebelumnya"
                            >
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            <!-- Number Pills -->
                            {#each getPageNumbers(currentPage, paymentsData.totalPages) as pNum}
                                {#if pNum === '...'}
                                    <span class="px-2 text-xs text-slate-400 select-none">...</span>
                                {:else}
                                    <button
                                        type="button"
                                        class="w-8 h-8 rounded-xl text-xs font-bold transition-all duration-150 {currentPage === Number(pNum) ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a263e] border border-slate-200 dark:border-[#22314d]'} cursor-pointer"
                                        on:click={() => handlePageChange(Number(pNum))}
                                    >
                                        {pNum}
                                    </button>
                                {/if}
                            {/each}

                            <!-- Next Button -->
                            <button
                                type="button"
                                class="p-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#22314d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a263e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                disabled={currentPage >= paymentsData.totalPages}
                                on:click={() => handlePageChange(currentPage + 1)}
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
        </div>
    </main>
</AdminLayout>

<!-- ================= MODAL DETAIL PEMBAYARAN ================= -->
{#if detailModalOpen}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 md:p-6 bg-slate-950/80 backdrop-blur-md overflow-y-auto animate-fade-in"
        role="dialog"
        aria-modal="true"
        on:click|self={closeDetailModal}
    >
        <div
            class="w-full max-w-3xl my-auto rounded-2xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] transition-all"
            in:fade={{ duration: 150 }}
        >
            <!-- Modal Header -->
            <div class="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--surface-2)]/50 shrink-0">
                <div class="flex items-center gap-2.5 sm:gap-3 min-w-0">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/25 text-blue-600 dark:text-blue-400 font-black text-sm sm:text-base flex items-center justify-center shrink-0 shadow-xs">
                        #
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="text-sm sm:text-base font-black text-[var(--text)] tracking-tight truncate">
                                Rincian Transaksi #{detailData?.order.id || ''}
                            </h3>
                            {#if detailData?.order}
                                {@const o = detailData.order}
                                {#if o.isPaid}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                        <span>LUNAS</span>
                                    </span>
                                {:else}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                        <span>PENDING</span>
                                    </span>
                                {/if}
                            {/if}
                        </div>
                        <p class="text-[11px] text-[var(--text-3)] truncate mt-0.5">
                            {detailData?.order.createdAt || 'Memuat rincian...'}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    on:click={closeDetailModal}
                    class="w-8 h-8 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--border)] flex items-center justify-center text-xs font-bold transition-colors cursor-pointer shrink-0"
                    aria-label="Tutup modal rincian"
                >
                    ✕
                </button>
            </div>

            <!-- Modal Body / Content -->
            {#if loadingDetail}
                <div class="p-12 sm:p-16 text-center">
                    <div class="w-8 h-8 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <p class="text-xs font-medium text-[var(--text-3)]">Memuat rincian transaksi...</p>
                </div>
            {:else if detailError}
                <div class="p-6 sm:p-8 text-center space-y-3">
                    <div class="w-12 h-12 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 mx-auto flex items-center justify-center">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <p class="text-xs sm:text-sm font-bold text-red-400">{detailError}</p>
                    <button
                        type="button"
                        on:click={() => detailData?.order?.id && openDetailModal(detailData.order.id)}
                        class="px-4 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)] border border-[var(--border)] cursor-pointer"
                    >
                        Coba Lagi
                    </button>
                </div>
            {:else if detailData}
                {@const o = detailData.order}
                {@const c = detailData.customer}
                <div class="p-4 sm:p-6 overflow-y-auto space-y-4">
                    <!-- Tab Switcher with Sliding Pill Backdrop -->
                    <div
                        bind:this={detailTabContainer}
                        class="relative flex items-center p-1 rounded-xl sm:rounded-2xl bg-slate-100/90 dark:bg-[#0b1324] border border-slate-200/80 dark:border-[#22314d] select-none shrink-0"
                        role="tablist"
                    >
                        {#if detailPillInitialized && detailPillStyle.width > 0}
                            <div
                                class="absolute top-1 bottom-1 rounded-lg sm:rounded-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none {detailPillColorClass}"
                                style="left: {detailPillStyle.left}px; width: {detailPillStyle.width}px;"
                            ></div>
                        {/if}

                        <!-- Tab 1: Rincian & Produk -->
                        <button
                            type="button"
                            role="tab"
                            aria-selected={detailActiveTab === 'order'}
                            bind:this={detailTabElements['order']}
                            class="relative z-10 flex-1 py-1.5 sm:py-2 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border-0 bg-transparent active:scale-[0.98] {detailActiveTab === 'order' ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'}"
                            on:click={() => setDetailTab('order')}
                        >
                            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                            </svg>
                            <span class="hidden sm:inline">Rincian & Produk</span>
                            <span class="sm:hidden">Rincian</span>
                        </button>

                        <!-- Tab 2: Token Lisensi -->
                        <button
                            type="button"
                            role="tab"
                            aria-selected={detailActiveTab === 'tokens'}
                            bind:this={detailTabElements['tokens']}
                            class="relative z-10 flex-1 py-1.5 sm:py-2 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border-0 bg-transparent active:scale-[0.98] {detailActiveTab === 'tokens' ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'}"
                            on:click={() => setDetailTab('tokens')}
                        >
                            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            <span class="hidden sm:inline">Token Lisensi</span>
                            <span class="sm:hidden">Token</span>
                            <span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold flex-shrink-0 transition-colors duration-200 {detailActiveTab === 'tokens' ? 'bg-white/20 text-white border border-white/30' : 'bg-slate-200/90 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60'}">
                                {detailData.tokens?.length || 0}
                            </span>
                        </button>

                        <!-- Tab 3: Pelanggan & Afiliasi -->
                        <button
                            type="button"
                            role="tab"
                            aria-selected={detailActiveTab === 'customer'}
                            bind:this={detailTabElements['customer']}
                            class="relative z-10 flex-1 py-1.5 sm:py-2 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border-0 bg-transparent active:scale-[0.98] {detailActiveTab === 'customer' ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'}"
                            on:click={() => setDetailTab('customer')}
                        >
                            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                            <span class="hidden sm:inline">Pelanggan</span>
                            <span class="sm:hidden">User</span>
                        </button>

                        <!-- Tab 4: Audit & Teknis -->
                        <button
                            type="button"
                            role="tab"
                            aria-selected={detailActiveTab === 'technical'}
                            bind:this={detailTabElements['technical']}
                            class="relative z-10 flex-1 py-1.5 sm:py-2 px-1.5 sm:px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border-0 bg-transparent active:scale-[0.98] {detailActiveTab === 'technical' ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'}"
                            on:click={() => setDetailTab('technical')}
                        >
                            <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span class="hidden sm:inline">Audit & Teknis</span>
                            <span class="sm:hidden">Teknis</span>
                        </button>
                    </div>

                    <!-- TAB 1: Rincian & Produk -->
                    {#if detailActiveTab === 'order'}
                        <div class="space-y-4" in:fade={{ duration: 150 }}>
                            <!-- 2x2 Metrics Grid -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                <!-- Card 1: Total Bayar -->
                                <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1">
                                    <div class="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">Total Pembayaran</div>
                                    <div class="text-base sm:text-lg font-black text-[var(--text)]">
                                        {#if o.totalAmount === 0}
                                            <span class="text-emerald-500 font-extrabold">GRATIS (Rp 0)</span>
                                        {:else}
                                            {formatCurrency(o.totalAmount)}
                                        {/if}
                                    </div>
                                    {#if o.adminFee > 0}
                                        <div class="text-[11px] text-[var(--text-3)] font-medium">
                                            Termasuk Biaya Admin: <b class="text-[var(--text-2)]">{formatCurrency(o.adminFee)}</b>
                                        </div>
                                    {/if}
                                </div>

                                <!-- Card 2: Saluran & Metode -->
                                <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1">
                                    <div class="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">Metode & Gateway</div>
                                    <div class="font-bold text-[var(--text)] text-sm truncate">{o.channelCode || 'Direct Payment'}</div>
                                    <div class="text-[11px] text-[var(--text-3)] truncate">
                                        Metode: <b class="text-[var(--text-2)]">{o.paymentMethod || 'Online Transfer'}</b>
                                    </div>
                                </div>

                                <!-- Card 3: Waktu Transaksi -->
                                <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1">
                                    <div class="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">Waktu Dibuat</div>
                                    <div class="font-bold text-[var(--text)] text-xs truncate">{o.createdAt}</div>
                                    {#if o.paidAt}
                                        <div class="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold truncate">
                                            Lunas: {o.paidAt}
                                        </div>
                                    {:else if o.expiresAt}
                                        <div class="text-[11px] text-amber-600 dark:text-amber-400 font-semibold truncate">
                                            Jatuh Tempo: {o.expiresAt}
                                        </div>
                                    {/if}
                                </div>

                                <!-- Card 4: Durasi Lisensi & Kupon -->
                                <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                                    <div class="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">Durasi & Kupon</div>
                                    <div class="font-bold text-[var(--brand)] text-sm">
                                        {o.durationDisplay || `${o.durationMonths || o.duration || 1} Bulan`}
                                    </div>
                                    {#if parseVoucherInfo(o.voucer, o.voucherDetail)}
                                        {@const v = parseVoucherInfo(o.voucer, o.voucherDetail)}
                                        <div class="flex items-center gap-1.5 flex-wrap pt-0.5">
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg font-mono font-bold text-[11px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                                🏷️ {v.code}
                                            </span>
                                            {#if v.discountText}
                                                <span class="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold">
                                                    {v.discountText}
                                                </span>
                                            {/if}
                                        </div>
                                    {/if}
                                </div>
                            </div>

                            <!-- Purchased Products Section -->
                            <div class="space-y-2">
                                <div class="flex items-center justify-between text-xs">
                                    <span class="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">
                                        Produk yang Dipesan ({detailData.items?.length || 0})
                                    </span>
                                </div>
                                <div class="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)]/60 divide-y divide-[var(--border)] overflow-hidden">
                                    {#if detailData.items && detailData.items.length > 0}
                                        {#each detailData.items as item}
                                            <div class="p-3 sm:p-3.5 flex items-center justify-between gap-3 text-xs">
                                                <div class="flex items-center gap-2.5 min-w-0">
                                                    {#if isValidImg(item.image)}
                                                        <img
                                                            src={item.image}
                                                            alt={item.name}
                                                            class="w-9 h-9 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface)] shrink-0 shadow-xs"
                                                        />
                                                    {:else}
                                                        <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/15 border border-blue-500/25 text-[var(--brand)] font-black text-xs flex items-center justify-center shrink-0">
                                                            {item.name.charAt(0).toUpperCase()}
                                                        </div>
                                                    {/if}
                                                    <div class="min-w-0">
                                                        <div class="font-bold text-[var(--text)] truncate">{item.name}</div>
                                                        <div class="text-[10px] text-[var(--brand)] font-semibold mt-0.5">
                                                            {item.durationText || `${item.count}x Lisensi`}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div class="text-right shrink-0">
                                                    <div class="font-black text-[var(--text)] text-xs sm:text-sm">
                                                        {formatCurrency(item.finalPrice)}
                                                    </div>
                                                    {#if item.discountPercent > 0}
                                                        <div class="text-[10px] text-emerald-500 font-bold">
                                                            Hemat {item.discountPercent}%
                                                        </div>
                                                    {/if}
                                                </div>
                                            </div>
                                        {/each}
                                    {:else}
                                        <div class="p-4 text-center text-xs text-[var(--text-3)]">
                                            Tidak ada data produk spesifik.
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>

                    <!-- TAB 2: Token Lisensi -->
                    {:else if detailActiveTab === 'tokens'}
                        <div class="space-y-3" in:fade={{ duration: 150 }}>
                            {#if detailData.tokens && detailData.tokens.length > 0}
                                <div class="grid grid-cols-1 gap-3 text-xs">
                                    {#each detailData.tokens as tok}
                                        <div class="p-3.5 sm:p-4 rounded-2xl bg-emerald-950/15 dark:bg-emerald-950/25 border border-emerald-500/30 space-y-2.5">
                                            <div class="flex items-center justify-between gap-2 flex-wrap">
                                                <div class="flex items-center gap-1.5 min-w-0">
                                                    <span class="w-2 h-2 rounded-full {tok.isActivated ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
                                                    <span class="font-bold text-xs text-[var(--text)]">{tok.product || 'Lisensi Aplikasi'}</span>
                                                    {#if tok.duration}
                                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                                                            {tok.duration} Bulan
                                                        </span>
                                                    {/if}
                                                </div>
                                                {#if tok.isActivated}
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                        AKTIF
                                                    </span>
                                                {:else}
                                                    <span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                                                        BELUM AKTIF
                                                    </span>
                                                {/if}
                                            </div>

                                            <!-- Token Code with 1-Click Copy -->
                                            <div class="p-2.5 rounded-xl bg-[var(--surface)] border border-emerald-500/25 flex items-center justify-between gap-2">
                                                <span class="font-mono text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 tracking-wider truncate select-all">
                                                    {tok.token}
                                                </span>
                                                <button
                                                    type="button"
                                                    on:click={() => copyToClipboard(tok.token, 'Token Lisensi')}
                                                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-bold shadow-2xs transition-colors cursor-pointer shrink-0 border-0"
                                                    title="Salin Token"
                                                >
                                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    <span>Salin</span>
                                                </button>
                                            </div>

                                            <div class="flex items-center justify-between text-[10px] text-[var(--text-3)] flex-wrap gap-1 pt-1">
                                                <div>
                                                    {#if tok.isActivated}
                                                        <span>HWID/IP: <b class="text-[var(--text-2)] font-mono">{tok.takedIp || 'Terdaftar'}</b></span>
                                                        {#if tok.takedAt}
                                                            <span class="ml-1.5">({tok.takedAt})</span>
                                                        {/if}
                                                    {:else}
                                                        <span>Token siap diaktivasi oleh pengguna.</span>
                                                    {/if}
                                                </div>
                                                <div>Dibuat: {tok.createdAt || o.createdAt}</div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {:else}
                                <div class="p-8 sm:p-10 text-center rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2">
                                    <div class="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 mx-auto flex items-center justify-center">
                                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                    </div>
                                    <p class="text-xs font-bold text-[var(--text)]">Belum Ada Token Lisensi</p>
                                    <p class="text-[11px] text-[var(--text-3)] max-w-sm mx-auto">
                                        Token lisensi akan digenerate otomatis saat transaksi lunas atau dapat diaktifkan melalui verifikasi manual.
                                    </p>
                                </div>
                            {/if}
                        </div>

                    <!-- TAB 3: Pelanggan & Afiliasi -->
                    {:else if detailActiveTab === 'customer'}
                        <div class="space-y-3.5" in:fade={{ duration: 150 }}>
                            <!-- Customer Profile Box -->
                            <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                                <div class="flex items-center justify-between">
                                    <span class="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">Profil Pelanggan</span>
                                    {#if c.verified}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                            ✓ Terverifikasi
                                        </span>
                                    {/if}
                                </div>

                                <div class="flex items-center gap-3">
                                    <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 text-indigo-600 dark:text-indigo-400 font-black text-sm flex items-center justify-center shrink-0">
                                        {c.name ? c.name.charAt(0).toUpperCase() : 'U'}
                                    </div>
                                    <div class="min-w-0 flex-1">
                                        <div class="font-black text-sm text-[var(--text)] truncate">{c.name}</div>
                                        <div class="flex items-center gap-1 text-xs text-[var(--text-3)] mt-0.5 truncate">
                                            <span class="font-mono">{c.email}</span>
                                            <button
                                                type="button"
                                                on:click={() => copyToClipboard(c.email, 'Email Pelanggan')}
                                                class="text-[var(--text-3)] hover:text-[var(--brand)] p-0.5 transition-colors cursor-pointer"
                                                title="Salin Email"
                                            >
                                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-[var(--border)] text-xs">
                                    {#if c.whatsapp}
                                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                                            <span class="text-[11px] text-[var(--text-3)]">WhatsApp:</span>
                                            <a
                                                href="https://wa.me/{formatWhatsApp(c.whatsapp)}"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                class="inline-flex items-center gap-1.5 font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
                                            >
                                                <svg class="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M12.031 6.172c-3.181 0-5.767 2.586-5.768 5.766-.001 1.298.38 2.27 1.019 3.287l-.582 2.128 2.182-.573c.978.58 1.911.928 3.145.929 3.178 0 5.767-2.587 5.768-5.766.001-3.187-2.575-5.771-5.764-5.771zm3.392 8.244c-.144.405-.837.774-1.17.824-.299.045-.677.063-1.092-.069-.252-.08-.575-.187-.988-.365-1.739-.751-2.874-2.502-2.961-2.617-.087-.116-.708-.94-.708-1.793s.448-1.273.607-1.446c.159-.173.346-.217.462-.217l.332.006c.106.005.249-.04.39.298.144.347.491 1.2.534 1.287.043.087.072.188.014.304-.058.116-.087.188-.173.289l-.26.304c-.087.086-.177.18-.076.354.101.174.449.741.964 1.201.662.591 1.221.774 1.394.861.174.086.275.072.376-.044.101-.116.433-.506.549-.68.116-.173.231-.144.39-.086s1.011.477 1.184.564.289.13.332.202c.045.072.045.419-.099.824z" />
                                                </svg>
                                                <span>{c.whatsapp} ↗</span>
                                            </a>
                                        </div>
                                    {/if}
                                    {#if c.company}
                                        <div class="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                                            <span class="text-[11px] text-[var(--text-3)]">Perusahaan:</span>
                                            <span class="font-bold text-[var(--text)] truncate">{c.company}</span>
                                        </div>
                                    {/if}
                                    <div class="flex items-center justify-between p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)]">
                                        <span class="text-[11px] text-[var(--text-3)]">Terdaftar:</span>
                                        <span class="font-medium text-[var(--text-2)]">{c.registeredAt || 'Sebelumnya'}</span>
                                    </div>
                                </div>
                            </div>

                            <!-- Affiliate Information Box -->
                            <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-2.5">
                                <div class="flex items-center justify-between">
                                    <span class="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">Afiliasi & Referral</span>
                                    {#if parseVoucherInfo(o.voucer, o.voucherDetail)}
                                        {@const v = parseVoucherInfo(o.voucer, o.voucherDetail)}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-mono font-bold text-[10px] bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                            🏷️ Kupon: {v.code}
                                        </span>
                                    {/if}
                                </div>
                                {#if detailData.affiliate}
                                    {@const a = detailData.affiliate}
                                    <div class="p-3 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-2 text-xs">
                                        <div class="flex items-center justify-between gap-2">
                                            <div>
                                                <div class="text-[10px] text-[var(--text-3)]">Affiliator:</div>
                                                <div class="font-bold text-[var(--text)] font-mono truncate">{a.affiliatorEmail}</div>
                                            </div>
                                            <div class="text-right">
                                                <div class="text-[10px] text-[var(--text-3)]">Komisi:</div>
                                                <div class="font-black text-emerald-500 text-xs sm:text-sm">
                                                    {formatCurrency(a.affiliateIncome)}
                                                </div>
                                            </div>
                                        </div>
                                        <div class="flex items-center justify-between text-[11px] pt-1.5 border-t border-[var(--border)]">
                                            <span class="text-[var(--text-3)]">Status Komisi:</span>
                                            {#if a.alreadyPaid}
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                                                    Sudah Dibayar ({a.paidAt || 'Tuntas'})
                                                </span>
                                            {:else}
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                                    Belum Dicairkan
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                {:else}
                                    <div class="p-3 rounded-xl bg-[var(--surface)]/80 border border-[var(--border)] text-xs text-[var(--text-3)] text-center">
                                        Pesanan ini dilakukan secara langsung (organik) tanpa menggunakan kode referral afiliasi.
                                    </div>
                                {/if}
                            </div>
                        </div>

                    <!-- TAB 4: Audit & Teknis -->
                    {:else if detailActiveTab === 'technical'}
                        <div class="space-y-3" in:fade={{ duration: 150 }}>
                            <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3 text-xs">
                                <span class="text-[10px] uppercase font-bold text-[var(--text-3)] tracking-wider">
                                    Audit Jejak & Metadata Teknis
                                </span>

                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    <div class="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-0.5">
                                        <span class="text-[10px] text-[var(--text-3)] block font-medium">Order ID</span>
                                        <span class="font-mono font-bold text-[var(--brand)] text-xs">#{o.id}</span>
                                    </div>

                                    {#if o.invoiceToken}
                                        <div class="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-0.5">
                                            <span class="text-[10px] text-[var(--text-3)] block font-medium">Dokumen Invoice PDF</span>
                                            <button
                                                type="button"
                                                on:click={() => openPdfModal(o.invoiceToken, o.id)}
                                                class="font-mono text-xs font-bold text-indigo-500 hover:underline inline-flex items-center gap-1 cursor-pointer border-0 bg-transparent p-0 text-left"
                                            >
                                                <span>Lihat PDF Invoice ↗</span>
                                            </button>
                                        </div>
                                    {/if}

                                    {#if o.paymentRequestId}
                                        <div class="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-0.5">
                                            <span class="text-[10px] text-[var(--text-3)] block font-medium">Payment Request ID</span>
                                            <div class="flex items-center justify-between gap-1">
                                                <span class="font-mono text-[11px] text-[var(--text)] truncate font-semibold">{o.paymentRequestId}</span>
                                                <button
                                                    type="button"
                                                    on:click={() => copyToClipboard(o.paymentRequestId || '', 'Payment Request ID')}
                                                    class="text-[var(--text-3)] hover:text-[var(--brand)] p-0.5 cursor-pointer shrink-0"
                                                    title="Salin"
                                                >
                                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    {/if}

                                    {#if o.paymentId}
                                        <div class="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-0.5">
                                            <span class="text-[10px] text-[var(--text-3)] block font-medium">Payment / Reference ID</span>
                                            <div class="flex items-center justify-between gap-1">
                                                <span class="font-mono text-[11px] text-[var(--text)] truncate font-semibold">{o.paymentId}</span>
                                                <button
                                                    type="button"
                                                    on:click={() => copyToClipboard(o.paymentId || '', 'Payment ID')}
                                                    class="text-[var(--text-3)] hover:text-[var(--brand)] p-0.5 cursor-pointer shrink-0"
                                                    title="Salin"
                                                >
                                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    {/if}

                                    {#if o.vaNumber}
                                        <div class="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-0.5">
                                            <span class="text-[10px] text-[var(--text-3)] block font-medium">Nomor Virtual Account</span>
                                            <div class="flex items-center justify-between gap-1">
                                                <span class="font-mono text-[11px] font-bold text-blue-600 dark:text-blue-400 truncate">{o.vaNumber}</span>
                                                <button
                                                    type="button"
                                                    on:click={() => copyToClipboard(o.vaNumber || '', 'Nomor VA')}
                                                    class="text-[var(--text-3)] hover:text-[var(--brand)] p-0.5 cursor-pointer shrink-0"
                                                    title="Salin"
                                                >
                                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </div>
                                    {/if}

                                    {#if parseVoucherInfo(o.voucer, o.voucherDetail)}
                                        {@const v = parseVoucherInfo(o.voucer, o.voucherDetail)}
                                        <div class="col-span-1 sm:col-span-2 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-xs">
                                            <div>
                                                <span class="text-[10px] text-[var(--text-3)] block font-medium">Kupon / Voucher</span>
                                                <span class="font-mono font-bold text-indigo-500">🏷️ {v.code}</span>
                                            </div>
                                            {#if v.discountText}
                                                <span class="font-bold text-emerald-500 text-[11px]">{v.discountText}</span>
                                            {/if}
                                        </div>
                                    {/if}

                                    {#if o.confirmedBy}
                                        <div class="p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-0.5">
                                            <span class="text-[10px] text-[var(--text-3)] block font-medium">Dikonfirmasi Oleh</span>
                                            <span class="font-bold text-[var(--text)] text-xs truncate block">{o.confirmedBy}</span>
                                        </div>
                                    {/if}

                                    {#if o.note}
                                        <div class="col-span-1 sm:col-span-2 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] space-y-0.5">
                                            <span class="text-[10px] text-[var(--text-3)] block font-medium">Catatan Pesanan</span>
                                            <span class="text-xs text-[var(--text-2)]">{o.note}</span>
                                        </div>
                                    {/if}

                                    {#if o.lastUpdated}
                                        <div class="col-span-1 sm:col-span-2 p-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-between text-[11px]">
                                            <span class="text-[var(--text-3)]">Terakhir Diperbarui:</span>
                                            <span class="font-medium text-[var(--text-2)]">{o.lastUpdated}</span>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- Modal Action Buttons Footer -->
                <div class="px-4 sm:px-6 py-3 border-t border-[var(--border)] flex items-center justify-between gap-2 bg-[var(--surface-2)]/40 shrink-0">
                    <div>
                        {#if o.invoiceToken}
                            <button
                                type="button"
                                on:click={() => openPdfModal(o.invoiceToken, o.id)}
                                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/25 border border-indigo-500/30 transition-all cursor-pointer"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <span>Lihat PDF Invoice ↗</span>
                            </button>
                        {/if}
                    </div>

                    <div class="flex items-center gap-2">
                        {#if !o.isPaid}
                            <button
                                type="button"
                                on:click={() => { closeDetailModal(); openConfirmModal({ id: o.id, user: c.name, totalAmount: o.totalAmount }); }}
                                class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer border-0"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Konfirmasi Lunas</span>
                            </button>
                        {/if}

                        <button
                            type="button"
                            on:click={closeDetailModal}
                            class="px-4 py-1.5 rounded-xl text-xs font-bold bg-[var(--surface-2)] text-[var(--text)] hover:bg-[var(--border)] border border-[var(--border)] transition-colors cursor-pointer"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}

<!-- ================= MODAL EDIT DURASI ================= -->
{#if durationModalOpen && editingPayment}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true" on:click|self={closeDurationModal}>
        <div class="w-full max-w-md rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-5 sm:p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 class="text-sm sm:text-base font-bold text-[var(--text)]">Ubah Durasi Lisensi</h3>
                <button type="button" on:click={closeDurationModal} class="text-[var(--text-3)] hover:text-[var(--text)] text-xs font-bold cursor-pointer">✕</button>
            </div>

            <div class="space-y-3 text-xs">
                <p class="text-[var(--text-3)]">
                    Ubah durasi lisensi untuk transaksi <b class="text-[var(--text)]">#{editingPayment.id}</b> ({editingPayment.productName}).
                </p>

                <div>
                    <label class="block text-[11px] font-bold text-[var(--text-3)] uppercase tracking-wider mb-1">Durasi Baru (Bulan)</label>
                    <input
                        type="number"
                        min="1"
                        max="120"
                        bind:value={newDuration}
                        class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-sm text-[var(--text)] font-bold focus:outline-none focus:border-[var(--brand)]"
                    />
                </div>
            </div>

            <div class="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                    type="button"
                    on:click={closeDurationModal}
                    class="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                >
                    Batal
                </button>
                <button
                    type="button"
                    on:click={executeUpdateDuration}
                    disabled={isUpdatingDuration || newDuration < 1}
                    class="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-xs disabled:opacity-50 cursor-pointer border-0"
                >
                    {isUpdatingDuration ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- ================= MODAL KONFIRMASI LUNAS MANUAL ================= -->
{#if confirmModalOpen && confirmingPayment}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-md animate-fade-in" role="dialog" aria-modal="true" on:click|self={closeConfirmModal}>
        <div class="w-full max-w-md rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-5 sm:p-6 space-y-4">
            <div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <h3 class="text-sm sm:text-base font-bold text-[var(--text)]">Konfirmasi Pembayaran</h3>
                <button type="button" on:click={closeConfirmModal} class="text-[var(--text-3)] hover:text-[var(--text)] text-xs font-bold cursor-pointer">✕</button>
            </div>

            <div class="space-y-2.5 text-xs text-[var(--text-2)]">
                <p>
                    Anda akan mengonfirmasi lunas transaksi <b class="text-[var(--text)]">#{confirmingPayment.id}</b> senilai <b class="text-emerald-400">{formatCurrency(confirmingPayment.totalAmount)}</b> untuk akun <b class="text-[var(--text)]">{confirmingPayment.user}</b>.
                </p>
                <p class="text-[11px] text-[var(--text-3)] bg-amber-500/10 border border-amber-500/20 p-2.5 rounded-xl text-amber-600 dark:text-amber-300">
                    ⚠️ Token lisensi mesin akan otomatis digenerate dan dikaitkan ke akun pelanggan jika belum dibuat sebelumnya.
                </p>
            </div>

            <div class="flex items-center justify-end gap-2 pt-3 border-t border-[var(--border)]">
                <button
                    type="button"
                    on:click={closeConfirmModal}
                    class="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer"
                >
                    Batal
                </button>
                <button
                    type="button"
                    on:click={executeConfirmPayment}
                    disabled={isConfirming}
                    class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs disabled:opacity-50 cursor-pointer border-0"
                >
                    {isConfirming ? 'Memproses...' : 'Ya, Konfirmasi Lunas'}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- ================= MODAL PRATINJAU PDF / INVOICE DOKUMEN ================= -->
{#if pdfModalOpen}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-[#070c18]/85 backdrop-blur-md animate-fade-in"
        role="dialog"
        aria-modal="true"
        on:click|self={closePdfModal}
    >
        <div class="w-full max-w-5xl h-[94vh] max-h-[96vh] rounded-3xl bg-slate-900 border border-slate-700/80 shadow-2xl flex flex-col overflow-hidden text-slate-100">
            <!-- Modal Header Toolbar -->
            <div class="px-4 sm:px-6 py-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-[#0c1426] shrink-0">
                <div class="flex items-center gap-2.5 min-w-0">
                    <div class="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-400 flex items-center justify-center shrink-0">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                    </div>
                    <div class="truncate">
                        <div class="flex items-center gap-2">
                            <h3 class="text-sm sm:text-base font-bold text-white tracking-tight">Pratinjau Dokumen Invoice</h3>
                            {#if pdfModalOrderId || pdfModalData?.invoiceNumber}
                                <span class="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                                    {pdfModalData?.invoiceNumber || `INV-${pdfModalOrderId}`}
                                </span>
                            {/if}
                            {#if pdfModalData}
                                {#if pdfModalData.isPaid}
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                                        LUNAS
                                    </span>
                                {:else}
                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                                        MENUNGGU
                                    </span>
                                {/if}
                            {/if}
                        </div>
                        <p class="text-[11px] text-slate-400 truncate hidden sm:block">
                            Dokumen faktur resmi digital AppCenter (format standar A4)
                        </p>
                    </div>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                    <!-- Language Switcher: ID / EN -->
                    <div class="inline-flex rounded-xl bg-slate-800/80 p-0.5 border border-slate-700">
                        <button
                            type="button"
                            class="px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer {pdfModalLang === 'id' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}"
                            on:click={() => pdfModalLang = 'id'}
                        >
                            ID
                        </button>
                        <button
                            type="button"
                            class="px-2.5 py-1 text-[11px] font-bold rounded-lg transition-colors cursor-pointer {pdfModalLang === 'en' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-400 hover:text-white'}"
                            on:click={() => pdfModalLang = 'en'}
                        >
                            EN
                        </button>
                    </div>

                    <!-- Cetak Invoice -->
                    <button
                        type="button"
                        on:click={printInvoiceDocument}
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-all cursor-pointer"
                        title="Cetak Dokumen Invoice"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        <span class="hidden sm:inline">Cetak</span>
                    </button>

                    <!-- Unduh PDF Asli (Endpoint Download) -->
                    <a
                        href={pdfDownloadUrl}
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white shadow-xs transition-colors cursor-pointer"
                        title="Unduh file PDF resmi ke komputer"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        <span class="hidden sm:inline">Unduh PDF</span>
                    </a>

                    <!-- Buka Tab Baru -->
                    <a
                        href={pdfModalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-all cursor-pointer"
                        title="Buka Stream PDF di Tab Baru"
                    >
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                        <span class="hidden md:inline">PDF Asli</span>
                    </a>

                    <!-- Tutup -->
                    <button
                        type="button"
                        on:click={closePdfModal}
                        class="w-8 h-8 rounded-xl bg-slate-800 border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-700 flex items-center justify-center transition-all cursor-pointer ml-1"
                        aria-label="Tutup Pratinjau Invoice"
                    >
                        ✕
                    </button>
                </div>
            </div>

            <!-- Modal Body: High-Fidelity A4 Document Canvas -->
            <div class="relative flex-1 w-full bg-[#080d1a] overflow-y-auto p-3 sm:p-6 md:p-8 flex justify-center custom-scrollbar">
                {#if pdfModalLoading}
                    <div class="flex flex-col items-center justify-center gap-3 my-auto text-slate-300">
                        <div class="w-9 h-9 border-3 border-slate-700 border-t-indigo-500 rounded-full animate-spin"></div>
                        <p class="text-xs font-mono text-slate-400">Memuat rincian faktur resmi...</p>
                    </div>
                {:else if pdfModalError}
                    <div class="w-full max-w-md bg-rose-500/10 border border-rose-500/30 rounded-2xl p-6 text-center space-y-3 my-auto">
                        <div class="w-10 h-10 bg-rose-500/20 text-rose-400 rounded-xl flex items-center justify-center mx-auto text-base font-bold font-mono">!</div>
                        <h4 class="text-sm font-bold text-rose-300">Gagal Memuat Invoice</h4>
                        <p class="text-xs text-rose-400/80 leading-relaxed">{pdfModalError}</p>
                        <button
                            type="button"
                            on:click={() => openPdfModal(pdfModalToken, pdfModalOrderId)}
                            class="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white transition-colors cursor-pointer"
                        >
                            Coba Lagi
                        </button>
                    </div>
                {:else if pdfModalData}
                    <!-- A4 Invoice Document Sheet Container -->
                    <div id="invoice-print-sheet" class="w-full max-w-[760px] bg-white text-slate-900 rounded-2xl shadow-2xl p-6 sm:p-10 border border-slate-200/80 my-auto text-xs sm:text-sm selection:bg-blue-100 selection:text-blue-900 font-sans">
                        <!-- Top Header & Brand -->
                        <div class="flex items-start justify-between gap-4 border-b border-slate-200 pb-6">
                            <div class="flex items-center gap-3.5">
                                <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 p-2.5 text-white flex items-center justify-center shadow-md shrink-0">
                                    <svg class="w-full h-full" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M22 19.2727C22 20.779 20.779 22 19.2727 22H14.7273C13.221 22 12 20.779 12 19.2727V12H19.2727C20.779 12 22 13.221 22 14.7273V19.2727Z" fill="#bae6fd"/>
                                        <path d="M20 2C21.1046 2 22 2.89543 22 4V7C22 8.10457 21.1046 9 20 9H17C15.8954 9 15 8.10457 15 7V4C15 2.89543 15.8954 2 17 2H20Z" fill="#ffffff"/>
                                        <path d="M7 15C8.10457 15 9 15.8954 9 17V20C9 21.1046 8.10457 22 7 22H4C2.89543 22 2 21.1046 2 20V17C2 15.8954 2.89543 15 4 15H7Z" fill="#ffffff"/>
                                        <path d="M12 12H4.72727C3.22104 12 2 10.779 2 9.27273V4.72727C2 3.22104 3.22104 2 4.72727 2H9.27273C10.779 2 12 3.22104 12 4.72727V12Z" fill="#7dd3fc"/>
                                    </svg>
                                </div>
                                <div>
                                    <h1 class="text-xl sm:text-2xl font-black text-slate-900 tracking-tight leading-none">Ziqva Labs</h1>
                                    <p class="text-[11px] text-slate-500 font-medium mt-1">AppCenter &bull; Official Digital Software License & Billing</p>
                                </div>
                            </div>

                            <div class="text-right space-y-1">
                                <div>
                                    {#if pdfModalData.isPaid}
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-300">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                            {curLabels.receipt} ({curLabels.paidBadge})
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-extrabold bg-amber-50 text-amber-700 border border-amber-300">
                                            <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                            {curLabels.unpaid} ({curLabels.unpaidBadge})
                                        </span>
                                    {/if}
                                </div>
                                <div class="text-base sm:text-lg font-black font-mono text-slate-900">{pdfModalData.invoiceNumber}</div>
                                <div class="text-[11px] text-slate-500 font-medium">{curLabels.issueDate} {pdfModalData.createdDateStr}</div>
                            </div>
                        </div>

                        <!-- 2-Column Info Grid: Customer vs Billing Details -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
                            <!-- Billed To -->
                            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                                <div class="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                    <span>{curLabels.billedTo}</span>
                                </div>
                                <div class="text-sm font-bold text-slate-900">{pdfModalData.customer?.name || 'Pelanggan'}</div>
                                {#if pdfModalData.customer?.company}
                                    <div class="text-xs font-semibold text-slate-700 flex items-center gap-1">
                                        <span>🏢</span> {pdfModalData.customer.company}
                                    </div>
                                {/if}
                                <div class="text-xs text-slate-600 break-all flex items-center gap-1.5">
                                    <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                    <span>{pdfModalData.customer?.email}</span>
                                </div>
                                {#if pdfModalData.customer?.whatsapp}
                                    <div class="text-xs text-slate-600 flex items-center gap-1.5">
                                        <svg class="w-3 h-3 text-slate-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                        <span>{pdfModalData.customer.whatsapp}</span>
                                    </div>
                                {/if}
                            </div>

                            <!-- Billing Info -->
                            <div class="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
                                <div class="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                    <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                    </svg>
                                    <span>{curLabels.billingInfo}</span>
                                </div>
                                <div class="flex items-center justify-between text-xs text-slate-600">
                                    <span>{curLabels.issueDate}</span>
                                    <span class="font-semibold text-slate-800">{pdfModalData.createdDateStr}</span>
                                </div>
                                {#if pdfModalData.isPaid}
                                    <div class="flex items-center justify-between text-xs text-emerald-700 font-bold border-t border-dashed border-slate-200 pt-1.5">
                                        <span>{curLabels.paymentTime}</span>
                                        <span class="inline-flex items-center gap-1 font-mono">
                                            ✓ {pdfModalData.paidDateStr || pdfModalData.createdDateStr}
                                        </span>
                                    </div>
                                {:else}
                                    <div class="flex items-center justify-between text-xs text-amber-700 font-bold border-t border-dashed border-slate-200 pt-1.5">
                                        <span>{curLabels.paymentStatus}</span>
                                        <span>{curLabels.unpaidBadge}</span>
                                    </div>
                                {/if}
                                <div class="flex items-center justify-between text-xs text-slate-600">
                                    <span>{curLabels.paymentStatus}</span>
                                    <span class="font-bold {pdfModalData.isPaid ? 'text-emerald-600' : 'text-amber-600'}">
                                        {pdfModalData.isPaid ? curLabels.paidBadge : curLabels.unpaidBadge}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <!-- Items Table -->
                        <div class="overflow-x-auto my-6 border border-slate-200 rounded-xl">
                            <table class="w-full text-left border-collapse">
                                <thead>
                                    <tr class="bg-slate-100/90 text-slate-700 text-[11px] font-bold uppercase tracking-wider border-b border-slate-200">
                                        <th class="py-3 px-4">{curLabels.desc}</th>
                                        <th class="py-3 px-4 w-32">{curLabels.duration}</th>
                                        <th class="py-3 px-4 w-36 text-right">{curLabels.unitPrice}</th>
                                    </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                    {#if pdfModalData.items && pdfModalData.items.length > 0}
                                        {#each pdfModalData.items as item}
                                            <tr class="hover:bg-slate-50/50">
                                                <td class="py-3.5 px-4">
                                                    <div class="font-bold text-slate-900 text-sm">{item.name}</div>
                                                    <div class="text-[11px] text-slate-500 mt-0.5">{item.description || curLabels.defaultDesc}</div>
                                                </td>
                                                <td class="py-3.5 px-4 font-semibold text-slate-700 whitespace-nowrap">
                                                    <span class="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-xs">
                                                        {item.duration || '1 Bulan'}
                                                    </span>
                                                </td>
                                                <td class="py-3.5 px-4 font-bold text-slate-900 text-right whitespace-nowrap font-mono">
                                                    Rp {(item.price || 0).toLocaleString('id-ID')}
                                                </td>
                                            </tr>
                                        {/each}
                                    {:else}
                                        <tr>
                                            <td colspan="3" class="py-4 px-4 text-center text-slate-400">Tidak ada rincian produk</td>
                                        </tr>
                                    {/if}
                                </tbody>
                            </table>
                        </div>

                        <!-- Pricing Summary Calculations -->
                        <div class="flex justify-end my-6">
                            <div class="w-full sm:w-80 space-y-2 text-xs">
                                <div class="flex items-center justify-between text-slate-600">
                                    <span>{curLabels.subtotal}</span>
                                    <span class="font-mono font-semibold text-slate-800">Rp {(pdfModalData.pricing?.subtotal || 0).toLocaleString('id-ID')}</span>
                                </div>
                                {#if pdfModalData.pricing?.discount > 0}
                                    <div class="flex items-center justify-between text-rose-600 font-semibold">
                                        <span>{curLabels.discount} ({pdfModalData.pricing?.voucherCode || 'Voucher'})</span>
                                        <span class="font-mono">- Rp {pdfModalData.pricing.discount.toLocaleString('id-ID')}</span>
                                    </div>
                                {/if}
                                {#if pdfModalData.pricing?.adminFee > 0}
                                    <div class="flex items-center justify-between text-slate-600">
                                        <span>{curLabels.adminFee}</span>
                                        <span class="font-mono font-semibold text-slate-800">Rp {pdfModalData.pricing.adminFee.toLocaleString('id-ID')}</span>
                                    </div>
                                {/if}
                                {#if pdfModalData.pricing?.uniqueCode > 0}
                                    <div class="flex items-center justify-between text-blue-600 font-semibold">
                                        <span>{curLabels.uniqueCode}</span>
                                        <span class="font-mono">+ Rp {pdfModalData.pricing.uniqueCode.toLocaleString('id-ID')}</span>
                                    </div>
                                {/if}
                                <div class="flex items-center justify-between text-sm sm:text-base font-black text-slate-900 pt-3 border-t-2 border-slate-900">
                                    <span>{curLabels.total}</span>
                                    <span class="font-mono text-indigo-600">Rp {(pdfModalData.pricing?.totalAmount || 0).toLocaleString('id-ID')}</span>
                                </div>
                            </div>
                        </div>

                        <!-- License Key Box (If Paid) -->
                        {#if pdfModalData.isPaid && pdfModalData.licenseToken}
                            <div class="my-6 p-4 sm:p-5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-3">
                                <div class="flex items-center gap-2 text-emerald-800 font-extrabold text-sm">
                                    <div class="w-6 h-6 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">✓</div>
                                    <span>{curLabels.thankYouTitle}</span>
                                </div>
                                <p class="text-xs text-emerald-800">{curLabels.thankYouDesc}</p>
                                <div class="bg-white border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 shadow-xs">
                                    <div class="space-y-0.5">
                                        <span class="text-[10px] font-bold text-emerald-700 uppercase tracking-wider block">{curLabels.licenseKey}</span>
                                        <span class="font-mono text-xs sm:text-sm font-black text-emerald-950 break-all select-all">{pdfModalData.licenseToken}</span>
                                    </div>
                                    <button
                                        type="button"
                                        on:click={copyPdfModalLicense}
                                        class="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white transition-colors cursor-pointer shrink-0 inline-flex items-center justify-center gap-1.5 shadow-xs"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        <span>{pdfModalCopiedToken ? curLabels.copySuccess : curLabels.copyKey}</span>
                                    </button>
                                </div>

                                <!-- Quick Links for Download & Video Tutorials -->
                                {#if pdfModalData.items && pdfModalData.items.length > 0}
                                    <div class="pt-2 border-t border-dashed border-emerald-200 flex flex-wrap items-center gap-2">
                                        {#each pdfModalData.items as it}
                                            {#if it.downloadUrl}
                                                <a
                                                    href={it.downloadUrl}
                                                    target="_blank"
                                                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-blue-200 text-blue-700 text-[11px] font-bold hover:bg-blue-50 transition-colors shadow-xs"
                                                >
                                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                                    </svg>
                                                    <span>{curLabels.downloadInstaller} ({it.name})</span>
                                                </a>
                                            {/if}
                                            {#if it.hasTutorials && it.tutorialUrl}
                                                <a
                                                    href={it.tutorialUrl}
                                                    target="_blank"
                                                    class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-purple-700 text-[11px] font-bold hover:bg-purple-50 transition-colors shadow-xs"
                                                >
                                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>{curLabels.videoTutorial} ({it.name})</span>
                                                </a>
                                            {/if}
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        {:else if !pdfModalData.isPaid && pdfModalData.paymentUrl}
                            <div class="my-6 p-4 sm:p-5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-3">
                                <div class="flex items-center gap-2 text-amber-800 font-extrabold text-sm">
                                    <div class="w-6 h-6 rounded-lg bg-amber-600 text-white flex items-center justify-center shrink-0">!</div>
                                    <span>{curLabels.actionRequired}</span>
                                </div>
                                <div class="flex items-center justify-between gap-3 flex-wrap">
                                    <p class="text-xs text-amber-800">Selesaikan pembayaran untuk mengaktifkan lisensi secara otomatis.</p>
                                    <a
                                        href={pdfModalData.paymentUrl}
                                        target="_blank"
                                        class="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white transition-colors cursor-pointer shadow-xs inline-flex items-center gap-1.5"
                                    >
                                        <span>{curLabels.payNow}</span>
                                        <span>→</span>
                                    </a>
                                </div>
                            </div>
                        {/if}

                        <!-- Document Footer / Legal notes -->
                        <div class="border-t border-slate-200 pt-5 mt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-slate-500">
                            <p class="text-center sm:text-left leading-relaxed max-w-md">{curLabels.notes}</p>
                            <div class="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold text-slate-400 shrink-0">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                <span>{curLabels.verifiedSystem} &bull; Ziqva Labs</span>
                            </div>
                        </div>
                    </div>
                {/if}
            </div>

            <!-- Modal Footer -->
            <div class="px-4 sm:px-6 py-2.5 bg-[#0c1426] border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 shrink-0">
                <div class="flex items-center gap-2">
                    <span class="inline-block w-2 h-2 rounded-full bg-emerald-400"></span>
                    <span class="text-[11px] text-slate-300">Dokumen Invoice Digital Terverifikasi</span>
                </div>

                <div class="flex items-center gap-2">
                    <button
                        type="button"
                        on:click={closePdfModal}
                        class="px-4 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 text-slate-200 hover:text-white hover:bg-slate-700 border border-slate-700 transition-colors cursor-pointer"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<style>
    .no-scrollbar::-webkit-scrollbar {
        display: none;
    }
    .no-scrollbar {
        -ms-overflow-style: none;
        scrollbar-width: none;
    }

    @media print {
        :global(body *) {
            visibility: hidden !important;
        }
        :global(#invoice-print-sheet),
        :global(#invoice-print-sheet *) {
            visibility: visible !important;
        }
        :global(#invoice-print-sheet) {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            margin: 0 !important;
            padding: 24px !important;
            border: none !important;
            box-shadow: none !important;
            background: #ffffff !important;
            color: #0f172a !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
        }
    }
</style>
