# Plan: Add Tabs to Admin Settings

**Goal:** Refactor `client/src/lib/pages/AdminSettings.svelte` to use a tabbed interface.
- Tab 1: Database (Backup & Maintenance)
- Tab 2: Payment Gateway (GoQRIS Configuration)

**Steps:**
- [ ] Read `client/src/lib/pages/AdminSettings.svelte` to understand its current structure.
- [ ] Introduce a `activeTab` state variable (default 'database').
- [ ] Create a tab navigation header just below the page title or replacing the page title area.
- [ ] Wrap the Database Backup sections in `{#if activeTab === 'database'} ... {/if}`.
- [ ] Wrap the Payment Gateway section in `{#if activeTab === 'payment'} ... {/if}`.
- [ ] Verify functionality and styling (make tabs look clean and modern).
- [ ] Build and commit.
