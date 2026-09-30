<script context="module" lang="ts">
    export interface TabItem {
        id: string;
        label: string;
        count?: number;
        color?: 'brand' | 'blue' | 'indigo' | 'purple' | 'emerald' | 'amber' | 'rose' | 'slate';
    }
</script>

<script lang="ts">
    import { createEventDispatcher, onMount, afterUpdate, tick } from 'svelte';

    export let tabs: TabItem[] = [];
    export let activeTab: string = '';

    const dispatch = createEventDispatcher<{ change: string; tabChange: string }>();

    let containerRef: HTMLDivElement;
    let tabElements: Record<string, HTMLButtonElement> = {};
    let pillStyle = { left: 0, width: 0 };
    let initialized = false;
    let resizeObserver: ResizeObserver | null = null;

    $: activeItem = tabs.find(t => t.id === activeTab) || tabs[0];

    const colorMap: Record<string, string> = {
        brand: 'bg-gradient-to-r from-blue-600 to-indigo-600 shadow-md shadow-blue-500/30 border border-blue-400/30',
        blue: 'bg-blue-600 shadow-md shadow-blue-500/30',
        indigo: 'bg-indigo-600 shadow-md shadow-indigo-500/30',
        purple: 'bg-purple-600 shadow-md shadow-purple-500/30',
        emerald: 'bg-emerald-600 shadow-md shadow-emerald-500/30',
        amber: 'bg-amber-600 shadow-md shadow-amber-500/30',
        rose: 'bg-rose-600 shadow-md shadow-rose-500/30',
        slate: 'bg-slate-700 shadow-md shadow-slate-500/30'
    };

    $: activeColorClass = (activeItem?.color && colorMap[activeItem.color]) || colorMap.brand;

    function syncPill() {
        if (!containerRef) return;
        const targetId = activeTab || (tabs[0] && tabs[0].id);
        const activeEl = tabElements[targetId];
        if (activeEl) {
            const left = activeEl.offsetLeft;
            const width = activeEl.offsetWidth;
            if (width > 0 && (pillStyle.left !== left || pillStyle.width !== width)) {
                pillStyle = { left, width };
                initialized = true;
            }
        }
    }

    // Reactively sync whenever activeTab or tabs content changes
    $: if (activeTab || tabs) {
        tick().then(() => {
            syncPill();
            requestAnimationFrame(syncPill);
        });
    }

    afterUpdate(() => {
        syncPill();
    });

    onMount(() => {
        syncPill();
        requestAnimationFrame(() => {
            syncPill();
            // Second frame for webfont layout stabilization
            requestAnimationFrame(syncPill);
        });

        if (typeof ResizeObserver !== 'undefined' && containerRef) {
            resizeObserver = new ResizeObserver(() => {
                syncPill();
            });
            resizeObserver.observe(containerRef);
            Object.values(tabElements).forEach(el => {
                if (el) resizeObserver?.observe(el);
            });
        }

        if (document.fonts) {
            document.fonts.ready.then(() => {
                syncPill();
            });
        }

        window.addEventListener('resize', syncPill);

        return () => {
            window.removeEventListener('resize', syncPill);
            resizeObserver?.disconnect();
        };
    });

    function selectTab(id: string) {
        activeTab = id;
        dispatch('change', activeTab);
        dispatch('tabChange', activeTab);
        tick().then(syncPill);
    }
</script>

<div
    bind:this={containerRef}
    class="relative inline-flex items-center p-1 rounded-2xl bg-[var(--surface-2)] border border-[var(--border)] text-xs font-semibold overflow-x-auto no-scrollbar gap-1 max-w-full select-none"
    role="tablist"
>
    <!-- Framer Motion Style Smooth Sliding Pill Backdrop -->
    {#if initialized && pillStyle.width > 0}
        <div
            class="absolute top-1 bottom-1 rounded-xl transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] {activeColorClass}"
            style="left: {pillStyle.left}px; width: {pillStyle.width}px;"
        ></div>
    {/if}

    {#each tabs as tab (tab.id)}
        {@const isActive = tab.id === activeTab}
        <button
            type="button"
            role="tab"
            aria-selected={isActive}
            bind:this={tabElements[tab.id]}
            on:click={() => selectTab(tab.id)}
            class="relative z-10 px-2.5 sm:px-3.5 py-1.5 rounded-xl transition-colors duration-200 cursor-pointer flex-shrink-0 whitespace-nowrap flex items-center gap-1.5 border-0 bg-transparent text-[11px] sm:text-xs {isActive ? 'text-white font-bold' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white font-semibold'}"
        >
            <span>{tab.label}</span>
            {#if tab.count !== undefined}
                <span
                    class="px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-colors duration-200 {isActive ? 'bg-white/25 text-white border border-white/20' : 'bg-slate-200/90 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300/80 dark:border-slate-700'}"
                >
                    {tab.count}
                </span>
            {/if}
        </button>
    {/each}
</div>
