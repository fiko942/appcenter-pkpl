import { baseLayout } from './layout';

export const memberLoginPage = (error?: string, email?: string): string => {
    const content = `
    <div class="min-h-screen flex items-center justify-center p-4 bg-[var(--page)] transition-colors">
        <div class="w-full max-w-md animate-fade-in">
            <!-- Theme Toggle Top Right -->
            <div class="flex justify-end mb-4">
                <div class="theme-control" title="Ganti Mode Tema">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-amber-400">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <button type="button" class="theme-switch-btn" onclick="window.toggleTheme()" aria-label="Ganti Tema">
                        <span class="theme-switch-thumb"></span>
                    </button>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" class="text-indigo-400">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                    </svg>
                </div>
            </div>

            <!-- Logo/Header -->
            <div class="text-center mb-8">
                <div class="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-[#2f6bff] to-[#6b46ef] flex items-center justify-center mb-4 shadow-xl shadow-blue-500/20 text-white font-extrabold text-3xl">
                    Z
                </div>
                <h1 class="text-2xl font-extrabold text-[var(--text)]">Member Area</h1>
                <p class="text-[var(--text-3)] text-sm mt-1.5">Masuk untuk mengakses dashboard & lisensi software</p>
            </div>

            <!-- Login Card -->
            <div class="p-8 bg-[var(--surface)] border border-[var(--border)] rounded-3xl shadow-xl shadow-[var(--shadow)]">
                ${error ? `
                <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-3.5 mb-6 text-red-400 text-center text-xs flex items-center justify-center gap-2">
                    <svg class="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                    </svg>
                    <span>${error}</span>
                </div>
                ` : ''}

                <form id="loginForm" method="POST" action="/member/login" class="space-y-4">
                    <!-- Email Input -->
                    <div>
                        <label class="block text-[var(--text-2)] text-xs font-bold uppercase tracking-wider mb-2">Email Address</label>
                        <div class="relative">
                            <span class="absolute left-4 top-3 text-[var(--text-3)]">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
                                </svg>
                            </span>
                            <input type="email" name="email" required value="${email || ''}" 
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--brand)] text-[var(--text)] rounded-xl py-2.5 px-4 pl-12 placeholder-[var(--text-3)] focus:outline-none transition-all text-sm font-medium"
                                placeholder="nama@email.com">
                        </div>
                    </div>

                    <!-- Password Input -->
                    <div>
                        <label class="block text-[var(--text-2)] text-xs font-bold uppercase tracking-wider mb-2">Password</label>
                        <div class="relative">
                            <span class="absolute left-4 top-3 text-[var(--text-3)]">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path>
                                </svg>
                            </span>
                            <input type="password" name="password" required 
                                class="w-full bg-[var(--surface-2)] border border-[var(--border)] focus:border-[var(--brand)] text-[var(--text)] rounded-xl py-2.5 px-4 pl-12 placeholder-[var(--text-3)] focus:outline-none transition-all text-sm font-medium"
                                placeholder="••••••••">
                        </div>
                    </div>

                    <!-- Submit Button -->
                    <button type="submit" id="submitBtn" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-blue-600/20 transform transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm">
                        <span id="btnText">Masuk Sekarang</span>
                        <svg id="btnLoader" class="hidden animate-spin ml-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                    </button>
                </form>

                <div class="mt-6 text-center">
                    <p class="text-[var(--text-3)] text-xs">Belum punya akun? <a href="/member/register" class="text-[var(--brand)] hover:underline font-bold">Daftar sekarang</a></p>
                </div>
            </div>

            <p class="text-center text-[var(--text-3)] text-xs mt-8">
                © 2026 Appcenter Ziqva. All rights reserved.
            </p>
        </div>
    </div>
    `;

    const scripts = `
    <script>
    $(document).ready(function() {
        $('#loginForm').on('submit', function() {
            $('#btnText').text('Memproses...');
            $('#btnLoader').removeClass('hidden');
            $('#submitBtn').prop('disabled', true);
        });
    });
    </script>
    `;

    return baseLayout('Member Login', content, scripts);
};
