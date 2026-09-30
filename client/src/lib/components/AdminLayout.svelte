<script lang="ts">
    import AdminSidebar from './AdminSidebar.svelte';
    import Topbar from './Topbar.svelte';

    export let activePage: string = 'dashboard';
    export let eyebrow: string = 'PANEL ADMIN ZIQVA';
    export let adminName: string = 'Admin';

    let mobileOpen: boolean = false;
</script>

<div class="min-h-screen flex bg-[var(--page)] text-[var(--text)] transition-colors">
    <!-- Admin Sidebar Navigation -->
    <AdminSidebar {activePage} {adminName} bind:mobileOpen />

    <!-- Main Inset Content Area -->
    <div class="site-main flex-1 md:pl-64 flex flex-col min-w-0">
        <Topbar {eyebrow} showHelp={false} on:toggleSidebar={() => (mobileOpen = !mobileOpen)} />
        
        <slot />
    </div>
</div>
