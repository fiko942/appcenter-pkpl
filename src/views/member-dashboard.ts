import { baseLayout } from './layout';
import { getMemberSidebar } from './components/member-sidebar';

interface ProductItem {
    id: number;
    name: string;
    description: string;
    price: number;
    is_discount: boolean;
    discount_percent: number;
    image?: string;
    product_id?: number;
    tutorials?: string | null;
}

interface MemberDashboardData {
    name: string;
    email: string;
    avatar?: string;
    products?: ProductItem[];
    totalOrders?: number;
    totalLicenses?: number;
}

export const memberDashboardPage = (data: MemberDashboardData): string => {
    const sidebar = getMemberSidebar('dashboard', {
        name: data.name,
        email: data.email,
        avatar: data.avatar
    });

    const products = data.products || [];
    const productCount = products.length > 0 ? products.length : 6;

    // Palette tones mapping for product visual banners
    const tones = ['blue', 'violet', 'cyan', 'green', 'orange', 'indigo'];

    // Category list definition
    const categories = [
        { name: 'Semua Produk', count: productCount, icon: 'grid', href: '#products' },
        { name: 'Automation Bot', count: Math.max(1, Math.ceil(productCount * 0.4)), icon: 'bot', href: '#products' },
        { name: 'Social & Media', count: Math.max(1, Math.ceil(productCount * 0.2)), icon: 'sparkles', href: '#products' },
        { name: 'Marketing & SEO', count: Math.max(1, Math.ceil(productCount * 0.2)), icon: 'search', href: '#products' },
        { name: 'Development', count: Math.max(1, Math.ceil(productCount * 0.1)), icon: 'code', href: '#products' },
        { name: 'Tools Gratis', count: 2, icon: 'gift', href: '#free' },
    ];

    // Helper for category SVG icons
    const getCategoryIconSvg = (type: string) => {
        switch (type) {
            case 'bot':
                return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`;
            case 'sparkles':
                return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>`;
            case 'search':
                return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>`;
            case 'code':
                return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" /></svg>`;
            case 'gift':
                return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>`;
            default:
                return `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>`;
        }
    };

    // Render Product Cards
    const renderProductCards = () => {
        if (products.length === 0) {
            return `
            <div class="col-span-full py-12 text-center text-gray-400">
                <p>Belum ada produk aktif yang tersedia.</p>
            </div>
            `;
        }

        return products.map((p, i) => {
            const tone = tones[i % tones.length];
            const formattedPrice = new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(p.price);
            const isFree = p.price === 0;

            return `
            <article class="product-card flex flex-col justify-between h-full">
                <div class="product-visual ${tone}">
                    <span class="corner-label">${p.price === 0 ? 'FREE' : (p.is_discount && p.discount_percent > 0 ? `DISKON ${p.discount_percent}%` : (i === 0 ? 'POPULER' : 'BEST'))}</span>
                    <div class="product-orbit">
                        ${p.image ? `
                            <img src="${p.image}" alt="${p.name}" class="w-12 h-12 rounded-xl object-cover shadow-lg border border-white/20 relative z-10" />
                        ` : `
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                        `}
                    </div>
                    <span class="visual-brand">ZIQVA</span>
                </div>
                <div class="product-copy flex-1 flex flex-col justify-between">
                    <div class="product-meta">
                        <span>${(p as any).category_name || (p.price === 0 ? 'Tools Gratis' : 'Software Bot')}</span>
                        <span>
                            <svg fill="currentColor" viewBox="0 0 20 20">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>
                            4.9
                        </span>
                    </div>
                    <h3>${p.name}</h3>
                    <p>${p.description || 'Solusi digital otomatis untuk meningkatkan produktivitas dan efisiensi bisnis Anda.'}</p>
                    <div class="price-row">
                        <div>
                            <small>Harga</small>
                            <strong class="${isFree ? 'free-price' : ''}">${isFree ? 'GRATIS' : formattedPrice}</strong>
                        </div>
                        <a href="/member/orders/create?product_id=${p.id}">
                            ${isFree ? 'Klaim Lisensi Gratis' : 'Beli Lisensi'}
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                            </svg>
                        </a>
                    </div>
                </div>
            </article>
            `;
        }).join('');
    };

    const content = `
    <div class="min-h-screen flex">
        ${sidebar}

        <!-- Main Inset Content Area -->
        <div class="site-main flex-1 md:pl-64 flex flex-col">
            <!-- Sticky Topbar -->
            <header class="topbar">
                <div class="flex items-center gap-3">
                    <button id="sidebar-toggle-top" class="md:hidden p-1 text-gray-400 hover:text-white" aria-label="Buka Menu">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span class="eyebrow">ZIQVA DIGITAL MARKETPLACE</span>
                </div>
                <div class="top-actions">
                    <!-- Dual Theme Toggle Switcher -->
                    <div class="theme-control" title="Ganti Mode Tema (Terang / Gelap)">
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

                    <!-- Search Action Trigger -->
                    <a href="/member/tutorials" class="top-link" aria-label="Cari tutorial">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span class="hidden sm:inline">Cari</span>
                    </a>

                    <!-- Help Link -->
                    <a class="help top-link" href="/member/tutorials">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Butuh bantuan?</span>
                    </a>
                </div>
            </header>

            <!-- Main Content Container -->
            <main class="content">
                <!-- 1. Welcome Hero Section with 3D Art -->
                <section class="welcome mb-6 sm:mb-8 lg:mb-10">
                    <div class="welcome-copy">
                        <span class="welcome-pill">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                            </svg>
                            WELCOME TO APPCENTER ZIQVA
                        </span>
                        <h1>Tools digital untuk<br><em>ide yang lebih besar.</em></h1>
                        <p>Temukan produk dan tools digital pilihan yang membuat pekerjaanmu lebih cepat, mudah, otomatis, dan produktif.</p>
                        <div class="welcome-actions">
                            <a href="#products">
                                Jelajahi Produk
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                            </a>
                            <a href="/member/downloads#free">Coba Tools Gratis</a>
                        </div>
                    </div>

                    <div class="welcome-art">
                        <div class="glow"></div>
                        <div class="float-card fc-one">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <span>Auto Flow</span>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                            </svg>
                        </div>
                        <div class="float-card fc-two">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            <span>100% Aman</span>
                        </div>
                        <div class="cube">
                            <div class="cube-inner-platter">
                                <img src="/favicon.svg" alt="Appcenter Logo" />
                            </div>
                        </div>
                        <div class="mini-stat">
                            <strong>${productCount}+</strong>
                            <span>Produk digital</span>
                        </div>
                    </div>
                </section>

                <!-- 2. Category Section -->
                <section class="category-section">
                    <div class="section-heading">
                        <div>
                            <span class="kicker">TEMUKAN KEBUTUHANMU</span>
                            <h2>Jelajahi kategori</h2>
                        </div>
                        <a href="#products">
                            Lihat semua
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>
                    <div class="category-grid">
                        ${categories.map((c, i) => `
                            <a class="category-card ${i === 0 ? 'active' : ''}" href="${c.href}">
                                <span>${getCategoryIconSvg(c.icon)}</span>
                                <div>
                                    <strong>${c.name}</strong>
                                    <small>${c.count} produk</small>
                                </div>
                                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </a>
                        `).join('')}
                    </div>
                </section>

                <!-- 3. Products Section -->
                <section id="products" class="products-section">
                    <div class="section-heading">
                        <div>
                            <span class="kicker">PILIHAN TERBAIK</span>
                            <h2>Produk populer</h2>
                        </div>
                        <a href="/member/downloads">
                            Lihat semua produk
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                            </svg>
                        </a>
                    </div>
                    <div class="products-grid">
                        ${renderProductCards()}
                    </div>
                </section>

                <!-- 4. Free Tools Section -->
                <section id="free" class="products-section free-section">
                    <div class="section-heading">
                        <div>
                            <span class="kicker">LISENSI FREEMIUM</span>
                            <h2>Software & Tools Gratis</h2>
                        </div>
                        <span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)]">
                            Akses Rp 0
                        </span>
                    </div>
                    <div class="products-grid">
                        <div class="col-span-full p-4 sm:p-5 rounded-2xl bg-[var(--surface-2)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
                            <div class="flex items-center gap-3.5">
                                <div class="w-9 h-9 rounded-xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] flex items-center justify-center text-[var(--text-3)] flex-shrink-0">
                                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                    </svg>
                                </div>
                                <div>
                                    <strong class="text-[var(--text)] dark:text-white block font-bold text-xs sm:text-sm">Belum ada software gratis aktif</strong>
                                    <span class="text-[var(--text-3)] dark:text-slate-400 text-xs mt-0.5 block">
                                        Software dengan lisensi gratis akan langsung muncul di katalog ini saat dirilis.
                                    </span>
                                </div>
                            </div>
                            <a
                                href="/member/orders/create"
                                class="px-4 py-2 rounded-xl bg-[var(--surface)] dark:bg-[#101827] hover:bg-[var(--surface-2)] text-[var(--text)] dark:text-slate-200 border border-[var(--border)] dark:border-[#22314d] font-bold text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 flex-shrink-0"
                            >
                                <span>Katalog Lisensi</span>
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </a>
                        </div>
                    </div>
                </section>

                <!-- Footer -->
                <footer class="app-footer">
                    <a href="/member/dashboard" class="brand">
                        <span class="brand-mark">
                            <img src="/favicon.svg" alt="Appcenter Logo" class="w-5 h-5 object-contain" />
                        </span>
                        <span>Appcenter <b>Ziqva</b></span>
                    </a>
                    <span>© 2026 Appcenter Ziqva. Solusi digital, tanpa ribet.</span>
                    <div>
                        <a href="#">Syarat</a>
                        <a href="#">Privasi</a>
                    </div>
                </footer>
            </main>
        </div>
    </div>
    `;

    return baseLayout('Beranda Member', content);
};
