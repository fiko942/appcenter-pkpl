# GoQRIS Payment Gateway Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the application payment gateway from Xendit to GoQRIS, enforcing server-to-server validation and replacing Xendit invoices with GoQRIS native QR generation.

**Architecture:** We will create a new `goqrisService.ts` mimicking `xenditService` structure to interact with GoQRIS's `/order` and `/status` endpoints. A new `payment_settings` Prisma model will hold dynamic configuration (API Key, Project Name, Status). We'll update the `createOrder` flows (`memberController.ts` and `adminController.ts`) to call GoQRIS instead of Xendit. Because GoQRIS returns a QR image instead of a checkout URL, we need to adapt the frontend/UI to display this QR Code and instruct users to scan it. We also need a background polling mechanism or a dedicated endpoint that clients can hit to check if the payment is `paid`.

**Tech Stack:** Node.js, Express, Prisma, Svelte (Vite), TypeScript

## Global Constraints
1. API key GoQRIS disimpan hanya di backend/environment variable GOQRIS_API_KEY.
2. Jangan memanggil API GoQRIS langsung dari browser dan jangan menaruh API key di JavaScript frontend.
3. Buat ref_id unik untuk setiap invoice dan simpan trx_id serta ref_id di database aplikasi.
4. Tampilkan QR dari data.payment_detail.qr_image dan nominal dari data.total_amount.
5. Cek status dari backend setiap 2–3 detik menggunakan POST /status.
6. Pesanan hanya dianggap lunas jika data.payment_status === "paid".
7. Jangan membuat webhook/callback fiktif; GoQRIS saat ini menggunakan polling /status.
8. Tangani 400, 401, 403, 404, 409, dan error jaringan dengan aman.
9. Jangan menganggap response pending sebagai gagal. Beri kesempatan polling sampai invoice kedaluwarsa.

---

### Task 1: Update Database Schema

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add Payment Settings Model**

```prisma
model payment_settings {
  id              Int      @id @default(autoincrement())
  gateway_name    String   @unique @db.VarChar(50) // e.g., 'goqris'
  api_key         String?  @db.VarChar(255)
  project_name    String?  @db.VarChar(255)
  is_production   Boolean  @default(true)
  admin_fee       Float    @default(0)
  updated_at      DateTime @default(now()) @updatedAt
}
```

- [ ] **Step 2: Add GoQRIS fields to Order List**

```prisma
// Di model order_list
  payment_trx_id      String?  @db.VarChar(100)
  payment_qr_image    String?  @db.LongText
```

- [ ] **Step 3: Generate Prisma Client**

```bash
pnpm prisma db push
pnpm prisma generate
```

### Task 2: Implement GoQRIS Service

**Files:**
- Create: `src/services/goqrisService.ts`

- [ ] **Step 1: Create the integration service**

```typescript
import fetch from 'node-fetch';
import prisma from '../config/prisma';

export interface GoqrisConfig {
    apiKey: string;
    projectName: string;
    adminFee: number;
}

export async function getGoqrisConfig(): Promise<GoqrisConfig> {
    const settings = await prisma.payment_settings.findUnique({
        where: { gateway_name: 'goqris' }
    });

    if (settings && settings.api_key) {
        return {
            apiKey: settings.api_key,
            projectName: settings.project_name || 'AppCenter',
            adminFee: settings.admin_fee || 0
        };
    }

    return {
        apiKey: process.env.GOQRIS_API_KEY || '',
        projectName: process.env.GOQRIS_PROJECT_NAME || 'AppCenter',
        adminFee: parseFloat(process.env.GOQRIS_ADMIN_FEE || '0')
    };
}

const BASE_URL = 'https://api.goqris.web.id';

export async function goqrisRequest(path: string, body: any) {
    const config = await getGoqrisConfig();
    if (!config.apiKey) throw new Error('GoQRIS API Key not configured');

    const response = await fetch(\`\${BASE_URL}\${path}\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: config.apiKey, ...body }),
    });

    const payload = await response.json();
    if (!response.ok || payload.status !== 'success') {
        throw new Error(payload.message || \`GoQRIS API Error: \${response.status}\`);
    }
    return payload;
}

export async function createGoqrisOrder(params: {
    refId: string;
    amount: number;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    durationMinutes?: number;
}) {
    const config = await getGoqrisConfig();
    const finalAmount = amount + config.adminFee;
    
    return goqrisRequest('/order', {
        nama_project: config.projectName,
        ref_id: params.refId,
        amount: finalAmount,
        customer_name: params.customerName,
        customer_email: params.customerEmail,
        customer_phone: params.customerPhone,
        expired: params.durationMinutes || 1440 // 24 hours in minutes
    });
}

export async function checkGoqrisStatus(refId: string) {
    return goqrisRequest('/status', { ref_id: refId });
}
```

### Task 3: Replace Xendit with GoQRIS in Order Controllers

**Files:**
- Modify: `src/controllers/memberController.ts`
- Modify: `src/controllers/adminController.ts`

- [ ] **Step 1: Update `apiCreateOrder` in `memberController.ts`**
Replace Xendit integration with `createGoqrisOrder`. Wait for `payment_detail.qr_image` and save it to `payment_qr_image`, save `trx_id` to `payment_trx_id`. Note that since there is no `invoice_url` for GoQRIS, the response format for the checkout needs to reflect this so the client can display the QR.

- [ ] **Step 2: Update `processCreatePayment` in `adminController.ts`**
Similarly, when admin creates an invoice manually, use `createGoqrisOrder` instead of Xendit.

### Task 4: Setup Polling Endpoint & Background Sync

**Files:**
- Modify: `src/controllers/paymentNotificationController.ts`
- Modify: `src/routes/paymentRoutes.ts`

- [ ] **Step 1: Create Polling Endpoint**
Since GoQRIS uses polling instead of Webhooks, create an endpoint `GET /api/v1/payment/status/:orderId` that calls `checkGoqrisStatus(refId)`. If `payment_status === 'paid'`, update the Prisma `order_list` idempotently to `PAID` / `Order has been complete`.

### Task 5: Frontend Invoice / Checkout QR Display

**Files:**
- Modify: `client/src/lib/pages/InvoicePublic.svelte`
- Modify: `client/src/lib/pages/MemberInvoices.svelte`

- [ ] **Step 1: Display QR Code on Invoice**
Update the public invoice UI (`InvoicePublic.svelte`). If `inv.status` is UNPAID and `inv.payment_qr_image` exists, show the QR Code and the `total_amount` specifically required by GoQRIS (incorporating the unique ID).
Add frontend JS `setInterval` to poll `GET /api/v1/payment/status/:orderId` every 3 seconds while the QR is shown. Once paid, reload the invoice or show success.

### Task 6: Admin Settings UI for GoQRIS

**Files:**
- Modify: `client/src/lib/pages/AdminSettings.svelte`
- Modify: `src/controllers/adminController.ts`

- [ ] **Step 1: Add GoQRIS Configuration Box**
Add fields for API Key and Project Name to the admin settings so the user can save GoQRIS configuration directly in the database.

