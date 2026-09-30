<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import ThemeToggle from '../components/ThemeToggle.svelte';
    import { checkAdminSession } from '../stores/auth';

    let pin: string[] = ['', '', '', '', '', ''];
    let inputRefs: HTMLInputElement[] = [];
    let isMasked: boolean = true;
    let loading: boolean = false;
    let error: string = '';
    let isShaking: boolean = false;
    let shakeTimer: ReturnType<typeof setTimeout> | null = null;
    let activeIndex: number = 0;

    // Rate Limiting & Lockout States for Login
    let isLocked: boolean = false;
    let remainingSeconds: number = 0;
    let lockoutMinutes: number = 0;
    let attemptsLeft: number = 3;
    let timerInterval: ReturnType<typeof setInterval> | null = null;

    // Forgot / Reset PIN Modal States
    let forgotModalOpen: boolean = false;
    let forgotStep: 1 | 2 | 3 = 1; // 1: verify username & send OTP, 2: verify OTP, 3: set new PIN
    let forgotUsername: string = '';
    let forgotOtp: string = '';
    let forgotResetToken: string = '';
    let forgotNewPin: string = '';
    let forgotConfirmPin: string = '';
    let forgotIsMasked: boolean = true;
    let forgotLoading: boolean = false;
    let forgotError: string = '';
    let forgotSuccess: string = '';
    let forgotLockoutSeconds: number = 0;
    let forgotLockoutTimer: ReturnType<typeof setInterval> | null = null;
    let otpCooldownSeconds: number = 0;
    let otpCooldownTimer: ReturnType<typeof setInterval> | null = null;

    onMount(async () => {
        const isAuth = await checkAdminSession();
        if (isAuth) {
            window.location.hash = '/admin/dashboard';
            return;
        }
        await fetchLoginStatus();
        if (!isLocked) {
            inputRefs[0]?.focus();
        }
    });

    async function fetchLoginStatus() {
        try {
            const res = await fetch('/admin/api/login-status', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (res.ok) {
                const data = await res.json();
                if (data.isLocked && data.remainingSeconds > 0) {
                    startCountdown(data.remainingSeconds, data.lockoutMinutes || 3);
                } else {
                    isLocked = false;
                    attemptsLeft = data.attemptsLeft ?? 3;
                }
            }
        } catch (e) {
            console.error('Fetch login status error:', e);
        }
    }

    function startCountdown(seconds: number, minutes: number = 3) {
        if (timerInterval) clearInterval(timerInterval);
        remainingSeconds = seconds;
        lockoutMinutes = minutes;
        isLocked = true;
        timerInterval = setInterval(() => {
            remainingSeconds -= 1;
            if (remainingSeconds <= 0) {
                if (timerInterval) clearInterval(timerInterval);
                timerInterval = null;
                isLocked = false;
                error = '';
                fetchLoginStatus();
            }
        }, 1000);
    }

    function formatTimer(secs: number): string {
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) {
            return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        }
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    function handleInput(index: number, event: Event) {
        if (isLocked) return;
        const input = event.target as HTMLInputElement;
        const value = input.value;

        error = '';

        if (!/^\d*$/.test(value)) {
            pin[index] = '';
            return;
        }

        if (value.length > 1) {
            pin[index] = value.slice(-1);
        } else {
            pin[index] = value;
        }

        if (pin[index] && index < 5) {
            activeIndex = index + 1;
            inputRefs[index + 1]?.focus();
        }

        if (pin.every((d) => d !== '') && pin.join('').length === 6) {
            submitLogin();
        }
    }

    function handleKeyDown(index: number, event: KeyboardEvent) {
        if (isLocked) return;
        if (event.key === 'Backspace') {
            if (!pin[index] && index > 0) {
                pin[index - 1] = '';
                activeIndex = index - 1;
                inputRefs[index - 1]?.focus();
            } else {
                pin[index] = '';
            }
        } else if (event.key === 'ArrowLeft' && index > 0) {
            activeIndex = index - 1;
            inputRefs[index - 1]?.focus();
        } else if (event.key === 'ArrowRight' && index < 5) {
            activeIndex = index + 1;
            inputRefs[index + 1]?.focus();
        } else if (event.key === 'Enter') {
            event.preventDefault();
            submitLogin();
        }
    }

    function handlePaste(event: ClipboardEvent) {
        if (isLocked) return;
        event.preventDefault();
        const pastedData = event.clipboardData?.getData('text') || '';
        const digits = pastedData.replace(/\D/g, '').slice(0, 6).split('');

        if (digits.length > 0) {
            for (let i = 0; i < 6; i++) {
                pin[i] = digits[i] || '';
            }

            const nextFocusIndex = Math.min(digits.length, 5);
            activeIndex = nextFocusIndex;
            inputRefs[nextFocusIndex]?.focus();

            if (digits.length === 6) {
                submitLogin();
            }
        }
    }

    function handleKeypadPress(val: string) {
        if (isLocked) return;
        error = '';
        if (val === 'clear') {
            pin = ['', '', '', '', '', ''];
            activeIndex = 0;
            inputRefs[0]?.focus();
            return;
        }

        if (val === 'backspace') {
            for (let i = 5; i >= 0; i--) {
                if (pin[i] !== '') {
                    pin[i] = '';
                    activeIndex = i;
                    inputRefs[i]?.focus();
                    break;
                }
            }
            return;
        }

        for (let i = 0; i < 6; i++) {
            if (!pin[i]) {
                pin[i] = val;
                if (i < 5) {
                    activeIndex = i + 1;
                    inputRefs[i + 1]?.focus();
                }
                if (i === 5 && pin.every((d) => d !== '')) {
                    submitLogin();
                }
                break;
            }
        }
    }

    async function submitLogin() {
        if (isLocked) return;
        const fullPin = pin.join('');
        if (fullPin.length !== 6) {
            triggerShake('PIN harus 6 digit angka lengkap');
            return;
        }

        loading = true;
        error = '';

        try {
            const res = await fetch('/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ pin: fullPin }),
                credentials: 'include'
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data && data.status === 'success') {
                if (timerInterval) clearInterval(timerInterval);
                await checkAdminSession();
                window.location.hash = '/admin/dashboard';
            } else {
                if (data?.isLocked && data?.remainingSeconds) {
                    startCountdown(data.remainingSeconds, data.lockoutMinutes || 3);
                    triggerShake(data?.message || 'Akses login dibatasi karena terlalu banyak percobaan gagal.');
                } else {
                    if (data?.attemptsLeft !== undefined) {
                        attemptsLeft = data.attemptsLeft;
                    }
                    triggerShake(data?.message || 'PIN tidak valid. Silakan coba lagi.');
                }
            }
        } catch {
            triggerShake('Terjadi kesalahan sistem saat mencoba masuk.');
        } finally {
            loading = false;
        }
    }

    function triggerShake(msg: string) {
        error = msg;
        isShaking = true;
        if (shakeTimer) clearTimeout(shakeTimer);
        shakeTimer = setTimeout(() => {
            isShaking = false;
        }, 500);
        pin = ['', '', '', '', '', ''];
        activeIndex = 0;
        if (!isLocked) {
            inputRefs[0]?.focus();
        }
    }

    // Modal Control: Forgot / Reset PIN
    function openForgotPinModal() {
        forgotModalOpen = true;
        if (forgotLockoutSeconds <= 0) {
            forgotStep = 1;
            forgotUsername = '';
            forgotOtp = '';
            forgotResetToken = '';
            forgotNewPin = '';
            forgotConfirmPin = '';
            forgotError = '';
            forgotSuccess = '';
            forgotLockoutSeconds = 0;
            otpCooldownSeconds = 0;
            if (forgotLockoutTimer) clearInterval(forgotLockoutTimer);
            if (otpCooldownTimer) clearInterval(otpCooldownTimer);
        }
    }

    function closeForgotPinModal() {
        forgotModalOpen = false;
        if (otpCooldownTimer) {
            clearInterval(otpCooldownTimer);
            otpCooldownTimer = null;
        }
    }

    function startOtpCooldown(seconds: number = 60) {
        if (otpCooldownTimer) clearInterval(otpCooldownTimer);
        otpCooldownSeconds = seconds;
        otpCooldownTimer = setInterval(() => {
            otpCooldownSeconds -= 1;
            if (otpCooldownSeconds <= 0) {
                if (otpCooldownTimer) clearInterval(otpCooldownTimer);
                otpCooldownTimer = null;
            }
        }, 1000);
    }

    function startForgotCountdown(seconds: number) {
        if (forgotLockoutTimer) clearInterval(forgotLockoutTimer);
        forgotLockoutSeconds = seconds;
        forgotLockoutTimer = setInterval(() => {
            forgotLockoutSeconds -= 1;
            if (forgotLockoutSeconds <= 0) {
                if (forgotLockoutTimer) clearInterval(forgotLockoutTimer);
                forgotLockoutTimer = null;
                forgotError = '';
            }
        }, 1000);
    }

    async function handleRequestOtp(isResend: boolean = false) {
        if (forgotLockoutSeconds > 0) {
            forgotError = `Batas percobaan tercapai. Akses dibatasi selama ${formatTimer(forgotLockoutSeconds)}.`;
            return;
        }
        if (!forgotUsername.trim()) {
            forgotError = 'Silakan masukkan username administrator Anda';
            return;
        }
        if (isResend && otpCooldownSeconds > 0) return;

        forgotLoading = true;
        forgotError = '';
        if (isResend) {
            forgotSuccess = '';
        }

        try {
            const res = await fetch('/admin/api/forgot-pin/request-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({ username: forgotUsername.trim() })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                forgotStep = 2;
                forgotOtp = '';
                forgotError = '';
                startOtpCooldown(data.cooldownSeconds || 60);
            } else {
                forgotError = data.error || 'Gagal mengirim kode OTP verifikasi.';
                if (data.remainingSeconds) {
                    startForgotCountdown(data.remainingSeconds);
                }
            }
        } catch {
            forgotError = 'Gagal menghubungi server untuk mengirim kode OTP.';
        } finally {
            forgotLoading = false;
        }
    }

    async function handleVerifyOtp() {
        if (forgotLockoutSeconds > 0) {
            forgotError = `Batas percobaan tercapai. Akses dibatasi selama ${formatTimer(forgotLockoutSeconds)}.`;
            return;
        }
        if (!forgotOtp.trim()) {
            forgotError = 'Silakan masukkan 6 digit kode OTP';
            return;
        }
        if (forgotOtp.trim().length !== 6 || !/^\d{6}$/.test(forgotOtp.trim())) {
            forgotError = 'Kode OTP harus berupa 6 digit angka numerik';
            return;
        }

        forgotLoading = true;
        forgotError = '';
        try {
            const res = await fetch('/admin/api/forgot-pin/verify-otp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    username: forgotUsername.trim(),
                    otp: forgotOtp.trim()
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                forgotResetToken = data.resetToken;
                forgotStep = 3;
                forgotError = '';
            } else {
                forgotError = data.error || 'Kode OTP tidak valid atau telah kedaluwarsa.';
                if (data.remainingSeconds) {
                    startForgotCountdown(data.remainingSeconds);
                }
            }
        } catch {
            forgotError = 'Gagal menghubungi server untuk memverifikasi OTP.';
        } finally {
            forgotLoading = false;
        }
    }

    async function handleResetForgotPin() {
        if (!forgotNewPin || !forgotConfirmPin) {
            forgotError = 'Harap isi PIN baru dan konfirmasi PIN';
            return;
        }
        if (forgotNewPin.length !== 6 || !/^\d{6}$/.test(forgotNewPin)) {
            forgotError = 'PIN baru harus tepat 6 digit angka numerik';
            return;
        }
        if (forgotNewPin !== forgotConfirmPin) {
            forgotError = 'Konfirmasi PIN baru tidak sesuai dengan PIN baru';
            return;
        }
        if (!forgotResetToken) {
            forgotError = 'Sesi verifikasi OTP tidak valid. Silakan ulangi tahap verifikasi.';
            forgotStep = 1;
            return;
        }

        forgotLoading = true;
        forgotError = '';
        try {
            const res = await fetch('/admin/api/forgot-pin/reset', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    username: forgotUsername.trim(),
                    resetToken: forgotResetToken,
                    newPin: forgotNewPin,
                    confirmPin: forgotConfirmPin
                })
            });

            const data = await res.json();
            if (res.ok && data.success) {
                forgotSuccess = data.message || 'PIN administrator berhasil direset! Silakan login.';
                setTimeout(() => {
                    closeForgotPinModal();
                    pin = ['', '', '', '', '', ''];
                    activeIndex = 0;
                    inputRefs[0]?.focus();
                }, 2200);
            } else {
                forgotError = data.error || 'Gagal mereset PIN admin.';
                if (data.remainingSeconds) {
                    startForgotCountdown(data.remainingSeconds);
                }
            }
        } catch {
            forgotError = 'Gagal menghubungi server untuk reset PIN.';
        } finally {
            forgotLoading = false;
        }
    }

    onDestroy(() => {
        if (shakeTimer) clearTimeout(shakeTimer);
        if (timerInterval) clearInterval(timerInterval);
        if (forgotLockoutTimer) clearInterval(forgotLockoutTimer);
        if (otpCooldownTimer) clearInterval(otpCooldownTimer);
    });
