import { baseLayout } from './layout';
import { getAdminSidebar } from './components/admin-sidebar';

interface AffiliateAdminOptions {
    adminName: string;
    stats: {
        totalPaid: number;
        totalUnpaid: number;
        incomeThisMonth: number;
        incomeLastMonth: number;
        betterCount: number;
        worseCount: number;
        overallTrend: string;
        overallPercentage: number;
    };
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
    members: any[];
    search: string;
    sort: string;
    order: string;
}

export const adminAffiliatePage = (options: AffiliateAdminOptions): string => {
    const formatIDR = (amount: number) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
    const sidebar = getAdminSidebar('affiliate', { adminName: options.adminName });

    // Helper to generate pagination URLs
    const getPageUrl = (page: number) => {
        return `/admin/affiliate?page=${page}&search=${options.search}&sort=${options.sort}&order=${options.order}`;
    };

    const statsCards = `
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-8">
            <div class="card p-5 border-l-4 border-blue-500 bg-gray-900/40 hover:bg-gray-900/60 transition-colors">
                <div class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Total Telah Dibayar</div>
                <div class="text-lg font-black text-white truncate" title="${formatIDR(options.stats.totalPaid)}">${formatIDR(options.stats.totalPaid)}</div>
            </div>

            <div class="card p-5 border-l-4 border-amber-500 bg-gray-900/40 hover:bg-gray-900/60 transition-colors">
                <div class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Total Belum Dibayar</div>
                <div class="text-lg font-black text-amber-500 truncate" title="${formatIDR(options.stats.totalUnpaid)}">${formatIDR(options.stats.totalUnpaid)}</div>
            </div>
            
            <div class="card p-5 border-l-4 ${options.stats.overallTrend === 'UP' ? 'border-emerald-500' : (options.stats.overallTrend === 'DOWN' ? 'border-red-500' : 'border-gray-500')} bg-gray-900/40 hover:bg-gray-900/60 transition-colors">
                <div class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Tren Performa</div>
                <div class="flex items-center justify-between">
                     <div class="text-xl font-black ${options.stats.overallTrend === 'UP' ? 'text-emerald-400' : (options.stats.overallTrend === 'DOWN' ? 'text-red-400' : 'text-gray-400')}">
                        ${options.stats.overallTrend === 'UP' ? 'NAIK' : (options.stats.overallTrend === 'DOWN' ? 'TURUN' : 'STABIL')}
                    </div>
                     <span class="text-xs font-bold ${options.stats.overallTrend === 'UP' ? 'text-emerald-400' : (options.stats.overallTrend === 'DOWN' ? 'text-red-400' : 'text-gray-400')}">
                       ${options.stats.overallTrend === 'UP' ? '▲' : (options.stats.overallTrend === 'DOWN' ? '▼' : '-')} ${options.stats.overallPercentage}%
                     </span>
                </div>
                 <div class="text-[9px] text-gray-500 mt-2 flex flex-col gap-0.5">
                    <span>Ini: ${formatIDR(options.stats.incomeThisMonth)}</span>
                    <span>Lalu: ${formatIDR(options.stats.incomeLastMonth)}</span>
                </div>
            </div>

            <div class="card p-5 border-l-4 border-emerald-500 bg-gray-900/40 hover:bg-gray-900/60 transition-colors">
                <div class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Affiliator Meningkat</div>
                <div class="flex items-center gap-2">
                    <div class="text-2xl font-black text-white">${options.stats.betterCount}</div>
                    <div class="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">Orang</div>
                </div>
                <div class="text-[10px] text-gray-500 mt-1">Lebih baik dr bln lalu</div>
            </div>

            <div class="card p-5 border-l-4 border-red-500 bg-gray-900/40 hover:bg-gray-900/60 transition-colors">
                <div class="text-gray-400 text-[10px] font-bold uppercase tracking-wider mb-2">Affiliator Menurun</div>
                <div class="flex items-center gap-2">
                    <div class="text-2xl font-black text-white">${options.stats.worseCount}</div>
                    <div class="text-[10px] text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded">Orang</div>
                </div>
                <div class="text-[10px] text-gray-500 mt-1">Lebih rendah dr bln lalu</div>
            </div>
        </div>
    `;

    const formatDate = (epoch: number) => {
        if (!epoch) return '-';
        return new Date(epoch * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    const getSortIcon = (field: string) => {
        if (options.sort !== field) return `<svg class="w-3 h-3 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z"/></svg>`;
        return options.order === 'asc'
            ? `<svg class="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M5 15l5-5 5 5H5z"/></svg>`
            : `<svg class="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M15 5l-5 5-5-5h10z"/></svg>`;
    };

    const getSortUrl = (field: string) => {
        const newOrder = options.sort === field && options.order === 'asc' ? 'desc' : 'asc';
        return `/admin/affiliate?search=${options.search}&sort=${field}&order=${newOrder}`;
    };

    const tableRows = options.members.map(m => `
        <tr id="row-${m.id}" class="border-b border-white/5 hover:bg-white/5 transition-colors group cursor-pointer" onclick="toggleExpand('${m.id}')">
            <td class="px-6 py-4">
                <div class="flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-xs">
                        ${m.email.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="font-bold text-white">${m.email}</div>
                        <div class="text-[10px] text-gray-500">Kupon: <span class="text-gray-300">${m.kupon}</span></div>
                    </div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs">
                    <div class="text-white font-medium">${m.bank_name || '-'}</div>
                    <div class="text-gray-500">${m.no_rek || '-'}</div>
                    <div class="text-[10px] text-gray-400 uppercase tracking-tighter">${m.owner_name || '-'}</div>
                </div>
            </td>
            <td class="px-6 py-4">
                <div class="text-xs text-gray-400">${formatDate(m.memberSince)}</div>
            </td>
            <td class="px-6 py-4 text-right">
                <div class="text-xs font-bold text-gray-400">${formatIDR(m.incomeLastMonth)}</div>
            </td>
            <td class="px-6 py-4 text-right">
                <div id="pending-amount-${m.id}" class="font-black text-amber-500">${formatIDR(m.pendingCommission)}</div>
                <div id="pending-count-${m.id}" class="text-[10px] text-gray-500">${m.unpaidCount} transaksi</div>
                <div class="text-[10px] flex items-center justify-end gap-1 ${m.trend === 'UP' ? 'text-emerald-500' : (m.trend === 'DOWN' ? 'text-red-500' : 'text-gray-500')} mt-1">
                    ${m.trend === 'UP' ? '▲' : (m.trend === 'DOWN' ? '▼' : '-')} ${m.trend === 'SAME' ? 'Stabil' : m.percentageChange + '%'}
                </div>
            </td>
            <td class="px-6 py-4 text-center">
                <div class="flex items-center justify-center gap-2">
                    ${m.pendingCommission > 0 ? `
                    <div id="btn-pay-row-${m.id}" class="relative group/tooltip">
                        <button onclick="openPayModal('${m.email}', '${m.id}', ${m.pendingCommission}, event)" class="p-2 bg-green-500/10 hover:bg-green-500/20 text-green-500 rounded-lg transition-colors relative">
                             <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </button>
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-gray-900/95 backdrop-blur text-white text-[10px] rounded-lg shadow-xl border border-white/10 whitespace-nowrap z-50">
                            Tandai Semua Komisi Tertunda Sudah Dibayar
                            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95"></div>
                        </div>
                    </div>
                    ` : ''}
                    <div class="relative group/tooltip">
                        <a href="/admin/affiliate/history?email=${m.email}" class="block p-2 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </a>
                        <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-gray-900/95 backdrop-blur text-white text-[10px] rounded-lg shadow-xl border border-white/10 whitespace-nowrap z-50">
                            Lihat Riwayat Pembayaran
                            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95"></div>
                        </div>
                    </div>

                    <div class="relative group/tooltip p-2 text-gray-500 group-hover:text-white transition-transform duration-300">
                        <svg id="icon-${m.id}" class="w-5 h-5 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                         <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/tooltip:block px-2 py-1 bg-gray-900/95 backdrop-blur text-white text-[10px] rounded-lg shadow-xl border border-white/10 whitespace-nowrap z-50 pointer-events-none">
                            Klik baris untuk lihat detail
                            <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900/95"></div>
                        </div>
                    </div>
                </div>
            </td>
        </tr>
        <tr id="expand-${m.id}" class="hidden bg-black/40">
            <td colspan="6" class="px-0 py-0">
                <div class="px-8 py-6">
                    <div class="border-l-2 border-blue-500/30 pl-6">
                        <div class="flex items-center justify-between mb-4">
                            <h4 class="text-xs font-bold text-gray-400 uppercase tracking-widest">Rincian Transaksi Belum Dibayar</h4>
                            ${m.pendingCommission > 0 ? `
                            <button id="btn-pay-details-${m.id}" onclick="openPayModal('${m.email}', '${m.id}', ${m.pendingCommission}, event)" class="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg transition-colors text-[10px] font-bold uppercase tracking-wider border border-green-500/20">
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                                Tandai Sudah Dibayar
                            </button>
                            ` : ''}
                        </div>
                        <div class="overflow-x-auto rounded-xl border border-white/5">
                            <table class="w-full text-left text-xs">
                                <thead class="bg-white/5 text-gray-400">
                                    <tr>
                                        <th class="px-4 py-2">Produk</th>
                                        <th class="px-4 py-2">Invoice</th>
                                        <th class="px-4 py-2 text-right">Komisi</th>
                                        <th class="px-4 py-2 text-right">Tanggal</th>
                                    </tr>
                                </thead>
                                <tbody id="transactions-${m.id}">
                                    ${m.unpaidTransactions.map((t: any) => `
                                        <tr class="border-b border-white/5">
                                            <td class="px-4 py-3 text-white">${t.product_name}</td>
                                            <td class="px-4 py-3 font-mono text-gray-400">${t.invoice_code}</td>
                                            <td class="px-4 py-3 text-right font-bold text-emerald-400">${formatIDR(t.affiliate_income)}</td>
                                            <td class="px-4 py-3 text-right text-gray-500">${new Date(t.created_at * 1000).toLocaleDateString('id-ID')}</td>
                                        </tr>
                                    `).join('')}
                                    ${m.unpaidTransactions.length === 0 ? '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500 italic">Tidak ada transaksi tertunda.</td></tr>' : ''}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </td>
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
                        <h1 class="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Affiliate Management</h1>
                        <p class="text-gray-400 mt-1 text-xs sm:text-sm">Kelola data affiliator dan pembayaran komisi.</p>
                    </div>
                </div>

                ${statsCards}

                <div class="card overflow-hidden bg-gray-900/20 border-white/5 relative">
                    <div class="p-4 sm:p-6 border-b border-white/5 flex flex-col md:flex-row justify-between items-center gap-4">
                        <h2 class="text-lg font-bold text-white">Daftar Member Affiliate</h2>
                        <form class="flex items-center gap-2 w-full md:w-auto">
                            <input type="text" name="search" value="${options.search}" placeholder="Cari email, bank, atau kupon..." class="input-dark-premium px-4 py-2 rounded-xl text-sm outline-none w-full md:w-64 bg-black/40 border-white/10 text-white">
                            <button type="submit" class="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl transition-colors">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                            </button>
                        </form>
                    </div>
                    
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                            <thead class="bg-white/5 text-gray-400 text-[10px] uppercase tracking-widest font-bold">
                                <tr>
                                    <th class="px-6 py-4">
                                        <a href="${getSortUrl('email')}" class="flex items-center gap-2 hover:text-white transition-colors">
                                            Affiliator ${getSortIcon('email')}
                                        </a>
                                    </th>
                                    <th class="px-6 py-4">Data Bank</th>
                                    <th class="px-6 py-4">
                                        <a href="${getSortUrl('memberSince')}" class="flex items-center gap-2 hover:text-white transition-colors">
                                            Bergabung ${getSortIcon('memberSince')}
                                        </a>
                                    </th>
                                    <th class="px-6 py-4 text-right">
                                        <a href="${getSortUrl('incomeLastMonth')}" class="flex items-center justify-end gap-2 hover:text-white transition-colors">
                                            Komisi Bulan Lalu ${getSortIcon('incomeLastMonth')}
                                        </a>
                                    </th>
                                    <th class="px-6 py-4 text-right">
                                        <a href="${getSortUrl('pendingCommission')}" class="flex items-center justify-end gap-2 hover:text-white transition-colors">
                                            Komisi Tertunda ${getSortIcon('pendingCommission')}
                                        </a>
                                    </th>
                                    <th class="px-6 py-4 text-center">Aksi</th>
                                </tr>
                            </thead>
                            <tbody class="text-sm">
                                ${tableRows}
                                ${options.members.length === 0 ? '<tr><td colspan="6" class="px-6 py-20 text-center text-gray-500 italic">Data tidak ditemukan.</td></tr>' : ''}
                            </tbody>
                        </table>
                    </div>
                    
                     <!-- Pagination -->
                    ${options.pagination.totalPages > 1 ? `
                    <div class="bg-gray-900/40 px-6 py-4 border-t border-white/5 flex items-center justify-between">
                            <div class="text-xs text-gray-500">
                            Hal ${options.pagination.page} dari ${options.pagination.totalPages} (Total ${options.pagination.total} Affiliator)
                        </div>
                        <div class="flex gap-2">
                            ${options.pagination.page > 1 ? `
                                <a href="${getPageUrl(options.pagination.page - 1)}" class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white transition-colors">Prev</a>
                            ` : ''}
                            ${options.pagination.page < options.pagination.totalPages ? `
                                <a href="${getPageUrl(options.pagination.page + 1)}" class="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-xs text-white transition-colors">Next</a>
                            ` : ''}
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </main>

        <!-- Payment Confirmation Modal -->
        <div id="payment-modal" class="fixed inset-0 z-50 hidden">
            <!-- Backdrop -->
            <div class="absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity opacity-0" id="payment-modal-backdrop"></div>
            
            <!-- Modal Content -->
            <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md p-4 transition-all scale-95 opacity-0" id="payment-modal-content">
                <div class="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
                    <div class="p-6">
                        <div class="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center mb-4 text-green-500 mx-auto">
                            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                        </div>
                        <h3 class="text-xl font-bold text-white text-center mb-2">Konfirmasi Pembayaran</h3>
                        <p class="text-gray-400 text-sm text-center mb-6">
                            Anda akan menandai komisi untuk <span id="modal-email" class="text-white font-bold"></span> sebesar <span id="modal-amount" class="text-emerald-400 font-bold"></span> sebagai sudah dibayar. Action ini tidak dapat dibatalkan.
                        </p>
                        
                        <div class="flex gap-3">
                            <button onclick="closePayModal()" class="flex-1 py-2.5 px-4 bg-gray-800 hover:bg-gray-700 text-white text-sm font-medium rounded-xl transition-colors">
                                Batal
                            </button>
                            <button id="btn-confirm-pay" onclick="confirmPayment()" class="flex-1 py-2.5 px-4 bg-green-600 hover:bg-green-500 text-white text-sm font-bold rounded-xl shadow-lg shadow-green-500/20 transition-all">
                                Ya, Sudah Dibayar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    `;

    const scripts = `
        <script>
        let currentPayEmail = '';
        let currentPayId = '';
        
        function openPayModal(email, id, amount, event) {
            if(event) event.stopPropagation();
            
            currentPayEmail = email;
            currentPayId = id;
            
            document.getElementById('modal-email').textContent = email;
            document.getElementById('modal-amount').textContent = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
            
            const modal = document.getElementById('payment-modal');
            const backdrop = document.getElementById('payment-modal-backdrop');
            const content = document.getElementById('payment-modal-content');
            
            modal.classList.remove('hidden');
            // Small delay for transition
            setTimeout(() => {
                backdrop.classList.remove('opacity-0');
                content.classList.remove('scale-95', 'opacity-0');
                content.classList.add('scale-100', 'opacity-100');
            }, 10);
        }

        function closePayModal() {
            const modal = document.getElementById('payment-modal');
            const backdrop = document.getElementById('payment-modal-backdrop');
            const content = document.getElementById('payment-modal-content');
            
            backdrop.classList.add('opacity-0');
            content.classList.remove('scale-100', 'opacity-100');
            content.classList.add('scale-95', 'opacity-0');
            
            setTimeout(() => {
                modal.classList.add('hidden');
            }, 300);
        }

        function toggleExpand(id) {
            const row = document.getElementById('expand-' + id);
            const icon = document.getElementById('icon-' + id);
            const isHidden = row.classList.contains('hidden');

            // Close all others
            document.querySelectorAll('[id^="expand-"]').forEach(el => el.classList.add('hidden'));
            document.querySelectorAll('[id^="icon-"]').forEach(el => el.classList.remove('rotate-180'));

            if (isHidden) {
                row.classList.remove('hidden');
                icon.classList.add('rotate-180');
            }
        }

        function confirmPayment() {
            const btn = document.getElementById('btn-confirm-pay');
            const originalText = btn.innerHTML;
            btn.innerHTML = '<span class="animate-spin inline-block w-4 h-4 border-2 border-white/20 border-t-white rounded-full mr-2"></span> Proses...';
            btn.disabled = true;

            fetch('/admin/affiliate/mark-paid', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: currentPayEmail })
            })
            .then(res => res.json())
            .then(data => {
                if (data.success) {
                    closePayModal();
                    
                    // Update UI without Refresh
                    const id = currentPayId;
                    
                    // 1. Update Amount & Count
                    const amountEl = document.getElementById('pending-amount-' + id);
                    const countEl = document.getElementById('pending-count-' + id);
                    
                    if(amountEl) amountEl.textContent = 'Rp 0';
                    if(countEl) countEl.textContent = '0 transaksi';
                    
                    // 2. Remove Buttons
                    const btnRow = document.getElementById('btn-pay-row-' + id);
                    if(btnRow) btnRow.remove();
                    
                    const btnDetails = document.getElementById('btn-pay-details-' + id);
                    if(btnDetails) btnDetails.remove();
                    
                    // 3. Clear Table
                    const tbody = document.getElementById('transactions-' + id);
                    if(tbody) tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-8 text-center text-gray-500 italic">Tidak ada transaksi tertunda.</td></tr>';
                    
                    // Optional: Show success toast (not implemented yet, but good to have)
                } else {
                    alert('Gagal: ' + (data.error || 'Terjadi kesalahan'));
                }
            })
            .catch(err => {
                console.error(err);
                alert('Terjadi kesalahan koneksi');
            })
            .finally(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            });
        }
    </script>
        <style>
            .input-dark-premium {
                border: 1px solid rgba(255, 255, 255, 0.05);
                transition: all 0.3s ease;
            }
            .input-dark-premium:focus {
                border-color: #3b82f6;
                box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
            }
            .rotate-180 { transform: rotate(180deg); }
        </style>
    `;

    return baseLayout('Affiliate Management', content, scripts);
};
