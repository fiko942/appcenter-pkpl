import { baseLayout } from './layout';
import { getAdminSidebar } from './components/admin-sidebar';
import { sanitizeTutorials, ProductTutorialItem } from '../utils/youtube';
import { sftpService, ProductInstallerFiles } from '../services/sftpService';

export interface ProductItem {
    id: number;
    name: string;
    image: string;
    product_id: number;
    description: string;
    price: number;
    is_discount: boolean;
    discount_percent: number;
    is_active: boolean;
    tutorials?: string | null;
    installer_files?: string | null;
}

export interface AdminProductsData {
    adminName: string;
    products: ProductItem[];
    successMessage?: string;
    errorMessage?: string;
}

export const adminProductsPage = (data: AdminProductsData): string => {
    const totalProducts = data.products.length;
    const activeProducts = data.products.filter(p => p.is_active).length;
    const discountProducts = data.products.filter(p => p.is_discount).length;
    const avgPrice = totalProducts > 0 
        ? Math.round(data.products.reduce((acc, p) => acc + p.price, 0) / totalProducts) 
        : 0;

    const formatIDR = (num: number) => {
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
    };

    const tableRowsHtml = data.products.map(product => {
        const finalPrice = product.is_discount && product.discount_percent 
            ? Math.round(product.price - (product.price * product.discount_percent / 100))
            : product.price;

        const tutorialsList: ProductTutorialItem[] = sanitizeTutorials(product.tutorials);
        const tutCount = tutorialsList.length;

        const installerFiles: ProductInstallerFiles = sftpService.parseInstallerFiles(product.installer_files);
        const winFiles = installerFiles.windows || [];
        const macFiles = installerFiles.mac || [];

        return `
        <tr class="hover:bg-gray-800/50 transition-colors border-b border-gray-800/50 product-row" data-name="${product.name.toLowerCase()}">
            <td class="px-5 py-4 whitespace-nowrap text-sm font-mono text-gray-400">#${product.id}</td>
            <td class="px-5 py-4 whitespace-nowrap">
                <div class="text-sm font-semibold text-white">${product.name}</div>
                ${product.description ? `<div class="text-xs text-gray-400 max-w-xs truncate">${product.description}</div>` : ''}
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-sm font-mono text-gray-300">
                ${product.product_id || product.id}
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-sm text-gray-300 font-medium">
                ${product.price === 0 ? '<span class="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-black bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">GRATIS</span>' : formatIDR(product.price)}
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                ${product.price === 0 ? `
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Free Claim
                    </span>
                ` : product.is_discount ? `
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        Diskon ${product.discount_percent || 0}%
                    </span>
                    <div class="text-xs text-emerald-400 font-bold mt-0.5">${formatIDR(finalPrice)}</div>
                ` : `
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800 text-gray-400">
                        Normal
                    </span>
                `}
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                ${tutCount > 0 ? `
                    <button type="button" onclick="openTutorialModal(${product.id})" class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer transform hover:scale-105" title="Klik untuk memutar tutorial video">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>${tutCount} Video</span>
                    </button>
                ` : `
                    <button type="button" onclick="openEditModal(${product.id})" class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-800/80 text-gray-400 hover:text-gray-200 border border-gray-700/50 hover:bg-gray-700/50 transition-colors" title="Tambah tutorial">
                        <span>+ Tambah</span>
                    </button>
                `}
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                <button type="button" onclick="openInstallerModal(${product.id})" class="inline-flex items-center gap-2 px-2.5 py-1 rounded-xl bg-gray-900/80 hover:bg-gray-800 border border-gray-800 hover:border-gray-700 transition-all cursor-pointer group" title="Kelola File Installer App">
                    <div class="flex items-center gap-1.5">
                        <span class="inline-flex items-center gap-0.5 text-[11px] font-medium ${winFiles.length > 0 ? 'text-emerald-400' : 'text-gray-500'}">
                            <span>🪟</span>
                            <span>${winFiles.length > 0 ? `${winFiles.length} file` : '-'}</span>
                        </span>
                        <span class="text-gray-700">|</span>
                        <span class="inline-flex items-center gap-0.5 text-[11px] font-medium ${macFiles.length > 0 ? 'text-emerald-400' : 'text-gray-500'}">
                            <span>🍎</span>
                            <span>${macFiles.length > 0 ? `${macFiles.length} file` : '-'}</span>
                        </span>
                    </div>
                    <svg class="w-3.5 h-3.5 text-gray-500 group-hover:text-blue-400 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                </button>
            </td>
            <td class="px-5 py-4 whitespace-nowrap">
                <button type="button" onclick="toggleProductStatus(${product.id}, this)" class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 transform hover:scale-105 ${product.is_active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' : 'bg-gray-800 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50'}" title="Klik untuk mengubah status member">
                    <span class="w-1.5 h-1.5 rounded-full ${product.is_active ? 'bg-emerald-400' : 'bg-gray-500'}"></span>
                    <span class="status-label">${product.is_active ? 'Aktif' : 'Nonaktif'}</span>
                </button>
            </td>
            <td class="px-5 py-4 whitespace-nowrap text-sm font-medium">
                <div class="flex items-center gap-1.5">
                    <button onclick="openInstallerModal(${product.id})" class="p-1.5 bg-cyan-500/10 text-cyan-400 hover:bg-cyan-500/20 rounded-lg border border-cyan-500/20 transition-colors" title="Kelola File Installer App (Mac & Windows)">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                    </button>
                    ${tutCount > 0 ? `
                    <button onclick="openTutorialModal(${product.id})" class="p-1.5 bg-purple-500/10 text-purple-400 hover:bg-purple-500/20 rounded-lg border border-purple-500/20 transition-colors" title="Putar Tutorial Video">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </button>
                    ` : ''}
                    <button onclick="openEditModal(${product.id})" class="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg border border-blue-500/20 transition-colors" title="Edit Produk">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </button>
                    <button onclick="openDeleteModal(${product.id}, '${product.name.replace(/'/g, "\\'")}')" class="p-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg border border-red-500/20 transition-colors" title="Hapus Produk">
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                    </button>
                </div>
            </td>
        </tr>
        `;
    }).join('');

    const content = `
    <div class="flex h-screen bg-gray-950 text-white overflow-hidden">
        ${getAdminSidebar('products', { adminName: data.adminName })}

        <main class="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8 pt-16 md:pt-8 ml-0 md:ml-64 transition-all min-w-0">
            <!-- Header -->
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-8">
                <div>
                    <h1 class="text-2xl font-bold text-white">Kelola Produk & Software</h1>
                    <p class="text-gray-400 text-sm mt-1">Kelola katalog produk, file installer aplikasi (Windows & Mac via SFTP), harga, diskon, dan tutorial video.</p>
                </div>
                <button onclick="openAddModal()" class="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-blue-500/20 border border-blue-400/20 transition-all transform hover:-translate-y-0.5">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    Tambah Produk Baru
                </button>
            </div>

            <!-- Notifications -->
            ${data.successMessage ? `
            <div class="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-sm flex items-center gap-3">
                <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>${data.successMessage}</span>
            </div>
            ` : ''}

            ${data.errorMessage ? `
            <div class="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl text-sm flex items-center gap-3">
                <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
                <span>${data.errorMessage}</span>
            </div>
            ` : ''}

            <!-- Stats Grid -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
                <div class="bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-800/80">
                    <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Total Produk</div>
                    <div class="text-3xl font-extrabold text-white">${totalProducts}</div>
                    <div class="text-xs text-gray-500 mt-1"><span id="activeProductsCount">${activeProducts}</span> produk aktif di member</div>
                </div>
                <div class="bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-800/80">
                    <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Produk Diskon</div>
                    <div class="text-3xl font-extrabold text-emerald-400">${discountProducts}</div>
                    <div class="text-xs text-gray-500 mt-1">Memiliki potongan harga aktif</div>
                </div>
                <div class="bg-gray-900/60 backdrop-blur-xl p-5 rounded-2xl border border-gray-800/80">
                    <div class="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-2">Rata-rata Harga</div>
                    <div class="text-3xl font-extrabold text-blue-400">${formatIDR(avgPrice)}</div>
                    <div class="text-xs text-gray-500 mt-1">Harga dasar rata-rata</div>
                </div>
            </div>

            <!-- Search Bar & Table Container -->
            <div class="bg-gray-900/60 backdrop-blur-xl rounded-2xl border border-gray-800/80 overflow-hidden shadow-xl">
                <div class="p-4 border-b border-gray-800/80 flex items-center justify-between gap-4">
                    <div class="relative flex-1 max-w-xs">
                        <svg class="w-4 h-4 absolute left-3.5 top-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input type="text" id="searchInput" onkeyup="filterProducts()" placeholder="Cari produk..." class="w-full pl-10 pr-4 py-2 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500 transition-colors">
                    </div>
                </div>

                <div class="overflow-x-auto">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-gray-950/80 text-gray-400 text-xs uppercase font-semibold border-b border-gray-800/80">
                                <th class="px-5 py-3.5">ID</th>
                                <th class="px-5 py-3.5">Nama Produk</th>
                                <th class="px-5 py-3.5">Product ID</th>
                                <th class="px-5 py-3.5">Harga Dasar</th>
                                <th class="px-5 py-3.5">Diskon</th>
                                <th class="px-5 py-3.5">Tutorial Video</th>
                                <th class="px-5 py-3.5">File Installer</th>
                                <th class="px-5 py-3.5">Status</th>
                                <th class="px-5 py-3.5">Aksi</th>
                            </tr>
                        </thead>
                        <tbody id="productTableBody" class="divide-y divide-gray-800/40">
                            ${tableRowsHtml.length > 0 ? tableRowsHtml : `
                                <tr>
                                    <td colspan="9" class="px-6 py-12 text-center text-gray-500 text-sm italic">Belum ada produk terdaftar. Klik "+ Tambah Produk Baru" untuk menambahkan.</td>
                                </tr>
                            `}
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <!-- Modal Tambah Produk -->
    <div id="addProductModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm hidden opacity-0 transition-opacity duration-200">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl transform scale-95 transition-transform duration-200">
            <div class="flex items-center justify-between mb-5 border-b border-gray-800 pb-4 sticky top-0 bg-gray-900 z-10">
                <h3 class="text-lg font-bold text-white">Tambah Produk Baru</h3>
                <button onclick="closeAddModal()" class="text-gray-400 hover:text-white transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <form id="addProductForm" action="/admin/products/create" method="POST" onsubmit="return handleFormSubmit('add')" class="space-y-4">
                <input type="hidden" id="add_tutorials_json" name="tutorials" value="[]">

                <div>
                    <label class="block text-xs font-semibold text-gray-300 uppercase mb-1">Nama Produk <span class="text-red-400">*</span></label>
                    <input type="text" name="name" required placeholder="Contoh: Ziqva Auto Bot V2" class="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-300 uppercase mb-1">Harga Dasar (IDR) <span class="text-red-400">*</span></label>
                    <input type="number" name="price" required min="0" placeholder="150000" class="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                
                <div class="bg-gray-950/60 p-3.5 rounded-xl border border-gray-800/80 space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-medium text-gray-300 cursor-pointer flex items-center gap-2">
                            <input type="checkbox" name="is_active" value="true" checked class="w-4 h-4 rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-blue-500">
                            Tampilkan di Menu Pembelian Member (Boleh Diorder)
                        </label>
                    </div>
                </div>

                <div class="bg-gray-950/60 p-3.5 rounded-xl border border-gray-800/80 space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-medium text-gray-300 cursor-pointer flex items-center gap-2">
                            <input type="checkbox" id="add_is_discount" name="is_discount" value="true" onchange="toggleDiscountField('add')" class="w-4 h-4 rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-blue-500">
                            Aktifkan Diskon
                        </label>
                    </div>
                    <div id="add_discount_container" class="hidden">
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Persentase Diskon (%)</label>
                        <input type="number" name="discount_percent" min="0" max="100" placeholder="10" class="w-full px-3.5 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-300 uppercase mb-1">Deskripsi Produk (Optional)</label>
                    <textarea name="description" rows="2" placeholder="Deskripsi singkat fitur software..." class="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"></textarea>
                </div>

                <!-- Tutorial Videos Section -->
                <div class="bg-gray-950/80 p-4 rounded-xl border border-gray-800/90 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Tutorial Video YouTube (Optional)
                            </span>
                            <p class="text-xs text-gray-400 mt-0.5">Mendukung link video YouTube biasa, Shorts, maupun link Playlist.</p>
                        </div>
                        <button type="button" onclick="addTutorialRow('add')" class="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-medium transition-colors">
                            + Tambah Video
                        </button>
                    </div>

                    <div id="add_tutorials_container" class="space-y-2.5 pt-1">
                        <!-- Dynamic rows will be inserted here -->
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                    <button type="button" onclick="closeAddModal()" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all">Simpan Produk</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal Edit Produk -->
    <div id="editProductModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm hidden opacity-0 transition-opacity duration-200">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl transform scale-95 transition-transform duration-200">
            <div class="flex items-center justify-between mb-5 border-b border-gray-800 pb-4 sticky top-0 bg-gray-900 z-10">
                <h3 class="text-lg font-bold text-white">Edit Produk & Tutorial</h3>
                <button onclick="closeEditModal()" class="text-gray-400 hover:text-white transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
            <form id="editProductForm" method="POST" onsubmit="return handleFormSubmit('edit')" class="space-y-4">
                <input type="hidden" id="edit_tutorials_json" name="tutorials" value="[]">

                <div>
                    <label class="block text-xs font-semibold text-gray-300 uppercase mb-1">Nama Produk <span class="text-red-400">*</span></label>
                    <input type="text" id="edit_name" name="name" required class="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500">
                </div>
                <div>
                    <label class="block text-xs font-semibold text-gray-300 uppercase mb-1">Harga Dasar (IDR) <span class="text-red-400">*</span></label>
                    <input type="number" id="edit_price" name="price" required min="0" class="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500">
                </div>

                <div class="bg-gray-950/60 p-3.5 rounded-xl border border-gray-800/80 space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-medium text-gray-300 cursor-pointer flex items-center gap-2">
                            <input type="checkbox" id="edit_is_active" name="is_active" value="true" class="w-4 h-4 rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-blue-500">
                            Tampilkan di Menu Pembelian Member (Boleh Diorder)
                        </label>
                    </div>
                </div>

                <div class="bg-gray-950/60 p-3.5 rounded-xl border border-gray-800/80 space-y-3">
                    <div class="flex items-center justify-between">
                        <label class="text-sm font-medium text-gray-300 cursor-pointer flex items-center gap-2">
                            <input type="checkbox" id="edit_is_discount" name="is_discount" value="true" onchange="toggleDiscountField('edit')" class="w-4 h-4 rounded border-gray-800 bg-gray-900 text-blue-500 focus:ring-blue-500">
                            Aktifkan Diskon
                        </label>
                    </div>
                    <div id="edit_discount_container" class="hidden">
                        <label class="block text-xs font-semibold text-gray-400 uppercase mb-1">Persentase Diskon (%)</label>
                        <input type="number" id="edit_discount_percent" name="discount_percent" min="0" max="100" class="w-full px-3.5 py-2 bg-gray-900 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500">
                    </div>
                </div>

                <div>
                    <label class="block text-xs font-semibold text-gray-300 uppercase mb-1">Deskripsi Produk</label>
                    <textarea id="edit_description" name="description" rows="2" class="w-full px-3.5 py-2.5 bg-gray-950 border border-gray-800 rounded-xl text-sm text-white focus:outline-none focus:border-blue-500"></textarea>
                </div>

                <!-- Tutorial Videos Section -->
                <div class="bg-gray-950/80 p-4 rounded-xl border border-gray-800/90 space-y-3">
                    <div class="flex items-center justify-between">
                        <div>
                            <span class="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                                Tutorial Video YouTube
                            </span>
                            <p class="text-xs text-gray-400 mt-0.5">Mendukung link video YouTube biasa, Shorts, maupun link Playlist.</p>
                        </div>
                        <button type="button" onclick="addTutorialRow('edit')" class="inline-flex items-center gap-1 px-3 py-1 bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 border border-purple-500/30 rounded-lg text-xs font-medium transition-colors">
                            + Tambah Video
                        </button>
                    </div>

                    <div id="edit_tutorials_container" class="space-y-2.5 pt-1">
                        <!-- Dynamic rows will be inserted here -->
                    </div>
                </div>

                <div class="flex items-center justify-end gap-3 pt-3 border-t border-gray-800">
                    <button type="button" onclick="closeEditModal()" class="px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors">Batal</button>
                    <button type="submit" class="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-blue-500/20 transition-all">Simpan Perubahan</button>
                </div>
            </form>
        </div>
    </div>

    <!-- Modal Hapus Produk -->
    <div id="deleteProductModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/80 backdrop-blur-sm hidden opacity-0 transition-opacity duration-200">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl transform scale-95 transition-transform duration-200">
            <div class="text-center">
                <div class="w-12 h-12 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4">
                    <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                <h3 class="text-lg font-bold text-white mb-1">Konfirmasi Hapus Produk</h3>
                <p class="text-sm text-gray-400 mb-6">Apakah Anda yakin ingin menghapus produk <span id="delete_product_name" class="font-bold text-white"></span>? Tindakan ini tidak dapat dibatalkan.</p>
                <form id="deleteProductForm" method="POST" class="flex items-center justify-center gap-3">
                    <button type="button" onclick="closeDeleteModal()" class="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors">Batal</button>
                    <button type="submit" class="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl text-sm shadow-lg shadow-red-500/20 transition-all">Ya, Hapus Produk</button>
                </form>
            </div>
        </div>
    </div>

    <!-- Modal Kelola File Installer (SFTP) -->
    <div id="manageAppFileModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/85 backdrop-blur-md hidden opacity-0 transition-opacity duration-200 p-4">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl transform scale-95 transition-transform duration-200 p-6">
            <div class="flex items-center justify-between pb-4 mb-5 border-b border-gray-800 sticky top-0 bg-gray-900 z-10">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 rounded-xl">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-lg font-bold text-white leading-tight">Kelola File Installer Software</h3>
                        <p id="installer_modal_product_name" class="text-xs text-cyan-400 font-medium mt-0.5">Nama Produk</p>
                    </div>
                </div>
                <button onclick="closeInstallerModal()" class="text-gray-400 hover:text-white p-2 rounded-lg hover:bg-gray-800 transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Upload Destination Info Banner -->
            <div class="mb-5 p-3 bg-gray-950/80 border border-gray-800 rounded-xl flex items-center justify-between text-xs text-gray-400">
                <div class="flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>FTP Remote: <span class="font-mono text-gray-300">Remote Storage</span> (/setup-windows-bin/x86)</span>
                </div>
                <span class="text-[11px] text-cyan-400 font-medium">⚡ Chunk Upload 5MB Aktif</span>
            </div>

            <div class="space-y-6">
                <!-- Windows Installer Section -->
                <div class="bg-gray-950/70 border border-gray-800/90 rounded-2xl p-5 space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">🪟</span>
                            <div>
                                <h4 class="text-sm font-bold text-white">Installer Windows</h4>
                                <p class="text-[11px] text-gray-400">Dukungan banyak file: .exe, .zip, .rar, .7z</p>
                            </div>
                        </div>
                        <span id="win_badge_status" class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-400">Belum Ada</span>
                    </div>

                    <!-- List of Uploaded Windows Files -->
                    <div id="win_files_container" class="space-y-2">
                        <!-- Dynamic file cards rendered here -->
                    </div>

                    <!-- Progress Container Windows -->
                    <div id="win_progress_container" class="hidden p-3.5 bg-gray-900/90 border border-blue-500/30 rounded-xl space-y-2">
                        <div class="flex items-center justify-between text-xs">
                            <span id="win_progress_status" class="text-blue-400 font-semibold flex items-center gap-1.5">
                                <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Mengunggah...</span>
                            </span>
                            <span id="win_progress_pct" class="font-mono text-white font-bold">0%</span>
                        </div>
                        <div class="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div id="win_progress_bar" class="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-150" style="width: 0%"></div>
                        </div>
                        <div class="flex items-center justify-between text-[11px] text-gray-400">
                            <span id="win_progress_bytes">0 MB / 0 MB</span>
                            <span id="win_progress_speed" class="font-mono text-cyan-400">0 KB/s</span>
                        </div>
                    </div>

                    <!-- Upload Form Windows -->
                    <div class="pt-2 border-t border-gray-800/60">
                        <label class="block text-xs font-semibold text-gray-300 mb-2">+ Tambah File Installer Windows</label>
                        <form id="win_upload_form" onsubmit="return handleUploadInstaller(event, 'windows')" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            <input type="file" id="win_file_input" name="installer_file" accept=".exe,.zip,.rar,.7z" required class="flex-1 text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 bg-gray-900 border border-gray-800 rounded-xl p-1 cursor-pointer">
                            <button type="submit" id="win_upload_btn" class="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                <span>Upload Windows</span>
                            </button>
                        </form>
                    </div>
                </div>

                <!-- Mac Installer Section -->
                <div class="bg-gray-950/70 border border-gray-800/90 rounded-2xl p-5 space-y-4">
                    <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                            <span class="text-xl">🍎</span>
                            <div>
                                <h4 class="text-sm font-bold text-white">Installer macOS</h4>
                                <p class="text-[11px] text-gray-400">Dukungan banyak file: .dmg, .pkg, .zip, .rar, .7z</p>
                            </div>
                        </div>
                        <span id="mac_badge_status" class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-400">Belum Ada</span>
                    </div>

                    <!-- List of Uploaded Mac Files -->
                    <div id="mac_files_container" class="space-y-2">
                        <!-- Dynamic file cards rendered here -->
                    </div>

                    <!-- Progress Container Mac -->
                    <div id="mac_progress_container" class="hidden p-3.5 bg-gray-900/90 border border-indigo-500/30 rounded-xl space-y-2">
                        <div class="flex items-center justify-between text-xs">
                            <span id="mac_progress_status" class="text-indigo-400 font-semibold flex items-center gap-1.5">
                                <svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                <span>Mengunggah...</span>
                            </span>
                            <span id="mac_progress_pct" class="font-mono text-white font-bold">0%</span>
                        </div>
                        <div class="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                            <div id="mac_progress_bar" class="bg-gradient-to-r from-indigo-500 to-purple-400 h-2 rounded-full transition-all duration-150" style="width: 0%"></div>
                        </div>
                        <div class="flex items-center justify-between text-[11px] text-gray-400">
                            <span id="mac_progress_bytes">0 MB / 0 MB</span>
                            <span id="mac_progress_speed" class="font-mono text-indigo-400">0 KB/s</span>
                        </div>
                    </div>

                    <!-- Upload Form Mac -->
                    <div class="pt-2 border-t border-gray-800/60">
                        <label class="block text-xs font-semibold text-gray-300 mb-2">+ Tambah File Installer macOS</label>
                        <form id="mac_upload_form" onsubmit="return handleUploadInstaller(event, 'mac')" class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                            <input type="file" id="mac_file_input" name="installer_file" accept=".dmg,.pkg,.zip,.rar,.7z" required class="flex-1 text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-gray-800 file:text-gray-300 hover:file:bg-gray-700 bg-gray-900 border border-gray-800 rounded-xl p-1 cursor-pointer">
                            <button type="submit" id="mac_upload_btn" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-500/20 transition-all flex items-center justify-center gap-1.5 whitespace-nowrap cursor-pointer">
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                </svg>
                                <span>Upload macOS</span>
                            </button>
                        </form>
                    </div>
                </div>
            </div>

            <div class="flex justify-end pt-5 mt-6 border-t border-gray-800">
                <button type="button" onclick="closeInstallerModal()" class="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-xl text-sm font-medium transition-colors">Tutup</button>
            </div>
        </div>
    </div>

    <!-- Modal Interactive YouTube Tutorial Player -->
    <div id="productTutorialModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-md hidden opacity-0 transition-opacity duration-200 p-4">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col transform scale-95 transition-transform duration-200 max-h-[92vh]">
            <!-- Header Modal -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/80">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 id="player_product_name" class="text-base font-bold text-white leading-tight">Tutorial Produk</h3>
                        <p id="player_current_title" class="text-xs text-purple-400 font-medium">Memutar Video</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <a id="player_external_link" href="#" target="_blank" class="p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded-xl transition-colors text-xs flex items-center gap-1" title="Buka di YouTube">
                        <span>Buka di YouTube</span>
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                    <button onclick="closeTutorialModal()" class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Body Player & Playlist Layout -->
            <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
                <!-- Video Player Iframe (16:9 Aspect Ratio) -->
                <div class="flex-1 bg-black flex items-center justify-center min-h-[260px] md:min-h-[400px]">
                    <iframe id="tutorialVideoIframe" class="w-full h-full aspect-video border-0" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                </div>

                <!-- Playlist Sidebar / Selector -->
                <div class="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-800 bg-gray-950/60 p-4 flex flex-col">
                    <div class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center justify-between">
                        <span>Daftar Video Tutorial</span>
                        <span id="player_video_count" class="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-[11px]">0 Video</span>
                    </div>
                    <div id="player_playlist_container" class="flex-1 overflow-y-auto space-y-2 max-h-48 lg:max-h-[380px] pr-1">
                        <!-- Dynamic playlist buttons inserted here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        window.ADMIN_PRODUCTS = ${JSON.stringify(data.products || []).replace(/</g, '\\u003c')};
        window.PRODUCTS_MAP = {};
        window.ADMIN_PRODUCTS.forEach(function(p) { window.PRODUCTS_MAP[p.id] = p; });

        function getProductData(param) {
            if (!param && param !== 0) return null;
            if (typeof param === 'object') return param;
            return window.PRODUCTS_MAP[param] || null;
        }

        // ================= Installer Modal =================
        var activeInstallerProductId = null;
        var activeInstallerFiles = { windows: [], mac: [] };

        function openInstallerModal(param) {
            var product = getProductData(param);
            if (!product) return;

            activeInstallerProductId = product.id;
            var nameEl = document.getElementById('installer_modal_product_name') || document.getElementById('modal_installer_product_name');
            if (nameEl) nameEl.innerText = product.name || '';
            
            var parsed = { windows: [], mac: [] };
            try {
                if (product.installer_files) {
                    var raw = typeof product.installer_files === 'string' ? JSON.parse(product.installer_files) : product.installer_files;
                    if (raw && typeof raw === 'object') {
                        if (Array.isArray(raw.windows)) parsed.windows = raw.windows;
                        else if (raw.windows && raw.windows.filename) parsed.windows = [raw.windows];

                        if (Array.isArray(raw.mac)) parsed.mac = raw.mac;
                        else if (raw.mac && raw.mac.filename) parsed.mac = [raw.mac];
                    }
                }
            } catch (e) {
                parsed = { windows: [], mac: [] };
            }
            activeInstallerFiles = parsed;

            renderInstallerPreview('windows', activeInstallerFiles.windows);
            renderInstallerPreview('mac', activeInstallerFiles.mac);

            // Reset forms and progress
            var winInput = document.getElementById('win_file_input');
            if (winInput) winInput.value = '';
            var macInput = document.getElementById('mac_file_input');
            if (macInput) macInput.value = '';
            var winProg = document.getElementById('win_progress_container');
            if (winProg) winProg.classList.add('hidden');
            var macProg = document.getElementById('mac_progress_container');
            if (macProg) macProg.classList.add('hidden');

            var modal = document.getElementById('manageAppFileModal');
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(function() {
                    modal.classList.remove('opacity-0');
                    var inner = modal.querySelector('div');
                    if (inner) inner.classList.remove('scale-95');
                }, 10);
            }
        }

        function renderInstallerPreview(osType, filesList) {
            var badge = document.getElementById(osType === 'windows' ? 'win_badge_status' : 'mac_badge_status');
            var container = document.getElementById(osType === 'windows' ? 'win_files_container' : 'mac_files_container');
            if (!container) return;

            var list = Array.isArray(filesList) ? filesList : (filesList && filesList.filename ? [filesList] : []);

            if (badge) {
                if (list.length > 0) {
                    badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20';
                    badge.innerText = list.length + ' File Tersedia';
                } else {
                    badge.className = 'px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-800 text-gray-500';
                    badge.innerText = 'Belum Ada File';
                }
            }

            if (list.length === 0) {
                container.innerHTML = '<div class="p-3 text-center bg-gray-900/60 rounded-xl border border-gray-800/80 text-xs text-gray-500 italic">Belum ada file installer ' + (osType === 'windows' ? 'Windows' : 'macOS') + ' diupload.</div>';
                return;
            }

            var html = '';
            list.forEach(function(file) {
                var ext = (file.filename || '').split('.').pop().toUpperCase() || 'FILE';
                var d = file.uploaded_at ? new Date(file.uploaded_at * 1000) : new Date();
                var dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
                var safeFilename = (file.filename || '').replace(/'/g, "\\'").replace(/"/g, '&quot;');
                var safeId = file.id || '';

                html += '<div class="p-3 bg-gray-900 border border-gray-800 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">' +
                    '<div class="flex items-center gap-3 min-w-0">' +
                        '<div class="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 font-bold text-[10px] font-mono">' +
                            ext +
                        '</div>' +
                        '<div class="min-w-0">' +
                            '<div class="text-xs font-bold text-white truncate" title="' + safeFilename + '">' + file.filename + '</div>' +
                            '<div class="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">' +
                                '<span class="font-mono text-cyan-400">' + file.size + '</span>' +
                                '<span>•</span>' +
                                '<span>' + dateStr + '</span>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                    '<div class="flex items-center gap-2 flex-shrink-0">' +
                        '<a href="' + (file.url || '#') + '" target="_blank" class="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1">' +
                            '<span>Buka / Unduh</span>' +
                            '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>' +
                        '</a>' +
                        '<button type="button" onclick="handleDeleteInstallerFile(&quot;' + osType + '&quot;, &quot;' + safeId + '&quot;, &quot;' + safeFilename + '&quot;)" class="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors" title="Hapus File Ini">' +
                            '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>' +
                        '</button>' +
                    '</div>' +
                '</div>';
            });

            container.innerHTML = html;
        }

        function closeInstallerModal() {
            var modal = document.getElementById('manageAppFileModal');
            modal.classList.add('opacity-0');
            modal.querySelector('div').classList.add('scale-95');
            setTimeout(function() { modal.classList.add('hidden'); }, 200);
        }

        function formatBytesClient(bytes) {
            if (!bytes || bytes === 0) return '0 B';
            var k = 1024;
            var sizes = ['B', 'KB', 'MB', 'GB'];
            var i = Math.floor(Math.log(bytes) / Math.log(k));
            return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
        }

        // ================= High-Speed Chunked Upload with Multi-Phase Progress =================
        async function handleUploadInstaller(event, osType) {
            event.preventDefault();
            if (!activeInstallerProductId) return false;

            var input = document.getElementById(osType === 'windows' ? 'win_file_input' : 'mac_file_input');
            var btn = document.getElementById(osType === 'windows' ? 'win_upload_btn' : 'mac_upload_btn');
            var progressContainer = document.getElementById(osType === 'windows' ? 'win_progress_container' : 'mac_progress_container');
            var progressBar = document.getElementById(osType === 'windows' ? 'win_progress_bar' : 'mac_progress_bar');
            var progressPct = document.getElementById(osType === 'windows' ? 'win_progress_pct' : 'mac_progress_pct');
            var progressBytes = document.getElementById(osType === 'windows' ? 'win_progress_bytes' : 'mac_progress_bytes');
            var progressSpeed = document.getElementById(osType === 'windows' ? 'win_progress_speed' : 'mac_progress_speed');
            var progressStatus = document.getElementById(osType === 'windows' ? 'win_progress_status' : 'mac_progress_status');

            if (!input || !input.files || input.files.length === 0) {
                showToast('Pilih file installer terlebih dahulu', true);
                return false;
            }

            var file = input.files[0];
            var fileSize = file.size;
            var chunkSize = 5 * 1024 * 1024; // 5MB chunks
            var totalChunks = Math.ceil(fileSize / chunkSize);
            var uploadId = 'up_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);

            btn.disabled = true;
            input.disabled = true;
            progressContainer.classList.remove('hidden');
            progressBar.style.width = '0%';
            progressPct.innerText = '0%';
            progressBytes.innerText = '0 B / ' + formatBytesClient(fileSize);
            progressSpeed.innerText = 'Memulai...';
            progressStatus.innerHTML = '<svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Mengunggah file...</span>';

            var startTime = Date.now();
            var lastUploadedBytes = 0;
            var sftpInterval = null;

            try {
                for (var chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                    var start = chunkIndex * chunkSize;
                    var end = Math.min(fileSize, start + chunkSize);
                    var chunkBlob = file.slice(start, end);

                    var formData = new FormData();
                    formData.append('os', osType);
                    formData.append('filename', file.name);
                    formData.append('upload_id', uploadId);
                    formData.append('chunk_index', chunkIndex.toString());
                    formData.append('total_chunks', totalChunks.toString());
                    formData.append('total_size', fileSize.toString());
                    formData.append('chunk_file', chunkBlob, file.name + '.part' + chunkIndex);

                    var isLastChunk = (chunkIndex === totalChunks - 1);
                    if (isLastChunk) {
                        progressStatus.innerHTML = '<svg class="animate-spin w-3.5 h-3.5" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Menghubungkan & mentransfer ke SFTP Remote...</span>';
                        
                        var sftpProgress = 60;
                        sftpInterval = setInterval(function() {
                            if (sftpProgress < 95) {
                                sftpProgress += (95 - sftpProgress) * 0.1;
                                progressBar.style.width = Math.round(sftpProgress) + '%';
                                progressPct.innerText = Math.round(sftpProgress) + '%';
                            }
                        }, 500);
                    }

                    var response = await fetch('/admin/products/' + activeInstallerProductId + '/upload-chunk', {
                        method: 'POST',
                        body: formData
                    });

                    if (!response.ok) {
                        var errData = await response.json().catch(function() { return {}; });
                        throw new Error(errData.error || 'Gagal mengunggah bagian file');
                    }

                    var chunkResult = await response.json();
                    lastUploadedBytes = end;

                    var elapsedSec = (Date.now() - startTime) / 1000;
                    var speedBps = elapsedSec > 0 ? lastUploadedBytes / elapsedSec : 0;
                    progressSpeed.innerText = formatBytesClient(speedBps) + '/s';

                    if (!isLastChunk) {
                        var browserPct = (lastUploadedBytes / fileSize) * 60;
                        progressBar.style.width = browserPct.toFixed(1) + '%';
                        progressPct.innerText = Math.round(browserPct) + '%';
                        progressBytes.innerText = formatBytesClient(lastUploadedBytes) + ' / ' + formatBytesClient(fileSize);
                    } else {
                        if (sftpInterval) clearInterval(sftpInterval);
                        progressBar.style.width = '100%';
                        progressPct.innerText = '100%';
                        progressBytes.innerText = formatBytesClient(fileSize) + ' / ' + formatBytesClient(fileSize);
                        progressStatus.innerHTML = '<span class="text-emerald-400 font-bold">✓ Selesai diunggah ke SFTP!</span>';

                        if (chunkResult.success) {
                            showToast(chunkResult.message || 'File installer berhasil diupload ke server');
                            activeInstallerFiles = chunkResult.installer_files || {};
                            if (window.PRODUCTS_MAP[activeInstallerProductId]) {
                                window.PRODUCTS_MAP[activeInstallerProductId].installer_files = JSON.stringify(activeInstallerFiles);
                            }
                            renderInstallerPreview(osType, activeInstallerFiles[osType]);
                            input.value = '';
                        } else {
                            showToast(chunkResult.error || 'Gagal menyimpan file installer', true);
                        }
                    }
                }
            } catch (err) {
                if (sftpInterval) clearInterval(sftpInterval);
                console.error('Upload Error:', err);
                showToast(err.message || 'Gagal mengupload file installer ke server', true);
            } finally {
                btn.disabled = false;
                input.disabled = false;
                setTimeout(function() {
                    if (progressContainer) progressContainer.classList.add('hidden');
                }, 3000);
            }

            return false;
        }

        async function handleDeleteInstallerFile(osType, fileId, filename) {
            if (!activeInstallerProductId) return;
            if (!confirm('Apakah Anda yakin ingin menghapus file ' + filename + ' dari server?')) {
                return;
            }

            try {
                var response = await fetch('/admin/products/' + activeInstallerProductId + '/delete-installer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ os: osType, file_id: fileId, filename: filename })
                });
                var result = await response.json();

                if (response.ok && result.success) {
                    showToast(result.message || 'File installer berhasil dihapus dari server');
                    activeInstallerFiles = result.installer_files || {};
                    if (window.PRODUCTS_MAP[activeInstallerProductId]) {
                        window.PRODUCTS_MAP[activeInstallerProductId].installer_files = JSON.stringify(activeInstallerFiles);
                    }
                    renderInstallerPreview('windows', activeInstallerFiles.windows);
                    renderInstallerPreview('mac', activeInstallerFiles.mac);
                } else {
                    showToast(result.error || 'Gagal menghapus file installer', true);
                }
            } catch (err) {
                console.error('Error deleting installer file:', err);
                showToast('Terjadi kesalahan saat menghapus file installer', true);
            }
        }

        function filterProducts() {
            var input = document.getElementById('searchInput').value.toLowerCase();
            var rows = document.querySelectorAll('.product-row');
            rows.forEach(function(row) {
                var name = row.getAttribute('data-name');
                if (name.includes(input)) {
                    row.style.display = '';
                } else {
                    row.style.display = 'none';
                }
            });
        }

        function toggleDiscountField(type) {
            var checkbox = document.getElementById(type + '_is_discount');
            var container = document.getElementById(type + '_discount_container');
            if (checkbox.checked) {
                container.classList.remove('hidden');
            } else {
                container.classList.add('hidden');
            }
        }

        // ================= Dynamic Tutorial Repeater =================
        function addTutorialRow(type, title, url) {
            if (!title) title = '';
            if (!url) url = '';
            var container = document.getElementById(type + '_tutorials_container');
            if (!container) return;

            var rowId = 'tut_row_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            var div = document.createElement('div');
            div.id = rowId;
            div.className = 'tutorial-row flex items-center gap-2 p-2.5 bg-gray-900/90 border border-gray-800/80 rounded-xl';
            
            var safeTitle = title.replace(/"/g, '&quot;');
            var safeUrl = url.replace(/"/g, '&quot;');

            div.innerHTML = '<div class="flex-1 space-y-1.5">' +
                '<input type="text" placeholder="Judul Tutorial (contoh: Panduan Setup & Instalasi)" value="' + safeTitle + '" class="tut-title w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-purple-500">' +
                '<input type="text" placeholder="URL Video / Playlist YouTube (https://www.youtube.com/...)" value="' + safeUrl + '" class="tut-url w-full px-3 py-1.5 bg-gray-950 border border-gray-800 rounded-lg text-xs text-purple-300 placeholder-gray-500 focus:outline-none focus:border-purple-500 font-mono">' +
                '</div>' +
                '<button type="button" onclick="removeTutorialRow(&quot;' + rowId + '&quot;)" class="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors flex-shrink-0" title="Hapus tutorial">' +
                '<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">' +
                '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />' +
                '</svg>' +
                '</button>';
            container.appendChild(div);
        }

        function removeTutorialRow(rowId) {
            var el = document.getElementById(rowId);
            if (el) el.remove();
        }

        function handleFormSubmit(type) {
            var container = document.getElementById(type + '_tutorials_container');
            var hiddenInput = document.getElementById(type + '_tutorials_json');
            if (!container || !hiddenInput) return true;

            var rows = container.querySelectorAll('.tutorial-row');
            var tutorials = [];

            rows.forEach(function(row, index) {
                var titleInput = row.querySelector('.tut-title');
                var urlInput = row.querySelector('.tut-url');
                var title = titleInput ? titleInput.value.trim() : '';
                var url = urlInput ? urlInput.value.trim() : '';

                if (title || url) {
                    tutorials.push({
                        id: 'tut_' + Date.now() + '_' + (index + 1),
                        title: title || 'Tutorial ' + (index + 1),
                        url: url
                    });
                }
            });

            hiddenInput.value = JSON.stringify(tutorials);
            return true;
        }

        // ================= Modal Add / Edit / Delete =================
        function openAddModal() {
            var modal = document.getElementById('addProductModal');
            document.getElementById('add_tutorials_container').innerHTML = '';
            addTutorialRow('add');

            modal.classList.remove('hidden');
            setTimeout(function() {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
            }, 10);
        }

        function closeAddModal() {
            var modal = document.getElementById('addProductModal');
            modal.classList.add('opacity-0');
            modal.querySelector('div').classList.add('scale-95');
            setTimeout(function() { modal.classList.add('hidden'); }, 200);
        }

        function openEditModal(param) {
            var product = getProductData(param);
            if (!product) return;

            document.getElementById('editProductForm').action = '/admin/products/edit/' + product.id;
            document.getElementById('edit_name').value = product.name || '';
            document.getElementById('edit_price').value = product.price || 0;
            document.getElementById('edit_description').value = product.description || '';
            document.getElementById('edit_is_active').checked = Boolean(product.is_active !== false);

            var isDiscount = Boolean(product.is_discount);
            document.getElementById('edit_is_discount').checked = isDiscount;
            document.getElementById('edit_discount_percent').value = product.discount_percent || 0;
            toggleDiscountField('edit');

            var container = document.getElementById('edit_tutorials_container');
            container.innerHTML = '';
            var tuts = [];
            try {
                if (product.tutorials) {
                    tuts = typeof product.tutorials === 'string' ? JSON.parse(product.tutorials) : product.tutorials;
                }
            } catch (e) {
                tuts = [];
            }

            if (Array.isArray(tuts) && tuts.length > 0) {
                tuts.forEach(function(t) { addTutorialRow('edit', t.title || '', t.url || ''); });
            } else {
                addTutorialRow('edit');
            }

            var modal = document.getElementById('editProductModal');
            modal.classList.remove('hidden');
            setTimeout(function() {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
            }, 10);
        }

        function closeEditModal() {
            var modal = document.getElementById('editProductModal');
            modal.classList.add('opacity-0');
            modal.querySelector('div').classList.add('scale-95');
            setTimeout(function() { modal.classList.add('hidden'); }, 200);
        }

        function openDeleteModal(id, name) {
            var form = document.getElementById('deleteProductForm');
            if (form) form.action = '/admin/products/delete/' + id;
            var nameEl = document.getElementById('delete_product_name');
            if (nameEl) nameEl.innerText = name || '';

            var modal = document.getElementById('deleteProductModal');
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(function() {
                    modal.classList.remove('opacity-0');
                    var inner = modal.querySelector('div');
                    if (inner) inner.classList.remove('scale-95');
                }, 10);
            }
        }

        function closeDeleteModal() {
            var modal = document.getElementById('deleteProductModal');
            if (modal) {
                modal.classList.add('opacity-0');
                var inner = modal.querySelector('div');
                if (inner) inner.classList.add('scale-95');
                setTimeout(function() { modal.classList.add('hidden'); }, 200);
            }
        }

        // ================= Interactive YouTube Player Modal =================
        var currentTutorialsList = [];

        function parseClientYouTubeEmbed(url) {
            if (!url) return '';
            var clean = url.trim();
            var listMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
            if (clean.includes('/playlist') && listMatch) {
                return 'https://www.youtube-nocookie.com/embed/videoseries?list=' + listMatch[1];
            }
            var shortsMatch = clean.match(new RegExp('youtube\\.com/shorts/([a-zA-Z0-9_-]+)', 'i'));
            if (shortsMatch) {
                return 'https://www.youtube-nocookie.com/embed/' + shortsMatch[1];
            }
            var youtuMatch = clean.match(new RegExp('youtu\\.be/([a-zA-Z0-9_-]+)', 'i'));
            if (youtuMatch) {
                return 'https://www.youtube-nocookie.com/embed/' + youtuMatch[1] + (listMatch ? '?list=' + listMatch[1] : '');
            }
            var watchMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]+)/i);
            if (watchMatch) {
                return 'https://www.youtube-nocookie.com/embed/' + watchMatch[1] + (listMatch ? '?list=' + listMatch[1] : '');
            }
            if (clean.includes('youtube.com/embed/')) {
                return clean.replace('youtube.com/embed/', 'youtube-nocookie.com/embed/');
            }
            return clean;
        }

        function openTutorialModal(param) {
            var product = getProductData(param);
            if (!product) return;

            var pName = document.getElementById('player_product_name');
            if (pName) pName.innerText = product.name || '';
            var tuts = [];
            try {
                if (product.tutorials) {
                    tuts = typeof product.tutorials === 'string' ? JSON.parse(product.tutorials) : product.tutorials;
                }
            } catch (e) {
                tuts = [];
            }

            currentTutorialsList = Array.isArray(tuts) ? tuts : [];
            var playlistContainer = document.getElementById('player_playlist_container');
            if (playlistContainer) playlistContainer.innerHTML = '';
            var vCount = document.getElementById('player_video_count');
            if (vCount) vCount.innerText = currentTutorialsList.length + ' Video';

            if (currentTutorialsList.length === 0) {
                if (playlistContainer) playlistContainer.innerHTML = '<div class="text-xs text-gray-500 italic p-3">Belum ada video tutorial untuk produk ini.</div>';
                var iframe = document.getElementById('tutorialVideoIframe');
                if (iframe) iframe.src = '';
                var curTitle = document.getElementById('player_current_title');
                if (curTitle) curTitle.innerText = 'Tidak ada video';
                var extLink = document.getElementById('player_external_link');
                if (extLink) extLink.href = '#';
            } else {
                if (playlistContainer) {
                    currentTutorialsList.forEach(function(tut, idx) {
                        var btn = document.createElement('button');
                        btn.id = 'tut_btn_' + idx;
                        btn.type = 'button';
                        btn.className = 'w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ' + (idx === 0 ? 'bg-purple-500/15 border-purple-500/40 text-white' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800/80 hover:text-white');
                        btn.onclick = function() { selectTutorialVideo(idx); };

                        var isPl = tut.url && tut.url.includes('list=');
                        btn.innerHTML = '<div class="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold font-mono">' +
                            (idx + 1) +
                            '</div>' +
                            '<div class="flex-1 min-w-0">' +
                            '<div class="text-xs font-semibold truncate">' + (tut.title || 'Video ' + (idx + 1)) + '</div>' +
                            '<div class="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">' +
                            '<span>' + (isPl ? '📑 Playlist' : '🎬 Video') + '</span>' +
                            '</div>' +
                            '</div>';
                        playlistContainer.appendChild(btn);
                    });
                }

                selectTutorialVideo(0);
            }

            var modal = document.getElementById('productTutorialModal');
            if (modal) {
                modal.classList.remove('hidden');
                setTimeout(function() {
                    modal.classList.remove('opacity-0');
                    var inner = modal.querySelector('div');
                    if (inner) inner.classList.remove('scale-95');
                }, 10);
            }
        }

        function selectTutorialVideo(index) {
            if (!currentTutorialsList || !currentTutorialsList[index]) return;
            var item = currentTutorialsList[index];

            currentTutorialsList.forEach(function(_, idx) {
                var btn = document.getElementById('tut_btn_' + idx);
                if (btn) {
                    if (idx === index) {
                        btn.className = 'w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 bg-purple-500/15 border-purple-500/40 text-white shadow-lg shadow-purple-500/10';
                    } else {
                        btn.className = 'w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800/80 hover:text-white';
                    }
                }
            });

            var embedUrl = parseClientYouTubeEmbed(item.url);
            var iframe = document.getElementById('tutorialVideoIframe');
            if (iframe) iframe.src = embedUrl;
            var curTitle = document.getElementById('player_current_title');
            if (curTitle) curTitle.innerText = item.title || 'Memutar Video #' + (index + 1);
            var extLink = document.getElementById('player_external_link');
            if (extLink) extLink.href = item.url || '#';
        }

        function closeTutorialModal() {
            var iframe = document.getElementById('tutorialVideoIframe');
            if (iframe) iframe.src = '';
            var modal = document.getElementById('productTutorialModal');
            if (modal) {
                modal.classList.add('opacity-0');
                var inner = modal.querySelector('div');
                if (inner) inner.classList.add('scale-95');
                setTimeout(function() { modal.classList.add('hidden'); }, 200);
            }
        }

        // ================= Product Toggle Status & Toast =================
        async function toggleProductStatus(productId, buttonElement) {
            try {
                buttonElement.disabled = true;
                const response = await fetch('/admin/products/toggle-status/' + productId, {
                    method: 'POST'
                });
                const data = await response.json();
                if (response.ok && data.success) {
                    const dot = buttonElement.querySelector('span:first-child');
                    const label = buttonElement.querySelector('.status-label');
                    const countElem = document.getElementById('activeProductsCount');
                    let currentCount = countElem ? parseInt(countElem.textContent || '0', 10) : 0;

                    if (data.is_active) {
                        buttonElement.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 transform hover:scale-105 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20";
                        if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-emerald-400";
                        if (label) label.textContent = "Aktif";
                        if (countElem) countElem.textContent = currentCount + 1;
                    } else {
                        buttonElement.className = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition-all duration-200 transform hover:scale-105 bg-gray-800 text-gray-400 border border-gray-700/50 hover:bg-gray-700/50";
                        if (dot) dot.className = "w-1.5 h-1.5 rounded-full bg-gray-500";
                        if (label) label.textContent = "Nonaktif";
                        if (countElem) countElem.textContent = Math.max(0, currentCount - 1);
                    }

                    showToast(data.message || 'Status produk berhasil diubah');
                } else {
                    showToast(data.error || 'Gagal mengubah status produk', true);
                }
            } catch (err) {
                console.error('Error toggling status:', err);
                showToast('Terjadi kesalahan jaringan', true);
            } finally {
                buttonElement.disabled = false;
            }
        }

        function showToast(message, isError) {
            var toast = document.getElementById('toastNotification');
            if (!toast) {
                toast = document.createElement('div');
                toast.id = 'toastNotification';
                document.body.appendChild(toast);
            }
            var baseClasses = 'fixed bottom-5 right-5 z-50 px-4 py-3 rounded-xl shadow-lg border text-sm flex items-center gap-2 transition-all duration-300 ';
            var statusClasses = isError ? 'bg-red-900/90 border-red-500/50 text-red-200' : 'bg-emerald-900/90 border-emerald-500/50 text-emerald-200';
            toast.className = baseClasses + statusClasses;
            toast.innerHTML = (isError 
                ? '<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg><span>'
                : '<svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg><span>') + message + '</span>';
            
            setTimeout(function() {
                toast.classList.remove('translate-y-10', 'opacity-0');
            }, 10);

            setTimeout(function() {
                toast.classList.add('translate-y-10', 'opacity-0');
            }, 3000);
        }
    </script>
    `;

    return baseLayout('Kelola Produk', content);
};