</script>

<div class="min-h-screen flex flex-col justify-between p-3 sm:p-6 bg-[var(--page)] text-[var(--text)] transition-colors relative overflow-hidden select-none">
    <!-- Ambient Lighting Background -->
    <div class="pointer-events-none absolute -top-40 -left-40 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/15 rounded-full blur-3xl"></div>
    <div class="pointer-events-none absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-500/10 dark:bg-indigo-600/15 rounded-full blur-3xl"></div>

    <!-- Topbar Navigation -->
    <header class="w-full max-w-[390px] mx-auto flex items-center justify-between py-2 relative z-10">
        <a
            href="#/member/login"
            class="inline-flex items-center gap-2 text-xs font-semibold text-[var(--text-2)] hover:text-[var(--text)] transition-colors group"
        >
            <div class="w-7 h-7 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center group-hover:border-[var(--brand)] transition-colors shadow-2xs">
                <svg class="w-3.5 h-3.5 text-[var(--text-3)] group-hover:text-[var(--brand)] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            </div>
            <span>Area Member</span>
        </a>
        <ThemeToggle />
    </header>

    <!-- Main Container: Centered Security Box -->
    <main class="w-full max-w-[390px] mx-auto my-auto py-2 sm:py-6 relative z-10">
        <!-- Header Branding -->
        <div class="text-center mb-4 sm:mb-6">
            <div class="w-12 h-12 sm:w-14 sm:h-14 mx-auto rounded-2xl bg-blue-500/10 dark:bg-blue-500/15 border border-blue-500/25 flex items-center justify-center mb-2.5 sm:mb-3 shadow-lg shadow-blue-500/10">
                <img src="/favicon.svg" alt="Appcenter Admin" class="w-6 h-6 sm:w-7 sm:h-7 object-contain" />
            </div>
            <div class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 mb-2">
                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                Admin Security Gateway
            </div>
            <h1 class="text-lg sm:text-xl font-extrabold text-[var(--text)] tracking-tight">Autentikasi Administrator</h1>
            <p class="text-[var(--text-3)] text-[11px] sm:text-xs mt-1">Masukkan 6 digit PIN otoritas untuk mengelola sistem</p>
        </div>

        <!-- Card Container -->
        <div
            class="p-4 sm:p-6 bg-[var(--surface)] border border-[var(--border)] rounded-2xl sm:rounded-3xl shadow-xl shadow-slate-900/5 dark:shadow-black/40 transition-all {isShaking
                ? 'animate-shake'
                : ''}"
        >
            {#if isLocked}
                <div class="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 mb-5 text-center space-y-2">
                    <div class="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-500 mx-auto flex items-center justify-center shadow-xs">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                    </div>
                    <div>
                        <h4 class="text-xs font-bold text-rose-500 uppercase tracking-wider">Percobaan Login Dibatasi</h4>
                        <p class="text-[11px] text-[var(--text-3)] mt-0.5 leading-relaxed">
                            Batas percobaan PIN salah tercapai. Percobaan login Anda diblokir selama 2 jam:
                        </p>
                    </div>
                    <div class="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-widest py-1.5 bg-[var(--surface-2)] rounded-xl border border-rose-500/20 shadow-inner">
                        {formatTimer(remainingSeconds)}
                    </div>
                    <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
                        🔒 Perlindungan keamanan sistem aktif. Silakan tunggu hingga waktu tunggu berakhir untuk mencoba kembali.
                    </p>
                </div>
            {:else if error}
                <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-red-500 text-xs flex flex-col gap-1 text-center">
                    <div class="flex items-center justify-center gap-1.5">
                        <svg class="w-4 h-4 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span class="font-bold">{error}</span>
                    </div>
                    {#if attemptsLeft < 3 && attemptsLeft > 0}
                        <span class="text-[11px] font-semibold text-amber-500 dark:text-amber-400">
                            ⚠️ Sisa kesempatan: {attemptsLeft}x lagi sebelum percobaan Anda diblokir selama 2 jam.
                        </span>
                    {/if}
                </div>
            {/if}

            <form on:submit|preventDefault={submitLogin}>
                <!-- PIN Input Grid -->
                <div class="mb-4 sm:mb-5">
                    <div class="flex justify-between items-center mb-2">
                        <span class="text-[11px] font-bold uppercase tracking-wider text-[var(--text-2)]">
                            PIN Keamanan
                        </span>
                        <div class="flex items-center gap-3">
                            <button
                                type="button"
                                on:click={openForgotPinModal}
                                class="text-[11px] text-blue-600 dark:text-blue-400 hover:underline font-semibold flex items-center gap-1 cursor-pointer focus:outline-none bg-transparent border-0"
                            >
                                <span>Lupa PIN?</span>
                            </button>
                            {#if !isLocked}
                                <span class="text-[var(--border)] text-xs">•</span>
                                <button
                                    type="button"
                                    on:click={() => (isMasked = !isMasked)}
                                    class="text-[11px] text-[var(--text-2)] hover:text-[var(--text)] hover:underline font-semibold flex items-center gap-1 cursor-pointer focus:outline-none bg-transparent border-0"
                                >
                                    {#if isMasked}
                                        <span>Lihat PIN</span>
                                    {:else}
                                        <span>Sembunyikan</span>
                                    {/if}
                                </button>
                            {/if}
                        </div>
                    </div>

                    <div class="grid grid-cols-6 gap-1.5 sm:gap-2" on:paste={handlePaste}>
                        {#each pin as digit, index}
                            <input
                                id="pin-input-{index}"
                                bind:this={inputRefs[index]}
                                type={isMasked ? 'password' : 'text'}
                                inputmode="numeric"
                                pattern="[0-9]*"
                                maxlength="1"
                                aria-label={`Digit PIN ${index + 1}`}
                                value={digit}
                                on:focus={() => activeIndex = index}
                                on:input={(e) => handleInput(index, e)}
                                on:keydown={(e) => handleKeyDown(index, e)}
                                class="w-full aspect-square text-center bg-[var(--surface-2)] border {digit ? 'border-blue-500 ring-2 ring-blue-500/25 bg-blue-500/5' : 'border-[var(--border)]'} focus:border-blue-500 text-[var(--text)] rounded-xl text-base sm:text-lg font-bold focus:outline-none transition-all focus:ring-2 focus:ring-blue-500/30 disabled:opacity-40 disabled:cursor-not-allowed"
                                disabled={loading || isLocked}
                                autocomplete="off"
                            />
                        {/each}
                    </div>
                </div>

                <!-- Submit Button -->
                <button
                    type="submit"
                    disabled={loading || isLocked || pin.some((d) => d === '')}
                    class="w-full min-h-[44px] sm:min-h-[48px] bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 active:scale-[0.98] text-white font-bold py-2.5 sm:py-3 px-4 rounded-xl shadow-md shadow-blue-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed text-xs sm:text-sm cursor-pointer border-0 flex items-center justify-center gap-2 mb-3.5 sm:mb-4"
                >
                    {#if loading}
                        <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Memverifikasi...</span>
                    {:else if isLocked}
                        <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Terkunci ({formatTimer(remainingSeconds)})</span>
                    {:else}
                        <svg class="w-4 h-4 flex-shrink-0" style="width: 16px; height: 16px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        <span>Masuk ke Panel Admin</span>
                    {/if}
                </button>
            </form>

            <!-- Numeric Tactile Keypad -->
            <div class="pt-3 sm:pt-4 border-t border-[var(--border)]">
                <div class="grid grid-cols-3 gap-1.5 sm:gap-2">
                    {#each ['1', '2', '3', '4', '5', '6', '7', '8', '9'] as num}
                        <button
                            type="button"
                            on:click={() => handleKeypadPress(num)}
                            disabled={loading || isLocked}
                            class="min-h-[44px] py-2.5 sm:py-3 rounded-xl bg-[var(--surface-2)] hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95 active:bg-blue-500/10 text-[var(--text)] font-bold text-base sm:text-lg transition-all border border-[var(--border)] focus:outline-none cursor-pointer flex items-center justify-center shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                        >
                            {num}
                        </button>
                    {/each}
                    <button
                        type="button"
                        on:click={() => handleKeypadPress('clear')}
                        disabled={loading || isLocked}
                        class="min-h-[44px] py-2.5 sm:py-3 rounded-xl bg-[var(--surface-2)] hover:bg-rose-500/10 hover:text-rose-500 hover:border-rose-500/30 active:scale-95 text-rose-500/80 dark:text-rose-400/90 font-bold text-[11px] sm:text-xs tracking-wider transition-all border border-[var(--border)] focus:outline-none cursor-pointer flex items-center justify-center shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                    >
                        CLEAR
                    </button>
                    <button
                        type="button"
                        on:click={() => handleKeypadPress('0')}
                        disabled={loading || isLocked}
                        class="min-h-[44px] py-2.5 sm:py-3 rounded-xl bg-[var(--surface-2)] hover:bg-slate-200 dark:hover:bg-slate-800 active:scale-95 active:bg-blue-500/10 text-[var(--text)] font-bold text-base sm:text-lg transition-all border border-[var(--border)] focus:outline-none cursor-pointer flex items-center justify-center shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                    >
                        0
                    </button>
                    <button
                        type="button"
                        on:click={() => handleKeypadPress('backspace')}
                        disabled={loading || isLocked}
                        class="min-h-[44px] py-2.5 sm:py-3 rounded-xl bg-[var(--surface-2)] hover:bg-amber-500/10 hover:text-amber-500 hover:border-amber-500/30 active:scale-95 text-[var(--text-3)] hover:text-[var(--text)] font-bold text-sm transition-all border border-[var(--border)] focus:outline-none flex items-center justify-center cursor-pointer shadow-2xs disabled:opacity-40 disabled:cursor-not-allowed touch-manipulation"
                        aria-label="Hapus Digit Terakhir"
                        title="Hapus Digit Terakhir"
                    >
                        <svg class="w-4 h-4 flex-shrink-0" style="width: 16px; height: 16px;" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-9.172a2 2 0 00-1.414.586L3 12z" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Action Links: Kembali ke Web -->
            <div class="mt-4 pt-3 border-t border-[var(--border)] flex items-center justify-end text-xs">
                <a
                    href="#/member/login"
                    class="text-[var(--text-3)] hover:text-[var(--text)] transition-colors font-medium inline-flex items-center gap-1.5"
                >
                    <span>Ke Web</span>
                    <svg class="w-3.5 h-3.5 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                </a>
            </div>
        </div>
    </main>

    <!-- Footer Copyright -->
    <footer class="w-full max-w-[390px] mx-auto text-center py-2 relative z-10">
        <p class="text-[var(--text-3)] text-[11px]">
            © 2026 Appcenter Ziqva Labs • Restricted Access
        </p>
    </footer>
</div>

<!-- Modal Dialog: Lupa / Reset PIN Admin -->
{#if forgotModalOpen}
    <div
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 dark:bg-black/80 backdrop-blur-sm"
        role="dialog"
        aria-modal="true"
        on:click|self={closeForgotPinModal}
    >
        <div class="w-full max-w-md rounded-2xl sm:rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl p-5 sm:p-6 space-y-4 relative animate-in fade-in zoom-in-95 duration-200">
            <!-- Modal Header -->
            <div class="flex items-center justify-between border-b border-[var(--border)] pb-3">
                <div class="flex items-center gap-2.5">
                    <div class="w-9 h-9 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center border border-blue-500/25">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="font-extrabold text-[var(--text)] text-sm sm:text-base leading-tight">Reset PIN Administrator</h3>
                        <p class="text-[11px] text-[var(--text-3)] mt-0.5">
                            {#if forgotStep === 1}
                                Tahap 1 dari 3: Verifikasi Akun & Kirim OTP
                            {:else if forgotStep === 2}
                                Tahap 2 dari 3: Verifikasi Kode OTP Email
                            {:else}
                                Tahap 3 dari 3: Buat PIN 6-Digit Baru
                            {/if}
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    class="text-[var(--text-3)] hover:text-[var(--text)] cursor-pointer p-1.5 rounded-lg hover:bg-[var(--surface-2)] transition-colors bg-transparent border-0"
                    on:click={closeForgotPinModal}
                    aria-label="Tutup Dialog"
                >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Feedback Alerts -->
            {#if forgotError}
                <div class="p-3 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 text-xs font-semibold flex items-start gap-2">
                    <svg class="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                        <span>{forgotError}</span>
                        {#if forgotLockoutSeconds > 0}
                            <div class="mt-1 font-mono font-bold text-rose-700 dark:text-rose-300">
                                Waktu tunggu: {formatTimer(forgotLockoutSeconds)}
                            </div>
                        {/if}
                    </div>
                </div>
            {/if}

            {#if forgotSuccess}
                <div class="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center gap-2">
                    <svg class="w-5 h-5 flex-shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>{forgotSuccess}</span>
                </div>
            {/if}

            <!-- Step 1: Input Username & Send OTP -->
            {#if forgotStep === 1 && !forgotSuccess}
                <div class="space-y-3.5 text-xs">
                    <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-[11px] leading-relaxed">
                        <span class="font-bold">🔒 Keamanan Berlapis:</span> Masukkan username administrator Anda. Sistem akan mengirimkan kode verifikasi OTP ke email yang terdaftar untuk administrator tersebut.
                    </div>

                    <div>
                        <label for="forgot-username" class="block font-bold text-[11px] uppercase tracking-wider text-[var(--text-2)] mb-1.5">
                            Username Admin
                        </label>
                        <input
                            id="forgot-username"
                            type="text"
                            bind:value={forgotUsername}
                            placeholder="Contoh: Effands atau fiko942"
                            disabled={forgotLoading || forgotLockoutSeconds > 0}
                            on:keydown={(e) => { if (e.key === 'Enter') handleRequestOtp(false); }}
                            class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-semibold text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                            autocomplete="off"
                        />
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                        <button
                            type="button"
                            class="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer bg-transparent border-0"
                            on:click={closeForgotPinModal}
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            disabled={forgotLoading || !forgotUsername.trim() || forgotLockoutSeconds > 0}
                            on:click={() => handleRequestOtp(false)}
                            class="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0 flex items-center gap-1.5"
                        >
                            {#if forgotLoading}
                                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Mengirim OTP...</span>
                            {:else}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                </svg>
                                <span>Kirim Kode OTP</span>
                            {/if}
                        </button>
                    </div>
                </div>
            {/if}

            <!-- Step 2: Verify OTP -->
            {#if forgotStep === 2 && !forgotSuccess}
                <div class="space-y-3.5 text-xs">
                    <!-- Admin Identity Pill -->
                    <div class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 text-[11px] flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-blue-500"></span>
                            <span class="font-bold">Akun Admin:</span>
                            <span class="font-mono font-bold text-[var(--text)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-blue-500/30">
                                {forgotUsername}
                            </span>
                        </div>
                        <button
                            type="button"
                            on:click={() => { forgotStep = 1; if (forgotLockoutSeconds <= 0) forgotError = ''; }}
                            class="text-[10px] underline font-semibold text-[var(--text-3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer"
                        >
                            Ganti Akun
                        </button>
                    </div>

                    <!-- Non-Disclosure OTP Instruction -->
                    <div class="p-3 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] text-[11px] leading-relaxed space-y-1">
                        <div class="font-bold text-[var(--text)] flex items-center gap-1.5">
                            <svg class="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>Kode OTP Terkirim ke Email</span>
                        </div>
                        <p class="text-[var(--text-3)]">
                            Kode OTP keamanan telah dikirim ke email terdaftar untuk administrator tersebut. Silakan periksa kotak masuk email Anda dan masukkan 6 digit kode OTP di bawah ini.
                        </p>
                    </div>

                    <!-- OTP Code Input -->
                    <div>
                        <label for="forgot-otp-input" class="block font-bold text-[11px] uppercase tracking-wider text-[var(--text-2)] mb-1.5">
                            Kode OTP (6 Digit)
                        </label>
                        <input
                            id="forgot-otp-input"
                            type="text"
                            inputmode="numeric"
                            maxlength="6"
                            value={forgotOtp}
                            on:input={(e) => {
                                const target = e.currentTarget;
                                forgotOtp = target.value.replace(/\D/g, '').slice(0, 6);
                                target.value = forgotOtp;
                            }}
                            placeholder="● ● ● ● ● ●"
                            disabled={forgotLoading || forgotLockoutSeconds > 0}
                            on:keydown={(e) => { if (e.key === 'Enter' && forgotOtp.length === 6 && forgotLockoutSeconds <= 0) handleVerifyOtp(); }}
                            class="w-full px-3.5 py-3 rounded-xl bg-[var(--surface-2)] border {forgotOtp.length === 6 ? 'border-blue-500 ring-2 ring-blue-500/25 bg-blue-500/5' : 'border-[var(--border)]'} text-[var(--text)] font-mono tracking-[0.3em] text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                            autocomplete="one-time-code"
                        />
                    </div>

                    <!-- Resend OTP Action Row -->
                    <div class="flex items-center justify-between text-[11px] pt-1 px-1">
                        <span class="text-[var(--text-3)]">Tidak menerima kode?</span>
                        {#if forgotLockoutSeconds > 0}
                            <span class="text-rose-600 dark:text-rose-400 font-bold flex items-center gap-1">
                                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                                </svg>
                                Kirim ulang diblokir ({formatTimer(forgotLockoutSeconds)})
                            </span>
                        {:else if otpCooldownSeconds > 0}
                            <span class="text-[var(--text-3)] font-semibold flex items-center gap-1">
                                <span class="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                                Kirim ulang ({otpCooldownSeconds}s)
                            </span>
                        {:else}
                            <button
                                type="button"
                                on:click={() => handleRequestOtp(true)}
                                disabled={forgotLoading || forgotLockoutSeconds > 0}
                                class="text-blue-600 dark:text-blue-400 hover:underline font-bold bg-transparent border-0 cursor-pointer disabled:opacity-50"
                            >
                                Kirim Ulang Kode OTP
                            </button>
                        {/if}
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                        <button
                            type="button"
                            class="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer bg-transparent border-0"
                            on:click={() => { forgotStep = 1; if (forgotLockoutSeconds <= 0) forgotError = ''; }}
                        >
                            Kembali
                        </button>
                        <button
                            type="button"
                            disabled={forgotLoading || forgotOtp.length !== 6 || forgotLockoutSeconds > 0}
                            on:click={handleVerifyOtp}
                            class="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0 flex items-center gap-1.5"
                        >
                            {#if forgotLoading}
                                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Memverifikasi...</span>
                            {:else}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Verifikasi OTP</span>
                            {/if}
                        </button>
                    </div>
                </div>
            {/if}

            <!-- Step 3: Set New PIN -->
            {#if forgotStep === 3 && !forgotSuccess}
                <div class="space-y-3.5 text-xs">
                    <div class="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center justify-between">
                        <div class="flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                            <span class="font-bold">OTP Terverifikasi:</span>
                            <span class="font-mono font-bold text-[var(--text)] bg-[var(--surface)] px-1.5 py-0.5 rounded border border-emerald-500/30">
                                {forgotUsername}
                            </span>
                        </div>
                        <span class="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full">
                            ✓ Valid
                        </span>
                    </div>

                    <!-- New PIN Field -->
                    <div>
                        <div class="flex justify-between items-center mb-1.5">
                            <label for="forgot-new-pin" class="block font-bold text-[11px] uppercase tracking-wider text-[var(--text-2)]">
                                PIN Baru (6 Digit Angka)
                            </label>
                            <button
                                type="button"
                                on:click={() => (forgotIsMasked = !forgotIsMasked)}
                                class="text-[10px] text-blue-600 dark:text-blue-400 hover:underline font-semibold bg-transparent border-0 cursor-pointer"
                            >
                                {forgotIsMasked ? 'Lihat PIN' : 'Sembunyikan'}
                            </button>
                        </div>
                        <input
                            id="forgot-new-pin"
                            type={forgotIsMasked ? 'password' : 'text'}
                            inputmode="numeric"
                            maxlength="6"
                            value={forgotNewPin}
                            on:input={(e) => {
                                const target = e.currentTarget;
                                forgotNewPin = target.value.replace(/\D/g, '').slice(0, 6);
                                target.value = forgotNewPin;
                            }}
                            placeholder="6 digit angka numerik"
                            disabled={forgotLoading || forgotLockoutSeconds > 0}
                            class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] font-mono tracking-widest text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                            autocomplete="new-password"
                        />
                    </div>

                    <!-- Confirm PIN Field -->
                    <div>
                        <label for="forgot-confirm-pin" class="block font-bold text-[11px] uppercase tracking-wider text-[var(--text-2)] mb-1.5">
                            Konfirmasi PIN Baru (6 Digit)
                        </label>
                        <input
                            id="forgot-confirm-pin"
                            type={forgotIsMasked ? 'password' : 'text'}
                            inputmode="numeric"
                            maxlength="6"
                            value={forgotConfirmPin}
                            on:input={(e) => {
                                const target = e.currentTarget;
                                forgotConfirmPin = target.value.replace(/\D/g, '').slice(0, 6);
                                target.value = forgotConfirmPin;
                            }}
                            placeholder="Ulangi 6 digit angka di atas"
                            disabled={forgotLoading || forgotLockoutSeconds > 0}
                            on:keydown={(e) => { if (e.key === 'Enter') handleResetForgotPin(); }}
                            class="w-full px-3.5 py-2.5 rounded-xl bg-[var(--surface-2)] border {forgotConfirmPin && forgotNewPin !== forgotConfirmPin ? 'border-rose-500 ring-1 ring-rose-500/30' : 'border-[var(--border)]'} text-[var(--text)] font-mono tracking-widest text-center text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all disabled:opacity-50"
                            autocomplete="new-password"
                        />
                        {#if forgotConfirmPin && forgotNewPin !== forgotConfirmPin}
                            <p class="text-[10px] text-rose-500 font-semibold mt-1">Konfirmasi PIN belum sama</p>
                        {/if}
                    </div>

                    <div class="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]">
                        <button
                            type="button"
                            class="px-4 py-2 rounded-xl text-xs font-bold text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer bg-transparent border-0"
                            on:click={closeForgotPinModal}
                        >
                            Batal
                        </button>
                        <button
                            type="button"
                            disabled={forgotLoading || forgotNewPin.length !== 6 || forgotConfirmPin.length !== 6 || forgotNewPin !== forgotConfirmPin || forgotLockoutSeconds > 0}
                            on:click={handleResetForgotPin}
                            class="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md shadow-emerald-600/25 transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer border-0 flex items-center gap-1.5"
                        >
                            {#if forgotLoading}
                                <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Menyimpan PIN...</span>
                            {:else}
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                <span>Simpan PIN Baru</span>
                            {/if}
                        </button>
                    </div>
                </div>
            {/if}
        </div>
    </div>
{/if}

<style>
    @keyframes shake {
        0%, 100% { transform: translateX(0); }
        20%, 60% { transform: translateX(-5px); }
        40%, 80% { transform: translateX(5px); }
    }

    .animate-shake {
        animation: shake 0.35s ease-in-out;
    }
</style>
