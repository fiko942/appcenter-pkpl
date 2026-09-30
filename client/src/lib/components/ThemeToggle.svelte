<script lang="ts">
    import { theme, toggleTheme } from '../stores/theme';

    $: isDark = $theme === 'dark';
</script>

<button
    type="button"
    class="theme-toggle-pill {isDark ? 'is-dark' : 'is-light'}"
    on:click={toggleTheme}
    role="switch"
    aria-checked={isDark}
    aria-label="Ganti mode tampilan terang atau gelap"
    title={isDark ? "Mode Gelap aktif (Klik untuk beralih ke Mode Terang)" : "Mode Terang aktif (Klik untuk beralih ke Mode Gelap)"}
>
    <!-- Background Track Icons -->
    <span class="track-icon sun-track {isDark ? 'inactive' : 'active-hidden'}" aria-hidden="true">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
    </span>
    
    <span class="track-icon moon-track {!isDark ? 'inactive' : 'active-hidden'}" aria-hidden="true">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
    </span>

    <!-- Sliding Active Thumb -->
    <span class="toggle-thumb" aria-hidden="true">
        {#if !isDark}
            <svg class="thumb-icon sun-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
        {:else}
            <svg class="thumb-icon moon-icon" fill="currentColor" viewBox="0 0 24 24">
                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
        {/if}
    </span>
</button>

<style>
    .theme-toggle-pill {
        position: relative;
        display: inline-flex;
        align-items: center;
        justify-content: space-between;
        width: 62px;
        height: 32px;
        padding: 3px;
        border-radius: 9999px;
        background: var(--surface-2, rgba(255, 255, 255, 0.08));
        border: 1.5px solid var(--border, rgba(255, 255, 255, 0.15));
        cursor: pointer;
        outline: none;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15);
        user-select: none;
        -webkit-tap-highlight-color: transparent;
    }

    .theme-toggle-pill:hover {
        border-color: var(--brand, #3b82f6);
        box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.15), 0 0 10px rgba(59, 130, 246, 0.3);
    }

    .theme-toggle-pill:active {
        transform: scale(0.96);
    }

    .track-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        z-index: 1;
        pointer-events: none;
        transition: opacity 0.25s ease, transform 0.25s ease, color 0.25s ease;
    }

    .track-icon svg {
        width: 14px;
        height: 14px;
    }

    .sun-track.inactive {
        color: #94a3b8;
        opacity: 0.4;
    }

    .moon-track.inactive {
        color: #94a3b8;
        opacity: 0.4;
    }

    .active-hidden {
        opacity: 0;
        visibility: hidden;
    }

    /* Thumb Styling */
    .toggle-thumb {
        position: absolute;
        top: 2.5px;
        left: 2.5px;
        width: 25px;
        height: 25px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2;
        transition: transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.25s ease, box-shadow 0.25s ease;
    }

    /* Light Mode Active Thumb */
    .theme-toggle-pill:not(.is-dark) .toggle-thumb {
        transform: translateX(0);
        background: #ffffff;
        box-shadow: 0 2px 8px rgba(245, 158, 11, 0.3), 0 1px 3px rgba(0, 0, 0, 0.15);
        border: 1px solid rgba(245, 158, 11, 0.25);
    }

    /* Dark Mode Active Thumb */
    .is-dark .toggle-thumb {
        transform: translateX(30px);
        background: linear-gradient(135deg, #3b82f6, #6366f1);
        box-shadow: 0 2px 8px rgba(59, 130, 246, 0.45), 0 0 12px rgba(99, 102, 241, 0.4);
        border: 1px solid rgba(255, 255, 255, 0.2);
    }

    .thumb-icon {
        width: 13.5px;
        height: 13.5px;
        animation: popIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    .sun-icon {
        color: #d97706;
    }

    .moon-icon {
        color: #ffffff;
    }

    @keyframes popIn {
        0% {
            transform: scale(0.5) rotate(-45deg);
            opacity: 0;
        }
        100% {
            transform: scale(1) rotate(0deg);
            opacity: 1;
        }
    }
</style>
