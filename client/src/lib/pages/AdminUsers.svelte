<script lang="ts">
    import { onMount, onDestroy, tick } from 'svelte';
    import { fade } from 'svelte/transition';
    import AdminLayout from '../components/AdminLayout.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';
    import Tooltip from '../components/Tooltip.svelte';

    interface UserLocation {
        city: string | null;
        region: string | null;
        country: string | null;
    }

    interface UserItem {
        id: number;
        original_id: number;
        name: string;
        email: string;
        whatsapp: string | null;
        company: string | null;
        verified: boolean;
        banned: boolean;
        created: string;
        created_timestamp: number;
        ip: string | null;
        location: UserLocation | null;
        devicesCount: number;
        ordersCount: number;
        totalSpent: number;
        isAffiliate: boolean;
        affiliateKupon: string | null;
    }

    interface UserStats {
        totalUsers: number;
        premiumUsers: number;
        regularUsers: number;
        verifiedUsers: number;
        unverifiedUsers: number;
        pendingVerifyUsers: number;
        bannedUsers: number;
        affiliateUsers: number;
    }

    interface UserDetailDevice {
        id: number;
        order_id?: number | null;
        product: string;
        machine_id: string;
        label: string;
        duration: number;
        created: string;
        expired: string;
        is_expired: boolean;
    }

    interface UserDetailOrder {
        id: number;
        status: string;
        status_badge: string;
        total_amount: number;
        payment: string;
        duration: number;
        channel_code: string;
        created: string;
    }

    interface UserDetailLocation {
        id: number;
        ip: string;
        city: string;
        region: string;
        country: string;
        timezone: string;
    }

    interface UserDetailData {
        user: {
            id: number;
            original_id: number;
            name: string;
            email: string;
            whatsapp: string | null;
            company: string | null;
            verified: boolean;
            banned: boolean;
            created: string;
            ip: string | null;
        };
        devices: UserDetailDevice[];
        orders: UserDetailOrder[];
        affiliate: {
            id: number;
            kupon: string;
            bank_name: string | null;
            no_rek: string | null;
            payout_name: string | null;
            income: number;
        } | null;
        locations: UserDetailLocation[];
    }

    let loading: boolean = true;
    let error: string = '';
    let successMessage: string = '';

    let users: UserItem[] = [];
    let stats: UserStats = {
        totalUsers: 0,
        premiumUsers: 0,
        regularUsers: 0,
        verifiedUsers: 0,
        unverifiedUsers: 0,
        pendingVerifyUsers: 0,
        bannedUsers: 0,
        affiliateUsers: 0
    };

    // Filter, search & pagination states
    let searchInput: string = '';
    let activeTab: string = 'all';
    let sortValue: string = 'created_desc';
    let currentPage: number = 1;
    let pageSize: number = 10;
    let totalItems: number = 0;
    let totalPages: number = 1;

    let searchDebounceTimer: any = null;

    // Toast/Copied feedback
    let copiedText: string = '';
    let copyToastTimer: any = null;

    // Detail Modal State
    let detailModalOpen: boolean = false;
    let detailLoading: boolean = false;
    let selectedUserDetail: UserDetailData | null = null;
    let detailActiveTab: 'devices' | 'orders' | 'locations' = 'devices';

    // Detail Modal Sliding Pill Tab State
    let detailTabContainer: HTMLDivElement | null = null;
    let detailTabElements: Record<string, HTMLButtonElement | null> = {};
    let detailPillStyle = { left: 0, width: 0 };
    let detailPillInitialized = false;
    let detailResizeObserver: ResizeObserver | null = null;

    function syncDetailPill() {
        if (!detailTabContainer) return;
        const targetId = detailActiveTab || 'devices';
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

    function setDetailTab(tab: 'devices' | 'orders' | 'locations') {
        if (detailActiveTab === tab) return;
        detailActiveTab = tab;
        tick().then(() => {
            syncDetailPill();
        });
    }

    $: if (detailModalOpen && selectedUserDetail) {
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
        devices: 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/30 border border-blue-400/30',
        orders: 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-md shadow-emerald-500/30 border border-emerald-400/30',
        locations: 'bg-gradient-to-r from-indigo-600 to-violet-600 shadow-md shadow-indigo-500/30 border border-indigo-400/30'
    }[detailActiveTab] || 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/30 border border-blue-400/30';

    // Edit User Modal State
    let editModalOpen: boolean = false;
    let editingUser: any = null;
    let editForm = {
        name: '',
        whatsapp: '',
        company: ''
    };
    let isSubmittingEdit: boolean = false;

    // Reset Password Modal State
    let resetPasswordModalOpen: boolean = false;
    let resetTargetUser: UserItem | null = null;
    let newPasswordInput: string = '';
    let isSubmittingResetPassword: boolean = false;

    // Ban Confirmation Modal State
    let banModalOpen: boolean = false;
    let banTargetUser: UserItem | null = null;
    let isSubmittingBan: boolean = false;

    // Verify Confirmation Modal State
    let verifyModalOpen: boolean = false;
    let verifyTargetUser: UserItem | null = null;
    let isSubmittingVerify: boolean = false;

    const sortOptions: OptionItem[] = [
        { value: 'created_desc', label: 'Waktu Daftar (Terbaru)' },
        { value: 'created_asc', label: 'Waktu Daftar (Terlama)' },
        { value: 'orders_desc', label: 'Pesanan (Terbanyak)' },
        { value: 'orders_asc', label: 'Pesanan (Tersedikit)' },
        { value: 'devices_desc', label: 'Lisensi PC (Terbanyak)' },
        { value: 'devices_asc', label: 'Lisensi PC (Tersedikit)' },
        { value: 'spent_desc', label: 'Total Belanja (Tertinggi)' },
        { value: 'spent_asc', label: 'Total Belanja (Terendah)' },
        { value: 'name_asc', label: 'Nama (A - Z)' },
        { value: 'name_desc', label: 'Nama (Z - A)' }
    ];

    const pageSizeOptions: OptionItem[] = [
        { value: 10, label: '10 baris / hal' },
        { value: 20, label: '20 baris / hal' },
        { value: 50, label: '50 baris / hal' },
        { value: 100, label: '100 baris / hal' }
    ];

    $: filterTabs = [
        { id: 'all', label: 'Semua', count: stats.totalUsers, color: 'brand' as const },
        { id: 'premium', label: 'Pengguna Premium', count: stats.premiumUsers, color: 'emerald' as const },
        { id: 'regular', label: 'Belum Beli Lisensi', count: stats.regularUsers, color: 'amber' as const },
        { id: 'verified', label: 'Terverifikasi', count: stats.verifiedUsers, color: 'emerald' as const },
        { id: 'unverified', label: 'Belum Verifikasi', count: stats.unverifiedUsers, color: 'amber' as const },
        { id: 'pending_verify', label: 'Minta Verifikasi', count: stats.pendingVerifyUsers, color: 'purple' as const },
        { id: 'banned', label: 'Diblokir', count: stats.bannedUsers, color: 'rose' as const },
        { id: 'affiliate', label: 'Mitra Afiliasi', count: stats.affiliateUsers, color: 'indigo' as const }
    ];

    $: filterOptions = [
        { value: 'all', label: `Semua (${stats.totalUsers || 0})` },
        { value: 'premium', label: `Pengguna Premium (${stats.premiumUsers || 0})` },
        { value: 'regular', label: `Belum Beli Lisensi (${stats.regularUsers || 0})` },
        { value: 'verified', label: `Terverifikasi (${stats.verifiedUsers || 0})` },
        { value: 'unverified', label: `Belum Verifikasi (${stats.unverifiedUsers || 0})` },
        { value: 'pending_verify', label: `Minta Verifikasi (${stats.pendingVerifyUsers || 0})` },
        { value: 'banned', label: `Diblokir (${stats.bannedUsers || 0})` },
        { value: 'affiliate', label: `Mitra Afiliasi (${stats.affiliateUsers || 0})` }
    ];

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

    function formatRupiah(num: number): string {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num || 0);
    }

    function getInitial(name: string): string {
        return (name || 'U').charAt(0).toUpperCase();
    }

    function getOrderStatusBadge(status: string) {
        const s = (status || '').toUpperCase();
        if (s === 'PAID' || s === 'SUCCESS' || s === 'SUKSES' || s === 'COMPLETED') {
            return {
                bg: 'bg-emerald-500/10 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-500/30',
                dot: 'bg-emerald-500',
                label: 'PAID'
            };
        }
        if (s === 'PENDING' || s === 'UNPAID' || s === 'MENUNGGU') {
            return {
                bg: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-700 dark:text-amber-400 border-amber-500/30',
                dot: 'bg-amber-500 animate-pulse',
                label: 'PENDING'
            };
        }
        if (s === 'EXPIRED' || s === 'KADALUARSA') {
            return {
                bg: 'bg-slate-500/10 dark:bg-slate-500/20 text-slate-700 dark:text-slate-400 border-slate-500/30',
                dot: 'bg-slate-500',
                label: 'EXPIRED'
            };
        }
        return {
            bg: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 border-rose-500/30',
            dot: 'bg-rose-500',
            label: s || 'UNKNOWN'
        };
    }

    function handleSearchInput(e: Event) {
        const val = (e.target as HTMLInputElement).value;
        searchInput = val;
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            currentPage = 1;
            fetchUsers();
        }, 300);
    }

    function clearSearch() {
        searchInput = '';
        currentPage = 1;
        fetchUsers();
    }

    function handleTabChange(tabId: string) {
        activeTab = tabId;
        currentPage = 1;
        fetchUsers();
    }

    function handleSortChange(e: CustomEvent<string | number>) {
        sortValue = String(e.detail);
        currentPage = 1;
        fetchUsers();
    }

    function handlePageSizeChange(e: CustomEvent<string | number>) {
        pageSize = Number(e.detail);
        currentPage = 1;
        fetchUsers();
    }

    function goToPage(page: number) {
        if (page < 1 || page > totalPages || page === currentPage) return;
        currentPage = page;
        fetchUsers();
    }

    function getPaginationPages(current: number, total: number): (number | string)[] {
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
    }

    async function fetchUsers() {
        loading = true;
        error = '';
        try {
            const params = new URLSearchParams({
                page: String(currentPage),
                limit: String(pageSize),
                search: searchInput.trim(),
                tab: activeTab,
                sort: sortValue
            });

            const res = await fetch(`/admin/api/users?${params.toString()}`, {
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.hash = '/admin/login';
                return;
            }

            if (!res.ok) {
                throw new Error(`Gagal memuat data pengguna (${res.status})`);
            }

            const data = await res.json();
            if (data.success) {
                users = data.users || [];
                stats = data.stats || stats;
                totalItems = data.pagination?.total || 0;
                totalPages = data.pagination?.totalPages || 1;
            } else {
                throw new Error(data.error || 'Gagal memuat data');
            }
        } catch (err: any) {
            console.error('Fetch users error:', err);
            error = err.message || 'Terjadi kesalahan sistem';
        } finally {
            loading = false;
        }
    }

    function getWhatsAppLink(phone: string | null): string {
        if (!phone) return '';
        const clean = phone.replace(/[^0-9]/g, '');
        const formatted = clean.startsWith('0') ? '62' + clean.slice(1) : clean.startsWith('62') ? clean : '62' + clean;
        return `https://wa.me/${formatted}`;
    }

    async function openDetailModal(user: UserItem) {
        selectedUserDetail = null;
        detailActiveTab = 'devices';
        detailPillInitialized = false;
        detailModalOpen = true;
        detailLoading = true;
        try {
            const res = await fetch(`/admin/api/users/${user.id}`, {
                credentials: 'include'
            });
            const data = await res.json();
            if (data.success) {
                selectedUserDetail = data;
            } else {
                error = data.error || 'Gagal memuat detail pengguna';
            }
        } catch (err: any) {
            console.error('Fetch detail error:', err);
            error = 'Gagal memuat detail pengguna';
        } finally {
            detailLoading = false;
        }
    }

    function openEditModal(user: any) {
        editingUser = user;
        editForm = {
            name: user.name || '',
            whatsapp: user.whatsapp || '',
            company: user.company || ''
        };
        editModalOpen = true;
    }

    async function submitEditUser() {
        if (!editingUser) return;
        isSubmittingEdit = true;
        try {
            const res = await fetch(`/admin/api/users/${editingUser.id}/update`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(editForm)
            });
            const data = await res.json();
            if (data.success) {
                successMessage = data.message || 'Data pengguna berhasil diperbarui';
                setTimeout(() => { successMessage = ''; }, 4000);
                editModalOpen = false;
                if (selectedUserDetail && editingUser && selectedUserDetail.user.id === editingUser.id) {
                    selectedUserDetail.user.name = editForm.name;
                    selectedUserDetail.user.whatsapp = editForm.whatsapp || null;
                    selectedUserDetail.user.company = editForm.company || null;
                }
                fetchUsers();
            } else {
                alert(data.error || 'Gagal memperbarui data pengguna');
            }
        } catch (err) {
            alert('Terjadi kesalahan saat memperbarui pengguna');
        } finally {
            isSubmittingEdit = false;
        }
    }

    function openResetPasswordModal(user: UserItem) {
        resetTargetUser = user;
        newPasswordInput = '';
        resetPasswordModalOpen = true;
    }

    async function submitResetPassword() {
        if (!resetTargetUser || !newPasswordInput || newPasswordInput.trim().length < 6) {
            alert('Password minimal 6 karakter');
            return;
        }
        isSubmittingResetPassword = true;
        try {
            const res = await fetch(`/admin/api/users/${resetTargetUser.id}/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ new_password: newPasswordInput.trim() })
            });
            const data = await res.json();
            if (data.success) {
                successMessage = data.message || 'Password berhasil direset';
                setTimeout(() => { successMessage = ''; }, 4000);
                resetPasswordModalOpen = false;
            } else {
                alert(data.error || 'Gagal mereset password');
            }
        } catch (err) {
            alert('Terjadi kesalahan saat mereset password');
        } finally {
            isSubmittingResetPassword = false;
        }
    }

    function openBanModal(user: UserItem) {
        banTargetUser = user;
        banModalOpen = true;
    }

    async function submitToggleBan() {
        if (!banTargetUser) return;
        isSubmittingBan = true;
        try {
            const res = await fetch(`/admin/api/users/${banTargetUser.id}/ban`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ banned: !banTargetUser.banned })
            });
            const data = await res.json();
            if (data.success) {
                successMessage = data.message;
                setTimeout(() => { successMessage = ''; }, 4000);
                banModalOpen = false;
                fetchUsers();
            } else {
                alert(data.error || 'Gagal mengubah status blokir');
            }
        } catch (err) {
            alert('Terjadi kesalahan sistem');
        } finally {
            isSubmittingBan = false;
        }
    }

    function openVerifyModal(user: UserItem) {
        verifyTargetUser = user;
        verifyModalOpen = true;
    }

    async function submitToggleVerify() {
        if (!verifyTargetUser) return;
        isSubmittingVerify = true;
        try {
            const res = await fetch(`/admin/api/users/${verifyTargetUser.id}/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ verified: !verifyTargetUser.verified })
            });
            const data = await res.json();
            if (data.success) {
                successMessage = data.message;
                setTimeout(() => { successMessage = ''; }, 4000);
                verifyModalOpen = false;
                fetchUsers();
            } else {
                alert(data.error || 'Gagal mengubah status verifikasi');
            }
        } catch (err) {
            alert('Terjadi kesalahan sistem');
        } finally {
            isSubmittingVerify = false;
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape') {
            if (detailModalOpen) detailModalOpen = false;
            else if (editModalOpen) editModalOpen = false;
            else if (resetPasswordModalOpen) resetPasswordModalOpen = false;
            else if (banModalOpen) banModalOpen = false;
            else if (verifyModalOpen) verifyModalOpen = false;
        }
    }

    onMount(() => {
        fetchUsers();
        window.addEventListener('resize', syncDetailPill);
    });

    onDestroy(() => {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        if (copyToastTimer) clearTimeout(copyToastTimer);
        detailResizeObserver?.disconnect();
        window.removeEventListener('resize', syncDetailPill);
    });
