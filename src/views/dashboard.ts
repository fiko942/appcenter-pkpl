import { baseLayout } from './layout';
import { getAdminSidebar } from './components/admin-sidebar';

interface DashboardData {
    adminName: string;
    stats: {
        totalOrders: number;
        pendingPayments: number;
        completedPayments: number;
        totalRevenue: number;
        grossRevenue: number;
        affiliateCost: number;
        totalAffiliates: number;
        activeAffiliates: number;
        totalCommissionPaid: number;
    };
    topProducts: Array<{ name: string; count: number }>;
    revenueGraphData: Array<{ date: string; amount: number }>;
    recentOrders: Array<{
        id: number;
        user: string;
        totalAmount: number;
        status: string;
        channelCode: string | null;
        createdAt: string;
    }>;
}

export const dashboardPage = (data: DashboardData): string => {
    const sidebar = getAdminSidebar('dashboard', { adminName: data.adminName });
    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

    const content = `
  <div class="min-h-screen bg-gray-950">
    <!-- Sidebar -->
    ${sidebar}

    <!-- Main Content -->
    <div class="flex flex-1 flex-col md:pl-64">
        <main class="flex-1">
            <div class="py-6">
                <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
                    <!-- Header -->
                    <div class="flex justify-between items-center mb-8">
                        <div>
                            <h1 class="text-3xl font-bold text-white">Dashboard</h1>
                            <p class="text-gray-400 mt-1">Overview statistik platform & analitik pendapatan.</p>
                        </div>
                    </div>

                    <!-- Stats Cards -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                        <!-- Revenue -->
                        <div class="bg-gray-800/80 backdrop-blur rounded-2xl p-6 border border-gray-700 relative overflow-hidden group">
                           <div class="absolute right-0 top-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-purple-500/20"></div>
                            <div class="flex items-center justify-between mb-4 relative z-10">
                                <div class="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                    </svg>
                                </div>
                            </div>
                            <p class="text-gray-400 text-sm relative z-10">Pendapatan (Bulan Ini)</p>
                            <p class="text-2xl font-bold text-white mt-1 relative z-10">${formatCurrency(data.stats.totalRevenue)}</p>
                            <div class="flex gap-2 text-[10px] text-gray-500 mt-1 relative z-10">
                                <span>Gross: <span class="text-gray-400">${formatCurrency(data.stats.grossRevenue)}</span></span>
                                <span class="text-gray-600">|</span>
                                <span>Aff: <span class="text-red-400">-${formatCurrency(data.stats.affiliateCost)}</span></span>
                            </div>
                        </div>

                        <!-- Orders -->
                        <div class="bg-gray-800/80 backdrop-blur rounded-2xl p-6 border border-gray-700 relative overflow-hidden group">
                            <div class="absolute right-0 top-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-blue-500/20"></div>
                            <div class="flex items-center justify-between mb-4 relative z-10">
                                <div class="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"></path>
                                    </svg>
                                </div>
                            </div>
                            <p class="text-gray-400 text-sm relative z-10">Pesanan (Bulan Ini)</p>
                            <div class="flex items-center gap-2 mt-1 relative z-10">
                                <p class="text-2xl font-bold text-white">${data.stats.totalOrders.toLocaleString()}</p>
                                <span class="text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded-lg border border-yellow-500/20">${data.stats.pendingPayments} pending</span>
                            </div>
                        </div>

                        <!-- Affiliates -->
                        <div class="bg-gray-800/80 backdrop-blur rounded-2xl p-6 border border-gray-700 relative overflow-hidden group">
                             <div class="absolute right-0 top-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-emerald-500/20"></div>
                            <div class="flex items-center justify-between mb-4 relative z-10">
                                <div class="w-12 h-12 bg-emerald-500/20 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                    </svg>
                                </div>
                            </div>
                            <p class="text-gray-400 text-sm relative z-10">Affiliator Baru (Bulan Ini)</p>
                            <div class="flex items-center gap-2 mt-1 relative z-10">
                                <p class="text-2xl font-bold text-white">${data.stats.totalAffiliates.toLocaleString()}</p>
                                <span class="text-xs px-2 py-0.5 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-500/20">${data.stats.activeAffiliates} aktif</span>
                            </div>
                        </div>

                        <!-- Payouts -->
                        <div class="bg-gray-800/80 backdrop-blur rounded-2xl p-6 border border-gray-700 relative overflow-hidden group">
                           <div class="absolute right-0 top-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-16 -mt-16 transition-all group-hover:bg-orange-500/20"></div>
                            <div class="flex items-center justify-between mb-4 relative z-10">
                                <div class="w-12 h-12 bg-orange-500/20 rounded-xl flex items-center justify-center">
                                    <svg class="w-6 h-6 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"></path>
                                    </svg>
                                </div>
                            </div>
                            <p class="text-gray-400 text-sm relative z-10">Komisi Belum Dibayar</p>
                            <p class="text-2xl font-bold text-white mt-1 relative z-10">${formatCurrency(data.stats.totalCommissionPaid)}</p>
                        </div>
                    </div>

                    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                        <!-- Revenue Chart -->
                        <div class="lg:col-span-2 bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                             <div class="flex items-center justify-between mb-6">
                                <h2 class="text-lg font-bold text-white">Pendapatan 7 Hari Terakhir</h2>
                                <div class="text-xs text-gray-400 bg-gray-700/50 px-3 py-1 rounded-full">Automated Realtime</div>
                             </div>
                             
                             <div class="h-64 w-full relative">
                                <canvas id="revenueChart"></canvas>
                             </div>
                        </div>

                        <!-- Top Products -->
                        <div class="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                            <h2 class="text-lg font-bold text-white mb-6">Produk Terlaris</h2>
                             <div class="space-y-4">
                                ${data.topProducts.map((p, i) => `
                                    <div class="flex items-center gap-4 group">
                                        <div class="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm 
                                            ${i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
            i === 1 ? 'bg-gray-400/20 text-gray-300' :
                i === 2 ? 'bg-orange-700/20 text-orange-400' : 'bg-gray-700/50 text-gray-500'}">
                                            ${i + 1}
                                        </div>
                                        <div class="flex-1 min-w-0">
                                            <p class="text-sm font-medium text-white truncate group-hover:text-blue-400 transition-colors">${p.name}</p>
                                            <p class="text-xs text-gray-500">${p.count} penjualan</p>
                                        </div>
                                        <div class="w-16 bg-gray-700 rounded-full h-1.5 overflow-hidden">
                                            <div class="bg-blue-500 h-full rounded-full" style="width: ${Math.min((p.count / (data.topProducts[0]?.count || 1)) * 100, 100)}%"></div>
                                        </div>
                                    </div>
                                `).join('')}
                                ${data.topProducts.length === 0 ? '<p class="text-sm text-gray-500 italic">Belum ada data penjualan.</p>' : ''}
                             </div>
                        </div>
                    </div>

                    <!-- Recent Orders Table -->
                    <div class="bg-gray-800/50 rounded-2xl p-6 border border-gray-700">
                    <div class="flex items-center justify-between mb-6">
                         <h2 class="text-xl font-bold text-white">Order Terbaru</h2>
                         <a href="/admin/payments" class="text-xs text-blue-400 hover:text-blue-300 transition-colors">Lihat Semua →</a>
                    </div>
                    <div class="overflow-x-auto">
                        <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="border-b border-gray-700">
                            <th class="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">ID</th>
                            <th class="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">User</th>
                            <th class="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Total</th>

                            <th class="py-3 px-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Tanggal</th>
                            </tr>
                        </thead>
                        <tbody class="text-sm">
                            ${data.recentOrders.map(order => `
                            <tr class="border-b border-white/5 hover:bg-white/5 transition-colors group">
                            <td class="py-4 px-4 font-mono text-xs text-gray-500">#${order.id}</td>
                            <td class="py-4 px-4">
                                <div class="font-medium text-white">${order.user}</div>
                            </td>
                            <td class="py-4 px-4 font-bold text-emerald-400">${formatCurrency(order.totalAmount)}</td>


                            <td class="py-4 px-4 text-gray-400 text-xs text-right">${order.createdAt}</td>
                            </tr>
                            `).join('')}
                        </tbody>
                        </table>
                    </div>
                    </div>
                </div>
            </div>
        </main>
    </div>
  </div>
  `;

    // Inject Chart.js logic
    const scripts = `
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        const ctx = document.getElementById('revenueChart');
        if (ctx) {
            const graphData = ${JSON.stringify(data.revenueGraphData)};
            
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: graphData.map(d => d.date),
                    datasets: [{
                        label: 'Pendapatan',
                        data: graphData.map(d => d.amount),
                        backgroundColor: 'rgba(59, 130, 246, 0.5)', // blue-500 with opacity
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                        borderRadius: 4,
                        barPercentage: 0.6
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(0, 0, 0, 0.8)',
                            titleColor: '#fff',
                            bodyColor: '#fff',
                            padding: 10,
                            callbacks: {
                                label: function(context) {
                                    let label = context.dataset.label || '';
                                    if (label) {
                                        label += ': ';
                                    }
                                    if (context.parsed.y !== null) {
                                        label += new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(context.parsed.y);
                                    }
                                    return label;
                                }
                            }
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: '#9ca3af', // gray-400
                                callback: function(value) {
                                    if (value >= 1000000) return (value / 1000000) + 'jt';
                                    if (value >= 1000) return (value / 1000) + 'rb';
                                    return value;
                                }
                            }
                        },
                        x: {
                            grid: {
                                display: false
                            },
                            ticks: {
                                color: '#9ca3af'
                            }
                        }
                    }
                }
            });
        }
      });
    </script>
  `;

    return baseLayout('Dashboard', content, scripts);
};

