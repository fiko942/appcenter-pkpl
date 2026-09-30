import { baseLayout } from './layout';
import { getAdminSidebar } from './components/admin-sidebar';

interface PaymentRecord {
  id: number;
  user: string;
  email: string;
  productName: string;
  durationDisplay: string;
  totalAmount: number;
  adminFee: number;
  channelCode: string | null;
  status: string;
  paymentRequestId: string | null;
  vaNumber: string | null;
  paidAt: string | null;
  createdAt: string;
  expiresAt: string | null;
  licenseToken: string | null;
}

interface PaymentsListData {
  adminName: string;
  payments: PaymentRecord[];
  totalPayments: number;
  page: number;
  totalPages: number;
  search: string;
  sort: string;
  order: string;
}

export const paymentsListPage = (data: PaymentsListData): string => {
  const sidebar = getAdminSidebar('payments', { adminName: data.adminName });
  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);

  const getSortUrl = (field: string) => {
    const newOrder = data.sort === field && data.order === 'asc' ? 'desc' : 'asc';
    return `/admin/payments?search=${data.search}&sort=${field}&order=${newOrder}&page=1`;
  };

  const getPaginationUrl = (page: number) => {
    return `/admin/payments?search=${data.search}&sort=${data.sort}&order=${data.order}&page=${page}`;
  };

  const renderSortIcon = (field: string) => {
    if (data.sort !== field) return '<svg class="w-3 h-3 opacity-20" fill="currentColor" viewBox="0 0 20 20"><path d="M5 10l5-5 5 5H5z"/></svg>';
    return data.order === 'asc'
      ? '<svg class="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M5 15l5-5 5 5H5z"/></svg>'
      : '<svg class="w-3 h-3 text-blue-400" fill="currentColor" viewBox="0 0 20 20"><path d="M15 5l-5 5-5-5h10z"/></svg>';
  };

  const content = `
  <div class="min-h-screen bg-gray-950">
    <!-- Sidebar -->
    ${sidebar}

    <!-- Main Content -->
    <main class="ml-0 md:ml-64 p-4 sm:p-6 md:p-8 pt-16 md:pt-8 min-w-0">
      <div class="animate-fade-in">
        <!-- Header -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
          <div>
            <h1 class="text-2xl sm:text-3xl font-bold">Daftar Pembayaran</h1>
            <p class="text-gray-400 mt-1 text-xs sm:text-sm">Total ${data.totalPayments.toLocaleString()} pembayaran</p>
          </div>
          <div class="w-full md:w-auto flex items-center gap-3">
            <form action="/admin/payments" method="GET" class="flex items-center gap-2 w-full md:w-auto">
              <input type="text" name="search" value="${data.search}" placeholder="Cari email atau ID..." 
                class="bg-gray-800/50 border border-white/10 rounded-xl px-4 py-2 text-sm focus:outline-none focus:border-primary/50 text-white flex-1 md:w-64">
              <button type="submit" class="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-xl transition-colors text-sm">
                 Cari
              </button>
            </form>
          </div>
        </div>

        <!-- Payments Table -->
        <div class="card">
          <div class="overflow-x-auto min-h-[500px]">
            <table class="w-full text-left border-collapse">
              <thead>
                <tr class="bg-white/5 border-b border-white/10">
                  <th class="py-3 px-4">
                    <a href="${getSortUrl('id')}" class="flex items-center gap-2 text-gray-400 font-medium text-xs uppercase tracking-wider hover:text-white transition-colors">
                      ID ${renderSortIcon('id')}
                    </a>
                  </th>
                  <th class="py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">Pelanggan</th>
                  <th class="py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">Produk / Durasi</th>
                  <th class="py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">License</th>
                  <th class="py-3 px-4">
                    <a href="${getSortUrl('total_amount')}" class="flex items-center gap-2 text-gray-400 font-medium text-xs uppercase tracking-wider hover:text-white transition-colors">
                      Total ${renderSortIcon('total_amount')}
                    </a>
                  </th>
                  <th class="py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">Status</th>
                  <th class="py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider">
                    <a href="${getSortUrl('created')}" class="flex items-center gap-2 text-gray-400 font-medium text-xs uppercase tracking-wider hover:text-white transition-colors">
                      Tanggal ${renderSortIcon('created')}
                    </a>
                  </th>
                  <th class="py-3 px-4 text-gray-400 font-medium text-xs uppercase tracking-wider text-right">Aksi</th>
                </tr>
              </thead>
              <tbody class="text-sm">
                ${data.payments.length === 0 ? `
                <tr>
                  <td colspan="7" class="py-12 text-center text-gray-500">
                    <svg class="w-12 h-12 mx-auto mb-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
                    </svg>
                    Data tidak ditemukan
                  </td>
                </tr>
                ` : data.payments.map(payment => `
                <tr class="border-b border-white/5 hover:bg-white/[0.02] transition-colors group">
                  <td class="py-4 px-4 font-mono text-xs text-gray-400">#${payment.id}</td>
                  <td class="py-4 px-4">
                    <div class="max-w-[180px]">
                      <p class="font-bold text-white truncate">${payment.user}</p>
                      ${payment.email ? `<p class="text-gray-500 text-[10px] truncate">${payment.email}</p>` : ''}
                    </div>
                  </td>
                  <td class="py-4 px-4">
                    <p class="text-xs text-gray-300">${payment.productName}</p>
                    <p class="text-[10px] text-gray-500 font-medium">${payment.durationDisplay}</p>
                  </td>
                  <td class="py-4 px-4 min-w-[160px]">
                    ${payment.licenseToken ? `
                    <div class="flex items-center gap-2">
                       <code class="px-2 py-1 bg-gray-800 rounded font-mono text-[10px] text-blue-400">${payment.licenseToken}</code>
                       <button onclick="copyToClipboard('${payment.licenseToken}', this)" class="text-gray-500 hover:text-white transition-colors">
                         <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                       </button>
                    </div>
                    ` : '<span class="text-gray-600">-</span>'}
                  </td>
                  <td class="py-4 px-4">
                    <div class="flex flex-col items-start">
                      <p class="font-black text-emerald-400">${formatCurrency(payment.totalAmount)}</p>
                      ${payment.adminFee > 0 ? `<p class="text-gray-500 text-[9px] uppercase tracking-tighter">Incl. Fee: ${formatCurrency(payment.adminFee)}</p>` : ''}
                    </div>
                  </td>
                  <td class="py-4 px-4">
                    ${payment.status.includes('complete') || payment.status.includes('Paid') ? `
                    <span class="px-2 py-1 bg-green-500/10 text-green-400 rounded-lg text-[10px] font-bold border border-green-500/20 uppercase">SUCCESS</span>
                    ` : `
                    <span class="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-[10px] font-bold border border-amber-500/20 uppercase">${payment.status.includes('Order') ? 'PENDING' : payment.status}</span>
                    `}
                  </td>
                  <td class="py-4 px-4">
                     <p class="text-gray-400 text-xs">${payment.createdAt}</p>
                     ${payment.paidAt ? `<p class="text-green-500 text-[9px]">Lunas: ${payment.paidAt}</p>` : ''}
                  </td>
                  <td class="py-4 px-4 text-right">
                    <div class="relative inline-block text-left">
                      <button onclick="toggleActionMenu(${payment.id}, event)" class="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/></svg>
                      </button>
                      <div id="menu-${payment.id}" class="hidden action-menu absolute right-0 mt-2 w-48 glass border border-white/10 rounded-xl shadow-2xl z-[100] overflow-hidden">
                        ${!(payment.status.includes('complete') || payment.status.includes('Paid')) ? `
                        <button onclick="openConfirmModal(${payment.id}, '${payment.user}')" class="w-full flex items-center gap-3 px-4 py-3 text-xs text-green-400 hover:bg-green-400/10 transition-colors">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
                          Acc Payment
                        </button>
                        ` : ''}
                        ${payment.status.includes('complete') || payment.status.includes('Paid') ? `
                        <button disabled class="w-full flex items-center gap-3 px-4 py-3 text-xs text-gray-500 cursor-not-allowed opacity-50">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Change Duration
                        </button>
                        ` : `
                        <button onclick="openDurationModal(${payment.id}, '${payment.productName}', ${parseInt(payment.durationDisplay) || 1})" class="w-full flex items-center gap-3 px-4 py-3 text-xs text-blue-400 hover:bg-blue-400/10 transition-colors">
                          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                          Change Duration
                        </button>
                        `}
                      </div>
                    </div>
                  </td>
                </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          ${data.totalPages > 1 ? `
          <!-- Pagination -->
          <div class="flex justify-center items-center gap-2 p-6 border-t border-white/10">
            ${data.page > 1 ? `
            <a href="${getPaginationUrl(data.page - 1)}" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors">
              ← Prev
            </a>
            ` : ''}
            
            <div class="flex items-center gap-1">
                <span class="text-gray-500 text-xs font-medium px-2">
                  ${data.page} / ${data.totalPages}
                </span>
            </div>
            
            ${data.page < data.totalPages ? `
            <a href="${getPaginationUrl(data.page + 1)}" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition-colors">
              Next →
            </a>
            ` : ''}
          </div>
          ` : ''}
        </div>
      </div>
    </main>

    <!-- Confirm Modal -->
    <div id="confirmModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeModals()"></div>
      <div class="card w-full max-w-md relative z-10 animate-scale-in">
        <div class="p-6">
          <h3 class="text-xl font-bold mb-2">Konfirmasi Pembayaran</h3>
          <p class="text-gray-400 text-sm mb-6">Anda yakin ingin menyetujui pembayaran untuk <span id="confirmUserName" class="text-white font-medium"></span>? Tindakan ini akan otomatis membuat lisensi dan komisi affiliate.</p>
          <div class="flex gap-3">
            <button onclick="closeModals()" class="flex-1 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">Batal</button>
            <button id="btnConfirmAcc" class="flex-1 px-4 py-2 rounded-xl bg-green-500 hover:bg-green-600 transition-colors font-bold">Ya, Setujui</button>
          </div>
        </div>
      </div>
    </div>

    <!-- Duration Modal -->
    <div id="durationModal" class="hidden fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" onclick="closeModals()"></div>
      <div class="card w-full max-w-md relative z-10 animate-scale-in">
        <div class="p-6">
          <h3 class="text-xl font-bold mb-2">Ubah Durasi</h3>
          <p id="durationProductInfo" class="text-gray-400 text-sm mb-6"></p>
          <div class="space-y-4 mb-6">
            <div>
              <label class="block text-xs text-gray-500 uppercase font-bold mb-2">Durasi (Bulan)</label>
              <input type="number" id="inputDuration" min="1" max="120" value="1" class="w-full bg-gray-800/50 border border-white/10 rounded-xl px-4 py-3 focus:outline-none focus:border-primary/50 text-white">
            </div>
          </div>
          <div class="flex gap-3">
            <button onclick="closeModals()" class="flex-1 px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 transition-colors">Batal</button>
            <button id="btnSaveDuration" class="flex-1 px-4 py-2 rounded-xl bg-primary hover:bg-primary/80 transition-colors font-bold text-black">Simpan Perubahan</button>
          </div>
        </div>
      </div>
    </div>
  </div>
  `;

  const scripts = `
    <script>
    let currentOrderId = null;

    function copyToClipboard(text, el) {
      navigator.clipboard.writeText(text).then(() => {
        const originalIcon = el.innerHTML;
        el.innerHTML = '<svg class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>';
        setTimeout(() => { el.innerHTML = originalIcon; }, 1000);
      });
    }

    function toggleActionMenu(id, event) {
      event.stopPropagation();
      const menu = document.getElementById('menu-' + id);
      const allMenus = document.querySelectorAll('.action-menu');
      
      allMenus.forEach(m => {
        if (m.id !== 'menu-' + id) m.classList.add('hidden');
      });
      
      menu.classList.toggle('hidden');
      
      // Close menu when clicking outside
      const closeMenu = () => {
        menu.classList.add('hidden');
        document.removeEventListener('click', closeMenu);
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }

    function closeModals() {
      document.getElementById('confirmModal').classList.add('hidden');
      document.getElementById('durationModal').classList.add('hidden');
      currentOrderId = null;
    }

    function openConfirmModal(id, userName) {
      currentOrderId = id;
      document.getElementById('confirmUserName').textContent = userName;
      document.getElementById('confirmModal').classList.remove('hidden');
    }

    function openDurationModal(id, productName, currentDuration) {
      currentOrderId = id;
      document.getElementById('durationProductInfo').textContent = 'Ubah durasi untuk ' + productName;
      document.getElementById('inputDuration').value = currentDuration;
      document.getElementById('durationModal').classList.remove('hidden');
    }

    document.getElementById('btnConfirmAcc').onclick = async () => {
      if (!currentOrderId) return;
      try {
        const res = await fetch('/admin/payments/confirm/' + currentOrderId, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          location.reload();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Network error');
      }
    };

    document.getElementById('btnSaveDuration').onclick = async () => {
      if (!currentOrderId) return;
      const duration = document.getElementById('inputDuration').value;
      try {
        const res = await fetch('/admin/payments/update-duration/' + currentOrderId, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ duration: parseInt(duration) })
        });
        const data = await res.json();
        if (data.success) {
          location.reload();
        } else {
          alert('Error: ' + data.error);
        }
      } catch (e) {
        alert('Network error');
      }
    };
    </script>
  `;

  return baseLayout('Daftar Pembayaran', content, scripts);
};
