<script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import ThemeToggle from './ThemeToggle.svelte';

    export let eyebrow: string = 'ZIQVA DIGITAL MARKETPLACE';
    export let showHelp: boolean = true;

    const dispatch = createEventDispatcher();
</script>

<header class="topbar">
    <div class="flex items-center gap-3">
        <button
            type="button"
            class="md:hidden p-1.5 text-[var(--text-2)] hover:text-[var(--text)] rounded-xl hover:bg-[var(--surface-2)] border border-[var(--border)] transition-colors cursor-pointer"
            aria-label="Buka Menu Navigasi"
            on:click={() => dispatch('toggleSidebar')}
        >
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
        </button>
        <span class="eyebrow">{eyebrow}</span>
    </div>

    <div class="top-actions flex items-center gap-2.5">
        <!-- Enhanced Svelte Animated Theme Toggle -->
        <ThemeToggle />

        <!-- Single Help & Tutorial Icon Button (Member Only) -->
        {#if showHelp}
            <a
                href="#/member/tutorials"
                class="help-icon-link flex items-center justify-center rounded-full bg-[var(--surface)] dark:bg-[#131d31] border border-[var(--border)] dark:border-[#22314d] text-[var(--text-2)] dark:text-slate-300 hover:text-[var(--brand)] dark:hover:text-white hover:border-[var(--brand)] dark:hover:border-blue-500 transition-all shadow-xs"
                title="Pusat Bantuan & Tutorial"
                aria-label="Pusat Bantuan & Tutorial"
            >
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
            </a>
        {/if}
    </div>
</header>

<style>
    .help-icon-link {
        width: 32px;
        height: 32px;
        box-sizing: border-box;
    }
</style>
