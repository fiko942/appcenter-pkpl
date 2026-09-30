<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import AdminLayout from '../components/AdminLayout.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';
    import CustomCheckbox from '../components/CustomCheckbox.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';

    interface InstallerFileInfo {
        id: string;
        filename: string;
        url: string;
        size: string;
        bytes?: number;
        uploaded_at?: number;
        os?: 'windows' | 'mac';
    }

    interface InstallerFilesGroup {
        windows: InstallerFileInfo[];
        mac: InstallerFileInfo[];
    }

    interface TutorialItem {
        id?: string;
        title?: string;
        url: string;
        embedUrl?: string;
        videoId?: string;
        isPlaylist?: boolean;
        playlistId?: string;
    }

    interface ProductItem {
        id: number;
        product_id: number;
        name: string;
        price: number;
        category_id?: number | null;
        category_ids?: number[];
        category_name?: string | null;
        categories?: Array<{ id: number; name: string; slug: string; icon: string }>;
        is_discount: boolean;
        discount_percent: number;
        is_active: boolean;
        description: string;
        image: string;
        tutorials: string;
        installer_files?: string | InstallerFilesGroup | null;
        parsed_installer_files?: InstallerFilesGroup;
        is_bundle?: boolean;
        bundle_items?: string | number[] | null;
    }

    interface PaginationData {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    }

    interface ProductsData {
        products: ProductItem[];
        categories?: Array<{ id: number; name: string; slug: string; icon?: string }>;
        pagination?: PaginationData;
        stats: {
            total: number;
            active: number;
            inactive?: number;
            discount: number;
        };
    }

    let loading: boolean = true;
    let error: string = '';
    let successMessage: string = '';
    let productsData: ProductsData | null = null;
    let categoriesList: Array<{ id: number; name: string; slug?: string; icon?: string }> = [];
    
    // Server Query & Pagination State
    let searchInput: string = '';
    let selectedStatusFilter: 'all' | 'active' | 'inactive' | 'discount' = 'all';
    let selectedCategoryFilter: string = 'all';
    let sortBy: string = 'status-active';
    let page: number = 1;
    let pageSize: number = 10;
    let searchDebounceTimer: any;
    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    let copyFileUrlTimer: ReturnType<typeof setTimeout> | null = null;

    function showToast(msg: string, duration = 3000) {
        if (toastTimer) clearTimeout(toastTimer);
        successMessage = msg;
        toastTimer = setTimeout(() => {
            successMessage = '';
        }, duration);
    }

    function isValidImg(url: string | null | undefined): boolean {
        if (!url || typeof url !== 'string') return false;
        const trimmed = url.trim();
        if (!trimmed) return false;
        return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('/uploads/') || trimmed.startsWith('/assets/') || trimmed.startsWith('/favicon') || trimmed.startsWith('data:image/');
    }

    const sortOptions: OptionItem[] = [
        { value: 'status-active', label: 'Status: Aktif Dahulu' },
        { value: 'status-inactive', label: 'Status: Nonaktif Dahulu' },
        { value: 'newest', label: 'Terbaru Ditambahkan' },
        { value: 'name', label: 'Nama Produk (A - Z)' },
        { value: 'price-asc', label: 'Harga: Termurah' },
        { value: 'price-desc', label: 'Harga: Termahal' }
    ];

    const pageSizeOptions: OptionItem[] = [
        { value: 10, label: '10 / hal' },
        { value: 25, label: '25 / hal' },
        { value: 50, label: '50 / hal' },
        { value: 100, label: '100 / hal' }
    ];

    $: categoryFilterOptions = [
        { value: 'all', label: 'Semua Kategori' },
        ...categoriesList.map(c => ({
            value: String(c.id),
            label: c.name,
            icon: c.icon || undefined
        }))
    ];

    $: statusTabs = [
        { id: 'all', label: 'Semua', count: totalCount, color: 'brand' as const },
        { id: 'active', label: 'Aktif', count: activeCount, color: 'emerald' as const },
        { id: 'inactive', label: 'Nonaktif', count: inactiveCount, color: 'amber' as const },
        { id: 'discount', label: 'Promo Diskon', count: discountCount, color: 'rose' as const }
    ];

    // Modal state for Add/Edit Product
    let productModalOpen: boolean = false;
    let isEditing: boolean = false;
    let isSaving: boolean = false;
    let formProductId: number = 0;
    let formName: string = '';
    let formCategoryIds: number[] = [];
    let formPrice: number = 0;
    let formIsDiscount: boolean = false;
    let formDiscountPercent: number = 0;
    let formIsActive: boolean = true;
    let formIsBundle: boolean = false;
    let formBundleItems: number[] = [];
    let formDescription: string = '';
    let formImage: string = '';
    let formTutorials: TutorialItem[] = [];
    let isUploadingImage: boolean = false;
    let fileInputRef: HTMLInputElement;
    let imgErrorMap: Record<number, boolean> = {};

    // Modal state for Interactive Tutorial Player Modal
    let tutorialPlayerModalOpen: boolean = false;
    let playerProduct: ProductItem | null = null;
    let playerTutorials: TutorialItem[] = [];
    let selectedVideoIndex: number = 0;

    function toggleFormCategory(catId: number) {
        if (formCategoryIds.includes(catId)) {
            formCategoryIds = formCategoryIds.filter(id => id !== catId);
        } else {
            formCategoryIds = [...formCategoryIds, catId];
        }
    }

    // Modal state for Delete Product
    let deleteModalOpen: boolean = false;
    let deletingProduct: ProductItem | null = null;
    let isDeleting: boolean = false;

    // Modal state for Manage App Installer Files (Windows & Mac)
    let installerModalOpen: boolean = false;
    let activeInstallerProduct: ProductItem | null = null;
    let installerOsTab: 'windows' | 'mac' = 'windows';
    let installerFileInput: HTMLInputElement;
    let isUploadingInstaller: boolean = false;
    let uploadProgress: number = 0;
    let uploadStatusText: string = '';
    let uploadSpeedText: string = '';
    let uploadBytesText: string = '';
    let isDeletingInstallerFile: boolean = false;
    let deletingFileId: string = '';
    let copiedFileUrlId: string = '';

    function syncCategoryFromUrl(): boolean {
        const hash = window.location.hash || '';
        const qIndex = hash.indexOf('?');
        if (qIndex !== -1) {
            const qStr = hash.slice(qIndex + 1);
            const params = new URLSearchParams(qStr);
            const catParam = params.get('category_id') || params.get('category');
            if (catParam && selectedCategoryFilter !== catParam) {
                selectedCategoryFilter = catParam;
                return true;
            }
        }
        return false;
    }

    function handleHashChange() {
        if (syncCategoryFromUrl()) {
            page = 1;
            loadProducts();
        }
    }

    onMount(async () => {
        syncCategoryFromUrl();
        await loadProducts();
        window.addEventListener('hashchange', handleHashChange);
    });

    onDestroy(() => {
        clearTimeout(searchDebounceTimer);
        if (toastTimer) clearTimeout(toastTimer);
        if (copyFileUrlTimer) clearTimeout(copyFileUrlTimer);
        window.removeEventListener('hashchange', handleHashChange);
    });

    async function loadProducts() {
        loading = true;
        error = '';
        try {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('pageSize', String(pageSize));
            if (searchInput.trim()) params.set('search', searchInput.trim());
            if (selectedCategoryFilter !== 'all') params.set('category_id', String(selectedCategoryFilter));
            if (selectedStatusFilter !== 'all') params.set('status', selectedStatusFilter);
            if (sortBy) params.set('sort', sortBy);

            const res = await fetch(`/admin/api/products?${params.toString()}`, {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });

            if (res.status === 401 || res.status === 403) {
                window.location.href = '/#/admin/login';
                return;
            }

            const json = await res.json();
            if (res.ok && json.status === 'success' && json.data) {
                productsData = json.data;
                categoriesList = json.data.categories || [];
            } else {
                error = json.message || 'Gagal memuat katalog produk.';
            }
        } catch (err) {
            console.error('Fetch products error:', err);
            error = 'Terjadi kesalahan jaringan saat memuat katalog produk.';
        } finally {
            loading = false;
        }
    }

    function handleSearchInput() {
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            page = 1;
            loadProducts();
        }, 300);
    }

    function handleStatusFilter(status: 'all' | 'active' | 'inactive' | 'discount') {
        selectedStatusFilter = status;
        page = 1;
        loadProducts();
    }

    function handleCategoryChange(e: CustomEvent<string | number>) {
        selectedCategoryFilter = e.detail;
        page = 1;
        loadProducts();
    }

    function handleSortChange(e: CustomEvent<string | number>) {
        sortBy = String(e.detail);
        page = 1;
        loadProducts();
    }

    function handlePageSizeChange(e: CustomEvent<string | number>) {
        pageSize = Number(e.detail);
        page = 1;
        loadProducts();
    }

    function goToPage(targetPage: number) {
        const totalPages = productsData?.pagination?.totalPages || 1;
        if (targetPage >= 1 && targetPage <= totalPages && targetPage !== page) {
            page = targetPage;
            loadProducts();
        }
    }

    function parseYouTubeEmbedUrl(url: string): string {
        if (!url) return '';
        const clean = url.trim();
        const listMatch = clean.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
        if (clean.includes('/playlist') && listMatch) {
            return `https://www.youtube-nocookie.com/embed/videoseries?list=${listMatch[1]}`;
        }
        const shortsMatch = clean.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i);
        if (shortsMatch) {
            return `https://www.youtube-nocookie.com/embed/${shortsMatch[1]}`;
        }
        const youtuMatch = clean.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i);
        if (youtuMatch) {
            return `https://www.youtube-nocookie.com/embed/${youtuMatch[1]}${listMatch ? `?list=${listMatch[1]}` : ''}`;
        }
        const watchMatch = clean.match(/[?&]v=([a-zA-Z0-9_-]+)/i);
        if (watchMatch) {
            return `https://www.youtube-nocookie.com/embed/${watchMatch[1]}${listMatch ? `?list=${listMatch[1]}` : ''}`;
        }
        if (clean.includes('youtube.com/embed/')) {
            return clean.replace('youtube.com/embed/', 'youtube-nocookie.com/embed/');
        }
        return clean;
    }

    function getTutorialCount(tutorials: string | any[] | null | undefined): number {
        if (!tutorials) return 0;
        try {
            const list = typeof tutorials === 'string' ? JSON.parse(tutorials) : tutorials;
            return Array.isArray(list) ? list.filter(t => t && (t.url || t.title)).length : 0;
        } catch {
            return 0;
        }
    }

    function parseTutorials(tutorials: string | any[] | null | undefined): TutorialItem[] {
        if (!tutorials) return [];
        try {
            const list = typeof tutorials === 'string' ? JSON.parse(tutorials) : tutorials;
            return Array.isArray(list) ? list : [];
        } catch {
            return [];
        }
    }

    function addTutorialRow() {
        formTutorials = [
            ...formTutorials,
            { id: `tut_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`, title: '', url: '' }
        ];
    }

    function removeTutorialRow(index: number) {
        formTutorials = formTutorials.filter((_, i) => i !== index);
    }

    function openTutorialPlayer(prod: ProductItem) {
        playerProduct = prod;
        playerTutorials = parseTutorials(prod.tutorials);
        selectedVideoIndex = 0;
        tutorialPlayerModalOpen = true;
    }

    function closeTutorialPlayer() {
        tutorialPlayerModalOpen = false;
        playerProduct = null;
        playerTutorials = [];
        selectedVideoIndex = 0;
    }

    function openAddModal() {
        isEditing = false;
        formProductId = 0;
        formName = '';
        formCategoryIds = [];
        formPrice = 100000;
        formIsDiscount = false;
        formDiscountPercent = 0;
        formIsActive = true;
        formIsBundle = false;
        formBundleItems = [];
        formDescription = '';
        formImage = '';
        formTutorials = [{ id: `tut_${Date.now()}_1`, title: '', url: '' }];
        productModalOpen = true;
    }

    function openEditModal(prod: ProductItem) {
        isEditing = true;
        formProductId = prod.id;
        formName = prod.name;
        if (prod.category_ids && Array.isArray(prod.category_ids) && prod.category_ids.length > 0) {
            formCategoryIds = [...prod.category_ids];
        } else if (prod.category_id) {
            formCategoryIds = [prod.category_id];
        } else {
            formCategoryIds = [];
        }
        formPrice = prod.price;
        formIsDiscount = prod.is_discount;
        formDiscountPercent = prod.discount_percent || 0;
        formIsActive = prod.is_active;
        formIsBundle = Boolean(prod.is_bundle);
        try {
            const parsed = typeof prod.bundle_items === 'string' ? JSON.parse(prod.bundle_items) : (Array.isArray(prod.bundle_items) ? prod.bundle_items : []);
            formBundleItems = Array.isArray(parsed) ? parsed.map(Number).filter(n => !isNaN(n) && n > 0) : [];
        } catch {
            formBundleItems = [];
        }
        formDescription = prod.description || '';
        formImage = prod.image || '';
        const parsedTuts = parseTutorials(prod.tutorials);
        formTutorials = parsedTuts.length > 0
            ? parsedTuts.map((t, idx) => ({ id: t.id || `tut_${Date.now()}_${idx}`, title: t.title || '', url: t.url || '' }))
            : [{ id: `tut_${Date.now()}_1`, title: '', url: '' }];
        productModalOpen = true;
    }

    function closeProductModal() {
        productModalOpen = false;
    }

    async function handleFileUpload(e: Event) {
        const target = e.target as HTMLInputElement;
        if (!target.files || target.files.length === 0) return;
        const file = target.files[0];

        isUploadingImage = true;
        try {
            const formData = new FormData();
            formData.append('image', file);

            const uploadUrl = isEditing && formProductId > 0
                ? `/admin/api/products/${formProductId}/upload-image`
                : '/admin/api/products/upload-image';

            const res = await fetch(uploadUrl, {
                method: 'POST',
                credentials: 'include',
                body: formData
            });

            const json = await res.json();
            if (res.ok && json.status === 'success' && json.image_url) {
                formImage = json.image_url;
            } else {
                alert(json.message || 'Gagal mengunggah gambar produk.');
            }
        } catch (err) {
            console.error('Upload image error:', err);
            alert('Terjadi kesalahan saat mengunggah file.');
        } finally {
            isUploadingImage = false;
            if (fileInputRef) fileInputRef.value = '';
        }
    }

    async function handleSaveProduct(e: Event) {
        e.preventDefault();
        if (!formName.trim() || formPrice < 0) {
            alert('Harap isi nama produk dan harga yang valid.');
            return;
        }

        isSaving = true;

        const cleanTutorials = formTutorials
            .filter(t => (t.title && t.title.trim()) || (t.url && t.url.trim()))
            .map((t, idx) => ({
                id: t.id || `tut_${Date.now()}_${idx + 1}`,
                title: t.title?.trim() || `Tutorial ${idx + 1}`,
                url: t.url?.trim() || ''
            }));

        try {
            const url = isEditing ? `/admin/api/products/edit/${formProductId}` : '/admin/api/products/create';
            const res = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    name: formName.trim(),
                    category_ids: formCategoryIds,
                    category_id: formCategoryIds[0] || null,
                    price: formPrice,
                    is_discount: formIsDiscount,
                    discount_percent: formIsDiscount ? formDiscountPercent : 0,
                    is_active: formIsActive,
                    is_bundle: formIsBundle,
                    bundle_items: formBundleItems,
                    description: formDescription.trim(),
                    image: formImage.trim(),
                    tutorials: JSON.stringify(cleanTutorials)
                })
            });

            const json = await res.json();
            if (res.ok && (json.status === 'success' || json.success)) {
                closeProductModal();
                await loadProducts();
                showToast(isEditing ? 'Produk berhasil diperbarui.' : 'Produk baru berhasil ditambahkan.', 3500);
            } else {
                alert(json.message || json.error || 'Gagal menyimpan produk.');
            }
        } catch (err) {
            console.error('Save product error:', err);
            alert('Terjadi kesalahan jaringan.');
        } finally {
            isSaving = false;
        }
    }

    async function toggleStatus(prod: ProductItem) {
        try {
            const res = await fetch(`/admin/api/products/toggle-status/${prod.id}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const json = await res.json();
            if (res.ok && json.success) {
                prod.is_active = json.is_active;
                await loadProducts();
            } else {
                alert(json.message || json.error || 'Gagal mengubah status produk');
            }
        } catch (err) {
            console.error('Toggle status error:', err);
        }
    }

    function openDeleteModal(prod: ProductItem) {
        deletingProduct = prod;
        deleteModalOpen = true;
    }

    function closeDeleteModal() {
        deleteModalOpen = false;
        deletingProduct = null;
    }

    async function executeDeleteProduct() {
        if (!deletingProduct) return;
        isDeleting = true;
        try {
            const res = await fetch(`/admin/api/products/delete/${deletingProduct.id}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const json = await res.json();
            if (res.ok && (json.status === 'success' || json.success)) {
                closeDeleteModal();
                await loadProducts();
                showToast(`Produk ${deletingProduct.name} berhasil dihapus.`, 3500);
            } else {
                alert(json.message || json.error || 'Gagal menghapus produk');
            }
        } catch (err) {
            console.error('Delete product error:', err);
            alert('Terjadi kesalahan jaringan.');
        } finally {
            isDeleting = false;
        }
    }

    function formatCurrency(amount: number): string {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount || 0);
    }

    function formatBytesClient(bytes: number): string {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    function getNormalizedInstallers(p: ProductItem | null): InstallerFilesGroup {
        if (!p) return { windows: [], mac: [] };
        if (p.parsed_installer_files) {
            return {
                windows: Array.isArray(p.parsed_installer_files.windows) ? p.parsed_installer_files.windows : [],
                mac: Array.isArray(p.parsed_installer_files.mac) ? p.parsed_installer_files.mac : []
            };
        }
        if (p.installer_files) {
            try {
                const raw = typeof p.installer_files === 'string' ? JSON.parse(p.installer_files) : p.installer_files;
                const win = Array.isArray(raw?.windows) ? raw.windows : (raw?.windows?.filename ? [raw.windows] : []);
                const mc = Array.isArray(raw?.mac) ? raw.mac : (raw?.mac?.filename ? [raw.mac] : []);
                return { windows: win, mac: mc };
            } catch {
                return { windows: [], mac: [] };
            }
        }
        return { windows: [], mac: [] };
    }

    function openInstallerModal(prod: ProductItem) {
        activeInstallerProduct = prod;
        installerOsTab = 'windows';
        isUploadingInstaller = false;
        uploadProgress = 0;
        uploadStatusText = '';
        uploadSpeedText = '';
        uploadBytesText = '';
        installerModalOpen = true;
    }

    function closeInstallerModal() {
        installerModalOpen = false;
        activeInstallerProduct = null;
    }

    async function handleUploadInstallerFile(e: Event) {
        const target = e.target as HTMLInputElement;
        if (!target.files || target.files.length === 0 || !activeInstallerProduct) return;
        const file = target.files[0];
        const targetProdId = activeInstallerProduct.id;
        const osType = installerOsTab;

        isUploadingInstaller = true;
        uploadProgress = 0;
        uploadStatusText = 'Mempersiapkan pengunggahan file...';
        uploadBytesText = `0 B / ${formatBytesClient(file.size)}`;
        uploadSpeedText = 'Memulai...';

        const fileSize = file.size;
        const chunkSize = 5 * 1024 * 1024; // 5MB chunk size
        const totalChunks = Math.ceil(fileSize / chunkSize);
        const uploadId = `up_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
        const startTime = Date.now();

        try {
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const start = chunkIndex * chunkSize;
                const end = Math.min(fileSize, start + chunkSize);
                const chunkBlob = file.slice(start, end);

                const formData = new FormData();
                formData.append('os', osType);
                formData.append('filename', file.name);
                formData.append('upload_id', uploadId);
                formData.append('chunk_index', String(chunkIndex));
                formData.append('total_chunks', String(totalChunks));
                formData.append('file', chunkBlob, file.name);

                const res = await fetch(`/admin/api/products/${targetProdId}/upload-chunk`, {
                    method: 'POST',
                    credentials: 'include',
                    body: formData
                });

                const json = await res.json();
                if (!res.ok || json.error) {
                    throw new Error(json.error || `Gagal mengunggah chunk ${chunkIndex + 1}/${totalChunks}`);
                }

                const uploadedBytes = end;
                const elapsedSec = Math.max(0.1, (Date.now() - startTime) / 1000);
                const speedBytesPerSec = uploadedBytes / elapsedSec;
                const pct = Math.round((uploadedBytes / fileSize) * 100);

                uploadProgress = pct;
                uploadBytesText = `${formatBytesClient(uploadedBytes)} / ${formatBytesClient(fileSize)}`;
                uploadSpeedText = `${formatBytesClient(speedBytesPerSec)}/s`;
                uploadStatusText = chunkIndex === totalChunks - 1
                    ? 'Menyinkronkan file ke Server CDN Ziqva...'
                    : `Mengunggah bagian ${chunkIndex + 1} dari ${totalChunks} (${pct}%)...`;

                if (json.is_complete && json.installer_files) {
                    if (activeInstallerProduct && activeInstallerProduct.id === targetProdId) {
                        activeInstallerProduct.parsed_installer_files = json.installer_files;
                        activeInstallerProduct.installer_files = json.installer_files;
                    }
                    if (productsData) {
                        const pIdx = productsData.products.findIndex(p => p.id === targetProdId);
                        if (pIdx >= 0) {
                            productsData.products[pIdx].parsed_installer_files = json.installer_files;
                            productsData.products[pIdx].installer_files = json.installer_files;
                        }
                    }
                    showToast(`File ${file.name} (${osType === 'windows' ? 'Windows' : 'macOS'}) berhasil diupload!`, 3500);
                }
            }
        } catch (err: any) {
            console.error('Upload installer error:', err);
            alert(err.message || 'Terjadi kesalahan saat mengunggah file installer.');
        } finally {
            isUploadingInstaller = false;
            uploadProgress = 0;
            uploadStatusText = '';
            if (installerFileInput) installerFileInput.value = '';
            if (target) target.value = '';
        }
    }

    async function handleDeleteInstallerFile(fileId: string, filename: string, osType: 'windows' | 'mac') {
        if (!activeInstallerProduct) return;
        if (!confirm(`Hapus file installer "${filename}" dari server CDN?`)) return;

        isDeletingInstallerFile = true;
        deletingFileId = fileId;
        const targetProdId = activeInstallerProduct.id;

        try {
            const res = await fetch(`/admin/api/products/${targetProdId}/delete-installer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({
                    os: osType,
                    file_id: fileId,
                    filename: filename
                })
            });

            const json = await res.json();
            if (res.ok && (json.success || json.status === 'success')) {
                const newFiles = json.installer_files || { windows: [], mac: [] };
                if (activeInstallerProduct && activeInstallerProduct.id === targetProdId) {
                    activeInstallerProduct.parsed_installer_files = newFiles;
                    activeInstallerProduct.installer_files = newFiles;
                }
                if (productsData) {
                    const pIdx = productsData.products.findIndex(p => p.id === targetProdId);
                    if (pIdx >= 0) {
                        productsData.products[pIdx].parsed_installer_files = newFiles;
                        productsData.products[pIdx].installer_files = newFiles;
                    }
                }
                showToast(`File installer ${filename} berhasil dihapus.`, 3500);
            } else {
                alert(json.error || json.message || 'Gagal menghapus file installer.');
            }
        } catch (err) {
            console.error('Delete installer error:', err);
            alert('Terjadi kesalahan jaringan saat menghapus file installer.');
        } finally {
            isDeletingInstallerFile = false;
            deletingFileId = '';
        }
    }

    function copyDownloadUrl(fileId: string, url: string) {
        if (!url) return;
        navigator.clipboard.writeText(url);
        copiedFileUrlId = fileId;
        if (copyFileUrlTimer) clearTimeout(copyFileUrlTimer);
        copyFileUrlTimer = setTimeout(() => {
            if (copiedFileUrlId === fileId) copiedFileUrlId = '';
        }, 2000);
    }

    $: totalCount = productsData?.stats?.total || 0;
    $: activeCount = productsData?.stats?.active || 0;
    $: inactiveCount = productsData?.stats?.inactive !== undefined ? productsData.stats.inactive : Math.max(0, totalCount - activeCount);
    $: discountCount = productsData?.stats?.discount || 0;
    $: currentProducts = productsData?.products || [];
    $: pagination = productsData?.pagination || { page: 1, pageSize: 10, total: 0, totalPages: 1 };
