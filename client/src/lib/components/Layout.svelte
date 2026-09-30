<script lang="ts">
    import Sidebar from './Sidebar.svelte';
    import Topbar from './Topbar.svelte';

    export let activePage: string = 'dashboard';
    export let eyebrow: string = 'ZIQVA DIGITAL MARKETPLACE';

    let mobileOpen: boolean = false;
</script>

<div class="min-h-screen flex">
    <!-- Sidebar Navigation -->
    <Sidebar {activePage} bind:mobileOpen />

    <!-- Main Inset Content Area -->
    <div class="site-main flex-1 md:pl-64 flex flex-col min-w-0">
        <Topbar {eyebrow} on:toggleSidebar={() => mobileOpen = !mobileOpen} />
        
        <slot />
    </div>
</div>
