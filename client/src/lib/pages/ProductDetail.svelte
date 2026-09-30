<script lang="ts">
    import { onMount } from 'svelte';
    import Layout from '../components/Layout.svelte';
    import CustomDropdown from '../components/CustomDropdown.svelte';

    interface ProductItem {
        id: number;
        name: string;
        description: string;
        price: number;
        image?: string | null;
        is_discount: boolean;
        discount_percent: number;
        category_id?: number | null;
        category_ids?: number[];
        category_name?: string | null;
        category_icon?: string | null;
        category_slug?: string | null;
        categories?: Array<{ id: number; name: string; slug: string; icon: string | null }>;
        active_users?: number;
        active_users_formatted?: string | null;
        video_count?: number;
        has_tutorials?: boolean;
        tutorials?: string | null;
        is_bundle?: boolean;
        bundle_items?: string | number[] | null;
        is_active?: boolean;
    }

    function hasTutorials(product?: ProductItem | null): boolean {
        if (!product) return false;
        if (product.has_tutorials !== undefined) return Boolean(product.has_tutorials);
        if (product.video_count !== undefined) return product.video_count > 0;
        if (!product.tutorials) return false;
        try {
            const parsed = typeof product.tutorials === 'string' ? JSON.parse(product.tutorials) : product.tutorials;
            return Array.isArray(parsed) && parsed.length > 0;
        } catch {
            return false;
        }
    }

    let products: ProductItem[] = [];
    let selectedProductId: number = 0;
    let heroImgError: boolean = false;
    let duration: number = 2;
    let voucherCode: string = '';
    let voucherApplied: boolean = false;

    $: if (selectedProductId) {
        heroImgError = false;
    }
    let voucherDiscount: number = 0;
    let voucherMsg: string = '';
    let loading: boolean = true;
    let submitting: boolean = false;
    let checkingVoucher: boolean = false;
    let errorMessage: string = '';
    let successModalOpen: boolean = false;
    let successPaymentUrl: string = '';
    let successRedirectUrl: string = '/#/member/orders';
    let successIsFree: boolean = false;

    $: selectedProduct = products.find(p => p.id === selectedProductId) || products[0] || {
        id: 102,
        name: 'Affilia',
        description: 'Platform desktop serbaguna untuk manajemen dan otomasi Android Phone Farming & Bot TikTok Affiliate.',
        price: 129350,
        is_discount: false,
        discount_percent: 0,
        active_users: 0,
        active_users_formatted: null
    };

    $: bundleProducts = (() => {
        if (!selectedProduct || !selectedProduct.is_bundle || !selectedProduct.bundle_items) return [];
        let ids: number[] = [];
        try {
            const parsed = typeof selectedProduct.bundle_items === 'string' ? JSON.parse(selectedProduct.bundle_items) : selectedProduct.bundle_items;
            if (Array.isArray(parsed)) ids = parsed.map(Number).filter(n => !isNaN(n) && n > 0);
        } catch {
            ids = String(selectedProduct.bundle_items).split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n) && n > 0);
        }
        return products.filter(p => ids.includes(p.id));
    })();

    $: basePrice = selectedProduct ? selectedProduct.price : 0;
    $: hasProductDiscount = Boolean(selectedProduct && selectedProduct.is_discount && selectedProduct.discount_percent > 0);
    $: productDiscountPercent = hasProductDiscount ? selectedProduct.discount_percent : 0;
    $: discountedUnitPrice = hasProductDiscount
        ? Math.round(basePrice * (1 - productDiscountPercent / 100))
        : basePrice;
    $: rawTotal = basePrice === 0 ? 0 : discountedUnitPrice * duration;
    $: finalTotal = Math.max(0, rawTotal - voucherDiscount);

    $: originalTotal = basePrice * duration;
    $: totalSavedAmount = Math.max(0, originalTotal - finalTotal);
    $: totalSavedPercent = (originalTotal > 0 && totalSavedAmount > 0) ? Math.round((totalSavedAmount / originalTotal) * 100) : 0;

    function formatRupiah(val: number): string {
        if (!val || val === 0) return 'Gratis';
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    }

    function formatActiveUsers(num?: number | null, formattedStr?: string | null): string {
        if (formattedStr && typeof formattedStr === 'string' && formattedStr.trim()) {
            return formattedStr.trim();
        }
        if (!num || num < 500) return '';
        if (num >= 1000) {
            const k = (num / 1000).toFixed(1).replace(/\.0$/, '');
            return `${k}k+`;
        }
        return `${num}+`;
    }

    onMount(async () => {
        const hash = window.location.hash || '';
        if (hash.includes('?')) {
            const qIdx = hash.indexOf('?');
            const params = new URLSearchParams(hash.substring(qIdx));
            const pId = parseInt(params.get('product_id') || '0');
            if (pId > 0) selectedProductId = pId;
            const errParam = params.get('error');
            if (errParam) {
                errorMessage = errParam;
            }
        }

        try {
            const res = await fetch('/member/api/products', {
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
                    products = json.data.products;
                    if (!selectedProductId && products.length > 0) {
                        selectedProductId = products[0].id;
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load products for detail page:', e);
        } finally {
            loading = false;
        }
    });

    async function checkVoucher() {
        if (!voucherCode.trim() || !selectedProduct) return;
        checkingVoucher = true;
        voucherMsg = '';
        try {
            const res = await fetch('/member/api/check-voucher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voucher_code: voucherCode.trim(),
                    product_id: selectedProduct.id,
                    total_amount: discountedUnitPrice * (duration / 2)
                }),
                credentials: 'include'
            });
            if (res.status === 401 || res.status === 403) {
                window.location.hash = '/member/login';
                return;
            }
            const data = await res.json();
            if (data.status === 'success') {
                voucherApplied = true;
                voucherDiscount = data.discount || 0;
                voucherMsg = data.message || 'Voucher berhasil digunakan!';
            } else {
                voucherApplied = false;
                voucherDiscount = 0;
                voucherMsg = data.message || 'Voucher tidak valid.';
            }
        } catch (e) {
            voucherApplied = false;
            voucherDiscount = 0;
            voucherMsg = 'Gagal memvalidasi voucher.';
        } finally {
            checkingVoucher = false;
        }
    }

    function removeVoucher() {
        voucherCode = '';
        voucherApplied = false;
        voucherDiscount = 0;
        voucherMsg = '';
    }

    async function handleOrderSubmit(e: Event) {
        e.preventDefault();
        if (!selectedProduct) return;

        submitting = true;
        errorMessage = '';

        try {
            const formData = new URLSearchParams();
            formData.append('product_id', String(selectedProduct.id));
            formData.append('duration', String(duration));
            formData.append('duration_select', String(duration));
            if (voucherCode && voucherApplied) formData.append('voucher_code', voucherCode);

            const res = await fetch('/member/orders/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Accept': 'application/json'
                },
                body: formData.toString(),
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.hash = '/member/login';
                return;
            }

            if (res.ok) {
                const data = await res.json();
                successIsFree = Boolean(data.is_free);
                
                // Set direct internal SPA routing to Orders list (or Licenses if free)
                successRedirectUrl = data.is_free ? '/#/member/licenses' : '/#/member/orders';
                successPaymentUrl = '';
                
                // If payment url exists and user wants to pay later from list
                if (data.redirect && (data.redirect.startsWith('http://') || data.redirect.startsWith('https://'))) {
                    successPaymentUrl = data.redirect;
                }

                successModalOpen = true;
            } else {
                const errData = await res.json().catch(() => null);
                errorMessage = errData?.message || 'Gagal memproses pesanan. Silakan coba lagi.';
            }
        } catch (e) {
            errorMessage = 'Terjadi kesalahan jaringan. Silakan periksa koneksi Anda.';
        } finally {
            submitting = false;
        }
    }
