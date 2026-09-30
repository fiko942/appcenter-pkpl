<script lang="ts">
    import { scale } from 'svelte/transition';

    export let text: string = '';
    export let position: 'top' | 'bottom' | 'left' | 'right' = 'top';
    export let delay: number = 60;
    export let disabled: boolean = false;

    let visible: boolean = false;
    let timer: any = null;

    function handleMouseEnter() {
        if (disabled || !text) return;
        if (delay > 0) {
            timer = setTimeout(() => {
                visible = true;
            }, delay);
        } else {
            visible = true;
        }
    }

    function handleMouseLeave() {
        if (timer) clearTimeout(timer);
        visible = false;
    }
</script>

<div
    class="relative inline-flex items-center"
    role="none"
    on:mouseenter={handleMouseEnter}
    on:mouseleave={handleMouseLeave}
    on:focusin={handleMouseEnter}
    on:focusout={handleMouseLeave}
>
    <slot />

    {#if visible && text}
        <div
            role="tooltip"
            transition:scale={{ duration: 120, start: 0.9 }}
            class="absolute z-50 pointer-events-none whitespace-nowrap px-2.5 py-1 text-[11px] font-semibold text-white bg-slate-900 dark:bg-[#182338] dark:text-slate-100 rounded-lg shadow-xl shadow-black/30 border border-slate-700/60 dark:border-[#2f3f5e]
            {position === 'top' ? 'bottom-full left-1/2 -translate-x-1/2 mb-2' : ''}
            {position === 'bottom' ? 'top-full left-1/2 -translate-x-1/2 mt-2' : ''}
            {position === 'left' ? 'right-full top-1/2 -translate-y-1/2 mr-2' : ''}
            {position === 'right' ? 'left-full top-1/2 -translate-y-1/2 ml-2' : ''}"
        >
            {text}
            <!-- Arrow Pointer -->
            <span
                class="absolute w-1.5 h-1.5 bg-slate-900 dark:bg-[#182338] border-slate-700/60 dark:border-[#2f3f5e] rotate-45
                {position === 'top' ? '-bottom-1 left-1/2 -translate-x-1/2 border-r border-b' : ''}
                {position === 'bottom' ? '-top-1 left-1/2 -translate-x-1/2 border-l border-t' : ''}
                {position === 'left' ? '-right-1 top-1/2 -translate-y-1/2 border-r border-t' : ''}
                {position === 'right' ? '-left-1 top-1/2 -translate-y-1/2 border-l border-b' : ''}"
            ></span>
        </div>
    {/if}
</div>
