import { baseLayout } from './layout';
import { getMemberSidebar } from './components/member-sidebar';

interface EditMachineData {
    name: string;
    email: string;
    avatar?: string;
    deviceId: number;
    currentMachineId: string;
    productName: string;
}

export const memberDeviceEditPage = (data: EditMachineData, error?: string) => {
    const sidebar = getMemberSidebar('licenses', {
        name: data.name,
        email: data.email,
        avatar: data.avatar
    });

    const editContent = `
        <div class="max-w-2xl mx-auto space-y-6">
            <div>
                <h1 class="text-2xl font-extrabold text-[var(--text)]">Change Machine ID</h1>
                <p class="text-[var(--text-3)] text-xs mt-1">Perbarui Machine ID perangkat yang terhubung dengan lisensi aplikasi Anda.</p>
            </div>

            <div class="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
                <div class="p-6 border-b border-[var(--border)] bg-[var(--surface-2)]">
                    <h2 class="text-base font-bold text-[var(--text)]">Detail Lisensi</h2>
                </div>
                
                <form action="/member/device/${data.deviceId}/edit-machine" method="POST" class="p-6 space-y-5">
                    ${error ? `
                        <div class="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-center gap-3 text-red-500 text-xs font-semibold">
                            <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ${error}
                        </div>
                    ` : ''}

                    <div>
                        <label class="block text-xs font-semibold text-[var(--text-3)] mb-1.5 uppercase tracking-wider">Nama Produk</label>
                        <div class="px-4 py-3 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-[var(--text)] font-bold text-sm">
                            ${data.productName}
                        </div>
                    </div>

                    <div>
                        <label for="machine_id" class="block text-xs font-semibold text-[var(--text-3)] mb-1.5 uppercase tracking-wider">Machine ID Baru</label>
                        <input type="text" 
                            name="machine_id" 
                            id="machine_id"
                            value="${data.currentMachineId}"
                            class="w-full px-4 py-2.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-[var(--text)] placeholder-[var(--text-3)] focus:border-[var(--brand)] outline-none font-mono text-xs font-semibold transition-all"
                            placeholder="Enter new Machine ID"
                            required
                        >
                        <p class="mt-2 text-[11px] text-[var(--text-3)]">
                            Masukkan kode Machine ID unik dari perangkat komputer Anda untuk mengaktifkan lisensi ini.
                        </p>
                    </div>

                    <div class="pt-4 flex items-center justify-end gap-3 border-t border-[var(--border)]">
                        <a href="/member/licenses" class="px-5 py-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] hover:bg-[var(--surface)] text-[var(--text-2)] text-xs font-bold transition-all">
                            Batal
                        </a>
                        <button type="submit" class="px-5 py-2.5 rounded-xl bg-[var(--brand)] hover:opacity-90 text-white text-xs font-bold transition-opacity shadow-md">
                            Simpan Perubahan
                        </button>
                    </div>
                </form>
            </div>
        </div>
    `;

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
                    <span class="eyebrow">EDIT PERANGKAT LISENSI</span>
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

            <main class="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
                ${editContent}
            </main>
        </div>
    </div>
    `;

    return baseLayout('Change Machine ID', content);
};
