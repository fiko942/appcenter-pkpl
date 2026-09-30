<script lang="ts">
    import { createEventDispatcher } from 'svelte';

    export let checked: boolean = false;
    export let label: string = '';
    export let description: string = '';
    export let disabled: boolean = false;
    export let color: 'brand' | 'blue' | 'purple' | 'emerald' | 'amber' | 'rose' | 'indigo' = 'brand';
    export let align: 'center' | 'start' = 'start';
    export let size: 'sm' | 'md' = 'md';

    const dispatch = createEventDispatcher<{ change: boolean }>();

    function toggle(e?: MouseEvent) {
        if (disabled) return;
        // Don't toggle if the user clicked on an interactive link or button inside slot
        if (e && (e.target as HTMLElement)?.closest('a, button, input, [data-no-toggle]')) {
            return;
        }
        checked = !checked;
        dispatch('change', checked);
    }

    function handleKeyDown(e: KeyboardEvent) {
        if (disabled) return;
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggle();
        }
    }

    $: activeColorClass = {
        brand: 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500',
        blue: 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500',
        purple: 'bg-purple-600 border-purple-600 dark:bg-purple-500 dark:border-purple-500',
        emerald: 'bg-emerald-600 border-emerald-600 dark:bg-emerald-500 dark:border-emerald-500',
        amber: 'bg-amber-500 border-amber-500 dark:bg-amber-400 dark:border-amber-400',
        rose: 'bg-rose-600 border-rose-600 dark:bg-rose-500 dark:border-rose-500',
        indigo: 'bg-indigo-600 border-indigo-600 dark:bg-indigo-500 dark:border-indigo-500'
    }[color] || 'bg-blue-600 border-blue-600 dark:bg-blue-500 dark:border-blue-500';

    $: boxDimensions = size === 'sm' ? 'w-4 h-4 rounded-[4px]' : 'w-[18px] h-[18px] rounded-[5px]';
    $: iconDimensions = size === 'sm' ? 'w-3 h-3' : 'w-3.5 h-3.5';
    $: alignClass = align === 'center' ? 'items-center' : 'items-start';
</script>

<div
    role="checkbox"
    aria-checked={checked}
    aria-disabled={disabled}
    tabindex={disabled ? -1 : 0}
    on:click={toggle}
    on:keydown={handleKeyDown}
    class="inline-flex {alignClass} gap-2.5 select-none cursor-pointer group active:scale-[0.98] transition-transform duration-100 {disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''}"
>
    <!-- Crisp Handcrafted Box -->
    <div
        class="{boxDimensions} mt-[1px] flex items-center justify-center flex-shrink-0 border transition-all duration-150 relative {checked ? `${activeColorClass} shadow-xs checkbox-pop` : 'bg-white dark:bg-[#0b1322] border-slate-300 dark:border-slate-700/80 shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.05)] dark:shadow-[inset_0_1px_1.5px_rgba(0,0,0,0.3)] group-hover:border-slate-400 dark:group-hover:border-slate-500 group-hover:bg-slate-50 dark:group-hover:bg-[#111c30]'}"
    >
        <svg
            viewBox="0 0 14 14"
            class="{iconDimensions} fill-none stroke-white"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
        >
            <path
                class="checkmark-path {checked ? 'drawn' : ''}"
                d="M2.75 7.25L5.5 10L11.25 4"
            />
        </svg>
    </div>

    {#if label || $$slots.default}
        <div class="flex flex-col text-left flex-1 min-w-0">
            <span class="text-xs text-[var(--text-2)] leading-normal font-normal">
                {#if label}
                    {label}
                {:else}
                    <slot />
                {/if}
            </span>
            {#if description}
                <span class="text-[11px] text-[var(--text-3)] mt-0.5 leading-snug">{description}</span>
            {/if}
        </div>
    {/if}
</div>

<style>
    .checkmark-path {
        stroke-dasharray: 16;
        stroke-dashoffset: 16;
        transition: stroke-dashoffset 0.18s cubic-bezier(0.16, 1, 0.3, 1);
    }
    .checkmark-path.drawn {
        stroke-dashoffset: 0;
    }
    .checkbox-pop {
        animation: checkmarkPop 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    @keyframes checkmarkPop {
        0% {
            transform: scale(0.9);
        }
        50% {
            transform: scale(1.08);
        }
        100% {
            transform: scale(1);
        }
    }
</style>
