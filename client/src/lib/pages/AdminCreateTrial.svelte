<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import { fade } from 'svelte/transition';
    import AdminLayout from '../components/AdminLayout.svelte';
    import CustomDropdown from '../components/CustomDropdown.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';

    interface ProductItem {
        id: number;
        name: string;
        price: number;
        image?: string;
        is_active?: boolean;
    }

    interface CreatedTrialResult {
        token: string;
        product: string;
        productImage?: string | null;
        duration: number;
        unit: string;
        unitLabel: string;
        clientPhone?: string;
    }

    // Page state
    let loading: boolean = true;
    let products: ProductItem[] = [];
    let error: string = '';
    let successToast: string = '';
    let toastTimer: any = null;

    // Form Generator state
    let selectedProductId: number = 0;
    let duration: number = 3;
    let unit: string = 'day';
    let clientPhone: string = '';
    let isSubmitting: boolean = false;

    // Modal state
    let successModalOpen: boolean = false;
    let createdResult: CreatedTrialResult | null = null;
    let copiedToken: boolean = false;
    let copiedTemplate: boolean = false;
    let showMessagePreview: boolean = false;
    let modalImgError: boolean = false;

    const unitOptions: OptionItem[] = [
        { value: 'hour', label: 'Jam' },
        { value: 'day', label: 'Hari' },
        { value: 'month', label: 'Bulan' },
        { value: 'year', label: 'Tahun' }
    ];

    const durationPresets = [
        { label: '1 Hari', duration: 1, unit: 'day' },
        { label: '3 Hari', duration: 3, unit: 'day' },
        { label: '7 Hari', duration: 7, unit: 'day' },
        { label: '14 Hari', duration: 14, unit: 'day' },
        { label: '1 Bulan', duration: 1, unit: 'month' },
        { label: '3 Bulan', duration: 3, unit: 'month' },
        { label: '6 Bulan', duration: 6, unit: 'month' },
        { label: '1 Tahun', duration: 1, unit: 'year' },
    ];

    $: selectedProductObj = products.find(p => p.id === selectedProductId) || products[0];
    $: selectedProduct = selectedProductObj ? selectedProductObj.name : '';
    $: unitLabel = unitOptions.find(u => u.value === unit)?.label || unit;

    function isValidImg(url: string | null | undefined): boolean {
        if (!url || typeof url !== 'string') return false;
        const trimmed = url.trim();
        if (!trimmed) return false;
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/favicon') || trimmed.startsWith('data:image/');
    }

    function showToast(msg: string) {
        successToast = msg;
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { successToast = ''; }, 3000);
    }

    function cleanPhoneNumber(phone: string): string {
        let p = phone.replace(/[^0-9]/g, '');
        if (p.startsWith('0')) p = '62' + p.slice(1);
        else if (p.startsWith('8')) p = '62' + p;
        return p;
    }

    function getWhatsAppMessage(result: CreatedTrialResult): string {
        return `Halo! Berikut adalah kode lisensi uji coba (trial) untuk software Anda:\n\n` +
               `• Software: ${result.product}\n` +
               `• Kode Token: ${result.token}\n` +
               `• Durasi: ${result.duration} ${result.unitLabel}\n` +
               `• Masa Aktif: Dihitung mulai aktivasi pertama di aplikasi\n\n` +
               `Cara Aktivasi:\n` +
               `1. Buka aplikasi ${result.product} di komputer Anda.\n` +
               `2. Masukkan kode token di atas pada menu aktivasi lisensi.\n` +
               `3. Klik tombol Aktivasi.\n\n` +
               `Catatan:\n` +
               `• Lisensi terkunci otomatis pada 1 perangkat komputer pertama.\n` +
               `• Pastikan perangkat terhubung ke internet saat proses aktivasi.\n\n` +
               `Jika membutuhkan bantuan atau ingin berlangganan lisensi penuh, silakan hubungi kami kembali. Terima kasih!`;
    }

    function getWhatsAppDirectUrl(result: CreatedTrialResult, phone?: string): string {
        const targetPhone = cleanPhoneNumber(phone || clientPhone || '');
        const text = encodeURIComponent(getWhatsAppMessage(result));
        if (targetPhone) {
            return `https://wa.me/${targetPhone}?text=${text}`;
        }
        return `https://wa.me/?text=${text}`;
    }

    onMount(async () => {
        await loadProducts();
    });

    onDestroy(() => {
        if (toastTimer) clearTimeout(toastTimer);
        if (copyTokenTimer) clearTimeout(copyTokenTimer);
        if (copyTemplateTimer) clearTimeout(copyTemplateTimer);
    });

    async function loadProducts() {
        loading = true;
        error = '';
        try {
            const res = await fetch('/admin/api/trials/products', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/#/admin/login';
                return;
            }

            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data) {
                products = json.data.products || [];
                if (products.length > 0 && !selectedProductId) {
                    selectedProductId = products[0].id;
                }
            } else {
                error = json.message || 'Gagal memuat data produk.';
            }
        } catch (err) {
            console.error('Fetch trial products error:', err);
            error = 'Terjadi kesalahan jaringan saat memuat data produk.';
        } finally {
            loading = false;
        }
    }

    function applyPreset(presetDuration: number, presetUnit: string) {
        duration = presetDuration;
        unit = presetUnit;
    }

    function stepDuration(delta: number) {
        duration = Math.max(1, Math.min(365, duration + delta));
    }

    async function handleSubmit(e: Event) {
        e.preventDefault();
        if (!selectedProduct || duration <= 0) {
            error = 'Pilih software dan masukkan durasi yang valid.';
            return;
        }

        isSubmitting = true;
        error = '';

        try {
            const res = await fetch('/admin/api/trials/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    product: selectedProduct,
                    duration: duration,
                    unit: unit
                })
            });

            const json = await res.json();
            if (res.ok && json.status === 'success' && (json.code || json.data?.token)) {
                const tokenCode = json.code || json.data?.token;
                modalImgError = false;
                createdResult = {
                    token: tokenCode,
                    product: selectedProduct,
                    productImage: selectedProductObj?.image || null,
                    duration: duration,
                    unit: unit,
                    unitLabel: unitLabel,
                    clientPhone: clientPhone.trim() || undefined
                };
                copiedToken = false;
                copiedTemplate = false;
                showMessagePreview = false;
                successModalOpen = true;
            } else {
                error = json.message || 'Gagal membuat token trial.';
            }
        } catch (err) {
            console.error('Submit trial error:', err);
            error = 'Terjadi kesalahan jaringan saat membuat token trial.';
        } finally {
            isSubmitting = false;
        }
    }

    let copyTokenTimer: ReturnType<typeof setTimeout> | null = null;
    let copyTemplateTimer: ReturnType<typeof setTimeout> | null = null;

    function copyTokenOnly(token: string) {
        if (!token) return;
        navigator.clipboard.writeText(token);
        copiedToken = true;
        showToast('Token lisensi berhasil disalin');
        if (copyTokenTimer) clearTimeout(copyTokenTimer);
        copyTokenTimer = setTimeout(() => { copiedToken = false; }, 2500);
    }

    function copyClientTemplate(result: CreatedTrialResult) {
        if (!result) return;
        const msg = getWhatsAppMessage(result);
        navigator.clipboard.writeText(msg);
        copiedTemplate = true;
        showToast('Format pesan WhatsApp berhasil disalin');
        if (copyTemplateTimer) clearTimeout(copyTemplateTimer);
        copyTemplateTimer = setTimeout(() => { copiedTemplate = false; }, 2500);
    }

    function resetFormForNewToken() {
        successModalOpen = false;
        clientPhone = '';
    }
