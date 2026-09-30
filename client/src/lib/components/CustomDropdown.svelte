<script lang="ts">
    import { createEventDispatcher, onMount, tick } from 'svelte';

    export interface DropdownItem {
        id: number;
        name: string;
        price: number;
        image?: string | null;
        active_users?: number;
        active_users_formatted?: string | null;
        [key: string]: any;
    }

    export let items: DropdownItem[] = [];
    export let selectedId: number = 0;
    export let disabled: boolean = false;
    export let loading: boolean = false;

    let open = false;
    let searchQuery = '';
    let dropdownRef: HTMLDivElement;
    let searchInputRef: HTMLInputElement | null = null;
    let brokenImgMap: Record<number, boolean> = {};

    let itemElements: Record<number, HTMLButtonElement> = {};
    let hoveredId: number | null = null;
    let pillTop = 0;
    let pillHeight = 0;
    let pillOpacity = 0;

    const dispatch = createEventDispatcher<{ change: number }>();

    $: selectedItem = items.find(i => i.id === selectedId) || items[0];

    $: filteredItems = items.filter(item => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        return item.name.toLowerCase().includes(q);
    });

    function formatRupiah(val?: number): string {
        if (!val || val === 0) return 'Gratis';
        return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(val);
    }

    function formatActiveUsers(num?: number | null, formattedStr?: string | null): string {
        if (formattedStr && typeof formattedStr === 'string' && formattedStr.trim()) {
            return formattedStr.trim();
        }
        if (!num || num < 500) return '';
        if (num >= 1000) {
            const k = (num / 1000).toFixed(1).replace(/\.0$/, '');
            return `${k}k+`;
        }
        return `${num}+`;
    }

    function toggleDropdown() {
        if (disabled || loading) return;
        open = !open;
        if (open) {
            searchQuery = '';
            hoveredId = null;
            setTimeout(() => {
                if (searchInputRef) searchInputRef.focus();
                syncPill(selectedId);
            }, 50);
        }
    }

    function selectItem(item: DropdownItem) {
        selectedId = item.id;
        open = false;
        searchQuery = '';
        dispatch('change', selectedId);
    }

    function syncPill(targetId: number | null) {
        const id = targetId !== null && targetId !== undefined ? targetId : selectedId;
        const el = itemElements[id];
        if (el) {
            pillTop = el.offsetTop;
            pillHeight = el.offsetHeight;
            pillOpacity = 1;
        } else {
            pillOpacity = 0;
        }
    }

    function handleMouseEnter(itemId: number) {
        hoveredId = itemId;
        syncPill(itemId);
    }

    function handleMouseLeave() {
        hoveredId = null;
        syncPill(selectedId);
    }

    // Sync pill whenever filteredItems changes
    $: if (open && filteredItems) {
        tick().then(() => {
            syncPill(hoveredId !== null ? hoveredId : selectedId);
        });
    }

    function handleClickOutside(event: MouseEvent) {
        if (dropdownRef && !dropdownRef.contains(event.target as Node)) {
            open = false;
        }
    }

    onMount(() => {
        document.addEventListener('click', handleClickOutside);
        return () => {
            document.removeEventListener('click', handleClickOutside);
        };
    });
</script>

