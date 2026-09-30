<script lang="ts">
    import { onMount, onDestroy } from 'svelte';

    export let params: { token?: string } = {};
    let token = params.token || '';
    let invoice: any = null;
    let loading = true;
    let error = '';
    let copied = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    onMount(async () => {
        // Enforce anti-SEO meta tag
        let metaRobots = document.querySelector('meta[name="robots"]');
        if (!metaRobots) {
            metaRobots = document.createElement('meta');
            metaRobots.setAttribute('name', 'robots');
            document.head.appendChild(metaRobots);
        }
        metaRobots.setAttribute('content', 'noindex, nofollow, noarchive, nosnippet');

        await fetchInvoiceData();
    });

    onDestroy(() => {
        stopPolling();
    });

    function startPolling() {
        if (!pollInterval && invoice && !invoice.isPaid && invoice.qrImage) {
            pollInterval = setInterval(async () => {
                try {
                    const res = await fetch(`/payment/goqris/status/${invoice.orderId}`);
                    const json = await res.json();
                    if (json.status === 'success' && json.payment_status === 'paid') {
                        stopPolling();
                        await fetchInvoiceData(); // Refresh to show paid status
                    }
                } catch (e) {
                    console.error('Polling error', e);
                }
            }, 3000); // Poll every 3 seconds as required by GoQRIS
        }
    }

    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    async function fetchInvoiceData() {
        loading = true;
        try {
            const res = await fetch(`/api/v1/invoice/${token}`);
            const json = await res.json();
            if (json.status === 'success') {
                invoice = json.data;
                if (!invoice.isPaid && invoice.qrImage) {
                    startPolling();
                }
            } else {
                error = json.message || 'Invoice tidak ditemukan';
            }
        } catch (e) {
            error = 'Gagal memuat data invoice';
        } finally {
            loading = false;
        }
    }

    function copyShareLink() {
        const link = window.location.href;
        navigator.clipboard.writeText(link);
        copied = true;
        setTimeout(() => copied = false, 2500);
    }
</script>

