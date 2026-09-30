<script lang="ts">
    import { onMount } from 'svelte';
    import { push } from 'svelte-spa-router';
    import { theme } from '../stores/theme';
    import { checkSession, checkAdminSession } from '../stores/auth';
    import ThemeToggle from '../components/ThemeToggle.svelte';
    import { fly, fade, scale, slide } from 'svelte/transition';
    import { cubicOut, backOut } from 'svelte/easing';
    import * as THREE from 'three';

    interface ProductItem {
        id: number;
        product_id: string;
        name: string;
        price: number;
        original_price?: number;
        discount_percent?: number;
        is_bundle?: boolean;
        bundle_items?: string[];
        installer_files?: any;
        image?: string;
        description?: string;
        category_id?: number;
        category_name?: string;
        is_active: boolean;
        tutorials?: string | null;
        has_tutorials?: boolean;
        video_count?: number;
    }

    interface CategoryItem {
        id: number;
        name: string;
        slug: string;
        icon?: string;
    }

    let products: ProductItem[] = [];
    let categories: CategoryItem[] = [];
    let availableTags: string[] = [];
    let loading = true;
    let loadingMore = false;
    let isAuthenticated = false;
    let isAdminAuthenticated = false;
    
    // Server-Side Filters & Pagination
    let selectedFilter: string | number = 'all'; // 'all', 'bundle', 'free', category_id, or tag string
    let searchQuery = '';
    let currentPage = 1;
    const pageSize = 10;
    let totalProducts = 0;
    let hasMore = false;
    let remainingCount = 0;
    let searchDebounceTimer: ReturnType<typeof setTimeout> | null = null;
    let catImgErrorMap: Record<string, boolean> = {};

    // Get contextual icon for category / tag
    function getCategoryIcon(name: string): string {
        const lower = name.toLowerCase();
        if (lower.includes('drop') || lower.includes('shop') || lower.includes('toko') || lower.includes('owner')) {
            return 'shopping-bag';
        }
        if (lower.includes('farm') || lower.includes('bot') || lower.includes('akun')) {
            return 'cpu';
        }
        if (lower.includes('affil') || lower.includes('share') || lower.includes('link')) {
            return 'share';
        }
        if (lower.includes('yout') || lower.includes('video') || lower.includes('media') || lower.includes('vids')) {
            return 'video';
        }
        if (lower.includes('wa') || lower.includes('chat') || lower.includes('pesan')) {
            return 'message';
        }
        return 'tag';
    }
    
    // State Controls
    let mobileMenuOpen = false;
    let selectedProductDetail: ProductItem | null = null;
    let openFaqIndex: number | null = 0;
    let showAnnouncement = true;

    // Dynamic Typewriter Animation for Hero Tagline (Concise 1-Line Phrases)
    const typingPhrases = [
        'Bisnis Digital',
        'Dropshipper',
        'Mitra Afiliator',
        'Kreator YouTube',
        'Praktisi AI'
    ];
    let currentPhraseIndex = 0;
    let typedText = '';
    let isDeleting = false;
    let typingTimer: any = null;

    // Typewriter 2: Features Section Tagline (Concise 1-Line Phrases)
    const featuresPhrases = [
        'Kinerja & Fleksibilitas',
        'Otomasi Ringan & Cepat',
        'Bebas Pindah Laptop',
        'Privasi Data Lokal',
        'Pembaruan Otomatis'
    ];
    let featuresPhraseIndex = 0;
    let featuresTypedText = '';
    let isFeaturesDeleting = false;
    let featuresTypingTimer: any = null;

    // Typewriter 3: About Section Tagline (Concise 1-Line Phrases)
    const aboutPhrases = [
        'Masa Depan Produktivitas',
        'Efisiensi Bisnis Digital',
        'Otomasi Konten Modern',
        'Kemudahan Ekosistem',
        'Inovasi Nyata Tim'
    ];
    let aboutPhraseIndex = 0;
    let aboutTypedText = '';
    let isAboutDeleting = false;
    let aboutTypingTimer: any = null;

    function runTypewriter() {
        const fullPhrase = typingPhrases[currentPhraseIndex];
        const typingSpeed = isDeleting ? 45 : 90;

        if (!isDeleting && typedText === fullPhrase) {
            typingTimer = setTimeout(() => {
                isDeleting = true;
                runTypewriter();
            }, 2200);
            return;
        } else if (isDeleting && typedText === '') {
            isDeleting = false;
            currentPhraseIndex = (currentPhraseIndex + 1) % typingPhrases.length;
            typingTimer = setTimeout(runTypewriter, 350);
            return;
        }

        typedText = isDeleting
            ? fullPhrase.substring(0, typedText.length - 1)
            : fullPhrase.substring(0, typedText.length + 1);

        typingTimer = setTimeout(runTypewriter, typingSpeed);
    }

    function runFeaturesTypewriter() {
        const fullPhrase = featuresPhrases[featuresPhraseIndex];
        const typingSpeed = isFeaturesDeleting ? 45 : 90;

        if (!isFeaturesDeleting && featuresTypedText === fullPhrase) {
            featuresTypingTimer = setTimeout(() => {
                isFeaturesDeleting = true;
                runFeaturesTypewriter();
            }, 2400);
            return;
        } else if (isFeaturesDeleting && featuresTypedText === '') {
            isFeaturesDeleting = false;
            featuresPhraseIndex = (featuresPhraseIndex + 1) % featuresPhrases.length;
            featuresTypingTimer = setTimeout(runFeaturesTypewriter, 350);
            return;
        }

        featuresTypedText = isFeaturesDeleting
            ? fullPhrase.substring(0, featuresTypedText.length - 1)
            : fullPhrase.substring(0, featuresTypedText.length + 1);

        featuresTypingTimer = setTimeout(runFeaturesTypewriter, typingSpeed);
    }

    function runAboutTypewriter() {
        const fullPhrase = aboutPhrases[aboutPhraseIndex];
        const typingSpeed = isAboutDeleting ? 45 : 90;

        if (!isAboutDeleting && aboutTypedText === fullPhrase) {
            aboutTypingTimer = setTimeout(() => {
                isAboutDeleting = true;
                runAboutTypewriter();
            }, 2600);
            return;
        } else if (isAboutDeleting && aboutTypedText === '') {
            isAboutDeleting = false;
            aboutPhraseIndex = (aboutPhraseIndex + 1) % aboutPhrases.length;
            aboutTypingTimer = setTimeout(runAboutTypewriter, 350);
            return;
        }

        aboutTypedText = isAboutDeleting
            ? fullPhrase.substring(0, aboutTypedText.length - 1)
            : fullPhrase.substring(0, aboutTypedText.length + 1);

        aboutTypingTimer = setTimeout(runAboutTypewriter, typingSpeed);
    }

    // Interactive Affiliate Multi-Variable Simulator State (Strictly Matching DB Schema & Member Order Durations)
    let simDurationMonths = 2; // Member area standard durations: 2, 4, 6 bulan (fallback 1, 3)
    const simVoucherPercent = 10; // Saklek 10% diskon pembeli (kupon_decrease_value in DB)
    const affiliateCommissionRate = 0.05; // Saklek 5% komisi affiliator (kupon_income_idr in DB master)
    let simMonthlySales = 15; // 1 - 100 lisensi

    // Dynamic Average Price computed from active paid products
    $: activePaidProducts = products.filter(p => p.price > 0);
    $: currentAvgPrice = activePaidProducts.length > 0
        ? Math.round(activePaidProducts.reduce((acc, curr) => acc + curr.price, 0) / activePaidProducts.length)
        : 102000;

    // Reactive calculations matching backend & database formula
    $: simGrossOrderPrice = currentAvgPrice * simDurationMonths;
    $: simVoucherDiscountAmount = Math.round(simGrossOrderPrice * (simVoucherPercent / 100)); // Diskon 10%
    $: simNetCustomerPaid = simGrossOrderPrice - simVoucherDiscountAmount; // Uang yang dibayar pembeli
    $: simCommissionPerOrder = Math.round(simNetCustomerPaid * affiliateCommissionRate); // Komisi 15% dari uang yang dibayar
    $: estimatedEarnings = Math.round(simCommissionPerOrder * simMonthlySales);

    function toggleFaq(idx: number) {
        openFaqIndex = openFaqIndex === idx ? null : idx;
    }

    // Scroll-Driven Viewport Observer Action (Smooth One-Time Reveal to eliminate flicker)
    function viewportReveal(node: HTMLElement, options: { delay?: number; type?: 'up' | 'scale' | 'fade'; y?: number } = {}) {
        const delay = options.delay || 0;
        const type = options.type || 'up';
        const yOffset = options.y !== undefined ? options.y : 24;

        // Base Initial Styles
        node.style.transition = `opacity 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`;

        function setHidden() {
            node.style.opacity = '0';
            if (type === 'scale') {
                node.style.transform = 'scale(0.96)';
            } else if (type === 'fade') {
                node.style.transform = 'none';
            } else {
                node.style.transform = `translateY(${yOffset}px)`;
            }
        }

        function setVisible() {
            node.style.opacity = '1';
            node.style.transform = type === 'scale' ? 'scale(1)' : type === 'fade' ? 'none' : 'translateY(0)';
        }

        setHidden();

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setVisible();
                    observer.unobserve(node); // Unobserve after revealing to prevent repeated hide/flicker loops
                }
            });
        }, {
            threshold: 0.05,
            rootMargin: '50px 0px -20px 0px'
        });

        observer.observe(node);

        return {
            destroy() {
                observer.disconnect();
            }
        };
    }
    const navLinks = [
        { id: 'hero', label: 'Beranda' },
        { id: 'catalog', label: 'Software & Bot' },
        { id: 'features', label: 'Keunggulan' },
        { id: 'affiliate', label: 'Mitra Afiliasi' },
        { id: 'about', label: 'Tentang Kami' },
        { id: 'faq', label: 'FAQ' }
    ];
    let activeNav = 'hero';
    let navElements: Record<string, HTMLButtonElement> = {};
    let pillStyle = { left: 0, width: 0 };
    let pillInitialized = false;

    function syncNavPill() {
        const el = navElements[activeNav];
        if (el) {
            const left = el.offsetLeft;
            const width = el.offsetWidth;
            if (width > 0 && (pillStyle.left !== left || pillStyle.width !== width)) {
                pillStyle = { left, width };
                pillInitialized = true;
            }
        }
    }

    function handleNavClick(id: string) {
        activeNav = id;
        syncNavPill();
        scrollToSection(id);
    }

    // 3D Three.js Container
    let threeContainer: HTMLDivElement | null = null;

    function init3DHeroScene() {
        if (!threeContainer) return () => {};

        const width = threeContainer.clientWidth || 450;
        const height = threeContainer.clientHeight || 450;

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
        camera.position.z = 5.2;

        const renderer = new THREE.WebGLRenderer({
            alpha: true,
            antialias: true,
            powerPreference: 'high-performance'
        });
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
        threeContainer.appendChild(renderer.domElement);

        // Group container for master rotation
        const gyroGroup = new THREE.Group();
        gyroGroup.rotation.z = (23.5 * Math.PI) / 180; // Earth's real 23.5° axial tilt
        scene.add(gyroGroup);

        // Texture Loader for photorealistic Earth maps with sRGB color space
        const textureLoader = new THREE.TextureLoader();
        const dayTexture = textureLoader.load('/textures/earth/earth_day.jpg');
        dayTexture.colorSpace = THREE.SRGBColorSpace;
        
        const normalTexture = textureLoader.load('/textures/earth/earth_normal.jpg');
        const specularTexture = textureLoader.load('/textures/earth/earth_specular.jpg');
        const cloudsTexture = textureLoader.load('/textures/earth/earth_clouds.jpg');
        cloudsTexture.colorSpace = THREE.SRGBColorSpace;

        // 1. Realistic Deep-Space Earth Mesh (Bumi Berwarna Pekat & Tajam)
        const earthGeo = new THREE.SphereGeometry(1.18, 64, 64);
        const earthMat = new THREE.MeshStandardMaterial({
            map: dayTexture,
            normalMap: normalTexture,
            normalScale: new THREE.Vector2(0.85, 0.85),
            roughnessMap: specularTexture,
            roughness: 0.5,
            metalness: 0.15
        });
        const earthMesh = new THREE.Mesh(earthGeo, earthMat);
        gyroGroup.add(earthMesh);

        // 2. Atmospheric Rotating Cloud Layer (Transparan Lembut tanpa Memutihkan Daratan)
        const cloudGeo = new THREE.SphereGeometry(1.20, 64, 64);
        const cloudMat = new THREE.MeshStandardMaterial({
            map: cloudsTexture,
            transparent: true,
            opacity: 0.28,
            blending: THREE.AdditiveBlending
        });
        const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
        gyroGroup.add(cloudMesh);

        // 3. Delicate Luminous Telemetry Orbit Paths (Cincin Tipis Glowing)
        // Orbit Path 1 (Cyan Celestial Ring)
        const ring1Points: THREE.Vector3[] = [];
        const ring1Radius = 1.75;
        for (let i = 0; i <= 128; i++) {
            const angle = (i / 128) * Math.PI * 2;
            ring1Points.push(new THREE.Vector3(Math.cos(angle) * ring1Radius, 0, Math.sin(angle) * ring1Radius));
        }
        const ring1Geo = new THREE.BufferGeometry().setFromPoints(ring1Points);
        const ring1Mat = new THREE.LineBasicMaterial({
            color: 0x38bdf8,
            transparent: true,
            opacity: 0.45
        });
        const ring1 = new THREE.Line(ring1Geo, ring1Mat);
        ring1.rotation.x = Math.PI / 3.2;
        ring1.rotation.y = Math.PI / 8;
        gyroGroup.add(ring1);

        // Orbit Path 2 (Royal Blue Celestial Ring)
        const ring2Points: THREE.Vector3[] = [];
        const ring2Radius = 1.52;
        for (let i = 0; i <= 128; i++) {
            const angle = (i / 128) * Math.PI * 2;
            ring2Points.push(new THREE.Vector3(Math.cos(angle) * ring2Radius, 0, Math.sin(angle) * ring2Radius));
        }
        const ring2Geo = new THREE.BufferGeometry().setFromPoints(ring2Points);
        const ring2Mat = new THREE.LineBasicMaterial({
            color: 0x818cf8,
            transparent: true,
            opacity: 0.45
        });
        const ring2 = new THREE.Line(ring2Geo, ring2Mat);
        ring2.rotation.x = -Math.PI / 3.8;
        ring2.rotation.z = Math.PI / 5;
        gyroGroup.add(ring2);

        // Traveling Satellite Beacon on Orbit 1
        const sat1Geo = new THREE.SphereGeometry(0.045, 16, 16);
        const sat1Mat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
        const sat1 = new THREE.Mesh(sat1Geo, sat1Mat);
        gyroGroup.add(sat1);

        // Traveling Satellite Beacon on Orbit 2
        const sat2Geo = new THREE.SphereGeometry(0.04, 16, 16);
        const sat2Mat = new THREE.MeshBasicMaterial({ color: 0xa5b4fc });
        const sat2 = new THREE.Mesh(sat2Geo, sat2Mat);
        gyroGroup.add(sat2);

        // 4. Circular Soft Glow Stardust Particles
        const particleCount = 40;
        const particleGeo = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        for (let i = 0; i < particleCount * 3; i += 3) {
            const r = 1.4 + Math.random() * 0.8;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            positions[i] = r * Math.sin(phi) * Math.cos(theta);
            positions[i + 1] = r * Math.sin(phi) * Math.sin(theta);
            positions[i + 2] = r * Math.cos(phi);
        }
        particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        const particleMat = new THREE.PointsMaterial({
            color: 0x60a5fa,
            size: 0.04,
            transparent: true,
            opacity: 0.75
        });
        const particles = new THREE.Points(particleGeo, particleMat);
        gyroGroup.add(particles);

        // Lighting (Theme-Aware Contrast Tuning)
        const isDark = document.documentElement.classList.contains('dark');

        const ambientLight = new THREE.AmbientLight(0xffffff, isDark ? 0.45 : 0.75); // Higher ambient in light mode to keep shadows legible
        scene.add(ambientLight);

        const sunLight = new THREE.DirectionalLight(0xfff5ea, isDark ? 2.8 : 2.4); // Vibrant warm sunlight
        sunLight.position.set(5, 3.5, 4.5);
        scene.add(sunLight);

        // Blue Atmospheric Rim Backlight
        const rimLight = new THREE.PointLight(0x2563eb, isDark ? 3.5 : 4.5, 12);
        rimLight.position.set(-4, -1.5, -2);
        scene.add(rimLight);

        // Soft Cyan/Blue Side Fill Light
        const fillLight = new THREE.DirectionalLight(0x38bdf8, isDark ? 0.6 : 1.0);
        fillLight.position.set(-3, 2, 2);
        scene.add(fillLight);

        // Interactive mouse rotation with damping
        let mouseX = 0;
        let mouseY = 0;
        let targetRotX = 0;
        let targetRotY = 0;
        let isVisible = true;
        let satAngle1 = 0;
        let satAngle2 = Math.PI;

        function handleMouseMove(e: MouseEvent) {
            const rect = threeContainer?.getBoundingClientRect();
            if (!rect) return;
            mouseX = (e.clientX - rect.left - width / 2) / (width / 2);
            mouseY = (e.clientY - rect.top - height / 2) / (height / 2);
            targetRotY = mouseX * 0.9;
            targetRotX = -mouseY * 0.9;
        }

        window.addEventListener('mousemove', handleMouseMove);

        const observer = new IntersectionObserver((entries) => {
            isVisible = entries[0]?.isIntersecting ?? true;
        }, { threshold: 0.1 });

        if (threeContainer) observer.observe(threeContainer);

        let reqId: number;
        function animate() {
            reqId = requestAnimationFrame(animate);
            if (!isVisible) return;

            // Earth rotation & dynamic cloud parallax
            earthMesh.rotation.y += 0.003;
            cloudMesh.rotation.y += 0.0042; // Slightly faster cloud drift

            // Traveling Satellites Position Computation
            satAngle1 += 0.015;
            satAngle2 -= 0.012;

            // Sat 1 position along ring1 plane
            const p1 = new THREE.Vector3(Math.cos(satAngle1) * ring1Radius, 0, Math.sin(satAngle1) * ring1Radius);
            p1.applyEuler(ring1.rotation);
            sat1.position.copy(p1);

            // Sat 2 position along ring2 plane
            const p2 = new THREE.Vector3(Math.cos(satAngle2) * ring2Radius, 0, Math.sin(satAngle2) * ring2Radius);
            p2.applyEuler(ring2.rotation);
            sat2.position.copy(p2);

            particles.rotation.y += 0.0015;

            // Apply interactive damping
            gyroGroup.rotation.x += (targetRotX - gyroGroup.rotation.x) * 0.06;
            gyroGroup.rotation.y += (targetRotY - gyroGroup.rotation.y) * 0.06;

            renderer.render(scene, camera);
        }

        animate();

        return () => {
            cancelAnimationFrame(reqId);
            window.removeEventListener('mousemove', handleMouseMove);
            observer.disconnect();
            if (threeContainer && renderer.domElement.parentNode === threeContainer) {
                threeContainer.removeChild(renderer.domElement);
            }
            earthGeo.dispose();
            earthMat.dispose();
            cloudGeo.dispose();
            cloudMat.dispose();
            ring1Geo.dispose();
            ring1Mat.dispose();
            ring2Geo.dispose();
            ring2Mat.dispose();
            sat1Geo.dispose();
            sat1Mat.dispose();
            sat2Geo.dispose();
            sat2Mat.dispose();
            particleGeo.dispose();
            particleMat.dispose();
            dayTexture.dispose();
            normalTexture.dispose();
            specularTexture.dispose();
            cloudsTexture.dispose();
            renderer.dispose();
        };
    }

    onMount(() => {
        let cleanup: (() => void) | undefined;
        let threeCleanup: (() => void) | undefined;

        (async () => {
            isAuthenticated = await checkSession();
            if (!isAuthenticated) {
                isAdminAuthenticated = await checkAdminSession();
            }
            await fetchCatalogData(1, false);

            setTimeout(() => {
                syncNavPill();
                threeCleanup = init3DHeroScene();
                runTypewriter();
                runFeaturesTypewriter();
                runAboutTypewriter();

                // Check hash on landing page mount for direct jump (e.g. from /terms or /privacy or /member/login)
                const currentHash = window.location.hash;
                const match = currentHash.match(/[\?&]section=([^&]+)/) || currentHash.match(/#([a-zA-Z0-9_-]+)$/);
                if (match && match[1] && match[1] !== '/') {
                    scrollToSection(match[1]);
                }
            }, 100);
            window.addEventListener('resize', syncNavPill);

            // IntersectionObserver to auto update activeNav on scroll
            const observerOptions = {
                root: null,
                rootMargin: '-20% 0px -60% 0px',
                threshold: 0
            };

            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const id = entry.target.getAttribute('id');
                        if (id && navLinks.some(l => l.id === id)) {
                            activeNav = id;
                            syncNavPill();
                        }
                    }
                });
            }, observerOptions);

            navLinks.forEach(link => {
                const sec = document.getElementById(link.id);
                if (sec) observer.observe(sec);
            });

            cleanup = () => {
                window.removeEventListener('resize', syncNavPill);
                observer.disconnect();
                if (threeCleanup) threeCleanup();
                if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
                if (typingTimer) clearTimeout(typingTimer);
                if (featuresTypingTimer) clearTimeout(featuresTypingTimer);
                if (aboutTypingTimer) clearTimeout(aboutTypingTimer);
            };
        })();

        return () => {
            if (cleanup) cleanup();
        };
    });

    async function fetchCatalogData(page: number = 1, append: boolean = false) {
        try {
            if (append) {
                loadingMore = true;
            } else {
                loading = true;
            }

            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('pageSize', String(pageSize));

            if (searchQuery.trim()) {
                params.set('search', searchQuery.trim());
            }

            if (selectedFilter !== 'all') {
                params.set('category', String(selectedFilter));
            }

            const res = await fetch(`/member/api/products?${params.toString()}`);
            if (res.ok) {
                const json = await res.json();
                const fetchedProducts = json.data?.products || [];
                const pagination = json.data?.pagination || {};

                if (append) {
                    products = [...products, ...fetchedProducts];
                } else {
                    products = fetchedProducts;
                }

                if (json.data?.categories) {
                    categories = json.data.categories;
                }
                if (json.data?.tags) {
                    availableTags = json.data.tags;
                }

                currentPage = pagination.page || page;
                totalProducts = pagination.total || products.length;
                hasMore = pagination.hasMore ?? false;
                remainingCount = pagination.remaining ?? 0;

                setTimeout(syncCatPill, 60);
            }
        } catch (err) {
            console.error('Failed to fetch catalog for landing page:', err);
        } finally {
            loading = false;
            loadingMore = false;
        }
    }

    // Category Animated Sliding Pill
    let categoryElements: Record<string, HTMLButtonElement> = {};
    let catPillStyle = { left: 0, width: 0 };
    let catPillInitialized = false;

    function syncCatPill() {
        const key = String(selectedFilter);
        const el = categoryElements[key];
        if (el) {
            const left = el.offsetLeft;
            const width = el.offsetWidth;
            if (width > 0 && (catPillStyle.left !== left || catPillStyle.width !== width)) {
                catPillStyle = { left, width };
                catPillInitialized = true;
            }
        }
    }

    function handleFilterChange(filter: string | number) {
        selectedFilter = filter;
        currentPage = 1;
        fetchCatalogData(1, false);
        setTimeout(() => {
            syncCatPill();
            const key = String(filter);
            const el = categoryElements[key];
            if (el) {
                el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        }, 50);
    }

    function handleSearchInput(e: Event) {
        if (searchDebounceTimer) clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            currentPage = 1;
            fetchCatalogData(1, false);
        }, 250);
    }

    function loadMore() {
        if (hasMore && !loadingMore) {
            fetchCatalogData(currentPage + 1, true);
        }
    }

    $: freeToolsCount = products.filter(p => p.price === 0).length;
    $: bundleCount = products.filter(p => p.is_bundle === true).length;

    function getIncludedProductItems(bundleItems?: any[]): { id: number; name: string; image?: string }[] {
        if (!bundleItems || !Array.isArray(bundleItems)) return [];
        return bundleItems.map((item, idx) => {
            if (typeof item === 'object' && item !== null) {
                return {
                    id: item.id || idx + 1,
                    name: item.name || item.title || 'Software Bot',
                    image: item.image || item.icon || ''
                };
            }
            // If string or ID, try to match with products catalog
            const matched = products.find(p => String(p.id) === String(item) || p.name.toLowerCase() === String(item).toLowerCase());
            if (matched) {
                return { id: matched.id, name: matched.name, image: matched.image };
            }
            return { id: idx + 1, name: String(item), image: '' };
        });
    }

    function formatRupiah(val: number): string {
        if (val === 0) return 'Rp 0';
        return 'Rp ' + val.toLocaleString('id-ID');
    }

    function scrollToSection(id: string) {
        mobileMenuOpen = false;
        const el = document.getElementById(id);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function checkOSSupport(installerFiles: any): { windows: boolean; mac: boolean; hasAny: boolean } {
        if (!installerFiles) return { windows: false, mac: false, hasAny: false };
        let parsed = installerFiles;
        if (typeof installerFiles === 'string') {
            try {
                parsed = JSON.parse(installerFiles);
            } catch {
                const str = installerFiles.toLowerCase();
                const hasWin = str.includes('.exe') || str.includes('.msi') || (str.includes('win') && !str.includes('darwin'));
                const hasMac = str.includes('.dmg') || str.includes('.pkg') || str.includes('mac') || str.includes('darwin');
                return {
                    windows: hasWin,
                    mac: hasMac,
                    hasAny: hasWin || hasMac
                };
            }
        }

        if (typeof parsed === 'object' && parsed !== null) {
            // Helper to test if a platform entry is truly non-empty
            const isNonEmpty = (val: any): boolean => {
                if (!val) return false;
                if (Array.isArray(val)) return val.length > 0;
                if (typeof val === 'object') return Object.keys(val).length > 0 && Boolean(val.url || val.filename || val.id);
                if (typeof val === 'string') return val.trim().length > 0;
                return false;
            };

            const hasWin = isNonEmpty(parsed.windows) || isNonEmpty(parsed.win) || isNonEmpty(parsed.exe);
            const hasMac = isNonEmpty(parsed.mac) || isNonEmpty(parsed.macos) || isNonEmpty(parsed.dmg) || isNonEmpty(parsed.pkg);

            return {
                windows: hasWin,
                mac: hasMac,
                hasAny: hasWin || hasMac
            };
        }

        return { windows: false, mac: false, hasAny: false };
    }
</script>

<div class="landing-container min-h-screen bg-[var(--page)] text-[var(--text)] font-sans selection:bg-blue-600 selection:text-white transition-colors duration-300">
    
    <!-- Top Announcement Bar (Vibrant Rich Blue Gradient, Fully Responsive & No Awkward Wrap) -->
    {#if showAnnouncement}
        <div in:slide={{ duration: 250 }} class="bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white text-xs font-semibold px-3 sm:px-4 py-2 sm:py-2.5 flex items-center justify-between gap-2 shadow-xs z-50 relative">
            <div class="max-w-7xl mx-auto flex items-center justify-center gap-2 text-center w-full min-w-0">
                <span class="px-2 py-0.5 rounded-full bg-white/20 text-[10px] font-black uppercase tracking-wider whitespace-nowrap shrink-0">Update v2.0</span>
                <span class="font-medium truncate sm:overflow-visible sm:whitespace-normal">
                    <span class="sm:hidden">Ekosistem software bot desktop resmi.</span>
                    <span class="hidden sm:inline">Ekosistem Software Bot Desktop & Lisensi Resmi Terpadu.</span>
                </span>
                <button on:click={() => scrollToSection('catalog')} class="underline font-bold text-white hover:text-blue-100 hidden md:inline ml-1 whitespace-nowrap shrink-0">Lihat Katalog →</button>
            </div>
            <button on:click={() => showAnnouncement = false} class="p-1 rounded-md hover:bg-white/20 text-white/80 hover:text-white transition-colors shrink-0" aria-label="Tutup Pengumuman">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
        </div>
    {/if}

    <!-- Navbar Header (Generous Apple TV-Class Frosted Glass Bar) -->
    <header class="sticky top-0 z-50 backdrop-blur-2xl bg-[var(--surface)]/90 dark:bg-[#070c18]/90 border-b border-[var(--border)] shadow-sm dark:shadow-xl dark:shadow-black/20 transition-all duration-300">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
            <!-- Brand Logo -->
            <a href="#/" class="flex items-center gap-3.5 group shrink-0">
                <div class="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 p-0.5 shadow-lg shadow-blue-500/25 group-hover:scale-105 transition-transform duration-300 shrink-0">
                    <div class="w-full h-full bg-[var(--surface-1)] dark:bg-[#070c18] rounded-[14px] flex items-center justify-center p-2">
                        <img src="/favicon.svg" alt="AppCenter Logo" class="w-full h-full object-contain filter drop-shadow-[0_0_10px_rgba(37,99,235,0.6)]" />
                    </div>
                </div>
                <div class="flex flex-col shrink-0">
                    <span class="font-extrabold text-lg sm:text-xl tracking-tight text-[var(--text)] whitespace-nowrap">
                        Ziqva <span class="text-blue-600 dark:text-blue-400">Labs</span>
                    </span>
                    <span class="text-[10px] font-bold text-[var(--text-3)] tracking-wider uppercase whitespace-nowrap">Automated Software Hub</span>
                </div>
            </a>

            <!-- Desktop Nav Links (Clean Borderless with Floating Active Pill) -->
            <nav class="hidden lg:relative lg:flex items-center gap-1 shrink-0">
                <!-- Sliding Animated Active Pill (No outer box/track) -->
                {#if pillInitialized && pillStyle.width > 0}
                    <div
                        class="absolute top-0 bottom-0 rounded-full bg-blue-600 shadow-md shadow-blue-600/35 transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none"
                        style="left: {pillStyle.left}px; width: {pillStyle.width}px;"
                    ></div>
                {/if}

                {#each navLinks as link}
                    <button
                        bind:this={navElements[link.id]}
                        on:click={() => handleNavClick(link.id)}
                        class="relative z-10 px-3.5 py-2 rounded-full text-sm font-bold transition-colors duration-200 whitespace-nowrap cursor-pointer {activeNav === link.id ? 'text-white' : 'text-[var(--text-2)] hover:text-[var(--text)]'}"
                    >
                        {link.label}
                    </button>
                {/each}
            </nav>

            <!-- Actions Right -->
            <div class="hidden lg:flex items-center gap-3.5 shrink-0">
                <ThemeToggle />

                {#if isAuthenticated}
                    <button
                        on:click={() => push('/member/dashboard')}
                        class="px-5 py-2.5 rounded-full font-bold text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 whitespace-nowrap cursor-pointer"
                    >
                        Buka Member Area →
                    </button>
                {:else if isAdminAuthenticated}
                    <button
                        on:click={() => push('/admin/dashboard')}
                        class="px-5 py-2.5 rounded-full font-bold text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 whitespace-nowrap cursor-pointer"
                    >
                        Buka Admin Panel →
                    </button>
                {:else}
                    <button
                        on:click={() => push('/member/login')}
                        class="px-3.5 py-2 rounded-xl text-sm font-semibold text-[var(--text-2)] hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap cursor-pointer"
                    >
                        Masuk
                    </button>
                    <button
                        on:click={() => push('/member/register')}
                        class="px-5 py-2.5 rounded-full font-bold text-sm bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 hover:scale-105 active:scale-95 transition-all duration-200 whitespace-nowrap cursor-pointer"
                    >
                        Daftar Gratis
                    </button>
                {/if}
            </div>

            <!-- Mobile Menu Toggle -->
            <div class="flex items-center gap-2.5 lg:hidden">
                <ThemeToggle />
                <button
                    on:click={() => mobileMenuOpen = !mobileMenuOpen}
                    class="p-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] text-[var(--text)] hover:border-blue-500/40 transition-colors"
                    aria-label="Toggle Menu"
                >
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
            </div>
        </div>

        <!-- Mobile Drawer with Smooth Slide Transition -->
        {#if mobileMenuOpen}
            <div transition:slide={{ duration: 250 }} class="md:hidden border-t border-[var(--border)] bg-[var(--surface)]/95 backdrop-blur-2xl px-4 py-6 space-y-4 shadow-xl">
                <nav class="flex flex-col space-y-2.5 font-semibold text-sm text-[var(--text-2)]">
                    {#each navLinks as link}
                        <button
                            on:click={() => { handleNavClick(link.id); mobileMenuOpen = false; }}
                            class="text-left py-2.5 px-4 rounded-xl transition-colors {activeNav === link.id ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-500/20' : 'hover:bg-[var(--surface-2)] text-[var(--text)]'}"
                        >
                            {link.label}
                        </button>
                    {/each}
                </nav>
                <div class="pt-4 border-t border-[var(--border)] flex flex-col gap-3">
                    {#if isAuthenticated}
                        <button
                            on:click={() => push('/member/dashboard')}
                            class="w-full py-3 rounded-full font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                        >
                            Buka Member Area →
                        </button>
                    {:else if isAdminAuthenticated}
                        <button
                            on:click={() => push('/admin/dashboard')}
                            class="w-full py-3 rounded-full font-bold text-center bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                        >
                            Buka Admin Panel →
                        </button>
                    {:else}
                        <button
                            on:click={() => push('/member/login')}
                            class="w-full py-3 rounded-xl font-semibold border border-[var(--border)] text-center text-[var(--text)] bg-[var(--surface-2)]"
                        >
                            Masuk
                        </button>
                        <button
                            on:click={() => push('/member/register')}
                            class="w-full py-3 rounded-full font-bold text-center bg-gradient-to-r from-blue-600 via-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/25"
                        >
                            Daftar Gratis
                        </button>
                    {/if}
                </div>
            </div>
        {/if}
    </header>

    <!-- SECTION 2: HERO 3D ECOSYSTEM -->
    <section id="hero" class="relative overflow-hidden pt-12 pb-16 lg:pt-20 lg:pb-24">
        <!-- Subtle Ambient Background Light -->
        <div class="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[260px] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none -z-10"></div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div class="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
                <!-- Left Hero Copy -->
                <div class="lg:col-span-7 space-y-6 text-center lg:text-left">
                    <div use:viewportReveal={{ delay: 100, y: 15 }} class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-blue-500/25 bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold text-xs">
                        <span>Software Bot Desktop & Lisensi Resmi</span>
                    </div>

                    <h1 use:viewportReveal={{ delay: 200, y: 20 }} class="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.2] text-[var(--text)]">
                        Otomasi Praktis untuk <br class="hidden sm:block" />
                        <span class="text-blue-600 dark:text-blue-400 inline-block whitespace-nowrap overflow-hidden">
                            <span>{typedText || '\u00A0'}</span><span class="inline-block w-[3px] h-[0.8em] bg-blue-600 dark:bg-blue-400 ml-1 animate-pulse align-middle"></span>
                        </span>
                    </h1>

                    <p use:viewportReveal={{ delay: 300, y: 15 }} class="text-base sm:text-lg text-[var(--text-2)] leading-relaxed max-w-2xl mx-auto lg:mx-0">
                        Hemat waktu operasional harian Anda dengan software otomatisasi desktop yang andal. Akses lisensi resmi, panduan video lengkap, dan sistem yang berjalan mandiri di komputer Anda.
                    </p>

                    <div use:viewportReveal={{ delay: 400, y: 15 }} class="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                        <button
                            on:click={() => scrollToSection('catalog')}
                            class="w-full sm:w-auto px-7 py-3.5 rounded-xl font-bold text-sm bg-blue-600 hover:bg-blue-500 text-white shadow-md shadow-blue-500/25 hover:-translate-y-0.5 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <svg class="w-4 h-4 text-white shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Lihat Katalog Software
                        </button>
                        <button
                            on:click={() => { selectedFilter = 'free'; scrollToSection('catalog'); }}
                            class="w-full sm:w-auto px-6 py-3.5 rounded-xl font-bold text-sm border border-[var(--border)] bg-[var(--surface-1)] hover:bg-[var(--surface-2)] text-[var(--text)] hover:text-blue-600 dark:hover:text-blue-400 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                        >
                            <span class="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                            Tools Gratis (Rp 0)
                        </button>
                    </div>

                    <!-- Micro Metrics Under Hero -->
                    <div use:viewportReveal={{ delay: 500, y: 15 }} class="pt-4 grid grid-cols-3 gap-3 text-left max-w-lg mx-auto lg:mx-0">
                        <div class="p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs">
                            <div class="text-lg sm:text-xl font-black text-[var(--text)]">8.6k+</div>
                            <div class="text-[11px] text-[var(--text-3)] font-medium">Pengguna Aktif</div>
                        </div>

                        <div class="p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs">
                            <div class="text-lg sm:text-xl font-black text-[var(--text)]">30+</div>
                            <div class="text-[11px] text-[var(--text-3)] font-medium">Software & Bot</div>
                        </div>

                        <div class="p-3.5 rounded-xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs">
                            <div class="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">100%</div>
                            <div class="text-[11px] text-[var(--text-3)] font-medium">Lisensi Resmi</div>
                        </div>
                    </div>

                    <!-- Trust Points -->
                    <div use:viewportReveal={{ delay: 600, type: 'fade' }} class="pt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-[var(--text-2)]">
                        <span class="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap">✓ Aktivasi 24/7</span>
                        <span class="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap">✓ QRIS & Bank</span>
                        <span class="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap">✓ Update Otomatis</span>
                        <span class="px-3 py-2 rounded-xl border border-[var(--border)] bg-[var(--surface-1)] flex items-center justify-center gap-1.5 shadow-xs whitespace-nowrap">✓ Windows & Mac</span>
                    </div>
                </div>

                <!-- Right Hero Visual 3D Showcase (Clean, Focused 3D Earth) -->
                <div in:scale={{ start: 0.9, duration: 500, delay: 200, easing: backOut }} class="lg:col-span-5 flex justify-center">
                    <div class="relative w-full max-w-[420px] aspect-square flex items-center justify-center p-3">
                        
                        <!-- Theme-Aware Soft Circular Frame -->
                        <div class="absolute inset-2 rounded-full bg-gradient-to-tr from-blue-100/60 via-slate-50/30 to-blue-50/50 dark:from-[#091224]/80 dark:via-[#070e1c]/60 dark:to-transparent border border-blue-200/50 dark:border-blue-500/15 shadow-xl pointer-events-none transition-all duration-300"></div>

                        <!-- 3D Three.js Hologram Canvas Viewport -->
                        <div
                            bind:this={threeContainer}
                            class="w-full h-full flex items-center justify-center pointer-events-auto cursor-grab active:cursor-grabbing z-10"
                            title="Tarik mouse untuk memutar 3D Bumi"
                        ></div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- SECTION 3: LIVE SOFTWARE CATALOG & FREE TOOLS SHOWCASE -->
    <section id="catalog" class="py-20 bg-[var(--surface)] border-y border-[var(--border)] relative transition-colors duration-300">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="text-center max-w-3xl mx-auto mb-10 space-y-4">
                <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 text-xs font-extrabold uppercase tracking-wider">
                    <span>Eksplorasi Ekosistem</span>
                </div>
                <h2 class="text-2xl sm:text-4xl font-black text-[var(--text)] tracking-tight">
                    Katalog <span class="text-blue-600 dark:text-blue-400">Software Bot & Tools Otomatisasi</span>
                </h2>
                <p class="text-sm sm:text-base text-[var(--text-2)] leading-relaxed">
                    Lisensi resmi dengan proteksi Machine ID fleksibel yang dapat dipindahkan ke perangkat baru kapan saja. Dilengkapi installer resmi Windows & Mac, panduan video tutorial, dan bantuan teknis langsung.
                </p>

                <!-- Search Input Bar (High-Contrast Cool Glassmorphism & Keyboard Shortcut Affordance) -->
                <div class="pt-3 max-w-lg mx-auto relative group">
                    <!-- Subtle Ambient Search Glow -->
                    <div class="absolute -inset-1 bg-gradient-to-r from-blue-600/20 via-indigo-600/15 to-cyan-500/20 rounded-3xl blur-md opacity-0 group-focus-within:opacity-100 group-hover:opacity-60 transition-opacity duration-300 pointer-events-none"></div>

                    <div class="relative flex items-center w-full rounded-2xl bg-white/90 dark:bg-[#070e22]/90 border border-slate-300 dark:border-blue-500/30 shadow-md dark:shadow-xl dark:shadow-black/40 backdrop-blur-xl focus-within:border-blue-500 dark:focus-within:border-blue-400 focus-within:ring-4 focus-within:ring-blue-500/15 transition-all duration-200">
                        <div class="pl-4 flex items-center pointer-events-none text-blue-600 dark:text-blue-400">
                            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            bind:value={searchQuery}
                            on:input={handleSearchInput}
                            placeholder="Cari software, bot, atau tools otomatisasi..."
                            class="w-full pl-3.5 pr-12 py-3.5 bg-transparent text-sm font-medium text-[var(--text)] placeholder-slate-400 dark:placeholder-slate-400 focus:outline-none"
                        />
                        <div class="pr-3.5 flex items-center">
                            {#if searchQuery}
                                <button
                                    on:click={() => { searchQuery = ''; handleFilterChange(selectedFilter); }}
                                    class="p-1.5 rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-500 hover:text-[var(--text)] transition-colors"
                                    title="Hapus pencarian"
                                >
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                                </button>
                            {:else}
                                <kbd class="hidden sm:inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[10px] font-mono font-bold text-slate-400 dark:text-slate-400 shadow-2xs">
                                    ⌘K
                                </kbd>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- Smooth Full-Width Category & Tag Filter Badges (Contextual Icons & No Clipping) -->
                <div class="pt-6 max-w-5xl mx-auto px-2">
                    <div class="flex flex-wrap items-center justify-center gap-2.5">
                        <button
                            on:click={() => handleFilterChange('all')}
                            class="px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-1.5 {selectedFilter === 'all' ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105 border border-blue-400/30' : 'bg-[var(--surface-1)]/80 dark:bg-[#0b1328]/80 text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] border border-[var(--border)] shadow-xs hover:border-blue-500/40'}"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
                            Semua Software ({totalProducts || products.length})
                        </button>
                        {#if bundleCount > 0}
                            <button
                                on:click={() => handleFilterChange('bundle')}
                                class="px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer {selectedFilter === 'bundle' ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/30 scale-105 border border-indigo-400/30' : 'bg-[var(--surface-1)]/80 dark:bg-[#0b1328]/80 text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] border border-[var(--border)] shadow-xs hover:border-indigo-500/40'}"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                Paket Bundle ({bundleCount})
                            </button>
                        {/if}
                        {#if freeToolsCount > 0}
                            <button
                                on:click={() => handleFilterChange('free')}
                                class="px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 flex items-center gap-1.5 cursor-pointer {selectedFilter === 'free' ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/30 scale-105 font-black border border-emerald-400' : 'bg-[var(--surface-1)]/80 dark:bg-[#0b1328]/80 text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] border border-[var(--border)] shadow-xs hover:border-emerald-500/40'}"
                            >
                                <svg class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V6a2 2 0 10-2 2h2zm0 13C10.832 21 4 17.5 4 10.5M12 21c1.168 0 8-3.5 8-10.5" /></svg>
                                Tools Gratis Rp 0 ({freeToolsCount})
                            </button>
                        {/if}
                        {#each categories as cat}
                            <button
                                on:click={() => handleFilterChange(cat.id)}
                                class="px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 {selectedFilter === cat.id ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105 border border-blue-400/30' : 'bg-[var(--surface-1)]/80 dark:bg-[#0b1328]/80 text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] border border-[var(--border)] shadow-xs hover:border-blue-500/40'}"
                            >
                                {#if cat.icon && (cat.icon.startsWith('/') || cat.icon.startsWith('http')) && !catImgErrorMap['cat_' + cat.id]}
                                    <img
                                        src={cat.icon}
                                        alt={cat.name}
                                        class="w-4 h-4 rounded-md object-cover shrink-0 shadow-2xs"
                                        on:error={() => catImgErrorMap['cat_' + cat.id] = true}
                                    />
                                {:else}
                                    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                {/if}
                                <span>#{cat.name}</span>
                            </button>
                        {/each}
                        {#each availableTags as tag}
                            {#if !categories.some(c => c.name.toLowerCase() === tag.toLowerCase())}
                                {@const matchedCat = categories.find(c => c.name.toLowerCase() === tag.toLowerCase() || (c.slug && c.slug.toLowerCase() === tag.toLowerCase()))}
                                <button
                                    on:click={() => handleFilterChange('tag:' + tag)}
                                    class="px-4 py-2.5 rounded-2xl text-xs font-bold transition-all duration-200 cursor-pointer flex items-center gap-2 {selectedFilter === 'tag:' + tag ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30 scale-105 border border-blue-400/30' : 'bg-[var(--surface-1)]/80 dark:bg-[#0b1328]/80 text-[var(--text-2)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] border border-[var(--border)] shadow-xs hover:border-blue-500/40'}"
                                >
                                    {#if matchedCat && matchedCat.icon && (matchedCat.icon.startsWith('/') || matchedCat.icon.startsWith('http')) && !catImgErrorMap['tag_' + tag]}
                                        <img
                                            src={matchedCat.icon}
                                            alt={tag}
                                            class="w-4 h-4 rounded-md object-cover shrink-0 shadow-2xs"
                                            on:error={() => catImgErrorMap['tag_' + tag] = true}
                                        />
                                    {:else}
                                        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                    {/if}
                                    <span>#{tag}</span>
                                </button>
                            {/if}
                        {/each}
                    </div>
                </div>
            </div>

            <!-- Product Grid (Server-Rendered 10-Item Paged Grid) -->
            {#if loading && products.length === 0}
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {#each Array(6) as _}
                        <div class="h-72 rounded-3xl bg-[var(--surface-1)]/60 animate-pulse border border-[var(--border)]"></div>
                    {/each}
                </div>
            {:else if products.length === 0}
                <div class="text-center py-16 bg-[var(--surface-1)]/80 rounded-3xl border border-[var(--border)] space-y-3 backdrop-blur-md">
                    <div class="w-12 h-12 rounded-2xl bg-[var(--surface-2)] text-[var(--text-3)] mx-auto flex items-center justify-center">
                        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <p class="text-base text-[var(--text)] font-bold">Tidak ada software yang cocok.</p>
                    <p class="text-xs text-[var(--text-3)]">Coba gunakan kata kunci pencarian lain atau pilih filter "Semua Software".</p>
                    <button on:click={() => { searchQuery = ''; handleFilterChange('all'); }} class="px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500 transition-colors shadow-md shadow-blue-500/20">Reset Filter</button>
                </div>
            {:else}
                <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {#each products as p, idx}
                        {@const osInfo = checkOSSupport(p.installer_files)}
                        {@const bundledItems = p.is_bundle ? getIncludedProductItems(p.bundle_items) : []}
                        <div
                            in:scale={{ start: 0.94, duration: 400, delay: idx * 50, easing: backOut }}
                            on:click={() => selectedProductDetail = p}
                            class="group relative bg-[var(--surface-1)]/75 dark:bg-[#0c162e]/75 border {p.price === 0 ? 'border-emerald-500/40 hover:border-emerald-400 hover:shadow-emerald-500/10' : p.is_bundle ? 'border-indigo-500/40 hover:border-indigo-400 hover:shadow-indigo-500/10' : 'border-white/40 dark:border-blue-500/20 hover:border-blue-500/60 dark:hover:border-blue-400/60 hover:shadow-blue-500/10'} backdrop-blur-xl rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-2xl flex flex-col justify-between cursor-pointer"
                        >
                            <!-- Specular Light Bevel Reflection on Top Rim -->
                            <div class="absolute inset-0 rounded-3xl {p.price === 0 ? 'bg-gradient-to-b from-emerald-500/10 to-transparent' : p.is_bundle ? 'bg-gradient-to-b from-indigo-500/10 to-transparent' : 'bg-gradient-to-b from-white/10 dark:from-white/5 to-transparent'} pointer-events-none"></div>

                            <div class="relative z-10">
                                <!-- Card Header Badges & Icon -->
                                <div class="flex items-start justify-between gap-4 mb-4">
                                    {#if p.is_bundle}
                                        <!-- Glassmorphic App Stack Visual for Bundle -->
                                        <div class="flex items-center -space-x-3 hover:space-x-1 transition-all duration-300">
                                            {#if bundledItems.length > 0}
                                                {#each bundledItems.slice(0, 3) as item, bIdx}
                                                    <div
                                                        class="w-11 h-11 rounded-2xl bg-[var(--surface-2)]/90 border-2 border-[var(--surface-1)] shadow-md overflow-hidden flex items-center justify-center shrink-0 backdrop-blur-md"
                                                        style="z-index: {10 - bIdx};"
                                                    >
                                                        {#if item.image}
                                                            <img src={item.image} alt={item.name} class="w-full h-full object-contain p-1.5" />
                                                        {:else}
                                                            <span class="font-black text-xs text-indigo-500">{item.name.charAt(0)}</span>
                                                        {/if}
                                                    </div>
                                                {/each}
                                            {:else}
                                                <div class="w-11 h-11 rounded-2xl bg-indigo-500/20 border border-indigo-500/40 p-2.5 flex items-center justify-center shrink-0 shadow-xs">
                                                    <svg class="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                                </div>
                                            {/if}
                                        </div>
                                    {:else if p.price === 0}
                                        <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-2.5 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:border-emerald-500/60 transition-all duration-300 shadow-sm backdrop-blur-md">
                                            {#if p.image}
                                                <img src={p.image} alt={p.name} class="w-full h-full object-contain" />
                                            {:else}
                                                <span class="font-black text-emerald-600 dark:text-emerald-400 text-lg">{p.name.charAt(0)}</span>
                                            {/if}
                                        </div>
                                    {:else}
                                        <div class="w-12 h-12 rounded-2xl bg-[var(--surface-2)]/90 border border-[var(--border)] p-2.5 flex items-center justify-center shrink-0 group-hover:scale-110 group-hover:border-blue-500/40 transition-all duration-300 shadow-sm backdrop-blur-md">
                                            {#if p.image}
                                                <img src={p.image} alt={p.name} class="w-full h-full object-contain" />
                                            {:else}
                                                <span class="font-black text-blue-600 dark:text-blue-400 text-lg">{p.name.charAt(0)}</span>
                                            {/if}
                                        </div>
                                    {/if}

                                    <div class="flex flex-col items-end gap-1">
                                        {#if p.price === 0}
                                            <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/15 border border-emerald-500/35 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                                <svg class="w-3 h-3 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                                                AKSES GRATIS
                                            </span>
                                        {:else if p.is_bundle}
                                            <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-indigo-500/15 border border-indigo-500/35 text-indigo-600 dark:text-indigo-400 flex items-center gap-1">
                                                <svg class="w-3 h-3 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" /></svg>
                                                PAKET BUNDLE ({bundledItems.length} TOOLS)
                                            </span>
                                        {/if}
                                        {#if p.category_name}
                                            {@const matchedCat = categories.find(c => c.name.toLowerCase() === (p.category_name || '').toLowerCase() || c.id === p.category_id)}
                                            <span class="text-[10px] font-bold text-[var(--text-3)] flex items-center gap-1.5 bg-[var(--surface-2)]/70 px-2 py-0.5 rounded-lg border border-[var(--border)] backdrop-blur-xs">
                                                {#if matchedCat && matchedCat.icon && (matchedCat.icon.startsWith('/') || matchedCat.icon.startsWith('http')) && !catImgErrorMap['card_cat_' + matchedCat.id]}
                                                    <img
                                                        src={matchedCat.icon}
                                                        alt={p.category_name}
                                                        class="w-3.5 h-3.5 rounded object-cover shrink-0"
                                                        on:error={() => catImgErrorMap['card_cat_' + (matchedCat ? matchedCat.id : 0)] = true}
                                                    />
                                                {:else}
                                                    <span class="w-1.5 h-1.5 rounded-full {p.price === 0 ? 'bg-emerald-500' : p.is_bundle ? 'bg-indigo-500' : 'bg-blue-500'}"></span>
                                                {/if}
                                                <span>#{p.category_name}</span>
                                            </span>
                                        {/if}
                                    </div>
                                </div>

                                <!-- Product Info -->
                                <button on:click={() => selectedProductDetail = p} class="text-left w-full group/title">
                                    <h3 class="font-extrabold text-lg text-[var(--text)] group-hover/title:text-blue-600 dark:group-hover/title:text-blue-400 transition-colors line-clamp-1">
                                        {p.name}
                                    </h3>
                                </button>
                                <p class="text-xs text-[var(--text-2)] mt-2 line-clamp-2 leading-relaxed">
                                    {p.description || 'Software bot desktop siap pakai untuk otomatisasi tugas rutin dan optimalisasi workflow digital.'}
                                </p>

                                <!-- Automated OS Platform Support Badges -->
                                <div class="mt-3.5 flex items-center gap-2 text-[10px] font-semibold text-[var(--text-3)]">
                                    <span class="text-[10px] text-[var(--text-3)] font-bold">Dukungan:</span>
                                    {#if osInfo.windows}
                                        <span class="px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-bold shadow-xs">
                                            <svg class="w-3.5 h-3.5 text-blue-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
                                            Windows
                                        </span>
                                    {/if}
                                    {#if osInfo.mac}
                                        <span class="px-2.5 py-1 rounded-lg bg-slate-500/10 border border-slate-400/30 dark:border-slate-600/40 flex items-center gap-1.5 text-slate-700 dark:text-slate-200 font-bold shadow-xs">
                                            <svg class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.87.96-2.96-1 .04-2.16.67-2.85 1.48-.58.68-.97 1.76-.84 2.82 1.11.09 2.09-.56 2.73-1.34z"/></svg>
                                            macOS
                                        </span>
                                    {/if}
                                    {#if !osInfo.hasAny}
                                        <span class="px-2.5 py-1 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] flex items-center gap-1.5 text-[var(--text-3)] font-medium">
                                            <svg class="w-3.5 h-3.5 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                            Desktop Bot
                                        </span>
                                    {/if}
                                </div>

                                <!-- Included Bundle Tools if Bundle -->
                                {#if p.is_bundle && bundledItems.length > 0}
                                    <div class="mt-3 pt-3 border-t border-[var(--border)] space-y-1.5">
                                        <div class="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center gap-1">
                                            <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                            Software di Dalam Paket:
                                        </div>
                                        <div class="flex flex-wrap gap-1.5">
                                            {#each bundledItems as item}
                                                <span class="px-2 py-1 rounded-lg bg-[var(--surface-2)]/80 border border-[var(--border)] text-[10px] font-semibold text-[var(--text-2)] flex items-center gap-1 shadow-2xs backdrop-blur-sm">
                                                    <svg class="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" /></svg>
                                                    {item.name}
                                                </span>
                                            {/each}
                                        </div>
                                    </div>
                                {/if}
                            </div>

                            <!-- Footer Price & CTA -->
                            <div class="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between relative z-10">
                                <div>
                                    {#if p.price === 0}
                                        <div class="text-sm font-black text-emerald-600 dark:text-emerald-400">Gratis (Rp 0)</div>
                                        <div class="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 font-bold">Akses 100% Bebas Biaya</div>
                                    {:else if p.is_bundle}
                                        <div class="flex items-baseline gap-1">
                                            <span class="text-sm font-black text-[var(--text)]">{formatRupiah(p.price)}</span>
                                            <span class="text-[10px] font-extrabold text-indigo-600 dark:text-indigo-400">/ paket</span>
                                        </div>
                                        {#if p.original_price && p.original_price > p.price}
                                            <div class="text-[10px] text-[var(--text-3)] line-through">Rp {p.original_price.toLocaleString('id-ID')}</div>
                                        {/if}
                                    {:else}
                                        <div class="flex items-baseline gap-1">
                                            <span class="text-sm font-black text-[var(--text)]">{formatRupiah(p.price)}</span>
                                            <span class="text-[10px] font-extrabold text-blue-600 dark:text-blue-400">/ bulan</span>
                                        </div>
                                        {#if p.original_price && p.original_price > p.price}
                                            <div class="text-[10px] text-[var(--text-3)] line-through">Rp {p.original_price.toLocaleString('id-ID')}</div>
                                        {/if}
                                    {/if}
                                </div>

                                <div>
                                    <button
                                        on:click|stopPropagation={() => push(isAuthenticated ? '/member/orders/create' : '/member/login')}
                                        class="px-5 py-2.5 rounded-xl text-xs font-extrabold {p.price === 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-emerald-500/25' : p.is_bundle ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-indigo-500/25' : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-blue-500/25'} hover:brightness-110 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 transition-all cursor-pointer"
                                    >
                                        {#if p.price === 0}
                                            Klaim Gratis →
                                        {:else if p.is_bundle}
                                            Pesan Paket →
                                        {:else}
                                            Pesan Lisensi →
                                        {/if}
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Load More Button (Server-Side 10-Item Progressive Pagination) -->
                {#if hasMore}
                    <div in:fade={{ duration: 200 }} class="mt-12 flex justify-center">
                        <button
                            on:click={loadMore}
                            disabled={loadingMore}
                            class="px-8 py-3.5 rounded-2xl font-bold text-xs sm:text-sm bg-[var(--surface-1)] border border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white shadow-lg shadow-blue-500/10 hover:shadow-blue-500/30 hover:-translate-y-0.5 active:scale-95 transition-all duration-200 flex items-center gap-2.5 disabled:opacity-50 cursor-pointer"
                        >
                            {#if loadingMore}
                                <div class="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                                <span>Memuat software...</span>
                            {:else}
                                <span>Muat 10 Software Berikutnya</span>
                                {#if remainingCount > 0}
                                    <span class="px-2 py-0.5 rounded-md bg-blue-500/20 text-[11px] font-extrabold">{remainingCount} lagi</span>
                                {/if}
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                            {/if}
                        </button>
                    </div>
                {/if}
            {/if}
        </div>
    </section>

    <!-- SECTION 4: PLATFORM SECURITY & INVARIANTS (Clean Linear-style Bento Grid) -->
    <section id="features" class="py-20 relative overflow-hidden bg-[var(--page)] transition-colors duration-300">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Section Heading (Scroll-Driven Viewport Reveal) -->
            <div use:viewportReveal={{ delay: 100, y: 20 }} class="text-center max-w-3xl mx-auto mb-14 space-y-3">
                <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-600 dark:text-blue-400 text-xs font-bold">
                    <span>Keunggulan Platform</span>
                </div>
                <h2 class="text-2xl sm:text-4xl font-black text-[var(--text)] tracking-tight leading-snug">
                    Dirancang untuk <span class="text-blue-600 dark:text-blue-400 inline-block whitespace-nowrap overflow-hidden"><span>{featuresTypedText || '\u00A0'}</span><span class="inline-block w-[3px] h-[0.8em] bg-blue-600 dark:bg-blue-400 ml-1 animate-pulse align-middle"></span></span>
                </h2>
                <p class="text-sm sm:text-base text-[var(--text-2)] leading-relaxed">
                    Software bot yang dibangun dengan fokus pada efisiensi komputer Anda, kemudahan instalasi, dan kebebasan pengelolaan lisensi.
                </p>
            </div>

            <!-- Clean Symmetrical Bento Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-5">
                <!-- Bento Card 1 (Span 2 Cols): Flexible Machine ID Transfer -->
                <div use:viewportReveal={{ delay: 150, type: 'scale' }} class="md:col-span-2 bg-[var(--surface-1)] border border-[var(--border)] p-7 rounded-2xl transition-all duration-200 hover:border-blue-500/40 flex flex-col justify-between shadow-xs">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div class="w-11 h-11 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                            </div>
                            <span class="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                                BEBAS PINDAH PERANGKAT
                            </span>
                        </div>

                        <div>
                            <h3 class="text-xl font-bold text-[var(--text)]">
                                Lisensi Fleksibel & Bebas Pindah Laptop
                            </h3>
                            <p class="text-xs sm:text-sm text-[var(--text-2)] mt-2 leading-relaxed">
                                Setiap lisensi aman terlindungi. Jika Anda berganti komputer atau laptop, lisensi bisa dipindahkan sendiri kapan saja dari halaman member tanpa perlu bayar ulang.
                            </p>
                        </div>
                    </div>

                    <div class="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs font-semibold text-[var(--text-3)]">
                        <div class="flex items-center gap-2">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                            <span>Bisa Dipindahkan Sendiri di Member Area</span>
                        </div>
                        <span class="text-blue-600 dark:text-blue-400">Akses Fleksibel →</span>
                    </div>
                </div>

                <!-- Bento Card 2 (Span 1 Col): Native Multi-Thread & High-Performance Automation -->
                <div use:viewportReveal={{ delay: 230, type: 'scale' }} class="bg-[var(--surface-1)] border border-[var(--border)] p-7 rounded-2xl transition-all duration-200 hover:border-emerald-500/40 flex flex-col justify-between shadow-xs">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div class="w-11 h-11 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                            <span class="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                RINGAN & CEPAT
                            </span>
                        </div>

                        <div>
                            <h3 class="text-lg font-bold text-[var(--text)]">
                                Automasi Ringan & Banyak Akun
                            </h3>
                            <p class="text-xs text-[var(--text-2)] mt-2 leading-relaxed">
                                Dibuat khusus agar tidak membebani memori komputer. Bisa menjalankan banyak akun sekaligus di Windows dan Mac dengan lancar tanpa membuat laptop lag.
                            </p>
                        </div>
                    </div>

                    <div class="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs font-semibold text-[var(--text-3)]">
                        <span>Hemat CPU & RAM</span>
                        <span class="text-emerald-600 dark:text-emerald-400">Multi-Akun →</span>
                    </div>
                </div>

                <!-- Bento Card 3 (Span 1 Col): Instant Payment & Webhook -->
                <div use:viewportReveal={{ delay: 300, type: 'scale' }} class="bg-[var(--surface-1)] border border-[var(--border)] p-7 rounded-2xl transition-all duration-200 hover:border-indigo-500/40 flex flex-col justify-between shadow-xs">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div class="w-11 h-11 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                            </div>
                            <span class="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                                OTOMATIS
                            </span>
                        </div>

                        <div>
                            <h3 class="text-lg font-bold text-[var(--text)]">
                                Pembayaran Otomatis & Serial Instan
                            </h3>
                            <p class="text-xs text-[var(--text-2)] mt-2 leading-relaxed">
                                Mendukung QRIS dan transfer bank 24/7. Serial key dan tautan unduhan langsung terbit seketika tanpa perlu menunggu konfirmasi manual.
                            </p>
                        </div>
                    </div>

                    <div class="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs font-semibold text-[var(--text-3)]">
                        <span>Aktivasi 24 Jam</span>
                        <span class="text-indigo-600 dark:text-indigo-400">QRIS & Bank →</span>
                    </div>
                </div>

                <!-- Bento Card 4 (Span 1 Col): Auto-Updater System -->
                <div use:viewportReveal={{ delay: 350, type: 'scale' }} class="bg-[var(--surface-1)] border border-[var(--border)] p-7 rounded-2xl transition-all duration-200 hover:border-cyan-500/40 flex flex-col justify-between shadow-xs">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div class="w-11 h-11 rounded-xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </div>
                            <span class="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                                AUTO-UPDATE
                            </span>
                        </div>

                        <div>
                            <h3 class="text-lg font-bold text-[var(--text)]">
                                Update Otomatis Tanpa Ribet
                            </h3>
                            <p class="text-xs text-[var(--text-2)] mt-2 leading-relaxed">
                                Software bot otomatis mengunduh perbaikan saat ada pembaruan dari YouTube atau marketplace, tanpa perlu install ulang dari awal.
                            </p>
                        </div>
                    </div>

                    <div class="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs font-semibold text-[var(--text-3)]">
                        <span>Pembaruan Berkala</span>
                        <span class="text-cyan-600 dark:text-cyan-400">In-App Update →</span>
                    </div>
                </div>

                <!-- Bento Card 5 (Span 1 Col): Video Hub -->
                <div use:viewportReveal={{ delay: 400, type: 'scale' }} class="bg-[var(--surface-1)] border border-[var(--border)] p-7 rounded-2xl transition-all duration-200 hover:border-purple-500/40 flex flex-col justify-between shadow-xs">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <div class="w-11 h-11 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </div>
                            <span class="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                                VIDEO HUB
                            </span>
                        </div>

                        <div>
                            <h3 class="text-lg font-bold text-[var(--text)]">
                                Pusat Video Panduan
                            </h3>
                            <p class="text-xs text-[var(--text-2)] mt-2 leading-relaxed">
                                Dapatkan akses video tutorial langkah demi langkah di Member Area dari pengenalan awal hingga strategi praktis menjalankan bot.
                            </p>
                        </div>
                    </div>

                    <div class="mt-6 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs font-semibold text-[var(--text-3)]">
                        <span>Tutorial Step-by-Step</span>
                        <span class="text-purple-600 dark:text-purple-400">Tonton Modul →</span>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- SECTION 4.5: PLATFORM GUARANTEES & TERMS -->
    <section id="terms-guarantee" class="py-16 bg-[var(--surface)] border-y border-[var(--border)] relative transition-colors duration-300">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="bg-[var(--surface-1)] border border-blue-500/30 rounded-3xl p-6 sm:p-10 shadow-lg space-y-6">
                <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-[var(--border)] pb-6">
                    <div>
                        <span class="px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1.5 w-fit">
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            KETENTUAN & GARANSI SERVIS
                        </span>
                        <h3 class="text-xl sm:text-2xl font-black text-[var(--text)] mt-2">Ketentuan Lisensi Transparan & Tanpa Biaya Tersembunyi</h3>
                    </div>
                    <div class="text-xs text-[var(--text-3)] font-semibold shrink-0">
                        Ziqva Labs Guarantee Policy v2.0
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
                    <div class="space-y-2">
                        <div class="font-extrabold text-sm text-blue-600 dark:text-blue-400 flex items-center gap-2">
                            <svg class="w-4 h-4 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
                            <span class="whitespace-nowrap">Lisensi Fleksibel & Bebas Pindah</span>
                        </div>
                        <p class="text-xs text-[var(--text-2)] leading-relaxed">
                            Lisensi aktif pada 1 PC/Laptop dalam satu waktu. Jika Anda mengganti perangkat, lisensi dapat langsung dipindahkan secara mandiri kapan saja dari Portal Member.
                        </p>
                    </div>

                    <div class="space-y-2">
                        <div class="font-extrabold text-sm text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                            <svg class="w-4 h-4 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            <span class="whitespace-nowrap">Aktivasi Instan & Otomatis</span>
                        </div>
                        <p class="text-xs text-[var(--text-2)] leading-relaxed">
                            Serial key langsung terbit di dashboard member seketika pembayaran terverifikasi atau produk Rp 0 diklaim.
                        </p>
                    </div>

                    <div class="space-y-2">
                        <div class="font-extrabold text-sm text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                            <svg class="w-4 h-4 text-indigo-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                            <span class="whitespace-nowrap">Akun & Email Terproteksi</span>
                        </div>
                        <p class="text-xs text-[var(--text-2)] leading-relaxed">
                            Email akun terkunci secara permanen pasca registrasi untuk mencegah pembajakan dan menjamin keamanan kepemilikan lisensi.
                        </p>
                    </div>

                    <div class="space-y-2">
                        <div class="font-extrabold text-sm text-purple-600 dark:text-purple-400 flex items-center gap-2">
                            <svg class="w-4 h-4 text-purple-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            <span class="whitespace-nowrap">Update Berkala & Video Hub</span>
                        </div>
                        <p class="text-xs text-[var(--text-2)] leading-relaxed">
                            Software rutin diperbarui mengikuti algoritma platform terbaru dan dilengkapi video tutorial langkah-demi-langkah di Portal Member.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- SECTION 5: PROGRAM KEMITRAAN AFILIASI & INTERACTIVE CALCULATOR -->
    <section id="affiliate" class="py-20 bg-[var(--page)] border-t border-[var(--border)] relative overflow-hidden transition-colors duration-300">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div use:viewportReveal={{ delay: 100, type: 'scale' }} class="bg-gradient-to-br from-blue-900/90 via-indigo-950/90 to-slate-900/90 dark:from-[#0b1730] dark:via-[#0d1e40] dark:to-[#121935] border border-blue-500/30 rounded-3xl p-6 sm:p-12 shadow-2xl relative overflow-hidden group text-white">
                <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center relative z-10">
                    <div use:viewportReveal={{ delay: 180, y: 20 }} class="lg:col-span-7 space-y-6 text-left flex flex-col justify-between h-full">
                        <div class="space-y-3">
                            <div class="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-blue-500/20 border border-blue-500/40 text-blue-300 text-xs font-bold shadow-inner">
                                <svg class="w-3.5 h-3.5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                PROGRAM MITRA AFILIASI RESMI
                            </div>
                            <h2 class="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                                Dapatkan Komisi Penjualan Software Hingga <span class="text-emerald-400">5%</span>
                            </h2>
                            <p class="text-sm sm:text-base text-slate-200 leading-relaxed">
                                Bagikan software bot otomatisasi resmi Ziqva Labs kepada audiens Anda. Dapatkan penghasilan pasif berkelanjutan dengan sistem kupon dan pencairan otomatis.
                            </p>
                        </div>

                        <!-- 3 Structured Feature Highlight Cards -->
                        <div use:viewportReveal={{ delay: 240, type: 'fade' }} class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                            <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-400/30 transition-all space-y-1.5 backdrop-blur-sm">
                                <div class="w-7 h-7 rounded-lg bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" /></svg>
                                </div>
                                <h4 class="text-xs font-bold text-white">Kupon Khusus 10%</h4>
                                <p class="text-[11px] text-slate-300 leading-normal">Pembeli Anda otomatis hemat 10% saat transaksi.</p>
                            </div>

                            <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-emerald-400/30 transition-all space-y-1.5 backdrop-blur-sm">
                                <div class="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                                </div>
                                <h4 class="text-xs font-bold text-white">Tracking Real-Time</h4>
                                <p class="text-[11px] text-slate-300 leading-normal">Pantau statistik klik dan komisi dari Member Area.</p>
                            </div>

                            <div class="p-3.5 rounded-2xl bg-white/5 border border-white/10 hover:border-indigo-400/30 transition-all space-y-1.5 backdrop-blur-sm">
                                <div class="w-7 h-7 rounded-lg bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
                                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
                                </div>
                                <h4 class="text-xs font-bold text-white">Pencairan Otomatis</h4>
                                <p class="text-[11px] text-slate-300 leading-normal">Transfer langsung ke rekening bank setiap akhir bulan.</p>
                            </div>
                        </div>

                        <!-- Trust Bar -->
                        <div use:viewportReveal={{ delay: 300, type: 'fade' }} class="pt-2 flex flex-wrap items-center justify-between border-t border-white/10 text-xs text-slate-300 gap-2">
                            <span class="flex items-center gap-1.5 font-medium"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span> Gratis Pendaftaran Mitra</span>
                            <span class="flex items-center gap-1.5 font-medium"><span class="w-1.5 h-1.5 rounded-full bg-blue-400"></span> Tanpa Biaya Bulanan</span>
                            <span class="flex items-center gap-1.5 font-medium"><span class="w-1.5 h-1.5 rounded-full bg-indigo-400"></span> Pembayaran Tepat Waktu</span>
                        </div>
                    </div>

                    <!-- Interactive Multi-Variable Commission Estimator Card -->
                    <div use:viewportReveal={{ delay: 240, type: 'scale' }} class="lg:col-span-5 bg-white/10 dark:bg-black/35 backdrop-blur-2xl border border-white/20 rounded-3xl p-6 sm:p-7 space-y-5 text-left shadow-2xl">
                        <div class="flex items-center justify-between border-b border-white/10 pb-3">
                            <span class="text-xs font-black text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                                <svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
                                Estimasi Komisi Afiliasi
                            </span>
                            <span class="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-extrabold border border-emerald-500/40">Komisi 5%</span>
                        </div>

                        <!-- 1. License Duration Selector with Animated Sliding Pill -->
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between text-xs text-slate-200">
                                <span class="font-bold">Durasi Langganan:</span>
                                <span class="text-blue-300 font-bold">{simDurationMonths} Bulan</span>
                            </div>
                            <div class="relative grid grid-cols-3 gap-2 p-1 rounded-2xl bg-slate-900/80 border border-white/15">
                                <!-- Sliding Active Indicator Pill -->
                                <div
                                    class="absolute inset-y-1 w-[calc(33.333%-4px)] rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/35 border border-blue-400/40 transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] pointer-events-none"
                                    style="transform: translateX({simDurationMonths === 2 ? '4px' : simDurationMonths === 4 ? 'calc(100% + 7px)' : 'calc(200% + 10px)'});"
                                ></div>

                                {#each [2, 4, 6] as m}
                                    <button
                                        type="button"
                                        on:click={() => simDurationMonths = m}
                                        class="relative z-10 py-2.5 rounded-xl text-xs font-black transition-colors duration-200 cursor-pointer {simDurationMonths === m ? 'text-white' : 'text-slate-300 hover:text-white'}"
                                    >
                                        {m} Bulan
                                    </button>
                                {/each}
                            </div>
                        </div>

                        <!-- 2. Target Sales Volume Slider with Clean Glowing Track -->
                        <div class="space-y-2.5 pt-1">
                            <div class="flex items-center justify-between text-xs text-slate-200">
                                <span class="font-bold flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                                    Target Penjualan Lisensi:
                                </span>
                                <div class="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/35 text-emerald-300 font-extrabold text-xs sm:text-sm shadow-inner">
                                    <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                                    <span>{simMonthlySales} Pembeli / Bln</span>
                                </div>
                            </div>

                            <!-- Custom Dynamic Track Range Slider -->
                            <div class="relative pt-1 pb-1">
                                <input
                                    type="range"
                                    min="1"
                                    max="100"
                                    bind:value={simMonthlySales}
                                    style="background: linear-gradient(to right, #3b82f6 0%, #10b981 {(simMonthlySales - 1) / 0.99}%, rgba(15, 23, 42, 0.9) {(simMonthlySales - 1) / 0.99}%, rgba(15, 23, 42, 0.9) 100%);"
                                    class="w-full h-3 rounded-full appearance-none cursor-pointer border border-white/20 focus:outline-none shadow-inner transition-all accent-emerald-400"
                                />
                            </div>

                            <!-- Fast Milestone Quick Click Badges -->
                            <div class="flex items-center justify-between gap-1.5 pt-0.5">
                                {#each [5, 15, 30, 50, 100] as preset}
                                    <button
                                        type="button"
                                        on:click={() => simMonthlySales = preset}
                                        class="px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer {simMonthlySales === preset ? 'bg-emerald-500/25 border-emerald-400 text-emerald-300 font-extrabold shadow-sm' : 'bg-slate-900/60 text-slate-300 border border-white/10 hover:text-white hover:bg-slate-800'}"
                                    >
                                        {preset}x
                                    </button>
                                {/each}
                            </div>
                        </div>

                        <!-- 3. Clean Single Result Box with High Contrast -->
                        <div class="p-4 rounded-2xl bg-black/40 border border-white/15 text-center space-y-1.5 shadow-inner">
                            <div class="text-[10px] text-slate-300 uppercase font-extrabold tracking-wider">Potensi Penghasilan / Bulan</div>
                            <div class="text-2xl sm:text-3xl font-black text-emerald-400">Rp {estimatedEarnings.toLocaleString('id-ID')}</div>
                            <div class="text-[11px] text-slate-300 pt-1 flex flex-wrap items-center justify-center gap-2 font-medium">
                                <span class="text-slate-200 font-semibold">Katalog Real-Time</span>
                                <span>•</span>
                                <span class="text-amber-300 font-bold">Kupon Diskon 10%</span>
                                <span>•</span>
                                <span class="text-emerald-400 font-bold">Payout Otomatis</span>
                            </div>
                        </div>

                        <button
                            on:click={() => push('/member/register')}
                            class="w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 text-white shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all text-center cursor-pointer"
                        >
                            Daftar Mitra Afiliasi Sekarang →
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- SECTION 5.5: TENTANG KAMI (ABOUT ZIQVA LABS & KAMPUNG SONGO) -->
    <section id="about" class="py-20 bg-[var(--page)] border-t border-[var(--border)] relative overflow-hidden transition-colors duration-300">
        <!-- Subtle Ambient Background Glow -->
        <div class="absolute top-1/2 right-1/4 w-96 h-96 bg-blue-500/10 dark:bg-blue-600/10 blur-3xl rounded-full pointer-events-none -z-10"></div>
        <div class="absolute bottom-10 left-10 w-80 h-80 bg-indigo-500/10 dark:bg-purple-600/10 blur-3xl rounded-full pointer-events-none -z-10"></div>

        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <!-- Section Header -->
            <div use:viewportReveal={{ delay: 100, y: 20 }} class="text-center max-w-3xl mx-auto mb-16 space-y-4">
                <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 text-xs font-extrabold uppercase tracking-wider shadow-xs">
                    <span class="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span>SEJAK 2022 • BAGIAN DARI KAMPUNG SONGO</span>
                </div>
                <h2 class="text-2xl sm:text-4xl lg:text-5xl font-black text-[var(--text)] tracking-tight leading-[1.2]">
                    Membangun Otomatisasi untuk <br class="hidden sm:inline" />
                    <span class="bg-gradient-to-r from-blue-600 via-indigo-600 to-cyan-500 dark:from-blue-400 dark:via-cyan-300 dark:to-indigo-400 bg-clip-text text-transparent inline-block whitespace-nowrap overflow-hidden">
                        <span>{aboutTypedText || '\u00A0'}</span><span class="inline-block w-[3px] h-[0.8em] bg-blue-600 dark:bg-cyan-400 ml-1 animate-pulse align-middle"></span>
                    </span>
                </h2>
                <p class="text-sm sm:text-base text-[var(--text-2)] leading-relaxed">
                    <strong>Ziqva Labs</strong> adalah tim inovasi teknologi yang dibangun oleh <strong>Kampung Songo</strong> sejak tahun 2022. Kami hadir untuk mengubah cara kerja manual yang melelahkan menjadi alur kerja otomatis yang efisien, aman, dan berdaya guna tinggi.
                </p>
            </div>

            <!-- Evolution Journey: 3-Pillar Story Bento Grid -->
            <div class="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 mb-12">
                <!-- Pillar 1: 2022 Foundation -->
                <div use:viewportReveal={{ delay: 180, type: 'scale' }} class="bg-[var(--surface-1)] border border-[var(--border)] hover:border-blue-500/40 rounded-3xl p-6 sm:p-8 space-y-5 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group flex flex-col justify-between">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <span class="px-3 py-1 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 font-mono font-black text-xs border border-blue-500/20">2022</span>
                            <div class="w-10 h-10 rounded-2xl bg-blue-600/10 text-blue-600 dark:text-blue-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                            </div>
                        </div>
                        <h3 class="text-lg font-black text-[var(--text)] group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            Lahir untuk Pelaku Dropshipper
                        </h3>
                        <p class="text-xs sm:text-sm text-[var(--text-2)] leading-relaxed">
                            Awal mula Ziqva Labs tercipta dari keresahan operasional nyata: membantu pengusaha dropshipper mengotomatiskan pengelolaan pesanan, upload massal produk, dan sinkronisasi stok tanpa menyita waktu berharga mereka.
                        </p>
                    </div>
                    <div class="pt-4 border-t border-[var(--border)] flex items-center gap-2 text-xs font-bold text-blue-600 dark:text-blue-400">
                        <span>Fokus Efisiensi Toko Online</span>
                        <span>→</span>
                    </div>
                </div>

                <!-- Pillar 2: 2023-2024 Expansion -->
                <div use:viewportReveal={{ delay: 260, type: 'scale' }} class="bg-[var(--surface-1)] border border-[var(--border)] hover:border-purple-500/40 rounded-3xl p-6 sm:p-8 space-y-5 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group flex flex-col justify-between">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <span class="px-3 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 font-mono font-black text-xs border border-purple-500/20">2023 - 2024</span>
                            <div class="w-10 h-10 rounded-2xl bg-purple-600/10 text-purple-600 dark:text-purple-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            </div>
                        </div>
                        <h3 class="text-lg font-black text-[var(--text)] group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                            Ekspansi Afiliator & YouTuber
                        </h3>
                        <p class="text-xs sm:text-sm text-[var(--text-2)] leading-relaxed">
                            Melihat kebutuhan konten digital yang masif, kami mengembangkan bot otomatisasi video, riset link affiliasi, dan alat bantu traffic organik untuk kreator YouTube serta affiliate marketer agar dapat melipatgandakan penghasilan mereka.
                        </p>
                    </div>
                    <div class="pt-4 border-t border-[var(--border)] flex items-center gap-2 text-xs font-bold text-purple-600 dark:text-purple-400">
                        <span>Otomasi Konten & Traffic</span>
                        <span>→</span>
                    </div>
                </div>

                <!-- Pillar 3: 2025-2026 AI Era -->
                <div use:viewportReveal={{ delay: 340, type: 'scale' }} class="bg-[var(--surface-1)] border border-[var(--border)] hover:border-emerald-500/40 rounded-3xl p-6 sm:p-8 space-y-5 transition-all duration-300 hover:-translate-y-1.5 shadow-sm hover:shadow-xl group flex flex-col justify-between">
                    <div class="space-y-4">
                        <div class="flex items-center justify-between">
                            <span class="px-3 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs border border-emerald-500/20">2025 - 2026</span>
                            <div class="w-10 h-10 rounded-2xl bg-emerald-600/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center group-hover:scale-110 transition-transform">
                                <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            </div>
                        </div>
                        <h3 class="text-lg font-black text-[var(--text)] group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                            AI Enthusiast & Privasi Lokal
                        </h3>
                        <p class="text-xs sm:text-sm text-[var(--text-2)] leading-relaxed">
                            Kini Ziqva Labs menjadi rumah bagi para AI enthusiast dan praktisi digital: menyajikan software bot desktop modern, lisensi fleksibel bebas pindah device, dan jaminan kedaulatan data di mana seluruh akun diproses lokal di PC pengguna.
                        </p>
                    </div>
                    <div class="pt-4 border-t border-[var(--border)] flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        <span>Ekosistem Modern Berbasis AI</span>
                        <span>→</span>
                    </div>
                </div>
            </div>

            <!-- Official Entity Seal & Heritage Banner -->
            <div use:viewportReveal={{ delay: 400, type: 'fade' }} class="p-6 sm:p-8 rounded-3xl bg-gradient-to-r from-blue-900/20 via-[var(--surface-1)] to-indigo-900/20 border border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left shadow-md">
                <div class="flex items-center gap-4">
                    <div class="w-12 h-12 rounded-2xl bg-blue-600 p-0.5 shadow-lg shadow-blue-500/30 shrink-0">
                        <div class="w-full h-full bg-[var(--surface-1)] rounded-[14px] flex items-center justify-center p-2">
                            <img src="/favicon.svg" alt="AppCenter Logo" class="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
                        </div>
                    </div>
                    <div>
                        <h4 class="font-black text-base text-[var(--text)]">Ziqva Labs — An Initiative by Kampung Songo</h4>
                        <p class="text-xs text-[var(--text-2)]">Terus berinovasi mendampingi ribuan pebisnis online, kreator konten, dan praktisi otomatisasi di seluruh Indonesia.</p>
                    </div>
                </div>
                <div class="flex items-center gap-3 shrink-0">
                    <button on:click={() => scrollToSection('catalog')} class="px-6 py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/25 hover:scale-105 active:scale-95 transition-all cursor-pointer">
                        Lihat Semua Software →
                    </button>
                </div>
            </div>
        </div>
    </section>

    <!-- SECTION 6: FAQ ACCORDION -->
    <section id="faq" class="py-20 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div use:viewportReveal={{ delay: 100, y: 20 }} class="text-center mb-12 space-y-3">
            <div class="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/25 text-blue-600 dark:text-blue-400 text-xs font-extrabold uppercase tracking-wider">
                <span>Pusat Bantuan Cepat</span>
            </div>
            <h2 class="text-2xl sm:text-4xl font-black text-[var(--text)] tracking-tight">
                Pertanyaan Sering Diajukan (FAQ)
            </h2>
            <p class="text-sm text-[var(--text-2)] leading-relaxed">
                Jawaban resmi seputar lisensi software, otomatisasi update, dan sistem pembayaran.
            </p>
        </div>

        <div class="space-y-4">
            <div
                use:viewportReveal={{ delay: 150, type: 'scale' }}
                class="bg-[var(--surface-1)] border border-[var(--border)] {openFaqIndex === 0 ? 'border-blue-500/50 shadow-md' : ''} rounded-2xl p-5 transition-all duration-300"
            >
                <button
                    on:click={() => toggleFaq(0)}
                    class="w-full flex items-center justify-between font-bold text-sm sm:text-base text-[var(--text)] text-left cursor-pointer"
                >
                    <span>Apakah saya bisa mencoba software secara gratis?</span>
                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 transition-transform duration-300 {openFaqIndex === 0 ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {#if openFaqIndex === 0}
                    <div transition:slide={{ duration: 250, easing: cubicOut }} class="mt-3 pt-3 border-t border-[var(--border)] text-xs sm:text-sm text-[var(--text-2)] leading-relaxed">
                        Ya. Kami menyediakan kategori <strong>Tools Gratis (Rp 0)</strong> yang dapat Anda klaim dan gunakan secara instan tanpa biaya. Selain itu, admin dapat menerbitkan kode lisensi trial untuk pengujian software berbayar.
                    </div>
                {/if}
            </div>

            <div
                use:viewportReveal={{ delay: 210, type: 'scale' }}
                class="bg-[var(--surface-1)] border border-[var(--border)] {openFaqIndex === 1 ? 'border-blue-500/50 shadow-md' : ''} rounded-2xl p-5 transition-all duration-300"
            >
                <button
                    on:click={() => toggleFaq(1)}
                    class="w-full flex items-center justify-between font-bold text-sm sm:text-base text-[var(--text)] text-left cursor-pointer"
                >
                    <span>Bagaimana cara mengaktifkan lisensi di software desktop?</span>
                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 transition-transform duration-300 {openFaqIndex === 1 ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {#if openFaqIndex === 1}
                    <div transition:slide={{ duration: 250, easing: cubicOut }} class="mt-3 pt-3 border-t border-[var(--border)] text-xs sm:text-sm text-[var(--text-2)] leading-relaxed">
                        Setelah memesan atau mengklaim produk, Anda akan mendapatkan <strong>Serial Key</strong> di menu <strong>Lisensi Saya</strong>. Masukkan serial key tersebut ke dalam aplikasi desktop saat pertama kali dijalankan untuk mengaktifkan lisensi pada perangkat Anda. Jika Anda ingin berganti laptop/PC di kemudian hari, lisensi dapat langsung dipindahkan melalui dashboard.
                    </div>
                {/if}
            </div>

            <div
                use:viewportReveal={{ delay: 270, type: 'scale' }}
                class="bg-[var(--surface-1)] border border-[var(--border)] {openFaqIndex === 2 ? 'border-blue-500/50 shadow-md' : ''} rounded-2xl p-5 transition-all duration-300"
            >
                <button
                    on:click={() => toggleFaq(2)}
                    class="w-full flex items-center justify-between font-bold text-sm sm:text-base text-[var(--text)] text-left cursor-pointer"
                >
                    <span>Bagaimana cara memindahkan lisensi jika saya berganti PC atau Laptop?</span>
                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 transition-transform duration-300 {openFaqIndex === 2 ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {#if openFaqIndex === 2}
                    <div transition:slide={{ duration: 250, easing: cubicOut }} class="mt-3 pt-3 border-t border-[var(--border)] text-xs sm:text-sm text-[var(--text-2)] leading-relaxed space-y-2">
                        <p>Anda dapat memindahkan lisensi ke laptop atau komputer baru secara mandiri langsung dari Member Area tanpa perlu bantuan admin. Langkahnya:</p>
                        <ol class="list-decimal list-inside space-y-1.5 pl-1 text-[var(--text)] font-medium">
                            <li>Buka aplikasi di PC/Laptop baru Anda untuk melihat <strong>Machine ID</strong> baru.</li>
                            <li>Masuk ke <strong>Portal Member</strong>, lalu buka menu <strong>Lisensi Saya</strong>.</li>
                            <li>Klik tombol <strong>Ubah Machine ID</strong> pada kartu lisensi yang ingin dipindahkan.</li>
                            <li>Masukkan Machine ID baru tersebut dan klik simpan. Lisensi langsung berpindah dan aktif di perangkat baru seketika.</li>
                        </ol>
                    </div>
                {/if}
            </div>

            <div
                use:viewportReveal={{ delay: 330, type: 'scale' }}
                class="bg-[var(--surface-1)] border border-[var(--border)] {openFaqIndex === 3 ? 'border-blue-500/50 shadow-md' : ''} rounded-2xl p-5 transition-all duration-300"
            >
                <button
                    on:click={() => toggleFaq(3)}
                    class="w-full flex items-center justify-between font-bold text-sm sm:text-base text-[var(--text)] text-left cursor-pointer"
                >
                    <span>Bagaimana jika komputer saya rusak atau habis di-install ulang?</span>
                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 transition-transform duration-300 {openFaqIndex === 3 ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {#if openFaqIndex === 3}
                    <div transition:slide={{ duration: 250, easing: cubicOut }} class="mt-3 pt-3 border-t border-[var(--border)] text-xs sm:text-sm text-[var(--text-2)] leading-relaxed space-y-2">
                        <p>
                            Lisensi Anda aman di akun <strong>Portal Member</strong>. Anda cukup login kembali, buka menu <strong>Lisensi Saya</strong>, dan ambil kode lisensi Anda untuk diaktifkan kembali tanpa perlu membeli ulang.
                        </p>
                        <p class="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-[var(--text-2)]">
                            <strong class="text-blue-500 dark:text-blue-400 block mb-1">Catatan Keamanan & Privasi Data:</strong>
                            Seluruh data akun, settingan, dan file di dalam software bot <strong>tidak disimpan di server/cloud</strong> kami demi menjaga privasi dan keamanan Anda 100%. Oleh karena itu, lakukan pencadangan (backup) data software Anda secara berkala secara manual agar data penting tidak hilang saat komputer rusak atau di-install ulang.
                        </p>
                    </div>
                {/if}
            </div>

            <div
                use:viewportReveal={{ delay: 390, type: 'scale' }}
                class="bg-[var(--surface-1)] border border-[var(--border)] {openFaqIndex === 4 ? 'border-blue-500/50 shadow-md' : ''} rounded-2xl p-5 transition-all duration-300"
            >
                <button
                    on:click={() => toggleFaq(4)}
                    class="w-full flex items-center justify-between font-bold text-sm sm:text-base text-[var(--text)] text-left cursor-pointer"
                >
                    <span>Bagaimana mekanisme pencairan komisi Mitra Afiliasi?</span>
                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 transition-transform duration-300 {openFaqIndex === 4 ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {#if openFaqIndex === 4}
                    <div transition:slide={{ duration: 250, easing: cubicOut }} class="mt-3 pt-3 border-t border-[var(--border)] text-xs sm:text-sm text-[var(--text-2)] leading-relaxed">
                        Komisi akan dicairkan secara <strong>otomatis</strong> ke rekening bank yang sudah Anda atur di profil afiliasi. Proses pencairan dilakukan setiap <strong>akhir bulan hingga maksimal tanggal 2 di bulan berikutnya</strong> tanpa perlu mengajukan penarikan manual.
                    </div>
                {/if}
            </div>

            <div
                use:viewportReveal={{ delay: 450, type: 'scale' }}
                class="bg-[var(--surface-1)] border border-[var(--border)] {openFaqIndex === 5 ? 'border-blue-500/50 shadow-md' : ''} rounded-2xl p-5 transition-all duration-300"
            >
                <button
                    on:click={() => toggleFaq(5)}
                    class="w-full flex items-center justify-between font-bold text-sm sm:text-base text-[var(--text)] text-left cursor-pointer"
                >
                    <span>Metode pembayaran apa saja yang didukung?</span>
                    <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 transition-transform duration-300 {openFaqIndex === 5 ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {#if openFaqIndex === 5}
                    <div transition:slide={{ duration: 250, easing: cubicOut }} class="mt-3 pt-3 border-t border-[var(--border)] text-xs sm:text-sm text-[var(--text-2)] leading-relaxed">
                        Kami mendukung pembayaran instan 24/7 menggunakan QRIS (GoPay, OVO, DANA, ShopeePay, LinkAja) serta Virtual Account Bank resmi (BCA, Mandiri, BRI, BNI). Lisensi langsung aktif otomatis setelah pembayaran terverifikasi.
                    </div>
                {/if}
            </div>
        </div>
    </section>

    <!-- SECTION 7: FOOTER NAVIGATION & ECOSYSTEM IDENTITY -->
    <footer class="bg-[var(--surface)] border-t border-[var(--border)] pt-16 pb-12 transition-colors duration-300">
        <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div class="grid grid-cols-1 md:grid-cols-4 gap-10 mb-12">
                <div use:viewportReveal={{ delay: 100, y: 20 }} class="space-y-4 md:col-span-1">
                    <div class="flex items-center gap-3">
                        <div class="w-8 h-8 rounded-xl bg-blue-600 p-0.5 shadow-md shadow-blue-500/25">
                            <div class="w-full h-full bg-[var(--surface-1)] rounded-[10px] flex items-center justify-center p-1.5">
                                <img src="/favicon.svg" alt="Ziqva Labs Logo" class="w-full h-full object-contain filter drop-shadow-[0_0_8px_rgba(37,99,235,0.6)]" />
                            </div>
                        </div>
                        <span class="font-black text-lg text-[var(--text)]">Ziqva Labs</span>
                    </div>
                    <p class="text-xs text-[var(--text-2)] leading-relaxed">
                        Platform software otomatisasi dan bot desktop oleh Kampung Songo sejak 2022. Membantu produktivitas dropshipper, afiliator, YouTuber, dan AI enthusiast dengan privasi data lokal.
                    </p>

                    <!-- Clean Location Sub-text -->
                    <div class="flex items-start gap-2 text-xs text-[var(--text-3)] pt-1">
                        <svg class="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                        <span class="leading-relaxed">Perumahan Tirta Sani, Karangploso, Malang, Jawa Timur 65153</span>
                    </div>
                </div>

                <div use:viewportReveal={{ delay: 170, y: 20 }}>
                    <h4 class="font-extrabold text-xs text-[var(--text)] uppercase tracking-wider mb-4">Navigasi Utama</h4>
                    <ul class="space-y-2.5 text-xs text-[var(--text-2)]">
                        <li><button on:click={() => scrollToSection('hero')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Beranda</button></li>
                        <li><button on:click={() => scrollToSection('catalog')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Katalog Software</button></li>
                        <li><button on:click={() => scrollToSection('features')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Keunggulan System</button></li>
                        <li><button on:click={() => scrollToSection('terms-guarantee')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Ketentuan & Garansi</button></li>
                        <li><button on:click={() => scrollToSection('affiliate')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Mitra Afiliasi</button></li>
                        <li><button on:click={() => scrollToSection('about')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Tentang Ziqva Labs</button></li>
                    </ul>
                </div>

                <div use:viewportReveal={{ delay: 240, y: 20 }}>
                    <h4 class="font-extrabold text-xs text-[var(--text)] uppercase tracking-wider mb-4">Portal Akses</h4>
                    <ul class="space-y-2.5 text-xs text-[var(--text-2)]">
                        <li><button on:click={() => push('/member/login')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Login Member</button></li>
                        <li><button on:click={() => push('/member/register')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Daftar Akun Baru</button></li>
                    </ul>
                </div>

                <div use:viewportReveal={{ delay: 310, y: 20 }}>
                    <h4 class="font-extrabold text-xs text-[var(--text)] uppercase tracking-wider mb-4">Dukungan & Legal</h4>
                    <ul class="space-y-2.5 text-xs text-[var(--text-2)]">
                        <li><button on:click={() => push('/member/tutorials')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Pusat Video Tutorial</button></li>
                        <li><button on:click={() => push('/member/downloads')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block">Pusat Unduhan Installer</button></li>
                        <li><button on:click={() => push('/terms')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Syarat & Ketentuan Layanan</button></li>
                        <li><button on:click={() => push('/privacy')} class="hover:text-blue-600 dark:hover:text-blue-400 hover:translate-x-1 transition-all inline-block cursor-pointer">Kebijakan Privasi</button></li>
                    </ul>
                </div>
            </div>

            <div use:viewportReveal={{ delay: 380, type: 'fade' }} class="pt-8 border-t border-[var(--border)] flex flex-col md:flex-row items-center justify-between text-xs text-[var(--text-3)] gap-4">
                <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 text-center sm:text-left">
                    <span>© 2026 Ziqva Labs. Hak Cipta Dilindungi Undang-Undang.</span>
                    <span class="hidden sm:inline">•</span>
                    <span class="text-[11px]">Perumahan Tirta Sani, Karangploso, Malang, Jawa Timur 65153</span>
                </div>
                <div class="flex items-center gap-6">
                    <span>Semua hak dilindungi</span>
                </div>
            </div>
        </div>
    </footer>

    <!-- QUICK PRODUCT DETAIL MODAL (Elevated Liquid Glass & Rich Specs) -->
    {#if selectedProductDetail}
        {@const prod = selectedProductDetail}
        {@const osInfo = checkOSSupport(prod.installer_files)}
        {@const bundledItems = prod.is_bundle ? getIncludedProductItems(prod.bundle_items) : []}
        {@const matchedCat = categories.find(c => c.name.toLowerCase() === (prod.category_name || '').toLowerCase() || c.id === prod.category_id)}
        <div in:fade={{ duration: 200 }} class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" tabindex="-1" on:click|self={() => selectedProductDetail = null} on:keydown={(e) => e.key === 'Escape' && (selectedProductDetail = null)}>
            <div in:scale={{ start: 0.95, duration: 300, easing: backOut }} class="relative w-full max-w-lg h-[80vh] flex flex-col rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden">
                <!-- Modal Header (Sticky Top) -->
                <div class="p-4 sm:p-6 border-b border-[var(--border)] flex items-start justify-between bg-[var(--surface)] shrink-0 z-10">
                    <div class="flex items-center gap-3.5 min-w-0">
                        <div class="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl {prod.price === 0 ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : prod.is_bundle ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-500' : 'bg-[var(--surface-2)] border-blue-500/20 text-blue-500'} border p-2 flex items-center justify-center shrink-0 shadow-sm">
                            {#if prod.image}
                                <img src={prod.image} alt={prod.name} class="w-full h-full object-contain" />
                            {:else}
                                <span class="font-black text-xl">{prod.name.charAt(0)}</span>
                            {/if}
                        </div>
                        <div class="min-w-0 flex-1">
                            <div class="flex items-center gap-2 mb-1">
                                <h3 class="font-black text-lg sm:text-xl text-[var(--text)] truncate">{prod.name}</h3>
                                {#if prod.price === 0}
                                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/40 shrink-0">GRATIS</span>
                                {:else if prod.is_bundle}
                                    <span class="px-2 py-0.5 rounded-full text-[9px] font-black bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 border border-indigo-500/40 shrink-0">BUNDLE</span>
                                {/if}
                            </div>
                            <div class="flex items-center gap-2">
                                {#if prod.category_name}
                                    <span class="text-xs font-bold text-[var(--text-2)] flex items-center gap-1.5 bg-[var(--surface-2)] px-2.5 py-0.5 rounded-lg border border-[var(--border)] truncate">
                                        {#if matchedCat && matchedCat.icon}
                                            <img src={matchedCat.icon} alt="" class="w-3.5 h-3.5 rounded object-cover" />
                                        {:else}
                                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                                        {/if}
                                        <span>#{prod.category_name}</span>
                                    </span>
                                {/if}
                            </div>
                        </div>
                    </div>
                    <button on:click={() => selectedProductDetail = null} class="p-2 sm:p-2.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] hover:text-white hover:bg-rose-500 transition-all cursor-pointer shadow-xs shrink-0 ml-2">
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                </div>

                <!-- Modal Body (Scrollable) -->
                <div class="p-5 sm:p-6 overflow-y-auto space-y-4 text-xs sm:text-sm text-[var(--text-2)] flex-1">
                    <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] leading-relaxed space-y-2">
                        <div class="text-xs font-extrabold text-[var(--text)] flex items-center gap-1.5 mb-1">
                            <svg class="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            Deskripsi & Fitur Utama:
                        </div>
                        <p class="leading-relaxed text-[var(--text)] whitespace-pre-line">
                            {prod.description || 'Software bot desktop terintegrasi untuk memaksimalkan workflow operasional bisnis dan otomasi digital tanpa hambatan.'}
                        </p>
                    </div>
                    
                    <!-- Bundle Included Apps in Modal -->
                    {#if prod.is_bundle && bundledItems.length > 0}
                        <div class="p-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/30 space-y-2.5">
                            <div class="text-xs font-extrabold text-indigo-600 dark:text-indigo-400 flex items-center gap-2">
                                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                Termasuk {bundledItems.length} Software Siap Pakai:
                            </div>
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                {#each bundledItems as item}
                                    <div class="px-3 py-2 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center gap-2 shadow-2xs">
                                        <div class="w-5 h-5 rounded-lg bg-indigo-500/20 text-indigo-500 flex items-center justify-center font-bold text-[10px]">
                                            ✓
                                        </div>
                                        <span class="font-bold text-xs text-[var(--text)]">{item.name}</span>
                                    </div>
                                {/each}
                            </div>
                        </div>
                    {/if}

                    <!-- Specifications & OS Support Card -->
                    <div class="p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                        <div class="flex items-center justify-between text-xs font-extrabold text-[var(--text)]">
                            <div class="flex items-center gap-1.5">
                                <svg class="w-4 h-4 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                <span>Sistem Operasi & Lisensi:</span>
                            </div>
                            <span class="text-[10px] text-emerald-600 dark:text-emerald-400 font-extrabold flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
                                <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
                                Terverifikasi Aman
                            </span>
                        </div>
                        <div class="flex flex-wrap items-center gap-2 pt-1">
                            {#if osInfo.windows}
                                <span class="px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-xs font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1.5 shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-blue-500" fill="currentColor" viewBox="0 0 24 24"><path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/></svg>
                                    Windows 10 / 11 (64-bit)
                                </span>
                            {/if}
                            {#if osInfo.mac}
                                <span class="px-3 py-1.5 rounded-xl bg-slate-500/10 border border-slate-300 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 flex items-center gap-1.5 shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" fill="currentColor" viewBox="0 0 24 24"><path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.87.96-2.96-1 .04-2.16.67-2.85 1.48-.58.68-.97 1.76-.84 2.82 1.11.09 2.09-.56 2.73-1.34z"/></svg>
                                    macOS Apple Silicon & Intel
                                </span>
                            {/if}
                            {#if !osInfo.windows && !osInfo.mac}
                                <span class="px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-3)] flex items-center gap-1.5">
                                    <svg class="w-3.5 h-3.5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    Universal Desktop Bot
                                </span>
                            {/if}
                            {#if prod.has_tutorials || (prod.video_count && prod.video_count > 0)}
                                <span class="px-3 py-1.5 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs font-bold text-purple-600 dark:text-purple-400 flex items-center gap-1.5 shadow-2xs">
                                    <svg class="w-3.5 h-3.5 text-purple-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/></svg>
                                    {prod.video_count || 1} Video Panduan
                                </span>
                            {/if}
                        </div>
                        <div class="text-[11px] text-[var(--text-2)] flex items-center gap-1.5 pt-1">
                            <svg class="w-3.5 h-3.5 text-blue-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
                            <span>Lisensi fleksibel & dapat dipindahkan ke perangkat baru kapan saja melalui Portal Member.</span>
                        </div>
                    </div>
                </div>

                <!-- Modal Footer (Sticky Bottom) -->
                <div class="p-4 sm:p-5 border-t border-[var(--border)] flex items-center justify-between bg-[var(--surface)] shrink-0 z-10">
                    <div>
                        <div class="text-[10px] text-[var(--text-3)] uppercase font-extrabold tracking-wider">HARGA LISENSI</div>
                        <div>
                            {#if prod.price === 0}
                                <span class="text-lg sm:text-xl font-black text-emerald-600 dark:text-emerald-400">Gratis (Rp 0)</span>
                            {:else if prod.is_bundle}
                                <div class="flex items-baseline gap-1">
                                    <span class="text-lg sm:text-xl font-black text-[var(--text)]">{formatRupiah(prod.price)}</span>
                                    <span class="text-xs font-bold text-indigo-600 dark:text-indigo-400">/ paket</span>
                                </div>
                            {:else}
                                <div class="flex items-baseline gap-1">
                                    <span class="text-lg sm:text-xl font-black text-[var(--text)]">{formatRupiah(prod.price)}</span>
                                    <span class="text-xs font-bold text-blue-600 dark:text-blue-400">/ bulan</span>
                                </div>
                            {/if}
                        </div>
                    </div>
                    <button
                        on:click={() => {
                            selectedProductDetail = null;
                            push(isAuthenticated ? '/member/orders/create' : '/member/login');
                        }}
                        class="px-5 sm:px-7 py-3 sm:py-3.5 rounded-2xl font-extrabold text-xs sm:text-sm {prod.price === 0 ? 'bg-gradient-to-r from-emerald-600 to-teal-600 shadow-emerald-500/30' : prod.is_bundle ? 'bg-gradient-to-r from-indigo-600 to-purple-600 shadow-indigo-500/30' : 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-blue-500/30'} text-white shadow-lg hover:brightness-110 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer shrink-0"
                    >
                        {#if prod.price === 0}
                            Klaim Gratis →
                        {:else if prod.is_bundle}
                            Pesan Paket →
                        {:else}
                            Pesan Sekarang →
                        {/if}
                    </button>
                </div>
            </div>
        </div>
    {/if}
</div>
