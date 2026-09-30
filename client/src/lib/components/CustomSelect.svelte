<script context="module" lang="ts">
    export interface OptionItem {
        value: number | string;
        label: string;
        description?: string;
        warning?: boolean;
        icon?: string;
    }
</script>

<script lang="ts">
    import { createEventDispatcher, onMount, tick } from 'svelte';

    export let options: OptionItem[] = [];
    export let value: number | string = 10;
    export let prefix: string = '';
    export let fullWidth: boolean = false;
    export let align: 'left' | 'right' | 'auto' = 'auto';

    let open: boolean = false;
    let dropdownRef: HTMLDivElement;
    let optionElements: Record<string | number, HTMLButtonElement> = {};
    let hoveredValue: number | string | null = null;
    let pillTop = 0;
    let pillHeight = 0;
    let pillOpacity = 0;

    let openUpward: boolean = false;
    let alignLeft: boolean = false;

    const dispatch = createEventDispatcher<{ change: number | string }>();

    $: selectedOption = options.find(o => o.value === value) || options[0];

    function toggle() {
        open = !open;
        if (open) {
            hoveredValue = null;
            tick().then(() => {
                syncPill(value);
                if (dropdownRef) {
                    const rect = dropdownRef.getBoundingClientRect();
                    const spaceBelow = window.innerHeight - rect.bottom;
                    const spaceAbove = rect.top;
                    // Only open upward if space below is tightly constrained and space above is significantly larger
                    const estimatedMenuHeight = Math.min(220, (options.length || 1) * 38 + 20);
                    if (spaceBelow < estimatedMenuHeight && spaceAbove > spaceBelow) {
                        openUpward = true;
                    } else {
                        openUpward = false;
                    }

                    if (align === 'left') {
                        alignLeft = true;
                    } else if (align === 'right') {
                        alignLeft = false;
                    } else {
                        // Auto: If trigger is in the left half of the viewport or close to left edge, open left-aligned
                        alignLeft = rect.left < 180 || rect.left < (window.innerWidth - rect.right);
                    }
                }
            });
        }
    }

    function select(opt: OptionItem) {
        value = opt.value;
        open = false;
        dispatch('change', value);
    }

    function syncPill(targetVal: number | string | null) {
        const val = targetVal !== null && targetVal !== undefined ? targetVal : value;
        const el = optionElements[val];
        if (el) {
            pillTop = el.offsetTop;
            pillHeight = el.offsetHeight;
            pillOpacity = 1;
        } else {
            pillOpacity = 0;
        }
    }

    function handleMouseEnter(optVal: number | string) {
        hoveredValue = optVal;
        syncPill(optVal);
    }

    function handleMouseLeave() {
        hoveredValue = null;
        syncPill(value);
    }

    function handleClickOutside(e: MouseEvent) {
        if (dropdownRef && !dropdownRef.contains(e.target as Node)) {
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

<div class="custom-select-root relative {fullWidth ? 'w-full block' : 'inline-block'} text-left" bind:this={dropdownRef}>
    <button
        type="button"
        class="{fullWidth ? 'w-full flex justify-between px-3 py-2 rounded-xl bg-[var(--surface-2)] border border-[var(--border)] text-xs' : 'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-xs'} hover:border-[var(--brand)]/60 font-semibold text-[var(--text)] transition-colors duration-150 cursor-pointer shadow-xs active:scale-[0.98] select-none group"
        on:click={toggle}
        aria-haspopup="listbox"
        aria-expanded={open}
    >
        <div class="flex items-center gap-2 truncate">
            {#if prefix}
                <span class="text-[var(--text-3)] font-normal">{prefix}</span>
            {/if}
            {#if selectedOption && selectedOption.icon}
                <div class="h-4.5 px-1 py-0.5 rounded bg-white border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-center flex-shrink-0">
                    <img src="{selectedOption.icon}" alt="{selectedOption.label}" class="h-2.5 w-auto max-w-[28px] object-contain" />
                </div>
            {/if}
            <span class="truncate">{selectedOption ? selectedOption.label : value}</span>
        </div>
        <div class="flex items-center gap-1.5 flex-shrink-0">
            {#if selectedOption && selectedOption.warning}
                <svg class="w-3.5 h-3.5 text-amber-500 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
            {/if}
            <svg
                class="w-3.5 h-3.5 text-[var(--text-3)] transition-transform duration-200 ease-out {open ? 'rotate-180 text-[var(--brand)]' : 'group-hover:text-[var(--text)]'}"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
            >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </button>

    {#if open}
        <div
            class="dropdown-menu-list absolute {fullWidth ? 'left-0 right-0' : alignLeft ? 'left-0' : 'right-0'} {openUpward ? 'bottom-full mb-1.5' : 'top-full mt-1.5'} z-50 min-w-full w-max max-w-xs max-h-72 overflow-y-auto p-1.5 bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] rounded-2xl shadow-2xl backdrop-blur-xl animate-dropdown space-y-1 select-none whitespace-nowrap"
            role="listbox"
            tabindex="-1"
            on:mouseleave={handleMouseLeave}
        >
            <!-- Framer-Motion Style Smooth Sliding Pill Backdrop -->
            {#if pillHeight > 0}
                <div
                    class="sliding-pill-indicator absolute left-1.5 right-1.5 rounded-xl pointer-events-none z-0 {hoveredValue === value || (hoveredValue === null) ? 'bg-blue-600/15 dark:bg-blue-500/20 border border-blue-500/30 shadow-xs' : 'bg-[var(--surface-2)] dark:bg-slate-800/60 border border-[var(--border)] dark:border-slate-700/50 shadow-xs'}"
                    style="top: {pillTop}px; height: {pillHeight}px; opacity: {pillOpacity};"
                ></div>
            {/if}

            {#each options as opt}
                {@const isSelected = opt.value === value}
                {@const isHovered = hoveredValue === opt.value}
                <button
                    type="button"
                    bind:this={optionElements[opt.value]}
                    class="option-pill-btn w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer text-left relative z-10 select-none group border-0 bg-transparent transition-colors duration-150 {isSelected ? 'text-blue-600 dark:text-blue-400 font-bold' : isHovered ? 'text-[var(--text)] dark:text-white' : 'text-[var(--text-2)] dark:text-slate-300'}"
                    on:mouseenter={() => handleMouseEnter(opt.value)}
                    on:click={() => select(opt)}
                    role="option"
                    aria-selected={isSelected}
                >
                    <div class="flex items-center gap-2 truncate">
                        {#if opt.icon}
                            <div class="h-4.5 px-1 py-0.5 rounded bg-white border border-slate-200/80 dark:border-slate-700 shadow-2xs flex items-center justify-center flex-shrink-0">
                                <img src="{opt.icon}" alt="{opt.label}" class="h-2.5 w-auto max-w-[28px] object-contain" />
                            </div>
                        {/if}
                        <span class="truncate">{opt.label}</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-shrink-0 relative z-10">
                        {#if opt.warning}
                            <span class="inline-flex items-center justify-center w-4 h-4 rounded-md bg-amber-500/15 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30" title="Belum diset">
                                <svg class="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            </span>
                        {/if}
                        {#if isSelected}
                            <svg class="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 flex-shrink-0 animate-scale-in" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7" />
                            </svg>
                        {/if}
                    </div>
                </button>
            {/each}
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

    .option-pill-btn:active {
        transform: scale(0.99);
    }
</style>


