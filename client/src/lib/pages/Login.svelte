<script lang="ts">
    import { onMount } from 'svelte';
    import PublicNavbar from '../components/PublicNavbar.svelte';
    import PublicFooter from '../components/PublicFooter.svelte';
    import CustomCheckbox from '../components/CustomCheckbox.svelte';
    import { checkSession } from '../stores/auth';

    let email: string = '';
    let password: string = '';
    let showPassword: boolean = false;
    let error: string = '';
    let loading: boolean = false;
    let agreeTerms: boolean = false;
    let memberCountText: string = '2.8k+ Member Aktif';
    let uptimeText: string = '99.9% Uptime Server';
    let returnTo: string = '';

    function extractReturnTo(): string {
        try {
            const searchParams = new URLSearchParams(window.location.search);
            const fromSearch = searchParams.get('return_to');
            if (fromSearch) return fromSearch;

            const hash = window.location.hash || '';
            const qIdx = hash.indexOf('?');
            if (qIdx !== -1) {
                const hashParams = new URLSearchParams(hash.substring(qIdx + 1));
                const fromHash = hashParams.get('return_to');
                if (fromHash) return fromHash;
            }
        } catch {
            // Ignore
        }
        return '';
    }

    onMount(async () => {
        returnTo = extractReturnTo();
        const isAuth = await checkSession();
        if (isAuth) {
            if (returnTo) {
                window.location.href = returnTo;
            } else {
                window.location.hash = '/member/dashboard';
            }
            return;
        }

        // Fetch dynamic platform stats
        try {
            const res = await fetch('/member/api/public-stats');
            const resJson = await res.json();
            if (resJson?.data?.formattedMembers) {
                memberCountText = resJson.data.formattedMembers;
            }
            if (resJson?.data?.uptime) {
                uptimeText = resJson.data.uptime;
            }
        } catch {
            // Keep default fallback
        }
    });

    async function handleLogin(e: Event) {
        e.preventDefault();
        if (!agreeTerms) {
            error = 'Anda wajib menyetujui Syarat & Ketentuan serta Kebijakan Privasi untuk melanjutkan.';
            return;
        }
        loading = true;
        error = '';

        try {
            const res = await fetch('/member/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ email: email.trim(), password, return_to: returnTo || undefined }),
                credentials: 'include'
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data && data.status === 'success') {
                await checkSession();
                if (data.redirect_to) {
                    window.location.href = data.redirect_to;
                } else if (returnTo) {
                    window.location.href = returnTo;
                } else {
                    window.location.hash = '/member/dashboard';
                }
            } else {
                error = data?.message || 'Email atau password salah.';
            }
        } catch {
            error = 'Terjadi kesalahan sistem saat mencoba masuk.';
        } finally {
            loading = false;
        }
    }
</script>

