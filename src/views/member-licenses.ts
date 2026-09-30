import { baseLayout } from './layout';
import { getMemberSidebar } from './components/member-sidebar';
import { sanitizeTutorials, ProductTutorialItem } from '../utils/youtube';

interface LicenseRow {
    id: number;
    key: string;
    product: string;
    status: 'used' | 'unused' | 'expired';
    statusText: string;
    message: string;
    machineId: string;
    duration: string;
    actionUrl: string;
    cssClass: string;
    created: string; // "DD MMM YYYY"
    tutorials?: string | null;
}

interface MemberLicensesData {
    name: string;
    email: string;
    avatar?: string;
    licenses: LicenseRow[];
    sortData?: { field: string; order: string };
    pagination: {
        page: number;
        pageSize: number;
        totalItems: number;
        totalPages: number;
    };
    search: string;
}

export const memberLicensesPage = (data: MemberLicensesData): string => {
    const sidebar = getMemberSidebar('licenses', {
        name: data.name,
        email: data.email,
        avatar: data.avatar
    });

    const getSortUrl = (field: string) => {
        const currentOrder = data.sortData?.field === field ? data.sortData.order : '';
        const newOrder = currentOrder === 'asc' ? 'desc' : 'asc';
        return `/member/licenses?search=${encodeURIComponent(data.search)}&sort=${field}&order=${newOrder}&page=${data.pagination.page}`;
    };

    const getPageUrl = (page: number) => {
        return `/member/licenses?search=${encodeURIComponent(data.search)}&sort=${data.sortData?.field || 'created'}&order=${data.sortData?.order || 'desc'}&page=${page}`;
    };

    const getSortIcon = (field: string) => {
        if (data.sortData?.field !== field) return `
            <svg class="w-3 h-3 text-[var(--text-3)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
        `;
        return data.sortData.order === 'asc' ? `
            <svg class="w-3 h-3 text-[var(--brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
            </svg>
        ` : `
            <svg class="w-3 h-3 text-[var(--brand)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
            </svg>
        `;
    };

    const licensesContent = `
        <div class="bg-[var(--surface)] shadow-sm rounded-2xl border border-[var(--border)] overflow-hidden">
            <div class="p-6 border-b border-[var(--border)] bg-[var(--surface-2)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 class="text-base font-bold text-[var(--text)]">License Keys & Device Management</h2>
                    <p class="text-xs text-[var(--text-3)] mt-1">Kelola lisensi software, ganti Machine ID perangkat, dan tonton video tutorial panduan.</p>
                </div>
                
                <!-- Search Form -->
                <form action="/member/licenses" method="GET" class="w-full sm:w-auto">
                    <div class="relative group">
                        <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg class="h-4 w-4 text-[var(--text-3)] group-focus-within:text-[var(--brand)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                            </svg>
                        </div>
                        <input type="text" name="search" value="${data.search}" 
                            class="block w-full sm:w-64 pl-10 pr-3 py-2 border border-[var(--border)] rounded-xl leading-5 bg-[var(--surface)] text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] text-xs transition-all duration-200" 
                            placeholder="Cari produk, key, atau machine ID...">
                        <input type="hidden" name="sort" value="${data.sortData?.field || 'created'}">
                        <input type="hidden" name="order" value="${data.sortData?.order || 'desc'}">
                    </div>
                </form>
            </div>
            
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead class="bg-[var(--surface-2)] text-[var(--text-2)] uppercase font-bold border-b border-[var(--border)]">
                        <tr>
                            <th class="px-6 py-3.5">No</th>
                            <th class="px-6 py-3.5">Product Name</th>
                            <th class="px-6 py-3.5">License Key</th>
                            <th class="px-6 py-3.5 text-center">Status</th>
                            <th class="px-6 py-3.5">Machine ID</th>
                            <th class="px-6 py-3.5">
                                <a href="${getSortUrl('created')}" class="flex items-center gap-1 hover:text-[var(--brand)] transition-colors group">
                                    Created
                                    ${getSortIcon('created')}
                                </a>
                            </th>
                            <th class="px-6 py-3.5">
                                <a href="${getSortUrl('duration')}" class="flex items-center gap-1 hover:text-[var(--brand)] transition-colors group">
                                    Validity
                                    ${getSortIcon('duration')}
                                </a>
                            </th>
                            <th class="px-6 py-3.5">
                                <a href="${getSortUrl('validity')}" class="flex items-center gap-1 hover:text-[var(--brand)] transition-colors group">
                                    Expires
                                    ${getSortIcon('validity')}
                                </a>
                            </th>
                            <th class="px-6 py-3.5 text-right">Action</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[var(--border)]">
                        ${data.licenses.length > 0 ? data.licenses.map((license, idx) => {
                            const tutorialsList: ProductTutorialItem[] = sanitizeTutorials(license.tutorials);
                            const hasTutorials = tutorialsList.length > 0;
                            const escapedTutorialsJson = JSON.stringify(tutorialsList).replace(/'/g, "&apos;").replace(/"/g, "&quot;");
                            const escapedProductName = license.product.replace(/'/g, "\\'");
                            const rowNumber = ((data.pagination.page - 1) * data.pagination.pageSize) + idx + 1;

                            return `
                            <tr class="hover:bg-[var(--surface-2)]/50 transition-colors">
                                <td class="px-6 py-4 font-mono font-bold text-[var(--text-3)] text-xs">
                                    ${rowNumber}
                                </td>
                                <td class="px-6 py-4 whitespace-nowrap">
                                    <div class="flex items-center gap-3">
                                        <div class="w-8 h-8 flex-shrink-0 rounded-xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center font-bold">
                                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                        </div>
                                        <div>
                                            <span class="font-bold text-[var(--text)] block">${license.product}</span>
                                            ${hasTutorials ? `
                                            <button type="button" onclick='openMemberTutorialModal("${escapedProductName}", ${escapedTutorialsJson})' class="inline-flex items-center gap-1 text-[11px] text-[var(--brand)] hover:underline transition-colors mt-0.5 font-bold">
                                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                </svg>
                                                <span>Lihat Tutorial (${tutorialsList.length})</span>
                                            </button>
                                            ` : ''}
                                        </div>
                                    </div>
                                </td>
                                <td class="px-6 py-4 font-mono text-xs tracking-wide text-[var(--text)] font-semibold">
                                    <div class="flex items-center gap-2 group cursor-pointer" onclick="navigator.clipboard.writeText('${license.key}')" title="Click to Copy">
                                        <span>${license.key}</span>
                                        <svg class="w-3.5 h-3.5 text-[var(--text-3)] group-hover:text-[var(--brand)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                </td>
                                <td class="px-6 py-4 text-center whitespace-nowrap">
                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${license.cssClass}">
                                        <span class="w-1.5 h-1.5 rounded-full ${license.status === 'used' ? 'bg-emerald-500' : (license.status === 'expired' ? 'bg-red-500' : 'bg-amber-500')}"></span>
                                        ${license.statusText}
                                    </span>
                                </td>
                                <td class="px-6 py-4 font-mono text-xs">
                                    ${license.machineId ? `
                                        <div class="flex items-center gap-2 group cursor-pointer" onclick="navigator.clipboard.writeText('${license.machineId}')" title="Click to Copy Full ID">
                                            <span class="px-2.5 py-1 bg-[var(--surface-2)] rounded-lg border border-[var(--border)] text-[var(--text-2)] font-medium">
                                                ${license.machineId.length > 60 ? license.machineId.substring(0, 60) + '...' : license.machineId}
                                            </span>
                                            <svg class="w-3.5 h-3.5 text-[var(--text-3)] group-hover:text-[var(--brand)] transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                        </div>
                                    ` : '<span class="text-[var(--text-3)]">-</span>'}
                                </td>
                                <td class="px-6 py-4 text-xs font-mono text-[var(--text-3)] whitespace-nowrap">
                                    ${license.created}
                                </td>
                                <td class="px-6 py-4 text-[var(--text-2)] font-semibold">
                                    ${license.duration}
                                </td>
                                <td class="px-6 py-4">
                                    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${license.status === 'expired' ? 'border-red-500/30 bg-red-500/10 text-red-500' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-500'}">
                                        <span class="w-1.5 h-1.5 rounded-full ${license.status === 'expired' ? 'bg-red-500' : 'bg-emerald-500'}"></span>
                                        ${license.status === 'expired' ? 'EXPIRED' : 'VALID'}
                                    </span>
                                    ${license.status !== 'expired' ? `<div class="text-[10px] text-[var(--text-3)] mt-1 ml-1">${license.message}</div>` : ''}
                                </td>
                                <td class="px-6 py-4 text-right whitespace-nowrap">
                                    <div class="flex items-center justify-end gap-2">
                                        ${hasTutorials ? `
                                        <button type="button" onclick='openMemberTutorialModal("${escapedProductName}", ${escapedTutorialsJson})' class="p-2 bg-[var(--surface-2)] hover:bg-[var(--brand)] text-[var(--text-2)] hover:text-white rounded-xl transition-all duration-200 border border-[var(--border)]" title="Tonton Tutorial Video">
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                        </button>
                                        ` : ''}
                                        ${license.actionUrl !== '#' ? `
                                            <div class="relative group inline-block">
                                                <button onclick="window.location.href='${license.actionUrl}'" class="p-2 bg-[var(--surface-2)] hover:bg-[var(--brand)] text-[var(--text-2)] hover:text-white rounded-xl transition-all duration-200 border border-[var(--border)]">
                                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                                    </svg>
                                                </button>
                                                <div class="absolute bottom-full right-0 mb-2 px-2.5 py-1 bg-[var(--surface)] border border-[var(--border)] text-[var(--text)] text-[10px] font-medium rounded-lg shadow-xl opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 whitespace-nowrap pointer-events-none z-10">
                                                    Change Machine ID
                                                </div>
                                            </div>
                                        ` : '<span class="text-[var(--text-3)] text-xs italic">No Device</span>'}
                                    </div>
                                </td>
                            </tr>
                            `;
                        }).join('') : `
                            <tr>
                                <td colspan="9" class="px-6 py-12 text-center text-[var(--text-3)]">
                                    <div class="flex flex-col items-center gap-3">
                                        <svg class="w-12 h-12 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                        </svg>
                                        <p>Tidak ada lisensi ditemukan ${data.search ? `untuk pencarian "${data.search}"` : ''}.</p>
                                    </div>
                                </td>
                            </tr>
                        `}
                    </tbody>
                </table>
            </div>

            <!-- Pagination -->
            ${data.pagination.totalPages > 1 ? `
            <div class="px-6 py-4 border-t border-[var(--border)] flex items-center justify-between bg-[var(--surface-2)]">
                <div class="text-xs text-[var(--text-3)] font-medium">
                    Showing <span class="font-bold text-[var(--text)]">${((data.pagination.page - 1) * data.pagination.pageSize) + 1}</span> to <span class="font-bold text-[var(--text)]">${Math.min(data.pagination.page * data.pagination.pageSize, data.pagination.totalItems)}</span> of <span class="font-bold text-[var(--text)]">${data.pagination.totalItems}</span> results
                </div>
                <div class="flex items-center gap-1.5">
                    ${data.pagination.page > 1 ? `
                        <a href="${getPageUrl(data.pagination.page - 1)}" class="px-3 py-1.5 text-xs font-bold bg-[var(--surface)] text-[var(--text)] rounded-xl hover:border-[var(--brand)] transition-colors border border-[var(--border)]">Previous</a>
                    ` : `
                        <button disabled class="px-3 py-1.5 text-xs font-semibold bg-[var(--surface-2)] text-[var(--text-3)] rounded-xl border border-[var(--border)] cursor-not-allowed opacity-60">Previous</button>
                    `}
                    
                    ${Array.from({ length: data.pagination.totalPages }, (_, i) => i + 1).map(p => `
                        <a href="${getPageUrl(p)}" class="px-3 py-1.5 text-xs font-bold rounded-xl transition-colors border ${p === data.pagination.page ? 'bg-[var(--brand)] border-[var(--brand)] text-white' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text)] hover:border-[var(--brand)]'}">
                            ${p}
                        </a>
                    `).join('')}

                    ${data.pagination.page < data.pagination.totalPages ? `
                        <a href="${getPageUrl(data.pagination.page + 1)}" class="px-3 py-1.5 text-xs font-bold bg-[var(--surface)] text-[var(--text)] rounded-xl hover:border-[var(--brand)] transition-colors border border-[var(--border)]">Next</a>
                    ` : `
                        <button disabled class="px-3 py-1.5 text-xs font-semibold bg-[var(--surface-2)] text-[var(--text-3)] rounded-xl border border-[var(--border)] cursor-not-allowed opacity-60">Next</button>
                    `}
                </div>
            </div>
            ` : ''}
        </div>
    `;

    const content = `
    <div class="min-h-screen flex">
        ${sidebar}
        <div class="site-main flex-1 md:pl-64 flex flex-col">
            <!-- Sticky Topbar -->
            <header class="topbar">
                <div class="flex items-center gap-3">
                    <button id="sidebar-toggle-top" class="md:hidden p-1 text-[var(--text-3)] hover:text-[var(--text)]" aria-label="Buka Menu">
                        <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                    <span class="eyebrow">MANAJEMEN LISENSI & PERANGKAT</span>
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

            <main class="flex-1 p-6 md:p-8 max-w-7xl w-full mx-auto space-y-6">
                <div>
                    <h1 class="text-2xl font-extrabold text-[var(--text)]">Lisensi & Perangkat</h1>
                    <p class="text-[var(--text-3)] text-xs mt-1">Kelola lisensi software aktif, status validasi HWID, dan panduan penggunaan.</p>
                </div>
                <div>
                    ${licensesContent}
                </div>
            </main>
        </div>
    </div>

    <!-- Modal Interactive Tutorial Player -->
    <div id="memberTutorialModal" class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md hidden opacity-0 transition-opacity duration-200 p-4">
        <div class="bg-[var(--surface)] border border-[var(--border)] rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col transform scale-95 transition-transform duration-200 max-h-[92vh]">
            <!-- Header Modal -->
            <div class="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--surface-2)]">
                <div class="flex items-center gap-3">
                    <div class="p-2 bg-[var(--brand-soft)] border border-[var(--brand)]/20 text-[var(--brand)] rounded-xl">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <div>
                        <h3 id="member_player_product_name" class="text-base font-bold text-[var(--text)] leading-tight">Tutorial Produk</h3>
                        <p id="member_player_current_title" class="text-xs text-[var(--brand)] font-medium">Memutar Video</p>
                    </div>
                </div>
                <div class="flex items-center gap-2">
                    <a id="member_player_external_link" href="#" target="_blank" class="p-2 text-[var(--text-3)] hover:text-[var(--brand)] hover:bg-[var(--surface-2)] rounded-xl transition-colors text-xs flex items-center gap-1" title="Buka di YouTube">
                        <span>Buka di YouTube</span>
                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                    </a>
                    <button onclick="closeMemberTutorialModal()" class="p-2 text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] rounded-xl transition-colors">
                        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Body Player & Playlist Layout -->
            <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
                <!-- Video Player Iframe -->
                <div class="flex-1 bg-black flex items-center justify-center min-h-[260px] md:min-h-[400px]">
                    <iframe id="memberTutorialIframe" class="w-full h-full aspect-video border-0" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe>
                </div>

                <!-- Playlist Sidebar -->
                <div class="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-[var(--surface-2)] p-4 flex flex-col">
                    <div class="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-3 flex items-center justify-between">
                        <span>Daftar Video Tutorial</span>
                        <span id="member_player_video_count" class="px-2 py-0.5 bg-[var(--surface)] text-[var(--text-2)] rounded text-[11px] font-bold">0 Video</span>
                    </div>
                    <div id="member_player_playlist_container" class="flex-1 overflow-y-auto space-y-2 max-h-48 lg:max-h-[380px] pr-1">
                        <!-- Dynamic playlist buttons -->
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        let memberTutorialsList = [];

        function parseClientYouTube(url) {
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

        function openMemberTutorialModal(productName, tuts) {
            document.getElementById('member_player_product_name').innerText = productName;
            memberTutorialsList = Array.isArray(tuts) ? tuts : [];
            const playlistContainer = document.getElementById('member_player_playlist_container');
            playlistContainer.innerHTML = '';
            document.getElementById('member_player_video_count').innerText = memberTutorialsList.length + ' Video';

            if (memberTutorialsList.length === 0) {
                playlistContainer.innerHTML = '<div class="text-xs text-[var(--text-3)] italic p-3">Belum ada video tutorial.</div>';
                document.getElementById('memberTutorialIframe').src = '';
                document.getElementById('member_player_current_title').innerText = 'Tidak ada video';
                document.getElementById('member_player_external_link').href = '#';
            } else {
                memberTutorialsList.forEach((tut, idx) => {
                    const btn = document.createElement('button');
                    btn.id = 'mem_tut_btn_' + idx;
                    btn.type = 'button';
                    btn.className = 'w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 ' + (idx === 0 ? 'bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand)] font-bold' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand)]');
                    btn.onclick = () => selectMemberTutorialVideo(idx);

                    const isPl = tut.url && tut.url.includes('list=');
                    btn.innerHTML = \`
                        <div class="w-6 h-6 rounded-lg bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-bold font-mono">
                            \${idx + 1}
                        </div>
                        <div class="flex-1 min-w-0">
                            <div class="text-xs font-semibold truncate">\${tut.title || 'Video ' + (idx + 1)}</div>
                            <div class="text-[10px] text-[var(--text-3)] mt-0.5 flex items-center gap-1">
                                <span>\${isPl ? '📑 Playlist' : '🎬 Video'}</span>
                            </div>
                        </div>
                    \`;
                    playlistContainer.appendChild(btn);
                });

                selectMemberTutorialVideo(0);
            }

            const modal = document.getElementById('memberTutorialModal');
            modal.classList.remove('hidden');
            setTimeout(() => {
                modal.classList.remove('opacity-0');
                modal.querySelector('div').classList.remove('scale-95');
            }, 10);
        }

        function selectMemberTutorialVideo(index) {
            if (!memberTutorialsList || !memberTutorialsList[index]) return;
            const item = memberTutorialsList[index];

            memberTutorialsList.forEach((_, idx) => {
                const btn = document.getElementById('mem_tut_btn_' + idx);
                if (btn) {
                    if (idx === index) {
                        btn.className = 'w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 bg-[var(--brand-soft)] border-[var(--brand)] text-[var(--brand)] font-bold shadow-sm';
                    } else {
                        btn.className = 'w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 bg-[var(--surface)] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand)]';
                    }
                }
            });

            const embedUrl = parseClientYouTube(item.url);
            document.getElementById('memberTutorialIframe').src = embedUrl;
            document.getElementById('member_player_current_title').innerText = item.title || 'Memutar Video #' + (index + 1);
            document.getElementById('member_player_external_link').href = item.url || '#';
        }

        function closeMemberTutorialModal() {
            document.getElementById('memberTutorialIframe').src = '';
            const modal = document.getElementById('memberTutorialModal');
            modal.classList.add('opacity-0');
            modal.querySelector('div').classList.add('scale-95');
            setTimeout(() => modal.classList.add('hidden'), 200);
        }
    </script>
    `;

    return baseLayout('Lisensi & Perangkat', content);
};