</script>

<svelte:window on:keydown={handleKeydown} />

<svelte:head>
    <title>Manajemen Pengguna - Admin Appcenter</title>
</svelte:head>

<AdminLayout activePage="users" eyebrow="PANEL ADMIN ZIQVA">
    <main class="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        <!-- Header Banner -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] uppercase tracking-wider">
                        MANAJEMEN SISTEM
                    </span>
                    <span class="text-xs text-[var(--text-3)] font-medium">/</span>
                    <span class="text-xs text-[var(--brand)] font-medium">Manajemen Pengguna</span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">
                    Manajemen Pengguna
                </h1>
                <p class="text-xs sm:text-sm text-[var(--text-3)] mt-0.5">
                    Kelola data member terdaftar, status verifikasi, reset password, dan pemblokiran akun.
                </p>
            </div>

            <div class="hidden lg:flex items-center gap-2.5">
                <button
                    type="button"
                    on:click={fetchUsers}
                    class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-all shadow-xs cursor-pointer"
                >
                    <svg class="w-4 h-4 text-[var(--text-3)] {loading ? 'animate-spin' : ''}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Segarkan</span>
                </button>
            </div>
        </div>

        <!-- Toast Copied Feedback -->
        {#if copiedText}
            <div class="fixed bottom-6 right-6 z-[70] flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white dark:bg-white dark:text-slate-900 text-xs font-semibold shadow-2xl border border-slate-700/50 dark:border-slate-200 transition-all duration-300 transform translate-y-0">
                <svg class="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                </svg>
                <span>Tersalin: {copiedText}</span>
            </div>
        {/if}

        <!-- Success Global Banner -->
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

        <!-- Main Card Section -->
        <div class="rounded-2xl bg-white dark:bg-[#111c35] border border-slate-200/80 dark:border-[#22314d] shadow-sm">
            <!-- Filter & Toolbar Area -->
            <div class="p-4 sm:p-5 border-b border-slate-200/80 dark:border-[#22314d] space-y-3.5">
                <!-- Desktop View (lg and above): SegmentedTabs on left, Sort Selector on right -->
                <div class="hidden lg:flex items-center justify-between gap-3">
                    <!-- Segmented Tabs -->
                    <div class="overflow-x-auto pb-1 lg:pb-0">
                        <SegmentedTabs
                            tabs={filterTabs}
                            bind:activeTab={activeTab}
                            on:change={(e) => handleTabChange(e.detail)}
                            on:tabChange={(e) => handleTabChange(e.detail)}
                        />
                    </div>

                    <!-- Right Controls: Sort Selector -->
                    <div class="flex items-center gap-2.5 flex-shrink-0">
                        <div class="w-52">
                            <CustomSelect options={sortOptions} value={sortValue} on:change={handleSortChange} />
                        </div>
                    </div>
                </div>

                <!-- Mobile & Tablet View (< lg): Filter dropdown, Sort dropdown, and Refresh icon button side-by-side on the right -->
                <div class="flex lg:hidden items-center justify-end gap-2 w-full">
                    <!-- Filter Status Dropdown -->
                    <div class="w-auto max-w-[42%] min-w-[115px]">
                        <CustomSelect
                            options={filterOptions}
                            value={activeTab}
                            on:change={(e) => handleTabChange(String(e.detail))}
                            align="right"
                        />
                    </div>

                    <!-- Sort Selector Dropdown -->
                    <div class="w-auto max-w-[45%] min-w-[125px]">
                        <CustomSelect
                            options={sortOptions}
                            value={sortValue}
                            on:change={handleSortChange}
                            align="right"
                        />
                    </div>

                    <!-- Refresh Icon Button -->
                    <button
                        type="button"
                        on:click={fetchUsers}
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

                <!-- Integrated Live Search Bar -->
                <div class="relative w-full">
                    <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        class="w-full pl-10 pr-10 py-2.5 rounded-xl text-xs font-medium bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                        placeholder="Cari berdasarkan nama, email, whatsapp, perusahaan, atau IP..."
                        value={searchInput}
                        on:input={handleSearchInput}
                    />
                    {#if searchInput}
                        <button
                            type="button"
                            class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-sm"
                            on:click={clearSearch}
                        >
                            ✕
                        </button>
                    {/if}
                </div>
            </div>

            <!-- Error Banner -->
            {#if error}
                <div class="p-6 text-center text-rose-500 text-sm">
                    <p>{error}</p>
                    <button type="button" class="mt-2 text-xs font-bold underline" on:click={fetchUsers}>Coba Lagi</button>
                </div>
            {:else if loading}
                <!-- Loading Skeleton -->
                <div class="p-8 space-y-4">
                    {#each Array(5) as _}
                        <div class="h-12 rounded-xl bg-slate-100 dark:bg-slate-800/40 animate-pulse"></div>
                    {/each}
                </div>
            {:else if users.length === 0}
                <!-- Empty State -->
                <div class="p-12 text-center">
                    <div class="w-16 h-16 mx-auto rounded-2xl bg-slate-100 dark:bg-[#1a263e] flex items-center justify-center text-slate-400">
                        <svg class="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                    </div>
                    <h3 class="mt-4 text-sm font-bold text-slate-900 dark:text-white">Tidak ada data pengguna</h3>
                    <p class="mt-1 text-xs text-slate-500 dark:text-slate-400">Tidak ditemukan pengguna yang sesuai dengan kriteria filter saat ini.</p>
                </div>
            {:else}
                <!-- Desktop Table View -->
                <div class="hidden md:block overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="border-b border-slate-200/80 dark:border-[#22314d] bg-slate-50/75 dark:bg-[#0c1424] text-[11px] font-extrabold text-slate-500 dark:text-slate-400 tracking-wider">
                                <th class="py-3.5 px-5">PENGGUNA & KONTAK</th>
                                <th class="py-3.5 px-4">STATUS AKUN</th>
                                <th class="py-3.5 px-4">LISENSI & PESANAN</th>
                                <th class="py-3.5 px-4">PROGRAM AFILIASI</th>
                                <th class="py-3.5 px-4">REGISTRASI & LOKASI</th>
                                <th class="py-3.5 px-5 text-right">AKSI</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200/80 dark:divide-[#22314d] text-xs">
                            {#each users as u (u.id)}
                                <tr class="hover:bg-slate-50/90 dark:hover:bg-[#15223e]/60 transition-colors">
                                    <!-- Pengguna & Kontak -->
                                    <td class="py-4 px-5">
                                        <div class="flex items-center gap-3.5">
                                            <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs flex-shrink-0">
                                                {getInitial(u.name)}
                                            </div>
                                            <div class="min-w-0">
                                                <div class="flex items-center gap-2">
                                                    <span class="font-bold text-slate-900 dark:text-white truncate">{u.name}</span>
                                                    {#if u.company}
                                                        <span class="px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-[#1b263b] text-[10px] text-slate-600 dark:text-slate-300 font-medium truncate max-w-[120px] border border-slate-200/60 dark:border-[#2a3a59]">
                                                            {u.company}
                                                        </span>
                                                    {/if}
                                                </div>
                                                <div class="flex items-center gap-1.5 mt-0.5">
                                                    <span class="text-slate-500 dark:text-slate-400 font-mono text-[11px] truncate">{u.email}</span>
                                                    <Tooltip text={copiedText === u.email ? 'Tersalin!' : 'Salin Email'} position="top">
                                                        <button
                                                            type="button"
                                                            class="text-slate-400 hover:text-blue-500 p-0.5 cursor-pointer transition-colors"
                                                            on:click={() => copyToClipboard(u.email, 'Email')}
                                                            aria-label="Salin Email"
                                                        >
                                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                            </svg>
                                                        </button>
                                                    </Tooltip>
                                                </div>
                                                {#if u.whatsapp}
                                                    <div class="mt-1">
                                                        <Tooltip text="Buka Chat WhatsApp" position="top">
                                                            <a
                                                                href="https://wa.me/{u.whatsapp.replace(/\D/g, '')}"
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all hover:scale-[1.02]"
                                                            >
                                                                <svg class="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                                                    <path d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.98-.277-.1-.478-.15-.68.15-.202.301-.78.98-.956 1.182-.175.201-.351.226-.652.075-.301-.15-1.27-.468-2.42-1.493-.894-.798-1.498-1.784-1.673-2.085-.176-.301-.019-.464.132-.614.136-.135.301-.351.452-.527.15-.175.201-.301.301-.502.101-.201.05-.376-.025-.527-.075-.15-.68-1.637-.93-2.24-.244-.588-.492-.508-.68-.518l-.58-.01c-.201 0-.527.075-.803.376s-1.054 1.03-1.054 2.513c0 1.482 1.079 2.913 1.23 3.114.15.201 2.124 3.243 5.145 4.547.719.31 1.28.496 1.718.636.722.23 1.378.198 1.898.12.579-.087 1.78-.727 2.03-1.43.251-.703.251-1.305.176-1.43-.075-.126-.276-.201-.577-.351z"/>
                                                                    <path d="M12.004 0C5.373 0 0 5.373 0 12c0 2.115.55 4.102 1.508 5.829L.055 24l6.338-1.416A11.94 11.94 0 0012.004 24C18.627 24 24 18.627 24 12S18.627 0 12.004 0zm0 21.873c-1.808 0-3.535-.494-5.029-1.354l-.36-.208-3.766.842.857-3.67-.23-.376A9.834 9.834 0 012.133 12C2.133 6.56 6.564 2.133 12.004 2.133 17.436 2.133 21.867 6.56 21.867 12c0 5.44-4.431 9.873-9.863 9.873z"/>
                                                                </svg>
                                                                <span class="tracking-tight">{u.whatsapp}</span>
                                                            </a>
                                                        </Tooltip>
                                                    </div>
                                                {/if}
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Status Akun -->
                                    <td class="py-4 px-4">
                                        <div class="space-y-1.5">
                                            <div>
                                                {#if u.verified}
                                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                                        Verified
                                                    </span>
                                                {:else}
                                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400 border border-amber-300 dark:border-amber-500/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                                                        Belum Verifikasi
                                                    </span>
                                                {/if}
                                            </div>
                                            <div>
                                                {#if u.banned}
                                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-300 dark:border-rose-500/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                        Diblokir
                                                    </span>
                                                {:else}
                                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-500/15 dark:text-blue-400 border border-blue-300 dark:border-blue-500/30">
                                                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                                        Aktif
                                                    </span>
                                                {/if}
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Lisensi & Pesanan -->
                                    <td class="py-4 px-4">
                                        <div>
                                            <span class="font-extrabold text-slate-800 dark:text-slate-200">{u.devicesCount} Lisensi PC</span>
                                            <p class="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                                                {u.ordersCount} Pesanan • <span class="font-bold text-emerald-700 dark:text-emerald-400">{formatRupiah(u.totalSpent)}</span>
                                            </p>
                                        </div>
                                    </td>

                                    <!-- Program Afiliasi -->
                                    <td class="py-4 px-4">
                                        {#if u.isAffiliate}
                                            <div class="space-y-1.5">
                                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-500/30">
                                                    Mitra Afiliasi
                                                </span>
                                                {#if u.affiliateKupon}
                                                    <div class="flex items-center gap-1 text-[11px] font-mono text-slate-600 dark:text-slate-300 font-bold">
                                                        <span>Kupon:</span>
                                                        <span class="text-blue-600 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">{u.affiliateKupon}</span>
                                                        <Tooltip text={copiedText === u.affiliateKupon ? 'Tersalin!' : 'Salin Kupon'} position="top">
                                                            <button
                                                                type="button"
                                                                class="text-slate-400 hover:text-blue-500 p-0.5 cursor-pointer"
                                                                on:click={() => copyToClipboard(u.affiliateKupon || '', 'Kupon')}
                                                                aria-label="Salin Kupon"
                                                            >
                                                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                                </svg>
                                                            </button>
                                                        </Tooltip>
                                                    </div>
                                                {/if}
                                            </div>
                                        {:else}
                                            <span class="text-[11px] text-slate-400 font-medium">Bukan Mitra</span>
                                        {/if}
                                    </td>

                                    <!-- Registrasi & Lokasi -->
                                    <td class="py-4 px-4">
                                        <div>
                                            <p class="text-slate-700 dark:text-slate-300 font-medium text-[11px]">{u.created}</p>
                                            <div class="flex items-center gap-1 mt-1 text-slate-400 text-[10px] font-mono">
                                                {#if u.location?.city}
                                                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1b263b] border border-slate-200/60 dark:border-[#2a3a59]">
                                                        📍 {u.location.city}, {u.location.country || 'ID'}
                                                    </span>
                                                {:else if u.ip}
                                                    <span class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-[#1b263b] border border-slate-200/60 dark:border-[#2a3a59]">
                                                        IP: {u.ip}
                                                    </span>
                                                {:else}
                                                    <span>-</span>
                                                {/if}
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Aksi Buttons Dock -->
                                    <td class="py-4 px-5 text-right">
                                        <div class="inline-flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-[#0a1120] border border-slate-200/80 dark:border-[#1e2a42] shadow-xs">
                                            <!-- Detail Button -->
                                            <Tooltip text="Lihat Detail" position="top">
                                                <button
                                                    type="button"
                                                    class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-white dark:hover:bg-[#15223e] transition-all hover:scale-105 shadow-2xs cursor-pointer"
                                                    on:click={() => openDetailModal(u)}
                                                    aria-label="Lihat Detail Pengguna"
                                                >
                                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                    </svg>
                                                </button>
                                            </Tooltip>

                                            <!-- Edit Info Button -->
                                            <Tooltip text="Edit Profil" position="top">
                                                <button
                                                    type="button"
                                                    class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-[#15223e] transition-all hover:scale-105 shadow-2xs cursor-pointer"
                                                    on:click={() => openEditModal(u)}
                                                    aria-label="Edit Profil Pengguna"
                                                >
                                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                    </svg>
                                                </button>
                                            </Tooltip>

                                            <!-- Reset Password Button -->
                                            <Tooltip text="Reset Password" position="top">
                                                <button
                                                    type="button"
                                                    class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-white dark:hover:bg-[#15223e] transition-all hover:scale-105 shadow-2xs cursor-pointer"
                                                    on:click={() => openResetPasswordModal(u)}
                                                    aria-label="Reset Kata Sandi"
                                                >
                                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                    </svg>
                                                </button>
                                            </Tooltip>

                                            <!-- Toggle Verify Button -->
                                            <Tooltip text={u.verified ? 'Batalkan Verifikasi' : 'Verifikasi Akun'} position="top">
                                                <button
                                                    type="button"
                                                    class="w-7 h-7 flex items-center justify-center rounded-lg {u.verified ? 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/15' : 'text-slate-400 hover:text-emerald-500 hover:bg-white dark:hover:bg-[#15223e]'} transition-all hover:scale-105 shadow-2xs cursor-pointer"
                                                    on:click={() => openVerifyModal(u)}
                                                    aria-label={u.verified ? 'Batalkan Verifikasi' : 'Verifikasi Akun'}
                                                >
                                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                </button>
                                            </Tooltip>

                                            <!-- Toggle Ban Button -->
                                            <Tooltip text={u.banned ? 'Buka Blokir' : 'Blokir Akun'} position="top">
                                                <button
                                                    type="button"
                                                    class="w-7 h-7 flex items-center justify-center rounded-lg {u.banned ? 'text-rose-600 dark:text-rose-400 hover:bg-rose-500/15' : 'text-slate-400 hover:text-rose-500 hover:bg-white dark:hover:bg-[#15223e]'} transition-all hover:scale-105 shadow-2xs cursor-pointer"
                                                    on:click={() => openBanModal(u)}
                                                    aria-label={u.banned ? 'Buka Blokir' : 'Blokir Akun'}
                                                >
                                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                                    </svg>
                                                </button>
                                            </Tooltip>
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Mobile Card List View -->
                <div class="block md:hidden divide-y divide-slate-200/80 dark:divide-[#22314d]">
                    {#each users as u (u.id)}
                        <div class="p-4 space-y-3">
                            <div class="flex items-center justify-between">
                                <div class="flex items-center gap-2.5">
                                    <div class="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-sm shadow-xs">
                                        {getInitial(u.name)}
                                    </div>
                                    <div>
                                        <h4 class="font-bold text-slate-900 dark:text-white text-xs">{u.name}</h4>
                                        <p class="text-[11px] font-mono text-slate-500 dark:text-slate-400">{u.email}</p>
                                    </div>
                                </div>
                                <div>
                                    {#if u.banned}
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400">Banned</span>
                                    {:else if u.verified}
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400">Verified</span>
                                    {:else}
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-400">Unverified</span>
                                    {/if}
                                </div>
                            </div>

                            <div class="grid grid-cols-2 gap-2 text-[11px] p-2.5 rounded-xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d]">
                                <div>
                                    <span class="text-slate-400">Lisensi & Belanja:</span>
                                    <p class="font-bold text-slate-800 dark:text-slate-200">{u.devicesCount} PC • {formatRupiah(u.totalSpent)}</p>
                                </div>
                                <div>
                                    <span class="text-slate-400">Status Afiliasi:</span>
                                    <p class="font-bold {u.isAffiliate ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-500'}">
                                        {u.isAffiliate ? (u.affiliateKupon || 'Mitra') : 'Bukan Mitra'}
                                    </p>
                                </div>
                            </div>

                            <!-- Mobile Action Buttons -->
                            <div class="flex items-center justify-between pt-1">
                                <span class="text-[10px] text-slate-400 font-mono">{u.created}</span>
                                <div class="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100 dark:bg-[#0a1120] border border-slate-200/80 dark:border-[#1e2a42]">
                                    <button
                                        type="button"
                                        class="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white shadow-xs cursor-pointer"
                                        on:click={() => openDetailModal(u)}
                                    >
                                        Detail
                                    </button>
                                    <button
                                        type="button"
                                        class="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#15223e] cursor-pointer"
                                        on:click={() => openEditModal(u)}
                                        aria-label="Edit"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        class="p-1 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-[#15223e] cursor-pointer"
                                        on:click={() => openResetPasswordModal(u)}
                                        aria-label="Reset Password"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                    </button>
                                    <button
                                        type="button"
                                        class="p-1 rounded-lg {u.banned ? 'text-rose-600' : 'text-slate-400 hover:text-rose-600'} hover:bg-white dark:hover:bg-[#15223e] cursor-pointer"
                                        on:click={() => openBanModal(u)}
                                        aria-label={u.banned ? 'Buka Blokir' : 'Blokir'}
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Numbered Pagination Bar with PageSize Selector -->
                <div class="p-4 border-t border-slate-200/80 dark:border-[#22314d] flex flex-col sm:flex-row items-center justify-between gap-4 relative z-20">
                    <div class="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                        <p class="text-xs text-slate-500 dark:text-slate-400">
                            Menampilkan <span class="font-bold text-slate-700 dark:text-slate-200">{(currentPage - 1) * pageSize + 1}</span> - <span class="font-bold text-slate-700 dark:text-slate-200">{Math.min(currentPage * pageSize, totalItems)}</span> dari <span class="font-bold text-slate-700 dark:text-slate-200">{totalItems}</span> pengguna
                        </p>
                        <div class="flex items-center gap-1.5">
                            <CustomSelect options={pageSizeOptions} value={pageSize} on:change={handlePageSizeChange} />
                        </div>
                    </div>

                    {#if totalPages > 1}
                        <div class="flex items-center gap-1.5">
                            <!-- Prev Button -->
                            <button
                                type="button"
                                class="p-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#22314d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a263e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                disabled={currentPage <= 1}
                                on:click={() => goToPage(currentPage - 1)}
                            >
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            <!-- Number Pills -->
                            {#each getPaginationPages(currentPage, totalPages) as p}
                                {#if p === '...'}
                                    <span class="px-2 text-xs text-slate-400 select-none">...</span>
                                {:else}
                                    <button
                                        type="button"
                                        class="w-8 h-8 rounded-xl text-xs font-bold transition-all duration-150 {currentPage === p ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a263e] border border-slate-200 dark:border-[#22314d]'} cursor-pointer"
                                        on:click={() => goToPage(Number(p))}
                                    >
                                        {p}
                                    </button>
                                {/if}
                            {/each}

                            <!-- Next Button -->
                            <button
                                type="button"
                                class="p-2 rounded-xl text-xs font-semibold border border-slate-200 dark:border-[#22314d] text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-[#1a263e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                                disabled={currentPage >= totalPages}
                                on:click={() => goToPage(currentPage + 1)}
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

    <!-- Detail Modal -->
    {#if detailModalOpen}
        <div 
            class="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-[#070c16]/80 backdrop-blur-sm transition-opacity" 
            role="dialog" 
            aria-modal="true" 
            on:click|self={() => detailModalOpen = false}
        >
            <div class="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl sm:rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl overflow-hidden transition-all">
                <!-- Modal Sticky Header -->
                <div class="flex items-center justify-between p-4 sm:p-5 pb-3 sm:pb-4 border-b border-slate-200 dark:border-[#22314d] bg-slate-50/75 dark:bg-[#0b1324]/75 flex-shrink-0">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-11 h-11 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-black text-base sm:text-lg flex items-center justify-center shadow-md shadow-blue-600/30 flex-shrink-0">
                            {selectedUserDetail ? getInitial(selectedUserDetail.user.name) : 'U'}
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
                                <h3 class="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate max-w-[200px] sm:max-w-xs">
                                    {selectedUserDetail ? selectedUserDetail.user.name : 'Detail Pengguna'}
                                </h3>
                                {#if selectedUserDetail?.user.company}
                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#1a263e] text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-[#22314d] truncate max-w-[130px]">
                                        <svg class="w-2.5 h-2.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                        <span class="truncate">{selectedUserDetail.user.company}</span>
                                    </span>
                                {/if}
                            </div>
                            <div class="flex items-center gap-2 mt-0.5 min-w-0">
                                <span class="text-xs text-slate-500 dark:text-slate-400 font-mono truncate max-w-[200px] sm:max-w-xs">
                                    {selectedUserDetail ? selectedUserDetail.user.email : ''}
                                </span>
                                {#if selectedUserDetail}
                                    <button
                                        type="button"
                                        class="text-slate-400 hover:text-blue-500 transition-colors p-0.5 cursor-pointer flex-shrink-0"
                                        on:click={() => copyToClipboard(selectedUserDetail.user.email, 'Email Pengguna')}
                                        title="Salin Email"
                                    >
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </button>
                                {/if}
                            </div>
                        </div>
                    </div>
                    <button
                        type="button"
                        class="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-[#1a263e] transition-colors cursor-pointer flex-shrink-0 ml-2"
                        on:click={() => detailModalOpen = false}
                        aria-label="Tutup Modal"
                    >
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <!-- Modal Scrollable Content -->
                <div class="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 sm:space-y-5">
                    {#if detailLoading}
                        <div class="p-12 text-center text-slate-400">
                            <div class="inline-block animate-spin w-8 h-8 border-3 border-slate-300 dark:border-slate-700 border-t-blue-600 rounded-full mb-3"></div>
                            <p class="text-xs font-semibold">Memuat data detail pengguna...</p>
                        </div>
                    {:else if selectedUserDetail}
                        <!-- Profile Details Grid (2x2 on mobile, 4 cols on sm+) -->
                        <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-2.5">
                            <!-- WhatsApp -->
                            <div class="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] flex flex-col justify-between min-w-0">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">WhatsApp</span>
                                <div class="mt-1 min-w-0">
                                    {#if selectedUserDetail.user.whatsapp}
                                        <a
                                            href={getWhatsAppLink(selectedUserDetail.user.whatsapp)}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="inline-flex items-center gap-1 font-bold text-xs text-emerald-600 dark:text-emerald-400 hover:underline max-w-full truncate"
                                            title={selectedUserDetail.user.whatsapp}
                                        >
                                            <svg class="w-3.5 h-3.5 fill-current flex-shrink-0" viewBox="0 0 24 24">
                                                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                                            </svg>
                                            <span class="truncate">{selectedUserDetail.user.whatsapp}</span>
                                        </a>
                                    {:else}
                                        <span class="text-xs font-semibold text-slate-400">Belum diatur</span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Status Email -->
                            <div class="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] flex flex-col justify-between min-w-0">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Email</span>
                                <div class="mt-1 min-w-0">
                                    {#if selectedUserDetail.user.verified}
                                        <span class="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md sm:rounded-full text-[10px] font-extrabold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0"></span>
                                            <span class="truncate">Terverifikasi</span>
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md sm:rounded-full text-[10px] font-extrabold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0"></span>
                                            <span class="truncate">Belum Verifikasi</span>
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Status Akun -->
                            <div class="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] flex flex-col justify-between min-w-0">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Akun</span>
                                <div class="mt-1 min-w-0">
                                    {#if selectedUserDetail.user.banned}
                                        <span class="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md sm:rounded-full text-[10px] font-extrabold bg-rose-500/15 text-rose-700 dark:text-rose-400 border border-rose-500/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0"></span>
                                            <span class="truncate">Diblokir</span>
                                        </span>
                                    {:else}
                                        <span class="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md sm:rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0"></span>
                                            <span class="truncate">Aktif Normal</span>
                                        </span>
                                    {/if}
                                </div>
                            </div>

                            <!-- Program Afiliasi -->
                            <div class="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] flex flex-col justify-between min-w-0">
                                <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Afiliasi</span>
                                <div class="mt-1 min-w-0">
                                    {#if selectedUserDetail.affiliate}
                                        <span
                                            class="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md sm:rounded-full text-[10px] font-extrabold bg-purple-500/15 text-purple-700 dark:text-purple-300 border border-purple-500/30"
                                            title="Kupon: {selectedUserDetail.affiliate.kupon}"
                                        >
                                            <span class="truncate font-mono">{selectedUserDetail.affiliate.kupon}</span>
                                        </span>
                                    {:else}
                                        <span class="text-xs font-semibold text-slate-400">Bukan Mitra</span>
                                    {/if}
                                </div>
                            </div>
                        </div>

                        <!-- Inner Tabs with Smooth Animated Sliding Pill Backdrop -->
                        <div
                            bind:this={detailTabContainer}
                            class="relative flex items-center p-1 rounded-xl sm:rounded-2xl bg-slate-100/90 dark:bg-[#0b1324] border border-slate-200/80 dark:border-[#22314d] select-none"
                            role="tablist"
                        >
                            <!-- Animated Sliding Pill Backdrop -->
                            {#if detailPillInitialized && detailPillStyle.width > 0}
                                <div
                                    class="absolute top-1 bottom-1 rounded-lg sm:rounded-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none {detailPillColorClass}"
                                    style="left: {detailPillStyle.left}px; width: {detailPillStyle.width}px;"
                                ></div>
                            {/if}

                            <button
                                type="button"
                                role="tab"
                                aria-selected={detailActiveTab === 'devices'}
                                bind:this={detailTabElements['devices']}
                                class="relative z-10 flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border-0 bg-transparent active:scale-[0.98] {detailActiveTab === 'devices' ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'}"
                                on:click={() => setDetailTab('devices')}
                            >
                                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span class="hidden sm:inline">Lisensi PC</span>
                                <span class="sm:hidden">Lisensi</span>
                                <span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold flex-shrink-0 transition-colors duration-200 {detailActiveTab === 'devices' ? 'bg-white/20 text-white border border-white/30' : 'bg-slate-200/90 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60'}">
                                    {selectedUserDetail.devices.length}
                                </span>
                            </button>

                            <button
                                type="button"
                                role="tab"
                                aria-selected={detailActiveTab === 'orders'}
                                bind:this={detailTabElements['orders']}
                                class="relative z-10 flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border-0 bg-transparent active:scale-[0.98] {detailActiveTab === 'orders' ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'}"
                                on:click={() => setDetailTab('orders')}
                            >
                                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                </svg>
                                <span class="hidden sm:inline">Riwayat Pesanan</span>
                                <span class="sm:hidden">Pesanan</span>
                                <span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold flex-shrink-0 transition-colors duration-200 {detailActiveTab === 'orders' ? 'bg-white/20 text-white border border-white/30' : 'bg-slate-200/90 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60'}">
                                    {selectedUserDetail.orders.length}
                                </span>
                            </button>

                            {#if selectedUserDetail.locations && selectedUserDetail.locations.length > 0}
                                <button
                                    type="button"
                                    role="tab"
                                    aria-selected={detailActiveTab === 'locations'}
                                    bind:this={detailTabElements['locations']}
                                    class="relative z-10 flex-1 py-1.5 sm:py-2 px-2 sm:px-3 rounded-lg sm:rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 cursor-pointer border-0 bg-transparent active:scale-[0.98] {detailActiveTab === 'locations' ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-semibold'}"
                                    on:click={() => setDetailTab('locations')}
                                >
                                    <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                    </svg>
                                    <span class="hidden sm:inline">Lokasi IP</span>
                                    <span class="sm:hidden">Lokasi</span>
                                    <span class="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold flex-shrink-0 transition-colors duration-200 {detailActiveTab === 'locations' ? 'bg-white/20 text-white border border-white/30' : 'bg-slate-200/90 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300/60 dark:border-slate-700/60'}">
                                        {selectedUserDetail.locations.length}
                                    </span>
                                </button>
                            {/if}
                        </div>

                        <!-- Tab 1: Lisensi PC -->
                        {#if detailActiveTab === 'devices'}
                            {#if selectedUserDetail.devices.length === 0}
                                <div class="p-8 rounded-2xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-center space-y-2">
                                    <div class="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">Belum Ada Lisensi PC</h4>
                                    <p class="text-[11px] text-slate-400 max-w-sm mx-auto">Pengguna ini belum mengaktifkan lisensi software pada perangkat komputer manapun.</p>
                                </div>
                            {:else}
                                <div class="space-y-3 max-h-72 overflow-y-auto pr-0.5">
                                    {#each selectedUserDetail.devices as d}
                                        <div class="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] space-y-2.5 text-xs hover:border-blue-500/40 transition-all">
                                            <!-- Device Header: Product Name + Order Badge + Status Badge -->
                                            <div class="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                                <div class="flex items-center gap-2 min-w-0 flex-1">
                                                    <div class="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                                        </svg>
                                                    </div>
                                                    <span class="font-bold text-slate-900 dark:text-white truncate text-sm">{d.product}</span>
                                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200/80 dark:bg-[#1a263e] text-slate-700 dark:text-slate-300 flex-shrink-0">
                                                        {d.order_id ? `Order #${d.order_id}` : `ID #${d.id}`}
                                                    </span>
                                                </div>
                                                <div class="flex items-center gap-1.5 flex-shrink-0">
                                                    {#if d.duration}
                                                        <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                                            {d.duration} Hari
                                                        </span>
                                                    {/if}
                                                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold {d.is_expired ? 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-400 border border-rose-500/30' : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-400 border border-emerald-500/30'}">
                                                        {d.is_expired ? 'Expired' : 'Aktif'}
                                                    </span>
                                                </div>
                                            </div>

                                            <!-- Machine ID Box -->
                                            <div class="flex items-center justify-between gap-2 p-2 rounded-lg bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#1e2d4a]">
                                                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                                                    <svg class="w-3.5 h-3.5 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                                                    </svg>
                                                    <span class="font-mono text-[11px] text-slate-600 dark:text-slate-300 truncate" title={d.machine_id}>
                                                        {d.machine_id}
                                                    </span>
                                                </div>
                                                <button
                                                    type="button"
                                                    class="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-bold bg-slate-100 dark:bg-[#1a263e] hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 transition-colors flex-shrink-0 cursor-pointer"
                                                    on:click={() => copyToClipboard(d.machine_id, 'Machine ID')}
                                                    title="Salin Machine ID"
                                                >
                                                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                                    </svg>
                                                    <span>Salin</span>
                                                </button>
                                            </div>

                                            <!-- Dates Row -->
                                            <div class="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                                                <div class="flex items-center gap-1">
                                                    <svg class="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                                    </svg>
                                                    <span>Daftar: {d.created}</span>
                                                </div>
                                                <div class="flex items-center gap-1 font-semibold {d.is_expired ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}">
                                                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>Exp: {d.expired}</span>
                                                </div>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        <!-- Tab 2: Orders -->
                        {:else if detailActiveTab === 'orders'}
                            {#if selectedUserDetail.orders.length === 0}
                                <div class="p-8 rounded-2xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-center space-y-2">
                                    <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                                        </svg>
                                    </div>
                                    <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">Belum Ada Riwayat Pesanan</h4>
                                    <p class="text-[11px] text-slate-400 max-w-sm mx-auto">Pengguna ini belum melakukan transaksi pesanan atau pembelian software.</p>
                                </div>
                            {:else}
                                <div class="space-y-2.5 max-h-72 overflow-y-auto pr-0.5">
                                    {#each selectedUserDetail.orders as o}
                                        {@const badge = getOrderStatusBadge(o.status)}
                                        <div class="p-3 sm:p-3.5 rounded-xl sm:rounded-2xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] flex items-center justify-between gap-2 text-xs hover:border-emerald-500/30 transition-colors">
                                            <div class="space-y-1 min-w-0">
                                                <div class="flex items-center gap-1.5 flex-wrap">
                                                    <span class="font-bold text-slate-900 dark:text-white">Order #{o.id}</span>
                                                    <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-200 dark:bg-[#1a263e] text-slate-600 dark:text-slate-300">
                                                        {o.channel_code || o.payment || 'Direct'}
                                                    </span>
                                                </div>
                                                <p class="text-[11px] text-slate-400 flex items-center gap-1">
                                                    <svg class="w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                    </svg>
                                                    <span>{o.created}</span>
                                                </p>
                                            </div>
                                            <div class="text-right flex flex-col items-end gap-1 flex-shrink-0">
                                                <span class="font-black text-emerald-600 dark:text-emerald-400 text-xs sm:text-sm font-mono">
                                                    {formatRupiah(o.total_amount)}
                                                </span>
                                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border {badge.bg}">
                                                    <span class="w-1.5 h-1.5 rounded-full {badge.dot}"></span>
                                                    <span>{badge.label}</span>
                                                </span>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        <!-- Tab 3: Locations -->
                        {:else if detailActiveTab === 'locations'}
                            {#if selectedUserDetail.locations.length === 0}
                                <div class="p-8 rounded-2xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-center space-y-2">
                                    <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto">
                                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                    </div>
                                    <h4 class="text-xs font-bold text-slate-800 dark:text-slate-200">Belum Ada Riwayat Lokasi</h4>
                                    <p class="text-[11px] text-slate-400 max-w-sm mx-auto">Belum ada riwayat geolokasi IP login untuk pengguna ini.</p>
                                </div>
                            {:else}
                                <div class="space-y-2 max-h-72 overflow-y-auto pr-0.5">
                                    {#each selectedUserDetail.locations as loc}
                                        <div class="p-3 rounded-xl bg-slate-50 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] flex items-center justify-between gap-2 text-xs">
                                            <div class="min-w-0">
                                                <div class="flex items-center gap-1.5">
                                                    <svg class="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                                    </svg>
                                                    <span class="font-mono font-bold text-slate-900 dark:text-white truncate">{loc.ip}</span>
                                                </div>
                                                <p class="text-[11px] text-slate-400 mt-0.5 truncate pl-5">
                                                    {[loc.city, loc.region, loc.country].filter(Boolean).join(', ') || 'Lokasi tidak diketahui'}
                                                </p>
                                            </div>
                                            {#if loc.timezone}
                                                <span class="text-[10px] text-slate-400 font-mono flex-shrink-0 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-[#1a263e]">
                                                    {loc.timezone}
                                                </span>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        {/if}
                    {/if}
                </div>

                <!-- Modal Sticky Footer -->
                <div class="p-3.5 sm:p-5 pt-3 sm:pt-4 border-t border-slate-200 dark:border-[#22314d] bg-slate-50/75 dark:bg-[#0b1324]/75 flex items-center justify-between gap-2 flex-shrink-0">
                    <div class="flex items-center gap-2">
                        {#if selectedUserDetail?.user.whatsapp}
                            <a
                                href={getWhatsAppLink(selectedUserDetail.user.whatsapp)}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-600/20"
                            >
                                <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                    <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/>
                                </svg>
                                <span class="hidden sm:inline">Hubungi Pengguna</span>
                                <span class="sm:hidden">WhatsApp</span>
                            </a>
                        {/if}
                        {#if selectedUserDetail}
                            <button
                                type="button"
                                class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#1a263e] hover:bg-blue-50 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 border border-slate-200 dark:border-[#22314d] transition-all cursor-pointer"
                                on:click={() => {
                                    if (selectedUserDetail) {
                                        openEditModal(selectedUserDetail.user);
                                    }
                                }}
                            >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                <span>Edit Data</span>
                            </button>
                        {/if}
                    </div>

                    <button
                        type="button"
                        class="px-4 sm:px-5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-[#1a263e] hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#22314d] transition-all cursor-pointer"
                        on:click={() => detailModalOpen = false}
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Edit User Modal -->
    {#if editModalOpen && editingUser}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-sm" role="dialog" aria-modal="true" on:click|self={() => editModalOpen = false}>
            <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl p-6 space-y-5">
                <div class="flex items-center justify-between border-b border-slate-200 dark:border-[#22314d] pb-3">
                    <h3 class="font-extrabold text-slate-900 dark:text-white text-base">Edit Data Pengguna</h3>
                    <button type="button" class="text-slate-400 hover:text-white cursor-pointer" on:click={() => editModalOpen = false}>✕</button>
                </div>

                <div class="space-y-4 text-xs">
                    <!-- Email Locked -->
                    <div>
                        <label for="edit-email-locked" class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Email Pengguna (Terkunci)</label>
                        <input id="edit-email-locked" type="text" class="w-full px-3 py-2 rounded-xl bg-slate-100 dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-500 cursor-not-allowed font-mono" value={editingUser.email} disabled />
                        <span class="text-[10px] text-slate-400 mt-1 block">Email bersifat permanen dan tidak dapat diubah.</span>
                    </div>

                    <!-- Nama -->
                    <div>
                        <label for="edit-name-input" class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nama Lengkap</label>
                        <input id="edit-name-input" type="text" class="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500" bind:value={editForm.name} />
                    </div>

                    <!-- WhatsApp -->
                    <div>
                        <label for="edit-whatsapp-input" class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Nomor WhatsApp</label>
                        <input id="edit-whatsapp-input" type="text" class="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500" placeholder="08xxx / 628xxx" bind:value={editForm.whatsapp} />
                    </div>

                    <!-- Perusahaan -->
                    <div>
                        <label for="edit-company-input" class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Perusahaan / Toko</label>
                        <input id="edit-company-input" type="text" class="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500" bind:value={editForm.company} />
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button type="button" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" on:click={() => editModalOpen = false}>
                        Batal
                    </button>
                    <button
                        type="button"
                        class="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
                        disabled={isSubmittingEdit}
                        on:click={submitEditUser}
                    >
                        {isSubmittingEdit ? 'Menyimpan...' : 'Simpan Perubahan'}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Reset Password Modal -->
    {#if resetPasswordModalOpen && resetTargetUser}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-sm" role="dialog" aria-modal="true" on:click|self={() => resetPasswordModalOpen = false}>
            <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl p-6 space-y-5">
                <div class="flex items-center justify-between border-b border-slate-200 dark:border-[#22314d] pb-3">
                    <h3 class="font-extrabold text-slate-900 dark:text-white text-base">Reset Kata Sandi</h3>
                    <button type="button" class="text-slate-400 hover:text-white cursor-pointer" on:click={() => resetPasswordModalOpen = false}>✕</button>
                </div>

                <div class="space-y-4 text-xs">
                    <p class="text-slate-600 dark:text-slate-400">
                        Setel kata sandi baru untuk member <b>{resetTargetUser.name}</b> ({resetTargetUser.email}):
                    </p>

                    <div>
                        <label for="new-password-input" class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Password Baru (Min. 6 Karakter)</label>
                        <input
                            id="new-password-input"
                            type="text"
                            class="w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white font-mono focus:ring-2 focus:ring-amber-500"
                            placeholder="Masukkan password baru..."
                            bind:value={newPasswordInput}
                        />
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button type="button" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" on:click={() => resetPasswordModalOpen = false}>
                        Batal
                    </button>
                    <button
                        type="button"
                        class="px-5 py-2 rounded-xl text-xs font-bold bg-amber-600 text-white hover:bg-amber-700 shadow-md shadow-amber-600/30 disabled:opacity-50 cursor-pointer"
                        disabled={isSubmittingResetPassword || !newPasswordInput || newPasswordInput.trim().length < 6}
                        on:click={submitResetPassword}
                    >
                        {isSubmittingResetPassword ? 'Mereset...' : 'Reset Password'}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Toggle Ban Modal -->
    {#if banModalOpen && banTargetUser}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-sm" role="dialog" aria-modal="true" on:click|self={() => banModalOpen = false}>
            <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl p-6 space-y-5">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl {banTargetUser.banned ? 'bg-blue-500/15 text-blue-500' : 'bg-rose-500/15 text-rose-500'} flex items-center justify-center text-xl">
                        🛡️
                    </div>
                    <div>
                        <h3 class="font-extrabold text-slate-900 dark:text-white text-base">
                            {banTargetUser.banned ? 'Buka Blokir Pengguna?' : 'Blokir Pengguna Ini?'}
                        </h3>
                        <p class="text-xs text-slate-500">{banTargetUser.email}</p>
                    </div>
                </div>

                <p class="text-xs text-slate-600 dark:text-slate-400">
                    {#if banTargetUser.banned}
                        Akun pengguna akan dipulihkan dan dapat kembali login serta mengakses lisensi aplikasi miliknya.
                    {:else}
                        Akun pengguna akan ditangguhkan dari sistem. Pengguna tidak dapat login ke portal member sampai blokir dibuka kembali.
                    {/if}
                </p>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button type="button" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" on:click={() => banModalOpen = false}>
                        Batal
                    </button>
                    <button
                        type="button"
                        class="px-5 py-2 rounded-xl text-xs font-bold {banTargetUser.banned ? 'bg-blue-600 hover:bg-blue-700 shadow-blue-600/30' : 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/30'} text-white shadow-md disabled:opacity-50 cursor-pointer"
                        disabled={isSubmittingBan}
                        on:click={submitToggleBan}
                    >
                        {isSubmittingBan ? 'Memproses...' : (banTargetUser.banned ? 'Ya, Buka Blokir' : 'Ya, Blokir Akun')}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Toggle Verify Modal -->
    {#if verifyModalOpen && verifyTargetUser}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-sm" role="dialog" aria-modal="true" on:click|self={() => verifyModalOpen = false}>
            <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl p-6 space-y-5">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-500 flex items-center justify-center text-xl">
                        ✉️
                    </div>
                    <div>
                        <h3 class="font-extrabold text-slate-900 dark:text-white text-base">
                            {verifyTargetUser.verified ? 'Batalkan Status Verifikasi?' : 'Verifikasi Akun Secara Manual?'}
                        </h3>
                        <p class="text-xs text-slate-500">{verifyTargetUser.email}</p>
                    </div>
                </div>

                <p class="text-xs text-slate-600 dark:text-slate-400">
                    {#if verifyTargetUser.verified}
                        Status verifikasi akun akan dicabut menjadi belum diverifikasi.
                    {:else}
                        Akun pengguna akan langsung diverifikasi secara manual oleh administrator tanpa memerlukan konfirmasi email.
                    {/if}
                </p>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button type="button" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" on:click={() => verifyModalOpen = false}>
                        Batal
                    </button>
                    <button
                        type="button"
                        class="px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 shadow-md shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
                        disabled={isSubmittingVerify}
                        on:click={submitToggleVerify}
                    >
                        {isSubmittingVerify ? 'Memproses...' : (verifyTargetUser.verified ? 'Ya, Cabut Verifikasi' : 'Ya, Verifikasi Akun')}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</AdminLayout>
