import { baseLayout } from './layout';
import { FileData } from '../services/downloadService';
import { getMemberSidebar } from './components/member-sidebar';
import { sanitizeTutorials, ProductTutorialItem } from '../utils/youtube';
import { sftpService, ProductInstallerFiles, ProductInstallerInfo } from '../services/sftpService';

export interface ProductDownloadItem {
    id: number;
    name: string;
    description: string | null;
    image?: string | null;
    product_id?: number | null;
    price?: number;
    is_active?: boolean;
    installer_files?: string | null;
    tutorials?: string | null;
}

export interface MemberDownloadsData {
    name: string;
    email: string;
    avatar?: string;
    products: ProductDownloadItem[];
    files: FileData[];
}

export const memberDownloadsPage = (data: MemberDownloadsData): string => {
    // Official Crisp SVG Icons
    const SVG = {
        windows: `<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m9.75 9.497L0 19.551v-8h9.75m2.25-10.455L24 0v11.474h-12m12 11.579l-12 1.054v-11.55h12"/></svg>`,
        apple: `<svg class="w-4 h-4 flex-shrink-0" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z"/></svg>`,
        download: `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>`,
        play: `<svg class="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`,
        search: `<svg class="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>`,
        appBox: `<svg class="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>`,
        film: `<svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>`,
        chevronDown: `<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" /></svg>`
    };

    const sidebar = getMemberSidebar('downloads', {
        name: data.name,
        email: data.email,
        avatar: data.avatar
    });

    const products = data.products || [];
    const totalProducts = products.length;

    const productCardsHtml = products.map(product => {
        const installerFiles: ProductInstallerFiles = sftpService.parseInstallerFiles(product.installer_files);
        const winFiles: ProductInstallerInfo[] = installerFiles.windows || [];
        const macFiles: ProductInstallerInfo[] = installerFiles.mac || [];

        const tutorialsList: ProductTutorialItem[] = sanitizeTutorials(product.tutorials);
        const tutCount = tutorialsList.length;

        const hasWin = winFiles.length > 0;
        const hasMac = macFiles.length > 0;
        const hasTutorial = tutCount > 0;

        const escapedTutJson = JSON.stringify({
            id: product.id,
            name: product.name,
            tutorials: tutorialsList
        }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        const escapedWinJson = JSON.stringify({
            productName: product.name,
            os: 'Windows',
            files: winFiles
        }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        const escapedMacJson = JSON.stringify({
            productName: product.name,
            os: 'macOS',
            files: macFiles
        }).replace(/'/g, "&apos;").replace(/"/g, "&quot;");

        return `
        <div class="product-download-card bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] rounded-2xl p-5 flex flex-col justify-between transition-all duration-200 shadow-sm hover:shadow-md group"
            data-name="${product.name.toLowerCase()}"
            data-desc="${(product.description || '').toLowerCase()}"
            data-win="${hasWin ? '1' : '0'}"
            data-mac="${hasMac ? '1' : '0'}"
            data-tutorial="${hasTutorial ? '1' : '0'}">
            
            <div>
                <!-- Card Header -->
                <div class="flex items-start justify-between gap-3 mb-3.5">
                    <div class="flex items-center gap-3">
                        <div class="w-11 h-11 rounded-xl bg-[var(--brand-soft)] border border-[var(--brand)]/20 flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform text-[var(--brand)]">
                            ${SVG.appBox}
                        </div>
                        <div>
                            <h3 class="text-base font-bold text-[var(--text)] group-hover:text-[var(--brand)] transition-colors leading-tight line-clamp-1" title="${product.name}">
                                ${product.name}
                            </h3>
                            <div class="flex items-center gap-1.5 mt-1">
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${hasWin ? 'bg-[var(--brand-soft)] text-[var(--brand)] border border-[var(--brand)]/20' : 'bg-[var(--surface-2)] text-[var(--text-3)]'}">
                                    ${SVG.windows}
                                    <span>${hasWin ? (winFiles.length > 1 ? `${winFiles.length} File Win` : 'Windows') : 'Win N/A'}</span>
                                </span>
                                <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${hasMac ? 'bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]' : 'bg-[var(--surface-2)] text-[var(--text-3)]'}">
                                    ${SVG.apple}
                                    <span>${hasMac ? (macFiles.length > 1 ? `${macFiles.length} File Mac` : 'macOS') : 'Mac N/A'}</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Description -->
                <p class="text-xs text-[var(--text-3)] line-clamp-2 leading-relaxed mb-4 min-h-[32px]">
                    ${product.description ? product.description : 'Aplikasi software resmi Ziqva Store dengan pembaruan dan tutorial berkala.'}
                </p>
            </div>

            <!-- Action Buttons Grid -->
            <div class="space-y-2 pt-3 border-t border-gray-800/80">
                <!-- Download Installers Row -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <!-- Windows Download Button -->
                    ${winFiles.length === 1 ? `
                        <a href="${winFiles[0].url}" target="_blank" class="flex items-center justify-between gap-1.5 py-2 px-3 rounded-xl bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 transition-all font-semibold text-xs shadow-sm group/btn">
                            <div class="flex items-center gap-1.5 min-w-0">
                                ${SVG.windows}
                                <span>Windows</span>
                            </div>
                            <span class="text-[10px] opacity-75 font-mono flex-shrink-0">${winFiles[0].size}</span>
                        </a>
                    ` : (winFiles.length > 1 ? `
                        <button type="button" onclick='openDownloadPickerModal(${escapedWinJson})' class="flex items-center justify-between gap-1.5 py-2 px-3 rounded-xl bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 hover:border-blue-500 transition-all font-semibold text-xs shadow-sm cursor-pointer">
                            <div class="flex items-center gap-1.5 min-w-0">
                                ${SVG.windows}
                                <span>Windows</span>
                            </div>
                            <span class="px-1.5 py-0.2 rounded bg-blue-500/20 text-blue-300 text-[10px] font-mono">${winFiles.length} File</span>
                        </button>
                    ` : `
                        <button type="button" disabled class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gray-950 border border-gray-800/60 text-gray-600 text-xs font-medium cursor-not-allowed">
                            ${SVG.windows}
                            <span>Win Belum Ada</span>
                        </button>
                    `)}

                    <!-- macOS Download Button -->
                    ${macFiles.length === 1 ? `
                        <a href="${macFiles[0].url}" target="_blank" class="flex items-center justify-between gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 hover:text-white border border-gray-700 hover:border-gray-600 transition-all font-semibold text-xs shadow-sm group/btn">
                            <div class="flex items-center gap-1.5 min-w-0">
                                ${SVG.apple}
                                <span>macOS</span>
                            </div>
                            <span class="text-[10px] opacity-75 font-mono flex-shrink-0">${macFiles[0].size}</span>
                        </a>
                    ` : (macFiles.length > 1 ? `
                        <button type="button" onclick='openDownloadPickerModal(${escapedMacJson})' class="flex items-center justify-between gap-1.5 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-gray-200 hover:text-white border border-gray-700 hover:border-gray-600 transition-all font-semibold text-xs shadow-sm cursor-pointer">
                            <div class="flex items-center gap-1.5 min-w-0">
                                ${SVG.apple}
                                <span>macOS</span>
                            </div>
                            <span class="px-1.5 py-0.2 rounded bg-slate-700 text-gray-300 text-[10px] font-mono">${macFiles.length} File</span>
                        </button>
                    ` : `
                        <button type="button" disabled class="flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-gray-950 border border-gray-800/60 text-gray-600 text-xs font-medium cursor-not-allowed">
                            ${SVG.apple}
                            <span>Mac Belum Ada</span>
                        </button>
                    `)}
                </div>

                <!-- Tutorial Video Button Row -->
                ${hasTutorial ? `
                    <button type="button" onclick='openMemberTutorialModal(${escapedTutJson})' class="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl bg-purple-500/10 hover:bg-purple-600 text-purple-400 hover:text-white border border-purple-500/20 hover:border-purple-500 transition-all font-semibold text-xs cursor-pointer shadow-sm">
                        ${SVG.play}
                        <span>Tonton Video Tutorial</span>
                        <span class="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 group-hover:bg-white/20 group-hover:text-white text-[10px] font-mono">${tutCount} Video</span>
                    </button>
                ` : `
                    <div class="py-1.5 text-center text-[11px] text-gray-600 italic">
                        Tutorial video belum ditambahkan
                    </div>
                `}
            </div>
        </div>
        `;
    }).join('');

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
                    <span class="eyebrow">PUSAT UNDUHAN & INSTALLER</span>
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

            <!-- Main Content Area -->
            <main class="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
                <!-- Page Header -->
                <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 class="text-2xl font-extrabold text-[var(--text)]">
                            Pusat Unduhan & Tutorial
                        </h1>
                        <p class="text-[var(--text-3)] text-sm mt-1">
                            Unduh installer resmi software untuk Windows & macOS serta tonton panduan video tutorial lengkap.
                        </p>
                    </div>

                    <!-- Search Box -->
                    <div class="relative w-full md:w-72">
                        <div class="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            ${SVG.search}
                        </div>
                        <input type="text" id="downloadsSearchInput" onkeyup="filterDownloads()" placeholder="Cari software atau tools..." class="w-full pl-10 pr-4 py-2.5 bg-gray-900/80 border border-gray-800 rounded-xl text-xs text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors shadow-inner">
                    </div>
                </div>

                <!-- Filter Tabs -->
                <div class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                    <button type="button" onclick="setDownloadsFilter('all', this)" class="filter-tab-btn active px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white border border-blue-500 shadow-md shadow-blue-500/20 transition-all cursor-pointer">
                        Semua Software (${totalProducts})
                    </button>
                    <button type="button" onclick="setDownloadsFilter('win', this)" class="filter-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-medium bg-gray-900/80 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 transition-all cursor-pointer flex items-center gap-1.5">
                        ${SVG.windows}
                        <span>Windows</span>
                    </button>
                    <button type="button" onclick="setDownloadsFilter('mac', this)" class="filter-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-medium bg-gray-900/80 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 transition-all cursor-pointer flex items-center gap-1.5">
                        ${SVG.apple}
                        <span>macOS</span>
                    </button>
                    <button type="button" onclick="setDownloadsFilter('tutorial', this)" class="filter-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-medium bg-gray-900/80 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 transition-all cursor-pointer flex items-center gap-1.5">
                        ${SVG.film}
                        <span>Ada Tutorial</span>
                    </button>
                </div>

                <!-- Product Software Grid -->
                <div id="productsGrid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    ${totalProducts > 0 ? productCardsHtml : `
                        <div class="col-span-full py-16 text-center bg-gray-900/40 rounded-2xl border border-gray-800/80 border-dashed">
                            <div class="w-14 h-14 bg-gray-800/80 rounded-2xl flex items-center justify-center mx-auto mb-3 text-gray-500">
                                ${SVG.appBox}
                            </div>
                            <h3 class="text-base font-bold text-gray-300">Belum Ada Software Tersedia</h3>
                            <p class="text-gray-500 text-xs mt-1">Katalog software akan segera diperbarui oleh admin.</p>
                        </div>
                    `}
                </div>

                <!-- No Results Search Fallback -->
                <div id="noSearchResults" class="hidden py-16 text-center bg-gray-900/40 rounded-2xl border border-gray-800/80 border-dashed">
                    <div class="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-3 text-gray-500">
                        ${SVG.search}
                    </div>
                    <h3 class="text-sm font-bold text-gray-300">Tidak ada software yang cocok</h3>
                    <p class="text-gray-500 text-xs mt-1">Coba kata kunci pencarian atau filter yang lain.</p>
                </div>
            </div>
        </main>
        </div>
    </div>

    <!-- Modal Multi-File Download Picker -->
    <div id="downloadPickerModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-md hidden opacity-0 transition-opacity duration-200 p-4">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col transform scale-95 transition-transform duration-200">
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/80">
                <div class="flex items-center gap-3">
                    <div id="picker_os_icon" class="p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl">
                        ${SVG.download}
                    </div>
                    <div>
                        <h3 id="picker_product_title" class="text-base font-bold text-white leading-tight">Pilih Versi Download</h3>
                        <p id="picker_os_subtitle" class="text-xs text-gray-400 mt-0.5">Tersedia beberapa file installer</p>
                    </div>
                </div>
                <button onclick="closeDownloadPickerModal()" class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors">
                    <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div id="picker_files_list" class="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
                <!-- Dynamically generated file buttons -->
            </div>
        </div>
    </div>

    <!-- Modal Interactive YouTube Tutorial Player -->
    <div id="downloadsTutorialModal" class="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/90 backdrop-blur-md hidden opacity-0 transition-opacity duration-200 p-4">
        <div class="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col transform scale-95 transition-transform duration-200 max-h-[92vh]">
            <!-- Header Modal -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-gray-950/80">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl">
                        ${SVG.film}
                    </div>
                    <div>
                        <h3 id="dl_player_product_name" class="text-base font-bold text-white leading-tight">Tutorial Produk</h3>
                        <p id="dl_player_current_title" class="text-xs text-purple-400 font-medium">Memutar Video</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <a id="dl_player_external_link" href="#" target="_blank" class="p-2 text-gray-400 hover:text-purple-400 hover:bg-gray-800 rounded-xl transition-colors text-xs flex items-center gap-1" title="Buka di YouTube">
                        <span>Buka di YouTube</span>
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                    <button onclick="closeDownloadsTutorialModal()" class="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-xl transition-colors">
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
                    <iframe id="downloadsTutorialIframe" class="w-full h-full aspect-video border-0" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                </div>

                <!-- Playlist Sidebar / Selector -->
                <div class="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-gray-800 bg-gray-950/60 p-4 flex flex-col">
                    <div class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3 flex items-center justify-between">
                        <span>Daftar Video Tutorial</span>
                        <span id="dl_player_video_count" class="px-2 py-0.5 bg-gray-800 text-gray-300 rounded text-[11px]">0 Video</span>
                    </div>
                    <div id="dl_player_playlist_container" class="flex-1 overflow-y-auto space-y-2 max-h-48 lg:max-h-[380px] pr-1">
                        <!-- Dynamic playlist buttons inserted here -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        var currentActiveFilter = 'all';

        function setDownloadsFilter(filterType, btnElem) {
            currentActiveFilter = filterType;
            var buttons = document.querySelectorAll('.filter-tab-btn');
            buttons.forEach(function(b) {
                b.className = 'filter-tab-btn px-3.5 py-1.5 rounded-xl text-xs font-medium bg-gray-900/80 text-gray-400 hover:text-white border border-gray-800 hover:border-gray-700 transition-all cursor-pointer flex items-center gap-1.5';
            });

            btnElem.className = 'filter-tab-btn active px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 text-white border border-blue-500 shadow-md shadow-blue-500/20 transition-all cursor-pointer flex items-center gap-1.5';
            filterDownloads();
        }

        function filterDownloads() {
            var search = (document.getElementById('downloadsSearchInput').value || '').toLowerCase().trim();
            var cards = document.querySelectorAll('.product-download-card');
            var visibleCount = 0;

            cards.forEach(function(card) {
                var name = card.getAttribute('data-name') || '';
                var desc = card.getAttribute('data-desc') || '';
                var hasWin = card.getAttribute('data-win') === '1';
                var hasMac = card.getAttribute('data-mac') === '1';
                var hasTutorial = card.getAttribute('data-tutorial') === '1';

                var matchSearch = !search || name.includes(search) || desc.includes(search);
                var matchFilter = true;

                if (currentActiveFilter === 'win') matchFilter = hasWin;
                else if (currentActiveFilter === 'mac') matchFilter = hasMac;
                else if (currentActiveFilter === 'tutorial') matchFilter = hasTutorial;

                if (matchSearch && matchFilter) {
                    card.style.display = '';
                    visibleCount++;
                } else {
                    card.style.display = 'none';
                }
            });

            var noRes = document.getElementById('noSearchResults');
            if (noRes) {
                noRes.classList.toggle('hidden', visibleCount > 0);
            }
        }

        // ================= Multi-File Download Picker Modal =================
        function openDownloadPickerModal(data) {
            document.getElementById('picker_product_title').innerText = data.productName;
            document.getElementById('picker_os_subtitle').innerText = 'Pilih file installer ' + data.os + ' yang ingin diunduh:';
            
            var iconContainer = document.getElementById('picker_os_icon');
            if (data.os === 'Windows') {
                iconContainer.className = 'p-2 bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl';
            } else {
                iconContainer.className = 'p-2 bg-slate-700/40 border border-gray-600/30 text-gray-200 rounded-xl';
            }

            var listContainer = document.getElementById('picker_files_list');
            listContainer.innerHTML = '';

            var files = data.files || [];
            files.forEach(function(file) {
                var ext = (file.filename || '').split('.').pop().toUpperCase() || 'FILE';
                var d = file.uploaded_at ? new Date(file.uploaded_at * 1000) : new Date();
                var dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

                var btn = document.createElement('a');
                btn.href = file.url || '#';
                btn.target = '_blank';
                btn.className = 'flex items-center justify-between p-3.5 bg-gray-950/80 hover:bg-gray-800/80 border border-gray-800 hover:border-gray-700 rounded-xl transition-all group';
                btn.innerHTML = '<div class="flex items-center gap-3 min-w-0">' +
                    '<div class="w-9 h-9 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center flex-shrink-0 font-bold text-[10px] font-mono group-hover:scale-105 transition-transform">' +
                        ext +
                    '</div>' +
                    '<div class="min-w-0">' +
                        '<div class="text-xs font-bold text-white truncate group-hover:text-blue-400 transition-colors">' + file.filename + '</div>' +
                        '<div class="text-[11px] text-gray-400 flex items-center gap-2 mt-0.5">' +
                            '<span class="font-mono text-cyan-400">' + file.size + '</span>' +
                            '<span>•</span>' +
                            '<span>' + dateStr + '</span>' +
                        '</div>' +
                    '</div>' +
                '</div>' +
                '<div class="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold flex items-center gap-1.5 flex-shrink-0 shadow-sm">' +
                    '<span>Unduh</span>' +
                    '<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>' +
                '</div>';

                listContainer.appendChild(btn);
            });

            var modal = document.getElementById('downloadPickerModal');
            modal.classList.remove('hidden');
            setTimeout(function() {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
            }, 10);
        }

        function closeDownloadPickerModal() {
            var modal = document.getElementById('downloadPickerModal');
            modal.classList.add('opacity-0');
            modal.querySelector('div').classList.add('scale-95');
            setTimeout(function() { modal.classList.add('hidden'); }, 200);
        }

        // ================= Interactive YouTube Player Modal =================
        var dlTutorialsList = [];

        function parseClientYouTube(url) {
            if (!url) return '';
            var clean = url.trim();
            var listMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
            if (clean.includes('/playlist') && listMatch) {
                return 'https://www.youtube-nocookie.com/embed/videoseries?list=' + listMatch[1];
            }
            var shortsMatch = clean.match(new RegExp('youtube\\\\.com/shorts/([a-zA-Z0-9_-]+)', 'i'));
            if (shortsMatch) {
                return 'https://www.youtube-nocookie.com/embed/' + shortsMatch[1];
            }
            var youtuMatch = clean.match(new RegExp('youtu\\\\.be/([a-zA-Z0-9_-]+)', 'i'));
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

        function openMemberTutorialModal(product) {
            document.getElementById('dl_player_product_name').innerText = product.name;
            var tuts = [];
            try {
                if (product.tutorials) {
                    tuts = typeof product.tutorials === 'string' ? JSON.parse(product.tutorials) : product.tutorials;
                }
            } catch (e) {
                tuts = [];
            }

            dlTutorialsList = Array.isArray(tuts) ? tuts : [];
            var playlistContainer = document.getElementById('dl_player_playlist_container');
            playlistContainer.innerHTML = '';
            document.getElementById('dl_player_video_count').innerText = dlTutorialsList.length + ' Video';

            if (dlTutorialsList.length === 0) {
                playlistContainer.innerHTML = '<div class="text-xs text-gray-500 italic p-3">Belum ada video tutorial untuk produk ini.</div>';
                document.getElementById('downloadsTutorialIframe').src = '';
                document.getElementById('dl_player_current_title').innerText = 'Tidak ada video';
                document.getElementById('dl_player_external_link').href = '#';
            } else {
                dlTutorialsList.forEach(function(tut, idx) {
                    var btn = document.createElement('button');
                    btn.id = 'dl_tut_btn_' + idx;
                    btn.type = 'button';
                    btn.className = 'w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ' + (idx === 0 ? 'bg-purple-500/15 border-purple-500/40 text-white' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800/80 hover:text-white');
                    btn.onclick = function() { selectDownloadsTutorialVideo(idx); };

                    var isPl = tut.url && tut.url.includes('list=');
                    btn.innerHTML = '<div class="w-6 h-6 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold font-mono">' +
                        (idx + 1) +
                        '</div>' +
                        '<div class="flex-1 min-w-0">' +
                        '<div class="text-xs font-semibold truncate">' + (tut.title || 'Video ' + (idx + 1)) + '</div>' +
                        '<div class="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">' +
                        '<span>' + (isPl ? 'Playlist' : 'Video Tutorial') + '</span>' +
                        '</div>' +
                        '</div>';
                    playlistContainer.appendChild(btn);
                });

                selectDownloadsTutorialVideo(0);
            }

            var modal = document.getElementById('downloadsTutorialModal');
            modal.classList.remove('hidden');
            setTimeout(function() {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
            }, 10);
        }

        function selectDownloadsTutorialVideo(index) {
            if (!dlTutorialsList || !dlTutorialsList[index]) return;
            var item = dlTutorialsList[index];

            dlTutorialsList.forEach(function(_, idx) {
                var btn = document.getElementById('dl_tut_btn_' + idx);
                if (btn) {
                    if (idx === index) {
                        btn.className = 'w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 bg-purple-500/15 border-purple-500/40 text-white shadow-lg shadow-purple-500/10';
                    } else {
                        btn.className = 'w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800/80 hover:text-white';
                    }
                }
            });

            var embedUrl = parseClientYouTube(item.url);
            document.getElementById('downloadsTutorialIframe').src = embedUrl;
            document.getElementById('dl_player_current_title').innerText = item.title || 'Memutar Video #' + (index + 1);
            document.getElementById('dl_player_external_link').href = item.url || '#';
        }

        function closeDownloadsTutorialModal() {
            document.getElementById('downloadsTutorialIframe').src = '';
            var modal = document.getElementById('downloadsTutorialModal');
            modal.classList.add('opacity-0');
            modal.querySelector('div').classList.add('scale-95');
            setTimeout(function() { modal.classList.add('hidden'); }, 200);
        }
    </script>
    `;

    return baseLayout('Pusat Unduhan & Tutorial', content);
};
