import { baseLayout } from './layout';
import { getMemberSidebar } from './components/member-sidebar';

interface MemberData {
    name: string;
    email: string;
    avatar?: string;
}

export interface AffiliateTransaction {
    id: number;
    created_at: number;
    product_name: string;
    customer_email: string;
    customer_name: string;
    customer_paid_price: number;
    affiliate_income: number;
    invoice_code: string;
    duration?: string;
}

export interface AffiliateProfile {
    kupon: string;
    created: number;
    payout_bank_name?: string;
    payout_no_rek?: string;
    payout_name?: string;
}

interface AffiliatePageOptions {
    page: number;
    pageSize: number;
    totalTransactions: number;
    search: string;
    sort: string;
    order: string;
    totalIncome: number;
    totalPending?: number;
    profile?: AffiliateProfile;
    lastPayout?: {
        amount: number;
        created: number;
    };
    // Enrollment Gate
    isEnrolled: boolean;
    isEligible?: boolean;
    ordersCount?: number;
    requiredOrders?: number;
}

function formatDate(epoch: number): string {
    const d = new Date(epoch * 1000);
    return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const memberAffiliatePage = (user: MemberData, transactions: AffiliateTransaction[], options: AffiliatePageOptions): string => {
    const sidebar = getMemberSidebar('affiliate', user);
    const { page, pageSize, totalTransactions, search, sort, order, totalIncome } = options;
    const totalPages = Math.ceil(totalTransactions / pageSize);

    const filterForm = `
        <form method="GET" action="/member/affiliate" class="flex flex-col md:flex-row gap-4 mb-6 items-center bg-gray-900 p-4 rounded-xl shadow">
            <div class="flex flex-col md:flex-row gap-4 w-full">
                <input type="text" name="search" value="${search}" placeholder="Cari email, invoice, produk..." class="input-dark px-4 py-2 rounded-lg text-white w-full md:w-64" />
                <div class="flex gap-2">
                    <select name="sort" class="input-dark px-4 py-2 rounded-lg text-white">
                        <option value="created_at" ${sort === 'created_at' ? 'selected' : ''}>Tanggal</option>
                        <option value="affiliate_income" ${sort === 'affiliate_income' ? 'selected' : ''}>Komisi</option>
                    </select>
                    <select name="order" class="input-dark px-4 py-2 rounded-lg text-white">
                        <option value="desc" ${order === 'desc' ? 'selected' : ''}>Terbaru</option>
                        <option value="asc" ${order === 'asc' ? 'selected' : ''}>Terlama</option>
                    </select>
                </div>
                <button type="submit" class="btn-primary px-6 py-2 rounded-lg font-bold">Filter</button>
            </div>
        </form>
    `;

    const statsHeader = `
        <div class="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
            <!-- Coupon Card -->
            <div class="card p-5 flex flex-col h-full bg-gray-900/40 border-white/5 hover:border-blue-500/30 transition-all group">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <svg class="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4v-3a2 2 0 00-2-2H5z" />
                        </svg>
                    </div>
                    <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Kupon</span>
                    <button onclick="openCouponModal()" class="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded" title="Ubah Kupon">
                        <svg class="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                        </svg>
                    </button>
                </div>
                <div class="flex items-center justify-between gap-2 mt-auto">
                    <span id="displayCoupon" class="text-xl font-bold text-white font-mono truncate select-all">${options.profile?.kupon || '-'}</span>
                    <button onclick="copyToClipboard('${options.profile?.kupon || ''}')" class="p-1.5 hover:bg-white/10 rounded-md transition-colors" title="Copy">
                        <svg class="w-4 h-4 text-gray-400 group-hover:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                        </svg>
                    </button>
                </div>
                ${options.profile?.created ? `<div class="text-[10px] text-gray-500 mt-1">Sejak ${new Date(options.profile.created * 1000).toLocaleDateString('id-ID')}</div>` : ''}
            </div>

            <!-- Bank Info Card -->
            <div class="card p-5 flex flex-col h-full bg-gray-900/40 border-white/5 hover:border-blue-500/30 transition-all group cursor-pointer" onclick="openPayoutModal()">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-8 h-8 rounded-lg bg-orange-500/10 flex items-center justify-center">
                        <svg class="w-4 h-4 text-orange-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                        </svg>
                    </div>
                    <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Bank</span>
                    <svg class="w-3 h-3 text-gray-500 ml-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                </div>
                <div class="mt-auto">
                    <div class="text-lg font-bold text-white leading-none">${options.profile?.payout_bank_name || 'Set Bank'}</div>
                    <div class="text-xs text-gray-400 mt-1 font-mono">${options.profile?.payout_no_rek || '-'}</div>
                    <div class="text-[9px] text-gray-500 uppercase tracking-widest mt-0.5 truncate">${options.profile?.payout_name || '-'}</div>
                </div>
            </div>

            <!-- Transaction Count -->
            <div class="card p-5 flex flex-col h-full bg-gray-900/40 border-white/5">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center">
                        <svg class="w-4 h-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                        </svg>
                    </div>
                    <span class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Order</span>
                </div>
                <div class="mt-auto">
                    <div class="text-3xl font-bold text-white">${totalTransactions}</div>
                    <div class="text-[10px] text-gray-500 mt-1 uppercase tracking-wider">Total Referral</div>
                </div>
            </div>

            <!-- Income -->
            <div class="card p-5 flex flex-col h-full bg-emerald-500/5 border-emerald-500/10">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                        <svg class="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M12 16V15" />
                        </svg>
                    </div>
                    <span class="text-xs font-semibold text-emerald-500/70 uppercase tracking-wider">Komisi</span>
                </div>
                <div class="mt-auto">
                    <div class="text-2xl font-bold text-emerald-400">Rp ${totalIncome.toLocaleString('id-ID')}</div>
                    <div class="text-[10px] text-emerald-500/50 mt-1 uppercase tracking-wider">Total Pendapatan</div>
                </div>
            </div>

            <!-- Last Payout Card -->
            <div class="card p-5 flex flex-col h-full bg-blue-500/5 border-blue-500/10">
                <div class="flex items-center gap-2 mb-3">
                    <div class="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                        <svg class="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                    </div>
                    <span class="text-xs font-semibold text-blue-500/70 uppercase tracking-wider">Payout</span>
                </div>
                <div class="mt-auto">
                    ${options.lastPayout ? `
                        <div class="text-xl font-bold text-blue-400 leading-none">Rp ${options.lastPayout.amount.toLocaleString('id-ID')}</div>
                        <div class="text-[10px] text-blue-500/50 mt-2 uppercase tracking-wider">${new Date(options.lastPayout.created * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</div>
                    ` : `
                        <div class="text-lg font-bold text-gray-600 italic">Belum Ada</div>
                        <div class="text-[10px] text-gray-700 mt-2 uppercase tracking-wider">Riwayat Penarikan</div>
                    `}
                </div>
                <div class="mt-4 pt-3 border-t border-blue-500/10 flex justify-end">
                    <a href="/member/affiliate/payouts" class="text-[10px] font-bold text-blue-400/80 hover:text-blue-300 transition-colors flex items-center gap-1 group">
                        LIHAT RIWAYAT
                        <svg class="w-3 h-3 group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </a>
                </div>
            </div>
        </div>
    `;

    let pagination = '';
    if (totalPages > 1) {
        pagination = `<div class="flex gap-2 mt-6 justify-center p-4">
            ${page > 1 ? `<a href="?page=${page - 1}&search=${search}&sort=${sort}&order=${order}" class="btn-primary px-3 py-1 rounded">&laquo; Prev</a>` : ''}
            <span class="px-3 py-1 rounded bg-gray-900 text-white">${page} / ${totalPages}</span>
            ${page < totalPages ? `<a href="?page=${page + 1}&search=${search}&sort=${sort}&order=${order}" class="btn-primary px-3 py-1 rounded">Next &raquo;</a>` : ''}
        </div>`;
    }

    // Performance Report Logic
    const totalPending = options.totalPending || 0;
    const lastPayoutAmount = options.lastPayout?.amount || 0;
    let performanceHeading = '';
    let performanceMessage = '';
    let performanceColorClass = '';
    let performanceIcon = '';
    let performanceBadge = '';

    if (lastPayoutAmount === 0) {
        performanceHeading = `Ayo jemput komisi pertamamu!`;
        performanceMessage = `Saat ini kamu punya <b>Rp ${totalPending.toLocaleString('id-ID')}</b> yang siap dicairkan. Yuk sebar kupon lagi, dikit lagi bisa buat jajan enak nih! ✨`;
        performanceColorClass = 'bg-blue-600/10 border-blue-500/20 text-blue-400';
        performanceIcon = `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>`;
        performanceBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-blue-500/20 border border-blue-500/30">NEW START</span>`;
    } else if (totalPending > lastPayoutAmount) {
        const percent = Math.round(((totalPending - lastPayoutAmount) / lastPayoutAmount) * 100);
        performanceHeading = `Rekor Terpecahkan! 🔥`;
        performanceMessage = `Mantap bosku! Komisi kamu (<b>Rp ${totalPending.toLocaleString('id-ID')}</b>) udah ngelewatin pencairan terakhir (<b>Rp ${lastPayoutAmount.toLocaleString('id-ID')}</b>). Ada kenaikan sekitar <b>${percent}%</b> nih, gila keren banget! 🚀`;
        performanceColorClass = 'bg-emerald-600/10 border-emerald-500/20 text-emerald-400';
        performanceIcon = `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 11l3-3m0 0l3 3m-3-3v8m0-13a9 9 0 110 18 9 9 0 010-18z" /></svg>`;
        performanceBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-emerald-500/20 border border-emerald-500/30">UP ${percent}%</span>`;
    } else if (totalPending < lastPayoutAmount) {
        const percent = Math.round(((lastPayoutAmount - totalPending) / lastPayoutAmount) * 100);
        performanceHeading = `Sikit lagi pecah rekor!`;
        performanceMessage = `Penarikan terakhir kamu <b>Rp ${lastPayoutAmount.toLocaleString('id-ID')}</b>, sedangkan sekarang baru kekumpul <b>Rp ${totalPending.toLocaleString('id-ID')}</b>. Kurang <b>${percent}%</b> lagi buat nyalip rekor kemarin, ayo gas pol promosinya! 💪`;
        performanceColorClass = 'bg-amber-600/10 border-amber-500/20 text-amber-400';
        performanceIcon = `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>`;
        performanceBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-amber-500/20 border border-amber-500/30">NEED ${percent}% MORE</span>`;
    } else {
        performanceHeading = `Sama kuat nih!`;
        performanceMessage = `Komisi kamu sekarang (<b>Rp ${totalPending.toLocaleString('id-ID')}</b>) pas banget sama pencairan terakhir. Satu closingan lagi aja udah bisa buat rekor baru hari ini! 🔥`;
        performanceColorClass = 'bg-purple-600/10 border-purple-500/20 text-purple-400';
        performanceIcon = `<svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.99 7.99 0 0120 13a7.99 7.99 0 01-2.343 5.657z" /></svg>`;
        performanceBadge = `<span class="px-2 py-0.5 rounded text-[10px] bg-purple-500/20 border border-purple-500/30">STABLE</span>`;
    }

    const performanceReport = `
        <div class="mb-6 p-5 rounded-2xl border flex items-start gap-4 ${performanceColorClass} transition-all shadow-lg backdrop-blur-sm">
            <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center border border-white/5">
                ${performanceIcon}
            </div>
            <div class="flex-1">
                <div class="flex items-center gap-2 mb-1">
                    <span class="font-bold text-white text-base">${performanceHeading}</span>
                    ${performanceBadge}
                </div>
                <div class="text-xs md:text-sm font-light leading-relaxed opacity-90">
                    ${performanceMessage}
                </div>
            </div>
        </div>
    `;

    let tableContent = '';
    if (!transactions || transactions.length === 0) {
        tableContent = `
            <div class="p-12 text-center text-gray-400">
                <svg class="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                <h3 class="text-lg font-medium text-white mb-2">Belum ada transaksi affiliate</h3>
                <p>Gunakan kode kupon Anda untuk mulai mendapatkan komisi.</p>
            </div>
        `;
    } else {
        tableContent = `
            <div class="overflow-x-auto">
                <table class="min-w-full text-sm text-left">
                    <thead>
                        <tr class="bg-gray-900 text-gray-300">
                            <th class="px-4 py-3 text-center">No</th>
                            <th class="px-4 py-3">
                                <a href="?page=${page}&search=${search}&sort=tanggal&order=${sort === 'tanggal' && order === 'desc' ? 'asc' : 'desc'}" class="flex items-center gap-1 hover:text-white transition-colors group">
                                    Tanggal
                                    <div class="flex flex-col -space-y-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <svg class="w-2 h-2 ${sort === 'tanggal' && order === 'asc' ? 'text-blue-400' : 'text-gray-400'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16l-8-8z"/></svg>
                                        <svg class="w-2 h-2 ${sort === 'tanggal' && order === 'desc' ? 'text-blue-400' : 'text-gray-400'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4l8 8z"/></svg>
                                    </div>
                                </a>
                            </th>
                            <th class="px-4 py-3">Customer</th>
                            <th class="px-4 py-3">Produk</th>
                            <th class="px-4 py-3">
                                <a href="?page=${page}&search=${search}&sort=durasi&order=${sort === 'durasi' && order === 'desc' ? 'asc' : 'desc'}" class="flex items-center gap-1 hover:text-white transition-colors group">
                                    Durasi
                                    <div class="flex flex-col -space-y-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <svg class="w-2 h-2 ${sort === 'durasi' && order === 'asc' ? 'text-blue-400' : 'text-gray-400'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16l-8-8z"/></svg>
                                        <svg class="w-2 h-2 ${sort === 'durasi' && order === 'desc' ? 'text-blue-400' : 'text-gray-400'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4l8 8z"/></svg>
                                    </div>
                                </a>
                            </th>
                            <th class="px-4 py-3 text-right">
                                <a href="?page=${page}&search=${search}&sort=harga&order=${sort === 'harga' && order === 'desc' ? 'asc' : 'desc'}" class="flex items-center justify-end gap-1 hover:text-white transition-colors group">
                                    Harga
                                    <div class="flex flex-col -space-y-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <svg class="w-2 h-2 ${sort === 'harga' && order === 'asc' ? 'text-blue-400' : 'text-gray-400'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16l-8-8z"/></svg>
                                        <svg class="w-2 h-2 ${sort === 'harga' && order === 'desc' ? 'text-blue-400' : 'text-gray-400'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4l8 8z"/></svg>
                                    </div>
                                </a>
                            </th>
                            <th class="px-4 py-3 text-right">
                                <a href="?page=${page}&search=${search}&sort=komisi&order=${sort === 'komisi' && order === 'desc' ? 'asc' : 'desc'}" class="flex items-center justify-end gap-1 hover:text-white transition-colors group">
                                    Komisi
                                    <div class="flex flex-col -space-y-1 opacity-40 group-hover:opacity-100 transition-opacity">
                                        <svg class="w-2 h-2 ${sort === 'komisi' && order === 'asc' ? 'text-blue-400' : 'text-gray-400'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h16l-8-8z"/></svg>
                                        <svg class="w-2 h-2 ${sort === 'komisi' && order === 'desc' ? 'text-blue-400' : 'text-gray-400'}" fill="currentColor" viewBox="0 0 24 24"><path d="M12 20l8-8H4l8 8z"/></svg>
                                    </div>
                                </a>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        ${transactions.map((t, idx) => `
                            <tr class="border-b border-gray-700 hover:bg-white/5 transition-colors">
                                <td class="px-4 py-3 text-center text-gray-500">${(page - 1) * pageSize + idx + 1}</td>
                                <td class="px-4 py-3">
                                    <div class="font-medium text-white">${formatDate(t.created_at)}</div>
                                    <div class="text-xs text-gray-400 font-mono">${t.invoice_code}</div>
                                </td>
                                <td class="px-4 py-3">
                                    <div class="font-medium text-white">${t.customer_name}</div>
                                    <div class="text-xs text-gray-400">${t.customer_email}</div>
                                </td>
                                <td class="px-4 py-3 text-gray-300">${t.product_name}</td>
                                <td class="px-4 py-3 font-medium text-blue-400">${t.duration || '-'}</td>
                                <td class="px-4 py-3 text-right text-gray-400">Rp ${t.customer_paid_price.toLocaleString('id-ID')}</td>
                                <td class="px-4 py-3 text-right font-bold text-emerald-400">Rp ${t.affiliate_income.toLocaleString('id-ID')}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    }

    const content = `
    <style>
        .select-premium {
            appearance: none;
            background-color: rgba(30, 30, 46, 0.6);
            border: 1px solid rgba(255, 255, 255, 0.1);
            padding: 0.75rem 2.5rem 0.75rem 1rem;
            border-radius: 0.75rem;
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 1rem center;
            background-size: 1.25rem;
        }
        .select-premium:focus {
            outline: none;
            border-color: #6366f1;
            box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.2);
            background-color: rgba(30, 30, 46, 0.8);
        }
        .select-premium option {
            background-color: #1a1a2e;
            color: white;
            padding: 1rem;
        }
        .input-dark-premium {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(5px);
        }
        .input-dark-premium:focus {
            background: rgba(255, 255, 255, 0.1);
            border-color: #6366f1;
        }
    </style>
    <div class="min-h-screen bg-gray-950">
        ${sidebar}
        <div class="flex flex-1 flex-col md:pl-64">
            <main class="flex-1">
                <div class="py-6">
                    <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
                        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div>
                                <h1 class="text-3xl font-bold text-white">Affiliate Dashboard</h1>
                                <p class="text-gray-400 mt-1">Pantau performa referral dan komisi Anda.</p>
                            </div>
                        </div>

                        ${!options.isEnrolled ? `
                            <!-- Enrollment Gate -->
                            <div class="bg-gray-900/50 border border-white/5 rounded-3xl p-8 md:p-12 text-center backdrop-blur-sm relative overflow-hidden group">
                                <div class="absolute -top-24 -right-24 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl group-hover:bg-blue-500/20 transition-all duration-700"></div>
                                <div class="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-700"></div>
                                
                                <div class="relative z-10 max-w-2xl mx-auto">
                                    <div class="w-20 h-20 bg-blue-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-blue-500/20 shadow-lg shadow-blue-500/5">
                                        <svg class="w-10 h-10 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                    </div>
                                    
                                    <h2 class="text-3xl font-extrabold text-white mb-4 tracking-tight">Bergabung Menjadi Affiliate!</h2>
                                    <p class="text-gray-400 mb-10 text-lg leading-relaxed">
                                        Dapatkan komisi dari setiap referral yang menggunakan kode kupon Anda. 
                                        Syarat untuk bergabung adalah memiliki minimal <span class="text-white font-bold">${options.requiredOrders} orderan</span> dalam 6 bulan terakhir.
                                    </p>

                                    <!-- Progress Status -->
                                    <div class="bg-black/40 border border-white/5 rounded-2xl p-6 mb-10 text-left">
                                        <div class="flex items-center justify-between mb-4">
                                            <span class="text-sm font-medium text-gray-400 uppercase tracking-widest">Progress Aktivitas</span>
                                            <span class="text-2xl font-black text-white">${options.ordersCount} <span class="text-xs text-gray-500 font-normal">/ ${options.requiredOrders} Order</span></span>
                                        </div>
                                        <div class="w-full h-3 bg-gray-800 rounded-full overflow-hidden border border-white/5">
                                            <div class="h-full bg-gradient-to-r from-blue-600 to-emerald-500 transition-all duration-1000 ease-out" style="width: ${Math.min((options.ordersCount! / options.requiredOrders!) * 100, 100)}%"></div>
                                        </div>
                                        <p class="mt-4 text-xs text-gray-500 leading-relaxed italic">
                                            * Terhitung dari pesanan sukses yang dilakukan dalam 180 hari terakhir.
                                        </p>
                                    </div>

                                    ${options.isEligible ? `
                                        <form method="POST" action="/member/affiliate/join">
                                            <button type="submit" class="w-full md:w-auto bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-12 py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 hover:shadow-blue-500/40 hover:-translate-y-1 transition-all">
                                                DAFTAR SEKARANG
                                            </button>
                                        </form>
                                    ` : `
                                        <div class="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-6 flex flex-col md:flex-row items-center gap-4 text-amber-500">
                                            <svg class="w-10 h-10 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            <div class="text-left">
                                                <div class="font-bold text-lg mb-0.5">Belum memenuhi syarat</div>
                                                <div class="text-xs opacity-80">Akun Anda harus melakukan setidaknya ${options.requiredOrders! - options.ordersCount!} orderan sukses lagi untuk bisa mendaftar program affiliate.</div>
                                            </div>
                                            <a href="/member/orders/create" class="ml-auto bg-amber-500 text-black px-6 py-2 rounded-xl font-bold hover:bg-amber-400 transition-colors">Beli Produk</a>
                                        </div>
                                    `}
                                </div>
                            </div>
                        ` : `
                            <!-- Existing Affiliate Content -->
                            ${statsHeader}
                            ${performanceReport}

                            <div class="bg-[var(--surface)] shadow-sm rounded-2xl border border-[var(--border)] overflow-hidden">
                                <div class="p-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
                                    <h2 class="text-base font-bold text-[var(--text)]">Riwayat Transaksi</h2>
                                </div>
                                ${filterForm}
                                ${tableContent}
                                ${pagination}
                            </div>
                        `}
                    </div>
                </div>
            </main>
        </div>
    </div>

    <!-- Edit Coupon Modal -->
    <div id="couponModal" class="fixed inset-0 z-50 hidden overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-black bg-opacity-75 transition-opacity" aria-hidden="true" onclick="closeCouponModal()"></div>
            <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div class="inline-block align-bottom bg-[var(--surface)] rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-[var(--border)]">
                <form id="couponForm" onsubmit="saveCoupon(event)">
                    <div class="px-6 py-6">
                        <div class="flex items-center gap-3 mb-6">
                            <div class="w-10 h-10 rounded-xl bg-[var(--brand-soft)] flex items-center justify-center">
                                <svg class="w-6 h-6 text-[var(--brand)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4v-3a2 2 0 00-2-2H5z" />
                                </svg>
                            </div>
                            <h3 class="text-xl font-bold text-[var(--text)]">Ubah Kode Kupon</h3>
                        </div>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-semibold text-[var(--text-3)] mb-2">Kode Kupon Baru</label>
                                <input type="text" name="coupon" value="${options.profile?.kupon || ''}" placeholder="Cth: KUPONMANTAP" class="w-full px-4 py-3 rounded-xl bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] outline-none font-mono uppercase tracking-widest text-xs focus:border-[var(--brand)]" required maxlength="20">
                                <p class="text-[10px] text-[var(--text-3)] mt-2 leading-relaxed">
                                    * Hanya boleh huruf dan angka.<br>
                                    * Kode akan dicek ketersediaannya oleh sistem.
                                </p>
                            </div>
                        </div>
                    </div>
                    <div class="bg-[var(--surface-2)] px-6 py-4 flex flex-row-reverse gap-3 border-t border-[var(--border)]">
                        <button type="submit" class="bg-[var(--brand)] hover:opacity-90 text-white px-6 py-2 rounded-xl font-bold text-xs transition-opacity">Perbarui Kode</button>
                        <button type="button" onclick="closeCouponModal()" class="text-[var(--text-3)] hover:text-[var(--text)] px-4 py-2 text-xs font-semibold transition-colors">Batal</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Edit Payout Modal -->
    <div id="payoutModal" class="fixed inset-0 z-50 hidden overflow-y-auto" aria-labelledby="modal-title" role="dialog" aria-modal="true">
        <div class="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div class="fixed inset-0 bg-black bg-opacity-75 transition-opacity" aria-hidden="true" onclick="closePayoutModal()"></div>
            <span class="hidden sm:inline-block sm:align-middle sm:h-screen" aria-hidden="true">&#8203;</span>
            <div class="inline-block align-bottom bg-[var(--surface)] rounded-2xl text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full border border-[var(--border)]">
                <form id="payoutForm" onsubmit="savePayout(event)">
                    <div class="px-6 py-6">
                        <h3 class="text-xl font-bold text-[var(--text)] mb-6">Edit Informasi Penarikan</h3>
                        <div class="space-y-4">
                            <div>
                                <label class="block text-xs font-semibold text-[var(--text-3)] mb-1">Nama Bank</label>
                                <select name="bank_name" class="w-full bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs outline-none focus:border-[var(--brand)]" required>
                                    <option value="" disabled ${!options.profile?.payout_bank_name ? 'selected' : ''}>Pilih Bank</option>
                                    <option value="BCA" ${options.profile?.payout_bank_name === 'BCA' ? 'selected' : ''}>BCA</option>
                                    <option value="BNI" ${options.profile?.payout_bank_name === 'BNI' ? 'selected' : ''}>BNI</option>
                                    <option value="BRI" ${options.profile?.payout_bank_name === 'BRI' ? 'selected' : ''}>BRI</option>
                                    <option value="Mandiri" ${options.profile?.payout_bank_name === 'Mandiri' ? 'selected' : ''}>Mandiri</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-[var(--text-3)] mb-1">Nomor Rekening</label>
                                <input type="text" name="no_rek" value="${options.profile?.payout_no_rek || ''}" placeholder="Masukkan nomor rekening" class="w-full bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs outline-none focus:border-[var(--brand)]" required>
                            </div>
                            <div>
                                <label class="block text-xs font-semibold text-[var(--text-3)] mb-1">Nama Pemilik Rekening</label>
                                <input type="text" name="owner_name" value="${options.profile?.payout_name || ''}" placeholder="Masukkan nama sesuai di kartu/buku tabungan" class="w-full bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] rounded-xl px-4 py-3 text-xs outline-none focus:border-[var(--brand)]" required>
                            </div>
                        </div>
                    </div>
                    <div class="bg-[var(--surface-2)] px-6 py-4 flex flex-row-reverse gap-3 border-t border-[var(--border)]">
                        <button type="submit" class="bg-[var(--brand)] hover:opacity-90 text-white px-6 py-2 rounded-xl font-bold text-xs transition-opacity">Simpan Perubahan</button>
                        <button type="button" onclick="closePayoutModal()" class="text-[var(--text-3)] hover:text-[var(--text)] px-4 py-2 text-xs font-semibold transition-colors">Batal</button>
                    </div>
                </form>
            </div>
        </div>
    </div>

    <!-- Toast Notification -->
    <div id="toast" class="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] hidden">
        <div class="bg-gray-900 border border-gray-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-3">
            <span id="toastIcon" class="text-emerald-400">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
            </span>
            <span id="toastMessage" class="text-sm font-medium">Berhasil dicopy!</span>
        </div>
    </div>

    <script>
        function copyToClipboard(text) {
            if (!text) return;
            navigator.clipboard.writeText(text).then(() => {
                showToast('Kode kupon berhasil dicopy!');
            });
        }

        function showToast(message) {
            const toast = document.getElementById('toast');
            const msg = document.getElementById('toastMessage');
            msg.innerText = message;
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
        }

        function openPayoutModal() {
            document.getElementById('payoutModal').classList.remove('hidden');
        }

        function closePayoutModal() {
            document.getElementById('payoutModal').classList.add('hidden');
        }

        function openCouponModal() {
            document.getElementById('couponModal').classList.remove('hidden');
        }

        function closeCouponModal() {
            document.getElementById('couponModal').classList.add('hidden');
        }

        async function saveCoupon(e) {
            e.preventDefault();
            const form = e.target;
            const btn = form.querySelector('button[type="submit"]');
            const originalText = btn.innerText;
            
            const coupon = form.coupon.value.trim().toUpperCase();
            if(!coupon) return;

            btn.disabled = true;
            btn.innerText = 'Mengecek...';

            try {
                const res = await fetch('/member/affiliate/update-coupon', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coupon })
                });
                
                if (res.ok) {
                    showToast('Kode kupon berhasil diperbarui!');
                    closeCouponModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    const err = await res.text();
                    alert('Gagal: ' + err);
                }
            } catch (err) {
                alert('Terjadi kesalahan network');
            } finally {
                btn.disabled = false;
                btn.innerText = originalText;
            }
        }

        async function savePayout(e) {
            e.preventDefault();
            const form = e.target;
            const data = {
                bank_name: form.bank_name.value,
                no_rek: form.no_rek.value,
                owner_name: form.owner_name.value
            };

            try {
                const res = await fetch('/member/affiliate/update-payout', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                if (res.ok) {
                    showToast('Informasi payout berhasil diperbarui!');
                    closePayoutModal();
                    setTimeout(() => location.reload(), 1500);
                } else {
                    const err = await res.text();
                    alert('Gagal menyimpan: ' + err);
                }
            } catch (err) {
                alert('Terjadi kesalahan network');
            }
        }
    </script>
    `;

    return baseLayout('Affiliate Dashboard', content);
};
