<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import PublicNavbar from '../components/PublicNavbar.svelte';
    import PublicFooter from '../components/PublicFooter.svelte';
    import { checkSession } from '../stores/auth';

    let email: string = '';
    let currentStep: 1 | 2 | 3 = 1; // 1: Enter Email, 2: Enter OTP & New Password, 3: Success

    // Step 2 Fields
    let otpDigits: string[] = ['', '', '', '', '', ''];
    let otpInputRefs: HTMLInputElement[] = [];
    let newPassword: string = '';
    let confirmPassword: string = '';
    let showNewPassword: boolean = false;
    let showConfirmPassword: boolean = false;

    let sendingOtp: boolean = false;
    let resettingPassword: boolean = false;
    let resendCooldown: number = 0;
    let cooldownTimer: ReturnType<typeof setInterval> | null = null;

    let error: string = '';
    let successMessage: string = '';

    $: fullOtp = otpDigits.join('');
    $: isOtpComplete = fullOtp.length === 6 && /^\d{6}$/.test(fullOtp);
    $: isPasswordMatch = newPassword && confirmPassword && newPassword === confirmPassword;
    $: isPasswordMismatch = newPassword && confirmPassword && newPassword !== confirmPassword;

    onMount(async () => {
        const isAuth = await checkSession();
        if (isAuth) {
            window.location.hash = '/member/dashboard';
        }
    });

    onDestroy(() => {
        if (cooldownTimer) clearInterval(cooldownTimer);
    });

    function startCooldown(seconds: number = 60) {
        resendCooldown = seconds;
        if (cooldownTimer) clearInterval(cooldownTimer);
        cooldownTimer = setInterval(() => {
            if (resendCooldown > 0) {
                resendCooldown -= 1;
            } else {
                if (cooldownTimer) clearInterval(cooldownTimer);
            }
        }, 1000);
    }

    async function handleRequestResetOtp(e: Event) {
        e.preventDefault();
        error = '';
        successMessage = '';

        if (!email.trim()) {
            error = 'Alamat email wajib diisi.';
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            error = 'Format alamat email tidak valid.';
            return;
        }

        sendingOtp = true;

        try {
            const res = await fetch('/member/api/forgot-password/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() })
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data?.status === 'success') {
                currentStep = 2;
                successMessage = data.message || `Kode OTP reset telah dikirim ke ${email.trim()}`;
                startCooldown(data.cooldown_seconds || 60);
                otpDigits = ['', '', '', '', '', ''];
                setTimeout(() => {
                    otpInputRefs[0]?.focus();
                }, 150);
            } else {
                error = data?.message || 'Email tidak terdaftar atau gagal mengirim email pemulihan.';
            }
        } catch {
            error = 'Terjadi kesalahan sistem saat mengirim kode OTP.';
        } finally {
            sendingOtp = false;
        }
    }

    async function handleResendOtp() {
        if (resendCooldown > 0 || sendingOtp) return;
        error = '';
        successMessage = '';
        sendingOtp = true;

        try {
            const res = await fetch('/member/api/forgot-password/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim() })
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data?.status === 'success') {
                successMessage = 'Kode OTP baru berhasil dikirim ke email Anda.';
                startCooldown(data.cooldown_seconds || 60);
            } else {
                error = data?.message || 'Gagal mengirim ulang kode OTP.';
            }
        } catch {
            error = 'Terjadi kesalahan sistem saat mengirim ulang OTP.';
        } finally {
            sendingOtp = false;
        }
    }

    function handleOtpInput(e: Event, index: number) {
        const input = e.target as HTMLInputElement;
        const val = input.value.replace(/[^0-9]/g, '');

        if (val.length > 1) {
            const digits = val.slice(0, 6).split('');
            digits.forEach((d, i) => {
                if (index + i < 6) otpDigits[index + i] = d;
            });
            otpDigits = [...otpDigits];
            const nextIdx = Math.min(5, index + digits.length);
            otpInputRefs[nextIdx]?.focus();
            return;
        }

        otpDigits[index] = val;
        otpDigits = [...otpDigits];

        if (val && index < 5) {
            otpInputRefs[index + 1]?.focus();
        }
    }

    function handleOtpKeydown(e: KeyboardEvent, index: number) {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpInputRefs[index - 1]?.focus();
        }
    }

    function handleOtpPaste(e: ClipboardEvent) {
        e.preventDefault();
        const text = e.clipboardData?.getData('text') || '';
        const digits = text.replace(/[^0-9]/g, '').slice(0, 6).split('');
        if (digits.length > 0) {
            digits.forEach((d, i) => {
                if (i < 6) otpDigits[i] = d;
            });
            otpDigits = [...otpDigits];
            const focusIdx = Math.min(5, digits.length);
            otpInputRefs[focusIdx]?.focus();
        }
    }

    async function handleResetPassword(e: Event) {
        e.preventDefault();
        error = '';
        successMessage = '';

        if (!isOtpComplete) {
            error = 'Masukkan 6 digit kode OTP verifikasi dengan lengkap.';
            return;
        }

        if (!newPassword || newPassword.length < 6) {
            error = 'Kata sandi baru minimal 6 karakter.';
            return;
        }

        if (newPassword !== confirmPassword) {
            error = 'Kata sandi baru dan konfirmasi kata sandi tidak cocok.';
            return;
        }

        resettingPassword = true;

        try {
            const res = await fetch('/member/api/forgot-password/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    otp: fullOtp,
                    new_password: newPassword,
                    confirm_password: confirmPassword
                })
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data?.status === 'success') {
                currentStep = 3;
                successMessage = data.message || 'Kata sandi Anda berhasil diperbarui!';
            } else {
                error = data?.message || 'Gagal mengatur ulang kata sandi. Pastikan OTP benar.';
            }
        } catch {
            error = 'Terjadi kesalahan sistem saat memperbarui kata sandi.';
        } finally {
            resettingPassword = false;
        }
    }
