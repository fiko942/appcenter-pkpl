import { baseLayout } from './layout';
import { getMemberSidebar } from './components/member-sidebar';
import { sanitizeTutorials, getYouTubeThumbnail, ProductTutorialItem } from '../utils/youtube';

export interface ProductTutorialData {
    id: number;
    name: string;
    description: string | null;
    image?: string | null;
    tutorials?: string | null;
    installer_files?: string | null;
}

export interface MemberTutorialsData {
    name: string;
    email: string;
    avatar?: string;
    products: ProductTutorialData[];
}

export const memberTutorialsPage = (data: MemberTutorialsData): string => {
    const sidebar = getMemberSidebar('tutorials', {
        name: data.name,
        email: data.email,
        avatar: data.avatar
    });

    // Flatten tutorials with product metadata
    interface FlattenedTutorial {
        productId: number;
        productName: string;
        videoIndex: number;
        id: string;
        title: string;
        url: string;
        embedUrl: string;
        isPlaylist: boolean;
        videoId?: string;
        playlistId?: string;
        thumbnail: string;
    }

    const allTutorials: FlattenedTutorial[] = [];
    const productsWithTutorials: { id: number; name: string; count: number }[] = [];

    (data.products || []).forEach(product => {
        const list: ProductTutorialItem[] = sanitizeTutorials(product.tutorials);
        if (list.length > 0) {
            productsWithTutorials.push({
                id: product.id,
                name: product.name,
                count: list.length
            });

            list.forEach((tut, idx) => {
                const thumb = getYouTubeThumbnail(tut.url, tut.embedUrl, tut.videoId);
                allTutorials.push({
                    productId: product.id,
                    productName: product.name,
                    videoIndex: idx,
                    id: tut.id || `tut-${product.id}-${idx}`,
                    title: tut.title || `${product.name} - Panduan Part ${idx + 1}`,
                    url: tut.url,
                    embedUrl: tut.embedUrl || '',
                    isPlaylist: Boolean(tut.isPlaylist),
                    videoId: tut.videoId,
                    playlistId: tut.playlistId,
                    thumbnail: thumb || ''
                });
            });
        }
    });

    const initialVideo = allTutorials[0] || {
        productId: 0,
        productName: 'Ziqva App',
        videoIndex: 0,
        id: 'default',
        title: 'Mulai Menggunakan Appcenter Ziqva',
        url: 'https://www.youtube.com/watch?v=ScMzIvxBSi4',
        embedUrl: 'https://www.youtube-nocookie.com/embed/ScMzIvxBSi4',
        isPlaylist: false,
        thumbnail: 'https://img.youtube.com/vi/ScMzIvxBSi4/hqdefault.jpg'
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
                    <span class="eyebrow">PUSAT BELAJAR ZIQVA</span>
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

                    <a class="help top-link" href="mailto:support@ziqva.com">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span>Pusat bantuan</span>
                    </a>
                </div>
            </header>

            <!-- Main Tutorial Content Container -->
            <main class="tutorial-content">
                <!-- 1. Heading & Search -->
                <section class="tutorial-heading">
                    <div>
                        <span class="tutorial-icon">
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                        </span>
                        <div>
                            <span class="kicker">VIDEO TUTORIAL</span>
                            <h1>Belajar bersama Ziqva</h1>
                            <p>Ikuti panduan langkah demi langkah untuk menggunakan produk, instalasi bot, dan manajemen lisensi dengan percaya diri.</p>
                        </div>
                    </div>
                    <label class="tutorial-search">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input id="tutorialSearchInput" aria-label="Cari tutorial" placeholder="Cari judul video atau software..." />
                    </label>
                </section>

                <!-- 2. Learning Progress Bar -->
                <section class="learning-progress">
                    <div>
                        <span>
                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            PROGRESS BELAJAR
                        </span>
                        <strong>Tersedia ${allTutorials.length} Materi Video Resmi</strong>
                    </div>
                    <div class="progress-track">
                        <i style="width: 100%;"></i>
                    </div>
                    <b>100% Siap Ditonton</b>
                </section>

                <!-- 3. Split Layout: Video Stage & Playlist -->
                <div class="tutorial-layout">
                    <!-- Left: Video Stage -->
                    <section class="video-stage">
                        <div class="video-frame">
                            <iframe id="mainTutorialIframe" 
                                src="${initialVideo.embedUrl ? (initialVideo.embedUrl.includes('?') ? initialVideo.embedUrl + '&autoplay=0&rel=0' : initialVideo.embedUrl + '?autoplay=0&rel=0') : ''}" 
                                title="${initialVideo.title}" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" 
                                referrerpolicy="strict-origin-when-cross-origin"
                                allowfullscreen></iframe>
                        </div>
                        <div class="now-playing">
                            <span id="nowPlayingProduct">${initialVideo.productName}</span>
                            <h2 id="nowPlayingTitle">${initialVideo.title}</h2>
                            <p id="nowPlayingDesc">Tonton materi video panduan resmi untuk mengoptimalkan pengaturan software dan bot Ziqva langsung di browser Anda.</p>
                            <div>
                                <span>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    Video HD
                                </span>
                                <span>
                                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                    </svg>
                                    YouTube Player
                                </span>
                            </div>
                        </div>
                    </section>

                    <!-- Right: Playlist -->
                    <aside class="playlist">
                        <div class="playlist-head">
                            <div>
                                <span>DAFTAR MATERI</span>
                                <h2>Tutorial & Panduan</h2>
                            </div>
                            <b id="playlistCountBadge">${allTutorials.length} video</b>
                        </div>
                        <div class="lesson-list" id="lessonListContainer">
                            ${allTutorials.map((tut, i) => `
                                <div class="lesson ${i === 0 ? 'active' : ''} tutorial-lesson-item" 
                                    data-title="${tut.title.toLowerCase()}"
                                    data-product="${tut.productName.toLowerCase()}"
                                    onclick="playLessonVideo('${tut.embedUrl}', '${tut.title.replace(/'/g, "\\'")}', '${tut.productName.replace(/'/g, "\\'")}', this)">
                                    <span class="lesson-number">
                                        ${i === 0 ? `<svg fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>` : (i + 1 < 10 ? '0' + (i + 1) : (i + 1))}
                                    </span>
                                    <div>
                                        <strong>${tut.title}</strong>
                                        <p>${tut.productName} — Panduan penggunaan & instalasi</p>
                                        <small>
                                            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                            </svg>
                                            Panduan Lengkap · ${tut.isPlaylist ? 'Playlist Seri' : 'Single Video'}
                                        </small>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </aside>
                </div>

                <!-- 4. Support Help Banner -->
                <section class="tutorial-help">
                    <div>
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div>
                            <h3>Masih butuh bantuan?</h3>
                            <p>Tim Ziqva siap membantu jika kamu mengalami kendala saat mengikuti langkah tutorial.</p>
                        </div>
                    </div>
                    <a href="/member/profile">Hubungi Support</a>
                </section>
            </main>
        </div>
    </div>

    <script>
        function playLessonVideo(embedUrl, title, product, el) {
            var iframe = document.getElementById('mainTutorialIframe');
            var titleEl = document.getElementById('nowPlayingTitle');
            var prodEl = document.getElementById('nowPlayingProduct');

            if (iframe) {
                var url = embedUrl.includes('?') ? embedUrl + '&autoplay=1&rel=0' : embedUrl + '?autoplay=1&rel=0';
                iframe.src = url;
            }
            if (titleEl) titleEl.textContent = title;
            if (prodEl) prodEl.textContent = product;

            // Update active lesson style
            var allLessons = document.querySelectorAll('.lesson');
            allLessons.forEach(function(l) {
                l.classList.remove('active');
            });
            if (el) el.classList.add('active');
        }

        // Live Search Filter
        document.addEventListener('DOMContentLoaded', function() {
            var searchInput = document.getElementById('tutorialSearchInput');
            if (searchInput) {
                searchInput.addEventListener('input', function() {
                    var q = searchInput.value.toLowerCase().trim();
                    var items = document.querySelectorAll('.tutorial-lesson-item');
                    var count = 0;

                    items.forEach(function(item) {
                        var title = item.getAttribute('data-title') || '';
                        var prod = item.getAttribute('data-product') || '';
                        if (!q || title.includes(q) || prod.includes(q)) {
                            item.classList.remove('hidden');
                            count++;
                        } else {
                            item.classList.add('hidden');
                        }
                    });

                    var countBadge = document.getElementById('playlistCountBadge');
                    if (countBadge) {
                        countBadge.textContent = count + ' video';
                    }
                });
            }
        });
    </script>
    `;

    return baseLayout('Pusat Belajar & Video Tutorial', content);
};
