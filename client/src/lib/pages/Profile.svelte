<script lang="ts">
    import { onMount } from 'svelte';
    import Layout from '../components/Layout.svelte';
    import { auth } from '../stores/auth';

    interface UserProfileData {
        id: number;
        name: string;
        email: string;
        whatsapp: string;
        company: string;
        verified: boolean;
        avatar?: string;
        created_formatted: string;
    }

    interface ProfileStats {
        total_orders: number;
        total_licenses: number;
    }

    let loading = true;
    let savingProfile = false;
    let savingPassword = false;

    // Active tab: 'info' | 'security'
    let activeTab: 'info' | 'security' = 'info';

    let profileData: UserProfileData = {
        id: 0,
        name: '',
        email: '',
        whatsapp: '',
        company: '',
        verified: true,
        created_formatted: '-'
    };

    let stats: ProfileStats = {
        total_orders: 0,
        total_licenses: 0
    };

    // Profile Edit Form state
    let formName = '';
    let formWhatsapp = '';
    let formCompany = '';
    let profileSuccessMsg = '';
    let profileErrorMsg = '';

    // Password Change Form state
    let currentPassword = '';
    let newPassword = '';
    let confirmPassword = '';
    let showCurrentPassword = false;
    let showNewPassword = false;
    let showConfirmPassword = false;
    let passwordSuccessMsg = '';
    let passwordErrorMsg = '';

    // Real-time password validation helpers
    $: isNewPasswordValid = newPassword.length >= 6;
    $: isPasswordMatch = confirmPassword.length > 0 && newPassword === confirmPassword;
    $: isPasswordMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;
    $: isPasswordSameAsCurrent = currentPassword.length > 0 && newPassword.length > 0 && currentPassword === newPassword;
    $: canSubmitPassword = currentPassword.length > 0 && isNewPasswordValid && isPasswordMatch && !isPasswordSameAsCurrent;

    function getInitial(name: string): string {
        return (name || 'M').charAt(0).toUpperCase();
    }

    async function loadProfile() {
        loading = true;
        try {
            const res = await fetch('/member/api/profile', {
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
                    profileData = json.data.user;
                    stats = json.data.stats || { total_orders: 0, total_licenses: 0 };
                    formName = profileData.name;
                    formWhatsapp = profileData.whatsapp;
                    formCompany = profileData.company;
                }
            }
        } catch (e) {
            console.error('Failed to fetch profile:', e);
            profileErrorMsg = 'Gagal memuat data profil. Silakan muat ulang halaman.';
        } finally {
            loading = false;
        }
    }

    async function handleUpdateProfile(e: Event) {
        e.preventDefault();
        profileSuccessMsg = '';
        profileErrorMsg = '';

        if (!formName.trim() || formName.trim().length < 2) {
            profileErrorMsg = 'Nama lengkap wajib diisi minimal 2 karakter';
            return;
        }

        savingProfile = true;
        try {
            const res = await fetch('/member/api/profile', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: formName.trim(),
                    whatsapp: formWhatsapp.trim(),
                    company: formCompany.trim()
                }),
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.hash = '/member/login';
                return;
            }

            const json = await res.json();
            if (res.ok && json.status === 'success') {
                profileSuccessMsg = json.message || 'Profil berhasil diperbarui!';
                profileData.name = formName.trim();
                profileData.whatsapp = formWhatsapp.trim();
                profileData.company = formCompany.trim();

                // Update auth store so sidebar & header immediately reflect new name
                if ($auth.user) {
                    auth.update(state => ({
                        ...state,
                        user: state.user ? { ...state.user, name: formName.trim() } : null
                    }));
                }
            } else {
                profileErrorMsg = json.message || 'Gagal memperbarui profil.';
            }
        } catch (e) {
            console.error('Update profile error:', e);
            profileErrorMsg = 'Terjadi kesalahan saat memperbarui profil.';
        } finally {
            savingProfile = false;
        }
    }

    async function handleChangePassword(e: Event) {
        e.preventDefault();
        passwordSuccessMsg = '';
        passwordErrorMsg = '';

        if (!currentPassword) {
            passwordErrorMsg = 'Password saat ini wajib diisi';
            return;
        }

        if (newPassword.length < 6) {
            passwordErrorMsg = 'Password baru minimal harus 6 karakter';
            return;
        }

        if (newPassword !== confirmPassword) {
            passwordErrorMsg = 'Konfirmasi password baru tidak cocok';
            return;
        }

        if (currentPassword === newPassword) {
            passwordErrorMsg = 'Password baru tidak boleh sama dengan password saat ini';
            return;
        }

        savingPassword = true;
        try {
            const res = await fetch('/member/api/change-password', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                }),
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.hash = '/member/login';
                return;
            }

            const json = await res.json();
            if (res.ok && json.status === 'success') {
                passwordSuccessMsg = json.message || 'Password berhasil diubah!';
                currentPassword = '';
                newPassword = '';
                confirmPassword = '';
            } else {
                passwordErrorMsg = json.message || 'Gagal mengubah password.';
            }
        } catch (e) {
            console.error('Change password error:', e);
            passwordErrorMsg = 'Terjadi kesalahan sistem saat mengubah password.';
        } finally {
            savingPassword = false;
        }
    }

    onMount(() => {
        loadProfile();
    });
