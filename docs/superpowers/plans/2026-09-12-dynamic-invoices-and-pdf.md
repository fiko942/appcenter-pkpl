# Dynamic Invoices & Server-Side PDF Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a secure, non-indexed dynamic public invoice view (`/#/invoice/:token`) with server-side PDF preview and download capabilities, integrated into both Member Portal and Admin Panel.

**Architecture:** Extend Prisma schema with `invoice_token` on `order_list`. Implement a server-side `pdfService` utilizing `puppeteer-core` to convert invoice HTML into A4 PDF streams (`inline` or `attachment`). Expose public API `/api/v1/invoice/:token` and PDF endpoints with `X-Robots-Tag: noindex, nofollow` headers. Build Svelte SPA pages for public invoice, member invoice history, and admin payment invoice actions.

**Tech Stack:** Express 5, TypeScript, Prisma ORM, MySQL, `puppeteer-core`, Svelte 4, Vite, Tailwind CSS.

## Global Constraints
- `invoice_token` must be obscure 64-char hex / 32-byte crypto string.
- PDF generation must support both inline viewing in browser (`Content-Disposition: inline`) and direct file download (`Content-Disposition: attachment`).
- Anti-SEO headers (`X-Robots-Tag: noindex, nofollow`) and HTML meta robots tags must be enforced on all invoice routes.

---

### Task 1: Database Schema Update & Invoice Token Utility

**Files:**
- Modify: `prisma/schema.prisma`
- Create: `src/utils/invoiceToken.ts`
- Test: `scripts/test-invoice-token.ts`

**Interfaces:**
- Consumes: Prisma ORM client
- Produces: `generateInvoiceToken()`, `ensureOrderInvoiceToken(orderId)`

- [ ] **Step 1: Update Prisma Schema**

In `prisma/schema.prisma`, add `invoice_token` field to `order_list`:
```prisma
model order_list {
  id                 Int      @id @default(autoincrement())
  // ... existing fields ...
  invoice_token      String?  @unique @db.VarChar(64)
  // ... existing fields ...
}
```

- [ ] **Step 2: Generate Prisma Client & Push DB Changes**

Run command:
```bash
pnpm exec prisma db push
pnpm exec prisma generate
```

- [ ] **Step 3: Create `src/utils/invoiceToken.ts`**

```typescript
import crypto from 'crypto';
import { prisma } from '../config/prisma';

export function generateInvoiceToken(): string {
    return 'inv_' + crypto.randomBytes(24).toString('hex');
}

export async function ensureOrderInvoiceToken(orderId: number): Promise<string> {
    const order = await prisma.order_list.findUnique({
        where: { id: orderId },
        select: { id: true, invoice_token: true }
    });

    if (!order) {
        throw new Error(`Order #${orderId} not found`);
    }

    if (order.invoice_token) {
        return order.invoice_token;
    }

    const newToken = generateInvoiceToken();
    await prisma.order_list.update({
        where: { id: orderId },
        data: { invoice_token: newToken }
    });

    return newToken;
}
```

- [ ] **Step 4: Create verification script**

Create `scripts/test-invoice-token.ts`:
```typescript
import { generateInvoiceToken } from '../src/utils/invoiceToken';

const token = generateInvoiceToken();
console.log('Generated token:', token);
if (!token.startsWith('inv_') || token.length < 50) {
    console.error('Invalid token format');
    process.exit(1);
}
console.log('Token generation test passed!');
```

Run test:
```bash
pnpm exec ts-node scripts/test-invoice-token.ts
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma src/utils/invoiceToken.ts scripts/test-invoice-token.ts
git commit -m "feat(invoice): add invoice_token to order_list schema and token generator utility"
```

---

### Task 2: Server-Side PDF Engine & HTML Template Generator

**Files:**
- Create: `src/views/invoicePdfTemplate.ts`
- Create: `src/services/pdfService.ts`
- Test: `scripts/test-pdf-generator.ts`

**Interfaces:**
- Consumes: Invoice data object (order details, pricing, status, customer)
- Produces: `generateInvoicePdf(invoiceData): Promise<Buffer>`

- [ ] **Step 1: Create HTML/CSS Invoice PDF Template `src/views/invoicePdfTemplate.ts`**

```typescript
export interface InvoicePdfData {
    invoiceNumber: string;
    createdDate: string;
    paidDate?: string;
    status: string;
    isPaid: boolean;
    customerName: string;
    customerEmail: string;
    items: Array<{ name: string; duration: string; price: number }>;
    subtotal: number;
    adminFee: number;
    discount: number;
    totalAmount: number;
    paymentUrl?: string;
    licenseToken?: string;
}

