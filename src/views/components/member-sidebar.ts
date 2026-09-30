interface MemberSidebarData {
    name: string;
    email: string;
    avatar?: string;
}

export const getMemberSidebar = (activePage: string, data: MemberSidebarData): string => {
    const initial = (data.name || 'M').charAt(0).toUpperCase();

    const getLinkClass = (pageName: string) => {
        const isActive = activePage === pageName;
        return `sidebar-nav-item ${isActive ? 'active' : ''}`;
    };

    return `
    <!-- Mobile Toggle Button -->
    <button id="sidebar-toggle" class="md:hidden fixed top-3.5 left-4 z-40 p-2 bg-[var(--surface-2)] text-[var(--text)] rounded-xl shadow-lg border border-[var(--border)] hover:bg-[var(--surface-3)] transition-all" aria-label="Buka Menu">
        <svg class="w-5 h-5 text-[var(--text-2)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
        </svg>
    </button>

    <!-- Overlay for mobile drawer -->
    <div id="sidebar-overlay" class="fixed inset-0 bg-[#070c16]/80 backdrop-blur-sm z-40 hidden md:hidden transition-opacity opacity-0"></div>

    <!-- Sidebar Panel -->
    <aside id="sidebar-panel" class="app-sidebar fixed inset-y-0 left-0 z-50 w-64 transform -translate-x-full transition-transform duration-300 ease-in-out md:translate-x-0 flex flex-col justify-between">
        <div class="flex flex-col flex-1 overflow-y-auto">
            <!-- Brand Header -->
            <div class="flex items-center justify-between px-4 pt-4 pb-2 border-b border-[var(--border)]">
                <a href="/member/dashboard" class="brand">
                    <span class="brand-mark">
                        <img src="/favicon.svg" alt="Appcenter Logo" class="w-5 h-5 object-contain" />
                    </span>
                    <span class="text-[var(--text)] text-base">Appcenter <b>Ziqva</b></span>
                </a>
                <button id="sidebar-close" class="md:hidden text-[var(--text-3)] hover:text-[var(--text)] p-1" aria-label="Tutup Menu">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <!-- Menu Utama -->
            <p class="nav-label">MENU UTAMA</p>
            <nav class="space-y-1">
                <a href="/member/dashboard" class="${getLinkClass('dashboard')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    <span>Beranda</span>
                </a>

                <a href="/member/orders" class="${getLinkClass('orders')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
                    </svg>
                    <span>Pesanan Saya</span>
                </a>

                <a href="/member/licenses" class="${getLinkClass('licenses')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                    </svg>
                    <span>Lisensi Aplikasi</span>
                </a>

                <a href="/member/tutorials" class="${getLinkClass('tutorials')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                    <span>Tutorial Video</span>
                </a>

                <a href="/member/downloads" class="${getLinkClass('downloads')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download Hub</span>
                </a>

                <a href="/member/affiliate" class="${getLinkClass('affiliate')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    <span>Affiliate Area</span>
                </a>

                <a href="/member/profile" class="${getLinkClass('profile')}">
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <span>Profil Saya</span>
                </a>
            </nav>

            <!-- Free Promo Card -->
            <div class="free-card">
                <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                </svg>
                <div>
                    <strong>Tools Gratis</strong>
                    <p>Coba alat pilihan tanpa biaya tambahan.</p>
                </div>
                <a href="/member/downloads#free">
                    Lihat Semua
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                </a>
            </div>
        </div>

        <!-- User Profile Footer -->
        <div class="user-sidebar-footer">
            <span>${initial}</span>
            <div>
                <strong>${data.name}</strong>
                <small>Member aktif</small>
            </div>
            <a href="/member/logout" title="Keluar dari akun">
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