</script>

<Layout activePage="create-order" eyebrow="PEMESANAN SOFTWARE & LISENSI">
    <main class="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-12">
        <!-- Top Header & Breadcrumb Navigation -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[var(--border)] dark:border-[#22314d]">
            <div>
                <a
                    href="#/member/orders"
                    class="text-xs font-semibold text-[var(--text-3)] hover:text-[var(--brand)] inline-flex items-center gap-1.5 transition-colors mb-1 cursor-pointer"
                >
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Kembali ke Pesanan Saya</span>
                </a>
                <h1 class="text-xl sm:text-2xl font-black text-[var(--text)] dark:text-white tracking-tight">
                    Pemesanan Lisensi Software
                </h1>
                <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">
                    Konfigurasikan pilihan software, durasi masa aktif, dan aktivasi lisensi resmi akun Anda.
                </p>
            </div>

            <div class="flex items-center gap-2 self-start sm:self-center">
                <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-[var(--surface-2)] dark:bg-[#1e293b] text-[var(--text-2)] dark:text-slate-300 border border-[var(--border)] dark:border-slate-700 shadow-2xs">
                    <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                    <span>Aktivasi Instan</span>
                </span>
            </div>
        </div>

        {#if errorMessage}
            <div class="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-500 dark:text-red-400 text-xs sm:text-sm flex items-center justify-between shadow-xs animate-fade-in">
                <div class="flex items-center gap-2.5">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span class="font-medium">{errorMessage}</span>
                </div>
                <button type="button" on:click={() => errorMessage = ''} class="text-xs font-bold underline cursor-pointer bg-transparent border-0 text-red-400">Tutup</button>
            </div>
        {/if}

        <!-- 2-Column Responsive Layout -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            <!-- Left Column: Unified Order Configurator Card (lg:col-span-7 xl:col-span-8) -->
            <div class="lg:col-span-7 xl:col-span-8 p-5 sm:p-6 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] shadow-xs space-y-5">
                
                <!-- Section 1: Software Selection & Overview -->
                <div class="space-y-3">
                    <div class="flex items-center justify-between">
                        <label for="product-custom-select" class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                            Pilih Software
                        </label>
                        {#if selectedProduct && (selectedProduct.active_users && selectedProduct.active_users >= 500)}
                            <span class="text-[11px] font-bold text-emerald-500 dark:text-emerald-400 inline-flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                <span>{formatActiveUsers(selectedProduct.active_users, selectedProduct.active_users_formatted)} Pengguna Aktif</span>
                            </span>
                        {/if}
                    </div>

                    <!-- Custom Dropdown Selector -->
                    <CustomDropdown
                        items={products}
                        bind:selectedId={selectedProductId}
                        {loading}
                        disabled={loading || submitting}
                    />

                    <!-- Clean Software Information Strip (No duplicate logo/name) -->
                    {#if selectedProduct}
                        <div class="p-3.5 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] text-xs space-y-1.5">
                            <div class="flex items-center justify-between">
                                <span class="font-bold text-[var(--text)] dark:text-white uppercase tracking-wider text-[11px]">
                                    Deskripsi Software
                                </span>
                                <span class="px-2 py-0.2 rounded-md text-[10px] font-mono font-bold bg-[var(--surface)] dark:bg-slate-800 text-[var(--text-3)] dark:text-slate-400 border border-[var(--border)] dark:border-slate-700 uppercase">
                                    {selectedProduct.category_name || (basePrice === 0 ? 'Gratis' : 'Software')}
                                </span>
                            </div>
                            <p class="text-[var(--text-3)] dark:text-slate-400 leading-relaxed">
                                {selectedProduct.description || 'Aplikasi software resmi Ziqva Store dengan lisensi terverifikasi dan pembaruan rilis berkala.'}
                            </p>
                        </div>
                    {/if}

                    <!-- Bundle Software Items (if package) -->
                    {#if selectedProduct?.is_bundle && bundleProducts.length > 0}
                        <div class="p-3.5 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] space-y-2">
                            <div class="flex items-center justify-between">
                                <span class="text-[11px] font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                                    Paket Termasuk ({bundleProducts.length} Aplikasi):
                                </span>
                                <span class="text-[10px] font-bold text-emerald-500 dark:text-emerald-400">Lisensi Resmi</span>
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {#each bundleProducts as bProd}
                                    <div class="flex items-center gap-2.5 p-2 rounded-lg bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-800">
                                        <div class="w-6 h-6 rounded bg-[var(--surface-2)] dark:bg-slate-800 border border-[var(--border)] dark:border-slate-700 flex items-center justify-center overflow-hidden flex-shrink-0">
                                            {#if bProd.image}
                                                <img src={bProd.image} alt={bProd.name} class="w-full h-full object-cover" />
                                            {:else}
                                                <span class="text-[10px] font-black text-[var(--brand)]">{bProd.name.charAt(0).toUpperCase()}</span>
                                            {/if}
                                        </div>
                                        <span class="text-xs text-[var(--text)] dark:text-white font-medium truncate">{bProd.name}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}
                </div>

                <!-- Section 2: Duration Selector -->
                <div class="space-y-2.5 pt-4 border-t border-[var(--border)] dark:border-[#22314d]">
                    <div class="flex items-center justify-between">
                        <label class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                            Durasi Berlangganan
                        </label>
                        {#if basePrice > 0}
                            <span class="text-[11px] text-[var(--text-3)] dark:text-slate-400 font-mono">
                                {formatRupiah(discountedUnitPrice)} / 2 bln
                            </span>
                        {/if}
                    </div>

                    {#if basePrice > 0}
                        <!-- Percentage-based Fluid Sliding Pill -->
                        <div class="relative p-1 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] flex items-center select-none overflow-hidden">
                            <div
                                class="absolute top-1 bottom-1 left-1 w-[calc(33.333%-2.67px)] rounded-lg bg-blue-600 shadow-sm shadow-blue-500/25 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
                                style="transform: translateX({duration === 2 ? '0%' : duration === 4 ? '100%' : '200%'});"
                            ></div>

                            {#each [2, 4, 6] as m}
                                <button
                                    type="button"
                                    disabled={loading || submitting}
                                    class="relative z-10 flex-1 py-2 rounded-lg text-center text-xs font-bold transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed border-0 bg-transparent {duration === m ? 'text-white font-bold' : 'text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white'}"
                                    on:click={() => duration = m}
                                >
                                    <span>{m} Bulan</span>
                                    <span class="text-[10px] opacity-75 font-normal ml-1 hidden sm:inline">
                                        {m === 2 ? '(Standar)' : m === 4 ? '(Populer)' : '(Hemat)'}
                                    </span>
                                </button>
                            {/each}
                        </div>
                    {:else}
                        <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2">
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                            <span>Lisensi freemium aktif selamanya tanpa biaya berlangganan.</span>
                        </div>
                    {/if}
                </div>

                <!-- Section 3: Voucher Code (if paid) -->
                {#if basePrice > 0}
                    <div class="space-y-2 pt-4 border-t border-[var(--border)] dark:border-[#22314d]">
                        <label for="voucher-input" class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                            Kupon Promo (Opsional)
                        </label>

                        <div class="flex gap-2">
                            <div class="relative flex-1">
                                <input
                                    id="voucher-input"
                                    type="text"
                                    bind:value={voucherCode}
                                    disabled={loading || submitting || voucherApplied}
                                    placeholder="Masukkan kode promo (contoh: DISKON50)"
                                    class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 rounded-xl px-3.5 py-2 text-[var(--text)] dark:text-white text-xs font-mono uppercase focus:outline-none focus:border-blue-500 disabled:opacity-75"
                                />
                                {#if voucherApplied}
                                    <button
                                        type="button"
                                        on:click={removeVoucher}
                                        class="absolute right-2.5 top-2 text-slate-400 hover:text-rose-500 transition-colors p-0.5 cursor-pointer bg-transparent border-0"
                                        title="Hapus kupon"
                                    >
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                {/if}
                            </div>

                            {#if voucherApplied}
                                <button
                                    type="button"
                                    on:click={removeVoucher}
                                    class="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1"
                                >
                                    <span>Hapus</span>
                                </button>
                            {:else}
                                <button
                                    type="button"
                                    on:click={checkVoucher}
                                    disabled={loading || submitting || checkingVoucher || !voucherCode.trim()}
                                    class="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center justify-center gap-1.5 min-w-[85px] border-0 shadow-2xs"
                                >
                                    {#if checkingVoucher}
                                        <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                        <span>Cek...</span>
                                    {:else}
                                        <span>Terapkan</span>
                                    {/if}
                                </button>
                            {/if}
                        </div>

                        {#if voucherMsg}
                            <div class="p-2.5 rounded-xl {voucherDiscount > 0 ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400'} text-xs font-semibold flex items-center justify-between animate-fade-in">
                                <span class="flex items-center gap-1.5">
                                    {#if voucherDiscount > 0}
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                                    {:else}
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                                    {/if}
                                    <span>{voucherMsg}</span>
                                </span>
                                {#if voucherDiscount > 0}
                                    <span class="font-mono font-bold text-emerald-500">- {formatRupiah(voucherDiscount)}</span>
                                {/if}
                            </div>
                        {/if}
                    </div>
                {/if}
            </div>

            <!-- Right Column: Receipt-Style Checkout Summary (lg:col-span-5 xl:col-span-4) -->
            <div class="lg:col-span-5 xl:col-span-4 space-y-4 lg:sticky lg:top-6">
                <form on:submit={handleOrderSubmit} class="p-5 sm:p-6 rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] shadow-md space-y-4">
                    <div class="flex items-center justify-between pb-3 border-b border-[var(--border)] dark:border-[#22314d]">
                        <span class="text-xs font-extrabold text-[var(--text)] dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                            <svg class="w-4 h-4 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                            </svg>
                            <span>Ringkasan Pembayaran</span>
                        </span>
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--surface-2)] dark:bg-slate-800 text-[var(--text-3)] dark:text-slate-400 border border-[var(--border)] dark:border-slate-700">
                            {basePrice === 0 ? 'Gratis' : 'Invoice'}
                        </span>
                    </div>

                    <!-- Line items -->
                    <div class="space-y-2 text-xs font-mono">
                        <div class="flex items-center justify-between text-[var(--text-2)] dark:text-slate-400 font-sans">
                            <span>Software:</span>
                            <span class="font-bold text-[var(--text)] dark:text-white truncate max-w-[150px] text-right font-sans">
                                {selectedProduct ? selectedProduct.name : '-'}
                            </span>
                        </div>

                        <div class="flex items-center justify-between text-[var(--text-2)] dark:text-slate-400">
                            <span class="font-sans">Durasi:</span>
                            <span class="text-[var(--text)] dark:text-white">{basePrice === 0 ? 'Permanen' : `${duration} Bulan`}</span>
                        </div>

                        <div class="flex items-center justify-between text-[var(--text-2)] dark:text-slate-400">
                            <span class="font-sans">Harga Satuan:</span>
                            <span>{formatRupiah(basePrice)}</span>
                        </div>

                        {#if hasProductDiscount}
                            <div class="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                                <span class="font-sans">Diskon Produk ({productDiscountPercent}%):</span>
                                <span>- {formatRupiah(Math.round(basePrice * (productDiscountPercent / 100)))}</span>
                            </div>
                        {/if}

                        {#if voucherDiscount > 0}
                            <div class="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
                                <span class="font-sans">Kupon ({voucherCode.toUpperCase()}):</span>
                                <span>- {formatRupiah(voucherDiscount)}</span>
                            </div>
                        {/if}
                    </div>

                    <!-- Total Calculation -->
                    <div class="pt-3.5 border-t border-dashed border-[var(--border)] dark:border-slate-700 space-y-1">
                        <div class="flex items-baseline justify-between">
                            <span class="text-xs font-bold text-[var(--text-2)] dark:text-slate-300">Total Tagihan:</span>
                            <div class="text-right">
                                <div class="text-xl sm:text-2xl font-black font-mono text-[var(--text)] dark:text-white">
                                    {formatRupiah(finalTotal)}
                                </div>
                                {#if totalSavedAmount > 0}
                                    <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold block">
                                        Hemat {formatRupiah(totalSavedAmount)} ({totalSavedPercent}%)
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </div>

                    <!-- Primary CTA Button -->
                    <button
                        type="submit"
                        disabled={loading || submitting}
                        class="w-full py-3 px-4 rounded-xl font-bold text-xs sm:text-sm {finalTotal === 0 ? 'bg-emerald-600 hover:bg-emerald-500' : 'bg-blue-600 hover:bg-blue-500'} active:scale-[0.99] text-white transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 border-0 shadow-sm"
                    >
                        {#if submitting}
                            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>{finalTotal === 0 ? 'Mengaktifkan...' : 'Memproses...'}</span>
                        {:else if loading}
                            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Memuat...</span>
                        {:else if finalTotal === 0}
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M5 13l4 4L19 7" /></svg>
                            <span>Klaim Lisensi Gratis</span>
                        {:else}
                            <span>Buat Pesanan & Bayar</span>
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M14 5l7 7m0 0l-7 7m7-7H3"/></svg>
                        {/if}
                    </button>

                    <!-- Clean Trust Specifications -->
                    <div class="pt-3 border-t border-[var(--border)] dark:border-[#22314d] space-y-1.5 text-[11px] text-[var(--text-3)] dark:text-slate-400">
                        <div class="flex items-center gap-1.5">
                            <span class="text-emerald-500 font-bold">✔</span>
                            <span>Aktivasi instan via sistem otomatis</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-emerald-500 font-bold">✔</span>
                            <span>Terikat aman dengan Machine ID PC Anda</span>
                        </div>
                        <div class="flex items-center gap-1.5">
                            <span class="text-emerald-500 font-bold">✔</span>
                            <span>Termasuk update rilis software berkala</span>
                        </div>
                    </div>
                </form>

                <!-- Clean Tutorial Banner if exists -->
                {#if hasTutorials(selectedProduct)}
                    <div class="p-3.5 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-3 text-xs">
                        <div class="min-w-0">
                            <span class="font-bold text-[var(--text)] dark:text-white block truncate">Panduan Video Tersedia</span>
                            <span class="text-[11px] text-[var(--text-3)] dark:text-slate-400 block truncate">Pelajari cara pakai software ini</span>
                        </div>
                        <a
                            href="#/member/tutorials/{selectedProduct.id}"
                            class="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center gap-1 flex-shrink-0 transition-colors"
                        >
                            <span>Tonton</span>
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
                        </a>
                    </div>
                {/if}
            </div>
        </div>
    </main>
</Layout>

<!-- Modal Sukses Pembelian / Klaim Lisensi -->
{#if successModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in" role="dialog" aria-modal="true">
        <div class="w-full max-w-md rounded-2xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] shadow-2xl p-6 text-center space-y-4 text-[var(--text)] dark:text-white">
            <div class="w-12 h-12 rounded-xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center mx-auto text-xl">
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <div class="space-y-1">
                <h3 class="text-base sm:text-lg font-bold text-[var(--text)] dark:text-white">
                    {successIsFree ? 'Lisensi Gratis Berhasil Diaktifkan!' : 'Pesanan Berhasil Dibuat!'}
                </h3>
                <p class="text-xs text-[var(--text-3)] dark:text-slate-400 leading-relaxed">
                    {successIsFree ? 'Lisensi software Anda telah aktif dan siap digunakan.' : 'Pesanan Anda telah dicatat di sistem. Anda dapat melihat tagihan dan menyelesaikan pembayaran melalui daftar pesanan.'}
                </p>
            </div>

            <div class="space-y-2 pt-2">
                <button
                    type="button"
                    on:click={() => { successModalOpen = false; window.location.hash = successRedirectUrl.replace('/#', ''); }}
                    class="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs inline-flex items-center justify-center gap-2 transition-all shadow-sm cursor-pointer border-0"
                >
                    <span>{successIsFree ? 'Buka Lisensi Saya →' : 'Lihat Pesanan Saya →'}</span>
                </button>

                {#if successPaymentUrl}
                    <a
                        href={successPaymentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        on:click={() => successModalOpen = false}
                        class="w-full py-2 px-4 rounded-xl bg-[var(--surface-2)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 hover:border-[var(--brand)] text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white font-semibold text-xs inline-flex items-center justify-center gap-1.5 transition-all"
                    >
                        <span>Bayar Sekarang (Buka Tab Baru)</span>
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                {/if}
            </div>
        </div>
    </div>
{/if}
