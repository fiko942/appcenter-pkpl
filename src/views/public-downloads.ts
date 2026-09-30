
import { baseLayout } from './layout';
import { FileData } from '../services/downloadService';

interface PublicDownloadsData {
    files: FileData[];
}

export const publicDownloadsPage = (data: PublicDownloadsData): string => {

    // Helper to get Icon based on type (reused from member-downloads)
    const getIcon = (type: string) => {
        switch (type) {
            case 'exe':
                return `<div class="w-12 h-12 bg-blue-500/10 text-blue-400 rounded-xl flex items-center justify-center border border-blue-500/20">
                            <svg class="w-7 h-7" viewBox="0 0 24 24" fill="currentColor"><path d="M0 3.449L9.75 2.1v9.451H0m9.75 9.497L0 19.551v-8h9.75m2.25-10.455L24 0v11.474h-12m12 11.579l-12 1.054v-11.55h12"/></svg>
                        </div>`;
            case 'dmg':
                return `<div class="w-12 h-12 bg-gray-500/10 text-gray-300 rounded-xl flex items-center justify-center border border-gray-500/20">
                           <svg class="w-7 h-7" viewBox="0 0 384 512" fill="currentColor"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 52.3-11.4 69.5-34.3z"/></svg> 
                        </div>`;
            case 'zip':
                return `<div class="w-12 h-12 bg-yellow-500/10 text-yellow-400 rounded-xl flex items-center justify-center border border-yellow-500/20">
                            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"></path></svg>
                        </div>`;
            default:
                return `<div class="w-12 h-12 bg-purple-500/10 text-purple-400 rounded-xl flex items-center justify-center border border-purple-500/20">
                            <svg class="w-7 h-7" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                        </div>`;
        }
    };

    const content = `
  <div class="min-h-screen bg-gray-950 flex flex-col items-center">
    
    <!-- Navbar / Header Simple -->
    <div class="w-full bg-gray-900/50 backdrop-blur border-b border-white/5 py-4">
        <div class="mx-auto max-w-7xl px-4 flex justify-between items-center">
            <div></div>
            <a href="/member/login" class="text-sm font-medium text-gray-400 hover:text-white transition-colors">Login Member →</a>
        </div>
    </div>

    <!-- Main Content -->
    <main class="w-full flex-1">
        <div class="py-12">
          <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8 text-center mb-12">
            <h1 class="text-4xl font-bold text-white mb-4">Download Center</h1>
            <p class="text-gray-400 text-lg max-w-2xl mx-auto">Unduh aplikasi dan tools terbaru kami langsung dari server resmi.</p>
          </div>

          <div class="mx-auto max-w-7xl px-4 sm:px-6 md:px-8">
            <!-- Files Grid -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                ${data.files.length === 0 ? `
                    <div class="col-span-full py-20 text-center bg-gray-900/30 rounded-3xl border border-gray-800 border-dashed">
                        <div class="w-20 h-20 bg-gray-800/50 rounded-full flex items-center justify-center mx-auto mb-6">
                            <svg class="w-10 h-10 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path></svg>
                        </div>
                        <h3 class="text-xl font-semibold text-gray-300">Tidak ada file tersedia</h3>
                        <p class="text-gray-500 mt-2">Server file sedang maintenance atau kosong.</p>
                    </div>
                ` : data.files.map(file => `
                    <div class="group relative flex flex-col bg-gray-900/40 hover:bg-gray-800/60 backdrop-blur border border-white/5 hover:border-blue-500/30 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-blue-500/10">
                        <div class="flex items-start justify-between mb-5">
                            ${getIcon(file.type)}
                            <span class="inline-flex items-center rounded-lg bg-gray-800/80 px-2.5 py-1 text-xs font-mono font-medium text-gray-400 ring-1 ring-inset ring-white/10">
                                ${file.size}
                            </span>
                        </div>
                        
                        <div class="flex-1 min-w-0">
                             <a href="${file.url}" target="_blank" class="focus:outline-none">
                                <span class="absolute inset-0" aria-hidden="true"></span>
                                <h3 class="text-lg font-semibold text-gray-100 group-hover:text-blue-400 transition-colors line-clamp-2 leading-snug mb-2" title="${file.name}">
                                    ${file.name}
                                </h3>
                                <p class="text-sm text-gray-500 truncate flex items-center gap-2">
                                    <span class="w-1.5 h-1.5 rounded-full bg-gray-600"></span>
                                    Uploaded: ${file.date}
                                </p>
                            </a>
                        </div>
                        
                        <div class="mt-6 pt-4 border-t border-white/5 group-hover:border-white/10 transition-colors">
                            <a href="${file.url}" target="_blank" class="relative z-10 flex w-full items-center justify-center gap-2 rounded-xl bg-white/5 hover:bg-blue-600 text-gray-300 hover:text-white px-4 py-3 text-sm font-semibold transition-all duration-300 group-hover:shadow-lg group-hover:shadow-blue-500/20">
                                <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                                Download Sekarang
                            </a>
                        </div>
                    </div>
                `).join('')}
            </div>
          </div>
        </div>
    </main>

    <!-- Footer Simple -->
    <footer class="w-full py-8 text-center text-gray-600 text-sm border-t border-white/5">
        &copy; ${new Date().getFullYear()} Ziqva Labs. All rights reserved.
    </footer>
  </div>
    `;

    return baseLayout('Download Center', content);
};
