<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import PublicNavbar from '../components/PublicNavbar.svelte';
    import PublicFooter from '../components/PublicFooter.svelte';
    import CustomCheckbox from '../components/CustomCheckbox.svelte';
    import { checkSession } from '../stores/auth';

    // Step 1 Form Fields
    let name: string = '';
    let email: string = '';
    let company: string = '';
    let whatsapp: string = '';
    let password: string = '';
    let confirm_password: string = '';
    let showPassword: boolean = false;
    let showConfirmPassword: boolean = false;
    let agreeTerms: boolean = false;

    // Multi-stage flow: 1 = Fill Form, 2 = Verify OTP
    let currentStep: 1 | 2 = 1;

    // OTP Verification State
    let otpDigits: string[] = ['', '', '', '', '', ''];
    let otpInputRefs: HTMLInputElement[] = [];
    let sendingOtp: boolean = false;
    let verifyingOtp: boolean = false;
    let resendCooldown: number = 0;
    let cooldownTimer: ReturnType<typeof setInterval> | null = null;
    let successMessage: string = '';

    let error: string = '';
    let loading: boolean = false;
    let memberCountText: string = '2.8k+ Member Aktif';
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

    $: isPasswordMatch = password && confirm_password && password === confirm_password;
    $: isPasswordMismatch = password && confirm_password && password !== confirm_password;
    $: fullOtp = otpDigits.join('');
    $: isOtpComplete = fullOtp.length === 6 && /^\d{6}$/.test(fullOtp);

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

        try {
            const res = await fetch('/member/api/public-stats');
            const resJson = await res.json();
            if (resJson?.data?.formattedMembers) {
                memberCountText = resJson.data.formattedMembers;
            }
        } catch {
            // Keep default fallback
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

    // Step 1 -> Request OTP and go to Step 2
    async function handleRequestOtp(e: Event) {
        e.preventDefault();
        error = '';
        successMessage = '';

        if (!name.trim() || !email.trim() || !whatsapp.trim() || !password || !confirm_password) {
            error = 'Mohon lengkapi seluruh kolom wajib.';
            return;
        }

        if (password.length < 6) {
            error = 'Kata sandi minimal 6 karakter.';
            return;
        }

        if (password !== confirm_password) {
            error = 'Kata sandi dan konfirmasi kata sandi tidak cocok.';
            return;
        }

        if (!agreeTerms) {
            error = 'Anda wajib menyetujui Syarat & Ketentuan serta Kebijakan Privasi.';
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email.trim())) {
            error = 'Format alamat email tidak valid.';
            return;
        }

        sendingOtp = true;

        try {
            const res = await fetch('/member/api/register/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    name: name.trim()
                })
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data?.status === 'success') {
                currentStep = 2;
                successMessage = data.message || `Kode OTP telah dikirimkan ke ${email.trim()}`;
                startCooldown(data.cooldown_seconds || 60);
                otpDigits = ['', '', '', '', '', ''];
                setTimeout(() => {
                    otpInputRefs[0]?.focus();
                }, 150);
            } else {
                error = data?.message || 'Gagal mengirim kode OTP verifikasi. Periksa kembali email Anda.';
            }
        } catch (err: any) {
            error = 'Terjadi gangguan jaringan saat mengirim kode OTP.';
        } finally {
            sendingOtp = false;
        }
    }

    // Resend OTP in Step 2
    async function handleResendOtp() {
        if (resendCooldown > 0 || sendingOtp) return;
        error = '';
        successMessage = '';
        sendingOtp = true;

        try {
            const res = await fetch('/member/api/register/send-otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    name: name.trim()
                })
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data?.status === 'success') {
                successMessage = 'Kode OTP baru berhasil dikirimkan ke email Anda.';
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

    // Handle OTP Box Input navigation
    function handleOtpInput(e: Event, index: number) {
        const input = e.target as HTMLInputElement;
        const val = input.value.replace(/[^0-9]/g, '');

        if (val.length > 1) {
            // If user pasted or typed multiple digits
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

    // Final Register with Verified OTP
    async function handleFinalRegister() {
        if (!isOtpComplete) {
            error = 'Masukkan 6 digit kode OTP verifikasi dengan lengkap.';
            return;
        }

        verifyingOtp = true;
        error = '';
        successMessage = '';

        try {
            const res = await fetch('/member/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    name: name.trim(),
                    email: email.trim(),
                    company: company.trim(),
                    whatsapp: whatsapp.trim(),
                    password,
                    confirm_password,
                    otp: fullOtp,
                    return_to: returnTo || undefined
                }),
                credentials: 'include'
            });

            const data = await res.json().catch(() => null);

            if (res.ok && data?.status === 'success') {
                await checkSession();
                if (data.redirect_to) {
                    window.location.href = data.redirect_to;
                } else if (returnTo) {
                    window.location.href = returnTo;
                } else {
                    window.location.hash = '/member/dashboard';
                }
            } else {
                error = data?.message || 'Kode OTP tidak valid atau akun gagal dibuat.';
            }
        } catch {
            error = 'Terjadi kesalahan sistem saat memproses registrasi.';
        } finally {
            verifyingOtp = false;
        }
    }
