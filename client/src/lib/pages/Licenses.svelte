<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import Layout from '../components/Layout.svelte';
    import CustomSelect from '../components/CustomSelect.svelte';
    import CustomCheckbox from '../components/CustomCheckbox.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';

    interface InstallerFileInfo {
        id: string;
        filename: string;
        url: string;
        size: string;
        bytes?: number;
        uploaded_at?: number;
        os?: 'windows' | 'mac';
    }

    interface InstallerFilesGroup {
        windows: InstallerFileInfo[];
        mac: InstallerFileInfo[];
    }

    interface LicenseRow {
        id: number;
        key: string;
        product: string;
        productId?: number | null;
        image?: string | null;
        hasTutorials?: boolean;
        installer_files?: InstallerFilesGroup;
        status: 'active' | 'unused' | 'expired';
        statusText: string;
        message: string;
        machineId: string;
        is_applied: boolean;
        duration: string;
        created: string;
        activated_at_formatted?: string | null;
        expires_at_formatted?: string | null;
        remaining_days: number;
        orderId: number;
    }

    interface PaginationMeta {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
    }

    interface StatusCounts {
        all: number;
        active: number;
        unused: number;
        expired: number;
    }

    let licenses: LicenseRow[] = [];
    let pagination: PaginationMeta = { page: 1, pageSize: 10, totalItems: 0, totalPages: 1 };
    let counts: StatusCounts = { all: 0, active: 0, unused: 0, expired: 0 };
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
    let statusFilter: 'all' | 'active' | 'unused' | 'expired' = 'all';
    let sortBy: 'created' | 'product' | 'duration' | 'remaining' = 'created';
    let sortOrder: 'asc' | 'desc' = 'desc';

    let searchTimeout: any = null;
    let copyKeyTimer: ReturnType<typeof setTimeout> | null = null;
    let copyHwidTimer: ReturnType<typeof setTimeout> | null = null;
    let copiedKeyId: number | null = null;
    let copiedHwidId: number | null = null;

    // Download Modal State
    let showDownloadModal: boolean = false;
    let selectedLicenseForDownload: LicenseRow | null = null;
    let downloadOsFilter: 'all' | 'windows' | 'mac' = 'all';

    // HWID Edit Modal State
    interface HwidStatusData {
        token_id: number;
        product: string;
        current_hwid: string;
        changesToday: number;
        maxChangesPerDay: number;
        remainingChangesToday: number;
        canChange: boolean;
        cooldownSecondsRemaining: number;
        nextAllowedTimestamp: number;
        lastChangedAt: number | null;
        recentHistory: Array<{ id: number; old_hwid: string; new_hwid: string; created_at: number }>;
    }

    let showHwidModal: boolean = false;
    let selectedLicenseForHwid: LicenseRow | null = null;
    let newHwidInput: string = '';
    let confirmUnderstood: boolean = false;
    let hwidStatus: HwidStatusData | null = null;
    let loadingHwidStatus: boolean = false;
    let savingHwid: boolean = false;
    let hwidModalError: string = '';
    let hwidModalSuccess: string = '';
    let countdownInterval: ReturnType<typeof setInterval> | null = null;
    let cooldownRemaining: number = 0;

    const pageSizeOptions = [
        { value: 10, label: '10 / hal' },
        { value: 25, label: '25 / hal' },
        { value: 50, label: '50 / hal' }
    ];

    async function fetchLicenses() {
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

            const res = await fetch(`/member/api/licenses?${params.toString()}`, {
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
                    licenses = json.data.licenses || [];
                    pagination = json.data.pagination || pagination;
                    counts = json.data.counts || counts;
                }
            }
        } catch (e) {
            console.error('Gagal mengambil data lisensi:', e);
        } finally {
            loading = false;
        }
    }

    function handleSearchInput() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            pagination.page = 1;
            fetchLicenses();
        }, 300);
    }

    function setStatusFilter(status: 'all' | 'active' | 'unused' | 'expired') {
        if (statusFilter === status) return;
        statusFilter = status;
        pagination.page = 1;
        fetchLicenses();
    }

    function toggleSort(field: 'created' | 'product' | 'duration' | 'remaining') {
        if (sortBy === field) {
            sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
        } else {
            sortBy = field;
            sortOrder = field === 'product' ? 'asc' : 'desc';
        }
        pagination.page = 1;
        fetchLicenses();
    }

    function goToPage(p: number) {
        if (p < 1 || p > pagination.totalPages || p === pagination.page) return;
        pagination.page = p;
        fetchLicenses();
    }

    function handlePageSizeChange(e: CustomEvent<number | string>) {
        pagination.pageSize = Number(e.detail);
        pagination.page = 1;
        fetchLicenses();
    }

    async function copyKey(licId: number, keyText: string) {
        try {
            await navigator.clipboard.writeText(keyText);
            copiedKeyId = licId;
            if (copyKeyTimer) clearTimeout(copyKeyTimer);
            copyKeyTimer = setTimeout(() => {
                if (copiedKeyId === licId) copiedKeyId = null;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy license key:', err);
        }
    }

    async function copyHwid(licId: number, hwidText: string) {
        if (!hwidText || hwidText === '-') return;
        try {
            await navigator.clipboard.writeText(hwidText);
            copiedHwidId = licId;
            if (copyHwidTimer) clearTimeout(copyHwidTimer);
            copyHwidTimer = setTimeout(() => {
                if (copiedHwidId === licId) copiedHwidId = null;
            }, 2000);
        } catch (err) {
            console.error('Failed to copy HWID:', err);
        }
    }

    // Download Modal Handlers
    function openDownloadModal(license: LicenseRow) {
        selectedLicenseForDownload = license;
        downloadOsFilter = 'all';
        showDownloadModal = true;
    }

    function closeDownloadModal() {
        showDownloadModal = false;
        selectedLicenseForDownload = null;
    }

    // HWID Edit Modal Handlers
    async function openHwidModal(license: LicenseRow) {
        selectedLicenseForHwid = license;
        newHwidInput = '';
        confirmUnderstood = false;
        hwidModalError = '';
        hwidModalSuccess = '';
        showHwidModal = true;
        loadingHwidStatus = true;
        hwidStatus = null;

        if (countdownInterval) clearInterval(countdownInterval);

        try {
            const res = await fetch(`/member/api/licenses/hwid-status?token_id=${license.id}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (res.ok) {
                const json = await res.json();
                if (json.status === 'success' && json.data) {
                    hwidStatus = json.data;
                    cooldownRemaining = json.data.cooldownSecondsRemaining || 0;
                    if (cooldownRemaining > 0) {
                        startCooldownTimer();
                    }
                } else {
                    hwidModalError = json.message || 'Gagal memeriksa status Machine ID';
                }
            } else {
                const errData = await res.json().catch(() => null);
                hwidModalError = errData?.message || 'Gagal memuat status lisensi';
            }
        } catch (e) {
            hwidModalError = 'Terjadi kesalahan jaringan saat memuat data.';
        } finally {
            loadingHwidStatus = false;
        }
    }

    function startCooldownTimer() {
        if (countdownInterval) clearInterval(countdownInterval);
        countdownInterval = setInterval(() => {
            if (cooldownRemaining > 0) {
                cooldownRemaining -= 1;
            } else {
                if (countdownInterval) clearInterval(countdownInterval);
                if (hwidStatus) {
                    hwidStatus.canChange = hwidStatus.remainingChangesToday > 0;
                    hwidStatus.cooldownSecondsRemaining = 0;
                }
            }
        }, 1000);
    }

    function formatCooldownText(seconds: number): string {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m} menit ${s < 10 ? '0' + s : s} detik`;
    }

    function closeHwidModal() {
        showHwidModal = false;
        selectedLicenseForHwid = null;
        if (countdownInterval) clearInterval(countdownInterval);
    }

    async function handleSaveHwid() {
        if (!selectedLicenseForHwid || !newHwidInput.trim()) return;
        if (!confirmUnderstood) {
            hwidModalError = 'Harap centang konfirmasi persetujuan ketentuan sebelum melanjutkan.';
            return;
        }

        savingHwid = true;
        hwidModalError = '';
        hwidModalSuccess = '';

        try {
            const res = await fetch('/member/api/licenses/update-hwid', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    token_id: selectedLicenseForHwid.id,
                    new_hwid: newHwidInput.trim()
                }),
                credentials: 'include'
            });

            const data = await res.json();
            if (res.ok && data.status === 'success') {
                hwidModalSuccess = data.message || 'Machine ID berhasil diperbarui!';
                fetchLicenses();
                setTimeout(() => {
                    closeHwidModal();
                }, 1500);
            } else {
                hwidModalError = data.message || 'Gagal memperbarui Machine ID.';
                if (data.cooldownSecondsRemaining) {
                    cooldownRemaining = data.cooldownSecondsRemaining;
                    startCooldownTimer();
                }
            }
        } catch (e) {
            hwidModalError = 'Terjadi kesalahan jaringan saat menyimpan Machine ID.';
        } finally {
            savingHwid = false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            if (showDownloadModal) closeDownloadModal();
            if (showHwidModal) closeHwidModal();
        }
    }

    onDestroy(() => {
        if (countdownInterval) clearInterval(countdownInterval);
        if (copyKeyTimer) clearTimeout(copyKeyTimer);
        if (copyHwidTimer) clearTimeout(copyHwidTimer);
    });


    function getFileExtensionBadge(filename: string): string {
        const lower = filename.toLowerCase();
        if (lower.endsWith('.exe')) return 'EXE';
        if (lower.endsWith('.dmg')) return 'DMG';
        if (lower.endsWith('.zip')) return 'ZIP';
        if (lower.endsWith('.rar')) return 'RAR';
        if (lower.endsWith('.7z')) return '7Z';
        return 'FILE';
    }

    // Generate page numbers array with ellipsis
    $: pageNumbers = (() => {
        const current = pagination.page;
        const total = pagination.totalPages;
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        if (current <= 4) {
            return [1, 2, 3, 4, 5, '...', total];
        }
        if (current >= total - 3) {
            return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
        }
        return [1, '...', current - 1, current, current + 1, '...', total];
    })();

    $: startRowIndex = pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1;
    $: endRowIndex = Math.min(pagination.page * pagination.pageSize, pagination.totalItems);

    // Filtered Installer Files for Modal
    $: modalWindowsFiles = selectedLicenseForDownload?.installer_files?.windows || [];
    $: modalMacFiles = selectedLicenseForDownload?.installer_files?.mac || [];
    $: modalTotalFilesCount = modalWindowsFiles.length + modalMacFiles.length;

    $: statusTabs = [
        { id: 'all', label: 'Semua Lisensi', count: counts.all, color: 'brand' as const },
        { id: 'active', label: 'Aktif / Terpasang', count: counts.active, color: 'emerald' as const },
        { id: 'unused', label: 'Belum Dipakai', count: counts.unused, color: 'blue' as const },
        ...(counts.expired > 0 ? [{ id: 'expired', label: 'Kadaluarsa', count: counts.expired, color: 'rose' as const }] : [])
    ] as TabItem[];

    $: statusDropdownOptions = [
        { value: 'all', label: `Semua Lisensi (${counts.all})` },
        { value: 'active', label: `Aktif (${counts.active})` },
        { value: 'unused', label: `Siap Pakai (${counts.unused})` },
        ...(counts.expired > 0 ? [{ value: 'expired', label: `Kadaluarsa (${counts.expired})` }] : [])
    ];

    $: modalOsTabs = [
        { id: 'all', label: `Semua File (${modalTotalFilesCount})`, color: 'brand' as const },
        ...(modalWindowsFiles.length > 0 ? [{ id: 'windows', label: `Windows (${modalWindowsFiles.length})`, color: 'blue' as const }] : []),
        ...(modalMacFiles.length > 0 ? [{ id: 'mac', label: `macOS (${modalMacFiles.length})`, color: 'slate' as const }] : [])
    ] as TabItem[];

    $: displayedInstallerFiles = (() => {
        if (!selectedLicenseForDownload?.installer_files) return [];
        const winList = (modalWindowsFiles || []).map(f => ({ ...f, os: 'windows' as const }));
        const macList = (modalMacFiles || []).map(f => ({ ...f, os: 'mac' as const }));

        if (downloadOsFilter === 'windows') return winList;
        if (downloadOsFilter === 'mac') return macList;
        return [...winList, ...macList];
    })();

    onMount(() => {
        fetchLicenses();
        window.addEventListener('keydown', handleKeydown);
    });

    onDestroy(() => {
        if (searchTimeout) clearTimeout(searchTimeout);
        if (copyKeyTimer) clearTimeout(copyKeyTimer);
        if (copyHwidTimer) clearTimeout(copyHwidTimer);
        if (typeof window !== 'undefined') {
            window.removeEventListener('keydown', handleKeydown);
        }
    });
</script>

<Layout activePage="licenses" eyebrow="MANAJEMEN LISENSI & PERANGKAT">
    <main class="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
        <!-- Header Section -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
                <h1 class="text-2xl font-extrabold text-[var(--text)]">Lisensi & Perangkat</h1>
                <p class="text-[var(--text-3)] text-sm mt-1">Kelola lisensi software aktif, status validasi HWID, dan panduan penggunaan.</p>
            </div>
            <a href="#/member/orders/create" class="self-end md:self-auto bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center gap-2 shadow-md shadow-blue-500/20 border-0 flex-shrink-0">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                <span>Beli Lisensi Baru</span>
            </a>
        </div>

        <!-- Filter Status Tabs with Animated Sliding Pill (Desktop Only) -->
        <div class="hidden md:flex items-center gap-2 overflow-x-auto pb-1">
            <SegmentedTabs
                tabs={statusTabs}
                bind:activeTab={statusFilter}
                on:change={(e) => setStatusFilter(e.detail)}
            />
        </div>

        <!-- Table Container Card -->
        <div class="bg-[var(--surface)] shadow rounded-2xl border border-[var(--border)] dark:border-[#22314d] relative">
            <!-- Search & Controls Bar (Compact Single Line on Mobile & Desktop) -->
            <div class="p-3 sm:p-4 border-b border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-2.5 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-t-2xl relative z-20">
                <!-- Search Input (Flexible) -->
                <div class="flex-1 min-w-0 sm:max-w-xs md:w-80 md:flex-initial relative">
                    <input
                        type="text"
                        bind:value={searchQuery}
                        on:input={handleSearchInput}
                        placeholder="Cari App, License Key, Machine ID..."
                        class="w-full pl-8 pr-7 py-1.5 sm:py-2 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-slate-700 rounded-xl text-xs text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-[var(--brand)] transition-colors"
                    />
                    <svg class="w-3.5 h-3.5 text-[var(--text-3)] dark:text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    {#if searchQuery}
                        <button
                            type="button"
                            on:click={() => { searchQuery = ''; pagination.page = 1; fetchLicenses(); }}
                            class="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)] dark:text-slate-400 hover:text-[var(--text)] dark:hover:text-white bg-transparent border-0 cursor-pointer p-0.5"
                        >
                            &times;
                        </button>
                    {/if}
                </div>

                <!-- Right Side Control: Mobile Status Filter Dropdown (< md) / Desktop Total Count (>= md) -->
                <div class="shrink-0 flex items-center gap-2 sm:gap-3">
                    <!-- Mobile Status Filter Dropdown (< md) -->
                    <div class="block md:hidden">
                        <CustomSelect
                            options={statusDropdownOptions}
                            value={statusFilter}
                            fullWidth={false}
                            on:change={(e) => setStatusFilter(String(e.detail))}
                        />
                    </div>

                    <!-- Desktop Total Count (>= md) -->
                    <div class="hidden md:block text-xs text-[var(--text-3)] dark:text-slate-300 text-right whitespace-nowrap">
                        Total: <strong class="text-[var(--text)] dark:text-white font-bold">{pagination.totalItems}</strong> lisensi
                    </div>
                </div>
            </div>

            {#if loading}
                <div class="p-12 text-center text-[var(--text-3)] dark:text-slate-400 space-y-3">
                    <div class="w-8 h-8 mx-auto border-3 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
                    <p class="text-xs">Memuat daftar lisensi software Anda...</p>
                </div>
            {:else if licenses.length === 0}
                <div class="p-12 text-center space-y-4">
                    <div class="w-14 h-14 mx-auto rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 flex items-center justify-center text-[var(--text-3)] dark:text-slate-400">
                        <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-bold text-sm text-[var(--text)] dark:text-white">Tidak ada lisensi ditemukan</h3>
                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-1 max-w-sm mx-auto">
                            {#if searchQuery}
                                Tidak ada lisensi yang cocok dengan kata kunci "{searchQuery}".
                            {:else if statusFilter !== 'all'}
                                Tidak ada lisensi dengan status "{statusFilter === 'active' ? 'Aktif' : (statusFilter === 'unused' ? 'Belum Dipakai' : 'Kadaluarsa')}".
                            {:else}
                                Anda belum memiliki lisensi software aktif di Appcenter Ziqva.
                            {/if}
                        </p>
                    </div>
                    {#if !searchQuery && statusFilter === 'all'}
                        <a href="#/member/dashboard" class="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-xs font-bold rounded-xl hover:bg-blue-500 active:bg-blue-700 shadow-md shadow-blue-500/20 border-0">
                            Lihat Katalog Software
                        </a>
                    {/if}
                </div>
            {:else}
                <!-- 1. Mobile Card List (Visible on mobile < md screens, no horizontal scrolling needed) -->
                <div class="block md:hidden divide-y divide-[var(--border)] dark:divide-[#22314d]">
                    {#each licenses as license, idx (license.id)}
                        <div class="p-4 sm:p-5 space-y-3 {idx % 2 === 1 ? 'bg-slate-100/70 dark:bg-[#141f36]' : 'bg-[var(--surface)] dark:bg-[#0c1322]'} hover:bg-blue-50/70 dark:hover:bg-[#1a2845] transition-colors">
                            <!-- Card Header: Product Icon, Name, Duration, Subtitle, and Status Badge -->
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-center gap-3 min-w-0 flex-1">
                                    {#if isValidImg(license.image) && !imgErrorMap[license.id]}
                                        <img
                                            src={license.image}
                                            alt={license.product}
                                            class="w-10 h-10 rounded-xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-slate-800 shrink-0 shadow-2xs"
                                            on:error={() => imgErrorMap[license.id] = true}
                                        />
                                    {:else}
                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs">
                                            {license.product.charAt(0).toUpperCase()}
                                        </div>
                                    {/if}
                                    <div class="min-w-0 flex-1">
                                        <h3 class="font-bold text-sm text-[var(--text)] dark:text-white truncate leading-tight" title={license.product}>
                                            {license.product}
                                        </h3>
                                        <div class="flex items-center gap-1.5 mt-1 flex-wrap">
                                            <span class="px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-slate-200/70 dark:bg-slate-800 text-[var(--text-2)] dark:text-slate-300">
                                                {license.duration}
                                            </span>
                                            {#if license.message}
                                                <span class="text-[11px] text-[var(--text-3)] dark:text-slate-400 font-medium truncate max-w-[140px]" title={license.message}>
                                                    • {license.message}
                                                </span>
                                            {/if}
                                        </div>
                                    </div>
                                </div>

                                <!-- Status Badge -->
                                <div class="shrink-0">
                                    {#if license.status === 'active'}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span>Aktif</span>
                                        </span>
                                    {:else if license.status === 'unused'}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/25">
                                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                            <span>Siap Pakai</span>
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/25">
                                            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                            <span>Kadaluarsa</span>
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Sleek Monospace Serial Key Strip (Raycast Style) -->
                            <div class="p-2 px-3 rounded-xl bg-slate-100/70 dark:bg-[#070d19] border border-slate-200/80 dark:border-slate-800/90 flex items-center justify-between gap-2">
                                <div class="flex items-center gap-2 min-w-0 flex-1">
                                    <svg class="w-3.5 h-3.5 text-[var(--text-3)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                    </svg>
                                    <code class="text-xs font-mono font-semibold text-[var(--text-2)] dark:text-slate-300 truncate select-all">{license.key}</code>
                                </div>
                                <button
                                    type="button"
                                    on:click={() => copyKey(license.id, license.key)}
                                    class="px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer shrink-0 active:scale-95 flex items-center gap-1.5 {copiedKeyId === license.id ? 'bg-emerald-600 text-white border-transparent shadow-xs' : 'bg-[var(--surface)] dark:bg-[#111c30] hover:bg-slate-200 dark:hover:bg-slate-800 text-[var(--text)] dark:text-slate-200 border border-slate-200 dark:border-slate-700'}"
                                    title="Salin License Key"
                                >
                                    {#if copiedKeyId === license.id}
                                        <svg class="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                                        <span>Disalin!</span>
                                    {:else}
                                        <svg class="w-3 h-3 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                                        <span>Salin</span>
                                    {/if}
                                </button>
                            </div>

                            <!-- Bottom Toolbar: HWID Management & Actions -->
                            <div class="flex items-center justify-between gap-2 pt-2 border-t border-[var(--border)]/60 dark:border-[#22314d]/70">
                                <!-- HWID Status & Quick Edit -->
                                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                                    {#if license.is_applied && license.machineId && license.machineId !== '-'}
                                        <button
                                            type="button"
                                            class="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/70 dark:bg-[#101827] hover:bg-slate-200 dark:hover:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 text-left group cursor-pointer max-w-[130px] sm:max-w-[170px]"
                                            on:click={() => copyHwid(license.id, license.machineId)}
                                            title="Klik untuk salin HWID: {license.machineId}"
                                        >
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0"></span>
                                            <span class="font-mono text-[10.5px] text-[var(--text-2)] dark:text-slate-300 truncate">
                                                {license.machineId}
                                            </span>
                                            {#if copiedHwidId === license.id}
                                                <span class="text-[9px] text-emerald-500 font-bold shrink-0">Disalin!</span>
                                            {/if}
                                        </button>

                                        <button
                                            type="button"
                                            on:click={() => openHwidModal(license)}
                                            class="p-1.5 rounded-lg bg-slate-100/70 dark:bg-[#101827] hover:bg-blue-600 dark:hover:bg-blue-600 text-[var(--text-3)] dark:text-slate-400 hover:text-white dark:hover:text-white border border-slate-200/80 dark:border-slate-700/80 hover:border-blue-600 transition-colors cursor-pointer shrink-0"
                                            title="Ubah Machine ID (HWID)"
                                            aria-label="Ubah Machine ID"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                            </svg>
                                        </button>
                                    {:else}
                                        <button
                                            type="button"
                                            on:click={() => openHwidModal(license)}
                                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100/70 dark:bg-[#101827] hover:bg-blue-600 hover:text-white text-[11px] font-medium text-[var(--text-3)] dark:text-slate-400 border border-slate-200/80 dark:border-slate-700/80 transition-colors cursor-pointer"
                                            title="Ikat Machine ID Perangkat"
                                        >
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"/></svg>
                                            <span>Ikat HWID</span>
                                        </button>
                                    {/if}
                                </div>

                                <!-- Action Buttons: Tutorial & Download -->
                                <div class="flex items-center gap-1.5 shrink-0">
                                    {#if license.hasTutorials}
                                        <a
                                            href="#/member/tutorials/{license.productId || ''}"
                                            class="py-1.5 px-2.5 rounded-xl bg-purple-500/10 hover:bg-purple-500/20 text-purple-600 dark:text-purple-400 border border-purple-500/25 text-xs font-semibold inline-flex items-center gap-1 transition-colors"
                                            title="Panduan Video Tutorial"
                                        >
                                            <svg class="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                                            <span>Tutorial</span>
                                        </a>
                                    {/if}

                                    <button
                                        type="button"
                                        on:click={() => openDownloadModal(license)}
                                        class="py-1.5 px-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white text-xs font-semibold shadow-xs transition-all inline-flex items-center gap-1.5 border-0 cursor-pointer group/btn"
                                        title="Unduh Installer {license.product}"
                                    >
                                        <svg class="w-3.5 h-3.5 transition-transform group-hover/btn:-translate-y-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                        </svg>
                                        <span>Unduh</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- 2. Desktop Table View (Visible on >= md screens) -->
                <div class="hidden md:block overflow-x-auto">
                    <table class="w-full text-left text-sm text-[var(--text-2)] table-fixed">
                        <thead class="bg-[var(--surface-2)] dark:bg-[#131d31] border-b border-[var(--border)] dark:border-[#22314d] text-left text-xs font-bold text-[var(--text-3)] dark:text-slate-300 uppercase tracking-wider select-none">
                            <tr>
                                <!-- Numbering Column -->
                                <th class="w-[6%] px-4 py-3.5">No</th>

                                <!-- Product Column (Sortable) -->
                                <th class="w-[28%] px-4 py-3.5">
                                    <button
                                        type="button"
                                        on:click={() => toggleSort('product')}
                                        class="flex items-center gap-1.5 hover:text-[var(--brand)] dark:hover:text-white transition-colors uppercase font-bold cursor-pointer group bg-transparent border-0 p-0 text-xs text-[var(--text-3)] dark:text-slate-300"
                                        title="Urutkan berdasarkan Nama Software"
                                    >
                                        <span>Software & Durasi</span>
                                        <span class="text-xs {sortBy === 'product' ? 'text-[var(--brand)] dark:text-white font-bold' : 'text-[var(--text-3)] dark:text-slate-400 group-hover:text-[var(--brand)]'}">
                                            {#if sortBy === 'product'}
                                                {sortOrder === 'asc' ? '▲' : '▼'}
                                            {:else}
                                                ⇅
                                            {/if}
                                        </span>
                                    </button>
                                </th>

                                <!-- License Key Column -->
                                <th class="w-[24%] px-4 py-3.5">Serial Key</th>

                                <!-- Status Column (Sortable) -->
                                <th class="w-[17%] px-4 py-3.5">
                                    <button
                                        type="button"
                                        on:click={() => toggleSort('remaining')}
                                        class="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[var(--text-3)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white transition-colors cursor-pointer bg-transparent border-0 p-0 text-xs"
                                        title="Urutkan berdasarkan Status & Masa Aktif"
                                    >
                                        <span>Status</span>
                                        <span class="text-xs">
                                            {#if sortBy === 'remaining'}
                                                {sortOrder === 'asc' ? '▲' : '▼'}
                                            {:else}
                                                ⇅
                                            {/if}
                                        </span>
                                    </button>
                                </th>

                                <!-- Machine ID Column -->
                                <th class="w-[17%] px-4 py-3.5">Machine ID (HWID)</th>

                                <!-- Action Column -->
                                <th class="w-[8%] px-4 py-3.5 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)] dark:divide-[#22314d]">
                            {#each licenses as license, idx (license.id)}
                                <tr class="transition-colors {idx % 2 === 1 ? 'bg-slate-100/70 dark:bg-[#141f36]' : 'bg-[var(--surface)] dark:bg-[#0c1322]'} hover:bg-blue-50/70 dark:hover:bg-[#1a2845]">
                                    <!-- Number Column -->
                                    <td class="px-4 py-3 font-mono font-bold text-[var(--text-2)] dark:text-slate-300 whitespace-nowrap text-xs">
                                        {(pagination.page - 1) * pagination.pageSize + idx + 1}
                                    </td>

                                    <!-- Product Column -->
                                    <td class="px-4 py-3">
                                        <div class="flex items-center gap-2.5 min-w-0">
                                            {#if isValidImg(license.image) && !imgErrorMap[license.id]}
                                                <img
                                                    src={license.image}
                                                    alt={license.product}
                                                    class="w-8 h-8 rounded-xl object-cover border border-[var(--border)] dark:border-slate-700 bg-[var(--surface-2)] dark:bg-slate-800 flex-shrink-0 shadow-xs"
                                                    on:error={() => imgErrorMap[license.id] = true}
                                                />
                                            {:else}
                                                <div class="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-xs flex-shrink-0 shadow-xs">
                                                    {license.product.charAt(0).toUpperCase()}
                                                </div>
                                            {/if}
                                            <div class="min-w-0 flex-1">
                                                <div class="flex items-center gap-1.5 flex-wrap">
                                                    <span class="font-bold text-[var(--text)] dark:text-white text-xs truncate max-w-[140px]" title={license.product}>
                                                        {license.product}
                                                    </span>
                                                    <span class="px-1.5 py-0.5 rounded text-[10px] bg-[var(--surface-2)] dark:bg-[#1e293b] border border-[var(--border)] dark:border-slate-700 text-[var(--text-3)] dark:text-slate-300 font-semibold">
                                                        {license.duration}
                                                    </span>
                                                </div>
                                                {#if license.hasTutorials}
                                                    <a href="#/member/tutorials/{license.productId || ''}" class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-1 mt-0.5">
                                                        <svg class="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                                                        <span>Tutorial</span>
                                                    </a>
                                                {/if}
                                            </div>
                                        </div>
                                    </td>

                                    <!-- License Key Column (Compact Monospace) -->
                                    <td class="px-4 py-3">
                                        <button
                                            type="button"
                                            class="inline-flex items-center justify-between gap-1.5 max-w-full px-2.5 py-1.5 rounded-lg bg-[var(--surface-2)] dark:bg-[#1e293b] hover:bg-[var(--border)] dark:hover:bg-slate-700 border border-[var(--border)] dark:border-slate-700 cursor-pointer transition-colors group text-left"
                                            on:click={() => copyKey(license.id, license.key)}
                                            title="Klik untuk salin License Key"
                                        >
                                            <span class="font-mono text-[11px] text-[var(--text)] dark:text-slate-100 group-hover:text-[var(--brand)] font-medium truncate">
                                                {license.key}
                                            </span>
                                            <div class="flex-shrink-0">
                                                {#if copiedKeyId === license.id}
                                                    <span class="text-[10px] text-emerald-400 font-bold">Disalin!</span>
                                                {:else}
                                                    <svg class="w-3 h-3 text-[var(--text-3)] dark:text-slate-400 group-hover:text-[var(--brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                {/if}
                                            </div>
                                        </button>
                                    </td>

                                    <!-- Status & Masa Aktif Column -->
                                    <td class="px-4 py-3">
                                        <div class="space-y-0.5">
                                            <div>
                                                {#if license.status === 'active'}
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 dark:border-emerald-500/40">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400 animate-pulse"></span>
                                                        Aktif
                                                    </span>
                                                {:else if license.status === 'unused'}
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 border border-blue-500/20 dark:border-blue-500/40">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400"></span>
                                                        Siap Pakai
                                                    </span>
                                                {:else}
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 dark:border-rose-500/40">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-rose-500 dark:bg-rose-400"></span>
                                                        Kadaluarsa
                                                    </span>
                                                {/if}
                                            </div>
                                            <div class="text-[11px] text-[var(--text-3)] dark:text-slate-400 truncate" title={license.message}>
                                                {license.message}
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Machine ID (HWID) Compact Column with Edit Button -->
                                    <td class="px-4 py-3">
                                        <div class="flex items-center gap-1.5">
                                            {#if license.is_applied && license.machineId && license.machineId !== '-'}
                                                <button
                                                    type="button"
                                                    class="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface-2)] dark:bg-[#1e293b] hover:bg-[var(--border)] dark:hover:bg-slate-700 border border-[var(--border)] dark:border-slate-700 max-w-full text-left group cursor-pointer"
                                                    on:click={() => copyHwid(license.id, license.machineId)}
                                                    title="Klik untuk salin HWID: {license.machineId}"
                                                >
                                                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0"></span>
                                                    <span class="font-mono text-[10px] text-[var(--text-2)] dark:text-slate-200 truncate max-w-[95px]">
                                                        {license.machineId}
                                                    </span>
                                                    {#if copiedHwidId === license.id}
                                                        <span class="text-[9px] text-emerald-400 font-bold flex-shrink-0">Disalin!</span>
                                                    {/if}
                                                </button>
                                            {:else}
                                                <span class="text-[11px] text-[var(--text-3)] dark:text-slate-400 italic">
                                                    Belum terikat
                                                </span>
                                            {/if}

                                            <button
                                                type="button"
                                                on:click={() => openHwidModal(license)}
                                                class="p-1 rounded-lg bg-[var(--surface-2)] dark:bg-[#1e293b] hover:bg-blue-600 dark:hover:bg-blue-600 text-[var(--text-3)] dark:text-slate-400 hover:text-white dark:hover:text-white border border-[var(--border)] dark:border-slate-700 hover:border-blue-600 transition-colors cursor-pointer flex-shrink-0"
                                                title="Ubah / Ikat Ulang Machine ID (HWID)"
                                                aria-label="Ubah Machine ID"
                                            >
                                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                            </button>
                                        </div>
                                    </td>

                                    <!-- Action Column (Opens Download Pop-Up Modal) -->
                                    <td class="px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            on:click={() => openDownloadModal(license)}
                                            class="w-8 h-8 rounded-xl bg-slate-100 dark:bg-[#1e293b] hover:bg-blue-600 dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-white dark:hover:text-white border border-slate-200 dark:border-slate-700 hover:border-blue-600 dark:hover:border-blue-600 inline-flex items-center justify-center transition-all shadow-xs cursor-pointer group"
                                            title="Unduh Installer {license.product}"
                                            aria-label="Unduh Installer {license.product}"
                                        >
                                            <svg class="w-4 h-4 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                        </button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Dynamic Pagination Footer with PageSize Selector -->
                {#if pagination.totalPages > 1 || pagination.totalItems > 0}
                    <div class="p-3 sm:p-4 border-t border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row items-center justify-between gap-3 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-b-2xl relative z-20">
                        <div class="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                            <div class="text-xs text-[var(--text-3)] dark:text-slate-300 text-center sm:text-left">
                                Menampilkan <strong class="text-[var(--text)] dark:text-white font-bold">{startRowIndex} - {endRowIndex}</strong> dari <strong class="text-[var(--text)] dark:text-white font-bold">{pagination.totalItems}</strong> lisensi
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
                    </div>
                {/if}
            {/if}
        </div>
    </main>
</Layout>

<!-- PRODUCT INSTALLER DOWNLOAD POPUP MODAL -->
{#if showDownloadModal && selectedLicenseForDownload}
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

        <div class="relative z-10 w-full max-w-xl bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-2xl overflow-hidden my-8 animate-modal-scale text-left">
            <!-- Modal Header Accent Bar -->
            <div class="h-1.5 w-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-600"></div>

            <!-- Modal Header -->
            <div class="p-6 border-b border-[var(--border)] flex items-start justify-between gap-4 bg-[var(--surface-2)]">
                <div class="flex items-center gap-3">
                    <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-black text-base shadow-sm flex-shrink-0">
                        {selectedLicenseForDownload.product.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h2 class="text-base font-extrabold text-[var(--text)]">Unduh Installer {selectedLicenseForDownload.product}</h2>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/30">
                                {selectedLicenseForDownload.duration}
                            </span>
                        </div>
                        <p class="text-xs text-[var(--text-3)] mt-0.5">
                            Pilih installer resmi software untuk platform OS & versi yang Anda butuhkan.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    on:click={closeDownloadModal}
                    class="w-8 h-8 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text-3)] hover:text-[var(--text)] flex items-center justify-center transition-colors cursor-pointer flex-shrink-0"
                    aria-label="Tutup Modal"
                >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- OS Platform Tabs Inside Modal -->
            {#if modalTotalFilesCount > 0}
                <div class="px-6 pt-4 pb-2 border-b border-[var(--border)] bg-[var(--surface)] flex items-center gap-2 overflow-x-auto">
                    <SegmentedTabs
                        tabs={modalOsTabs}
                        bind:activeTab={downloadOsFilter}
                    />
                </div>
            {/if}

            <!-- Modal Body - List of Installer Files -->
            <div class="p-6 max-h-[60vh] overflow-y-auto space-y-3">
                {#if displayedInstallerFiles.length === 0}
                    <div class="py-10 text-center space-y-3 bg-[var(--surface-2)] rounded-2xl border border-[var(--border)] border-dashed p-6">
                        <div class="w-12 h-12 mx-auto rounded-2xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-3)]">
                            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <div>
                            <h4 class="font-bold text-sm text-[var(--text)]">Belum Ada File Installer Khusus</h4>
                            <p class="text-xs text-[var(--text-3)] max-w-sm mx-auto mt-1">
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
                            <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-blue-500/50 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                                <div class="flex items-start gap-3 min-w-0">
                                    {#if file.os === 'windows'}
                                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
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
                                        <div class="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex flex-col items-center justify-center flex-shrink-0 shadow-xs">
                                            <svg class="w-4 h-4 text-[var(--text-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                            <span class="text-[8px] font-black text-blue-600 tracking-tight leading-none mt-0.5">
                                                {getFileExtensionBadge(file.filename)}
                                            </span>
                                        </div>
                                    {/if}

                                    <div class="min-w-0 flex-1">
                                        <div class="font-bold text-xs text-[var(--text)] break-all select-all leading-snug">
                                            {file.filename}
                                        </div>
                                        <div class="flex items-center gap-2 mt-1.5 flex-wrap">
                                            {#if file.os === 'windows'}
                                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
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
                                                <span class="px-2 py-0.5 rounded-md text-[10px] font-semibold bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]">
                                                    Universal
                                                </span>
                                            {/if}
                                            <span class="text-[11px] font-mono text-[var(--text-3)]">
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
            <div class="p-4 border-t border-[var(--border)] flex items-center justify-between gap-3 bg-[var(--surface-2)]">
                {#if selectedLicenseForDownload.hasTutorials}
                    <a
                        href="#/member/tutorials/{selectedLicenseForDownload.productId || ''}"
                        class="text-xs font-bold text-[var(--brand)] hover:underline inline-flex items-center gap-1.5"
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
                    class="px-5 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text)] transition-colors cursor-pointer"
                >
                    Tutup
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- ================= MODAL EDIT MACHINE ID (HWID) ================= -->
{#if showHwidModal && selectedLicenseForHwid}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in"
        role="dialog"
        aria-modal="true"
        on:click|self={closeHwidModal}
        tabindex="-1"
    >
        <div
            class="w-full max-w-xl max-h-[90vh] overflow-hidden rounded-3xl bg-[var(--surface)] dark:bg-[#111c35] border border-[var(--border)] dark:border-[#22314d] shadow-2xl flex flex-col animate-modal-scale"
            role="document"
        >
            <!-- Modal Header -->
            <div class="p-5 border-b border-[var(--border)] dark:border-[#22314d] flex items-center justify-between gap-3 bg-[var(--surface-2)] dark:bg-[#131d31]">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 text-[var(--brand)] flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <div>
                        <span class="text-[10px] font-bold text-[var(--brand)] uppercase tracking-wider block">PENGATURAN PERANGKAT</span>
                        <h3 class="text-base font-extrabold text-[var(--text)] dark:text-white">
                            Ubah Machine ID (HWID)
                        </h3>
                    </div>
                </div>

                <button
                    type="button"
                    on:click={closeHwidModal}
                    class="p-2 rounded-xl text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface)] transition-colors cursor-pointer border-0"
                    aria-label="Tutup modal"
                >
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Modal Body -->
            <div class="p-6 max-h-[65vh] overflow-y-auto space-y-4">
                {#if loadingHwidStatus}
                    <div class="py-12 text-center text-[var(--text-3)] space-y-3">
                        <div class="w-8 h-8 mx-auto border-3 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
                        <p class="text-xs font-semibold">Memeriksa kuota dan status Machine ID...</p>
                    </div>
                {:else}
                    <!-- 1. License Summary Card -->
                    <div class="p-3.5 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] space-y-2">
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-[var(--text-3)]">Software:</span>
                            <span class="font-bold text-[var(--text)] dark:text-white">{selectedLicenseForHwid.product}</span>
                        </div>
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-[var(--text-3)]">Serial Key:</span>
                            <span class="font-mono font-bold text-[var(--brand)]">{selectedLicenseForHwid.key}</span>
                        </div>
                        <div class="flex items-center justify-between text-xs">
                            <span class="text-[var(--text-3)]">Machine ID Saat Ini:</span>
                            <span class="font-mono text-xs text-[var(--text-2)] dark:text-slate-300">
                                {hwidStatus?.current_hwid || selectedLicenseForHwid.machineId || 'Belum terikat'}
                            </span>
                        </div>
                    </div>

                    <!-- 2. Ketentuan & Batasan Box -->
                    <div class="p-4 rounded-2xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs space-y-2.5">
                        <div class="flex items-center justify-between gap-2 font-bold text-amber-800 dark:text-amber-300">
                            <div class="flex items-center gap-1.5">
                                <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>Ketentuan & Batasan Perubahan Machine ID</span>
                            </div>
                            <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/40">
                                Sisa Hari Ini: {hwidStatus?.remainingChangesToday ?? 3}/3
                            </span>
                        </div>

                        <ul class="space-y-1.5 text-[11px] text-amber-800 dark:text-amber-300/90 pl-1 list-disc list-inside leading-relaxed">
                            <li><strong>Maksimal 3x Per Hari</strong> — Perubahan Machine ID dibatasi maksimal 3 kali dalam 24 jam.</li>
                            <li><strong>Jeda Wajib 45 Menit</strong> — Wajib menunggu jeda 45 menit di antara setiap pergantian perangkat.</li>
                            <li><strong>1 Komputer Aktif</strong> — Setelah diubah, lisensi pada komputer lama otomatis dinonaktifkan dan berpindah ke komputer baru.</li>
                        </ul>
                    </div>

                    <!-- 3. Cooldown & Limit Alert Banner -->
                    {#if cooldownRemaining > 0}
                        <div class="p-3.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                            <svg class="w-4 h-4 mt-0.5 flex-shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div>
                                <strong class="block font-bold">Masa Jeda (Cooldown) Sedang Aktif</strong>
                                <span class="text-[11px] mt-0.5 block">
                                    Harap tunggu <strong>{formatCooldownText(cooldownRemaining)}</strong> lagi sebelum dapat melakukan perubahan Machine ID berikutnya.
                                </span>
                            </div>
                        </div>
                    {:else if hwidStatus && hwidStatus.remainingChangesToday === 0}
                        <div class="p-3.5 rounded-2xl bg-rose-500/10 dark:bg-rose-500/20 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs flex items-start gap-2.5">
                            <svg class="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                            </svg>
                            <div>
                                <strong class="block font-bold">Batas Kuota Perubahan Hari Ini Habis</strong>
                                <span class="text-[11px] mt-0.5 block">
                                    Anda telah mencapai kuota maksimal 3x perubahan untuk hari ini. Silakan coba kembali besok.
                                </span>
                            </div>
                        </div>
                    {/if}

                    <!-- 4. Input Machine ID Baru -->
                    <div class="space-y-1.5">
                        <label for="newHwidField" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                            Machine ID Baru (HWID) <span class="text-rose-500">*</span>
                        </label>
                        <input
                            id="newHwidField"
                            type="text"
                            bind:value={newHwidInput}
                            placeholder="Contoh: BFEBFBFF000906EA-12345"
                            disabled={cooldownRemaining > 0 || (hwidStatus && hwidStatus.remainingChangesToday === 0) || savingHwid}
                            class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] text-xs font-mono text-[var(--text)] dark:text-white placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                        />
                        <p class="text-[11px] text-[var(--text-3)] dark:text-slate-400">
                            Buka aplikasi software pada komputer baru Anda, lalu salin kode Machine ID yang tampil saat aktivasi.
                        </p>
                    </div>

                    <!-- 5. Confirmation Checkbox -->
                    <div class="p-3 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d]">
                        <CustomCheckbox
                            bind:checked={confirmUnderstood}
                            disabled={cooldownRemaining > 0 || (hwidStatus && hwidStatus.remainingChangesToday === 0) || savingHwid}
                            color="brand"
                            align="start"
                        >
                            <span class="text-xs text-[var(--text)] dark:text-slate-200 leading-relaxed select-none">
                                <strong>Saya memahami ketentuan di atas</strong> dan serius ingin memindahkan lisensi ke Machine ID baru ini.
                            </span>
                        </CustomCheckbox>
                    </div>

                    <!-- 6. Alert Messages -->
                    {#if hwidModalError}
                        <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                            {hwidModalError}
                        </div>
                    {/if}

                    {#if hwidModalSuccess}
                        <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                            <svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{hwidModalSuccess}</span>
                        </div>
                    {/if}
                {/if}
            </div>

            <!-- Modal Footer -->
            <div class="p-4 border-t border-[var(--border)] dark:border-[#22314d] flex items-center justify-end gap-3 bg-[var(--surface-2)] dark:bg-[#131d31]">
                <button
                    type="button"
                    on:click={closeHwidModal}
                    disabled={savingHwid}
                    class="px-4 py-2 rounded-xl text-xs font-bold bg-[var(--surface)] border border-[var(--border)] hover:bg-[var(--surface-2)] text-[var(--text)] transition-colors cursor-pointer"
                >
                    Batal
                </button>

                <button
                    type="button"
                    on:click={handleSaveHwid}
                    disabled={savingHwid || loadingHwidStatus || !newHwidInput.trim() || !confirmUnderstood || cooldownRemaining > 0 || (hwidStatus && hwidStatus.remainingChangesToday === 0)}
                    class="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-all cursor-pointer shadow-xs border-0 flex items-center gap-2"
                >
                    {#if savingHwid}
                        <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        <span>Menyimpan...</span>
                    {:else}
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span>Konfirmasi & Simpan Machine ID</span>
                    {/if}
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
