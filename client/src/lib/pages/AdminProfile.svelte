<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import AdminLayout from '../components/AdminLayout.svelte';
    import Tooltip from '../components/Tooltip.svelte';

    interface AdminProfileData {
        id: number;
        username: string;
        role: string;
        isSuperAdmin: boolean;
        ip: string;
        hasPin: boolean;
    }

    interface AdminStats {
        totalProducts: number;
        totalCategories: number;
        totalAffiliates: number;
    }

    interface SystemInfo {
        nodeVersion: string;
        platform: string;
        uptimeHours: number;
        memoryMb: number;
    }

    interface AdminAccount {
        id: number;
        username: string;
        role: string;
        isSuperAdmin: boolean;
        ip: string;
        hasPin: boolean;
        isCurrentAdmin: boolean;
    }

    let loading = true;
    let savingUsername = false;
    let savingPin = false;

    let admin: AdminProfileData = {
        id: 0,
        username: 'Admin',
        role: 'Super Administrator',
        isSuperAdmin: true,
        ip: '127.0.0.1',
        hasPin: true
    };

    let stats: AdminStats = {
        totalProducts: 0,
        totalCategories: 0,
        totalAffiliates: 0
    };

    let system: SystemInfo = {
        nodeVersion: 'v24.x',
        platform: 'darwin',
        uptimeHours: 0,
        memoryMb: 0
    };

    // Username form
    let formUsername = '';
    let usernameSuccess = '';
    let usernameError = '';

    // PIN form
    let currentPin = '';
    let newPin = '';
    let confirmPin = '';
    let showCurrentPin = false;
    let showNewPin = false;
    let showConfirmPin = false;
    let pinSuccess = '';
    let pinError = '';

    // Multi-Admin Management State
    let admins: AdminAccount[] = [];
    let loadingAdmins = false;
    let adminManageSuccess = '';
    let adminManageError = '';

    // Create Admin Modal
    let createAdminModalOpen = false;
    let newAdminUsername = '';
    let newAdminRole = 'Administrator';
    let newAdminPin = '';
    let isSubmittingCreateAdmin = false;
    let createAdminError = '';

    // Reset Admin PIN Modal
    let resetPinModalOpen = false;
    let targetResetAdmin: AdminAccount | null = null;
    let targetNewPin = '';
    let targetConfirmUsername = '';
    let isSubmittingResetPin = false;
    let resetPinError = '';

    // Delete Admin Modal
    let deleteAdminModalOpen = false;
    let targetDeleteAdmin: AdminAccount | null = null;
    let isSubmittingDeleteAdmin = false;
    let deleteAdminError = '';

    function getInitial(name: string): string {
        return (name || 'A').charAt(0).toUpperCase();
    }

    async function loadProfile() {
        loading = true;
        try {
            const res = await fetch('/admin/api/profile', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (res.ok) {
                const json = await res.json();
                if (json.success) {
                    admin = json.admin;
                    stats = json.stats || stats;
                    system = json.system || system;
                    formUsername = admin.username;

                    if (admin.isSuperAdmin) {
                        loadAdminsList();
                    }
                }
            } else if (res.status === 401 || res.status === 403) {
                window.location.href = '/#/admin/login';
            }
        } catch (e) {
            console.error('Error loading admin profile:', e);
        } finally {
            loading = false;
        }
    }

    async function loadAdminsList() {
        loadingAdmins = true;
        try {
            const res = await fetch('/admin/api/admins', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (res.ok) {
                const json = await res.json();
                if (json.success) {
                    admins = json.admins || [];
                }
            }
        } catch (e) {
            console.error('Error loading admins list:', e);
        } finally {
            loadingAdmins = false;
        }
    }

    async function handleUpdateUsername(e: Event) {
        e.preventDefault();
        usernameSuccess = '';
        usernameError = '';

        if (!formUsername.trim() || formUsername.trim().length < 3) {
            usernameError = 'Username minimal 3 karakter';
            return;
        }

        savingUsername = true;
        try {
            const res = await fetch('/admin/api/profile/update-username', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ username: formUsername.trim() })
            });

            const json = await res.json();
            if (json.success) {
                usernameSuccess = json.message || 'Username berhasil diperbarui';
                admin.username = formUsername.trim();
                if (admin.isSuperAdmin) loadAdminsList();
                if (usernameTimer) clearTimeout(usernameTimer);
                usernameTimer = setTimeout(() => { usernameSuccess = ''; }, 4000);
            } else {
                usernameError = json.error || 'Gagal memperbarui username';
            }
        } catch (err: any) {
            usernameError = err.message || 'Terjadi kesalahan sistem';
        } finally {
            savingUsername = false;
        }
    }

    async function handleUpdatePin(e: Event) {
        e.preventDefault();
        pinSuccess = '';
        pinError = '';

        if (!currentPin) {
            pinError = 'PIN saat ini wajib diisi';
            return;
        }

        if (!/^\d{6}$/.test(newPin)) {
            pinError = 'PIN baru harus tepat 6 digit angka';
            return;
        }

        if (newPin !== confirmPin) {
            pinError = 'Konfirmasi PIN baru tidak sesuai';
            return;
        }

        savingPin = true;
        try {
            const res = await fetch('/admin/api/profile/update-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ currentPin, newPin })
            });

            const json = await res.json();
            if (json.success) {
                pinSuccess = json.message || 'PIN keamanan berhasil diperbarui';
                currentPin = '';
                newPin = '';
                confirmPin = '';
                if (pinTimer) clearTimeout(pinTimer);
                pinTimer = setTimeout(() => { pinSuccess = ''; }, 4000);
            } else {
                pinError = json.error || 'Gagal memperbarui PIN';
            }
        } catch (err: any) {
            pinError = err.message || 'Terjadi kesalahan sistem';
        } finally {
            savingPin = false;
        }
    }

    // Modal Handlers for Multi-Admin Management
    function openCreateAdminModal() {
        newAdminUsername = '';
        newAdminRole = 'Administrator';
        newAdminPin = '';
        createAdminError = '';
        createAdminModalOpen = true;
    }

    async function submitCreateAdmin() {
        createAdminError = '';
        if (!newAdminUsername.trim() || newAdminUsername.trim().length < 3) {
            createAdminError = 'Username minimal 3 karakter';
            return;
        }
        if (!/^\d{6}$/.test(newAdminPin)) {
            createAdminError = 'PIN wajib tepat 6 digit angka numerik';
            return;
        }

        isSubmittingCreateAdmin = true;
        try {
            const res = await fetch('/admin/api/admins/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    username: newAdminUsername.trim(),
                    role: newAdminRole,
                    pin: newAdminPin
                })
            });

            const json = await res.json();
            if (json.success) {
                createAdminModalOpen = false;
                showAdminManageMessage(json.message || 'Admin berhasil ditambahkan', true);
                loadAdminsList();
            } else {
                createAdminError = json.error || 'Gagal menambahkan admin';
            }
        } catch (err: any) {
            createAdminError = err.message || 'Terjadi kesalahan sistem';
        } finally {
            isSubmittingCreateAdmin = false;
        }
    }

    function openResetPinModal(target: AdminAccount) {
        targetResetAdmin = target;
        targetNewPin = '';
        targetConfirmUsername = '';
        resetPinError = '';
        resetPinModalOpen = true;
    }

    async function submitResetAdminPin() {
        if (!targetResetAdmin) return;
        resetPinError = '';

        if (!targetConfirmUsername || targetConfirmUsername.trim().toLowerCase() !== targetResetAdmin.username.trim().toLowerCase()) {
            resetPinError = `Konfirmasi username harus sama persis dengan "${targetResetAdmin.username}"`;
            return;
        }

        if (!/^\d{6}$/.test(targetNewPin)) {
            resetPinError = 'PIN baru harus tepat 6 digit angka numerik';
            return;
        }

        isSubmittingResetPin = true;
        try {
            const res = await fetch(`/admin/api/admins/reset-pin/${targetResetAdmin.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    newPin: targetNewPin,
                    confirmUsername: targetConfirmUsername.trim()
                })
            });

            const json = await res.json();
            if (json.success) {
                resetPinModalOpen = false;
                showAdminManageMessage(json.message || 'PIN admin berhasil direset', true);
                loadAdminsList();
            } else {
                resetPinError = json.error || 'Gagal mereset PIN admin';
            }
        } catch (err: any) {
            resetPinError = err.message || 'Terjadi kesalahan sistem';
        } finally {
            isSubmittingResetPin = false;
        }
    }

    function openDeleteAdminModal(target: AdminAccount) {
        targetDeleteAdmin = target;
        deleteAdminError = '';
        deleteAdminModalOpen = true;
    }

    async function submitDeleteAdmin() {
        if (!targetDeleteAdmin) return;
        deleteAdminError = '';
        isSubmittingDeleteAdmin = true;

        try {
            const res = await fetch(`/admin/api/admins/delete/${targetDeleteAdmin.id}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            const json = await res.json();
            if (json.success) {
                deleteAdminModalOpen = false;
                showAdminManageMessage(json.message || 'Admin berhasil dihapus', true);
                loadAdminsList();
            } else {
                deleteAdminError = json.error || 'Gagal menghapus admin';
            }
        } catch (err: any) {
            deleteAdminError = err.message || 'Terjadi kesalahan sistem';
        } finally {
            isSubmittingDeleteAdmin = false;
        }
    }

    function showAdminManageMessage(msg: string, isSuccess: boolean) {
        if (isSuccess) {
            adminManageSuccess = msg;
            adminManageError = '';
            if (adminManageTimer) clearTimeout(adminManageTimer);
            adminManageTimer = setTimeout(() => { adminManageSuccess = ''; }, 4000);
        } else {
            adminManageError = msg;
            adminManageSuccess = '';
            if (adminManageTimer) clearTimeout(adminManageTimer);
            adminManageTimer = setTimeout(() => { adminManageError = ''; }, 4000);
        }
    }

    let usernameTimer: ReturnType<typeof setTimeout> | null = null;
    let pinTimer: ReturnType<typeof setTimeout> | null = null;
    let adminManageTimer: ReturnType<typeof setTimeout> | null = null;

    onMount(() => {
        loadProfile();
    });

    onDestroy(() => {
        if (usernameTimer) clearTimeout(usernameTimer);
        if (pinTimer) clearTimeout(pinTimer);
        if (adminManageTimer) clearTimeout(adminManageTimer);
    });
</script>

<svelte:head>
    <title>Profil & Akun Admin - Ziqva Appcenter</title>
</svelte:head>

<AdminLayout activePage="profile" adminName={admin.username} eyebrow="PANEL ADMIN ZIQVA">
    <main class="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        <!-- Header Banner -->
        <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
                <div class="flex items-center gap-2 mb-1">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] uppercase tracking-wider">
                        PENGATURAN AKUN
                    </span>
                    <span class="text-xs text-[var(--text-3)] font-medium">/</span>
                    <span class="text-xs text-[var(--brand)] font-medium">Profil Administrator</span>
                </div>
                <h1 class="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight">
                    Profil & Keamanan Admin
                </h1>
                <p class="text-xs sm:text-sm text-[var(--text-3)] mt-0.5">
                    Kelola kredensial login, PIN autentikasi keamanan, akses multi-admin, dan metrik sistem Ziqva.
                </p>
            </div>

            <div class="flex items-center gap-2.5">
                <button
                    type="button"
                    on:click={loadProfile}
                    class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-all shadow-xs cursor-pointer"
                >
                    <svg class="w-4 h-4 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    <span>Segarkan</span>
                </button>
            </div>
        </div>

        {#if loading}
            <div class="p-12 text-center text-[var(--text-3)]">
                <div class="inline-block animate-spin w-8 h-8 border-3 border-[var(--border)] border-t-[var(--brand)] rounded-full mb-3"></div>
                <p class="text-xs font-semibold">Memuat profil admin...</p>
            </div>
        {:else}
            <!-- Main Responsive Grid -->
            <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <!-- Left Column: Identity & System Diagnostics -->
                <div class="space-y-6">
                    <!-- Admin Identity Card -->
                    <div class="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs relative overflow-hidden">
                        <div class="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
                        
                        <div class="flex flex-col items-center text-center space-y-3">
                            <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-extrabold text-3xl flex items-center justify-center shadow-lg shadow-blue-600/30 border-2 border-white/20">
                                {getInitial(admin.username)}
                            </div>

                            <div>
                                <h2 class="text-lg font-bold text-[var(--text)]">{admin.username}</h2>
                                <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/15 dark:bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30 mt-1">
                                    <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                    <span>{admin.role}</span>
                                </span>
                            </div>

                            <div class="w-full pt-4 border-t border-[var(--border)] space-y-2.5 text-xs text-left">
                                <div class="flex items-center justify-between">
                                    <span class="text-[var(--text-3)] font-medium">Status Akun:</span>
                                    <span class="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                                        <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                        <span>Aktif & Terverifikasi</span>
                                    </span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-[var(--text-3)] font-medium">Autentikasi:</span>
                                    <span class="font-mono font-bold text-[var(--text)] text-[11px]">PIN 6-Digit</span>
                                </div>
                                <div class="flex items-center justify-between">
                                    <span class="text-[var(--text-3)] font-medium">IP Sesi Aktif:</span>
                                    <span class="font-mono text-blue-600 dark:text-blue-400 font-bold text-[11px] bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                                        {admin.ip}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- System Diagnostics Card -->
                    <div class="p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                        <div class="flex items-center justify-between">
                            <h3 class="text-xs font-bold uppercase tracking-wider text-[var(--text-3)]">Diagnostik Sistem</h3>
                            <span class="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                Normal
                            </span>
                        </div>

                        <div class="space-y-2 text-xs">
                            <div class="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between">
                                <span class="text-[var(--text-3)]">Runtime Engine</span>
                                <span class="font-mono font-bold text-[var(--text)]">Node.js {system.nodeVersion}</span>
                            </div>
                            <div class="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between">
                                <span class="text-[var(--text-3)]">Database Pool Limit</span>
                                <span class="font-mono font-bold text-emerald-600 dark:text-emerald-400">5 Max (Active)</span>
                            </div>
                            <div class="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between">
                                <span class="text-[var(--text-3)]">Memory Usage</span>
                                <span class="font-mono font-bold text-[var(--text)]">{system.memoryMb} MB</span>
                            </div>
                            <div class="p-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] flex items-center justify-between">
                                <span class="text-[var(--text-3)]">Target Git Branch</span>
                                <span class="font-mono font-bold text-blue-600 dark:text-blue-400">reborn</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Right Column: 3-Card Metrics, Settings, & Multi-Admin Section -->
                <div class="lg:col-span-2 space-y-6">
                    <!-- 3-Card Metrics Navigation Grid -->
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                        <!-- Total Software Card Link -->
                        <a
                            href="#/admin/products"
                            class="p-4 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-blue-500/40 shadow-xs transition-all hover:scale-[1.02] flex items-center justify-between group cursor-pointer"
                        >
                            <div>
                                <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] block group-hover:text-blue-500 transition-colors">
                                    Total Software
                                </span>
                                <span class="text-2xl font-extrabold text-[var(--text)] mt-1 block">
                                    {stats.totalProducts}
                                </span>
                                <span class="text-[10px] text-blue-600 dark:text-blue-400 font-medium inline-flex items-center gap-1 mt-1">
                                    <span>Buka Katalog</span>
                                    <svg class="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                            </div>
                            <div class="w-11 h-11 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center flex-shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-all shadow-xs">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                            </div>
                        </a>

                        <!-- Kategori Card Link -->
                        <a
                            href="#/admin/categories"
                            class="p-4 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-indigo-500/40 shadow-xs transition-all hover:scale-[1.02] flex items-center justify-between group cursor-pointer"
                        >
                            <div>
                                <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] block group-hover:text-indigo-500 transition-colors">
                                    Kategori Software
                                </span>
                                <span class="text-2xl font-extrabold text-[var(--text)] mt-1 block">
                                    {stats.totalCategories}
                                </span>
                                <span class="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium inline-flex items-center gap-1 mt-1">
                                    <span>Kelola Kategori</span>
                                    <svg class="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                            </div>
                            <div class="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-xs">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                                </svg>
                            </div>
                        </a>

                        <!-- Mitra Afiliasi Card Link -->
                        <a
                            href="#/admin/affiliate"
                            class="p-4 rounded-2xl bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] hover:border-purple-500/40 shadow-xs transition-all hover:scale-[1.02] flex items-center justify-between group cursor-pointer"
                        >
                            <div>
                                <span class="text-[10px] font-bold uppercase tracking-wider text-[var(--text-3)] block group-hover:text-purple-500 transition-colors">
                                    Mitra Afiliasi
                                </span>
                                <span class="text-2xl font-extrabold text-purple-600 dark:text-purple-400 mt-1 block">
                                    {stats.totalAffiliates}
                                </span>
                                <span class="text-[10px] text-purple-600 dark:text-purple-400 font-medium inline-flex items-center gap-1 mt-1">
                                    <span>Kelola Mitra</span>
                                    <svg class="w-3 h-3 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                            </div>
                            <div class="w-11 h-11 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-all shadow-xs">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                </svg>
                            </div>
                        </a>
                    </div>

                    <!-- Multi-Admin Management Section (Super Admin Only) -->
                    {#if admin.isSuperAdmin}
                        <div class="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-[var(--border)] gap-3">
                                <div>
                                    <div class="flex items-center gap-2">
                                        <h3 class="text-sm font-bold text-[var(--text)]">Kelola Akun Administrator</h3>
                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border border-indigo-500/30">
                                            Super Admin
                                        </span>
                                    </div>
                                    <p class="text-xs text-[var(--text-3)] mt-0.5">Tambah akun admin baru, reset PIN keamanan, atau kelola wewenang sistem.</p>
                                </div>
                                <button
                                    type="button"
                                    class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20 cursor-pointer flex-shrink-0"
                                    on:click={openCreateAdminModal}
                                >
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                                    </svg>
                                    <span>Tambah Admin</span>
                                </button>
                            </div>

                            {#if adminManageSuccess}
                                <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                                    <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                    </svg>
                                    <span>{adminManageSuccess}</span>
                                </div>
                            {/if}

                            {#if adminManageError}
                                <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                                    <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                    </svg>
                                    <span>{adminManageError}</span>
                                </div>
                            {/if}

                            {#if loadingAdmins}
                                <div class="p-6 text-center text-xs text-[var(--text-3)]">Memuat daftar admin...</div>
                            {:else}
                                <div class="overflow-x-auto rounded-xl border border-[var(--border)]">
                                    <table class="w-full text-left text-xs border-collapse">
                                        <thead>
                                            <tr class="bg-[var(--surface-2)] text-[10px] font-extrabold uppercase tracking-wider text-[var(--text-3)] border-b border-[var(--border)]">
                                                <th class="py-3 px-4">Administrator</th>
                                                <th class="py-3 px-4">Wewenang Role</th>
                                                <th class="py-3 px-4">IP Sesi</th>
                                                <th class="py-3 px-4 text-right">Aksi</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-[var(--border)]">
                                            {#each admins as a (a.id)}
                                                <tr class="hover:bg-[var(--surface-2)]/60 transition-colors">
                                                    <td class="py-3 px-4">
                                                        <div class="flex items-center gap-2.5">
                                                            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold flex items-center justify-center text-xs shadow-xs flex-shrink-0">
                                                                {getInitial(a.username)}
                                                            </div>
                                                            <div>
                                                                <span class="font-bold text-[var(--text)] block">{a.username}</span>
                                                                {#if a.isCurrentAdmin}
                                                                    <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">(Sesi Anda Saat Ini)</span>
                                                                {/if}
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td class="py-3 px-4">
                                                        {#if a.isSuperAdmin}
                                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30">
                                                                Super Admin
                                                            </span>
                                                        {:else}
                                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-500/15 text-slate-700 dark:text-slate-300 border border-slate-500/30">
                                                                Administrator
                                                            </span>
                                                        {/if}
                                                    </td>
                                                    <td class="py-3 px-4">
                                                        <span class="font-mono text-[11px] text-[var(--text-2)]">{a.ip}</span>
                                                    </td>
                                                    <td class="py-3 px-4 text-right">
                                                        <div class="inline-flex items-center gap-1.5 p-1 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] shadow-xs">
                                                            <!-- Reset PIN Button -->
                                                            <Tooltip text="Reset PIN Admin" position="top">
                                                                <button
                                                                    type="button"
                                                                    class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-[var(--surface)] transition-all hover:scale-105 shadow-2xs cursor-pointer"
                                                                    on:click={() => openResetPinModal(a)}
                                                                    aria-label="Reset PIN Admin"
                                                                >
                                                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                                                    </svg>
                                                                </button>
                                                            </Tooltip>

                                                            <!-- Delete Admin Button -->
                                                            {#if !a.isCurrentAdmin}
                                                                <Tooltip text="Hapus Admin" position="top">
                                                                    <button
                                                                        type="button"
                                                                        class="w-7 h-7 flex items-center justify-center rounded-lg text-slate-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-[var(--surface)] transition-all hover:scale-105 shadow-2xs cursor-pointer"
                                                                        on:click={() => openDeleteAdminModal(a)}
                                                                        aria-label="Hapus Admin"
                                                                    >
                                                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                        </svg>
                                                                    </button>
                                                                </Tooltip>
                                                            {/if}
                                                        </div>
                                                    </td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            {/if}
                        </div>
                    {/if}

                    <!-- Ubah Username Card -->
                    <div class="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                        <div class="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                            <div>
                                <h3 class="text-sm font-bold text-[var(--text)]">Informasi Identitas</h3>
                                <p class="text-xs text-[var(--text-3)]">Perbarui nama tampilan administrator pada panel sistem.</p>
                            </div>
                        </div>

                        {#if usernameSuccess}
                            <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>{usernameSuccess}</span>
                            </div>
                        {/if}

                        {#if usernameError}
                            <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>{usernameError}</span>
                            </div>
                        {/if}

                        <form on:submit={handleUpdateUsername} class="space-y-4">
                            <div>
                                <label for="usernameInput" class="block text-xs font-semibold text-[var(--text-2)] mb-1.5">
                                    Nama Administrator
                                </label>
                                <input
                                    id="usernameInput"
                                    type="text"
                                    bind:value={formUsername}
                                    class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition-colors font-medium"
                                    placeholder="Masukkan nama admin"
                                    required
                                />
                            </div>

                            <div class="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={savingUsername}
                                    class="px-4 py-2 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-all shadow-md shadow-blue-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                                >
                                    {#if savingUsername}
                                        <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Menyimpan...</span>
                                    {:else}
                                        <span>Simpan Perubahan</span>
                                    {/if}
                                </button>
                            </div>
                        </form>
                    </div>

                    <!-- Ubah PIN Keamanan Card -->
                    <div class="p-6 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-xs space-y-4">
                        <div class="flex items-center justify-between pb-3 border-b border-[var(--border)]">
                            <div>
                                <h3 class="text-sm font-bold text-[var(--text)]">Keamanan & PIN Akses</h3>
                                <p class="text-xs text-[var(--text-3)]">PIN 6-digit digunakan sebagai kunci masuk utama untuk panel admin.</p>
                            </div>
                            <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-amber-500/15 dark:bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/30">
                                <span>Tingkat Keamanan Tinggi</span>
                            </span>
                        </div>

                        {#if pinSuccess}
                            <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center gap-2">
                                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>{pinSuccess}</span>
                            </div>
                        {/if}

                        {#if pinError}
                            <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center gap-2">
                                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                <span>{pinError}</span>
                            </div>
                        {/if}

                        <form on:submit={handleUpdatePin} class="space-y-4">
                            <!-- Current PIN -->
                            <div>
                                <label for="currentPinInput" class="block text-xs font-semibold text-[var(--text-2)] mb-1.5">
                                    PIN Saat Ini (6 Digit)
                                </label>
                                <div class="relative">
                                    {#if showCurrentPin}
                                        <input
                                            id="currentPinInput"
                                            type="text"
                                            maxlength="6"
                                            bind:value={currentPin}
                                            class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition-colors font-mono tracking-widest"
                                            placeholder="••••••"
                                            required
                                        />
                                    {:else}
                                        <input
                                            id="currentPinInput"
                                            type="password"
                                            maxlength="6"
                                            bind:value={currentPin}
                                            class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition-colors font-mono tracking-widest"
                                            placeholder="••••••"
                                            required
                                        />
                                    {/if}
                                    <button
                                        type="button"
                                        on:click={() => showCurrentPin = !showCurrentPin}
                                        class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] p-1 cursor-pointer bg-transparent border-0"
                                        aria-label="Toggle PIN Visibility"
                                    >
                                        {#if showCurrentPin}
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                            </svg>
                                        {:else}
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        {/if}
                                    </button>
                                </div>
                            </div>

                            <!-- New PIN & Confirm PIN Grid -->
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label for="newPinInput" class="block text-xs font-semibold text-[var(--text-2)] mb-1.5">
                                        PIN Baru (6 Digit)
                                    </label>
                                    <div class="relative">
                                        {#if showNewPin}
                                            <input
                                                id="newPinInput"
                                                type="text"
                                                maxlength="6"
                                                bind:value={newPin}
                                                class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition-colors font-mono tracking-widest"
                                                placeholder="••••••"
                                                required
                                            />
                                        {:else}
                                            <input
                                                id="newPinInput"
                                                type="password"
                                                maxlength="6"
                                                bind:value={newPin}
                                                class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition-colors font-mono tracking-widest"
                                                placeholder="••••••"
                                                required
                                            />
                                        {/if}
                                        <button
                                            type="button"
                                            on:click={() => showNewPin = !showNewPin}
                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] p-1 cursor-pointer bg-transparent border-0"
                                            aria-label="Toggle PIN Visibility"
                                        >
                                            {#if showNewPin}
                                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            {:else}
                                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            {/if}
                                        </button>
                                    </div>
                                </div>

                                <div>
                                    <label for="confirmPinInput" class="block text-xs font-semibold text-[var(--text-2)] mb-1.5">
                                        Konfirmasi PIN Baru
                                    </label>
                                    <div class="relative">
                                        {#if showConfirmPin}
                                            <input
                                                id="confirmPinInput"
                                                type="text"
                                                maxlength="6"
                                                bind:value={confirmPin}
                                                class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition-colors font-mono tracking-widest"
                                                placeholder="••••••"
                                                required
                                            />
                                        {:else}
                                            <input
                                                id="confirmPinInput"
                                                type="password"
                                                maxlength="6"
                                                bind:value={confirmPin}
                                                class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] focus:outline-none focus:border-[var(--brand)] transition-colors font-mono tracking-widest"
                                                placeholder="••••••"
                                                required
                                            />
                                        {/if}
                                        <button
                                            type="button"
                                            on:click={() => showConfirmPin = !showConfirmPin}
                                            class="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] p-1 cursor-pointer bg-transparent border-0"
                                            aria-label="Toggle PIN Visibility"
                                        >
                                            {#if showConfirmPin}
                                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                                </svg>
                                            {:else}
                                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                                </svg>
                                            {/if}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div class="flex justify-end pt-2">
                                <button
                                    type="submit"
                                    disabled={savingPin}
                                    class="px-4 py-2 rounded-xl text-xs font-semibold bg-amber-600 hover:bg-amber-500 text-white transition-all shadow-md shadow-amber-600/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                                >
                                    {#if savingPin}
                                        <div class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>Memperbarui PIN...</span>
                                    {:else}
                                        <span>Perbarui PIN Keamanan</span>
                                    {/if}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        {/if}
    </main>

    <!-- Modal Tambah Admin Baru -->
    {#if createAdminModalOpen}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-sm" role="dialog" aria-modal="true" on:click|self={() => createAdminModalOpen = false}>
            <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl p-6 space-y-5">
                <div class="flex items-center justify-between border-b border-slate-200 dark:border-[#22314d] pb-3">
                    <h3 class="font-extrabold text-slate-900 dark:text-white text-base">Tambah Administrator Baru</h3>
                    <button type="button" class="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" on:click={() => createAdminModalOpen = false} aria-label="Tutup Modal">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {#if createAdminError}
                    <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                        {createAdminError}
                    </div>
                {/if}

                <div class="space-y-4 text-xs">
                    <div>
                        <label for="new-admin-username" class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Username Admin</label>
                        <input
                            id="new-admin-username"
                            type="text"
                            class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                            placeholder="Contoh: admin_support"
                            bind:value={newAdminUsername}
                        />
                    </div>

                    <div>
                        <label for="new-admin-role" class="block font-bold text-slate-700 dark:text-slate-300 mb-1">Wewenang / Role</label>
                        <select
                            id="new-admin-role"
                            class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-blue-500"
                            bind:value={newAdminRole}
                        >
                            <option value="Administrator">Administrator (Standar)</option>
                            <option value="Super Administrator">Super Administrator (Akses Penuh)</option>
                        </select>
                    </div>

                    <div>
                        <label for="new-admin-pin" class="block font-bold text-slate-700 dark:text-slate-300 mb-1">PIN Keamanan (6 Digit Angka)</label>
                        <input
                            id="new-admin-pin"
                            type="text"
                            maxlength="6"
                            class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white font-mono tracking-widest focus:ring-2 focus:ring-blue-500"
                            placeholder="123456"
                            bind:value={newAdminPin}
                        />
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button type="button" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" on:click={() => createAdminModalOpen = false}>
                        Batal
                    </button>
                    <button
                        type="button"
                        class="px-5 py-2 rounded-xl text-xs font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-md shadow-blue-600/30 disabled:opacity-50 cursor-pointer"
                        disabled={isSubmittingCreateAdmin || !newAdminUsername || !newAdminPin}
                        on:click={submitCreateAdmin}
                    >
                        {isSubmittingCreateAdmin ? 'Menyimpan...' : 'Simpan Admin'}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Modal Reset PIN Admin -->
    {#if resetPinModalOpen && targetResetAdmin}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-sm" role="dialog" aria-modal="true" on:click|self={() => resetPinModalOpen = false}>
            <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl p-6 space-y-5">
                <div class="flex items-center justify-between border-b border-slate-200 dark:border-[#22314d] pb-3">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center border border-amber-500/20">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <div>
                            <h3 class="font-extrabold text-slate-900 dark:text-white text-base">Reset PIN Keamanan Admin</h3>
                            <p class="text-[11px] text-slate-500 dark:text-slate-400">Verifikasi otoritas tingkat tinggi</p>
                        </div>
                    </div>
                    <button type="button" class="text-slate-400 hover:text-white cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors" on:click={() => resetPinModalOpen = false} aria-label="Tutup Modal">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {#if resetPinError}
                    <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2">
                        <svg class="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>{resetPinError}</span>
                    </div>
                {/if}

                <!-- Security Warning Banner -->
                <div class="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400 text-xs space-y-1">
                    <div class="font-bold flex items-center gap-1.5 text-[11px] uppercase tracking-wider">
                        <span>⚠️ Konfirmasi Wajib Sebelum Reset</span>
                    </div>
                    <p class="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                        Untuk mencegah kesalahan atau penyalahgunaan akun, ketik ulang username admin target <b>{targetResetAdmin.username}</b> secara tepat sebelum menetapkan PIN baru.
                    </p>
                </div>

                <div class="space-y-4 text-xs">
                    <!-- Target Username Confirmation Input -->
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label for="target-admin-confirm-username" class="block font-bold text-slate-700 dark:text-slate-300">
                                Konfirmasi Username Target
                            </label>
                            {#if targetConfirmUsername && targetConfirmUsername.trim().toLowerCase() === targetResetAdmin.username.toLowerCase()}
                                <span class="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Username Cocok
                                </span>
                            {:else if targetConfirmUsername}
                                <span class="text-[10px] font-medium text-amber-500">
                                    Belum cocok
                                </span>
                            {/if}
                        </div>
                        <input
                            id="target-admin-confirm-username"
                            type="text"
                            class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0b1324] border text-slate-900 dark:text-white text-xs transition-colors {targetConfirmUsername && targetConfirmUsername.trim().toLowerCase() === targetResetAdmin.username.toLowerCase() ? 'border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/30' : 'border-slate-200 dark:border-[#22314d] focus:ring-2 focus:ring-amber-500'}"
                            placeholder={`Ketik "${targetResetAdmin.username}" untuk konfirmasi...`}
                            bind:value={targetConfirmUsername}
                        />
                    </div>

                    <!-- New 6-Digit PIN Input -->
                    <div>
                        <label for="target-admin-new-pin" class="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                            PIN Keamanan Baru (6 Digit Angka)
                        </label>
                        <input
                            id="target-admin-new-pin"
                            type="password"
                            maxlength="6"
                            class="w-full px-3.5 py-2.5 rounded-xl bg-white dark:bg-[#0b1324] border border-slate-200 dark:border-[#22314d] text-slate-900 dark:text-white font-mono tracking-widest text-sm focus:ring-2 focus:ring-amber-500"
                            placeholder="6 digit angka numerik..."
                            bind:value={targetNewPin}
                            on:input={() => {
                                targetNewPin = targetNewPin.replace(/\D/g, '').slice(0, 6);
                            }}
                        />
                    </div>
                </div>

                <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#22314d]">
                    <button type="button" class="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer transition-colors" on:click={() => resetPinModalOpen = false}>
                        Batal
                    </button>
                    <button
                        type="button"
                        class="px-5 py-2.5 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white shadow-md shadow-amber-600/30 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer transition-all flex items-center gap-1.5"
                        disabled={isSubmittingResetPin || !targetConfirmUsername || targetConfirmUsername.trim().toLowerCase() !== targetResetAdmin.username.toLowerCase() || targetNewPin.length !== 6}
                        on:click={submitResetAdminPin}
                    >
                        {#if isSubmittingResetPin}
                            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Mereset PIN...</span>
                        {:else}
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                            </svg>
                            <span>Reset PIN Admin</span>
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}

    <!-- Modal Konfirmasi Hapus Admin -->
    {#if deleteAdminModalOpen && targetDeleteAdmin}
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#070c16]/80 backdrop-blur-sm" role="dialog" aria-modal="true" on:click|self={() => deleteAdminModalOpen = false}>
            <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#111c35] border border-slate-200 dark:border-[#22314d] shadow-2xl p-6 space-y-5">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-slate-900 dark:text-white text-base">
                            Hapus Administrator?
                        </h3>
                        <p class="text-xs text-slate-500 font-mono">@{targetDeleteAdmin.username} ({targetDeleteAdmin.role})</p>
                    </div>
                </div>

                {#if deleteAdminError}
                    <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold">
                        {deleteAdminError}
                    </div>
                {/if}

                <p class="text-xs text-slate-600 dark:text-slate-400">
                    Akun administrator ini akan dihapus permanen dari sistem. Admin tersebut tidak akan dapat login lagi ke panel manajemen Ziqva Appcenter.
                </p>

                <div class="flex items-center justify-end gap-2 pt-2">
                    <button type="button" class="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer" on:click={() => deleteAdminModalOpen = false}>
                        Batal
                    </button>
                    <button
                        type="button"
                        class="px-5 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 shadow-md shadow-rose-600/30 text-white disabled:opacity-50 cursor-pointer"
                        disabled={isSubmittingDeleteAdmin}
                        on:click={submitDeleteAdmin}
                    >
                        {isSubmittingDeleteAdmin ? 'Menghapus...' : 'Ya, Hapus Akun Admin'}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</AdminLayout>