</script>

<div class="min-h-screen flex flex-col justify-between bg-[var(--page)] text-[var(--text)] transition-colors">
    <PublicNavbar activePage="login" />

    <main class="w-full max-w-md mx-auto my-auto py-8 sm:py-12 px-4 sm:px-6">
        <div class="p-6 sm:p-8 bg-[var(--surface-1)] border border-[var(--border)] rounded-3xl shadow-xl space-y-6">
            
            <!-- Header Icon & Title -->
            <div class="text-center">
                <div class="w-12 h-12 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-3">
                    {#if currentStep === 3}
                        <svg class="w-6 h-6 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                    {:else}
                        <svg class="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                        </svg>
                    {/if}
                </div>
                <h1 class="text-xl font-bold text-[var(--text)] tracking-tight">
                    {#if currentStep === 1}
                        Lupa Kata Sandi
                    {:else if currentStep === 2}
                        Pemulihan Kata Sandi
                    {:else}
                        Kata Sandi Diperbarui!
                    {/if}
                </h1>
                <p class="text-[var(--text-3)] text-xs mt-1">
                    {#if currentStep === 1}
                        Masukkan email Anda untuk menerima 6 digit kode OTP pemulihan
                    {:else if currentStep === 2}
                        Masukkan kode OTP dan buat kata sandi baru untuk akun Anda
                    {:else}
                        Akun Anda telah diamankan. Silakan masuk dengan kata sandi baru Anda.
                    {/if}
                </p>
            </div>

            <!-- Error Banner -->
            {#if error}
                <div class="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <svg class="w-4 h-4 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span class="font-medium flex-1">{error}</span>
                </div>
            {/if}

            <!-- Success Banner -->
            {#if successMessage}
                <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                    <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                    </svg>
                    <span class="font-medium flex-1">{successMessage}</span>
                </div>
            {/if}

            <!-- STEP 1: Enter Email -->
            {#if currentStep === 1}
                <form on:submit={handleRequestResetOtp} class="space-y-4">
                    <div>
                        <label for="forgot-email" class="block text-xs font-semibold text-[var(--text-2)] mb-1">
                            Alamat Email Akun <span class="text-rose-500">*</span>
                        </label>
                        <div class="relative">
                            <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                </svg>
                            </span>
                            <input
                                id="forgot-email"
                                type="email"
                                required
                                bind:value={email}
                                placeholder="nama@email.com"
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-amber-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-amber-500/15"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={sendingOtp}
                        class="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors disabled:opacity-50 text-xs sm:text-sm cursor-pointer border-0 flex items-center justify-center gap-2"
                    >
                        {#if sendingOtp}
                            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Mengirim Kode OTP...</span>
                        {:else}
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                            <span>Kirim Kode OTP Reset</span>
                        {/if}
                    </button>
                </form>
            {/if}

            <!-- STEP 2: Enter OTP & New Password -->
            {#if currentStep === 2}
                <form on:submit={handleResetPassword} class="space-y-4 animate-in fade-in">
                    <!-- Email Reference & Change button -->
                    <div class="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                        <div class="truncate text-xs font-semibold text-[var(--text)]">
                            <span class="text-[var(--text-3)] font-normal">Tujuan:</span> {email}
                        </div>
                        <button
                            type="button"
                            on:click={() => { currentStep = 1; error = ''; successMessage = ''; }}
                            class="text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline flex-shrink-0 pl-2 bg-transparent border-0 cursor-pointer"
                        >
                            Ubah Email
                        </button>
                    </div>

                    <!-- 6-digit OTP -->
                    <div class="space-y-1.5">
                        <div class="block text-center text-xs font-semibold text-[var(--text-2)]">
                            Kode OTP 6-Digit
                        </div>
                        <div class="flex items-center justify-center gap-2" on:paste={handleOtpPaste}>
                            {#each otpDigits as digit, idx}
                                <input
                                    type="text"
                                    inputmode="numeric"
                                    pattern="[0-9]*"
                                    maxlength="6"
                                    bind:this={otpInputRefs[idx]}
                                    value={digit}
                                    on:input={(e) => handleOtpInput(e, idx)}
                                    on:keydown={(e) => handleOtpKeydown(e, idx)}
                                    class="w-10 sm:w-11 h-12 text-center text-lg font-black font-mono rounded-xl bg-[var(--surface-2)] border {digit ? 'border-amber-500 ring-2 ring-amber-500/20 text-amber-500' : 'border-[var(--border)] text-[var(--text)]'} focus:outline-none focus:border-amber-500 transition-all"
                                />
                            {/each}
                        </div>
                    </div>

                    <!-- Resend OTP Link -->
                    <div class="text-center text-xs">
                        {#if resendCooldown > 0}
                            <span class="text-[var(--text-3)] font-medium">
                                Kirim ulang kode dalam <strong class="text-amber-500">{resendCooldown}s</strong>
                            </span>
                        {:else}
                            <button
                                type="button"
                                on:click={handleResendOtp}
                                disabled={sendingOtp}
                                class="font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer bg-transparent border-0"
                            >
                                Kirim Ulang Kode OTP
                            </button>
                        {/if}
                    </div>

                    <!-- New Password -->
                    <div>
                        <label for="new-password" class="block text-xs font-semibold text-[var(--text-2)] mb-1">
                            Kata Sandi Baru <span class="text-rose-500">*</span>
                        </label>
                        <div class="relative">
                            <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                            </span>
                            {#if showNewPassword}
                                <input
                                    id="new-password"
                                    type="text"
                                    required
                                    bind:value={newPassword}
                                    placeholder="Minimal 6 karakter"
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-amber-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-9 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm"
                                />
                            {:else}
                                <input
                                    id="new-password"
                                    type="password"
                                    required
                                    bind:value={newPassword}
                                    placeholder="••••••••"
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-amber-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-9 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm"
                                />
                            {/if}
                            <button
                                type="button"
                                on:click={() => showNewPassword = !showNewPassword}
                                class="absolute right-2.5 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] p-0.5 rounded transition-colors cursor-pointer bg-transparent border-0"
                            >
                                {#if showNewPassword}
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                {:else}
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                {/if}
                            </button>
                        </div>
                    </div>

                    <!-- Confirm New Password -->
                    <div>
                        <div class="flex items-center justify-between mb-1">
                            <label for="confirm-new-password" class="block text-xs font-semibold text-[var(--text-2)]">
                                Konfirmasi Kata Sandi Baru <span class="text-rose-500">*</span>
                            </label>
                            {#if isPasswordMatch}
                                <span class="text-[10px] font-bold text-emerald-500">Cocok ✓</span>
                            {:else if isPasswordMismatch}
                                <span class="text-[10px] font-bold text-rose-500">Beda ✗</span>
                            {/if}
                        </div>
                        <div class="relative">
                            <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                            </span>
                            {#if showConfirmPassword}
                                <input
                                    id="confirm-new-password"
                                    type="text"
                                    required
                                    bind:value={confirmPassword}
                                    placeholder="Ulangi kata sandi baru"
                                    class="w-full bg-[var(--surface-2)] border {isPasswordMismatch ? 'border-rose-500' : isPasswordMatch ? 'border-emerald-500' : 'border-[var(--border)]'} text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-9 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm"
                                />
                            {:else}
                                <input
                                    id="confirm-new-password"
                                    type="password"
                                    required
                                    bind:value={confirmPassword}
                                    placeholder="••••••••"
                                    class="w-full bg-[var(--surface-2)] border {isPasswordMismatch ? 'border-rose-500' : isPasswordMatch ? 'border-emerald-500' : 'border-[var(--border)]'} text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-9 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm"
                                />
                            {/if}
                            <button
                                type="button"
                                on:click={() => showConfirmPassword = !showConfirmPassword}
                                class="absolute right-2.5 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] p-0.5 rounded transition-colors cursor-pointer bg-transparent border-0"
                            >
                                {#if showConfirmPassword}
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" /></svg>
                                {:else}
                                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                                {/if}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={resettingPassword || !isOtpComplete}
                        class="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors disabled:opacity-50 text-xs sm:text-sm cursor-pointer border-0 flex items-center justify-center gap-2"
                    >
                        {#if resettingPassword}
                            <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Memperbarui Kata Sandi...</span>
                        {:else}
                            <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span>Simpan Kata Sandi Baru</span>
                        {/if}
                    </button>
                </form>
            {/if}

            <!-- STEP 3: Success Screen -->
            {#if currentStep === 3}
                <div class="text-center space-y-4 animate-in fade-in">
                    <p class="text-xs text-[var(--text-3)] leading-relaxed">
                        Kata sandi akun Anda telah berhasil diubah. Silakan gunakan kata sandi baru untuk masuk ke dashboard AppCenter.
                    </p>
                    <a
                        href="#/member/login"
                        class="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold shadow-sm transition-colors text-decoration-none"
                    >
                        <span>Masuk ke Akun Sekarang</span>
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                        </svg>
                    </a>
                </div>
            {/if}

            <!-- Footer Link -->
            <div class="pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--text-3)]">
                Kembali ke
                <a href="#/member/login" class="text-blue-600 dark:text-blue-400 hover:underline font-semibold ml-1">
                    Halaman Masuk
                </a>
            </div>
        </div>
    </main>

    <PublicFooter />
</div>
