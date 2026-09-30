import { baseLayout } from './layout';
import { getMemberSidebar } from './components/member-sidebar';

interface MemberData {
    name: string;
    email: string;
    avatar?: string;
}

export const memberProfilePage = (user: MemberData): string => {
    const sidebar = getMemberSidebar('profile', user);

    const content = `
    <div class="min-h-screen flex">
        ${sidebar}

        <div class="site-main flex-1 md:pl-64 flex flex-col">
            <!-- Sticky Topbar -->
            <header class="topbar">
                <div class="flex items-center gap-3">
                    <button id="sidebar-toggle-top" class="md:hidden p-1 text-[var(--text-3)] hover:text-[var(--text)]" aria-label="Buka Menu">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span class="eyebrow">PENGATURAN AKUN MEMBER</span>
                </div>
                <div class="top-actions">
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

                    <a class="help top-link" href="/member/tutorials">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Butuh bantuan?</span>
                    </a>
                </div>
            </header>

            <main class="flex-1 p-6 md:p-8 max-w-4xl w-full mx-auto space-y-6">
                <div>
                    <h1 class="text-2xl font-extrabold text-[var(--text)]">Profil Saya</h1>
                    <p class="text-[var(--text-3)] text-xs mt-1">Informasi akun pengguna dan keamanan kata sandi.</p>
                </div>

                <div class="bg-[var(--surface)] shadow-sm rounded-2xl border border-[var(--border)] overflow-hidden p-6 md:p-8 space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">Nama Lengkap</label>
                            <div class="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text)]">
                                ${user.name}
                            </div>
                        </div>
                        
                        <div>
                            <label class="block text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">Email Address (Permanen)</label>
                            <div class="bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-3 text-sm font-bold text-[var(--text)] flex items-center justify-between">
                                <span>${user.email}</span>
                                <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">TERVERIFIKASI</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="pt-6 border-t border-[var(--border)]">
                        <h4 class="text-base font-bold text-[var(--text)] mb-4">Ganti Kata Sandi</h4>
                        <form action="/member/change-password" method="POST" class="space-y-4 max-w-md">
                            <div>
                                <label class="block text-xs font-semibold text-[var(--text-2)] mb-1">Password Saat Ini</label>
                                <input type="password" name="current_password" placeholder="••••••••" required
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-xs text-[var(--text)] focus:border-[var(--brand)] outline-none transition-all">
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-[var(--text-2)] mb-1">Password Baru</label>
                                <input type="password" name="new_password" placeholder="••••••••" required
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-xs text-[var(--text)] focus:border-[var(--brand)] outline-none transition-all">
                            </div>
                            <button type="submit" class="bg-[var(--brand)] hover:opacity-90 text-white px-6 py-2.5 rounded-xl font-bold text-xs transition-opacity shadow-md">
                                Simpan Perubahan
                            </button>
                        </form>
                    </div>
                </div>
            </main>
        </div>
    </div>
    `;

    return baseLayout('Profil Akun', content);
};
