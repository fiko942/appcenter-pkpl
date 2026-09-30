<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import AdminLayout from '../components/AdminLayout.svelte';
    import CustomCheckbox from '../components/CustomCheckbox.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';
    import SegmentedTabs, { type TabItem } from '../components/SegmentedTabs.svelte';

    let toastTimer: ReturnType<typeof setTimeout> | null = null;
    function showToast(msg: string, duration = 3000) {
        if (toastTimer) clearTimeout(toastTimer);
        successMessage = msg;
        toastTimer = setTimeout(() => {
            successMessage = '';
        }, duration);
    }

    interface CategoryItem {
        id: number;
        name: string;
        slug: string;
        icon: string;
        description: string;
        is_active: boolean;
        created_at: number;
        products_count: number;
    }

    interface CategoriesData {
        categories: CategoryItem[];
        stats: {
            total: number;
            active: number;
            total_products_categorized: number;
        };
    }

    let loading: boolean = true;
    let error: string = '';
    let successMessage: string = '';
    let categoriesData: CategoriesData | null = null;
    let searchInput: string = '';
    let selectedStatusFilter: 'all' | 'active' | 'inactive' = 'all';
    let sortBy: string = 'name-asc';

    const sortOptions: OptionItem[] = [
        { value: 'name-asc', label: 'Nama (A - Z)' },
        { value: 'products-desc', label: 'Produk Terbanyak' },
        { value: 'newest', label: 'Terbaru Ditambahkan' }
    ];

    // Modal state for Add/Edit Category
    let categoryModalOpen: boolean = false;
    let isEditing: boolean = false;
    let isSaving: boolean = false;
    let formCategoryId: number = 0;
    let formName: string = '';
    let formSlug: string = '';
    let formIcon: string = '';
    let formDescription: string = '';
    let formIsActive: boolean = true;
    let isUploadingIcon: boolean = false;
    let fileInputRef: HTMLInputElement;
    let imgErrorMap: Record<number, boolean> = {};

    // Modal state for Delete Confirmation
    let deleteModalOpen: boolean = false;
    let categoryToDelete: CategoryItem | null = null;
    let isDeleting: boolean = false;

    // Slug auto-generation flag
    let isSlugManual: boolean = false;

    function handleNameInput() {
        if (!isEditing && !isSlugManual) {
            formSlug = formName
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/^-|-$/g, '');
        }
    }

    async function loadCategories() {
        loading = true;
        error = '';
        try {
            const res = await fetch('/admin/api/categories', {
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            if (!res.ok) {
                if (res.status === 401) {
                    window.location.href = '/#/admin/login';
                    return;
                }
                throw new Error(`HTTP ${res.status}`);
            }
            const json = await res.json();
            if (json.status === 'success' && json.data) {
                categoriesData = json.data;
            } else {
                throw new Error(json.message || 'Format data kategori tidak valid');
            }
        } catch (e: any) {
            console.error('Failed to load categories:', e);
            error = e.message || 'Gagal memuat daftar kategori';
        } finally {
            loading = false;
        }
    }

    function openAddModal() {
        isEditing = false;
        isSlugManual = false;
        formCategoryId = 0;
        formName = '';
        formSlug = '';
        formIcon = '';
        formDescription = '';
        formIsActive = true;
        categoryModalOpen = true;
    }

    function openEditModal(category: CategoryItem) {
        isEditing = true;
        isSlugManual = true;
        formCategoryId = category.id;
        formName = category.name;
        formSlug = category.slug;
        formIcon = category.icon || '';
        formDescription = category.description || '';
        formIsActive = category.is_active;
        categoryModalOpen = true;
    }

    function closeCategoryModal() {
        categoryModalOpen = false;
    }

    async function handleIconFileUpload(e: Event) {
        const input = e.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        const formData = new FormData();
        formData.append('icon', file);

        isUploadingIcon = true;
        try {
            const uploadUrl = formCategoryId > 0
                ? `/admin/api/categories/${formCategoryId}/upload-icon`
                : '/admin/api/categories/upload-icon';

            const res = await fetch(uploadUrl, {
                method: 'POST',
                body: formData,
                credentials: 'include'
            });

            const json = await res.json();
            if (res.ok && json.status === 'success' && json.icon_url) {
                formIcon = json.icon_url;
                showToast('Icon kategori berhasil diunggah', 3000);
            } else {
                alert(json.message || 'Gagal mengunggah icon kategori');
            }
        } catch (err) {
            console.error('Icon upload error:', err);
            alert('Terjadi kesalahan saat mengunggah icon');
        } finally {
            isUploadingIcon = false;
            input.value = '';
        }
    }

    async function handleSaveCategory() {
        if (!formName.trim()) {
            alert('Nama kategori wajib diisi');
            return;
        }

        isSaving = true;
        try {
            const endpoint = isEditing
                ? `/admin/api/categories/edit/${formCategoryId}`
                : '/admin/api/categories/create';

            const res = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    name: formName.trim(),
                    slug: formSlug.trim(),
                    icon: formIcon.trim(),
                    description: formDescription.trim(),
                    is_active: formIsActive
                }),
                credentials: 'include'
            });

            const json = await res.json();
            if (res.ok && json.status === 'success') {
                closeCategoryModal();
                showToast(isEditing ? 'Kategori berhasil diperbarui' : 'Kategori baru berhasil ditambahkan', 3500);
                await loadCategories();
            } else {
                alert(json.message || 'Gagal menyimpan kategori');
            }
        } catch (e) {
            console.error('Save category error:', e);
            alert('Terjadi kesalahan saat menyimpan kategori');
        } finally {
            isSaving = false;
        }
    }

    function confirmDeleteCategory(category: CategoryItem) {
        categoryToDelete = category;
        deleteModalOpen = true;
    }

    function closeDeleteModal() {
        deleteModalOpen = false;
        categoryToDelete = null;
    }

    async function handleDeleteCategory() {
        if (!categoryToDelete) return;
        isDeleting = true;
        try {
            const res = await fetch(`/admin/api/categories/delete/${categoryToDelete.id}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const json = await res.json();
            if (res.ok && json.status === 'success') {
                closeDeleteModal();
                showToast('Kategori berhasil dihapus', 3000);
                await loadCategories();
            } else {
                alert(json.message || 'Gagal menghapus kategori');
            }
        } catch (e) {
            console.error('Delete category error:', e);
            alert('Terjadi kesalahan saat menghapus kategori');
        } finally {
            isDeleting = false;
        }
    }

    import { push } from 'svelte-spa-router';

    let togglingId: number | null = null;

    function navigateToCategoryProducts(category: CategoryItem) {
        push(`/admin/products?category_id=${category.id}`);
    }

    async function handleToggleStatus(category: CategoryItem) {
        if (togglingId === category.id) return;
        togglingId = category.id;
        const previousState = category.is_active;

        // Optimistic UI update
        category.is_active = !previousState;
        if (categoriesData) {
            categoriesData.stats.active = categoriesData.categories.filter(c => c.is_active).length;
        }
        categoriesData = categoriesData;

        try {
            const res = await fetch(`/admin/api/categories/toggle-status/${category.id}`, {
                method: 'POST',
                headers: { 'Accept': 'application/json' },
                credentials: 'include'
            });
            const json = await res.json();
            if (res.ok && json.success) {
                category.is_active = json.is_active;
                showToast(`Kategori "${category.name}" kini ${json.is_active ? 'Aktif' : 'Nonaktif'} di katalog`, 2500);
            } else {
                category.is_active = previousState;
                alert(json.error || 'Gagal mengubah status kategori');
            }
            if (categoriesData) {
                categoriesData.stats.active = categoriesData.categories.filter(c => c.is_active).length;
            }
            categoriesData = categoriesData;
        } catch (e) {
            console.error('Toggle status error:', e);
            category.is_active = previousState;
            if (categoriesData) {
                categoriesData.stats.active = categoriesData.categories.filter(c => c.is_active).length;
            }
            categoriesData = categoriesData;
            alert('Terjadi kesalahan koneksi saat mengubah status');
        } finally {
            togglingId = null;
        }
    }

    $: totalCount = categoriesData?.stats?.total ?? (categoriesData?.categories?.length || 0);
    $: activeCount = categoriesData?.stats?.active ?? (categoriesData?.categories?.filter(c => c.is_active).length || 0);
    $: inactiveCount = Math.max(0, totalCount - activeCount);

    $: statusTabs = [
        { id: 'all', label: 'Semua', count: totalCount, color: 'brand' as const },
        { id: 'active', label: 'Aktif', count: activeCount, color: 'emerald' as const },
        { id: 'inactive', label: 'Nonaktif', count: inactiveCount, color: 'amber' as const }
    ];

    let currentPage: number = 1;
    let pageSize: number = 10;
    const pageSizeOptions: OptionItem[] = [
        { value: 10, label: '10 baris / hal' },
        { value: 25, label: '25 baris / hal' },
        { value: 50, label: '50 baris / hal' },
        { value: 100, label: '100 baris / hal' }
    ];

    $: displayedCategories = (categoriesData?.categories || [])
        .filter(c => {
            if (selectedStatusFilter === 'active' && !c.is_active) return false;
            if (selectedStatusFilter === 'inactive' && c.is_active) return false;
            if (searchInput.trim()) {
                const q = searchInput.toLowerCase();
                return c.name.toLowerCase().includes(q) ||
                       c.slug.toLowerCase().includes(q) ||
                       (c.description && c.description.toLowerCase().includes(q));
            }
            return true;
        })
        .sort((a, b) => {
            if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
            if (sortBy === 'products-desc') return (b.products_count || 0) - (a.products_count || 0);
            if (sortBy === 'newest') return (b.created_at || b.id) - (a.created_at || a.id);
            return 0;
        });

    $: totalPages = Math.ceil(displayedCategories.length / pageSize) || 1;
    $: if (currentPage > totalPages) currentPage = totalPages;
    $: if (currentPage < 1) currentPage = 1;
    $: paginatedCategories = displayedCategories.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    $: {
        searchInput;
        selectedStatusFilter;
        sortBy;
        currentPage = 1;
    }

    onMount(() => {
        loadCategories();
    });

    onDestroy(() => {
        if (toastTimer) clearTimeout(toastTimer);
    });
</script>

<svelte:head>
    <title>Kategori Produk - Admin Appcenter</title>
</svelte:head>

<AdminLayout activePage="categories" eyebrow="PANEL ADMIN ZIQVA">
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
                <button type="button" on:click={loadCategories} class="underline text-xs font-bold bg-transparent border-0 text-red-400 cursor-pointer">Coba Lagi</button>
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
                        <span class="text-xs text-[var(--text-3)] font-medium hidden xs:inline">Manajemen Kategori & Pengelompokan</span>
                    </div>
                    <h1 class="text-2xl sm:text-3xl font-bold text-[var(--text)] tracking-tight flex items-center gap-2.5">
                        <span class="whitespace-nowrap">Kategori Produk</span>
                        {#if !loading}
                            <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text-3)] whitespace-nowrap">
                                {totalCount} Kategori
                            </span>
                        {/if}
                    </h1>
                    <p class="text-xs sm:text-sm text-[var(--text-3)] mt-1 max-w-xl">
                        Kelola kategori software aplikasi, icon visual, dan pengelompokan produk untuk katalog.
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
                        <span>Kategori</span>
                    </button>
                </div>
            </div>

            <!-- Desktop Primary Add Button -->
            <div class="hidden sm:flex items-center gap-2 flex-shrink-0">
                <button
                    type="button"
                    on:click={openAddModal}
                    class="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white shadow-md shadow-blue-500/20 transition-all cursor-pointer border-0"
                >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>Tambah Kategori Baru</span>
                </button>
            </div>
        </div>

        <!-- Single Unified Surface Table Card -->
        <div class="rounded-3xl bg-[var(--surface-1)] border border-[var(--border)] shadow-xs">
            <!-- Top Segmented Status Tabs with Framer-motion Sliding Pill -->
            <div class="p-3 sm:p-4 border-b border-[var(--border)] bg-[var(--surface-2)]/30 overflow-x-auto no-scrollbar">
                <SegmentedTabs
                    tabs={statusTabs}
                    bind:activeTab={selectedStatusFilter}
                />
            </div>

            <!-- Single Unified Toolbar: Search + Sort (1 Line Horizontal on Mobile & Desktop) -->
            <div class="p-3 sm:p-4 border-b border-[var(--border)] flex items-center gap-2.5 sm:gap-3">
                <!-- Search Box -->
                <div class="relative flex-1 min-w-0">
                    <svg class="w-4 h-4 text-[var(--text-3)] absolute left-3 sm:left-3.5 top-1/2 -translate-y-1/2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    <input
                        type="text"
                        bind:value={searchInput}
                        placeholder="Cari kategori..."
                        class="w-full pl-8 sm:pl-9 pr-7 sm:pr-8 py-2 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors truncate"
                    />
                    {#if searchInput}
                        <button
                            type="button"
                            on:click={() => searchInput = ''}
                            class="absolute right-2 sm:right-2.5 top-1/2 -translate-y-1/2 text-xs text-[var(--text-3)] hover:text-[var(--text)] bg-transparent border-0 cursor-pointer p-1"
                        >
                            &times;
                        </button>
                    {/if}
                </div>

                <!-- Sort Selector via CustomSelect -->
                <div class="flex items-center gap-2 flex-shrink-0">
                    <span class="hidden md:inline text-[11px] font-semibold text-[var(--text-3)] whitespace-nowrap">Urutkan:</span>
                    <div class="w-36 sm:w-48">
                        <CustomSelect
                            options={sortOptions}
                            bind:value={sortBy}
                            align="right"
                            fullWidth={true}
                        />
                    </div>
                </div>
            </div>

            <!-- High-Density Categories Table -->
            {#if loading}
                <div class="py-16 text-center">
                    <div class="w-7 h-7 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin mx-auto mb-2.5"></div>
                    <p class="text-xs text-[var(--text-3)] font-medium">Memuat daftar kategori...</p>
                </div>
            {:else if displayedCategories.length === 0}
                <div class="py-16 text-center">
                    <svg class="w-12 h-12 text-[var(--text-3)] mx-auto mb-3 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <p class="text-xs font-bold text-[var(--text)]">Tidak ada kategori yang cocok</p>
                    <p class="text-[11px] text-[var(--text-3)] mt-0.5">Coba sesuaikan kata kunci pencarian atau ganti filter status di atas.</p>
                </div>
            {:else}
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="bg-[var(--surface-2)] text-[var(--text-3)] uppercase tracking-wider font-bold border-b border-[var(--border)] select-none">
                                <th class="py-3.5 px-4 whitespace-nowrap">Kategori</th>
                                <th class="py-3.5 px-4 whitespace-nowrap">Deskripsi</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">Produk</th>
                                <th class="py-3.5 px-4 text-center whitespace-nowrap">Status</th>
                                <th class="py-3.5 px-4 text-right whitespace-nowrap">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)]">
                            {#each paginatedCategories as cat (cat.id)}
                                <tr class="hover:bg-[var(--surface-2)]/60 transition-colors">
                                    <!-- Category Icon & Info -->
                                    <td class="py-3.5 px-4 whitespace-nowrap">
                                        <div class="flex items-center gap-3">
                                            {#if cat.icon && !imgErrorMap[cat.id]}
                                                <img
                                                    src={cat.icon}
                                                    alt={cat.name}
                                                    class="w-9 h-9 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0 shadow-xs"
                                                    on:error={() => imgErrorMap[cat.id] = true}
                                                />
                                            {:else}
                                                <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-500/20 to-indigo-600/20 border border-purple-500/30 flex items-center justify-center text-purple-700 dark:text-purple-300 font-extrabold text-xs flex-shrink-0 shadow-xs">
                                                    {(cat.name || 'K').charAt(0).toUpperCase()}
                                                </div>
                                            {/if}
                                            <div class="min-w-0">
                                                <span class="font-bold text-[var(--text)] text-sm truncate max-w-xs block" title={cat.name}>
                                                    {cat.name}
                                                </span>
                                                <div class="flex items-center gap-2 text-[11px] text-[var(--text-2)] font-mono mt-0.5 whitespace-nowrap">
                                                    <span class="font-semibold">#{cat.slug}</span>
                                                    <span class="text-[var(--text-3)]">&bull;</span>
                                                    <span class="text-[var(--text-3)]">ID: #{cat.id}</span>
                                                </div>
                                            </div>
                                        </div>
                                    </td>

                                    <!-- Description Column -->
                                    <td class="py-3.5 px-4 min-w-[160px]">
                                        {#if cat.description}
                                            <p class="text-xs text-[var(--text)]/85 dark:text-[var(--text-2)] line-clamp-1 max-w-sm" title={cat.description}>
                                                {cat.description}
                                            </p>
                                        {:else}
                                            <span class="text-xs text-[var(--text-3)] italic">Tidak ada deskripsi</span>
                                        {/if}
                                    </td>

                                    <!-- Products Count Badge (Clickable: Filters Products in Catalog) -->
                                    <td class="py-3.5 px-4 text-center whitespace-nowrap">
                                        <button
                                            type="button"
                                            on:click={() => navigateToCategoryProducts(cat)}
                                            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-extrabold whitespace-nowrap flex-nowrap cursor-pointer transition-all hover:scale-105 active:scale-95 {cat.products_count > 0 ? 'bg-purple-500/15 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30 hover:bg-purple-500/25 shadow-2xs' : 'bg-[var(--surface-2)] text-[var(--text-3)] border border-[var(--border)] hover:text-[var(--text)]'}"
                                            title="Lihat {cat.products_count} produk dalam kategori {cat.name} di Katalog"
                                        >
                                            <svg class="w-3 h-3 text-purple-600 dark:text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                                            </svg>
                                            <span class="whitespace-nowrap">{cat.products_count} Produk</span>
                                            <svg class="w-2.5 h-2.5 text-purple-600 dark:text-purple-400 opacity-60 ml-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 5l7 7-7 7" />
                                            </svg>
                                        </button>
                                    </td>

                                    <!-- Status Toggle with Tactile Animation & Spinner -->
                                    <td class="py-3.5 px-4 text-center whitespace-nowrap">
                                        <button
                                            type="button"
                                            disabled={togglingId === cat.id}
                                            on:click={() => handleToggleStatus(cat)}
                                            class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold whitespace-nowrap flex-nowrap transition-all duration-200 cursor-pointer shadow-2xs select-none active:scale-95 disabled:opacity-60 disabled:cursor-wait {cat.is_active ? 'bg-emerald-500/15 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/25' : 'bg-rose-500/15 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/30 hover:bg-rose-500/25'}"
                                            title="Klik untuk {cat.is_active ? 'nonaktifkan' : 'aktifkan'} kategori di katalog"
                                        >
                                            {#if togglingId === cat.id}
                                                <span class="w-2 h-2 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                                            {:else if cat.is_active}
                                                <span class="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-xs"></span>
                                            {:else}
                                                <span class="w-1.5 h-1.5 rounded-full bg-rose-500 shadow-xs"></span>
                                            {/if}
                                            <span class="whitespace-nowrap">{cat.is_active ? 'Aktif' : 'Nonaktif'}</span>
                                        </button>
                                    </td>

                                    <!-- Modern Actions Group with Clear Identifiers -->
                                    <td class="py-3.5 px-4 text-right whitespace-nowrap">
                                        <div class="flex items-center justify-end gap-1.5 whitespace-nowrap flex-nowrap">
                                            <button
                                                type="button"
                                                title="Edit Kategori"
                                                on:click={() => openEditModal(cat)}
                                                class="px-2.5 py-1.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--brand)] hover:text-white hover:border-[var(--brand)] inline-flex items-center gap-1.5 transition-all shadow-2xs cursor-pointer font-semibold"
                                            >
                                                <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                                </svg>
                                                <span>Edit</span>
                                            </button>
                                            <button
                                                type="button"
                                                title="Hapus Kategori"
                                                on:click={() => confirmDeleteCategory(cat)}
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

                <!-- Footer Pagination & Counter Bar -->
                <div class="p-4 border-t border-[var(--border)] bg-[var(--surface-2)]/40 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[var(--text-3)]">
                    <div class="flex items-center gap-3 flex-wrap">
                        <div>
                            Halaman <strong class="text-[var(--text)]">{currentPage}</strong> dari <strong class="text-[var(--text)]">{totalPages}</strong>
                            ({displayedCategories.length} kategori)
                        </div>
                        <div class="flex items-center gap-1.5">
                            <CustomSelect
                                options={pageSizeOptions}
                                bind:value={pageSize}
                            />
                        </div>
                        <span class="hidden lg:inline text-[var(--border)]">•</span>
                        <span class="hidden lg:inline font-medium">
                            Total {categoriesData?.stats?.total_products_categorized || 0} produk dalam kategori
                        </span>
                    </div>

                    {#if totalPages > 1}
                        <div class="flex items-center justify-center gap-1 self-center sm:self-auto flex-wrap">
                            <!-- Prev Button (Arrow Icon Only) -->
                            <button
                                type="button"
                                on:click={() => currentPage--}
                                disabled={currentPage <= 1}
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
                                {#each Array.from({ length: totalPages }, (_, i) => i + 1) as p}
                                    {#if p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)}
                                        <button
                                            type="button"
                                            on:click={() => currentPage = p}
                                            class="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center {p === currentPage ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border-0' : 'bg-white dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-[var(--border)] dark:border-slate-700 shadow-2xs'}"
                                        >
                                            {p}
                                        </button>
                                    {:else if p === currentPage - 2 || p === currentPage + 2}
                                        <span class="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-3)] dark:text-slate-500 font-bold select-none">...</span>
                                    {/if}
                                {/each}
                            </div>

                            <!-- Next Button (Arrow Icon Only) -->
                            <button
                                type="button"
                                on:click={() => currentPage++}
                                disabled={currentPage >= totalPages}
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

<!-- Modal Add / Edit Category -->
{#if categoryModalOpen}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div class="w-full max-w-lg rounded-3xl bg-white dark:bg-[#101827] border border-[var(--border)] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] text-[var(--text)]">
            <!-- Modal Header -->
            <div class="p-5 border-b border-[var(--border)] bg-[var(--surface-2)]/60 flex items-center justify-between">
                <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-2xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-bold flex-shrink-0">
                        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-[var(--text)]">
                            {isEditing ? 'Edit Kategori Software' : 'Tambah Kategori Baru'}
                        </h3>
                        <p class="text-xs text-[var(--text-3)] mt-0.5">Kelola identitas, icon visual, dan relasi katalog.</p>
                    </div>
                </div>
                <button
                    type="button"
                    on:click={closeCategoryModal}
                    class="w-8 h-8 rounded-xl flex items-center justify-center text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--surface-2)] transition-colors cursor-pointer bg-transparent border-0 text-xl font-bold"
                >
                    &times;
                </button>
            </div>

            <!-- Modal Form Body -->
            <form on:submit|preventDefault={handleSaveCategory} class="flex flex-col flex-1 overflow-hidden">
                <div class="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[calc(90vh-140px)]">
                    <!-- Nama Kategori -->
                    <div>
                        <label for="catNameInput" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                            Nama Kategori <span class="text-red-400">*</span>
                        </label>
                        <input
                            id="catNameInput"
                            type="text"
                            bind:value={formName}
                            on:input={handleNameInput}
                            placeholder="Contoh: E-Commerce Bots, Scraping Tools"
                            class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] focus:ring-2 focus:ring-[var(--brand)]/20 transition-all font-medium"
                            required
                        />
                    </div>

                    <!-- Slug Kategori -->
                    <div>
                        <label for="catSlugInput" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                            Slug (URL Identifier)
                        </label>
                        <div class="relative">
                            <span class="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono text-[var(--text-3)]">#</span>
                            <input
                                id="catSlugInput"
                                type="text"
                                bind:value={formSlug}
                                on:input={() => isSlugManual = true}
                                placeholder="ecommerce-bots"
                                class="w-full pl-8 pr-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm font-mono text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                            />
                        </div>
                    </div>

                    <!-- Icon / Logo Kategori -->
                    <div>
                        <span class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                            Icon / Logo Kategori
                        </span>
                        <div class="flex flex-col sm:flex-row items-start sm:items-center gap-3.5 p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                            <!-- Preview Box -->
                            <div class="w-14 h-14 rounded-xl border border-[var(--border)] bg-white dark:bg-[#101827] flex items-center justify-center overflow-hidden flex-shrink-0 shadow-inner">
                                {#if formIcon}
                                    <img src={formIcon} alt="Preview Icon" class="w-full h-full object-cover" />
                                {:else}
                                    <div class="text-purple-700 dark:text-purple-300 font-extrabold text-lg">
                                        {formName ? formName.charAt(0).toUpperCase() : '🏷️'}
                                    </div>
                                {/if}
                            </div>

                            <!-- Upload Actions & URL Input -->
                            <div class="flex-1 w-full space-y-2">
                                <div class="flex items-center gap-2">
                                    <input
                                        type="file"
                                        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
                                        class="hidden"
                                        bind:this={fileInputRef}
                                        on:change={handleIconFileUpload}
                                    />
                                    <button
                                        type="button"
                                        class="px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all cursor-pointer shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 border-0"
                                        disabled={isUploadingIcon}
                                        on:click={() => fileInputRef?.click()}
                                    >
                                        {#if isUploadingIcon}
                                            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                            <span>Mengunggah...</span>
                                        {:else}
                                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                                            </svg>
                                            <span>Pilih File Icon</span>
                                        {/if}
                                    </button>

                                    {#if formIcon}
                                        <button
                                            type="button"
                                            class="px-2.5 py-1.5 rounded-xl text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-all cursor-pointer"
                                            on:click={() => formIcon = ''}
                                        >
                                            Hapus Icon
                                        </button>
                                    {/if}
                                </div>

                                <input
                                    id="catIconInput"
                                    type="text"
                                    bind:value={formIcon}
                                    placeholder="Atau tempel URL icon: https://... /uploads/..."
                                    class="w-full px-3 py-1.5 rounded-xl bg-white dark:bg-[#101827] border border-[var(--border)] text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors"
                                />
                            </div>
                        </div>
                    </div>

                    <!-- Deskripsi Kategori -->
                    <div>
                        <label for="catDescInput" class="block text-xs font-bold text-[var(--text-2)] uppercase tracking-wider mb-1.5">
                            Deskripsi Singkat Kategori
                        </label>
                        <textarea
                            id="catDescInput"
                            bind:value={formDescription}
                            rows="3"
                            placeholder="Deskripsi fungsi atau lingkup tools dalam kategori ini..."
                            class="w-full px-4 py-2.5 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs sm:text-sm text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)] transition-colors resize-none"
                        ></textarea>
                    </div>

                    <!-- Status Aktif with CustomCheckbox -->
                    <div class="p-3.5 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)]">
                        <CustomCheckbox
                            bind:checked={formIsActive}
                            label="Kategori Aktif & Tersedia di Katalog"
                            description="Kategori ini dapat dipilih pada software produk dan muncul di filter katalog"
                            color="emerald"
                        />
                    </div>
                </div>

                <!-- Modal Footer -->
                <div class="p-4 sm:p-5 border-t border-[var(--border)] bg-[var(--surface-2)]/60 flex items-center justify-end gap-2.5">
                    <button
                        type="button"
                        class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-3)] transition-all cursor-pointer"
                        on:click={closeCategoryModal}
                        disabled={isSaving}
                    >
                        Batal
                    </button>
                    <button
                        type="submit"
                        class="px-5 py-2.5 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white transition-all shadow-md shadow-blue-500/20 cursor-pointer border-0 flex items-center gap-1.5 disabled:opacity-50"
                        disabled={isSaving}
                    >
                        {#if isSaving}
                            <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                            <span>Menyimpan...</span>
                        {:else}
                            <span>{isEditing ? 'Simpan Perubahan' : 'Tambah Kategori'}</span>
                        {/if}
                    </button>
                </div>
            </form>
        </div>
    </div>
{/if}

<!-- Modal Konfirmasi Hapus Kategori -->
{#if deleteModalOpen && categoryToDelete}
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div class="w-full max-w-md rounded-3xl bg-white dark:bg-[#101827] border border-[var(--border)] shadow-2xl p-6 space-y-4 text-[var(--text)]">
            <!-- Warning Header -->
            <div class="w-12 h-12 rounded-2xl bg-red-500/10 text-red-500 border border-red-500/20 flex items-center justify-center mb-2 flex-shrink-0">
                <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
            </div>

            <div>
                <h3 class="text-base font-bold text-[var(--text)]">Hapus Kategori "{categoryToDelete.name}"?</h3>
                <p class="text-xs text-[var(--text-3)] mt-1.5 leading-relaxed">
                    Kategori ini akan dihapus permanen dari sistem.
                    {#if categoryToDelete.products_count > 0}
                        <span class="flex items-start gap-2.5 mt-2.5 p-3 rounded-2xl bg-amber-500/15 dark:bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-xs font-semibold">
                            <svg class="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>Perhatian: Ada {categoryToDelete.products_count} produk yang saat ini terhubung ke kategori ini. Kategori pada produk tersebut akan di-reset menjadi kosong (Uncategorized).</span>
                        </span>
                    {/if}
                </p>
            </div>

            <div class="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--border)]">
                <button
                    type="button"
                    class="px-4 py-2.5 rounded-xl text-xs font-semibold bg-[var(--surface-2)] border border-[var(--border)] text-[var(--text)] hover:bg-[var(--surface-3)] transition-all cursor-pointer"
                    on:click={closeDeleteModal}
                    disabled={isDeleting}
                >
                    Batal
                </button>
                <button
                    type="button"
                    class="px-5 py-2.5 rounded-xl text-xs font-bold bg-red-600 hover:bg-red-500 text-white shadow-md shadow-red-500/25 transition-all cursor-pointer border-0 flex items-center gap-1.5 disabled:opacity-50"
                    on:click={handleDeleteCategory}
                    disabled={isDeleting}
                >
                    {#if isDeleting}
                        <span class="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                        <span>Menghapus...</span>
                    {:else}
                        <span>Ya, Hapus Kategori</span>
                    {/if}
                </button>
            </div>
        </div>
    </div>
{/if}