</script>

<Layout activePage="profile" eyebrow="PROFIL AKUN & KEAMANAN">
    <main class="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-12">
        
        <!-- Profile Header Identity Card -->
        <div class="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] p-5 sm:p-6 md:p-7 shadow-xs">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                <div class="flex items-center gap-4 sm:gap-5">
                    <!-- Avatar with Status Ring -->
                    <div class="relative flex-shrink-0">
                        <div class="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 border-2 border-white dark:border-slate-800 shadow-md flex items-center justify-center text-white font-black text-xl sm:text-2xl md:text-3xl select-none">
                            {getInitial(profileData.name || $auth.user?.name || 'M')}
                        </div>
                        {#if profileData.verified}
                            <span class="absolute -bottom-1 -right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-emerald-500 border-2 border-[var(--surface)] dark:border-[#101827] flex items-center justify-center text-white text-[10px]" title="Akun Terverifikasi">
                                <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                </svg>
                            </span>
                        {/if}
                    </div>

                    <!-- User Identity & Metadata -->
                    <div class="min-w-0 space-y-1">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h1 class="text-lg sm:text-xl md:text-2xl font-black text-[var(--text)] dark:text-white tracking-tight truncate">
                                {loading ? 'Memuat Profil...' : (profileData.name || 'Member Ziqva')}
                            </h1>
                            <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                Member Aktif
                            </span>
                            {#if profileData.verified}
                                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                    Terverifikasi
                                </span>
                            {/if}
                        </div>

                        <div class="flex items-center gap-3 text-xs text-[var(--text-3)] dark:text-slate-400 font-mono truncate">
                            <span class="flex items-center gap-1.5">
                                <svg class="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.206" />
                                </svg>
                                <span>{loading ? '...' : profileData.email}</span>
                            </span>
                            <span class="text-slate-300 dark:text-slate-700 hidden sm:inline">•</span>
                            <span class="hidden sm:inline-flex items-center gap-1 text-[11px] font-sans">
                                <svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span>Sejak {profileData.created_formatted}</span>
                            </span>
                        </div>
                    </div>
                </div>

                <!-- Quick Stats Pills -->
                <div class="flex items-center gap-2.5 self-start md:self-center">
                    <div class="flex items-center gap-3 bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] rounded-xl px-3.5 py-2">
                        <div class="text-center">
                            <span class="text-xs font-bold text-[var(--text-3)] dark:text-slate-400 block uppercase tracking-wider text-[10px]">Pesanan</span>
                            <span class="text-sm sm:text-base font-black font-mono text-[var(--text)] dark:text-white">{loading ? '-' : stats.total_orders}</span>
                        </div>
                        <div class="w-px h-6 bg-[var(--border)] dark:bg-slate-700"></div>
                        <div class="text-center">
                            <span class="text-xs font-bold text-blue-600 dark:text-blue-400 block uppercase tracking-wider text-[10px]">Lisensi</span>
                            <span class="text-sm sm:text-base font-black font-mono text-blue-600 dark:text-blue-400">{loading ? '-' : stats.total_licenses}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Sliding Pill Tabs Switcher -->
        <div class="relative p-1 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] flex items-center select-none overflow-hidden max-w-md shadow-2xs">
            <div
                class="absolute top-1 bottom-1 left-1 w-[calc(50%-2.67px)] rounded-xl bg-blue-600 shadow-sm shadow-blue-500/25 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] pointer-events-none"
                style="transform: translateX({activeTab === 'info' ? '0%' : '100%'});"
            ></div>

            <button
                type="button"
                class="relative z-10 flex-1 py-2.5 rounded-xl text-center text-xs sm:text-sm font-bold transition-colors duration-200 cursor-pointer border-0 bg-transparent flex items-center justify-center gap-2 {activeTab === 'info' ? 'text-white' : 'text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white'}"
                on:click={() => activeTab = 'info'}
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Informasi Profil</span>
            </button>

            <button
                type="button"
                class="relative z-10 flex-1 py-2.5 rounded-xl text-center text-xs sm:text-sm font-bold transition-colors duration-200 cursor-pointer border-0 bg-transparent flex items-center justify-center gap-2 {activeTab === 'security' ? 'text-white' : 'text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--text)] dark:hover:text-white'}"
                on:click={() => activeTab = 'security'}
            >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Keamanan & Password</span>
            </button>
        </div>

        <!-- Tab 1: Informasi Akun & Data Profil -->
        {#if activeTab === 'info'}
            <div class="rounded-2xl sm:rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] p-5 sm:p-7 md:p-8 shadow-xs space-y-6">
                <div class="flex items-center justify-between pb-4 border-b border-[var(--border)] dark:border-[#22314d]">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-sm sm:text-base font-extrabold text-[var(--text)] dark:text-white">Data Pribadi & Kontak</h2>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">Kelola informasi identitas akun dan rincian kontak resmi Anda.</p>
                        </div>
                    </div>
                </div>

                {#if profileSuccessMsg}
                    <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-2xs">
                        <div class="flex items-center gap-2.5">
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{profileSuccessMsg}</span>
                        </div>
                        <button type="button" on:click={() => profileSuccessMsg = ''} class="text-emerald-600 dark:text-emerald-400 hover:opacity-75 cursor-pointer bg-transparent border-0 p-0.5">✕</button>
                    </div>
                {/if}

                {#if profileErrorMsg}
                    <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-2xs">
                        <div class="flex items-center gap-2.5">
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>{profileErrorMsg}</span>
                        </div>
                        <button type="button" on:click={() => profileErrorMsg = ''} class="text-rose-600 dark:text-rose-400 hover:opacity-75 cursor-pointer bg-transparent border-0 p-0.5">✕</button>
                    </div>
                {/if}

                <form on:submit={handleUpdateProfile} class="space-y-5" id="form-profile-info">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <!-- Nama Lengkap -->
                        <div class="space-y-1.5">
                            <label for="profile-name-input" class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                                Nama Lengkap <span class="text-rose-500">*</span>
                            </label>
                            <div class="relative">
                                <input
                                    id="profile-name-input"
                                    type="text"
                                    bind:value={formName}
                                    disabled={loading || savingProfile}
                                    placeholder="Masukkan nama lengkap Anda"
                                    required
                                    class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                                />
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                </svg>
                            </div>
                        </div>

                        <!-- Alamat Email (Permanently Immutable) -->
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <label for="profile-email-input" class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                                    Alamat Email
                                </label>
                                <span class="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                                    Permanen
                                </span>
                            </div>
                            <div class="relative">
                                <input
                                    id="profile-email-input"
                                    type="email"
                                    value={profileData.email}
                                    readonly
                                    disabled
                                    class="w-full bg-[var(--surface-2)] dark:bg-[#0c1424] opacity-80 border border-[var(--border)] dark:border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[var(--text-2)] dark:text-slate-400 font-mono cursor-not-allowed select-none"
                                />
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                            </div>
                        </div>

                        <!-- WhatsApp -->
                        <div class="space-y-1.5">
                            <label for="profile-wa-input" class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                                Nomor WhatsApp (Opsional)
                            </label>
                            <div class="relative">
                                <input
                                    id="profile-wa-input"
                                    type="tel"
                                    bind:value={formWhatsapp}
                                    disabled={loading || savingProfile}
                                    placeholder="Contoh: 081234567890"
                                    class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono disabled:opacity-50"
                                />
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                            </div>
                        </div>

                        <!-- Nama Usaha / Perusahaan -->
                        <div class="space-y-1.5">
                            <label for="profile-company-input" class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                                Nama Usaha / Perusahaan (Opsional)
                            </label>
                            <div class="relative">
                                <input
                                    id="profile-company-input"
                                    type="text"
                                    bind:value={formCompany}
                                    disabled={loading || savingProfile}
                                    placeholder="Contoh: Ziqva Digital Agency"
                                    class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors disabled:opacity-50"
                                />
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                </svg>
                            </div>
                        </div>
                    </div>

                    <div class="pt-4 border-t border-[var(--border)] dark:border-[#22314d] flex items-center justify-end">
                        <button
                            type="submit"
                            form="form-profile-info"
                            disabled={loading || savingProfile}
                            class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-2 border-0"
                        >
                            {#if savingProfile}
                                <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Menyimpan...</span>
                            {:else}
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Simpan Perubahan Profil</span>
                            {/if}
                        </button>
                    </div>
                </form>
            </div>
        {:else}
            <!-- Tab 2: Keamanan & Password -->
            <div class="rounded-2xl sm:rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] p-5 sm:p-7 md:p-8 shadow-xs space-y-6">
                <div class="flex items-center justify-between pb-4 border-b border-[var(--border)] dark:border-[#22314d]">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center flex-shrink-0">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-sm sm:text-base font-extrabold text-[var(--text)] dark:text-white">Perbarui Kata Sandi</h2>
                            <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">Ubah password berkala untuk menjaga keamanan akun dan lisensi software Anda.</p>
                        </div>
                    </div>
                </div>

                {#if passwordSuccessMsg}
                    <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-2xs">
                        <div class="flex items-center gap-2.5">
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{passwordSuccessMsg}</span>
                        </div>
                        <button type="button" on:click={() => passwordSuccessMsg = ''} class="text-emerald-600 dark:text-emerald-400 hover:opacity-75 cursor-pointer bg-transparent border-0 p-0.5">✕</button>
                    </div>
                {/if}

                {#if passwordErrorMsg}
                    <div class="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-center justify-between animate-fade-in shadow-2xs">
                        <div class="flex items-center gap-2.5">
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>{passwordErrorMsg}</span>
                        </div>
                        <button type="button" on:click={() => passwordErrorMsg = ''} class="text-rose-600 dark:text-rose-400 hover:opacity-75 cursor-pointer bg-transparent border-0 p-0.5">✕</button>
                    </div>
                {/if}

                <form on:submit={handleChangePassword} class="space-y-5" id="form-password-change">
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <!-- Password Saat Ini -->
                        <div class="space-y-1.5">
                            <label for="current-pwd-input" class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                                Password Saat Ini <span class="text-rose-500">*</span>
                            </label>
                            <div class="relative">
                                {#if showCurrentPassword}
                                    <input
                                        id="current-pwd-input"
                                        type="text"
                                        bind:value={currentPassword}
                                        disabled={savingPassword}
                                        placeholder="Masukkan password saat ini"
                                        required
                                        class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono disabled:opacity-50"
                                    />
                                {:else}
                                    <input
                                        id="current-pwd-input"
                                        type="password"
                                        bind:value={currentPassword}
                                        disabled={savingPassword}
                                        placeholder="Masukkan password saat ini"
                                        required
                                        class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-slate-700 rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono disabled:opacity-50"
                                    />
                                {/if}
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                <button
                                    type="button"
                                    class="absolute right-3 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white cursor-pointer p-1 bg-transparent border-0"
                                    on:click={() => showCurrentPassword = !showCurrentPassword}
                                    title={showCurrentPassword ? 'Sembunyikan password' : 'Lihat password'}
                                >
                                    {#if showCurrentPassword}
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                                    {:else}
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    {/if}
                                </button>
                            </div>
                        </div>

                        <!-- Password Baru -->
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <label for="new-pwd-input" class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                                    Password Baru <span class="text-rose-500">*</span>
                                </label>
                                {#if newPassword.length > 0}
                                    <span class="text-[10px] font-bold font-mono {isNewPasswordValid ? 'text-emerald-500' : 'text-amber-500'}">
                                        {isNewPasswordValid ? '✔ Min 6 char' : `${newPassword.length}/6 char`}
                                    </span>
                                {/if}
                            </div>
                            <div class="relative">
                                {#if showNewPassword}
                                    <input
                                        id="new-pwd-input"
                                        type="text"
                                        bind:value={newPassword}
                                        disabled={savingPassword}
                                        placeholder="Minimal 6 karakter"
                                        required
                                        minlength="6"
                                        class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border {newPassword && !isNewPasswordValid ? 'border-amber-500/50' : 'border-[var(--border)] dark:border-slate-700'} rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono disabled:opacity-50"
                                    />
                                {:else}
                                    <input
                                        id="new-pwd-input"
                                        type="password"
                                        bind:value={newPassword}
                                        disabled={savingPassword}
                                        placeholder="Minimal 6 karakter"
                                        required
                                        minlength="6"
                                        class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border {newPassword && !isNewPasswordValid ? 'border-amber-500/50' : 'border-[var(--border)] dark:border-slate-700'} rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono disabled:opacity-50"
                                    />
                                {/if}
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                </svg>
                                <button
                                    type="button"
                                    class="absolute right-3 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white cursor-pointer p-1 bg-transparent border-0"
                                    on:click={() => showNewPassword = !showNewPassword}
                                    title={showNewPassword ? 'Sembunyikan password' : 'Lihat password'}
                                >
                                    {#if showNewPassword}
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                                    {:else}
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    {/if}
                                </button>
                            </div>
                        </div>

                        <!-- Ulangi Password Baru -->
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between">
                                <label for="confirm-pwd-input" class="block text-xs font-bold text-[var(--text-2)] dark:text-slate-300 uppercase tracking-wider">
                                    Ulangi Password Baru <span class="text-rose-500">*</span>
                                </label>
                                {#if confirmPassword.length > 0}
                                    <span class="text-[10px] font-bold font-mono {isPasswordMatch ? 'text-emerald-500' : 'text-rose-500'}">
                                        {isPasswordMatch ? '✔ Cocok' : '✕ Tidak Cocok'}
                                    </span>
                                {/if}
                            </div>
                            <div class="relative">
                                {#if showConfirmPassword}
                                    <input
                                        id="confirm-pwd-input"
                                        type="text"
                                        bind:value={confirmPassword}
                                        disabled={savingPassword}
                                        placeholder="Ketik ulang password baru"
                                        required
                                        class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border {confirmPassword && isPasswordMismatch ? 'border-rose-500/50' : confirmPassword && isPasswordMatch ? 'border-emerald-500/50' : 'border-[var(--border)] dark:border-slate-700'} rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono disabled:opacity-50"
                                    />
                                {:else}
                                    <input
                                        id="confirm-pwd-input"
                                        type="password"
                                        bind:value={confirmPassword}
                                        disabled={savingPassword}
                                        placeholder="Ketik ulang password baru"
                                        required
                                        class="w-full bg-[var(--surface-2)] dark:bg-[#131d31] border {confirmPassword && isPasswordMismatch ? 'border-rose-500/50' : confirmPassword && isPasswordMatch ? 'border-emerald-500/50' : 'border-[var(--border)] dark:border-slate-700'} rounded-xl pl-10 pr-10 py-2.5 text-xs sm:text-sm text-[var(--text)] dark:text-white placeholder-[var(--text-3)] dark:placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors font-mono disabled:opacity-50"
                                    />
                                {/if}
                                <svg class="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <button
                                    type="button"
                                    class="absolute right-3 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] dark:text-slate-400 dark:hover:text-white cursor-pointer p-1 bg-transparent border-0"
                                    on:click={() => showConfirmPassword = !showConfirmPassword}
                                    title={showConfirmPassword ? 'Sembunyikan password' : 'Lihat password'}
                                >
                                    {#if showConfirmPassword}
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
                                    {:else}
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                                    {/if}
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Password Tips & Live Checklist -->
                    <div class="p-4 rounded-xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] text-xs space-y-2">
                        <span class="font-bold text-[var(--text)] dark:text-white uppercase tracking-wider text-[11px] block">Panduan Keamanan Kata Sandi</span>
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-[var(--text-3)] dark:text-slate-400">
                            <div class="flex items-center gap-2">
                                <span class="{isNewPasswordValid ? 'text-emerald-500 font-bold' : 'text-slate-400'}">
                                    {isNewPasswordValid ? '✔' : '○'}
                                </span>
                                <span>Panjang minimal 6 karakter</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="{isPasswordMatch ? 'text-emerald-500 font-bold' : 'text-slate-400'}">
                                    {isPasswordMatch ? '✔' : '○'}
                                </span>
                                <span>Konfirmasi password sesuai</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="{!isPasswordSameAsCurrent && newPassword ? 'text-emerald-500 font-bold' : 'text-slate-400'}">
                                    {!isPasswordSameAsCurrent && newPassword ? '✔' : '○'}
                                </span>
                                <span>Berbeda dari password saat ini</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="text-blue-500 font-bold">ℹ</span>
                                <span>Gunakan kombinasi huruf & angka</span>
                            </div>
                        </div>
                    </div>

                    <div class="pt-4 border-t border-[var(--border)] dark:border-[#22314d] flex items-center justify-end">
                        <button
                            type="submit"
                            form="form-password-change"
                            disabled={savingPassword || !canSubmitPassword}
                            class="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs sm:text-sm transition-all shadow-2xs cursor-pointer flex items-center justify-center gap-2 border-0"
                        >
                            {#if savingPassword}
                                <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Menyimpan Password...</span>
                            {:else}
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                </svg>
                                <span>Perbarui Kata Sandi</span>
                            {/if}
                        </button>
                    </div>
                </form>
            </div>
        {/if}
    </main>
</Layout>
