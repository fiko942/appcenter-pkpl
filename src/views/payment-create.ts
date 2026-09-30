import { baseLayout } from './layout';
import { getAdminSidebar } from './components/admin-sidebar';

interface Product {
  id: number;
  name: string;
  price: number;
}

interface CreatePaymentData {
  adminName: string;
  products: Product[];
  adminFeePercent: number;
  error?: string;
  success?: string;
}

export const createPaymentPage = (data: CreatePaymentData): string => {
  const sidebar = getAdminSidebar('dashboard', { adminName: data.adminName }); // 'dashboard' active because it's a sub-page of dashboard/payments

  const content = `
  <div class="min-h-screen bg-gray-950">
    <!-- Sidebar -->
    ${sidebar}

    <!-- Main Content -->
    <main class="ml-0 md:ml-64 p-4 sm:p-6 md:p-8 pt-16 md:pt-8 min-w-0">
      <div class="max-w-2xl animate-fade-in">
        <!-- Header -->
        <div class="mb-8">
          <h1 class="text-2xl sm:text-3xl font-bold">Buat Pembayaran</h1>
          <p class="text-gray-400 mt-1 text-xs sm:text-sm">Buat request pembayaran baru dengan Xendit</p>
        </div>

        ${data.error ? `
        <div class="bg-red-500/20 border border-red-500/50 rounded-xl p-4 mb-6 text-red-400">
          <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          ${data.error}
        </div>
        ` : ''}

        ${data.success ? `
        <div class="bg-green-500/20 border border-green-500/50 rounded-xl p-4 mb-6 text-green-400">
          <svg class="w-5 h-5 inline-block mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          ${data.success}
        </div>
        ` : ''}

        <!-- Form -->
        <form id="paymentForm" method="POST" action="/admin/payment/create" class="card p-8">
          <!-- Customer Email -->
          <div class="mb-6">
            <label class="block text-gray-300 text-sm font-medium mb-2">Email Pelanggan</label>
            <input type="email" name="customerEmail" required placeholder="customer@email.com"
              class="w-full input-dark rounded-xl px-4 py-3 text-white focus:outline-none">
          </div>

          <!-- Customer Name -->
          <div class="mb-6">
            <label class="block text-gray-300 text-sm font-medium mb-2">Nama Pelanggan</label>
            <input type="text" name="customerName" required placeholder="Nama lengkap"
              class="w-full input-dark rounded-xl px-4 py-3 text-white focus:outline-none">
          </div>

          <!-- Product Selection -->
          <div class="mb-6">
            <label class="block text-gray-300 text-sm font-medium mb-2">Pilih Produk</label>
            <select name="productId" id="productSelect" required
              class="w-full input-dark rounded-xl px-4 py-3 text-white focus:outline-none">
              <option value="">-- Pilih Produk --</option>
              ${data.products.map(p => `
                <option value="${p.id}" data-price="${p.price}">${p.name} - Rp ${p.price.toLocaleString()}</option>
              `).join('')}
            </select>
          </div>

          <!-- Duration -->
          <div class="mb-6">
            <label class="block text-gray-300 text-sm font-medium mb-2">Durasi (Bulan)</label>
            <select name="duration" id="durationSelect" required
              class="w-full input-dark rounded-xl px-4 py-3 text-white focus:outline-none">
              <option value="1">1 Bulan</option>
              <option value="3">3 Bulan</option>
              <option value="6">6 Bulan</option>
              <option value="12">12 Bulan</option>
            </select>
          </div>



          <!-- Note -->
          <div class="mb-6">
            <label class="block text-gray-300 text-sm font-medium mb-2">Catatan (Opsional)</label>
            <textarea name="note" rows="3" placeholder="Catatan tambahan..."
              class="w-full input-dark rounded-xl px-4 py-3 text-white focus:outline-none resize-none"></textarea>
          </div>

          <!-- Price Summary -->
          <div class="bg-gray-800/50 rounded-xl p-6 mb-6">
            <h3 class="font-medium mb-4">Ringkasan Pembayaran</h3>
            <div class="space-y-2 text-sm">
              <div class="flex justify-between">
                <span class="text-gray-400">Harga Produk</span>
                <span id="basePrice">Rp 0</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Durasi</span>
                <span id="durationText">1 Bulan</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Subtotal</span>
                <span id="subtotal">Rp 0</span>
              </div>
              <div class="flex justify-between">
                <span class="text-gray-400">Biaya Admin (${data.adminFeePercent}%)</span>
                <span id="adminFee">Rp 0</span>
              </div>
              <div class="border-t border-white/10 pt-2 mt-2 flex justify-between font-bold text-lg">
                <span>Total</span>
                <span id="totalAmount" class="text-green-400">Rp 0</span>
              </div>
            </div>
          </div>

          <input type="hidden" name="totalAmount" id="totalAmountInput" value="0">
          <input type="hidden" name="adminFee" id="adminFeeInput" value="0">

          <!-- Submit Button -->
          <button type="submit" id="submitBtn" class="w-full btn-primary text-white font-semibold py-4 px-6 rounded-xl">
            <span id="btnText">Buat Pembayaran</span>
            <svg id="btnLoader" class="hidden animate-spin ml-2 h-5 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </button>
        </form>
      </div>
    </main>
  </div>
  `;

  const scripts = `
  <script>
    const adminFeePercent = ${data.adminFeePercent};
    
    function formatCurrency(amount) {
      return 'Rp ' + amount.toLocaleString('id-ID');
    }
    
    function calculateTotal() {
      const productSelect = document.getElementById('productSelect');
      const durationSelect = document.getElementById('durationSelect');
      
      const selectedOption = productSelect.options[productSelect.selectedIndex];
      const basePrice = parseInt(selectedOption.dataset.price) || 0;
      const duration = parseInt(durationSelect.value) || 1;
      
      const subtotal = basePrice * duration;
      const adminFee = Math.ceil(subtotal * adminFeePercent / 100);
      const total = subtotal + adminFee;
      
      document.getElementById('basePrice').textContent = formatCurrency(basePrice);
      document.getElementById('durationText').textContent = duration + ' Bulan';
      document.getElementById('subtotal').textContent = formatCurrency(subtotal);
      document.getElementById('adminFee').textContent = formatCurrency(adminFee);
      document.getElementById('totalAmount').textContent = formatCurrency(total);
      document.getElementById('totalAmountInput').value = total;
      document.getElementById('adminFeeInput').value = adminFee;
    }
    
    document.getElementById('productSelect').addEventListener('change', calculateTotal);
    document.getElementById('durationSelect').addEventListener('change', calculateTotal);
    
    document.getElementById('paymentForm').addEventListener('submit', function() {
      document.getElementById('btnText').textContent = 'Memproses...';
      document.getElementById('btnLoader').classList.remove('hidden');
      document.getElementById('submitBtn').disabled = true;
    });
  </script>
  `;

  return baseLayout('Buat Pembayaran', content, scripts);
};
