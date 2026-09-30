# Member Dashboard Pending Order Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide an informative, human-crafted notification banner on the Member Dashboard whenever a user has an active, unpaid pending order, prompting them with natural copywriting and a clear direct action to complete payment and immediately receive their license key.

**Architecture:** Enhance `src/controllers/memberController.ts` (`apiGetDashboard`) to accurately retrieve the user's most recent unexpired pending order with full context (product name, total amount, expiry countdown, invoice token). Overhaul the pending order banner in `client/src/lib/pages/Dashboard.svelte` with refined Linear/Stripe-style aesthetics, clean natural Indonesian copywriting, and direct one-click payment navigation.

**Tech Stack:** Svelte 4, TypeScript, Express 5, Prisma ORM, Tailwind CSS

---

## Global Constraints
1. **Branch Invariant:** Strictly `reborn` branch (no push to master).
2. **Package Manager:** Strictly `pnpm`.
3. **Database Connection Pool:** Strictly capped at `5`.
4. **Copywriting Tone:** Natural, clear, human-crafted Indonesian language without robotic buzzwords or generic AI templates.

---

### Task 1: Enhance Backend Pending Order Payload in `MemberController`

**Files:**
- Modify: `src/controllers/memberController.ts:2635-2670`

- [ ] **Step 1: Update `apiGetDashboard` in `src/controllers/memberController.ts`**
Enrich `pendingInvoices` with formatted expiration time (`expiresAtFormatted` in WIB), time remaining, and accurate invoice routing tokens.

```typescript
        // Fetch Pending Invoices (Unexpired awaiting payment)
        const pendingOrders = await prisma.order_list.findMany({
            where: {
                user: userEmail,
                paid_at: null,
                status: { notIn: ['Order has been complete', 'Order is cancelled'] },
                payment_request_id: { not: null }
            },
            orderBy: { id: 'desc' },
            take: 1
        });

        const pendingInvoices = pendingOrders.map(o => {
            let productName = 'Software License';
            try {
                const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
                if (Array.isArray(items) && items.length > 0) productName = items[0].name || productName;
            } catch {
                // Fallback to default product name
            }

            const expiresAt = o.payment_expires_at ? Number(o.payment_expires_at) : (o.created + 86400);
            const isExpired = expiresAt < now;
            const minutesLeft = Math.max(0, Math.ceil((expiresAt - now) / 60));

            return {
                id: o.id,
                productName,
                totalAmount: o.total_amount || 0,
                paymentRequestId: o.payment_request_id,
                vaNumber: o.va_number || null,
                expiresAt,
                minutesLeft,
                expiresAtFormatted: new Date(expiresAt * 1000).toLocaleString('id-ID', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit'
                }),
                isExpired,
                invoiceToken: (o as any).invoice_token || null
            };
        }).filter(o => !o.isExpired);
```

---

### Task 2: Redesign Pending Order Banner in `Dashboard.svelte`

**Files:**
- Modify: `client/src/lib/pages/Dashboard.svelte:50-60, 215-245`

- [ ] **Step 1: Update `PendingInvoiceItem` TypeScript interface**

```typescript
    interface PendingInvoiceItem {
        id: number;
        productName: string;
        totalAmount: number;
        paymentRequestId: string | null;
        vaNumber: string | null;
        expiresAt: number;
        minutesLeft?: number;
        expiresAtFormatted?: string;
        invoiceToken: string | null;
    }
```

- [ ] **Step 2: Implement Handcrafted Pending Banner UI & Copywriting**
Replace the generic gradient box with a refined, high-contrast banner featuring human-friendly Indonesian copywriting:

```svelte
        <!-- 0. Pending Order Action Banner -->
        {#if pendingInvoices && pendingInvoices.length > 0}
            <div class="mb-6">
                {#each pendingInvoices as inv}
                    <div class="rounded-2xl border border-amber-500/30 dark:border-amber-500/25 bg-amber-500/5 dark:bg-amber-950/25 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all">
                        <div class="flex items-start sm:items-center gap-3.5 min-w-0">
                            <!-- Amber Clock/Bill Icon -->
                            <div class="w-11 h-11 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0 shadow-2xs">
                                <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                            </div>
                            
                            <!-- Copywriting Text Content -->
                            <div class="min-w-0 flex-1">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-[11px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
                                        Menunggu Pembayaran #{inv.id}
                                    </span>
                                    {#if inv.expiresAtFormatted}
                                        <span class="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-800 dark:text-amber-300 text-[10px] font-medium border border-amber-500/20">
                                            Batas: {inv.expiresAtFormatted} WIB
                                        </span>
                                    {/if}
                                </div>
                                <h3 class="text-sm font-bold text-[var(--text)] mt-0.5">
                                    Selesaikan pembelian <span class="text-blue-600 dark:text-blue-400 font-black">{inv.productName}</span> ({formatRupiah(inv.totalAmount)})
                                </h3>
                                <p class="text-xs text-[var(--text-3)] dark:text-slate-400 mt-0.5 leading-relaxed">
                                    Lisensi software dan tautan unduhan akan langsung aktif seketika setelah pembayaran terverifikasi.
                                </p>
                            </div>
                        </div>

                        <!-- CTA Actions -->
                        <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            <a
                                href={inv.invoiceToken ? `#/invoices/${inv.invoiceToken}` : `#/invoices/${inv.id}`}
                                class="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-xs font-semibold shadow-xs transition-all flex items-center justify-center gap-1.5 group/pay cursor-pointer border-0"
                            >
                                <span>Selesaikan Pembayaran</span>
                                <svg class="w-3.5 h-3.5 transition-transform group-hover/pay:translate-x-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 5l7 7m0 0l-7 7m7-7H3"/>
                                </svg>
                            </a>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
```

---

### Task 3: Build & Verification

**Files:**
- Test: `scratch/verify-pending-banner.js`

- [ ] **Step 1: Compile bundle via `pnpm run build`**
- [ ] **Step 2: Verify in Chrome headless browser**
- [ ] **Step 3: Purge test scripts for zero storage footprint**