</script>

<div class="min-h-screen flex flex-col justify-between bg-[var(--page)] text-[var(--text)] transition-colors">
    <!-- Topbar Navigation with Top Announcement Bar -->
    <PublicNavbar activePage="register" />

    <!-- Main Container: Responsive 2-Column Grid -->
    <main class="w-full max-w-6xl mx-auto my-auto py-8 sm:py-12 px-4 sm:px-6">
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            
            <!-- Left Column: Visual Showcase Preview (Desktop) -->
            <div class="hidden lg:flex lg:col-span-6 flex-col justify-between p-6 rounded-2xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs space-y-6">
                <!-- Showcase Preview Image -->
                <div class="rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--surface-2)]">
                    <img
                        src="/images/auth/register_showcase.png?v=4"
                        alt="Appcenter Ecosystem Preview"
                        class="w-full h-auto object-cover"
                    />
                </div>

                <!-- Feature Highlights -->
                <div class="space-y-3">
                    <div class="flex items-start gap-3">
                        <div class="w-7 h-7 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center flex-shrink-0 text-purple-600 dark:text-purple-400 mt-0.5">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xs font-bold text-[var(--text)]">Installer Resmi & Tutorial Lengkap</h2>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">Unduh installer Windows & Mac resmi beserta video panduan setup.</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-3">
                        <div class="w-7 h-7 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center flex-shrink-0 text-blue-600 dark:text-blue-400 mt-0.5">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xs font-bold text-[var(--text)]">Penghasilan Melalui Afiliasi</h2>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">Bagikan link referral unik Anda dan dapatkan komisi langsung.</p>
                        </div>
                    </div>

                    <div class="flex items-start gap-3">
                        <div class="w-7 h-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                        </div>
                        <div>
                            <h2 class="text-xs font-bold text-[var(--text)]">Verifikasi Keamanan Email</h2>
                            <p class="text-[11px] text-[var(--text-3)] leading-relaxed">Proteksi akun member dengan kode OTP 6-digit real-time anti-spam.</p>
                        </div>
                    </div>
                </div>

                <!-- Stats Bar -->
                <div class="pt-3 border-t border-[var(--border)] flex items-center justify-between text-[11px] font-medium text-[var(--text-3)]">
                    <span class="text-purple-500 font-semibold">{memberCountText}</span>
                    <span>•</span>
                    <span>Keamanan Terjamin</span>
                    <span>•</span>
                    <span>Update Berkala</span>
                </div>
            </div>

            <!-- Right Column: Form Card -->
            <div class="w-full lg:col-span-6 max-w-lg mx-auto bg-[var(--surface-1)] border border-[var(--border)] rounded-2xl p-6 sm:p-8 shadow-xs">
                
                <!-- Stage Progress Indicator -->
                <div class="flex items-center justify-center gap-3 mb-6">
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold {currentStep === 1 ? 'bg-purple-600 text-white' : 'bg-emerald-500 text-white'}">
                            {#if currentStep === 2}
                                ✓
                            {:else}
                                1
                            {/if}
                        </div>
                        <span class="text-xs font-semibold {currentStep === 1 ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}">Data Diri</span>
                    </div>
                    <div class="w-8 h-0.5 bg-[var(--border)]"></div>
                    <div class="flex items-center gap-2">
                        <div class="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold {currentStep === 2 ? 'bg-purple-600 text-white' : 'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)]'}">
                            2
                        </div>
                        <span class="text-xs font-semibold {currentStep === 2 ? 'text-[var(--text)]' : 'text-[var(--text-3)]'}">Verifikasi OTP</span>
                    </div>
                </div>

                <!-- Header Title & Branding -->
                <div class="text-center mb-6">
                    <div class="w-12 h-12 mx-auto rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-3">
                        {#if currentStep === 1}
                            <img src="/favicon.svg" alt="Appcenter Logo" class="w-6 h-6 object-contain" />
                        {:else}
                            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        {/if}
                    </div>
                    <h1 class="text-xl font-bold text-[var(--text)] tracking-tight">
                        {currentStep === 1 ? 'Buat Akun Member' : 'Verifikasi Alamat Email'}
                    </h1>
                    <p class="text-[var(--text-3)] text-xs mt-1">
                        {currentStep === 1 ? 'Daftar untuk mengakses katalog software dan lisensi resmi' : `Masukkan kode 6 digit yang dikirim ke ${email}`}
                    </p>
                </div>

                <!-- Notification Banners -->
                {#if error}
                    <div class="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 mb-5 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                        <svg class="w-4 h-4 text-rose-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                        </svg>
                        <span class="font-medium flex-1">{error}</span>
                    </div>
                {/if}

                {#if successMessage}
                    <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 mb-5 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2.5 animate-in fade-in">
                        <svg class="w-4 h-4 text-emerald-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                        </svg>
                        <span class="font-medium flex-1">{successMessage}</span>
                    </div>
                {/if}

                <!-- STAGE 1: Data Form -->
                {#if currentStep === 1}
                    <form on:submit={handleRequestOtp} class="space-y-3.5">
                        <!-- Nama Lengkap -->
                        <div>
                            <label for="reg-name" class="block text-xs font-semibold text-[var(--text-2)] mb-1">
                                Nama Lengkap <span class="text-rose-500">*</span>
                            </label>
                            <div class="relative">
                                <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                                    </svg>
                                </span>
                                <input
                                    id="reg-name"
                                    type="text"
                                    required
                                    bind:value={name}
                                    placeholder="Nama Lengkap Anda"
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-purple-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-purple-500/15"
                                />
                            </div>
                        </div>

                        <!-- Email Address -->
                        <div>
                            <label for="reg-email" class="block text-xs font-semibold text-[var(--text-2)] mb-1">
                                Alamat Email <span class="text-rose-500">*</span>
                            </label>
                            <div class="relative">
                                <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                    </svg>
                                </span>
                                <input
                                    id="reg-email"
                                    type="email"
                                    required
                                    bind:value={email}
                                    placeholder="nama@email.com"
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-purple-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-purple-500/15"
                                />
                            </div>
                            <p class="text-[10px] text-[var(--text-3)] mt-1">Kode OTP verifikasi akan dikirimkan ke email ini.</p>
                        </div>

                        <!-- Nama Usaha & WhatsApp in 2 Columns -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label for="reg-company" class="block text-xs font-semibold text-[var(--text-2)] mb-1">
                                    Nama Usaha / Toko <span class="text-[10px] text-[var(--text-3)] font-normal">(opsional)</span>
                                </label>
                                <div class="relative">
                                    <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                                        </svg>
                                    </span>
                                    <input
                                        id="reg-company"
                                        type="text"
                                        bind:value={company}
                                        placeholder="Contoh: Ziqva Store"
                                        class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-purple-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-purple-500/15"
                                    />
                                </div>
                            </div>

                            <div>
                                <label for="reg-whatsapp" class="block text-xs font-semibold text-[var(--text-2)] mb-1">
                                    WhatsApp <span class="text-rose-500">*</span>
                                </label>
                                <div class="relative">
                                    <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                        </svg>
                                    </span>
                                    <input
                                        id="reg-whatsapp"
                                        type="tel"
                                        required
                                        bind:value={whatsapp}
                                        placeholder="08123456789"
                                        class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-purple-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-purple-500/15"
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Password & Confirm Password in 2 Columns -->
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label for="reg-password" class="block text-xs font-semibold text-[var(--text-2)] mb-1">
                                    Kata Sandi <span class="text-rose-500">*</span>
                                </label>
                                <div class="relative">
                                    <span class="absolute left-3.5 top-3 text-[var(--text-3)]">
                                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                        </svg>
                                    </span>
                                    {#if showPassword}
                                        <input
                                            id="reg-password"
                                            type="text"
                                            required
                                            bind:value={password}
                                            placeholder="Minimal 6 karakter"
                                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-purple-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-9 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-purple-500/15"
                                        />
                                    {:else}
                                        <input
                                            id="reg-password"
                                            type="password"
                                            required
                                            bind:value={password}
                                            placeholder="••••••••"
                                            class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-purple-500 text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-9 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-purple-500/15"
                                        />
                                    {/if}
                                    <button
                                        type="button"
                                        on:click={() => showPassword = !showPassword}
                                        class="absolute right-2.5 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] p-0.5 rounded transition-colors cursor-pointer bg-transparent border-0"
                                        title={showPassword ? 'Sembunyikan' : 'Lihat'}
                                    >
                                        {#if showPassword}
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                            </svg>
                                        {:else}
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        {/if}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <div class="flex items-center justify-between mb-1">
                                    <label for="reg-confirm-password" class="block text-xs font-semibold text-[var(--text-2)]">
                                        Konfirmasi <span class="text-rose-500">*</span>
                                    </label>
                                    {#if isPasswordMatch}
                                        <span class="text-[10px] font-bold text-emerald-500">
                                            Cocok ✓
                                        </span>
                                    {:else if isPasswordMismatch}
                                        <span class="text-[10px] font-bold text-rose-500">
                                            Beda ✗
                                        </span>
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
                                            id="reg-confirm-password"
                                            type="text"
                                            required
                                            bind:value={confirm_password}
                                            placeholder="Ulangi kata sandi"
                                            class="w-full bg-[var(--surface-2)] border {isPasswordMismatch ? 'border-rose-500 focus:border-rose-500' : isPasswordMatch ? 'border-emerald-500 focus:border-emerald-500' : 'border-[var(--border)] focus:border-purple-500'} text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-9 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-purple-500/15"
                                        />
                                    {:else}
                                        <input
                                            id="reg-confirm-password"
                                            type="password"
                                            required
                                            bind:value={confirm_password}
                                            placeholder="••••••••"
                                            class="w-full bg-[var(--surface-2)] border {isPasswordMismatch ? 'border-rose-500 focus:border-rose-500' : isPasswordMatch ? 'border-emerald-500 focus:border-emerald-500' : 'border-[var(--border)] focus:border-purple-500'} text-[var(--text)] rounded-xl py-2.5 px-3.5 pl-10 pr-9 placeholder-[var(--text-3)] focus:outline-none transition-colors text-xs sm:text-sm focus:ring-2 focus:ring-purple-500/15"
                                        />
                                    {/if}
                                    <button
                                        type="button"
                                        on:click={() => showConfirmPassword = !showConfirmPassword}
                                        class="absolute right-2.5 top-2.5 text-[var(--text-3)] hover:text-[var(--text)] p-0.5 rounded transition-colors cursor-pointer bg-transparent border-0"
                                        title={showConfirmPassword ? 'Sembunyikan' : 'Lihat'}
                                    >
                                        {#if showConfirmPassword}
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                                            </svg>
                                        {:else}
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                            </svg>
                                        {/if}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <!-- Terms and Privacy Policy Mandatory Agreement Checkbox -->
                        <div class="py-1">
                            <CustomCheckbox
                                bind:checked={agreeTerms}
                                color="purple"
                                align="start"
                            >
                                <span class="text-xs text-[var(--text-3)] dark:text-slate-400 leading-relaxed select-none">
                                    Saya telah membaca, memahami, dan menyetujui <a href="#/terms" target="_blank" rel="noopener noreferrer" class="text-[var(--text)] dark:text-slate-200 font-medium underline underline-offset-2 decoration-[var(--border)] dark:decoration-slate-700 hover:decoration-purple-500 hover:text-purple-600 dark:hover:text-purple-400 transition-colors">Syarat & Ketentuan Layanan</a> serta <a href="#/privacy" target="_blank" rel="noopener noreferrer" class="text-[var(--text)] dark:text-slate-200 font-medium underline underline-offset-2 decoration-[var(--border)] dark:decoration-slate-700 hover:decoration-emerald-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">Kebijakan Privasi Data</a>.
                                </span>
                            </CustomCheckbox>
                        </div>

                        <!-- Submit Button: Request OTP -->
                        <button
                            type="submit"
                            disabled={sendingOtp || !agreeTerms}
                            class="w-full mt-3 bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors disabled:opacity-50 text-xs sm:text-sm cursor-pointer border-0 flex items-center justify-center gap-2"
                        >
                            {#if sendingOtp}
                                <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Mengirim Kode OTP...</span>
                            {:else}
                                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                                </svg>
                                <span>Lanjutkan: Verifikasi Email</span>
                            {/if}
                        </button>
                    </form>
                {:else}
                    <!-- STAGE 2: OTP Verification Box -->
                    <div class="space-y-5 animate-in fade-in">
                        
                        <!-- Email Card Display -->
                        <div class="p-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl flex items-center justify-between">
                            <div class="flex items-center gap-2.5 overflow-hidden">
                                <div class="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400 flex-shrink-0">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div class="truncate">
                                    <div class="text-[10px] text-[var(--text-3)] uppercase tracking-wider font-semibold">Terkirim ke email</div>
                                    <div class="text-xs font-bold text-[var(--text)] truncate">{email}</div>
                                </div>
                            </div>
                            <button
                                type="button"
                                on:click={() => { currentStep = 1; error = ''; successMessage = ''; }}
                                class="text-[11px] font-semibold text-purple-600 dark:text-purple-400 hover:underline flex-shrink-0 pl-2 bg-transparent border-0 cursor-pointer"
                            >
                                Ubah Data
                            </button>
                        </div>

                        <!-- 6-Box OTP Input -->
                        <div class="space-y-2">
                            <div class="block text-center text-xs font-semibold text-[var(--text-2)]">
                                Masukkan 6 Digit Kode OTP
                            </div>
                            <div class="flex items-center justify-center gap-2 sm:gap-2.5" on:paste={handleOtpPaste}>
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
                                        class="w-10 sm:w-12 h-12 sm:h-14 text-center text-lg sm:text-xl font-black font-mono rounded-xl bg-[var(--surface-2)] border {digit ? 'border-purple-500 ring-2 ring-purple-500/20 text-purple-500' : 'border-[var(--border)] text-[var(--text)]'} focus:outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-500/30 transition-all"
                                    />
                                {/each}
                            </div>
                            <p class="text-[11px] text-center text-[var(--text-3)]">
                                Kode berlaku selama 10 menit. Periksa folder <strong>Kotak Masuk</strong> atau <strong>Spam</strong>.
                            </p>
                        </div>

                        <!-- Resend Button with Cooldown -->
                        <div class="flex items-center justify-center pt-1">
                            {#if resendCooldown > 0}
                                <span class="inline-flex items-center gap-1.5 text-xs text-[var(--text-3)] font-medium">
                                    <svg class="w-3.5 h-3.5 animate-spin text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Kirim ulang kode dalam <strong class="text-purple-500">{resendCooldown} detik</strong>
                                </span>
                            {:else}
                                <button
                                    type="button"
                                    on:click={handleResendOtp}
                                    disabled={sendingOtp}
                                    class="text-xs font-bold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1.5 cursor-pointer bg-transparent border-0"
                                >
                                    {#if sendingOtp}
                                        <span class="w-3.5 h-3.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></span>
                                        <span>Mengirim...</span>
                                    {:else}
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>Kirim Ulang Kode OTP</span>
                                    {/if}
                                </button>
                            {/if}
                        </div>

                        <!-- Final Submit Button -->
                        <button
                            type="button"
                            on:click={handleFinalRegister}
                            disabled={verifyingOtp || !isOtpComplete}
                            class="w-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition-colors disabled:opacity-50 text-xs sm:text-sm cursor-pointer border-0 flex items-center justify-center gap-2"
                        >
                            {#if verifyingOtp}
                                <span class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                <span>Memverifikasi Akun...</span>
                            {:else}
                                <svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span>Verifikasi & Buat Akun</span>
                            {/if}
                        </button>
                    </div>
                {/if}

                <div class="mt-6 pt-4 border-t border-[var(--border)] text-center text-xs text-[var(--text-3)]">
                    Sudah memiliki akun?
                    <a href="#/member/login{returnTo ? `?return_to=${encodeURIComponent(returnTo)}` : ''}" class="text-purple-600 dark:text-purple-400 hover:underline font-semibold ml-1">
                        Masuk Disini &rarr;
                    </a>
                </div>
            </div>

        </div>
    </main>

    <!-- Complete Ecosystem Footer -->
    <PublicFooter />
</div>