</script>

<svelte:head>
    <title>Katalog Produk - Admin Appcenter</title>
</svelte:head>

<AdminLayout activePage="products" eyebrow="PANEL ADMIN ZIQVA">
    <main class="flex-1 p-4 md:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
        <!-- Toast Notification -->
        {#if successMessage}
            <div class="fixed top-20 right-6 z-50 flex items-center gap-2 px-4 py-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl shadow-xl backdrop-blur-md animate-fade-in text-xs sm:text-sm font-semibold">
                <svg class="w-5 h-5 text-emerald-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
                <span>{successMessage}</span>
            </div>
        {/if}

        {#if error}
            <div class="p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs sm:text-sm flex items-center justify-between">
                <span>{error}</span>
                <button type="button" on:click={loadProducts} class="underline text-xs font-bold bg-transparent border-0 text-red-400 cursor-pointer">Coba Lagi</button>
            </div>
        {/if}

        <!-- Page Header -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-start justify-between gap-3">
                <div>
                    <div class="flex items-center gap-2 mb-1">
                        <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-2)] uppercase tracking-wider">
                            Katalog Software
                        </span>
                        <span class="text-xs text-[var(--text-3)] font-medium hidden xs:inline">Manajemen Lisensi & Produk</span>
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2.5">
                        <span class="whitespace-nowrap">Katalog Produk</span>
                        {#if !loading}
                            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)] whitespace-nowrap">
                                {totalCount} Produk
                            </span>
                        {/if}
                    </h1>
                    <p class="text-xs sm:text-sm text-[var(--text-3)] mt-1 max-w-xl">
                        Kelola software aplikasi, lisensi, penyesuaian harga, diskon promo, dan status tayang.
                    </p>
                </div>

                <!-- Mobile Add Button (Top Right Aligned on mobile) -->
                <div class="sm:hidden flex-shrink-0 pt-1">
                    <button
                        type="button"
                        on:click={openAddModal}
                        class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer border-0"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Produk</span>
                    </button>
                </div>
            </div>

            <!-- Desktop Add Button -->
            <div class="hidden sm:flex items-center gap-2 flex-shrink-0">
                <button
                    type="button"
                    on:click={openAddModal}
                    class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer border-0"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Tambah Produk Baru</span>
                </button>
            </div>
        </div>

        <!-- Single Unified Surface Table Card -->
        <div class="rounded-3xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs">
            <!-- Top Segmented Status Tabs with Framer-motion Pill Animation (Desktop & Mobile Swipeable) -->
            <div class="p-3 sm:p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/30 overflow-x-auto no-scrollbar">
                <SegmentedTabs
                    tabs={statusTabs}
                    bind:activeTab={selectedStatusFilter}
                    on:change={(e) => handleStatusFilter(e.detail)}
                />
            </div>

            <!-- Unified Toolbar: Search + Category + Sort -->
            <div class="p-3 sm:p-4 border-b border-[var(--border)] flex flex-col md:flex-row items-center gap-3">
                <!-- Live Search Box with Server Query -->
                <div class="relative w-full md:flex-1">
                    <svg class="w-4 h-4 text-[var(--text-3)] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        bind:value={searchInput}
                        on:input={handleSearchInput}
                        placeholder="Cari software berdasarkan nama, deskripsi, atau ID..."
                        class="w-full pl-9 pr-8 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                    />
                    {#if searchInput}
                        <button
                            type="button"
                            on:click={() => { searchInput = ''; page = 1; loadProducts(); }}
                            class="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer p-1"
                        >
                            &times;
                        </button>
                    {/if}
                </div>

                <!-- Filters for Category & Sort (Grid 2-cols on mobile, Flex inline on desktop) -->
                <div class="grid grid-cols-2 md:flex md:items-center gap-2.5 w-full md:w-auto">
                    <!-- Filter by Category -->
                    <div class="w-full md:w-52">
                        <CustomSelect
                            options={categoryFilterOptions}
                            bind:value={selectedCategoryFilter}
                            on:change={handleCategoryChange}
                            fullWidth={true}
                        />
                    </div>

                    <!-- Sort Selector -->
                    <div class="w-full md:w-56">
                        <CustomSelect
                            options={sortOptions}
                            bind:value={sortBy}
                            on:change={handleSortChange}
                            fullWidth={true}
                        />
                    </div>
                </div>
            </div>

            <!-- High-Density Paginated Products Content -->
            {#if loading}
                <div class="py-16 text-center">
                    <div class="w-7 h-7 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
                    <p class="text-xs text-[var(--text-3)] font-medium">Memuat katalog software...</p>
                </div>
            {:else if currentProducts.length === 0}
                <div class="py-16 text-center">
                    <svg class="w-12 h-12 text-[var(--text-3)] mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                    <p class="text-xs font-bold text-[var(--text)]">Tidak ada produk yang cocok</p>
                    <p class="text-[11px] text-[var(--text-3)] mt-0.5">Coba sesuaikan kata kunci pencarian atau reset filter di atas.</p>
                </div>
            {:else}
                <!-- Mobile Card / Item Layout (md:hidden - No Table) -->
                <div class="md:hidden divide-y divide-[var(--border)]">
                    {#each currentProducts as prod (prod.id)}
                        {@const finalPrice = prod.is_discount && prod.discount_percent > 0 ? prod.price - (prod.price * prod.discount_percent / 100) : prod.price}
                        {@const installers = getNormalizedInstallers(prod)}
                        {@const winCount = installers.windows.length}
                        {@const macCount = installers.mac.length}
                        {@const tutCount = getTutorialCount(prod.tutorials)}
                        <div class="p-4 space-y-3 hover:bg-[var(--surface-2)]/40 transition-colors">
                            <!-- Top Row: Icon + Name + SKU/ID + Status Toggle -->
                            <div class="flex items-start justify-between gap-3">
                                <div class="flex items-start gap-3 min-w-0">
                                    {#if isValidImg(prod.image) && !imgErrorMap[prod.id]}
                                        <img
                                            src={prod.image}
                                            alt={prod.name}
                                            class="w-10 h-10 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0 shadow-xs mt-0.5"
                                            on:error={() => imgErrorMap[prod.id] = true}
                                        />
                                    {:else}
                                        <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-[var(--brand)] font-black text-sm flex-shrink-0 shadow-xs mt-0.5">
                                            {(prod.name || 'P').charAt(0).toUpperCase()}
                                        </div>
                                    {/if}
                                    <div class="min-w-0">
                                        <div class="flex items-center gap-1.5 flex-wrap">
                                            <span class="font-bold text-[var(--text)] text-sm leading-tight">
                                                {prod.name}
                                            </span>
                                            {#if prod.is_bundle}
                                                <span class="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 whitespace-nowrap">
                                                    📦 BUNDEL
                                                </span>
                                            {/if}
                                        </div>
                                        <div class="flex items-center gap-2 text-[10px] text-[var(--text-3)] font-mono mt-0.5">
                                            <span>ID: #{prod.id}</span>
                                            <span>&bull;</span>
                                            <span>SKU: {prod.product_id}</span>
                                        </div>
                                    </div>
                                </div>

                                <!-- Active / Inactive Status Toggle -->
                                <div class="flex-shrink-0">
                                    {#if prod.is_active}
                                        <button
                                            type="button"
                                            on:click={() => toggleStatus(prod)}
                                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 active:scale-95 shadow-2xs"
                                            title="Klik untuk ubah status nonaktif"
                                        >
                                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                            <span>Aktif</span>
                                        </button>
                                    {:else}
                                        <button
                                            type="button"
                                            on:click={() => toggleStatus(prod)}
                                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap bg-rose-500/15 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 active:scale-95 shadow-2xs"
                                            title="Klik untuk ubah status aktif"
                                        >
                                            <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                            <span>Nonaktif</span>
                                        </button>
                                    {/if}
                                </div>
                            </div>

                            <!-- Description (if exists) -->
                            {#if prod.description}
                                <p class="text-[11px] text-[var(--text-3)] line-clamp-2 leading-relaxed">
                                    {prod.description}
                                </p>
                            {/if}

                            <!-- Categories & Pricing Row -->
                            <div class="flex items-center justify-between gap-2 flex-wrap pt-0.5">
                                <!-- Categories -->
                                <div class="flex flex-wrap items-center gap-1.5">
                                    {#if prod.categories && prod.categories.length > 0}
                                        {#each prod.categories as catObj}
                                            <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/15 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 whitespace-nowrap shadow-2xs">
                                                {#if catObj.icon}
                                                    <img src="{catObj.icon}" alt="{catObj.name}" class="w-3 h-3 rounded object-cover flex-shrink-0" />
                                                {:else}
                                                    <svg class="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                    </svg>
                                                {/if}
                                                <span>{catObj.name}</span>
                                            </span>
                                        {/each}
                                    {:else if prod.category_name}
                                        {@const catObj = categoriesList.find(c => c.id === prod.category_id || c.name === prod.category_name)}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-purple-500/15 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 whitespace-nowrap shadow-2xs">
                                            {#if catObj && catObj.icon}
                                                <img src="{catObj.icon}" alt="{prod.category_name}" class="w-3 h-3 rounded object-cover flex-shrink-0" />
                                            {:else}
                                                <svg class="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                </svg>
                                            {/if}
                                            <span>{prod.category_name}</span>
                                        </span>
                                    {:else}
                                        <span class="text-[11px] text-[var(--text-3)] italic">Tanpa Kategori</span>
                                    {/if}
                                </div>

                                <!-- Price -->
                                <div class="text-right">
                                    {#if prod.price === 0 || finalPrice === 0}
                                        <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30">
                                            GRATIS (Rp 0)
                                        </span>
                                    {:else}
                                        <div class="font-bold text-[var(--text)] text-sm">
                                            {formatCurrency(finalPrice)}
                                        </div>
                                        {#if prod.is_discount && prod.discount_percent > 0}
                                            <div class="flex items-center justify-end gap-1">
                                                <span class="text-[10px] text-[var(--text-3)] line-through">
                                                    {formatCurrency(prod.price)}
                                                </span>
                                                <span class="inline-flex items-center px-1 py-0.2 rounded text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                                    -{prod.discount_percent}%
                                                </span>
                                            </div>
                                        {/if}
                                    {/if}
                                </div>
                            </div>

                            <!-- Interactive Setup / Tutorial Buttons & Action Buttons -->
                            <div class="pt-2 border-t border-[var(--border)] flex items-center justify-between gap-2 flex-wrap">
                                <!-- Setup and Tutorial Badges -->
                                <div class="flex items-center gap-2">
                                    <!-- Tutorial Button -->
                                    {#if tutCount > 0}
                                        <button
                                            type="button"
                                            on:click={() => openTutorialPlayer(prod)}
                                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 active:bg-purple-500/20 text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                                            title="Lihat & Putar Tutorial YouTube ({tutCount} Video)"
                                        >
                                            <svg class="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" fill="currentColor" viewBox="0 0 24 24">
                                                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                            </svg>
                                            <span>{tutCount} Video</span>
                                        </button>
                                    {:else}
                                        <button
                                            type="button"
                                            on:click={() => openEditModal(prod)}
                                            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface-2)] border border-dashed border-[var(--border)] text-[var(--text-3)] hover:text-purple-500 text-[10px] font-medium transition-all cursor-pointer"
                                            title="Tambah link tutorial YouTube"
                                        >
                                            <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                                            </svg>
                                            <span>Tutorial</span>
                                        </button>
                                    {/if}

                                    <!-- Setup / Installer Files Button -->
                                    {#if winCount > 0 || macCount > 0}
                                        <button
                                            type="button"
                                            on:click={() => openInstallerModal(prod)}
                                            class="inline-flex items-center gap-1.5 p-1 px-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] transition-all cursor-pointer shadow-2xs select-none"
                                            title="Kelola File Installer App (Windows & Mac)"
                                        >
                                            {#if winCount > 0}
                                                <div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                                    <svg class="w-2.5 h-2.5" viewBox="0 0 88 88" fill="currentColor">
                                                        <path d="M0 12.402l35.687-4.86.016 34.423-35.67.243L0 12.402zm35.67 33.528l.028 34.453L.028 75.48.016 46.16l35.654-.23zm4.33-39.117L87.914 0v41.526l-47.914.36V6.813zm47.914 39.51v41.65l-47.914-6.734V45.972l47.914.35z"/>
                                                    </svg>
                                                    <span>{winCount}</span>
                                                </div>
                                            {/if}

                                            {#if macCount > 0}
                                                <div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-500/10 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                                                    <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.87.96-2.96-1 .04-2.16.67-2.85 1.48-.58.68-.97 1.76-.84 2.82 1.11.09 2.09-.56 2.73-1.34z"/>
                                                    </svg>
                                                    <span>{macCount}</span>
                                                </div>
                                            {/if}
                                            <svg class="w-3 h-3 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                        </button>
                                    {:else}
                                        <button
                                            type="button"
                                            on:click={() => openInstallerModal(prod)}
                                            class="inline-flex items-center gap-1.5 px-2 py-1 rounded-xl bg-[var(--surface-2)] border border-dashed border-[var(--border)] text-[var(--text-3)] hover:text-[var(--brand)] text-[10px] font-bold transition-all cursor-pointer shadow-2xs select-none"
                                            title="Upload setup installer"
                                        >
                                            <svg class="w-3 h-3 text-[var(--text-3)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" />
                                            </svg>
                                            <span>Setup</span>
                                        </button>
                                    {/if}
                                </div>

                                <!-- Edit and Delete Action Buttons -->
                                <div class="flex items-center gap-1.5 ml-auto">
                                    <button
                                        type="button"
                                        title="Edit Informasi Produk"
                                        on:click={() => openEditModal(prod)}
                                        class="px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--brand)] hover:text-white inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer font-semibold text-xs"
                                    >
                                        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                        <span>Edit</span>
                                    </button>
                                    <button
                                        type="button"
                                        title="Hapus Produk"
                                        on:click={() => openDeleteModal(prod)}
                                        class="p-1.5 px-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-600 hover:text-white inline-flex items-center gap-1 transition-all shadow-2xs cursor-pointer font-semibold text-xs"
                                    >
                                        <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>

                <!-- Desktop Table View (hidden md:block) -->
                <div class="hidden md:block overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-[var(--surface-2)] text-[var(--text-3)] uppercase tracking-wider font-bold border-b border-[var(--border)] select-none">
                                <th class="py-3.5 px-4 whitespace-nowrap">Software</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Kategori</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Harga</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">Tutorial</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">File Setup</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">Status</th>
                                <th class="py-3.5 px-4 text-right whitespace-nowrap">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)]">
                            {#each currentProducts as prod (prod.id)}
                                {@const finalPrice = prod.is_discount && prod.discount_percent > 0 ? prod.price - (prod.price * prod.discount_percent / 100) : prod.price}
                                {@const installers = getNormalizedInstallers(prod)}
                                {@const winCount = installers.windows.length}
                                {@const macCount = installers.mac.length}
                                {@const tutCount = getTutorialCount(prod.tutorials)}
                                <tr class="hover:bg-[var(--surface-2)]/60 transition-colors">
                                    <!-- Product Info with 36px Icon -->
                                    <td class="py-3.5 px-4">
                                        <div class="flex items-center gap-3">
                                            {#if isValidImg(prod.image) && !imgErrorMap[prod.id]}
                                                <img
                                                    src={prod.image}
                                                    alt={prod.name}
                                                    class="w-9 h-9 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0 shadow-xs"
                                                    on:error={() => imgErrorMap[prod.id] = true}
                                                />
                                            {:else}
                                                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-[var(--brand)] font-black text-xs flex-shrink-0 shadow-xs">
                                                    {(prod.name || 'P').charAt(0).toUpperCase()}
                                                </div>
                                            {/if}
                                            <div class="min-w-0">
                                                <div class="flex items-center gap-1.5 flex-wrap">
                                                    <span class="font-bold text-[var(--text)] text-sm truncate max-w-xs" title={prod.name}>
                                                        {prod.name}
                                                    </span>
                                                    {#if prod.is_bundle}
                                                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-500/30 whitespace-nowrap shadow-2xs">
                                                            📦 BUNDEL
                                                        </span>
                                                    {/if}
                                                </div>
                                                <div class="flex items-center gap-2 text-[10px] text-[var(--text-3)] mt-0.5">
                                                    <span class="font-mono">ID: #{prod.id}</span>
                                                    <span>&bull;</span>
                                                    <span class="font-mono">SKU: {prod.product_id}</span>
                                                </div>
                                                {#if prod.description}
                                                    <p class="text-[11px] text-[var(--text-3)] mt-0.5 line-clamp-1 max-w-sm" title={prod.description}>
                                                        {prod.description}
                                                    </p>
                                                {/if}
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Category Column with Multi-Category Support -->
                                    <td class="py-3.5 px-4">
                                        {#if prod.categories && prod.categories.length > 0}
                                            <div class="flex flex-wrap items-center gap-1.5 max-w-xs">
                                                {#each prod.categories as catObj}
                                                    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-extrabold bg-purple-500/15 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 whitespace-nowrap shadow-2xs">
                                                        {#if catObj.icon}
                                                            <img src="{catObj.icon}" alt="{catObj.name}" class="w-3 h-3 rounded object-cover flex-shrink-0" />
                                                        {:else}
                                                            <svg class="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                            </svg>
                                                        {/if}
                                                        <span>{catObj.name}</span>
                                                    </span>
                                                {/each}
                                            </div>
                                        {:else if prod.category_name}
                                            {@const catObj = categoriesList.find(c => c.id === prod.category_id || c.name === prod.category_name)}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold bg-purple-500/15 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 whitespace-nowrap shadow-2xs">
                                                {#if catObj && catObj.icon}
                                                    <img src="{catObj.icon}" alt="{prod.category_name}" class="w-3.5 h-3.5 rounded object-cover flex-shrink-0" />
                                                {:else}
                                                    <svg class="w-3 h-3 text-purple-600 dark:text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                                                    </svg>
                                                {/if}
                                                <span>{prod.category_name}</span>
                                            </span>
                                        {:else}
                                            <span class="text-xs text-[var(--text-3)] italic">Tanpa Kategori</span>
                                        {/if}
                                    </td>

                                    <!-- Merged Smart Pricing Cell -->
                                    <td class="py-3.5 px-4">
                                        <div class="space-y-0.5">
                                            {#if prod.price === 0 || finalPrice === 0}
                                                <div class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-black bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 whitespace-nowrap shadow-2xs">
                                                    <svg class="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                                                    </svg>
                                                    GRATIS (Rp 0)
                                                </div>
                                            {:else}
                                                <div class="font-bold text-[var(--text)] text-sm whitespace-nowrap">
                                                    {formatCurrency(finalPrice)}
                                                </div>
                                                {#if prod.is_discount && prod.discount_percent > 0}
                                                    <div class="flex items-center gap-1.5">
                                                        <span class="text-[10px] text-[var(--text-3)] line-through whitespace-nowrap">
                                                            {formatCurrency(prod.price)}
                                                        </span>
                                                        <span class="inline-flex items-center px-1.5 py-0.2 rounded-md text-[9px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 whitespace-nowrap">
                                                            -{prod.discount_percent}%
                                                        </span>
                                                    </div>
                                                {/if}
                                            {/if}
                                        </div>
                                    </td>

                                    <!-- Tutorial Videos Column -->
                                    <td class="py-3.5 px-4 text-center">
                                        {#if tutCount > 0}
                                            <button
                                                type="button"
                                                on:click={() => openTutorialPlayer(prod)}
                                                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 hover:border-purple-500/40 text-[10px] font-bold transition-all cursor-pointer shadow-2xs group"
                                                title="Lihat & Putar Tutorial Video YouTube ({tutCount} Video)"
                                            >
                                                <svg class="w-3.5 h-3.5 text-purple-500 dark:text-purple-400 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 24 24">
                                                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                                </svg>
                                                <span>{tutCount} Video</span>
                                            </button>
                                        {:else}
                                            <button
                                                type="button"
                                                on:click={() => openEditModal(prod)}
                                                class="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-dashed border-[var(--border)] hover:border-purple-500/50 text-[var(--text-3)] hover:text-purple-500 dark:hover:text-purple-400 text-[10px] font-medium transition-all cursor-pointer"
                                                title="Tambah link tutorial YouTube"
                                            >
                                                <svg class="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                                                </svg>
                                                <span>Tutorial</span>
                                            </button>
                                        {/if}
                                    </td>

                                    <!-- File Setup / Installer Management Column -->
                                    <td class="py-3.5 px-4 text-center">
                                        {#if winCount > 0 || macCount > 0}
                                            <button
                                                type="button"
                                                on:click={() => openInstallerModal(prod)}
                                                class="inline-flex items-center gap-1.5 p-1 px-2 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-[var(--border)] hover:border-[var(--brand)]/50 transition-all cursor-pointer group shadow-2xs select-none"
                                                title="Kelola File Installer App (Windows & Mac)"
                                            >
                                                <!-- Windows Platform Badge -->
                                                {#if winCount > 0}
                                                    <div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                                                        <svg class="w-2.5 h-2.5" viewBox="0 0 88 88" fill="currentColor">
                                                            <path d="M0 12.402l35.687-4.86.016 34.423-35.67.243L0 12.402zm35.67 33.528l.028 34.453L.028 75.48.016 46.16l35.654-.23zm4.33-39.117L87.914 0v41.526l-47.914.36V6.813zm47.914 39.51v41.65l-47.914-6.734V45.972l47.914.35z"/>
                                                        </svg>
                                                        <span>{winCount}</span>
                                                    </div>
                                                {/if}

                                                <!-- Mac Platform Badge -->
                                                {#if macCount > 0}
                                                    <div class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[10px] font-bold bg-slate-500/10 dark:bg-slate-700/50 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600">
                                                        <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="currentColor">
                                                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.87.96-2.96-1 .04-2.16.67-2.85 1.48-.58.68-.97 1.76-.84 2.82 1.11.09 2.09-.56 2.73-1.34z"/>
                                                        </svg>
                                                        <span>{macCount}</span>
                                                    </div>
                                                {/if}

                                                <svg class="w-3 h-3 text-[var(--text-3)] group-hover:text-[var(--brand)] transition-colors ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                                </svg>
                                            </button>
                                        {:else}
                                            <button
                                                type="button"
                                                on:click={() => openInstallerModal(prod)}
                                                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-[var(--surface-2)] hover:bg-[var(--surface-3)] border border-dashed border-[var(--border)] hover:border-[var(--brand)]/50 text-[var(--text-3)] hover:text-[var(--brand)] text-[10px] font-bold transition-all cursor-pointer group shadow-2xs select-none"
                                                title="Belum ada file installer. Klik untuk mengunggah setup."
                                            >
                                                <svg class="w-3 h-3 text-[var(--text-3)] group-hover:text-[var(--brand)] group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 4v16m8-8H4" />
                                                </svg>
                                                <span>Upload Setup</span>
                                            </button>
                                        {/if}
                                    </td>

                                    <!-- Status Active / Disabled Switch Toggle -->
                                    <td class="py-3.5 px-4 text-center">
                                        {#if prod.is_active}
                                            <button
                                                type="button"
                                                on:click={() => toggleStatus(prod)}
                                                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25 shadow-2xs"
                                                title="Klik untuk ubah status nonaktif"
                                            >
                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                                <span>Aktif</span>
                                            </button>
                                        {:else}
                                            <button
                                                type="button"
                                                on:click={() => toggleStatus(prod)}
                                                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer whitespace-nowrap bg-rose-500/15 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25 shadow-2xs"
                                                title="Klik untuk ubah status aktif"
                                            >
                                                <span class="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                                                <span>Nonaktif</span>
                                            </button>
                                        {/if}
                                    </td>

                                    <!-- Action Buttons (Edit and Delete) -->
                                    <td class="py-3.5 px-4 text-right">
                                        <div class="flex items-center justify-end gap-1.5">
                                            <button
                                                type="button"
                                                title="Edit Informasi Produk"
                                                on:click={() => openEditModal(prod)}
                                                class="px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)] inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer font-semibold"
                                            >
                                                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                title="Hapus Produk"
                                                on:click={() => openDeleteModal(prod)}
                                                class="px-2.5 py-1.5 rounded-xl bg-rose-500/10 dark:bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400 hover:bg-rose-600 hover:text-white hover:border-rose-600 inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer font-semibold"
                                            >
                                                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                                <span>Hapus</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Interactive Server Pagination Bar -->
                <div class="p-4 border-t border-[var(--border)] bg-[var(--surface-2)]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <!-- Left: Entry count & Per Page selector -->
                    <div class="flex flex-wrap items-center gap-3">
                        <span class="text-[var(--text-3)] text-center sm:text-left">
                            Menampilkan <strong class="text-[var(--text)]">{pagination.total > 0 ? (pagination.page - 1) * pagination.pageSize + 1 : 0} - {Math.min(pagination.page * pagination.pageSize, pagination.total)}</strong> dari <strong class="text-[var(--text)]">{pagination.total}</strong> produk
                        </span>

                        <div class="flex items-center gap-2 pl-3 border-l border-[var(--border)]">
                            <span class="text-[11px] text-[var(--text-3)] font-medium">Tampilkan:</span>
                            <CustomSelect
                                options={pageSizeOptions}
                                bind:value={pageSize}
                                on:change={handlePageSizeChange}
                            />
                        </div>
                    </div>

                    {#if pagination.totalPages > 1}
                        <div class="flex items-center justify-center gap-1 self-center sm:self-auto">
                            <!-- Prev Button (Arrow Icon Only) -->
                            <button
                                type="button"
                                on:click={() => goToPage(page - 1)}
                                disabled={page <= 1}
                                class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-white dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                title="Halaman sebelumnya"
                                aria-label="Halaman sebelumnya"
                            >
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                                </svg>
                            </button>

                            <!-- Page Numbers -->
                            <div class="flex items-center gap-1">
                                {#each Array.from({ length: pagination.totalPages }, (_, i) => i + 1) as p}
                                    {#if p === 1 || p === pagination.totalPages || (p >= page - 1 && p <= page + 1)}
                                        <button
                                            type="button"
                                            on:click={() => goToPage(p)}
                                            class="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center {p === page ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border-0' : 'bg-white dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[var(--border)] dark:border-slate-700 shadow-2xs'}"
                                        >
                                            {p}
                                        </button>
                                    {:else if p === page - 2 || p === page + 2}
                                        <span class="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-3)] dark:text-slate-500 font-bold select-none">...</span>
                                    {/if}
                                {/each}
                            </div>

                            <!-- Next Button (Arrow Icon Only) -->
                            <button
                                type="button"
                                on:click={() => goToPage(page + 1)}
                                disabled={page >= pagination.totalPages}
                                class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-white dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                                title="Halaman berikutnya"
                                aria-label="Halaman berikutnya"
                            >
                                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                                </svg>
                            </button>
                        </div>
                    {/if}
                </div>
            {/if}
        </div>
    </main>
</AdminLayout>

<!-- Modal Add / Edit Product with Svelte CustomSelect for Category -->
{#if productModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div class="w-full max-w-lg rounded-3xl bg-white dark:bg-[#101827] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--text)]">
            <!-- Modal Header -->
            <div class="p-5 border-b border-[var(--border)] bg-[var(--surface-2)]/60 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)] flex items-center justify-center font-bold flex-shrink-0">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-[var(--text)]">
                            {isEditing ? 'Edit Informasi Produk' : 'Tambah Produk Baru'}
                        </h3>
                        <p class="text-xs text-[var(--text-3)] mt-0.5">Konfigurasikan detail software, kategori, harga, dan icon.</p>
                    </div>
                </div>
                <button
                    type="button"
                    on:click={closeProductModal}
                    class="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer bg-transparent border-0 text-xl font-bold"
                >
                    &times;
                </button>
            </div>

            <!-- Modal Form Body -->
            <form on:submit={handleSaveProduct} class="flex flex-col flex-1 overflow-hidden">
                <div class="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <!-- Nama Software -->
                    <div>
                        <label for="productNameInput" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                            Nama Software <span class="text-red-400">*</span>
                        </label>
                        <input
                            id="productNameInput"
                            type="text"
                            required
                            bind:value={formName}
                            placeholder="Contoh: AsistenQ Tokopedia Bot"
                            class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all font-medium"
                        />
                    </div>

                    <!-- Kategori Software (Multi-Category Selection) -->
                    <div>
                        <div class="flex items-center justify-between mb-1.5">
                            <span class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                                Kategori Software ({formCategoryIds.length} Dipilih)
                            </span>
                            {#if formCategoryIds.length > 0}
                                <button
                                    type="button"
                                    on:click={() => formCategoryIds = []}
                                    class="text-[11px] text-[var(--text-3)] hover:text-red-400 font-medium transition-colors bg-transparent border-0 cursor-pointer"
                                >
                                    Reset Pilihan
                                </button>
                            {/if}
                        </div>

                        {#if categoriesList.length > 0}
                            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] max-h-48 overflow-y-auto">
                                {#each categoriesList as cat}
                                    {@const isSelected = formCategoryIds.includes(cat.id)}
                                    <button
                                        type="button"
                                        on:click={() => toggleFormCategory(cat.id)}
                                        class="flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all cursor-pointer {isSelected ? 'bg-purple-500/15 dark:bg-purple-500/20 border-purple-500 text-purple-700 dark:text-purple-300 font-bold shadow-xs' : 'bg-white dark:bg-[#101827] border-[var(--border)] text-[var(--text-2)] hover:border-[var(--brand)]/50'}"
                                    >
                                        <!-- Checkbox visual -->
                                        <div class="w-4 h-4 rounded-md flex items-center justify-center transition-all flex-shrink-0 {isSelected ? 'bg-purple-600 text-white' : 'border border-[var(--border)] bg-[var(--surface-2)]'}">
                                            {#if isSelected}
                                                <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                                </svg>
                                            {/if}
                                        </div>

                                        <!-- Category Icon -->
                                        <div class="w-5 h-5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] overflow-hidden flex items-center justify-center flex-shrink-0">
                                            {#if cat.icon}
                                                <img src="{cat.icon}" alt="{cat.name}" class="w-full h-full object-cover" />
                                            {:else}
                                                <span class="text-[9px]">🏷️</span>
                                            {/if}
                                        </div>

                                        <span class="text-xs truncate flex-1">{cat.name}</span>
                                    </button>
                                {/each}
                            </div>
                        {:else}
                            <p class="text-xs text-[var(--text-3)] italic">Belum ada kategori terdaftar.</p>
                        {/if}
                    </div>

                    <!-- Product Icon / Image Section -->
                    <div>
                        <span class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                            Icon / Logo Software
                        </span>
                        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                            <!-- Preview Box -->
                            <div class="w-14 h-14 rounded-xl border border-[var(--border)] bg-white dark:bg-[#101827] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                                {#if formImage}
                                    <img
                                        src={formImage}
                                        alt="Preview"
                                        class="w-full h-full object-cover"
                                    />
                                {:else}
                                    <div class="text-[var(--brand)] font-black text-lg">
                                        {formName ? formName.charAt(0).toUpperCase() : '⚡'}
                                    </div>
                                {/if}
                            </div>

                            <!-- Upload Actions & URL Input -->
                            <div class="flex-1 w-full space-y-2">
                                <div class="flex items-center gap-2">
                                    <input
                                        type="file"
                                        bind:this={fileInputRef}
                                        on:change={handleFileUpload}
                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                                        class="hidden"
                                    />
                                    <button
                                        type="button"
                                        disabled={isUploadingImage}
                                        on:click={() => fileInputRef && fileInputRef.click()}
                                        class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 border-0"
                                    >
                                        {#if isUploadingImage}
                                            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            <span>Mengunggah...</span>
                                        {:else}
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            <span>Pilih File Icon</span>
                                        {/if}
                                    </button>

                                    {#if formImage}
                                        <button
                                            type="button"
                                            on:click={() => formImage = ''}
                                            class="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                                        >
                                            Hapus Icon
                                        </button>
                                    {/if}
                                </div>

                                <input
                                    id="productImageInput"
                                    type="text"
                                    bind:value={formImage}
                                    placeholder="Atau tempel URL icon: https://... /uploads/..."
                                    class="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#101827] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Pricing & Discount -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label for="productPriceInput" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                                Harga Dasar (Rp) <span class="text-red-400">*</span>
                            </label>
                            <input
                                id="productPriceInput"
                                type="number"
                                required
                                min="0"
                                step="any"
                                bind:value={formPrice}
                                class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] font-semibold focus:outline-none focus:border-[var(--brand)] transition-colors"
                            />
                            {#if Number(formPrice) === 0}
                                <div class="mt-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs flex items-start gap-2 shadow-2xs">
                                    <svg class="w-4 h-4 mt-0.5 flex-shrink-0 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span><strong>Produk Gratis (Rp 0):</strong> Member dapat langsung mengklaim & mengaktifkan lisensi produk ini secara instan tanpa melalui pembayaran gateway.</span>
                                </div>
                            {/if}
                        </div>
                        <div>
                            <label for="productDiscountInput" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                                Diskon (%)
                            </label>
                            <input
                                id="productDiscountInput"
                                type="number"
                                min="0"
                                max="99"
                                disabled={!formIsDiscount}
                                bind:value={formDiscountPercent}
                                class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] font-semibold focus:outline-none focus:border-[var(--brand)] transition-colors disabled:opacity-40"
                            />
                        </div>
                    </div>

                    <!-- Svelte Custom Checkboxes -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] transition-colors">
                            <CustomCheckbox
                                bind:checked={formIsDiscount}
                                label="Aktifkan Promo Diskon"
                                description="Aktifkan potongan harga khusus"
                                color="rose"
                            />
                        </div>

                        <div class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] transition-colors">
                            <CustomCheckbox
                                bind:checked={formIsActive}
                                label="Status Tayang (Aktif)"
                                description="Tampilkan produk di katalog member"
                                color="emerald"
                            />
                        </div>
                    </div>

                    <!-- Bundle Configuration Section -->
                    <div class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-indigo-500 transition-colors space-y-3">
                        <CustomCheckbox
                            bind:checked={formIsBundle}
                            label="Jadikan Produk Ini Paket Bundle"
                            description="Gabungan 2+ software bot dalam 1 paket hemat"
                            color="indigo"
                        />

                        {#if formIsBundle}
                            <div class="pt-2.5 border-t border-[var(--border)] space-y-2">
                                <div class="flex items-center justify-between">
                                    <span class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                                        Pilih Software dalam Paket Bundel ({formBundleItems.length} Dipilih)
                                    </span>
                                    {#if formBundleItems.length > 0}
                                        <button
                                            type="button"
                                            on:click={() => formBundleItems = []}
                                            class="text-[11px] text-[var(--text-3)] hover:text-rose-400 font-medium transition-colors bg-transparent border-0 cursor-pointer"
                                        >
                                            Reset Pilihan
                                        </button>
                                    {/if}
                                </div>
                                <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 rounded-xl bg-white dark:bg-[#101827] border border-[var(--border)]">
                                    {#each (productsData?.products || []).filter(p => p.id !== formProductId && !p.is_bundle) as bProd}
                                        {@const isIncluded = formBundleItems.includes(bProd.id)}
                                        <button
                                            type="button"
                                            on:click={() => {
                                                if (isIncluded) formBundleItems = formBundleItems.filter(id => id !== bProd.id);
                                                else formBundleItems = [...formBundleItems, bProd.id];
                                            }}
                                            class="flex items-center gap-2 p-2 rounded-lg text-left text-xs transition-colors cursor-pointer border {isIncluded ? 'bg-indigo-500/15 border-indigo-500 text-indigo-700 dark:text-indigo-300 font-bold' : 'border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)]'}"
                                        >
                                            <div class="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-colors {isIncluded ? 'bg-indigo-600 text-white' : 'border border-[var(--border)] bg-[var(--surface-2)]'}">
                                                {#if isIncluded}
                                                    <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                                                    </svg>
                                                {/if}
                                            </div>
                                            <span class="truncate">{bProd.name}</span>
                                        </button>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    </div>

                    <!-- Deskripsi -->
                    <div>
                        <label for="productDescInput" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                            Deskripsi Singkat Software
                        </label>
                        <textarea
                            id="productDescInput"
                            rows="3"
                            bind:value={formDescription}
                            placeholder="Deskripsi singkat fitur produk untuk informasi checkout..."
                            class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors resize-none"
                        ></textarea>
                    </div>

                    <!-- Video Tutorial Section (Dynamic Repeater) -->
                    <div class="p-3.5 sm:p-4 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] space-y-3">
                        <div class="flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <svg class="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                                </svg>
                                <span class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider">
                                    Video Tutorial YouTube ({formTutorials.length})
                                </span>
                            </div>
                            <button
                                type="button"
                                on:click={addTutorialRow}
                                class="px-2.5 py-1 rounded-xl text-xs font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 hover:bg-purple-500/20 transition-all cursor-pointer inline-flex items-center gap-1"
                            >
                                <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 4v16m8-8H4" />
                                </svg>
                                <span>Tambah Video</span>
                            </button>
                        </div>
                        <p class="text-[11px] text-[var(--text-3)] leading-relaxed">
                            Mendukung video YouTube biasa (<code class="font-mono text-purple-400">watch?v=...</code>), Shorts (<code class="font-mono text-purple-400">shorts/...</code>), playlist (<code class="font-mono text-purple-400">playlist?list=...</code>), dan shortened URL (<code class="font-mono text-purple-400">youtu.be/...</code>).
                        </p>

                        <div class="space-y-2.5 max-h-60 overflow-y-auto pr-1">
                            {#each formTutorials as tut, idx (tut.id || idx)}
                                <div class="p-2.5 rounded-xl bg-white dark:bg-[#101827] border border-[var(--border)] flex items-start gap-2 group">
                                    <div class="w-6 h-6 rounded-lg bg-purple-500/15 text-purple-600 dark:text-purple-400 font-mono font-bold text-xs flex items-center justify-center flex-shrink-0 mt-1">
                                        {idx + 1}
                                    </div>
                                    <div class="flex-1 space-y-1.5 min-w-0">
                                        <input
                                            type="text"
                                            bind:value={tut.title}
                                            placeholder="Judul Tutorial (contoh: Panduan Setup & Instalasi)"
                                            class="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-purple-500 transition-colors font-medium"
                                        />
                                        <input
                                            type="text"
                                            bind:value={tut.url}
                                            placeholder="URL Video / Playlist YouTube (https://www.youtube.com/...)"
                                            class="w-full px-3 py-1.5 rounded-lg bg-[var(--surface-2)] border border-[var(--border)] text-xs text-purple-600 dark:text-purple-300 placeholder-[var(--text-3)] focus:outline-none focus:border-purple-500 transition-colors font-mono"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        on:click={() => removeTutorialRow(idx)}
                                        class="p-1.5 rounded-lg text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer flex-shrink-0 mt-1 bg-transparent border-0"
                                        title="Hapus Video Tutorial Ini"
                                    >
                                        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                    </button>
                                </div>
                            {/each}
                        </div>
                    </div>
                </div>

                <!-- Modal Footer -->
                <div class="p-4 sm:p-5 border-t border-[var(--border)] bg-[var(--surface-2)]/60 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        on:click={closeProductModal}
                        class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-3)] transition-all cursor-pointer"
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        disabled={isSaving}
                        class="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer disabled:opacity-50 border-0 flex items-center gap-1.5"
                    >
                        {#if isSaving}
                            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Menyimpan...</span>
                        {:else}
                            <span>Simpan Produk</span>
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Modal Delete Product -->
{#if deleteModalOpen && deletingProduct}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#101827] border border-[var(--border)] shadow-2xl p-6 space-y-4 text-[var(--text)]">
            <!-- Warning Header -->
            <div class="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mb-2 flex-shrink-0">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </div>
            <div>
                <h3 class="text-base font-bold text-[var(--text)]">Hapus Produk Software</h3>
                <p class="text-xs text-[var(--text-3)] mt-1.5 leading-relaxed">
                    Apakah Anda yakin ingin menghapus produk <strong class="text-[var(--text)]">"{deletingProduct.name}"</strong>? Data lisensi dan konfigurasi produk ini akan dihapus permanen dari sistem dan tindakan ini tidak dapat dibatalkan.
                </p>
            </div>
            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                <button
                    type="button"
                    on:click={closeDeleteModal}
                    class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-3)] transition-all cursor-pointer"
                >
                    Batal
                </button>
                <button
                    type="button"
                    disabled={isDeleting}
                    on:click={executeDeleteProduct}
                    class="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-500/25 transition-all cursor-pointer disabled:opacity-50 border-0 flex items-center gap-1.5"
                >
                    {#if isDeleting}
                        <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Menghapus...</span>
                    {:else}
                        <span>Ya, Hapus Produk</span>
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Modal Manage App Installer Files (Windows & Mac) -->
{#if installerModalOpen && activeInstallerProduct}
    {@const activeInstallers = getNormalizedInstallers(activeInstallerProduct)}
    {@const winFilesList = activeInstallers.windows}
    {@const macFilesList = activeInstallers.mac}
    {@const currentList = installerOsTab === 'windows' ? winFilesList : macFilesList}

    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in">
        <div class="w-full max-w-2xl rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[92vh] text-[var(--text)]">
            <!-- Modal Header -->
            <div class="p-5 sm:p-6 border-b border-[var(--border)] bg-[var(--surface-2)]/70 flex items-start justify-between gap-4">
                <div class="flex items-start gap-3.5 min-w-0">
                    {#if activeInstallerProduct.image && !imgErrorMap[activeInstallerProduct.id]}
                        <img
                            src={activeInstallerProduct.image}
                            alt={activeInstallerProduct.name}
                            class="w-12 h-12 rounded-2xl object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0 shadow-sm"
                            on:error={() => imgErrorMap[activeInstallerProduct.id] = true}
                        />
                    {:else}
                        <div class="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-[var(--brand)] font-black text-base flex-shrink-0 shadow-sm">
                            {(activeInstallerProduct.name || 'P').charAt(0).toUpperCase()}
                        </div>
                    {/if}
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase tracking-wider">
                                Pusat Installer & Setup
                            </span>
                            <span class="text-[10px] text-[var(--text-3)] font-mono">ID: #{activeInstallerProduct.id}</span>
                        </div>
                        <h3 class="text-base sm:text-lg font-bold text-[var(--text)] truncate mt-0.5">
                            {activeInstallerProduct.name}
                        </h3>
                        <p class="text-xs text-[var(--text-3)] mt-0.5">
                            Kelola file setup Windows (.exe / .zip) dan macOS (.dmg / .zip / .pkg) untuk member.
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    on:click={closeInstallerModal}
                    class="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer bg-transparent border-0 text-xl font-bold flex-shrink-0"
                >
                    &times;
                </button>
            </div>

            <!-- OS Platform Selector Tabs & Upload Action -->
            <div class="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--surface-2)]/30 flex items-center justify-between gap-3 flex-wrap">
                <div class="flex items-center gap-2 p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                    <button
                        type="button"
                        on:click={() => installerOsTab = 'windows'}
                        class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer {installerOsTab === 'windows' ? 'bg-[var(--surface)] text-blue-400 shadow-xs border border-blue-500/30' : 'text-[var(--text-3)] hover:text-[var(--text)]'}"
                    >
                        <svg class="w-3.5 h-3.5" viewBox="0 0 88 88" fill="currentColor">
                            <path d="M0 12.402l35.687-4.86.016 34.423-35.67.243L0 12.402zm35.67 33.528l.028 34.453L.028 75.48.016 46.16l35.654-.23zm4.33-39.117L87.914 0v41.526l-47.914.36V6.813zm47.914 39.51v41.65l-47.914-6.734V45.972l47.914.35z"/>
                        </svg>
                        <span>Windows</span>
                        <span class="px-1.5 py-0.2 rounded-md text-[10px] font-mono {winFilesList.length > 0 ? 'bg-blue-500/20 text-blue-300 font-bold' : 'bg-[var(--border)] text-[var(--text-3)]'}">
                            {winFilesList.length}
                        </span>
                    </button>

                    <button
                        type="button"
                        on:click={() => installerOsTab = 'mac'}
                        class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer {installerOsTab === 'mac' ? 'bg-[var(--surface)] text-slate-200 shadow-xs border border-[var(--border)]' : 'text-[var(--text-3)] hover:text-[var(--text)]'}"
                    >
                        <svg class="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.87.96-2.96-1 .04-2.16.67-2.85 1.48-.58.68-.97 1.76-.84 2.82 1.11.09 2.09-.56 2.73-1.34z"/>
                        </svg>
                        <span>macOS</span>
                        <span class="px-1.5 py-0.2 rounded-md text-[10px] font-mono {macFilesList.length > 0 ? 'bg-slate-500/20 text-slate-300 font-bold' : 'bg-[var(--border)] text-[var(--text-3)]'}">
                            {macFilesList.length}
                        </span>
                    </button>
                </div>

                <div class="flex items-center gap-2">
                    <input
                        type="file"
                        bind:this={installerFileInput}
                        on:change={handleUploadInstallerFile}
                        accept={installerOsTab === 'windows' ? '.exe,.zip,.rar,.msi' : '.dmg,.zip,.pkg,.app,.tar.gz'}
                        class="hidden"
                    />
                    <button
                        type="button"
                        disabled={isUploadingInstaller}
                        on:click={() => installerFileInput && installerFileInput.click()}
                        class="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-2 border-0"
                    >
                        {#if isUploadingInstaller}
                            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Mengunggah...</span>
                        {:else}
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                            </svg>
                            <span>Upload File {installerOsTab === 'windows' ? 'Windows' : 'macOS'}</span>
                        {/if}
                    </button>
                </div>
            </div>

            <!-- Upload Live Progress Bar Container -->
            {#if isUploadingInstaller}
                <div class="p-4 bg-blue-500/10 border-b border-blue-500/20 space-y-2 animate-fade-in">
                    <div class="flex items-center justify-between text-xs font-bold text-[var(--text)]">
                        <span class="flex items-center gap-2 text-blue-400">
                            <span class="w-2 h-2 rounded-full bg-blue-400 animate-ping"></span>
                            <span>{uploadStatusText}</span>
                        </span>
                        <span class="font-mono text-blue-400">{uploadProgress}%</span>
                    </div>

                    <!-- Progress Bar Track -->
                    <div class="w-full h-2.5 rounded-full bg-[var(--surface-2)] overflow-hidden border border-[var(--border)]">
                        <div
                            class="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-400 rounded-full transition-all duration-200"
                            style="width: {uploadProgress}%;"
                        ></div>
                    </div>

                    <div class="flex items-center justify-between text-[10px] text-[var(--text-3)] font-mono">
                        <span>{uploadBytesText}</span>
                        <span>Kecepatan: {uploadSpeedText}</span>
                    </div>
                </div>
            {/if}

            <!-- Modal Body: File List -->
            <div class="p-5 sm:p-6 overflow-y-auto space-y-3 max-h-[calc(92vh-220px)] flex-1">
                {#if currentList.length === 0}
                    <div class="py-12 px-4 text-center rounded-2xl border-2 border-dashed border-[var(--border)] bg-[var(--surface-2)]/40 space-y-3">
                        <div class="w-12 h-12 rounded-2xl bg-[var(--surface-2)] text-[var(--text-3)] flex items-center justify-center mx-auto">
                            {#if installerOsTab === 'windows'}
                                <svg class="w-6 h-6" viewBox="0 0 88 88" fill="currentColor">
                                    <path d="M0 12.402l35.687-4.86.016 34.423-35.67.243L0 12.402zm35.67 33.528l.028 34.453L.028 75.48.016 46.16l35.654-.23zm4.33-39.117L87.914 0v41.526l-47.914.36V6.813zm47.914 39.51v41.65l-47.914-6.734V45.972l47.914.35z"/>
                                </svg>
                            {:else}
                                <svg class="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.54c.64-.78 1.08-1.87.96-2.96-1 .04-2.16.67-2.85 1.48-.58.68-.97 1.76-.84 2.82 1.11.09 2.09-.56 2.73-1.34z"/>
                                </svg>
                            {/if}
                        </div>
                        <div>
                            <p class="text-sm font-bold text-[var(--text)]">Belum ada file installer {installerOsTab === 'windows' ? 'Windows' : 'macOS'}</p>
                            <p class="text-xs text-[var(--text-3)] mt-0.5">
                                Klik tombol upload di atas untuk mengunggah installer software ({installerOsTab === 'windows' ? '.exe / .zip' : '.dmg / .zip'}).
                            </p>
                        </div>
                    </div>
                {:else}
                    <div class="space-y-2.5">
                        {#each currentList as file (file.id || file.filename)}
                            {@const ext = (file.filename || '').split('.').pop()?.toUpperCase() || 'FILE'}
                            {@const d = file.uploaded_at ? new Date(file.uploaded_at * 1000) : new Date()}
                            {@const dateStr = d.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}

                            <div class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                                <div class="flex items-center gap-3 min-w-0">
                                    <div class="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center flex-shrink-0 font-mono font-bold text-xs">
                                        {ext}
                                    </div>
                                    <div class="min-w-0">
                                        <div class="text-xs font-bold text-[var(--text)] truncate" title={file.filename}>
                                            {file.filename}
                                        </div>
                                        <div class="flex items-center gap-2 text-[11px] text-[var(--text-3)] mt-0.5">
                                            <span class="font-mono text-cyan-400 font-semibold">{file.size}</span>
                                            <span>&bull;</span>
                                            <span>{dateStr}</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex items-center gap-2 flex-shrink-0 self-end sm:self-auto">
                                    <!-- Copy Download Link Button -->
                                    <button
                                        type="button"
                                        on:click={() => copyDownloadUrl(file.id, file.url)}
                                        class="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-[var(--surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text-2)] transition-all cursor-pointer inline-flex items-center gap-1"
                                        title="Salin Link Download CDN"
                                    >
                                        {#if copiedFileUrlId === file.id}
                                            <svg class="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span class="text-emerald-400 font-bold">Disalin</span>
                                        {:else}
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                            </svg>
                                            <span>Salin URL</span>
                                        {/if}
                                    </button>

                                    <!-- Download / Open Link -->
                                    <a
                                        href={file.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--border)] border border-[var(--border)] text-[var(--text)] transition-all flex items-center gap-1.5"
                                    >
                                        <span>Buka / Unduh</span>
                                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                        </svg>
                                    </a>

                                    <!-- Delete Button -->
                                    <button
                                        type="button"
                                        disabled={isDeletingInstallerFile}
                                        on:click={() => handleDeleteInstallerFile(file.id, file.filename, installerOsTab)}
                                        class="p-1.5 rounded-xl text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50 bg-transparent border-0"
                                        title="Hapus File Ini"
                                    >
                                        {#if isDeletingInstallerFile && deletingFileId === file.id}
                                            <span class="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></span>
                                        {:else}
                                            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                            </svg>
                                        {/if}
                                    </button>
                                </div>
                            </div>
                        {/each}
                    </div>
                {/if}
            </div>

            <!-- Modal Footer Note -->
            <div class="p-4 sm:p-5 border-t border-[var(--border)] bg-[var(--surface-2)]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div class="flex items-center gap-2 text-[var(--text-3)] text-[11px]">
                    <svg class="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>File tersinkronisasi otomatis dengan Pusat Unduhan & Lisensi Member.</span>
                </div>
                <button
                    type="button"
                    on:click={closeInstallerModal}
                    class="px-4 py-2 rounded-xl text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-3)] transition-all cursor-pointer self-end sm:self-auto"
                >
                    Selesai
                </button>
            </div>
        </div>
    </div>
{/if}

<!-- Modal Interactive YouTube Video Tutorial Player -->
{#if tutorialPlayerModalOpen && playerProduct}
    {@const currentVideo = playerTutorials[selectedVideoIndex] || playerTutorials[0] || null}
    {@const embedUrl = currentVideo ? parseYouTubeEmbedUrl(currentVideo.url) : ''}

    <div class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fade-in">
        <div class="w-full max-w-4xl rounded-3xl bg-[var(--surface)] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[94vh] text-[var(--text)]">
            <!-- Modal Header -->
            <div class="p-4 sm:p-5 border-b border-[var(--border)] bg-[var(--surface-2)]/80 flex items-center justify-between gap-3">
                <div class="flex items-center gap-3 min-w-0">
                    <div class="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-purple-500/20 text-purple-600 dark:text-purple-400 flex items-center justify-center flex-shrink-0">
                        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                        </svg>
                    </div>
                    <div class="min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 uppercase tracking-wider">
                                Tutorial Player
                            </span>
                            <span class="text-[10px] text-[var(--text-3)] font-mono">ID: #{playerProduct.id}</span>
                        </div>
                        <h3 class="text-sm sm:text-base font-bold text-[var(--text)] truncate mt-0.5">
                            {playerProduct.name}
                        </h3>
                    </div>
                </div>

                <div class="flex items-center gap-2 flex-shrink-0">
                    {#if currentVideo && currentVideo.url}
                        <a
                            href={currentVideo.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            class="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface-2)] hover:bg-[var(--surface-3)] text-purple-600 dark:text-purple-400 border border-[var(--border)] transition-all"
                            title="Buka langsung di YouTube"
                        >
                            <span>Buka di YouTube</span>
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                            </svg>
                        </a>
                    {/if}
                    <button
                        type="button"
                        on:click={closeTutorialPlayer}
                        class="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer bg-transparent border-0 text-xl font-bold"
                    >
                        &times;
                    </button>
                </div>
            </div>

            <!-- Body Player & Playlist Layout -->
            <div class="flex flex-col lg:flex-row flex-1 overflow-hidden">
                <!-- Video Player Iframe (16:9 Aspect Ratio) -->
                <div class="flex-1 bg-black flex flex-col items-center justify-center min-h-[240px] sm:min-h-[360px] lg:min-h-[440px]">
                    {#if embedUrl}
                        <iframe
                            src={embedUrl}
                            title={currentVideo?.title || 'YouTube Tutorial Player'}
                            class="w-full h-full aspect-video border-0"
                            referrerpolicy="strict-origin-when-cross-origin"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowfullscreen
                        ></iframe>
                    {:else}
                        <div class="p-8 text-center text-[var(--text-3)] space-y-2">
                            <svg class="w-12 h-12 mx-auto text-[var(--text-3)] opacity-40" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M19.615 3.184c-3.604-.246-11.631-.245-15.23 0-3.897.266-4.356 2.62-4.385 8.816.029 6.185.484 8.549 4.385 8.816 3.6.245 11.626.246 15.23 0 3.897-.266 4.356-2.62 4.385-8.816-.029-6.185-.484-8.549-4.385-8.816zm-10.615 12.816v-8l8 3.993-8 4.007z"/>
                            </svg>
                            <p class="text-sm font-semibold">Video tidak dapat dimuat atau URL tidak valid.</p>
                        </div>
                    {/if}
                </div>

                <!-- Playlist Sidebar / Selector -->
                <div class="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-[var(--border)] bg-[var(--surface-2)]/50 p-4 flex flex-col">
                    <div class="text-xs font-bold uppercase tracking-wider text-[var(--text-3)] mb-3 flex items-center justify-between">
                        <span>Daftar Video</span>
                        <span class="px-2 py-0.5 bg-[var(--surface-3)] text-[var(--text-2)] rounded-full text-[10px] font-mono">
                            {playerTutorials.length} Video
                        </span>
                    </div>

                    {#if playerTutorials.length === 0}
                        <div class="text-xs text-[var(--text-3)] italic py-8 text-center">
                            Belum ada video tutorial untuk produk ini.
                        </div>
                    {:else}
                        <div class="flex-1 overflow-y-auto space-y-2 max-h-48 sm:max-h-60 lg:max-h-[380px] pr-1">
                            {#each playerTutorials as tut, idx}
                                {@const isSelected = idx === selectedVideoIndex}
                                {@const isPl = tut.url && tut.url.includes('list=')}
                                <button
                                    type="button"
                                    on:click={() => selectedVideoIndex = idx}
                                    class="w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer {isSelected ? 'bg-purple-500/15 border-purple-500 text-[var(--text)] shadow-xs font-bold' : 'bg-[var(--surface)] border-[var(--border)] text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]'}"
                                >
                                    <div class="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 text-xs font-mono font-bold {isSelected ? 'bg-purple-600 text-white' : 'bg-[var(--surface-2)] text-[var(--text-3)]'}">
                                        {idx + 1}
                                    </div>
                                    <div class="flex-1 min-w-0">
                                        <div class="text-xs truncate font-medium {isSelected ? 'text-purple-600 dark:text-purple-300 font-bold' : 'text-[var(--text)]'}">
                                            {tut.title || `Tutorial ${idx + 1}`}
                                        </div>
                                        <div class="text-[10px] text-[var(--text-3)] mt-0.5 flex items-center gap-1 font-normal">
                                            <span>{isPl ? '📑 Playlist' : '🎬 Video'}</span>
                                        </div>
                                    </div>
                                </button>
                            {/each}
                        </div>
                    {/if}

                    <div class="pt-3 mt-auto border-t border-[var(--border)] flex items-center justify-between">
                        <button
                            type="button"
                            on:click={() => {
                                const prodToEdit = playerProduct;
                                closeTutorialPlayer();
                                if (prodToEdit) openEditModal(prodToEdit);
                            }}
                            class="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline bg-transparent border-0 cursor-pointer inline-flex items-center gap-1"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                            <span>Edit Tutorial</span>
                        </button>
                        <button
                            type="button"
                            on:click={closeTutorialPlayer}
                            class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--surface)] hover:bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] transition-colors cursor-pointer"
                        >
                            Tutup
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
{/if}

