import { baseLayout } from './layout';
import { getMemberSidebar } from './components/member-sidebar';

interface Product {
    id: number;
    product_id: number;
    name: string;
    description?: string;
    price: number;
    is_discount: boolean;
    discount_percent: number;
    tutorials?: string | null;
}

interface CreateOrderData {
    name: string;
    email: string;
    avatar?: string;
    products: Product[];
    selectedProductId?: number;
}

export const memberCreateOrderPage = (data: CreateOrderData, error?: string): string => {
    const sidebar = getMemberSidebar('orders', {
        name: data.name,
        email: data.email,
        avatar: data.avatar
    });

    const products = data.products || [];
    const selectedProd = products.find(p => p.id === data.selectedProductId) || products[0] || {
        id: 1,
        product_id: 1,
        name: 'Ziqva Automation Bot',
        description: 'Software bot otomatis untuk mempercepat proses bisnis dan mengoptimalkan konversi toko online Anda.',
        price: 99000,
        is_discount: true,
        discount_percent: 20
    };

    const productOptions = products.map(p => {
        let priceLabel = `Rp ${p.price.toLocaleString('id-ID')}`;
        if (p.is_discount && p.discount_percent > 0) {
            const discounted = p.price - (p.price * p.discount_percent / 100);
            priceLabel = `Rp ${discounted.toLocaleString('id-ID')} (Disc ${p.discount_percent}%)`;
        }
        const isSel = p.id === selectedProd.id ? 'selected' : '';
        return `<option value="${p.id}" data-price="${p.price}" data-discount="${p.is_discount ? p.discount_percent : 0}" ${isSel}>${p.name} - ${priceLabel}</option>`;
    }).join('');

    const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(selectedProd.price);

    const content = `
    <div class="min-h-screen flex">
        ${sidebar}

        <!-- Main Inset Content Area -->
        <div class="site-main flex-1 md:pl-64 flex flex-col">
            <!-- Sticky Topbar -->
            <header class="topbar">
                <div class="flex items-center gap-3">
                    <button id="sidebar-toggle-top" class="md:hidden p-1 text-[var(--text-3)] hover:text-[var(--text)]" aria-label="Buka Menu">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span class="eyebrow">DETAIL PRODUK & PEMESANAN</span>
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

            <!-- Main Detail Content -->
            <main class="detail-content">
                <!-- Breadcrumb -->
                <nav class="breadcrumb">
                    <a href="/member/dashboard">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Beranda
                    </a>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <span>Software & Bot</span>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                    <strong id="breadcrumbProductName">${selectedProd.name}</strong>
                </nav>

                ${error ? `
                <div class="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-center gap-3">
                    <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>${error}</span>
                </div>
                ` : ''}

                <!-- Split Detail Hero -->
                <section class="detail-hero">
                    <!-- Visual Orbit Left -->
                    <div class="detail-visual product-visual blue">
                        <span class="corner-label">BEST SELLER</span>
                        <div class="detail-orbit">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                        </div>
                        <span class="detail-watermark">ZIQVA</span>
                    </div>

                    <!-- Info & Order Form Right -->
                    <div class="detail-info">
                        <span class="detail-category">Software Bot Otomatis</span>
                        <h1 id="productTitleHeading">${selectedProd.name}</h1>
                        <div class="rating">
                            <svg fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            <strong>4.9</strong>
                            <span>• 128 ulasan</span>
                            <span>• 1.2k+ pengguna aktif</span>
                        </div>

                        <p id="productDescriptionText">
                            ${selectedProd.description || 'Dirancang dengan antarmuka yang intuitif dan sistem otomatisasi handal sehingga dapat langsung digunakan oleh siapa pun tanpa keahlian teknis khusus.'}
                        </p>

                        <!-- Form Order Interaktif -->
                        <form action="/member/orders/create" method="POST" id="orderForm" class="space-y-4">
                            <!-- Dropdown Produk -->
                            <div>
                                <label class="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Pilih Produk</label>
                                <select name="product_id" id="productSelect" required
                                    class="w-full bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-[var(--text)] font-semibold text-sm focus:outline-none focus:border-[var(--brand)]">
                                    ${productOptions}
                                </select>
                            </div>

                            <!-- Pilihan Durasi -->
                            <div>
                                <label class="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Durasi Lisensi</label>
                                <div class="grid grid-cols-3 gap-2.5">
                                    <label class="cursor-pointer">
                                        <input type="radio" name="duration_select" value="1" class="peer sr-only" checked>
                                        <div class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-center transition-all peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand-soft)]">
                                            <span class="block text-xs font-bold text-[var(--text)]">1 Bulan</span>
                                        </div>
                                    </label>
                                    <label class="cursor-pointer">
                                        <input type="radio" name="duration_select" value="3" class="peer sr-only">
                                        <div class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-center transition-all peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand-soft)]">
                                            <span class="block text-xs font-bold text-[var(--text)]">3 Bulan</span>
                                        </div>
                                    </label>
                                    <label class="cursor-pointer">
                                        <input type="radio" name="duration_select" value="6" class="peer sr-only">
                                        <div class="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-2.5 text-center transition-all peer-checked:border-[var(--brand)] peer-checked:bg-[var(--brand-soft)]">
                                            <span class="block text-xs font-bold text-[var(--text)]">6 Bulan</span>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <!-- Voucher Kode -->
                            <div>
                                <label class="block text-xs font-bold text-gray-400 mb-1.5 uppercase tracking-wider">Kode Kupon / Voucher (Opsional)</label>
                                <div class="flex gap-2">
                                    <input type="text" name="voucher_code" id="voucherCodeInput" placeholder="Masukkan kode promo"
                                        class="flex-1 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl px-4 py-2.5 text-[var(--text)] text-sm focus:outline-none focus:border-[var(--brand)] uppercase font-mono">
                                </div>
                            </div>

                            <!-- Price Summary Box -->
                            <div class="detail-price">
                                <small>Total Estimasi Pembayaran</small>
                                <div>
                                    <strong id="displayPrice">${formattedPrice}</strong>
                                    <span id="savingsBadge">Hemat s/d 45%</span>
                                </div>
                            </div>

                            <!-- Submit Button -->
                            <button type="submit" class="order-button">
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                </svg>
                                Order Sekarang
                            </button>
                        </form>

                        <div class="safe-note">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span>
                                <strong>Transaksi aman & terjamin</strong>
                                <small>Akses produk dan lisensi langsung aktif setelah pembayaran diverifikasi sistem.</small>
                            </span>
                        </div>
                    </div>
                </section>

                <!-- Detail Body Feature Split -->
                <section class="detail-body">
                    <article>
                        <span class="kicker">INFORMASI & SPESIFIKASI</span>
                        <h2>Deskripsi Produk</h2>
                        <p id="productDescriptionFull">
                            ${selectedProd.description || 'Software otomasi desktop yang dirancang untuk mendukung efisiensi operasional harian Anda secara stabil dan teruji.'}
                        </p>
                        <h3>Fasilitas & Akses Lisensi</h3>
                        <ul>
                            <li>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Lisensi resmi terverifikasi sistem Ziqva
                            </li>
                            <li>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Pembaruan versi & perbaikan rilis berkala
                            </li>
                            <li>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Panduan instalasi & dokumentasi tutorial
                            </li>
                            <li>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                </svg>
                                Layanan dukungan teknis member area
                            </li>
                        </ul>
                    </article>

                    <aside>
                        <h3>Ringkasan Lisensi</h3>
                        <dl>
                            <div>
                                <dt>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Masa Aktif
                                </dt>
                                <dd>${selectedProd.price === 0 ? 'Lisensi Gratis' : 'Sesuai Paket'}</dd>
                            </div>
                            <div>
                                <dt>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                    </svg>
                                    Aktivasi
                                </dt>
                                <dd>Instan Otomatis</dd>
                            </div>
                            <div>
                                <dt>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                                    </svg>
                                    Tipe Lisensi
                                </dt>
                                <dd>Machine ID Bound</dd>
                            </div>
                        </dl>
                        <p>Masih punya pertanyaan seputar produk?</p>
                        <a href="/member/tutorials">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Lihat Tutorial & FAQ
                        </a>
                    </aside>
                </section>

                <div class="back-products">
                    <a href="/member/dashboard">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        Kembali ke semua produk
                    </a>
                </div>
            </main>
        </div>
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            var select = document.getElementById('productSelect');
            var title = document.getElementById('productTitleHeading');
            var breadcrumb = document.getElementById('breadcrumbProductName');
            var displayPrice = document.getElementById('displayPrice');
            var durationRadios = document.querySelectorAll('input[name="duration_select"]');

            function updatePrice() {
                var selectedOption = select.options[select.selectedIndex];
                if (!selectedOption) return;

                var basePrice = parseFloat(selectedOption.getAttribute('data-price')) || 0;
                var discount = parseFloat(selectedOption.getAttribute('data-discount')) || 0;
                var duration = 2;

                durationRadios.forEach(function(r) {
                    if (r.checked) duration = parseInt(r.value) || 2;
                });

                // Calculate discounted price per duration unit
                var unitPrice = discount > 0 ? basePrice * (1 - discount / 100) : basePrice;
                var total = unitPrice * (duration / 2);

                displayPrice.textContent = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(total);
                title.textContent = selectedOption.text.split(' - ')[0];
                breadcrumb.textContent = selectedOption.text.split(' - ')[0];
            }

            select.addEventListener('change', updatePrice);
            durationRadios.forEach(function(r) {
                r.addEventListener('change', updatePrice);
            });
        });
    </script>
    `;

    return baseLayout('Detail Produk & Pemesanan', content);
};