<div class="min-h-screen bg-[#070c18] text-slate-200 flex flex-col items-center justify-center p-4 sm:p-8 selection:bg-blue-500/20 selection:text-blue-300">
    {#if loading}
        <div class="flex flex-col items-center gap-3">
            <div class="w-7 h-7 border-2 border-slate-700 border-t-blue-500 rounded-full animate-spin"></div>
            <p class="text-xs text-slate-400 font-mono tracking-tight">Memuat rincian faktur...</p>
        </div>
    {:else if error}
        <div class="w-full max-w-md bg-[#0d1527] border border-slate-800/80 rounded-2xl p-7 text-center space-y-4 shadow-2xl">
            <div class="w-10 h-10 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-xl flex items-center justify-center mx-auto text-base font-bold font-mono">!</div>
            <div class="space-y-1">
                <h2 class="text-base font-semibold text-white tracking-tight">Invoice Tidak Ditemukan</h2>
                <p class="text-xs text-slate-400 leading-relaxed">{error}</p>
            </div>
            <a href="#/" class="inline-flex items-center justify-center px-4 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-medium transition-colors border border-slate-700/60">Kembali ke Beranda</a>
        </div>
    {:else if invoice}
        <!-- Professional Digital Receipt Document Container -->
        <div class="w-full max-w-xl rounded-3xl bg-[#0c1322] border border-slate-800/80 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.7)] overflow-hidden">
            
            <!-- Top Header & Status -->
            <div class="p-5 sm:p-6 border-b border-slate-800/70 bg-[#10192e]/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div class="space-y-0.5">
                    <div class="flex items-center gap-2 text-[11px] font-semibold text-slate-400 tracking-wider uppercase font-mono">
                        <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                        Ziqva Labs &bull; Faktur Resmi
                    </div>
                    <h1 class="text-xl sm:text-2xl font-bold text-white tracking-tight font-mono">{invoice.invoiceNumber}</h1>
                </div>

                <div>
                    {#if invoice.isPaid}
                        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold tracking-wide">
                            <span class="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            LUNAS
                        </div>
                    {:else}
                        <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold tracking-wide">
                            <span class="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse"></span>
                            Menunggu Pembayaran
                        </div>
                    {/if}
                </div>
            </div>

            <div class="p-5 sm:p-6 space-y-5">
                <!-- Customer & Invoice Metadata Row -->
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div class="p-3.5 rounded-2xl bg-[#10192e]/40 border border-slate-800/60 space-y-0.5">
                        <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider block font-mono">Ditagihkan Kepada</span>
                        <div class="text-sm font-semibold text-slate-100">{invoice.customer.name}</div>
                        {#if invoice.customer.company}
                            <div class="text-slate-300 text-xs">{invoice.customer.company}</div>
                        {/if}
                        <div class="text-slate-400 text-xs font-mono">{invoice.customer.email}</div>
                        {#if invoice.customer.whatsapp}
                            <div class="text-slate-400 text-xs">{invoice.customer.whatsapp}</div>
                        {/if}
                    </div>

                    <div class="p-3.5 rounded-2xl bg-[#10192e]/40 border border-slate-800/60 space-y-0.5 flex flex-col justify-between sm:text-right">
                        <div>
                            <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider block font-mono">Waktu Penerbitan</span>
                            <div class="text-sm font-semibold text-slate-100">{invoice.createdDateStr}</div>
                        </div>
                        <div class="pt-1.5 sm:pt-0">
                            {#if invoice.paidDateStr}
                                <span class="text-[11px] text-emerald-400 font-medium">Tuntas pada: {invoice.paidDateStr}</span>
                            {:else}
                                <span class="text-[11px] text-amber-400/90 font-medium">Jatuh Tempo: 24 Jam</span>
                            {/if}
                        </div>
                    </div>
                </div>

                <!-- Product & Itemization Table -->
                <div class="border border-slate-800/70 rounded-2xl overflow-hidden bg-[#090e1b]">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="border-b border-slate-800/70 bg-[#10192e]/70 text-slate-400 font-medium font-mono text-[11px] uppercase tracking-wider">
                                <th class="py-2.5 px-3.5">Deskripsi Layanan</th>
                                <th class="py-2.5 px-3.5">Durasi</th>
                                <th class="py-2.5 px-3.5 text-right">Harga</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-800/50">
                            {#each invoice.items as item}
                                <tr>
                                    <td class="py-2.5 px-3.5 font-medium text-slate-100">{item.name}</td>
                                    <td class="py-2.5 px-3.5 text-slate-400 font-mono">{item.duration}</td>
                                    <td class="py-2.5 px-3.5 text-right font-mono font-medium text-slate-200">Rp {item.price.toLocaleString('id-ID')}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Dedicated QRIS Payment Terminal (When Unpaid) -->
                {#if !invoice.isPaid && invoice.qrImage}
                    <div class="p-6 rounded-2xl bg-[#090f1d] border border-slate-800 flex flex-col items-center justify-center text-center space-y-4">
                        <div class="flex items-center gap-2 text-xs text-slate-300 font-medium font-mono uppercase tracking-wide">
                            <span class="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            QRIS Standar Pembayaran Nasional
                        </div>

                        <!-- Clean Card for QR -->
                        <div class="p-3.5 bg-white rounded-2xl shadow-xl inline-block border border-slate-200">
                            <img src={invoice.qrImage} alt="QRIS QR Code" class="w-52 h-52 object-contain mx-auto" />
                        </div>

                        <!-- Total transfer callout -->
                        <div class="space-y-1">
                            <div class="text-xs text-slate-400">Total Pembayaran (Transfer tepat sesuai nominal):</div>
                            <div class="text-3xl font-extrabold text-emerald-400 font-mono tracking-tight">
                                Rp {invoice.pricing.totalAmount.toLocaleString('id-ID')}
                            </div>
                            <p class="text-[11px] text-slate-400 max-w-sm mx-auto leading-relaxed pt-1">
                                Dukungan seluruh m-Banking (BCA, Mandiri, BRI, BNI) & E-Wallet (GoPay, OVO, ShopeePay, DANA).
                            </p>
                        </div>

                        <div class="flex items-center gap-2 text-[11px] text-slate-500 pt-3 border-t border-slate-800/70 w-full justify-center font-mono">
                            <div class="w-3 h-3 border-2 border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                            <span>Menunggu konfirmasi pembayaran otomatis (3s)...</span>
                        </div>
                    </div>
                {/if}

                <!-- Pricing Breakdown -->
                <div class="w-full sm:w-72 ml-auto space-y-2 text-xs border-t border-slate-800/60 pt-4">
                    <div class="flex justify-between text-slate-400">
                        <span>Subtotal</span>
                        <span class="font-mono text-slate-200">Rp {invoice.pricing.subtotal.toLocaleString('id-ID')}</span>
                    </div>

                    {#if invoice.pricing.discount > 0}
                        <div class="flex justify-between text-emerald-400">
                            <span>Diskon ({invoice.pricing.voucherCode})</span>
                            <span class="font-mono">- Rp {invoice.pricing.discount.toLocaleString('id-ID')}</span>
                        </div>
                    {/if}

                    {#if invoice.pricing.adminFee > 0}
                        <div class="flex justify-between text-slate-400">
                            <span>Biaya Layanan</span>
                            <span class="font-mono text-slate-200">Rp {invoice.pricing.adminFee.toLocaleString('id-ID')}</span>
                        </div>
                    {/if}

                    {#if invoice.pricing.uniqueCode > 0}
                        <div class="flex justify-between text-slate-400">
                            <span>Kode Unik</span>
                            <span class="font-mono text-blue-400 font-bold">+ Rp {invoice.pricing.uniqueCode.toLocaleString('id-ID')}</span>
                        </div>
                    {/if}

                    <div class="flex justify-between text-sm font-bold text-white border-t border-slate-800/80 pt-3">
                        <span>Total Tagihan</span>
                        <span class="text-blue-400 text-lg font-bold font-mono">Rp {invoice.pricing.totalAmount.toLocaleString('id-ID')}</span>
                    </div>
                </div>

                <!-- Activation Key & Thank You Box (If Paid) -->
                {#if invoice.licenseToken}
                    <div class="p-5 rounded-2xl bg-emerald-950/20 border border-emerald-500/20 space-y-3">
                        <div class="space-y-0.5">
                            <div class="text-sm font-semibold text-emerald-400">Terima kasih atas pesanannya!</div>
                            <p class="text-xs text-slate-300">Pembayaran telah kami terima. Lisensi Anda sudah aktif dan siap digunakan:</p>
                        </div>
                        <div class="space-y-1">
                            <span class="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block font-mono">Kode Aktivasi Lisensi</span>
                            <div class="flex items-center justify-between gap-2 bg-[#090e1b] p-3 rounded-xl border border-emerald-500/30">
                                <code class="font-mono text-xs sm:text-sm font-bold text-emerald-300 tracking-wider select-all break-all">{invoice.licenseToken}</code>
                                <button
                                    type="button"
                                    on:click={() => {
                                        navigator.clipboard.writeText(invoice.licenseToken);
                                        copied = true;
                                        setTimeout(() => copied = false, 2000);
                                    }}
                                    class="px-2.5 py-1 text-[11px] font-medium rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all cursor-pointer shrink-0"
                                >
                                    Salin
                                </button>
                            </div>
                        </div>

                        <!-- Quick Links to Tutorial & Download Hub -->
                        {#if invoice.items && invoice.items.length > 0}
                            <div class="pt-2 border-t border-emerald-500/20 flex flex-wrap gap-2">
                                {#each invoice.items as item}
                                    {#if item.downloadUrl}
                                        <a
                                            href={item.downloadUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-600/15 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 text-xs font-semibold transition-all"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                            </svg>
                                            <span>Unduh Installer ({item.name})</span>
                                        </a>
                                    {/if}
                                    {#if item.hasTutorials && item.tutorialUrl}
                                        <a
                                            href={item.tutorialUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/15 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 text-xs font-semibold transition-all"
                                        >
                                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <polygon points="5 3 19 12 5 21 5 3"></polygon>
                                            </svg>
                                            <span>Lihat Tutorial ({item.name})</span>
                                        </a>
                                    {/if}
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/if}

                <!-- Action Toolbar -->
                <div class="pt-4 border-t border-slate-800/70 flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <a
                            href="/api/v1/invoice/{invoice.token}/pdf?tz={Intl.DateTimeFormat().resolvedOptions().timeZone}"
                            target="_blank"
                            class="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700/60"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>Lihat PDF</span>
                        </a>

                        <a
                            href="/api/v1/invoice/{invoice.token}/download?tz={Intl.DateTimeFormat().resolvedOptions().timeZone}"
                            class="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700/60"
                        >
                            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                            </svg>
                            <span>Unduh PDF</span>
                        </a>
                    </div>

                    <div>
                        <button
                            type="button"
                            on:click={copyShareLink}
                            class="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 text-xs font-medium transition-colors border border-slate-700/60 cursor-pointer"
                        >
                            {copied ? '✓ Tautan Tersalin' : 'Salin Tautan'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
