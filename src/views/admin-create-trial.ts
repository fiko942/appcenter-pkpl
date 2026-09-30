import { baseLayout } from './layout';
import { getAdminSidebar } from './components/admin-sidebar';

interface Product {
  id: number;
  name: string;
}

export const createTrialPage = (error?: string, successCode?: string, products: Product[] = [], adminName: string = 'Admin'): string => {

  // Build options
  const productOptions = products.map(p => `<option value="${p.name}">${p.name}</option>`).join('');
  const sidebar = getAdminSidebar('create-trial', { adminName });

  const content = `
    <div class="min-h-screen bg-gray-950">
         <!-- Sidebar -->
    ${sidebar}

    <main class="ml-0 md:ml-64 p-4 sm:p-6 md:p-8 pt-16 md:pt-8 min-w-0">
    <div class="max-w-4xl animate-fade-in">
        <header class="mb-8 flex justify-between items-center">
        <div>
            <h1 class="text-2xl sm:text-3xl font-bold text-white">Buat Trial Baru</h1>
            <p class="text-gray-400 mt-1 text-xs sm:text-sm">Generate kode trial untuk user</p>
        </div>
        </header>

        <div class="card p-5 sm:p-8 bg-gray-900/50 backdrop-blur-xl border border-white/10 rounded-3xl relative overflow-hidden">
        
        ${error ? `
        <div class="bg-red-500/20 border border-red-500/50 rounded-lg p-4 mb-6 text-red-400 text-center text-sm flex items-center justify-center gap-2">
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            ${error}
        </div>
        ` : ''}

        <form method="POST" action="/admin/trials/create" class="space-y-6">
            
            <!-- Product Select -->
            <div>
                <label class="block text-gray-400 text-sm font-medium mb-2">Pilih Produk</label>
                <div class="relative">
                    <select name="product" required class="w-full bg-gray-800/50 border border-gray-700 focus:border-blue-500 text-white rounded-xl py-3 px-4 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium">
                        <option value="" disabled selected>-- Pilih Produk --</option>
                        ${productOptions}
                    </select>
                    <div class="absolute right-4 top-3.5 pointer-events-none text-gray-500">
                         <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                </div>
            </div>

            <!-- Duration & Unit -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                     <label class="block text-gray-400 text-sm font-medium mb-2">Durasi</label>
                     <input type="number" name="duration" required min="1" value="1"
                        class="w-full bg-gray-800/50 border border-gray-700 focus:border-blue-500 text-white rounded-xl py-3 px-4 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium">
                </div>
                <div>
                    <label class="block text-gray-400 text-sm font-medium mb-2">Satuan Waktu</label>
                    <div class="relative">
                        <select name="unit" required class="w-full bg-gray-800/50 border border-gray-700 focus:border-blue-500 text-white rounded-xl py-3 px-4 appearance-none focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all font-medium">
                            <option value="hour">Jam</option>
                            <option value="day">Hari</option>
                            <option value="month" selected>Bulan</option>
                            <option value="year">Tahun</option>
                        </select>
                        <div class="absolute right-4 top-3.5 pointer-events-none text-gray-500">
                             <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path></svg>
                        </div>
                    </div>
                </div>
            </div>

            <button type="submit" class="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold py-3.5 px-6 rounded-xl shadow-lg shadow-purple-600/20 transform transition-all active:scale-[0.98]">
                Generate Trial Code
            </button>
        </form>
        </div>
    </div>
    </main>
    </div>

    <!-- Success Modal -->
    ${successCode ? `
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
        <div class="bg-gray-900 border border-white/10 rounded-3xl p-8 max-w-md w-full text-center relative shadow-2xl shadow-blue-500/20">
            <div class="w-16 h-16 mx-auto bg-green-500/20 rounded-full flex items-center justify-center mb-6 text-green-400">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>
            </div>
            <h3 class="text-2xl font-bold text-white mb-2">Trial Berhasil Dibuat!</h3>
            <p class="text-gray-400 mb-6">Salin kode berikut dan berikan kepada user</p>
            
            <div class="bg-gray-800 rounded-xl p-4 mb-6 border border-gray-700 flex items-center justify-between group cursor-pointer relative" onclick="copyCode(this)">
                <code class="text-xl font-mono text-blue-400 font-bold tracking-wider select-all">${successCode}</code>
                <div class="text-gray-500 group-hover:text-white transition-colors">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                </div>
                 <div class="absolute inset-0 bg-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl"></div>
            </div>

            <a href="/admin/trials/create" class="inline-block px-6 py-3 bg-gray-800 hover:bg-gray-700 text-white rounded-xl font-medium transition-colors">
                Buat Lagi
            </a>
        </div>
    </div>
    <script>
        function copyCode(el) {
            const code = el.querySelector('code').innerText;
            navigator.clipboard.writeText(code).then(() => {
                // Flash effect
                el.classList.add('ring-2', 'ring-green-500', 'bg-green-500/10');
                setTimeout(() => {
                     el.classList.remove('ring-2', 'ring-green-500', 'bg-green-500/10');
                }, 500);
            });
        }
    </script>
    ` : ''}
    `;

  return baseLayout('Buat Trial', content, '');
};