<div class="custom-dropdown-root relative w-full" bind:this={dropdownRef}>
    <!-- Dropdown Trigger Button -->
    <button
        type="button"
        id="product-custom-select"
        class="w-full flex items-center justify-between gap-3 p-3 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] hover:border-[var(--brand)] transition-colors text-left shadow-xs focus:outline-none focus:ring-2 focus:ring-[var(--brand)]/30 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        on:click={toggleDropdown}
        disabled={disabled || loading}
        aria-haspopup="listbox"
        aria-expanded={open}
    >
        {#if loading}
            <div class="flex items-center gap-3 min-w-0 py-0.5">
                <div class="w-9 h-9 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center flex-shrink-0">
                    <div class="w-4 h-4 border-2 border-[var(--brand)] border-t-transparent rounded-full animate-spin"></div>
                </div>
                <div class="min-w-0">
                    <div class="text-xs font-bold text-[var(--text)]">Memuat daftar produk...</div>
                    <div class="text-[10px] text-[var(--text-3)]">Harap tunggu sebentar</div>
                </div>
            </div>
        {:else}
            <div class="flex items-center gap-3 min-w-0">
                {#if selectedItem && selectedItem.image && !brokenImgMap[selectedItem.id]}
                    <img
                        src={selectedItem.image}
                        alt={selectedItem.name}
                        class="w-9 h-9 rounded-xl object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0 shadow-xs"
                        on:error={() => { brokenImgMap[selectedItem.id] = true; brokenImgMap = brokenImgMap; }}
                    />
                {:else}
                    <div class="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-[var(--brand)] font-black text-sm flex-shrink-0">
                        {selectedItem ? selectedItem.name.charAt(0).toUpperCase() : '⚡'}
                    </div>
                {/if}
                <div class="min-w-0">
                    <div class="text-xs font-extrabold text-[var(--text)] truncate">
                        {selectedItem ? selectedItem.name : 'Pilih Produk Software'}
                    </div>
                    {#if selectedItem && (selectedItem.active_users && selectedItem.active_users >= 500)}
                        <div class="text-[10px] text-emerald-400 flex items-center gap-1.5 mt-0.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                            <span>{formatActiveUsers(selectedItem.active_users, selectedItem.active_users_formatted)} Pengguna Aktif</span>
                        </div>
                    {:else if selectedItem && selectedItem.is_active === false}
                        <div class="text-[10px] text-rose-400/90 flex items-center gap-1 mt-0.5">
                            <span class="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            <span>Nonaktif</span>
                        </div>
                    {/if}
                </div>
            </div>

            <div class="flex items-center gap-2.5 flex-shrink-0">
                {#if selectedItem}
                    <span class="text-xs font-bold font-mono text-[var(--brand)] hidden sm:inline">
                        {formatRupiah(selectedItem.price)}
                    </span>
                {/if}
                <div class="w-6 h-6 rounded-lg bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text-3)] transition-transform duration-200 {open ? 'rotate-180 text-[var(--brand)]' : ''}">
                    <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                    </svg>
                </div>
            </div>
        {/if}
    </button>

    <!-- Dropdown Menu Popup with Search & Compact List -->
    {#if open && !disabled && !loading}
        <div
            class="absolute top-full left-0 right-0 mt-2 z-50 p-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl backdrop-blur-xl animate-dropdown overflow-hidden select-none"
        >
            <!-- Search Bar in Dropdown -->
            <div class="p-1.5 border-b border-[var(--border)] mb-1">
                <div class="relative">
                    <input
                        bind:this={searchInputRef}
                        type="text"
                        bind:value={searchQuery}
                        placeholder="Cari produk software..."
                        class="w-full pl-8 pr-3 py-1.5 bg-[var(--surface-2)] border border-[var(--border)] rounded-xl text-xs text-[var(--text)] placeholder-[var(--text-3)] focus:outline-none focus:border-[var(--brand)]"
                        on:click|stopPropagation
                    />
                    <svg class="w-3.5 h-3.5 text-[var(--text-3)] absolute left-2.5 top-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                </div>
            </div>

            <!-- List of Compact Items with Smooth Sliding Pill Indicator -->
            <div
                class="max-h-56 overflow-y-auto space-y-1 pr-0.5 relative"
                role="listbox"
                tabindex="-1"
                on:mouseleave={handleMouseLeave}
            >
                {#if pillHeight > 0}
                    <div
                        class="sliding-pill-indicator absolute left-0.5 right-0.5 rounded-xl pointer-events-none z-0 {hoveredId === selectedId || (hoveredId === null) ? 'bg-[var(--brand-soft)] border border-[var(--brand)]/35 shadow-xs' : 'bg-[var(--surface-2)] border border-[var(--border)] shadow-xs'}"
                        style="top: {pillTop}px; height: {pillHeight}px; opacity: {pillOpacity};"
                    ></div>
                {/if}

                {#if filteredItems.length === 0}
                    <div class="py-6 text-center text-xs text-[var(--text-3)]">
                        Tidak ada software yang cocok
                    </div>
                {:else}
                    {#each filteredItems as item}
                        {@const isSelected = item.id === selectedId}
                        {@const isHovered = hoveredId === item.id}
                        <button
                            type="button"
                            bind:this={itemElements[item.id]}
                            class="dropdown-pill-item w-full flex items-center justify-between p-2 rounded-xl cursor-pointer text-left relative z-10 select-none group border-0 bg-transparent transition-colors duration-150 {isSelected ? 'text-[var(--brand)] font-bold' : isHovered ? 'text-[var(--text)] font-semibold' : 'text-[var(--text-2)]'}"
                            on:mouseenter={() => handleMouseEnter(item.id)}
                            on:click={() => selectItem(item)}
                            role="option"
                            aria-selected={isSelected}
                        >
                            <div class="flex items-center gap-2.5 min-w-0 relative z-10">
                                {#if item.image && !brokenImgMap[item.id]}
                                    <img
                                        src={item.image}
                                        alt={item.name}
                                        class="w-7 h-7 rounded-lg object-cover border border-[var(--border)] bg-[var(--surface-2)] flex-shrink-0 shadow-xs"
                                        on:error={() => { brokenImgMap[item.id] = true; brokenImgMap = brokenImgMap; }}
                                    />
                                {:else}
                                    <div class="w-7 h-7 rounded-lg {isSelected ? 'bg-[var(--brand)] text-white' : 'bg-[var(--surface-2)] text-[var(--text-2)] border border-[var(--border)]'} flex items-center justify-center text-xs font-black flex-shrink-0">
                                        {item.name.charAt(0).toUpperCase()}
                                    </div>
                                {/if}
                                <div class="min-w-0">
                                    <strong class="text-xs font-bold block truncate">{item.name}</strong>
                                    {#if item.active_users && item.active_users >= 500}
                                        <span class="text-[9px] text-emerald-400 font-semibold">{formatActiveUsers(item.active_users, item.active_users_formatted)} Aktif</span>
                                    {:else if item.is_active === false}
                                        <span class="text-[9px] text-rose-400/90 font-semibold">Nonaktif</span>
                                    {/if}
                                </div>
                            </div>

                            <div class="flex items-center gap-2 flex-shrink-0 relative z-10">
                                <span class="text-xs font-bold font-mono text-[var(--brand)]">
                                    {formatRupiah(item.price)}
                                </span>
                                {#if isSelected}
                                    <svg class="w-3.5 h-3.5 text-[var(--brand)] animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                                    </svg>
                                {/if}
                            </div>
                        </button>
                    {/each}
                {/if}
            </div>
        </div>
    {/if}
</div>

<style>
    @keyframes dropInSpring {
        0% {
            opacity: 0;
            transform: translateY(-6px) scale(0.98);
        }
        100% {
            opacity: 1;
            transform: translateY(0) scale(1);
        }
    }

    @keyframes scaleInCheck {
        0% {
            opacity: 0;
            transform: scale(0.6);
        }
        100% {
            opacity: 1;
            transform: scale(1);
        }
    }

    .animate-dropdown {
        animation: dropInSpring 0.16s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        transform-origin: top center;
    }

    .animate-scale-in {
        animation: scaleInCheck 0.16s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
    }

    .sliding-pill-indicator {
        transition: top 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                    height 0.2s cubic-bezier(0.16, 1, 0.3, 1),
                    opacity 0.15s ease,
                    background-color 0.15s ease,
                    border-color 0.15s ease;
    }

    .dropdown-pill-item:active {
        transform: scale(0.99);
    }
</style>