<div class="min-h-screen flex flex-col justify-between bg-[var(--page)] text-[var(--text)] transition-colors">
    <!-- Topbar Navigation with Top Announcement Bar -->
    <PublicNavbar activePage="login" />

    <!-- Main Container: Responsive 2-Column Grid -->
    <main class="w-full max-w-5xl mx-auto my-auto py-8 sm:py-12 px-4 sm:px-6">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            <!-- Left Column: Visual Showcase Preview (Desktop) -->
            <div class="hidden lg:flex lg:col-span-6 flex-col justify-between p-6 rounded-3xl bg-slate-50 dark:bg-[#111827]/60 border border-slate-200 dark:border-slate-800/80 space-y-6">
                <!-- Showcase Preview Image -->
                <div class="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 shadow-sm bg-black/5 dark:bg-black/30">
                    <img
                        src="/images/auth/login_showcase.png?v=4"
                        alt="Appcenter Software Preview"
                        class="w-full h-auto object-cover"
                    />
                </div>

                <!-- Feature Highlights -->
                <div class="space-y-3.5">
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-500 mt-0.5">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xs font-bold text-[var(--text)]">Katalog Software Terpadu</h2>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">Akses tools otomasi YouTube, Tokopedia, dan aplikasi produktivitas.</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-500 mt-0.5">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xs font-bold text-[var(--text)]">Aktivasi Lisensi Cepat</h2>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">Kelola lisensi dan ganti perangkat terdaftar langsung dari dashboard.</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 text-purple-500 mt-0.5">
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xs font-bold text-[var(--text)]">Program Afiliasi</h2>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">Dapatkan komisi untuk setiap pembelian melalui referral Anda.</p>
                        </div>
                    </div>
                </div>

                <!-- Stats Bar -->
                <div class="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-[11px] font-medium text-[var(--text-3)]">
                    <span class="text-blue-500 font-semibold">{memberCountText}</span>
                    <span>•</span>
                    <span>{uptimeText}</span>
                    <span>•</span>
                    <span>Update Berkala</span>
                </div>
            </div>

            <!-- Right Column: Form Card -->
            <div class="w-full lg:col-span-6 max-w-md mx-auto">
                <div class="p-6 sm:p-8 bg-white dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xl shadow-black/5 dark:shadow-black/20">
                    
                    <!-- Header Title & Branding -->
                    <div class="text-center mb-6">
                        <div class="w-12 h-12 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-3">
                            <img src="/favicon.svg" alt="Appcenter Logo" class="w-6 h-6 object-contain" />
                        </div>
                        <h1 class="text-xl font-bold text-[var(--text)] tracking-tight">Masuk ke Akun</h1>
                        <p class="text-[var(--text-3)] text-xs mt-1">Masukkan email dan kata sandi Anda untuk melanjutkan</p>
                    </div>

                    <!-- Error Banner -->
                    {#if error}
                        <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-5 text-red-500 text-xs flex items-center gap-2.5">
                            <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                            </svg>
                            <span class="font-medium flex-1">{error}</span>
                        </div>
                    {/if}

                    <form on:submit={handleLogin} class="space-y-4">
                        <!-- Email Address -->
                        <div>
                            <label for="login-email" class="block text-xs font-semibold text-[var(--text-2)] mb-1">
                                Alamat Email <span class="text-rose-500">*</span>
                            </label>
                            <div class="relative">
                                <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                    </svg>
                                </span>
                                <input
                                    id="login-email"
                                    type="email"
                                    required
                                    bind:value={email}
                                    placeholder="nama@email.com"
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-blue-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/15"
                                />
                            </div>
                        </div>

                        <!-- Password -->
                        <div>
                            <div class="flex items-center justify-between mb-1">
                                <label for="login-password" class="block text-xs font-semibold text-[var(--text-2)]">
                                    Kata Sandi <span class="text-rose-500">*</span>
                                </label>
                                <a href="#/member/forgot-password" class="text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                                    Lupa Kata Sandi?
                                </a>
                            </div>
                            <div class="relative">
                                <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                    </svg>
                                </span>
                                {#if showPassword}
                                    <input
                                        id="login-password"
                                        type="text"
                                        required
                                        bind:value={password}
                                        placeholder="Masukkan kata sandi"
                                        class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-blue-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-10 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/15"
                                    />
                                {:else}
                                    <input
                                        id="login-password"
                                        type="password"
                                        required
                                        bind:value={password}
                                        placeholder="••••••••"
                                        class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-blue-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-10 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/15"
                                    />
                                {/if}
                                <button
                                    type="button"
                                    on:click={() => showPassword = !showPassword}
                                    class="absolute right-3 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] p-0.5 rounded transition-colors cursor-pointer bg-transparent border-0"
                                    title={showPassword ? 'Sembunyikan' : 'Lihat'}
                                >
                                    {#if showPassword}
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

                        <!-- Terms and Privacy Policy Mandatory Agreement Checkbox -->
                        <div class="py-1">
                            <CustomCheckbox
                                bind:checked={agreeTerms}
                                color="brand"
                                align="start"
                            >
                                <span class="text-xs text-[var(--text-3)] dark:text-slate-400 leading-relaxed select-none">
                                    Saya telah membaca dan menyetujui <a href="#/terms" target="_blank" rel="noopener noreferrer" class="text-[var(--text)] dark:text-slate-200 font-medium underline underline-offset-2 decoration-[var(--border)] dark:decoration-slate-700 hover:decoration-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Syarat & Ketentuan Layanan</a> (termasuk klausul No-Refund) serta <a href="#/privacy" target="_blank" rel="noopener noreferrer" class="text-[var(--text)] dark:text-slate-200 font-medium underline underline-offset-2 decoration-[var(--border)] dark:decoration-slate-700 hover:decoration-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Kebijakan Privasi Data Lokal</a>.
                                </span>
                            </CustomCheckbox>
                        </div>

                        <!-- Submit Button -->
                        <button
                            type="submit"
                            disabled={loading || !agreeTerms}
                            class="w-full mt-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors disabled:opacity-50 text-xs sm:text-sm cursor-pointer border-0 flex items-center justify-center gap-2"
                        >
                            {#if loading}
                                <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Memproses...</span>
                            {:else}
                                <svg class="w-4 h-4 flex-shrink-0" style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                </svg>
                                <span>Masuk ke Akun</span>
                            {/if}
                        </button>
                    </form>

                    <div class="mt-6 pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--text-3)]">
                        Belum memiliki akun?
                        <a href="#/member/register{returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}" class="text-blue-600 dark:text-blue-400 hover:underline font-semibold ml-1">
                            Daftar Sekarang &rarr;
                        </a>
                    </div>
                </div>
            </div>

        </div>
    </main>

    <!-- Complete Ecosystem Footer -->
    <PublicFooter />
</div>
