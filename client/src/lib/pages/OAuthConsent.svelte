<script lang="ts">
    import { onMount } from 'svelte';

    interface ClientInfo {
        client_id: string;
        name: string;
        description: string | null;
        icon_url: string | null;
        is_trusted: boolean;
        is_redirect_valid: boolean;
    }

    interface UserInfo {
        name: string;
        email: string;
        verified: boolean;
    }

    interface ScopeInfo {
        title: string;
        description: string;
        icon: string;
    }

    let loading: boolean = true;
    let error: string = '';
    let submitting: boolean = false;

    // Authentication State
    let isAuthenticated: boolean = false;
    let client: ClientInfo | null = null;
    let user: UserInfo | null = null;
    let scopes: ScopeInfo[] = [];

    // Query parameters
    let clientId: string = '';
    let redirectUri: string = '';
    let scopeParam: string = '';
    let stateParam: string = '';
    let codeChallenge: string = '';
    let codeChallengeMethod: string = '';

    // Login Form State (when not authenticated)
    let loginEmail: string = '';
    let loginPassword: string = '';
    let showPassword: boolean = false;
    let loginError: string = '';
    let loginSubmitting: boolean = false;

    function parseQueryParams() {
        const fullUrl = window.location.href;
        const qIndex = fullUrl.indexOf('?');
        if (qIndex === -1) return;

        const searchParams = new URLSearchParams(fullUrl.substring(qIndex + 1));
        clientId = searchParams.get('client_id') || '';
        redirectUri = searchParams.get('redirect_uri') || '';
        scopeParam = searchParams.get('scope') || '';
        stateParam = searchParams.get('state') || '';
        codeChallenge = searchParams.get('code_challenge') || '';
        codeChallengeMethod = searchParams.get('code_challenge_method') || '';
    }

    async function loadAuthContext() {
        loading = true;
        error = '';
        loginError = '';

        try {
            const res = await fetch(`/oauth/api/auth-context?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scopeParam)}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            const data = await res.json();
            if (res.ok && data.status === 'success') {
                client = data.client;
                isAuthenticated = data.isAuthenticated;
                user = data.user;
                scopes = data.scopes || [];

                if (!client.is_redirect_valid) {
                    error = 'Redirect URI tidak diizinkan atau tidak terdaftar dalam whitelist aplikasi ini.';
                }
            } else {
                error = data.message || 'Gagal memuat informasi izin aplikasi.';
            }
        } catch {
            error = 'Terjadi kesalahan sistem saat memproses otorisasi.';
        } finally {
            loading = false;
        }
    }

    onMount(async () => {
        parseQueryParams();

        if (!clientId || !redirectUri) {
            error = 'Parameter otorisasi tidak lengkap. Memerlukan client_id dan redirect_uri.';
            loading = false;
            return;
        }

        await loadAuthContext();
    });

    // Handle Login submission inside dedicated SSO screen
    async function handleSSOLogin() {
        if (!loginEmail.trim() || !loginPassword.trim()) {
            loginError = 'Email dan kata sandi wajib diisi.';
            return;
        }

        loginSubmitting = true;
        loginError = '';

        try {
            const res = await fetch('/oauth/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    email: loginEmail.trim(),
                    password: loginPassword,
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    scopes: scopeParam || client?.allowed_scopes || 'profile email',
                    state: stateParam || undefined,
                    code_challenge: codeChallenge || undefined,
                    code_challenge_method: codeChallengeMethod || undefined
                }),
                credentials: 'include'
            });

            const data = await res.json();

            if (res.ok && data.status === 'success') {
                if (data.redirect_to) {
                    // Directly authorized (trusted client or existing consent)
                    window.location.href = data.redirect_to;
                    return;
                }

                if (data.requires_consent) {
                    // Switch to consent view
                    user = data.user;
                    isAuthenticated = true;
                }
            } else {
                loginError = data.message || 'Email atau kata sandi tidak sesuai.';
            }
        } catch {
            loginError = 'Terjadi kesalahan jaringan saat mencoba masuk.';
        } finally {
            loginSubmitting = false;
        }
    }

    // Handle Consent confirmation or denial
    async function handleDecision(allow: boolean) {
        submitting = true;
        error = '';

        try {
            const res = await fetch('/oauth/consent/decision', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    client_id: clientId,
                    redirect_uri: redirectUri,
                    scopes: scopeParam || client?.allowed_scopes || 'profile email',
                    state: stateParam || undefined,
                    code_challenge: codeChallenge || undefined,
                    code_challenge_method: codeChallengeMethod || undefined,
                    allow
                }),
                credentials: 'include'
            });

            const data = await res.json();
            if (res.ok && data.status === 'success' && data.redirect_to) {
                window.location.href = data.redirect_to;
            } else {
                error = data.message || 'Gagal menyelesaikan otorisasi.';
                submitting = false;
            }
        } catch {
            error = 'Terjadi kesalahan sistem saat mengirimkan persetujuan.';
            submitting = false;
        }
    }

    // Switch account: Logs out active SSO session and returns to SSO login form
    async function handleSwitchAccount() {
        loading = true;
        try {
            await fetch('/oauth/api/logout-current', {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            isAuthenticated = false;
            user = null;
            loginEmail = '';
            loginPassword = '';
            loginError = '';
        } catch {}
        loading = false;
    }

    // Cancel and return with error
    function handleCancel() {
        const deniedUrl = `${redirectUri}${redirectUri.includes('?') ? '&' : '?'}error=access_denied&error_description=User+cancelled+authorization${stateParam ? `&state=${encodeURIComponent(stateParam)}` : ''}`;
        window.location.href = deniedUrl;
    }
</script>

<div class="min-h-screen flex items-center justify-center p-4 bg-[#090d16] text-[#e2e8f0] relative overflow-hidden font-sans">
    
    <!-- Background Ambient Glow -->
    <div class="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-blue-600/15 blur-3xl pointer-events-none"></div>
    <div class="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-purple-600/15 blur-3xl pointer-events-none"></div>

    <div class="w-full max-w-md rounded-3xl bg-[#111827]/95 border border-slate-700/60 shadow-2xl p-6 sm:p-8 backdrop-blur-xl relative z-10 space-y-6">

        <!-- Top Ziqva SSO Header -->
        <div class="flex items-center justify-between pb-4 border-b border-slate-800/80">
            <div class="flex items-center gap-2.5">
                <div class="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center p-1.5 shadow-sm">
                    <img src="/favicon.svg" alt="AppCenter Logo" class="w-full h-full object-contain" />
                </div>
                <div>
                    <span class="text-sm font-bold text-white tracking-wide block leading-none">Ziqva SSO</span>
                    <span class="text-[10px] text-slate-400 leading-none">Single Sign-On Hub</span>
                </div>
            </div>
            <div class="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-[10px] font-mono font-medium">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Secure OAuth 2.0</span>
            </div>
        </div>

        {#if loading}
            <!-- Loading State -->
            <div class="py-12 flex flex-col items-center justify-center space-y-3 text-slate-400 text-xs">
                <svg class="w-8 h-8 animate-spin text-blue-500" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                </svg>
                <span class="font-medium">Memverifikasi aplikasi dan status akun...</span>
            </div>

        {:else if error}
            <!-- Error State -->
            <div class="py-6 space-y-4 text-center">
                <div class="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-sm">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <div>
                    <h2 class="text-base font-bold text-white">Permintaan Otorisasi Gagal</h2>
                    <p class="text-xs text-slate-300 leading-relaxed max-w-xs mx-auto mt-1">{error}</p>
                </div>
                <div class="pt-2 flex flex-col gap-2">
                    <button
                        on:click={handleCancel}
                        class="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-all cursor-pointer border border-slate-700/80"
                    >
                        Kembali ke Aplikasi
                    </button>
                    <a
                        href="/#/member/dashboard"
                        class="inline-block py-2 text-blue-400 hover:text-blue-300 text-xs font-medium"
                    >
                        Buka Dashboard AppCenter
                    </a>
                </div>
            </div>

        {:else if client && !isAuthenticated}
            <!-- ========================================================================= -->
            <!-- STATE A: DEDICATED SSO LOGIN FORM (User is NOT logged in)                -->
            <!-- ========================================================================= -->
            <div class="space-y-5">
                <!-- Requesting Application Branding -->
                <div class="text-center space-y-2.5">
                    {#if client.icon_url}
                        <img
                            src={client.icon_url}
                            alt={client.name}
                            class="w-14 h-14 rounded-2xl object-cover border border-slate-700/80 mx-auto bg-slate-800 shadow-md"
                            on:error={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    {:else}
                        <div class="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl font-bold mx-auto shadow-sm">
                            {client.name.charAt(0).toUpperCase()}
                        </div>
                    {/if}

                    <div>
                        <h1 class="text-base font-bold text-white leading-tight">
                            Masuk ke <span class="text-blue-400">{client.name}</span>
                        </h1>
                        <p class="text-xs text-slate-400 mt-1">
                            Gunakan Akun Ziqva Anda untuk melanjutkan ke aplikasi.
                        </p>
                    </div>
                </div>

                <!-- Inline Error Alert -->
                {#if loginError}
                    <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-start gap-2.5 animate-shake">
                        <svg class="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span class="flex-1 leading-snug">{loginError}</span>
                    </div>
                {/if}

                <!-- SSO Login Form -->
                <form on:submit|preventDefault={handleSSOLogin} class="space-y-4">
                    <div class="space-y-1.5">
                        <label for="sso-email" class="block text-xs font-semibold text-slate-300">
                            Alamat Email
                        </label>
                        <div class="relative">
                            <input
                                id="sso-email"
                                type="email"
                                bind:value={loginEmail}
                                placeholder="nama@email.com"
                                required
                                autocomplete="username"
                                class="w-full bg-slate-800/90 border border-slate-700 rounded-xl py-2.5 px-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                            />
                        </div>
                    </div>

                    <div class="space-y-1.5">
                        <div class="flex items-center justify-between">
                            <label for="sso-password" class="block text-xs font-semibold text-slate-300">
                                Kata Sandi
                            </label>
                            <a
                                href="/#/forgot-password"
                                target="_blank"
                                rel="noreferrer"
                                class="text-[11px] text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Lupa sandi?
                            </a>
                        </div>
                        <div class="relative">
                            {#if showPassword}
                                <input
                                    id="sso-password"
                                    type="text"
                                    bind:value={loginPassword}
                                    placeholder="••••••••"
                                    required
                                    autocomplete="current-password"
                                    class="w-full bg-slate-800/90 border border-slate-700 rounded-xl py-2.5 px-3.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                                />
                            {:else}
                                <input
                                    id="sso-password"
                                    type="password"
                                    bind:value={loginPassword}
                                    placeholder="••••••••"
                                    required
                                    autocomplete="current-password"
                                    class="w-full bg-slate-800/90 border border-slate-700 rounded-xl py-2.5 px-3.5 pr-10 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-sans"
                                />
                            {/if}

                            <button
                                type="button"
                                on:click={() => showPassword = !showPassword}
                                class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 cursor-pointer p-1"
                                title={showPassword ? 'Sembunyikan sandi' : 'Lihat sandi'}
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

                    <!-- Action Buttons -->
                    <div class="space-y-2 pt-2">
                        <button
                            type="submit"
                            disabled={loginSubmitting}
                            class="w-full py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
                        >
                            {#if loginSubmitting}
                                <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                                </svg>
                                <span>Memproses Masuk...</span>
                            {:else}
                                <span>Masuk & Lanjutkan</span>
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                    <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            {/if}
                        </button>

                        <button
                            type="button"
                            on:click={handleCancel}
                            class="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 font-medium text-xs sm:text-sm transition-colors cursor-pointer"
                        >
                            Batalkan
                        </button>
                    </div>
                </form>

                <!-- Footer Registration Prompt -->
                <div class="pt-3 border-t border-slate-800/80 text-center text-xs text-slate-400">
                    Belum punya akun Ziqva?{' '}
                    <a
                        href="/#/member/register"
                        target="_blank"
                        rel="noreferrer"
                        class="text-blue-400 hover:text-blue-300 font-semibold underline underline-offset-2"
                    >
                        Daftar Akun Baru
                    </a>
                </div>
            </div>

        {:else if client && isAuthenticated && user}
            <!-- ========================================================================= -->
            <!-- STATE B: ACCOUNT CHOOSER & CONFIRMATION SCREEN (User IS logged in)        -->
            <!-- ========================================================================= -->
            <div class="space-y-5">
                <!-- App Identity Header -->
                <div class="text-center space-y-2">
                    {#if client.icon_url}
                        <img
                            src={client.icon_url}
                            alt={client.name}
                            class="w-14 h-14 rounded-2xl object-cover border border-slate-700/80 mx-auto bg-slate-800 shadow-md"
                            on:error={(e) => (e.currentTarget.style.display = 'none')}
                        />
                    {:else}
                        <div class="w-14 h-14 rounded-2xl bg-blue-600/10 border border-blue-500/30 text-blue-400 flex items-center justify-center text-xl font-bold mx-auto shadow-sm">
                            {client.name.charAt(0).toUpperCase()}
                        </div>
                    {/if}

                    <div>
                        <h1 class="text-base font-bold text-white leading-tight">
                            Lanjutkan ke <span class="text-blue-400">{client.name}</span>
                        </h1>
                        <p class="text-xs text-slate-400 mt-0.5">
                            Pilih akun Ziqva Anda untuk masuk ke aplikasi ini
                        </p>
                    </div>
                </div>

                <!-- Active Logged In Account Card (Google-style Account Chooser) -->
                <div class="p-3.5 rounded-2xl bg-slate-800/90 border border-slate-700/80 flex items-center justify-between gap-3 shadow-inner">
                    <div class="flex items-center gap-3 min-w-0">
                        <div class="w-10 h-10 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm flex-shrink-0 shadow-sm border border-blue-400/25">
                            {(user.name || 'U').charAt(0).toUpperCase()}
                        </div>
                        <div class="min-w-0">
                            <div class="flex items-center gap-1.5">
                                <span class="text-xs font-bold text-white truncate">{user.name}</span>
                                {#if user.verified}
                                    <svg class="w-3.5 h-3.5 text-blue-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd" />
                                    </svg>
                                {/if}
                            </div>
                            <span class="text-[11px] text-slate-400 truncate block font-mono">{user.email}</span>
                        </div>
                    </div>

                    <button
                        on:click={handleSwitchAccount}
                        class="px-2.5 py-1.5 rounded-xl bg-slate-700/50 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors flex-shrink-0 cursor-pointer border border-slate-600/40"
                        title="Ganti atau gunakan akun lain"
                    >
                        Ganti Akun
                    </button>
                </div>

                <!-- Permissions Breakdown -->
                <div class="space-y-2">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Izin yang Diberikan ke Aplikasi:
                    </span>
                    <div class="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                        {#each scopes as sc}
                            <div class="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40">
                                <div class="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                                    {#if sc.icon === 'user'}
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                        </svg>
                                    {:else if sc.icon === 'mail'}
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                        </svg>
                                    {:else if sc.icon === 'phone'}
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    {:else if sc.icon === 'shield-check'}
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                        </svg>
                                    {:else}
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                                        </svg>
                                    {/if}
                                </div>
                                <div class="min-w-0 flex-1">
                                    <span class="text-xs font-bold text-white block">{sc.title}</span>
                                    <span class="text-[11px] text-slate-400 leading-tight block">{sc.description}</span>
                                </div>
                            </div>
                        {/each}
                    </div>
                </div>

                <!-- Trust Badge -->
                {#if client.is_trusted}
                    <div class="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[11px] flex items-center gap-2">
                        <svg class="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                        </svg>
                        <span class="font-medium">Aplikasi Resmi Ekosistem Ziqva (Terverifikasi Aman)</span>
                    </div>
                {/if}

                <!-- Action Confirmation Buttons -->
                <div class="space-y-2 pt-1">
                    <button
                        on:click={() => handleDecision(true)}
                        disabled={submitting}
                        class="w-full py-2.5 sm:py-3 rounded-xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs sm:text-sm shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer border-0"
                    >
                        {#if submitting}
                            <svg class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                            </svg>
                            <span>Menghubungkan...</span>
                        {:else}
                            <span>Lanjutkan sebagai {user.name.split(' ')[0]}</span>
                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                                <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        {/if}
                    </button>

                    <button
                        on:click={() => handleDecision(false)}
                        disabled={submitting}
                        class="w-full py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 hover:text-white border border-slate-700/80 font-medium text-xs sm:text-sm transition-colors cursor-pointer"
                    >
                        Batalkan
                    </button>
                </div>

                <!-- Privacy & Terms Notice -->
                <p class="text-[10px] text-center text-slate-400 leading-relaxed pt-1">
                    Dengan melanjutkan, Anda mengizinkan <strong class="text-slate-300">{client.name}</strong> untuk mengakses informasi profil Anda sesuai dengan <a href="/#/terms" target="_blank" class="text-blue-400 underline">Ketentuan Layanan</a> dan <a href="/#/privacy" target="_blank" class="text-blue-400 underline">Kebijakan Privasi</a> Ziqva.
                </p>
            </div>
        {/if}

    </div>
</div>
