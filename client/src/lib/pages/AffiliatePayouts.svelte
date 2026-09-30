<script lang="ts">
    import { onMount } from 'svelte';
    import Layout from '../components/Layout.svelte';
    import CustomSelect, { type OptionItem } from '../components/CustomSelect.svelte';

    interface PayoutRecord {
        id: string;
        created: number;
        amount: number;
        status: 'paid' | 'pending';
        note: string;
    }

    interface PaginationMeta {
        page: number;
        pageSize: number;
        totalPayouts: number;
        totalPages: number;
    }

    let loading = true;
    let payouts: PayoutRecord[] = [];
    let totalPending = 0;
    let pagination: PaginationMeta = { page: 1, pageSize: 10, totalPayouts: 0, totalPages: 1 };
    let sortField = 'created';
    let sortOrder: 'desc' | 'asc' = 'desc';

    const pageSizeOptions: OptionItem[] = [
        { label: '10 / hal', value: 10 },
        { label: '20 / hal', value: 20 },
        { label: '50 / hal', value: 50 },
    ];

    function handlePageSizeChange(e: CustomEvent<string | number>) {
        pagination.pageSize = Number(e.detail);
        pagination.page = 1;
        loadPayouts();
    }

    function formatRupiah(val: number): string {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(val || 0);
    }

    function formatDate(ts: number): string {
        if (!ts || ts <= 0) return '-';
        return new Date(ts * 1000).toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function handleSortChange(sort: string) {
        if (sortField === sort) {
            sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            sortField = sort;
            sortOrder = 'desc';
        }
        pagination.page = 1;
        loadPayouts();
    }

    async function loadPayouts() {
        loading = true;
        try {
            const params = new URLSearchParams({
                page: pagination.page.toString(),
                pageSize: pagination.pageSize.toString(),
                sort: sortField,
                order: sortOrder
            });

            const res = await fetch(`/member/api/affiliate/payouts?${params.toString()}`);
            if (res.status === 401) {
                window.location.hash = '/member/login';
                return;
            }

            const json = await res.json();
            if (json.status === 'success' && json.data) {
                payouts = json.data.payouts || [];
                totalPending = json.data.totalPending || 0;
                pagination = json.data.pagination || { page: 1, pageSize: 10, totalPayouts: 0, totalPages: 1 };
            }
        } catch (err) {
            console.error('Fetch payouts error:', err);
        } finally {
            loading = false;
        }
    }

    function changePage(newPage: number) {
        if (newPage >= 1 && newPage <= pagination.totalPages && newPage !== pagination.page) {
            pagination.page = newPage;
            loadPayouts();
        }
    }

    function getPageNumbers(current: number, total: number): (number | string)[] {
        if (total <= 5) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        if (current <= 3) {
            return [1, 2, 3, 4, '...', total];
        }
        if (current >= total - 2) {
            return [1, '...', total - 3, total - 2, total - 1, total];
        }
        return [1, '...', current - 1, current, current + 1, '...', total];
    }

    $: pageNumbers = getPageNumbers(pagination.page, Math.max(1, pagination.totalPages));

    onMount(() => {
        loadPayouts();
    });
</script>

<svelte:head>
    <title>Riwayat Penarikan Komisi — Ziqva Labs</title>
</svelte:head>

<Layout activePage="affiliate" eyebrow="PROGRAM KEMITRAAN & AFILIASI">
    <main class="flex-1 p-4 sm:p-6 md:p-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6 animate-fade-in pb-12">
        <!-- Page Header Section -->
        <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div class="space-y-1">
                <div class="flex items-center gap-2 text-xs font-semibold text-[var(--text-3)] dark:text-slate-400">
                    <a href="#/member/affiliate" class="hover:text-blue-600 dark:hover:text-blue-400 transition-colors">Mitra Afiliasi</a>
                    <span>/</span>
                    <span class="text-[var(--text)] dark:text-white font-bold">Riwayat Penarikan</span>
                </div>
                <h1 class="text-2xl font-extrabold text-[var(--text)] dark:text-white tracking-tight">
                    Riwayat Penarikan Komisi
                </h1>
                <p class="text-xs sm:text-sm text-[var(--text-3)] dark:text-slate-400 mt-0.5">
                    Pencairan dana komisi afiliasi ditransfer otomatis ke rekening bank Anda setiap akhir bulan hingga tanggal 2.
                </p>
            </div>

            <a
                href="#/member/affiliate"
                class="self-stretch sm:self-auto bg-[var(--surface)] dark:bg-[#101827] hover:bg-slate-100 dark:hover:bg-slate-800 text-[var(--text-2)] dark:text-slate-200 border border-[var(--border)] dark:border-[#22314d] px-4 py-2.5 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-2xs shrink-0 cursor-pointer"
            >
                <svg class="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                <span>Kembali ke Dashboard</span>
            </a>
        </div>

        <!-- Pending Summary Banner -->
        <div class="rounded-2xl sm:rounded-3xl bg-[var(--surface)] dark:bg-[#101827] border border-[var(--border)] dark:border-[#22314d] p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div class="flex items-center gap-3.5 sm:gap-4">
                <div class="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 flex items-center justify-center shrink-0">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                </div>
                <div>
                    <div class="text-xs font-bold text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider">Total Komisi Belum Ditransfer (Pending)</div>
                    <div class="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400 font-mono mt-0.5">{formatRupiah(totalPending)}</div>
                </div>
            </div>
            <div class="text-xs text-[var(--text-3)] dark:text-slate-400 max-w-xs text-left sm:text-right">
                Otomatis dikirim ke rekening bank Anda pada jadwal payout berkala tanpa perlu klaim manual.
            </div>
        </div>

        <!-- Payouts Table Card -->
        <div class="bg-[var(--surface)] dark:bg-[#101827] rounded-2xl sm:rounded-3xl border border-[var(--border)] dark:border-[#22314d] shadow-xs space-y-0 relative">
            <div class="p-4 sm:p-5 border-b border-[var(--border)] dark:border-[#22314d] flex items-center justify-between bg-[var(--surface-2)] dark:bg-[#131d31] rounded-t-2xl sm:rounded-t-3xl relative z-20">
                <div>
                    <h3 class="font-bold text-xs sm:text-sm text-[var(--text)] dark:text-white">Daftar Rekap Penarikan Dana</h3>
                    <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5">Semua riwayat akumulasi komisi berjalan dan transfer payout yang telah diproses.</p>
                </div>
                <div class="text-xs text-[var(--text-3)] dark:text-slate-400">
                    Total: <strong class="text-[var(--text)] dark:text-white font-mono">{pagination.totalPayouts}</strong> riwayat
                </div>
            </div>

            <!-- Desktop View Table -->
            <div class="hidden sm:block overflow-x-auto">
                <table class="w-full text-left text-xs">
                    <thead class="bg-[var(--surface-2)] dark:bg-[#131d31] text-[var(--text-3)] dark:text-slate-400 uppercase tracking-wider font-bold border-b border-[var(--border)] dark:border-[#22314d] select-none text-[11px]">
                        <tr>
                            <th class="py-3 px-5 text-center w-16">No</th>
                            <th
                                class="py-3 px-5 cursor-pointer hover:bg-blue-500/5 transition-colors group"
                                on:click={() => handleSortChange('created')}
                                title="Urutkan Tanggal"
                            >
                                <div class="inline-flex items-center gap-1.5">
                                    <span class={sortField === 'created' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>Tanggal / Periode</span>
                                    <svg class="w-3.5 h-3.5 transition-transform {sortField === 'created' ? 'text-blue-600 dark:text-blue-400 ' + (sortOrder === 'asc' ? 'rotate-180' : '') : 'text-slate-400/40 group-hover:text-slate-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </th>
                            <th
                                class="py-3 px-5 cursor-pointer hover:bg-blue-500/5 transition-colors group"
                                on:click={() => handleSortChange('amount')}
                                title="Urutkan Nominal"
                            >
                                <div class="inline-flex items-center gap-1.5">
                                    <span class={sortField === 'amount' ? 'text-blue-600 dark:text-blue-400 font-bold' : ''}>Jumlah Dana</span>
                                    <svg class="w-3.5 h-3.5 transition-transform {sortField === 'amount' ? 'text-blue-600 dark:text-blue-400 ' + (sortOrder === 'asc' ? 'rotate-180' : '') : 'text-slate-400/40 group-hover:text-slate-400'}" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </th>
                            <th class="py-3 px-5 text-center">Status</th>
                            <th class="py-3 px-5">Keterangan Transfer</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-[var(--border)] dark:divide-[#22314d] text-[var(--text)] dark:text-slate-200">
                        {#if loading}
                            <tr>
                                <td colspan="5" class="py-12 text-center text-[var(--text-3)] dark:text-slate-400">
                                    <div class="flex items-center justify-center gap-2">
                                        <span class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                                        <span>Memuat riwayat penarikan...</span>
                                    </div>
                                </td>
                            </tr>
                        {:else if payouts.length === 0}
                            <tr>
                                <td colspan="5" class="py-12 text-center text-[var(--text-3)] dark:text-slate-400">
                                    <div class="space-y-2">
                                        <svg class="w-8 h-8 mx-auto text-slate-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                                        <p class="text-sm font-bold text-[var(--text)] dark:text-white">Belum ada riwayat penarikan</p>
                                        <p class="text-xs text-[var(--text-3)] dark:text-slate-400">Setiap komisi yang berhasil ditransfer oleh sistem akan dicatat di sini.</p>
                                    </div>
                                </td>
                            </tr>
                        {:else}
                            {#each payouts as item, idx (item.id)}
                                <tr class="transition-colors {idx % 2 === 0 ? 'bg-[var(--surface)] dark:bg-[#101827]' : 'bg-[var(--surface-2)]/40 dark:bg-[#131d31]/50'} hover:bg-blue-500/5">
                                    <td class="py-3.5 px-5 text-center font-bold text-[var(--text-3)] dark:text-slate-400 font-mono text-[11px]">
                                        {(pagination.page - 1) * pagination.pageSize + idx + 1}
                                    </td>
                                    <td class="py-3.5 px-5 font-mono text-[11px]">
                                        <div class="font-medium text-[var(--text)] dark:text-white">{item.id === 'pending-summary' ? '-' : formatDate(item.created)}</div>
                                    </td>
                                    <td class="py-3.5 px-5 font-mono">
                                        <span class="font-bold text-sm {item.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}">
                                            {formatRupiah(item.amount)}
                                        </span>
                                    </td>
                                    <td class="py-3.5 px-5 text-center">
                                        {#if item.status === 'paid'}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                                <svg class="w-3 h-3 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                                                Berhasil Ditransfer
                                            </span>
                                        {:else}
                                            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                                <svg class="w-3 h-3 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                                Akumulasi Berjalan
                                            </span>
                                        {/if}
                                    </td>
                                    <td class="py-3.5 px-5 text-[var(--text-2)] dark:text-slate-300">
                                        {item.note}
                                    </td>
                                </tr>
                            {/each}
                        {/if}
                    </tbody>
                </table>
            </div>

            <!-- Mobile View Distinct Cards -->
            <div class="block sm:hidden p-3.5 space-y-3">
                {#if loading}
                    <div class="py-8 text-center text-xs text-[var(--text-3)] dark:text-slate-400 flex items-center justify-center gap-2">
                        <span class="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></span>
                        <span>Memuat riwayat penarikan...</span>
                    </div>
                {:else if payouts.length === 0}
                    <div class="py-10 text-center text-[var(--text-3)] dark:text-slate-400 space-y-2">
                        <svg class="w-8 h-8 mx-auto text-slate-400/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                        <p class="text-sm font-bold text-[var(--text)] dark:text-white">Belum ada riwayat penarikan</p>
                    </div>
                {:else}
                    {#each payouts as item, idx (item.id)}
                        <div class="p-4 rounded-2xl {idx % 2 === 0 ? 'bg-[var(--surface)] dark:bg-[#101827]' : 'bg-[var(--surface-2)] dark:bg-[#131d31]'} border border-[var(--border)] dark:border-[#22314d] space-y-3 shadow-xs">
                            <div class="flex items-start justify-between gap-2">
                                <div class="min-w-0">
                                    <div class="font-bold text-xs text-[var(--text)] dark:text-white truncate">{item.note}</div>
                                    <div class="text-[10px] text-[var(--text-3)] dark:text-slate-400 font-mono mt-0.5">{item.id === 'pending-summary' ? 'Periode Berjalan (Bulan Ini)' : formatDate(item.created)}</div>
                                </div>
                                <div class="text-right shrink-0">
                                    <div class="font-black text-xs {item.status === 'paid' ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'} font-mono">
                                        {formatRupiah(item.amount)}
                                    </div>
                                </div>
                            </div>
                            <div class="flex items-center justify-between text-xs pt-2.5 border-t border-[var(--border)] dark:border-[#22314d]">
                                <span class="text-[11px] text-[var(--text-3)] dark:text-slate-400 font-mono font-bold">#{(pagination.page - 1) * pagination.pageSize + idx + 1}</span>
                                {#if item.status === 'paid'}
                                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        <svg class="w-2.5 h-2.5 text-emerald-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 13l4 4L19 7"></path></svg>
                                        Berhasil Ditransfer
                                    </span>
                                {:else}
                                    <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                        <svg class="w-2.5 h-2.5 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                                        Akumulasi Berjalan
                                    </span>
                                {/if}
                            </div>
                        </div>
                    {/each}
                {/if}
            </div>

            <!-- Pagination Footer Bar with PageSize Selector -->
            <div class="p-4 border-t border-[var(--border)] dark:border-[#22314d] flex flex-col sm:flex-row gap-3 items-center justify-between text-xs text-[var(--text-3)] dark:text-slate-400 bg-[var(--surface-2)] dark:bg-[#131d31] rounded-b-2xl sm:rounded-b-3xl relative z-20">
                <div class="flex items-center gap-3 flex-wrap justify-center sm:justify-start">
                    <span>Halaman <strong class="text-[var(--text)] dark:text-white font-mono">{pagination.page}</strong> dari <strong class="text-[var(--text)] dark:text-white font-mono">{Math.max(1, pagination.totalPages)}</strong> ({pagination.totalPayouts} total riwayat)</span>
                    <div class="flex items-center gap-1.5">
                        <CustomSelect
                            options={pageSizeOptions}
                            value={pagination.pageSize}
                            prefix="Tampilkan:"
                            on:change={handlePageSizeChange}
                        />
                    </div>
                </div>
                <div class="flex items-center gap-1">
                    <!-- Prev Button (Arrow Icon Only) -->
                    <button
                        type="button"
                        on:click={() => changePage(pagination.page - 1)}
                        disabled={pagination.page <= 1}
                        class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                        title="Halaman sebelumnya"
                        aria-label="Halaman sebelumnya"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>

                    <!-- Numbered Buttons -->
                    {#each pageNumbers as p}
                        {#if p === '...'}
                            <span class="w-8 h-8 flex items-center justify-center text-xs text-[var(--text-3)] dark:text-slate-500 font-bold select-none">...</span>
                        {:else}
                            <button
                                type="button"
                                on:click={() => changePage(Number(p))}
                                class="w-8 h-8 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center {pagination.page === p ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/30 border-0' : 'border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 shadow-2xs'}"
                            >
                                {p}
                            </button>
                        {/if}
                    {/each}

                    <!-- Next Button (Arrow Icon Only) -->
                    <button
                        type="button"
                        on:click={() => changePage(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages || pagination.totalPages <= 1}
                        class="w-8 h-8 rounded-xl border border-[var(--border)] dark:border-slate-700 bg-[var(--surface)] dark:bg-[#101827] text-[var(--text-2)] dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer shadow-2xs"
                        title="Halaman berikutnya"
                        aria-label="Halaman berikutnya"
                    >
                        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    </main>
</Layout>
