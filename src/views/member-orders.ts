import { baseLayout } from './layout';
import { getMemberSidebar } from './components/member-sidebar';

interface MemberData {
    name: string;
    email: string;
    avatar?: string;
}

export interface OrderData {
    id: number;
    created: number;
    status: string;
    payment: string;
    payment_url?: string;
    paid_at?: number | null;
    total_amount?: number | null;
    duration?: number | null;
    items?: any;
}

function formatDuration(minutes?: number | null): string {
    if (!minutes || minutes <= 0) return '-';
    if (minutes < 60) return `${minutes} menit`;
    if (minutes < 1440) {
        const jam = Math.floor(minutes / 60);
        const sisa = minutes % 60;
        return `${jam} jam${sisa ? ` ${sisa} menit` : ''}`;
    }
    if (minutes < 43800) {
        const hari = Math.floor(minutes / 1440);
        const sisa = minutes % 1440;
        return `${hari} hari${sisa ? ` ${formatDuration(sisa)}` : ''}`;
    }
    const bulan = Math.round(minutes / 43800);
    return `${bulan} bulan`;
}

interface OrdersPageOptions {
    page: number;
    pageSize: number;
    totalOrders: number;
    search: string;
    sort: string;
    order: string;
}

function formatDate(epoch: number): string {
    const d = new Date(epoch * 1000);
    return d.toLocaleDateString('id-ID', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export const memberOrdersPage = (user: MemberData, orders: OrderData[], options?: OrdersPageOptions): string => {
    const sidebar = getMemberSidebar('orders', user);
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 10;
    const totalOrders = options?.totalOrders || 0;
    const search = options?.search || '';
    const sort = options?.sort || 'created';
    const order = options?.order || 'desc';
    const totalPages = Math.ceil(totalOrders / pageSize);

    // Search & Sort Form
    const filterForm = `
        <form method="GET" action="/member/orders" class="p-4 bg-[var(--surface-2)] border-b border-[var(--border)] flex flex-col md:flex-row gap-3 items-center justify-between">
            <div class="flex flex-col md:flex-row gap-3 w-full">
                <div class="relative flex-1 md:max-w-xs">
                    <input type="text" name="search" value="${search}" placeholder="Cari ID, status, payment..." class="w-full bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-xl px-3.5 py-2 text-xs focus:border-[var(--brand)] outline-none transition-all placeholder-[var(--text-3)]" />
                </div>
                <div class="flex gap-2">
                    <select name="sort" class="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs outline-none focus:border-[var(--brand)]">
                        <option value="created" ${sort === 'created' ? 'selected' : ''}>Tanggal Order</option>
                        <option value="status" ${sort === 'status' ? 'selected' : ''}>Status</option>
                        <option value="payment" ${sort === 'payment' ? 'selected' : ''}>Metode Pembayaran</option>
                    </select>
                    <select name="order" class="bg-[var(--surface)] text-[var(--text)] border border-[var(--border)] rounded-xl px-3 py-2 text-xs outline-none focus:border-[var(--brand)]">
                        <option value="desc" ${order === 'desc' ? 'selected' : ''}>Terbaru</option>
                        <option value="asc" ${order === 'asc' ? 'selected' : ''}>Terlama</option>
                    </select>
                </div>
                <button type="submit" class="bg-[var(--brand)] hover:opacity-90 text-white px-5 py-2 rounded-xl text-xs font-bold transition-opacity">Filter</button>
            </div>
        </form>
    `;

    // Pagination
    let pagination = '';
    if (totalPages > 1) {
        pagination = `<div class="p-4 border-t border-[var(--border)] flex gap-2 justify-center items-center">
            ${page > 1 ? `<a href="?page=${page - 1}&search=${search}&sort=${sort}&order=${order}" class="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--brand)] text-xs font-bold transition-all">&laquo; Prev</a>` : ''}
            <span class="px-3.5 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)] text-xs font-bold">${page} / ${totalPages}</span>
            ${page < totalPages ? `<a href="?page=${page + 1}&search=${search}&sort=${sort}&order=${order}" class="px-3 py-1.5 rounded-xl bg-[var(--surface-2)] text-[var(--text)] border border-[var(--border)] hover:border-[var(--brand)] text-xs font-bold transition-all">Next &raquo;</a>` : ''}
        </div>`;
    }

    let ordersContent = '';
    if (!orders || orders.length === 0) {
        ordersContent = `
            <div class="p-12 text-center text-[var(--text-3)]">
                <svg class="w-12 h-12 mx-auto mb-3 text-[var(--text-3)] opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"></path>
                </svg>
                <h3 class="text-base font-bold text-[var(--text)] mb-1">Belum ada pesanan</h3>
                <p class="text-xs">Riwayat pesanan Anda akan muncul di halaman ini.</p>
            </div>
        `;
    } else {
        ordersContent = `
            <div class="overflow-x-auto">
                <table class="w-full text-xs text-left">
                    <thead class="bg-[var(--surface-2)] text-[var(--text-2)] uppercase font-bold border-b border-[var(--border)]">
                        <tr>
                            <th class="px-5 py-3.5">No</th>
                            <th class="px-5 py-3.5">Tanggal Order</th>
                            <th class="px-5 py-3.5">Produk</th>
                            <th class="px-5 py-3.5">Status</th>
                            <th class="px-5 py-3.5">Durasi</th>
                            <th class="px-5 py-3.5">Total</th>
                            <th class="px-5 py-3.5 text-right">Aksi</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[var(--border)]">
                        ${orders.map((order, idx) => {
            const isPaid = !!order.paid_at;
            let statusBadge = '';
            if (isPaid) {
                statusBadge = `<span class="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 inline-flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span> Sudah Dibayar
                </span>`;
            } else {
                statusBadge = `<span class="px-2.5 py-1 rounded-lg font-bold text-[11px] bg-amber-500/10 text-amber-500 border border-amber-500/20 inline-flex items-center gap-1">
                    <span class="w-1.5 h-1.5 rounded-full bg-amber-500"></span> ${order.status || 'Pending'}
                </span>`;
            }

            let productName = '-';
            try {
                interface ProductItem { name: string; [key: string]: unknown; }
                const rawItems: unknown = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;

                let itemsArr: ProductItem[] = [];
                if (Array.isArray(rawItems)) {
                    itemsArr = rawItems as ProductItem[];
                } else if (rawItems && typeof rawItems === 'object') {
                    itemsArr = [rawItems as ProductItem];
                }

                if (itemsArr.length > 0 && itemsArr[0].name) {
                    productName = itemsArr.map(item => item.name).join(', ');
                }
            } catch (e) {
                // Ignore parse errors
            }

            return `
                <tr class="hover:bg-[var(--surface-2)]/50 transition-colors">
                    <td class="px-5 py-4 font-semibold text-[var(--text-3)]">${(page - 1) * pageSize + idx + 1}</td>
                    <td class="px-5 py-4 text-[var(--text-2)] font-medium">${formatDate(order.created)}</td>
                    <td class="px-5 py-4 font-bold text-[var(--text)]">${productName}</td>
                    <td class="px-5 py-4">${statusBadge}</td>
                    <td class="px-5 py-4 text-[var(--text-2)] font-medium">${formatDuration(order.duration)}</td>
                    <td class="px-5 py-4 font-extrabold text-[var(--text)]">${order.total_amount ? 'Rp ' + order.total_amount.toLocaleString('id-ID') : '-'}</td>
                    <td class="px-5 py-4 text-right">
                        ${!isPaid ? `<a href="/member/orders/${order.id}/pay" class="px-3.5 py-1.5 bg-[var(--brand)] hover:opacity-90 text-white rounded-lg font-bold text-xs inline-block transition-opacity">Bayar</a>` : `<span class="px-3 py-1 bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)] rounded-lg text-[11px] font-semibold">Selesai</span>`}
                    </td>
                </tr>
            `;
        }).join('')}
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
                    <span class="eyebrow">RIWAYAT & TRANSAKSI</span>
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
                <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 class="text-2xl font-extrabold text-[var(--text)]">Pesanan Saya</h1>
                        <p class="text-[var(--text-3)] text-xs mt-1">Daftar transaksi pembelian lisensi dan status pembayaran Anda.</p>
                    </div>
                    <a href="/member/orders/create" class="bg-[var(--brand)] hover:opacity-90 text-white px-4 py-2.5 rounded-xl font-bold text-xs transition-opacity flex items-center gap-2 shadow-md">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
                        Buat Pesanan Baru
                    </a>
                </div>
                <div>
                    <div class="bg-[var(--surface)] shadow-sm rounded-2xl border border-[var(--border)] overflow-hidden">
                        ${filterForm}
                        ${ordersContent}
                        ${pagination}
                    </div>
                </div>
            </main>
        </div>
    </div>
    `;

    return baseLayout('Pesanan Saya', content);
};
