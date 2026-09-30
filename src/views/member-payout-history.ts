import { baseLayout } from './layout';
import { getMemberSidebar } from './components/member-sidebar';

interface MemberData {
    name: string;
    email: string;
    avatar?: string;
}

export interface PayoutHistoryRecord {
    id: string | number;
    created: number;
    amount: number;
    status: 'paid' | 'pending';
    note: string;
}

interface PayoutPageOptions {
    page: number;
    pageSize: number;
    totalPayouts: number;
    sort: string;
    order: string;
}

function formatDate(epoch: number): string {
    if (!epoch || epoch <= 0) return '-';
    const d = new Date(epoch * 1000);
    return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const memberPayoutHistoryPage = (user: MemberData, records: PayoutHistoryRecord[], options: PayoutPageOptions): string => {
    const sidebar = getMemberSidebar('affiliate', user);
    const { page, pageSize, totalPayouts } = options;
    const totalPages = Math.ceil(totalPayouts / pageSize);

    let pagination = '';
    if (totalPages > 1) {
        pagination = `<div class="flex gap-2 justify-center p-4 border-t border-[var(--border)] bg-[var(--surface-2)]">
            ${page > 1 ? `<a href="?page=${page - 1}" class="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--brand)] text-xs font-bold transition-all">&laquo; Prev</a>` : ''}
            <span class="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] text-[var(--text-2)] border border-[var(--border)] text-xs font-bold">${page} / ${totalPages}</span>
            ${page < totalPages ? `<a href="?page=${page + 1}" class="px-3.5 py-1.5 rounded-xl bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--brand)] text-xs font-bold transition-all">Next &raquo;</a>` : ''}
        </div>`;
    }

    let tableContent = '';
    if (!records || records.length === 0) {
        tableContent = `
            <div class="p-12 text-center text-[var(--text-3)]">
                <svg class="w-12 h-12 mx-auto mb-3 text-[var(--text-3)] opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 class="text-base font-bold text-[var(--text)] mb-1">Belum ada riwayat</h3>
                <p class="text-xs">Riwayat komisi dan penarikan akan muncul di sini.</p>
            </div>
        `;
    } else {
        tableContent = `
            <div class="overflow-x-auto">
                <table class="w-full text-xs text-left">
                    <thead class="bg-[var(--surface-2)] text-[var(--text-2)] uppercase font-bold border-b border-[var(--border)]">
                        <tr>
                            <th class="px-5 py-3.5 text-center">No</th>
                            <th class="px-5 py-3.5">
                                <a href="?sort=created&order=${options.sort === 'created' && options.order === 'desc' ? 'asc' : 'desc'}" class="flex items-center gap-1 hover:text-[var(--brand)] transition-colors group">
                                    Tanggal
                                    <div class="flex flex-col -space-y-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <svg class="w-2 h-2 ${options.sort === 'created' && options.order === 'asc' ? 'text-[var(--brand)]' : 'text-[var(--text-3)]'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16l-8-8z"/></svg>
                                        <svg class="w-2 h-2 ${options.sort === 'created' && options.order === 'desc' ? 'text-[var(--brand)]' : 'text-[var(--text-3)]'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4l8 8z"/></svg>
                                    </div>
                                </a>
                            </th>
                            <th class="px-5 py-3.5">
                                <a href="?sort=amount&order=${options.sort === 'amount' && options.order === 'desc' ? 'asc' : 'desc'}" class="flex items-center gap-1 hover:text-[var(--brand)] transition-colors group">
                                    Nominal
                                    <div class="flex flex-col -space-y-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <svg class="w-2 h-2 ${options.sort === 'amount' && options.order === 'asc' ? 'text-[var(--brand)]' : 'text-[var(--text-3)]'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16l-8-8z"/></svg>
                                        <svg class="w-2 h-2 ${options.sort === 'amount' && options.order === 'desc' ? 'text-[var(--brand)]' : 'text-[var(--text-3)]'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4l8 8z"/></svg>
                                    </div>
                                </a>
                            </th>
                            <th class="px-5 py-3.5 text-center">Status</th>
                            <th class="px-5 py-3.5">Keterangan</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[var(--border)]">
                        ${records.map((r, idx) => `
                            <tr class="hover:bg-[var(--surface-2)]/50 transition-colors">
                                <td class="px-5 py-4 text-center font-semibold text-[var(--text-3)]">${(page - 1) * pageSize + idx + 1}</td>
                                <td class="px-5 py-4 text-[var(--text-2)] font-medium">${r.id === 'pending-summary' ? '-' : formatDate(r.created)}</td>
                                <td class="px-5 py-4 font-extrabold ${r.status === 'paid' ? 'text-emerald-500' : 'text-amber-500'}">
                                    Rp ${r.amount.toLocaleString('id-ID')}
                                </td>
                                <td class="px-5 py-4 text-center">
                                    ${r.status === 'paid'
                ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">PAID</span>`
                : `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/20">PENDING</span>`
            }
                                </td>
                                <td class="px-5 py-4 text-[var(--text-3)] text-xs font-medium">${r.note || '-'}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

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
                    <span class="eyebrow">RIWAYAT PAYOUT AFFILIATE</span>
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
                <div class="flex items-center gap-3">
                    <a href="/member/affiliate" class="p-2 hover:bg-[var(--surface-2)] rounded-xl transition-colors text-[var(--text-3)] hover:text-[var(--text)] border border-[var(--border)]">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                    </a>
                    <div>
                        <h1 class="text-2xl font-extrabold text-[var(--text)]">Riwayat Penarikan</h1>
                        <p class="text-[var(--text-3)] text-xs mt-1">Daftar komisi (Pending) dan penarikan yang telah dibayar (Paid).</p>
                    </div>
                </div>

                <div class="bg-[var(--surface)] shadow-sm rounded-2xl border border-[var(--border)] overflow-hidden">
                    <div class="p-4 border-b border-[var(--border)] bg-[var(--surface-2)] flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <h2 class="text-base font-bold text-[var(--text)]">Data Penarikan</h2>
                        <div class="flex gap-4">
                            <div class="flex items-center gap-2">
                                <div class="w-2 h-2 rounded-full bg-amber-500"></div>
                                <span class="text-[10px] text-[var(--text-3)] uppercase font-bold">Pending = Komisi Belum Ditransfer</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <div class="w-2 h-2 rounded-full bg-emerald-500"></div>
                                <span class="text-[10px] text-[var(--text-3)] uppercase font-bold">Paid = Sudah Ditransfer</span>
                            </div>
                        </div>
                    </div>
                    ${tableContent}
                    ${pagination}
                </div>
            </main>
        </div>
    </div>
    `;

    return baseLayout('Affiliate Payout History', content);
};
