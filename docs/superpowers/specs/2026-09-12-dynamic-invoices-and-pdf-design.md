# System Design Specification: Dynamic Public Invoices & Server-Side PDF Engine

**Date:** 2026-09-12  
**Status:** Approved  
**Author:** Grok (Lazy Senior Developer) & Engineering Team

---

## 1. Objective & Scope
Provide a comprehensive, dynamic invoice system for AppCenter V2 that:
1. Generates a secure, obscure public URL for each order (`/#/invoice/:token`).
2. Enforces strict anti-indexing rules (`noindex, nofollow`, `X-Robots-Tag`) so search engines cannot scrape invoices.
3. Dynamically renders state-aware invoice views:
   - **UNPAID / PENDING:** Shows itemized breakdown, invoice total, expiry countdown, and direct checkout payment link.
   - **PAID / SUCCESS:** Shows paid receipt badge, transaction details, activation token details, and PDF actions.
4. Generates pixel-perfect server-side PDFs rendered via headless Chrome (`puppeteer-core`).
5. Supports viewing the PDF directly in the browser (`Content-Disposition: inline`) as well as direct download.
6. Integrates into the Member Portal (dedicated menu "Faktur & Invoice" + row actions in "Pesanan Saya") and the Admin Panel ("Pembayaran" table with public invoice link & inspection).

---

## 2. Architecture & Data Model

### 2.1 Database Schema Additions (`order_list` table)
In `prisma/schema.prisma` and the MySQL database:
```prisma
model order_list {
  id                 Int      @id @default(autoincrement())
  // ... existing fields ...
  invoice_token      String?  @unique @db.VarChar(64)
  // ... existing fields ...
}
```
- A utility function generates a cryptographically secure 32-character hex string (e.g. `inv_a9f4c3b2e1d087654a32bcde12345678`).
- Existing records without `invoice_token` will have fallback generation upon access or an initialization backfill.

### 2.2 Security & Search Engine Blocking
1. **Robots Exclusion:**
   - In `src/app.ts` / `src/server.ts`, `/robots.txt` endpoint adds:
     ```
     Disallow: /invoice/
     Disallow: /#/invoice/
     Disallow: /api/v1/invoice/
     ```
2. **HTTP Headers:**
   - The Express middleware for all `/api/v1/invoice/*` and invoice rendering endpoints emits:
     ```http
     X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
     Cache-Control: private, no-cache, no-store, must-revalidate
     ```
3. **Frontend Head Meta:**
   - On navigation to `/#/invoice/:token`, the SPA sets:
     ```html
     <meta name="robots" content="noindex, nofollow, noarchive, nosnippet" />
     ```

---

## 3. Endpoints & API Contracts

### 3.1 Public Invoice Data API
- **Endpoint:** `GET /api/v1/invoice/:token`
- **Access:** Public (Secured by token unguessability).
- **Response:**
  ```json
  {
    "status": "success",
    "data": {
      "token": "inv_a9f4c3b2...",
      "orderId": 1054,
      "invoiceNumber": "INV-202609-1054",
      "created": 1789180000,
      "status": "Order has been complete", // or "Menunggu Pembayaran"
      "isPaid": true,
      "paidAt": 1789182000,
      "customer": {
        "email": "customer@example.com",
        "name": "Customer Name"
      },
      "items": [
        {
          "name": "Ziqva Auto Bot",
          "price": 150000,
          "duration": "1 Bulan"
        }
      ],
      "pricing": {
        "subtotal": 150000,
        "discount": 0,
        "adminFee": 2500,
        "totalAmount": 152500
      },
      "paymentUrl": "https://checkout.xendit.co/web/...",
      "licenseToken": "l1ZsKmA8JyLekYVCP" // included only if paid
    }
  }
  ```

### 3.2 Server-Side PDF Stream Endpoints
1. **Browser Inline Viewer:**
   - **Endpoint:** `GET /api/v1/invoice/:token/pdf` (or query param `?download=false`)
   - **Headers:**
     - `Content-Type: application/pdf`
     - `Content-Disposition: inline; filename="Invoice-INV-202609-1054.pdf"`
2. **Direct Attachment Download:**
   - **Endpoint:** `GET /api/v1/invoice/:token/download`
   - **Headers:**
     - `Content-Type: application/pdf`
     - `Content-Disposition: attachment; filename="Invoice-INV-202609-1054.pdf"`

---

## 4. PDF Generation Engine (`src/services/pdfService.ts`)
- Utilizes `puppeteer-core` (or system Chromium) to launch headless browser instance.
- Loads an optimized server-side HTML/CSS template (`src/views/invoice-pdf-template.ts`).
- Template styling:
  - Clean A4 page layout with print-ready margins (`@page { size: A4; margin: 15mm; }`).
  - High-contrast typography, clear tabular breakdown, corporate logo, and dynamic "PAID" or "UNPAID / MENUNGGU PEMBAYARAN" status stamp watermark.
  - Generates binary PDF buffer:
    ```typescript
    await page.pdf({ format: 'A4', printBackground: true });
    ```
- Reuses browser instance or pools for resource efficiency.

---

## 5. Frontend & UI Implementation

### 5.1 Public Invoice View (`client/src/lib/pages/InvoicePublic.svelte`)
- Route: `/#/invoice/:token`
- Clean standalone layout (no sidebar, centered invoice card).
- Responsive view with dark/light mode support, or crisp neutral theme matching corporate invoice standards.
- Actions:
  - **"Buka PDF di Browser"** -> opens `/api/v1/invoice/:token/pdf` in a new tab.
  - **"Unduh PDF"** -> triggers direct download from `/api/v1/invoice/:token/download`.
  - **"Salin Tautan Faktur"** -> copies public URL to clipboard with toast alert.
  - **"Bayar Sekarang"** (If unpaid) -> redirects to Xendit payment checkout.

### 5.2 Member Portal Integration
1. **Sidebar Navigation (`client/src/lib/components/Sidebar.svelte`):**
   - Add new menu item **"Faktur & Invoice"** (`#/member/invoices`).
2. **Member Invoices List Page (`client/src/lib/pages/MemberInvoices.svelte`):**
   - Lists all invoices belonging to the logged-in member.
   - Shows Invoice ID, Date, Amount, Status badge, Quick Actions (View Web, Open PDF, Download PDF).
3. **Orders Page (`client/src/lib/pages/Orders.svelte`):**
   - Adds "Lihat Invoice" button directly in the action column of each order row.

### 5.3 Admin Panel Integration (`client/src/lib/pages/AdminPayments.svelte`)
- In each payment/order row in the Admin Payments table:
  - Add **"Lihat Invoice"** action button.
  - Clicking opens the invoice or displays a modal with the public link, allowing the admin to copy and send it to the client.

---

## 6. Verification & Quality Gates
- **Type Safety:** `tsc --noEmit` on root and client.
- **Client Build:** `vite build` must produce bundle without regression.
- **End-to-End Test:**
  1. Create or fetch existing order.
  2. Verify token generation and access via public URL without login.
  3. Verify `X-Robots-Tag` and `robots.txt` headers.
  4. Verify PDF generation and `inline` stream renders cleanly in browser.
  5. Verify both UNPAID and PAID states.