</script>

<svelte:head>
    <title>Buat Token Trial - Admin Panel</title>
</svelte:head>

<AdminLayout activePage="create-trial" eyebrow="PANEL ADMIN">
    <main class="flex-1 p-4 sm:p-6 md:p-8 max-w-3xl w-full mx-auto space-y-5">
        <!-- Toast Feedback Notification -->
        {#if successToast}
            <div class="fixed top-20 right-4 sm:right-6 z-50 flex items-center gap-2.5 px-4 py-3 bg-slate-900 border border-emerald-500/40 text-emerald-400 rounded-2xl shadow-xl backdrop-blur-md animate-fade-in text-xs sm:text-sm font-semibold">
                <svg class="w-4 h-4 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{successToast}</span>
            </div>
        {/if}

        <!-- Clean Header -->
        <div class="space-y-1">
            <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-3)] uppercase tracking-wider">
                <span>Manajemen Lisensi</span>
                <span>/</span>
                <span class="text-[var(--brand)]">Token Trial</span>
            </div>
            <h1 class="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">
                Buat Token Trial
            </h1>
            <p class="text-xs sm:text-sm text-[var(--text-3)]">
                Terbitkan kode lisensi uji coba untuk calon klien secara instan.
            </p>
        </div>

        <!-- Global Error Banner -->
        {#if error}
            <div class="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs sm:text-sm flex items-center justify-between shadow-xs">
                <div class="flex items-center gap-2.5">
                    <svg class="w-4 h-4 flex-shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{error}</span>
                </div>
                <button type="button" on:click={() => error = ''} class="text-xs font-bold underline cursor-pointer bg-transparent border-0 text-rose-500">
                    Tutup
                </button>
            </div>
        {/if}

        <!-- Main Form Card -->
        <div class="rounded-3xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs p-5 sm:p-7 space-y-6">
            <form on:submit={handleSubmit} class="space-y-5">
                <!-- 1. Software Selector -->
                <div>
                    <label for="productSelectDropdown" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-2">
                        Pilih Software <span class="text-rose-500">*</span>
                    </label>
                    <CustomDropdown
                        items={products}
                        bind:selectedId={selectedProductId}
                        loading={loading}
                        disabled={loading || isSubmitting}
                    />
                </div>

                <!-- 2. Preset Duration Buttons -->
                <div>
                    <div class="flex items-center justify-between mb-2">
                        <span class="text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                            Pilihan Durasi
                        </span>
                        <span class="text-[11px] text-[var(--text-3)]">Pilih preset</span>
                    </div>
                    <div class="grid grid-cols-4 sm:grid-cols-4 gap-2">
                        {#each durationPresets as p}
                            {@const isActive = duration === p.duration && unit === p.unit}
                            <button
                                type="button"
                                on:click={() => applyPreset(p.duration, p.unit)}
                                class="py-2.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer border text-center {isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-[var(--surface-2)] text-[var(--text-2)] border-[var(--border)] hover:border-blue-500/50 hover:text-[var(--text)] active:scale-95'}"
                            >
                                {p.label}
                            </button>
                        {/each}
                    </div>
                </div>

                <!-- 3. Custom Duration Stepper & Unit -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                        <label for="durationInput" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                            Jumlah Durasi
                        </label>
                        <div class="flex items-center rounded-xl bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden shadow-xs">
                            <button
                                type="button"
                                on:click={() => stepDuration(-1)}
                                class="w-10 h-10 flex items-center justify-center text-sm font-bold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors cursor-pointer border-0 bg-transparent shrink-0"
                                aria-label="Kurangi durasi"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M20 12H4" />
                                </svg>
                            </button>
                            <input
                                id="durationInput"
                                type="number"
                                min="1"
                                max="365"
                                required
                                bind:value={duration}
                                class="flex-1 w-full text-center py-2 text-xs sm:text-sm text-[var(--text)] font-bold bg-transparent border-0 focus:outline-none"
                            />
                            <button
                                type="button"
                                on:click={() => stepDuration(1)}
                                class="w-10 h-10 flex items-center justify-center text-sm font-bold text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--border)] transition-colors cursor-pointer border-0 bg-transparent shrink-0"
                                aria-label="Tambah durasi"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    <div>
                        <span class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                            Satuan Waktu
                        </span>
                        <CustomSelect
                            options={unitOptions}
                            bind:value={unit}
                            fullWidth={true}
                        />
                    </div>
                </div>

                <!-- 4. Optional Client WhatsApp Number -->
                <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-1.5">
                    <label for="clientPhoneInput" class="flex items-center justify-between text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                        <span class="flex items-center gap-1.5">
                            <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                            </svg>
                            <span>Nomor WhatsApp Klien</span>
                        </span>
                        <span class="text-[10px] text-[var(--text-3)] lowercase font-normal">opsional</span>
                    </label>
                    <div class="flex items-center rounded-xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden shadow-xs focus-within:border-blue-500 transition-colors">
                        <span class="px-3 py-2 text-xs font-mono font-bold text-[var(--text-3)] bg-[var(--surface-2)] border-r border-[var(--border)]">
                            +62
                        </span>
                        <input
                            id="clientPhoneInput"
                            type="tel"
                            placeholder="Contoh: 081234567890"
                            bind:value={clientPhone}
                            class="flex-1 px-3 py-2 text-xs sm:text-sm text-[var(--text)] font-semibold bg-transparent border-0 focus:outline-none"
                        />
                    </div>
                    <p class="text-[11px] text-[var(--text-3)]">
                        Jika diisi, Anda bisa langsung membuka chat WhatsApp dengan format pesan lisensi siap kirim.
                    </p>
                </div>

                <!-- 5. Configuration Summary Row -->
                <div class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between gap-3 text-xs">
                    <div class="flex items-center gap-2.5 min-w-0">
                        <div class="w-8 h-8 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-500 font-bold text-xs flex items-center justify-center shrink-0">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div class="min-w-0">
                            <div class="font-bold text-[var(--text)] truncate">
                                {selectedProduct || 'Pilih software'}
                            </div>
                            <div class="text-[11px] text-[var(--text-3)]">
                                Masa aktif: {duration} {unitLabel} (mulai saat diaktifkan di PC)
                            </div>
                        </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 shrink-0">
                        Siap Dibuat
                    </span>
                </div>

                <!-- 6. Primary Action Button -->
                <div class="pt-2">
                    <button
                        type="submit"
                        disabled={isSubmitting || loading || !selectedProduct}
                        class="w-full py-3.5 px-6 rounded-2xl font-bold text-xs sm:text-sm bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md shadow-blue-600/20 transition-all disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2 border-0"
                    >
                        {#if isSubmitting}
                            <div class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            <span>Membuat Token...</span>
                        {:else}
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            <span>Buat Token Trial Sekarang</span>
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </main>
</AdminLayout>

<!-- ================= ELEGANT SUCCESS MODAL ================= -->
{#if successModalOpen && createdResult}
    <div
        class="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 backdrop-blur-sm animate-fade-in"
        role="dialog"
        aria-modal="true"
    >
        <div class="w-full max-w-md rounded-t-3xl sm:rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl overflow-hidden flex flex-col text-slate-800 dark:text-slate-100 animate-scale-in max-h-[92vh]">
            <!-- Modal Header -->
            <div class="p-5 text-center space-y-2 border-b border-slate-200 dark:border-[#22314d] bg-slate-50 dark:bg-[#0c1426] relative">
                <div class="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                </div>
                <div>
                    <h3 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                        Token Trial Berhasil Dibuat
                    </h3>
                    <p class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        Kode lisensi siap digunakan dan dikirimkan ke klien.
                    </p>
                </div>
                <button
                    type="button"
                    on:click={() => successModalOpen = false}
                    class="absolute right-4 top-4 w-8 h-8 rounded-xl bg-slate-200/60 dark:bg-slate-800 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer border-0"
                    aria-label="Tutup Modal"
                >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Modal Body -->
            <div class="p-5 space-y-4 overflow-y-auto">
                <!-- Software & Duration Chip -->
                <div class="p-3 rounded-2xl bg-slate-100 dark:bg-[#16233f] border border-slate-200 dark:border-[#22314d] flex items-center justify-between gap-3">
                    <div class="min-w-0">
                        <span class="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Software</span>
                        <div class="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                            {createdResult.product}
                        </div>
                    </div>
                    <span class="px-2.5 py-1 rounded-xl text-xs font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 shrink-0">
                        {createdResult.duration} {createdResult.unitLabel}
                    </span>
                </div>

                <!-- Hero Token Display Card -->
                <div class="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2 text-white">
                    <div class="flex items-center justify-between text-[11px] text-slate-400">
                        <span class="font-semibold uppercase tracking-wider">Kode Lisensi Token</span>
                        <span class="text-emerald-400 font-semibold flex items-center gap-1">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Aktif
                        </span>
                    </div>

                    <div class="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 shadow-inner">
                        <span class="font-mono font-bold text-sm sm:text-base text-blue-400 tracking-wider truncate select-all">
                            {createdResult.token}
                        </span>
                        <button
                            type="button"
                            on:click={() => copyTokenOnly(createdResult?.token || '')}
                            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border-0 flex items-center gap-1.5 shrink-0 {copiedToken ? 'bg-emerald-600 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'}"
                        >
                            {#if copiedToken}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Tersalin</span>
                            {:else}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                <span>Salin</span>
                            {/if}
                        </button>
                    </div>
                </div>

                <!-- Action Dispatch Buttons -->
                <div class="space-y-2.5">
                    <!-- WhatsApp Direct Link -->
                    <a
                        href={getWhatsAppDirectUrl(createdResult, createdResult.clientPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        class="w-full py-3 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white text-center shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                        </svg>
                        <span>Kirim ke WhatsApp</span>
                    </a>

                    <!-- Copy WA Template Button -->
                    <button
                        type="button"
                        on:click={() => copyClientTemplate(createdResult)}
                        class="w-full py-2.5 px-4 rounded-xl text-xs font-semibold bg-slate-100 dark:bg-[#16233f] hover:bg-slate-200 dark:hover:bg-[#1c2c4f] text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-[#22314d] flex items-center justify-center gap-2 transition-colors cursor-pointer"
                    >
                        <svg class="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                        <span>{copiedTemplate ? 'Format Pesan Tersalin!' : 'Salin Format Pesan WA'}</span>
                    </button>

                    <!-- Collapsible Message Preview -->
                    <div class="rounded-xl border border-slate-200 dark:border-[#22314d] overflow-hidden text-xs">
                        <button
                            type="button"
                            on:click={() => showMessagePreview = !showMessagePreview}
                            class="w-full p-3 flex items-center justify-between text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-[#0c1426] transition-colors cursor-pointer border-0 text-left font-medium"
                        >
                            <span>Lihat isi draft pesan</span>
                            <svg class="w-3.5 h-3.5 transform transition-transform {showMessagePreview ? 'rotate-180' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                            </svg>
                        </button>

                        {#if showMessagePreview}
                            <div in:fade={{ duration: 100 }} class="p-3 bg-white dark:bg-[#111c35] text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed font-sans whitespace-pre-line border-t border-slate-200 dark:border-[#22314d] max-h-40 overflow-y-auto select-all">
                                {getWhatsAppMessage(createdResult)}
                            </div>
                        {/if}
                    </div>
                </div>
            </div>

            <!-- Modal Footer -->
            <div class="p-3.5 sm:p-4 border-t border-slate-200 dark:border-[#22314d] bg-slate-50 dark:bg-[#0c1426] flex items-center justify-between gap-2">
                <button
                    type="button"
                    on:click={resetFormForNewToken}
                    class="flex-1 py-2.5 rounded-xl text-xs font-semibold bg-white dark:bg-[#16233f] border border-slate-200 dark:border-[#22314d] text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1c2c4f] transition-colors cursor-pointer"
                >
                    + Buat Token Lain
                </button>
                <button
                    type="button"
                    on:click={() => successModalOpen = false}
                    class="flex-1 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
                >
                    Selesai
                </button>
            </div>
        </div>
    </div>
{/if}