export function renderInvoiceHtml(data: InvoicePdfData): string {
    const statusColor = data.isPaid ? '#10b981' : '#f59e0b';
    const statusLabel = data.isPaid ? 'LUNAS / PAID' : 'MENUNGGU PEMBAYARAN';

    return `<!DOCTYPE html>
<html lang="id">
<head>
    <meta charset="UTF-8">
    <meta name="robots" content="noindex, nofollow">
    <title>Invoice ${data.invoiceNumber}</title>
    <style>
        @page { size: A4; margin: 15mm; }
        body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1e293b; margin: 0; padding: 0; font-size: 13px; line-height: 1.5; background: #ffffff; }
        .invoice-box { max-width: 800px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; }
        .header { display: flex; justify-content: space-between; align-items: center; border-b: 2px solid #f1f5f9; pb: 20px; margin-bottom: 20px; }
        .brand { font-size: 24px; font-weight: 800; color: #2563eb; }
        .status-stamp { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: 700; font-size: 12px; color: white; background-color: ${statusColor}; text-transform: uppercase; letter-spacing: 0.5px; }
        .details-grid { display: flex; justify-content: space-between; margin-bottom: 24px; }
        .column { flex: 1; }
        .column-right { text-align: right; }
        .label { color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 4px; }
        .value { font-weight: 600; color: #0f172a; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
        th { background: #f8fafc; color: #475569; text-align: left; padding: 10px 12px; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #e2e8f0; }
        td { padding: 12px; border-bottom: 1px solid #f1f5f9; font-size: 13px; }
        .totals-table { width: 300px; margin-left: auto; margin-bottom: 24px; }
        .totals-table td { padding: 6px 12px; border: none; }
        .totals-table .total-row td { border-top: 2px solid #e2e8f0; font-size: 15px; font-weight: 800; color: #2563eb; }
        .footer { text-align: center; color: #94a3b8; font-size: 11px; border-t: 1px solid #f1f5f9; padding-top: 16px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="invoice-box">
        <div class="header">
            <div>
                <div class="brand">APPCENTER</div>
                <div style="font-size: 11px; color: #64748b;">Ziqva Ecosystem Digital Invoice</div>
            </div>
            <div>
                <span class="status-stamp">${statusLabel}</span>
            </div>
        </div>

        <div class="details-grid">
            <div class="column">
                <div class="label">Ditagihkan Kepada</div>
                <div class="value">${data.customerName}</div>
                <div style="color: #64748b;">${data.customerEmail}</div>
            </div>
            <div class="column column-right">
                <div class="label">Nomor Invoice</div>
                <div class="value" style="font-family: monospace;">${data.invoiceNumber}</div>
                <div class="label" style="margin-top: 8px;">Tanggal Dibuat</div>
                <div>${data.createdDate}</div>
                ${data.paidDate ? `<div class="label" style="margin-top: 8px;">Tanggal Lunas</div><div>${data.paidDate}</div>` : ''}
            </div>
        </div>

        <table>
            <thead>
                <tr>
                    <th>Item Produk</th>
                    <th>Durasi</th>
                    <th style="text-align: right;">Harga</th>
                </tr>
            </thead>
            <tbody>
                ${data.items.map(item => `
                    <tr>
                        <td><strong>${item.name}</strong></td>
                        <td>${item.duration}</td>
                        <td style="text-align: right;">Rp ${item.price.toLocaleString('id-ID')}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>

        <table class="totals-table">
            <tr>
                <td style="color: #64748b;">Subtotal:</td>
                <td style="text-align: right; font-weight: 600;">Rp ${data.subtotal.toLocaleString('id-ID')}</td>
            </tr>
            ${data.adminFee > 0 ? `
            <tr>
                <td style="color: #64748b;">Biaya Penanganan / Admin:</td>
                <td style="text-align: right; font-weight: 600;">Rp ${data.adminFee.toLocaleString('id-ID')}</td>
            </tr>` : ''}
            ${data.discount > 0 ? `
            <tr>
                <td style="color: #64748b;">Diskon / Kupon:</td>
                <td style="text-align: right; font-weight: 600; color: #ef4444;">- Rp ${data.discount.toLocaleString('id-ID')}</td>
            </tr>` : ''}
            <tr class="total-row">
                <td>Total Tagihan:</td>
                <td style="text-align: right;">Rp ${data.totalAmount.toLocaleString('id-ID')}</td>
            </tr>
        </table>

        ${data.licenseToken ? `
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 12px; margin-bottom: 20px;">
            <div style="font-weight: 700; color: #166534; font-size: 11px; text-transform: uppercase;">Kode Aktivasi Lisensi</div>
            <div style="font-family: monospace; font-size: 16px; font-weight: 800; color: #15803d; letter-spacing: 1px; margin-top: 4px;">${data.licenseToken}</div>
        </div>` : ''}

        <div class="footer">
            Dokumen invoice ini diterbitkan secara otomatis oleh sistem AppCenter Ziqva.<br>
            Harap simpan bukti pembayaran ini sebagai rincian transaksi sah Anda.
        </div>
    </div>
</body>
</html>`;
}
```

- [ ] **Step 2: Create `src/services/pdfService.ts`**

```typescript
import puppeteer from 'puppeteer-core';
import { renderInvoiceHtml, InvoicePdfData } from '../views/invoicePdfTemplate';

export async function generateInvoicePdfBuffer(invoiceData: InvoicePdfData): Promise<Buffer> {
    const htmlContent = renderInvoiceHtml(invoiceData);
    
    // Find system Chromium / Chrome binary path
    const executablePath = process.env.CHROME_BIN || 
                           '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' ||
                           '/usr/bin/chromium-browser';

    const browser = await puppeteer.launch({
        executablePath,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });

    try {
        const page = await browser.newPage();
        await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
        const pdfUint8Array = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '15mm', right: '15mm', bottom: '15mm', left: '15mm' }
        });
        return Buffer.from(pdfUint8Array);
    } finally {
        await browser.close();
    }
}
```

- [ ] **Step 3: Verification Script `scripts/test-pdf-generator.ts`**

```typescript
import { renderInvoiceHtml } from '../src/views/invoicePdfTemplate';

const sampleData = {
    invoiceNumber: 'INV-202609-TEST',
    createdDate: '12 September 2026',
    status: 'Order has been complete',
    isPaid: true,
    customerName: 'Budi Santoso',
    customerEmail: 'budi@example.com',
    items: [{ name: 'Ziqva Auto Bot', duration: '1 Bulan', price: 150000 }],
    subtotal: 150000,
    adminFee: 2500,
    discount: 0,
    totalAmount: 152500,
    licenseToken: 'l1ZsKmA8JyLekYVCP'
};

const html = renderInvoiceHtml(sampleData);
if (!html.includes('INV-202609-TEST') || !html.includes('LUNAS / PAID')) {
    console.error('HTML template render failed');
    process.exit(1);
}
console.log('PDF HTML template test passed!');
```

Run test:
```bash
pnpm exec ts-node scripts/test-pdf-generator.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/views/invoicePdfTemplate.ts src/services/pdfService.ts scripts/test-pdf-generator.ts
git commit -m "feat(invoice): add server-side invoice HTML template and PDF service engine"
```

---

### Task 3: Backend Invoice Controller & Express Routes

**Files:**
- Create: `src/controllers/invoiceController.ts`
- Modify: `src/routes/index.ts`
- Modify: `src/routes/memberRoutes.ts`
- Modify: `src/app.ts` (robots.txt header enforcement)

**Interfaces:**
- Consumes: `ensureOrderInvoiceToken`, `generateInvoicePdfBuffer`, `prisma.order_list`
- Produces: API endpoints `/api/v1/invoice/:token`, `/api/v1/invoice/:token/pdf`, `/api/v1/invoice/:token/download`

- [ ] **Step 1: Create `src/controllers/invoiceController.ts`**

```typescript
import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { ensureOrderInvoiceToken } from '../utils/invoiceToken';
import { generateInvoicePdfBuffer } from '../services/pdfService';
import { InvoicePdfData } from '../views/invoicePdfTemplate';

export class InvoiceController {
    async getInvoiceDataByToken(req: Request, res: Response) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
        res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');

        const { token } = req.params;
        try {
            const order = await prisma.order_list.findFirst({
                where: { invoice_token: token }
            });

            if (!order) {
                return res.status(404).json({ status: 'error', message: 'Invoice tidak ditemukan' });
            }

            const itemsParsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            const isPaid = order.status === 'Order has been complete' || order.status === 'COMPLETED';

            let licenseToken = '';
            if (isPaid) {
                const activation = await prisma.token_device_activation.findFirst({
                    where: { order_id: order.id }
                });
                if (activation) {
                    licenseToken = activation.token;
                }
            }

            const createdDateStr = new Date(order.created * 1000).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            });
            const paidDateStr = order.paid_at ? new Date(order.paid_at * 1000).toLocaleDateString('id-ID', {
                day: 'numeric', month: 'long', year: 'numeric'
            }) : undefined;

            return res.json({
                status: 'success',
                data: {
                    token: order.invoice_token,
                    orderId: order.id,
                    invoiceNumber: `INV-${order.id}`,
                    created: order.created,
                    createdDateStr,
                    paidDateStr,
                    status: order.status,
                    isPaid,
                    customer: {
                        email: order.user,
                        name: order.user.split('@')[0]
                    },
                    items: Array.isArray(itemsParsed) ? itemsParsed : [
                        {
                            name: itemsParsed?.name || itemsParsed?.product_name || 'Software Subscription',
                            duration: `${Math.round(order.duration / 43800) || 1} Bulan`,
                            price: order.total_amount || 0
                        }
                    ],
                    pricing: {
                        subtotal: order.total_amount || 0,
                        adminFee: order.admin_fee || 0,
                        discount: 0,
                        totalAmount: (order.total_amount || 0) + (order.admin_fee || 0)
                    },
                    paymentUrl: order.payment_url,
                    licenseToken
                }
            });
        } catch (error) {
            console.error('Failed to get invoice data:', error);
            return res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }

    async getInvoicePdfStream(req: Request, res: Response) {
        res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet');
        const { token } = req.params;
        const isDownload = req.query.download === 'true' || req.path.endsWith('/download');

        try {
            const order = await prisma.order_list.findFirst({
                where: { invoice_token: token }
            });

            if (!order) {
                return res.status(404).send('Invoice not found');
            }

            const itemsParsed = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
            const isPaid = order.status === 'Order has been complete' || order.status === 'COMPLETED';

            let licenseToken = undefined;
            if (isPaid) {
                const activation = await prisma.token_device_activation.findFirst({
                    where: { order_id: order.id }
                });
                if (activation) {
                    licenseToken = activation.token;
                }
            }

            const invoicePdfData: InvoicePdfData = {
                invoiceNumber: `INV-${order.id}`,
                createdDate: new Date(order.created * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }),
                paidDate: order.paid_at ? new Date(order.paid_at * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }) : undefined,
                status: order.status,
                isPaid,
                customerName: order.user.split('@')[0],
                customerEmail: order.user,
                items: Array.isArray(itemsParsed) ? itemsParsed : [
                    {
                        name: itemsParsed?.name || itemsParsed?.product_name || 'Software Subscription',
                        duration: `${Math.round(order.duration / 43800) || 1} Bulan`,
                        price: order.total_amount || 0
                    }
                ],
                subtotal: order.total_amount || 0,
                adminFee: order.admin_fee || 0,
                discount: 0,
                totalAmount: (order.total_amount || 0) + (order.admin_fee || 0),
                licenseToken
            };

            const pdfBuffer = await generateInvoicePdfBuffer(invoicePdfData);
            const filename = `Invoice-INV-${order.id}.pdf`;

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `${isDownload ? 'attachment' : 'inline'}; filename="${filename}"`);
            return res.send(pdfBuffer);
        } catch (error) {
            console.error('Failed to stream invoice PDF:', error);
            return res.status(500).send('Error generating PDF');
        }
    }

    async getMemberInvoices(req: Request, res: Response) {
        const session = req.session as any;
        if (!session || !session.isMemberAuthenticated) {
            return res.status(401).json({ status: 'error', message: 'Unauthorized' });
        }

        const userEmail = session.userEmail;
        try {
            const orders = await prisma.order_list.findMany({
                where: { user: userEmail },
                orderBy: { id: 'desc' }
            });

            // Ensure every order has an invoice_token
            const invoices = await Promise.all(orders.map(async (order) => {
                const token = await ensureOrderInvoiceToken(order.id);
                return {
                    id: order.id,
                    invoiceNumber: `INV-${order.id}`,
                    token,
                    created: order.created,
                    status: order.status,
                    isPaid: order.status === 'Order has been complete' || order.status === 'COMPLETED',
                    totalAmount: (order.total_amount || 0) + (order.admin_fee || 0)
                };
            }));

            return res.json({ status: 'success', data: invoices });
        } catch (error) {
            console.error('Failed to get member invoices:', error);
            return res.status(500).json({ status: 'error', message: 'Internal server error' });
        }
    }
}

export const invoiceController = new InvoiceController();
```

- [ ] **Step 2: Register Routes in `src/routes/index.ts` & `src/routes/memberRoutes.ts`**

In `src/routes/index.ts`:
```typescript
import { invoiceController } from '../controllers/invoiceController';

// Invoice public APIs
router.get('/api/v1/invoice/:token', (req, res) => invoiceController.getInvoiceDataByToken(req, res));
router.get('/api/v1/invoice/:token/pdf', (req, res) => invoiceController.getInvoicePdfStream(req, res));
router.get('/api/v1/invoice/:token/download', (req, res) => invoiceController.getInvoicePdfStream(req, res));
```

In `src/routes/memberRoutes.ts`:
```typescript
router.get('/api/invoices', (req, res) => invoiceController.getMemberInvoices(req, res));
```

- [ ] **Step 3: Update `robots.txt` in `src/app.ts`**

Ensure `robots.txt` endpoint disallows `/invoice/` and `/api/v1/invoice/`:
```typescript
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send('User-agent: *\nDisallow: /admin/\nDisallow: /member/\nDisallow: /invoice/\nDisallow: /#/invoice/\nDisallow: /api/v1/invoice/\n');
});
```

- [ ] **Step 4: Commit**

```bash
git add src/controllers/invoiceController.ts src/routes/index.ts src/routes/memberRoutes.ts src/app.ts
git commit -m "feat(invoice): add backend invoice API controller, PDF streaming routes, and robots exclusion"
```

---

### Task 4: Public Invoice View (`client/src/lib/pages/InvoicePublic.svelte`)

**Files:**
- Create: `client/src/lib/pages/InvoicePublic.svelte`
- Modify: `client/src/App.svelte`

**Interfaces:**
- Consumes: `params: { token: string }` from Svelte SPA router, `/api/v1/invoice/:token`
- Produces: Public non-indexed invoice UI page

- [ ] **Step 1: Create `client/src/lib/pages/InvoicePublic.svelte`**

```svelte
<script lang="ts">
    import { onMount } from 'svelte';

    export let params: { token?: string } = {};
    let token = params.token || '';
    let invoice: any = null;
    let loading = true;
    let error = '';
    let copied = false;

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

    async function fetchInvoiceData() {
        loading = true;
        try {
            const res = await fetch(`/api/v1/invoice/${token}`);
            const json = await res.json();
            if (json.status === 'success') {
                invoice = json.data;
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
        setTimeout(() => copied = false, 3000);
    }
</script>

<div class="min-h-screen bg-[#090d16] text-slate-100 flex flex-col items-center justify-center p-4 sm:p-6">
    {#if loading}
        <div class="flex flex-col items-center gap-3">
            <div class="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p class="text-sm text-slate-400">Memuat data invoice...</p>
        </div>
    {:else if error}
        <div class="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-6 text-center space-y-4 shadow-2xl">
            <div class="w-16 h-16 bg-red-500/10 text-red-400 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">!</div>
            <h2 class="text-xl font-bold text-white">Terjadi Kesalahan</h2>
            <p class="text-sm text-slate-400">{error}</p>
            <a href="#/" class="inline-block px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors">Kembali ke Beranda</a>
        </div>
    {:else if invoice}
        <div class="w-full max-w-2xl bg-[#111a2e] border border-[#22314d] rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
            <!-- Header Status -->
            <div class="p-6 sm:p-8 border-b border-[#22314d] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-[#16233d]">
                <div>
                    <div class="flex items-center gap-2 text-xs font-bold text-blue-400 uppercase tracking-wider mb-1">
                        <img src="/favicon.svg" alt="Appcenter" class="w-4 h-4" /> AppCenter Invoice
                    </div>
                    <h1 class="text-2xl font-extrabold text-white tracking-tight">{invoice.invoiceNumber}</h1>
                </div>

                <div class="flex items-center gap-3">
                    {#if invoice.isPaid}
                        <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            LUNAS / PAID
                        </span>
                    {:else}
                        <span class="px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center gap-1.5">
                            <span class="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                            MENUNGGU PEMBAYARAN
                        </span>
                    {/if}
                </div>
            </div>

            <!-- Detail Grid -->
            <div class="p-6 sm:p-8 space-y-6">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div class="bg-[#17243e] p-4 rounded-2xl border border-[#263757]">
                        <span class="text-slate-400 uppercase font-semibold">Pelanggan</span>
                        <p class="text-sm font-bold text-white mt-1">{invoice.customer.name}</p>
                        <p class="text-slate-300">{invoice.customer.email}</p>
                    </div>

                    <div class="bg-[#17243e] p-4 rounded-2xl border border-[#263757] text-left sm:text-right">
                        <span class="text-slate-400 uppercase font-semibold">Tanggal Transaksi</span>
                        <p class="text-sm font-bold text-white mt-1">{invoice.createdDateStr}</p>
                        {#if invoice.paidDateStr}
                            <p class="text-emerald-400 font-medium mt-1">Lunas pada: {invoice.paidDateStr}</p>
                        {/if}
                    </div>
                </div>

                <!-- Items Table -->
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr class="border-b border-[#22314d] text-slate-400 uppercase font-bold">
                                <th class="py-3 px-2">Produk</th>
                                <th class="py-3 px-2">Durasi</th>
                                <th class="py-3 px-2 text-right">Harga</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[#1e2d4a]">
                            {#each invoice.items as item}
                                <tr>
                                    <td class="py-3 px-2 font-bold text-white">{item.name}</td>
                                    <td class="py-3 px-2 text-slate-300">{item.duration}</td>
                                    <td class="py-3 px-2 text-right font-bold text-white">Rp {item.price.toLocaleString('id-ID')}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                <!-- Pricing Summary -->
                <div class="w-full sm:w-72 ml-auto space-y-2 text-xs border-t border-[#22314d] pt-4">
                    <div class="flex justify-between text-slate-400">
                        <span>Subtotal:</span>
                        <span class="font-bold text-white">Rp {invoice.pricing.subtotal.toLocaleString('id-ID')}</span>
                    </div>
                    {#if invoice.pricing.adminFee > 0}
                        <div class="flex justify-between text-slate-400">
                            <span>Biaya Admin:</span>
                            <span class="font-bold text-white">Rp {invoice.pricing.adminFee.toLocaleString('id-ID')}</span>
                        </div>
                    {/if}
                    <div class="flex justify-between text-sm font-extrabold text-blue-400 border-t border-[#22314d] pt-2">
                        <span>Total Tagihan:</span>
                        <span>Rp {invoice.pricing.totalAmount.toLocaleString('id-ID')}</span>
                    </div>
                </div>

                <!-- License Key if Paid -->
                {#if invoice.licenseToken}
                    <div class="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 space-y-1">
                        <span class="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Kode Lisensi Aktivasi</span>
                        <p class="font-mono text-base font-black text-emerald-300 tracking-wider select-all">{invoice.licenseToken}</p>
                    </div>
                {/if}

                <!-- Action Buttons -->
                <div class="pt-4 border-t border-[#22314d] flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2">
                        <a
                            href="/api/v1/invoice/{invoice.token}/pdf"
                            target="_blank"
                            class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors flex items-center gap-2 border border-slate-700"
                        >
                            👁️ Lihat PDF
                        </a>

                        <a
                            href="/api/v1/invoice/{invoice.token}/download"
                            class="px-4 py-2.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-bold transition-colors flex items-center gap-2 border border-blue-500/30"
                        >
                            📥 Unduh PDF
                        </a>
                    </div>

                    <div class="flex items-center gap-2">
                        <button
                            type="button"
                            on:click={copyShareLink}
                            class="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
                        >
                            {copied ? '✓ Tautan Tersalin' : '🔗 Salin Tautan'}
                        </button>

                        {#if !invoice.isPaid && invoice.paymentUrl}
                            <a
                                href={invoice.paymentUrl}
                                target="_blank"
                                class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-black tracking-wide shadow-lg shadow-emerald-600/20 transition-all flex items-center gap-2"
                            >
                                💳 Bayar Sekarang
                            </a>
                        {/if}
                    </div>
                </div>
            </div>
        </div>
    {/if}
</div>
```

- [ ] **Step 2: Register Public Invoice Route in `client/src/App.svelte`**

In `client/src/App.svelte`, import `InvoicePublic` and add public route:
```svelte
import InvoicePublic from './lib/pages/InvoicePublic.svelte';

// in routes map:
'/#/invoice/:token': wrap({
    component: InvoicePublic
}),
'/invoice/:token': wrap({
    component: InvoicePublic
}),
```

- [ ] **Step 3: Commit**

```bash
git add client/src/lib/pages/InvoicePublic.svelte client/src/App.svelte
git commit -m "feat(invoice): create InvoicePublic Svelte component and register public route"
```

---

### Task 5: Member Invoices Hub & Sidebar Integration

**Files:**
- Create: `client/src/lib/pages/MemberInvoices.svelte`
- Modify: `client/src/lib/components/Sidebar.svelte`
- Modify: `client/src/lib/pages/Orders.svelte`
- Modify: `client/src/App.svelte`

**Interfaces:**
- Consumes: `/member/api/invoices`, `/member/api/orders`
- Produces: Member Invoice Hub view and row action buttons

- [ ] **Step 1: Create `client/src/lib/pages/MemberInvoices.svelte`**

```svelte
<script lang="ts">
    import { onMount } from 'svelte';
    import Layout from '../components/Layout.svelte';

    let invoices: any[] = [];
    let loading = true;

    onMount(async () => {
        await fetchInvoices();
    });

    async function fetchInvoices() {
        loading = true;
        try {
            const res = await fetch('/member/api/invoices');
            const json = await res.json();
            if (json.status === 'success') {
                invoices = json.data || [];
            }
        } catch (e) {
            console.error('Failed to fetch invoices:', e);
        } finally {
            loading = false;
        }
    }
</script>

<Layout activePage="invoices">
    <div class="space-y-6">
        <div>
            <h1 class="text-2xl font-extrabold text-[var(--text-1)] tracking-tight">Faktur & Invoice</h1>
            <p class="text-xs text-[var(--text-3)] mt-1">Kelola dan unduh seluruh bukti pembayaran resmi pesanan Anda.</p>
        </div>

        {#if loading}
            <div class="p-12 text-center text-xs text-[var(--text-3)]">Memuat riwayat invoice...</div>
        {:else if invoices.length === 0}
            <div class="p-12 text-center rounded-3xl bg-[var(--surface)] border border-[var(--border)] space-y-3">
                <p class="text-sm font-bold text-[var(--text-1)]">Belum Ada Invoice</p>
                <p class="text-xs text-[var(--text-3)]">Invoice akan diterbitkan otomatis saat Anda melakukan transaksi.</p>
            </div>
        {:else}
            <div class="rounded-3xl bg-[var(--surface)] border border-[var(--border)] overflow-hidden shadow-xl">
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-xs">
                        <thead>
                            <tr class="border-b border-[var(--border)] text-[var(--text-3)] uppercase font-bold bg-slate-900/40">
                                <th class="py-4 px-6">Nomor Invoice</th>
                                <th class="py-4 px-6">Tanggal</th>
                                <th class="py-4 px-6">Total Amount</th>
                                <th class="py-4 px-6">Status</th>
                                <th class="py-4 px-6 text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-[var(--border)] text-[var(--text-2)]">
                            {#each invoices as inv}
                                <tr class="hover:bg-slate-800/30 transition-colors">
                                    <td class="py-4 px-6 font-bold text-[var(--text-1)] font-mono">{inv.invoiceNumber}</td>
                                    <td class="py-4 px-6">{new Date(inv.created * 1000).toLocaleDateString('id-ID')}</td>
                                    <td class="py-4 px-6 font-bold text-[var(--text-1)]">Rp {inv.totalAmount.toLocaleString('id-ID')}</td>
                                    <td class="py-4 px-6">
                                        {#if inv.isPaid}
                                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">PAID</span>
                                        {:else}
                                            <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase bg-amber-500/20 text-amber-400 border border-amber-500/30">UNPAID</span>
                                        {/if}
                                    </td>
                                    <td class="py-4 px-6 text-right">
                                        <div class="flex items-center justify-end gap-2">
                                            <a href="#/invoice/{inv.token}" class="px-3 py-1.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 text-xs font-semibold border border-blue-500/30 transition-colors">
                                                Detail Web
                                            </a>
                                            <a href="/api/v1/invoice/{inv.token}/pdf" target="_blank" class="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors">
                                                PDF
                                            </a>
                                        </div>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>
            </div>
        {/if}
    </div>
</Layout>
```

- [ ] **Step 2: Add "Faktur & Invoice" item to Member Sidebar `client/src/lib/components/Sidebar.svelte`**

Add navigation link:
```svelte
<a
    href="#/member/invoices"
    bind:this={itemElements['invoices']}
    class="sidebar-nav-item {activePage === 'invoices' ? 'active' : ''}"
    on:mouseenter={() => handleMouseEnter('invoices')}
    on:click={() => mobileOpen = false}
>
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    <span class="whitespace-nowrap flex-1">Faktur & Invoice</span>
</a>
```

- [ ] **Step 3: Update `client/src/lib/pages/Orders.svelte` to include "Lihat Invoice" button**

In `Orders.svelte` order action column, add button linking to `/#/invoice/${order.invoice_token}`:
```svelte
{#if order.invoice_token}
    <a
        href="#/invoice/{order.invoice_token}"
        class="px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-semibold border border-indigo-500/30 transition-colors flex items-center gap-1.5"
    >
        📄 Invoice
    </a>
{/if}
```

- [ ] **Step 4: Register `/member/invoices` in `client/src/App.svelte`**

```svelte
import MemberInvoices from './lib/pages/MemberInvoices.svelte';

// in routes map:
'/member/invoices': wrap({
    component: MemberInvoices,
    conditions: [requireMemberAuth]
}),
```

- [ ] **Step 5: Commit**

```bash
git add client/src/lib/pages/MemberInvoices.svelte client/src/lib/components/Sidebar.svelte client/src/lib/pages/Orders.svelte client/src/App.svelte
git commit -m "feat(invoice): implement MemberInvoices hub, sidebar menu, and order invoice actions"
```

---

### Task 6: Admin Panel Invoice Inspection Integration

**Files:**
- Modify: `client/src/lib/pages/AdminPayments.svelte`

**Interfaces:**
- Consumes: Order list invoice tokens
- Produces: Invoice link copy & inspection modal in Admin Payments view

- [ ] **Step 1: Add Invoice Copy/View Action in `client/src/lib/pages/AdminPayments.svelte`**

In `AdminPayments.svelte` order rows, add an action button **"Public Invoice"**:
```svelte
{#if p.invoice_token}
    <a
        href="#/invoice/{p.invoice_token}"
        target="_blank"
        class="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 text-xs font-semibold border border-purple-500/30 transition-colors flex items-center gap-1"
        title="Buka Invoice Publik"
    >
        📑 Invoice
    </a>
{/if}
```

- [ ] **Step 2: Commit**

```bash
git add client/src/lib/pages/AdminPayments.svelte
git commit -m "feat(invoice): integrate public invoice inspection and link copy in Admin Payments"
```

---

### Task 7: Full Verification & Build Check

**Files:**
- Test all components, compilation, and builds.

- [ ] **Step 1: Run Root & Client Typecheck**

Run commands:
```bash
pnpm exec tsc --noEmit
cd client && pnpm exec tsc --noEmit
```

- [ ] **Step 2: Execute Workspace Build**

Run command:
```bash
pnpm run build
```

- [ ] **Step 3: Test Local Dev Server Execution**

Verify background execution of `pnpm run dev` and test `/health` & invoice endpoints.

- [ ] **Step 4: Commit Final Verification**

```bash
git add .
git commit -m "chore(invoice): verify full build and server execution for dynamic invoice system"
```
