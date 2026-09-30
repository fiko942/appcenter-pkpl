
import { baseLayout } from './layout';
import { getAdminSidebar } from './components/admin-sidebar';

interface PayoutHistoryData {
    adminName: string;
    payouts: Array<{
        id: number;
        created: string; // Formatted date
        affiliate_email: string;
        amount: number;
        note: string | null;
        accepted_by: string;
    }>;
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
    filterEmail?: string;
    sort: string;
    order: string;
}

export const adminPayoutHistoryPage = (data: PayoutHistoryData): string => {
    const sidebar = getAdminSidebar('affiliate', { adminName: data.adminName });
    const formatIDR = (val: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);

    const filterBadge = data.filterEmail ? `
        <div class="flex items-center gap-2 bg-blue-500/10 border border-blue-500/20 px-3 py-1.5 rounded-lg text-sm text-blue-400">
            <span>Filter: <b>${data.filterEmail}</b></span>
            <a href="/admin/affiliate/history" class="hover:text-white transition-colors" title="Hapus Filter">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </a>
        </div>
    ` : '';

    const getSortIcon = (field: string) => {
        if (data.sort !== field) return `<svg class="w-3 h-3 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z"/></svg>`;
        return data.order === 'asc'
            ? `<svg class="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M5 15l5-5 5 5H5z"/></svg>`
            : `<svg class="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M15 5l-5 5-5-5h10z"/></svg>`;
    };

    const getSortUrl = (field: string) => {
        const newOrder = data.sort === field && data.order === 'asc' ? 'desc' : 'asc';
        return `/admin/affiliate/history?page=${data.pagination.page}${data.filterEmail ? `&email=${data.filterEmail}` : ''}&sort=${field}&order=${newOrder}`;
    };

    const rows = data.payouts.map(p => `
        <tr class="border-b border-white/5 hover:bg-white/5 transition-colors">
            <td class="px-6 py-4 font-mono text-xs text-gray-500">#${p.id}</td>
            <td class="px-6 py-4 text-sm text-gray-400">${p.created}</td>
            <td class="px-6 py-4 text-right font-bold text-emerald-400">${formatIDR(p.amount)}</td>
            <td class="px-6 py-4 text-sm text-gray-400 italic">${p.note || '-'}</td>
            <td class="px-6 py-4 text-xs text-gray-500 text-center uppercase tracking-wider">${p.accepted_by || 'System'}</td>
        </tr>
    `).join('');

    const content = `
    <div class="min-h-screen bg-gray-950">
        ${sidebar}
        
        <main class="ml-0 md:ml-64 p-4 sm:p-6 md:p-8 pt-16 md:pt-8 min-w-0">
            <div class="max-w-7xl mx-auto animate-fade-in">
                <!-- Header -->
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                    <div>
                        <div class="flex items-center gap-3">
                            <a href="/admin/affiliate" class="p-2 -ml-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-white/5">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                            </a>
                            <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Riwayat Pembayaran</h1>
                        </div>
                        <p class="text-gray-400 mt-1 ml-10 text-xs sm:text-sm">Log aktivitas pembayaran komisi affiliate.</p>
                    </div>
                </div>

                <!-- Filters -->
                 <div class="mb-6 flex items-center justify-between">
                    <div>
                        ${filterBadge}
                    </div>
                 </div>

                <!-- Table Card -->
                <div class="card overflow-hidden bg-gray-900/20 border-white/5">
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-white/5 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                                <tr>
                                    <th class="px-6 py-4">ID</th>
                                    <th class="px-6 py-4">
                                        <a href="${getSortUrl('created')}" class="flex items-center gap-2 hover:text-white transition-colors">
                                            Tanggal ${getSortIcon('created')}
                                        </a>
                                    </th>
                                    <th class="px-6 py-4 text-right">
                                        <a href="${getSortUrl('amount')}" class="flex items-center justify-end gap-2 hover:text-white transition-colors">
                                            Nominal ${getSortIcon('amount')}
                                        </a>
                                    </th>
                                    <th class="px-6 py-4">Catatan Admin</th>
                                    <th class="px-6 py-4 text-center">Diproses Oleh</th>
                                </tr>
                            </thead>
                            <tbody class="text-sm">
                                ${rows}
                                ${data.payouts.length === 0 ? `<tr><td colspan="5" class="px-6 py-20 text-center text-gray-500 italic">Belum ada riwayat pembayaran${data.filterEmail ? ' untuk filter ini' : ''}.</td></tr>` : ''}
                            </tbody>
                        </table>
                    </div>

                    <!-- Pagination -->
                    ${data.pagination.totalPages > 1 ? `
                    <div class="bg-gray-900/40 px-6 py-4 border-t border-white/5 flex items-center justify-between">
                         <div class="text-xs text-gray-500">
                            Hal ${data.pagination.page} dari ${data.pagination.totalPages}
                        </div>
                        <div class="flex gap-2">
                            ${data.pagination.page > 1 ? `
                                <a href="?page=${data.pagination.page - 1}${data.filterEmail ? `&email=${data.filterEmail}` : ''}&sort=${data.sort}&order=${data.order}" class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white transition-colors">Prev</a>
                            ` : ''}
                            ${data.pagination.page < data.pagination.totalPages ? `
                                <a href="?page=${data.pagination.page + 1}${data.filterEmail ? `&email=${data.filterEmail}` : ''}&sort=${data.sort}&order=${data.order}" class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white transition-colors">Next</a>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </main>
    </div>
    `;

    return baseLayout('Riwayat Pembayaran', content);
};
