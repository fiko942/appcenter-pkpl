interface AdminData {
    adminName: string;
}

export const getAdminSidebar = (activePage: string, data: AdminData): string => {
    const initial = (data.adminName || 'A').charAt(0).toUpperCase();

    const getLinkClass = (pageName: string) => {
        const isActive = activePage === pageName;
        return `sidebar-nav-item ${isActive ? 'active' : ''}`;
    };

    return `
    <!-- Mobile Toggle Button -->
    <button id="sidebar-toggle" class="md:hidden fixed top-3.5 left-4 z-40 p-2 bg-[var(--surface-2)] text-[var(--text)] rounded-xl shadow-lg border border-[var(--border)] hover:bg-[var(--surface-3)] transition-all" aria-label="Buka Menu Admin">
        <svg class="w-5 h-5 text-[var(--text-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    </button>

    <!-- Overlay -->
    <div id="sidebar-overlay" class="fixed inset-0 bg-[#070c16]/80 backdrop-blur-sm z-40 hidden md:hidden transition-opacity opacity-0"></div>

    <!-- Sidebar -->
    <aside id="sidebar-panel" class="app-sidebar fixed inset-y-0 left-0 z-50 w-64 transform -translate-x-full transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col justify-between">
        <div class="flex flex-col flex-1 overflow-y-auto">
            <!-- Brand Header -->
            <div class="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[var(--border)]">
                <a href="/admin/dashboard" class="brand">
                    <span class="brand-mark">
                        <img src="/favicon.svg" alt="Appcenter Admin Logo" class="w-5 h-5 object-contain" />
                    </span>
                    <span class="text-[var(--text)] text-base">Appcenter <b>Admin</b></span>
                </a>
                <button id="sidebar-close" class="md:hidden text-[var(--text-3)] hover:text-[var(--text)] p-1" aria-label="Tutup Menu">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Menu Admin -->
            <p class="nav-label">MANAJEMEN SISTEM</p>
            <nav class="space-y-1">
                <a href="/admin/dashboard" class="${getLinkClass('dashboard')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                    </svg>
                    <span>Dashboard</span>
                </a>

                <a href="/admin/payments" class="${getLinkClass('payments')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span>Daftar Pembayaran</span>
                </a>

                <a href="/admin/trials/create" class="${getLinkClass('create-trial')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span>Buat Trial</span>
                </a>

                <!-- Produk & Kategori Submenu -->
                <div>
                    <button type="button" class="sidebar-nav-item w-[calc(100%-24px)] flex items-center justify-between ${activePage === 'products' || activePage === 'categories' ? 'active' : ''}" onclick="var sm=document.getElementById('ssr-products-submenu'); if(sm) sm.classList.toggle('hidden');">
                        <div class="flex items-center gap-3">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                            </svg>
                            <span>Produk</span>
                        </div>
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </button>
                    <div id="ssr-products-submenu" class="mx-3 mt-1.5 p-1.5 rounded-2xl bg-[#0b1324] border border-[#22314d] space-y-1 ${activePage === 'products' || activePage === 'categories' ? '' : 'hidden'}">
                        <a href="/admin/products" class="flex items-center justify-between px-3 py-2 rounded-xl text-xs ${activePage === 'products' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-[#1a263e] font-medium'}">
                            <div class="flex items-center gap-2.5">
                                <svg class="w-4 h-4 ${activePage === 'products' ? 'text-white' : 'text-blue-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                </svg>
                                <span>Katalog Produk</span>
                            </div>
                        </a>
                        <a href="/admin/categories" class="flex items-center justify-between px-3 py-2 rounded-xl text-xs ${activePage === 'categories' ? 'bg-blue-600 text-white font-bold' : 'text-slate-300 hover:text-white hover:bg-[#1a263e] font-medium'}">
                            <div class="flex items-center gap-2.5">
                                <svg class="w-4 h-4 ${activePage === 'categories' ? 'text-white' : 'text-purple-400'}" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                </svg>
                                <span>Kategori Produk</span>
                            </div>
                        </a>
                    </div>
                </div>

                <a href="/admin/affiliate" class="${getLinkClass('affiliate')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span>Affiliate Management</span>
                </a>
            </nav>
        </div>

        <!-- Admin Profile Footer -->
        <div class="user-sidebar-footer">
            <span>${initial}</span>
            <div>
                <strong>Admin ${data.adminName}</strong>
                <small>Super Administrator</small>
            </div>
            <a href="/admin/logout" title="Keluar">
                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
            </a>
        </div>
    </aside>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            var toggleBtn = document.getElementById('sidebar-toggle');
            var closeBtn = document.getElementById('sidebar-close');
            var sidebar = document.getElementById('sidebar-panel');
            var overlay = document.getElementById('sidebar-overlay');

            function openSidebar() {
                if (sidebar) sidebar.classList.remove('-translate-x-full');
                if (overlay) {
                    overlay.classList.remove('hidden');
                    setTimeout(function() { overlay.classList.remove('opacity-0'); }, 10);
                }
            }

            function closeSidebar() {
                if (sidebar) sidebar.classList.add('-translate-x-full');
                if (overlay) {
                    overlay.classList.add('opacity-0');
                    setTimeout(function() { overlay.classList.add('hidden'); }, 300);
                }
            }

            if (toggleBtn) toggleBtn.addEventListener('click', openSidebar);
            if (closeBtn) closeBtn.addEventListener('click', closeSidebar);
            if (overlay) overlay.addEventListener('click', closeSidebar);
        });
    </script>
    `;
};
