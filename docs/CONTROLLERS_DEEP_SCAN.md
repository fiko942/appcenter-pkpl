# AppCenter V2 — Controllers Deep Scan & Architectural Specification

This document provides a comprehensive, method-by-method breakdown of every controller in the **AppCenter V2 (ZIQVA Store)** codebase.

---

## Master Controllers Summary Table

| Controller | Location | Lines of Code | Methods Count | Key Domain Responsibilities |
| :--- | :--- | :---: | :---: | :--- |
| **`AdminController`** | `src/controllers/adminController.ts` | ~1,820 | 23 | PIN Authentication, Executive Dashboard Analytics (Net/Gross revenue), Chart.js generation, Manual Invoicing, Order Management, Trial Code Generation (`TRIAL-xxxx`), Affiliate Management & Payouts, Product CRUD, Xendit Webhooks. |
| **`MemberController`** | `src/controllers/memberController.ts` | ~1,570 | 23 | Member Authentication/Registration, Dashboard, Orders Checkout Calculator, Voucher Validation, License Key Viewer, Machine ID Rebinding, Profile/Password, Affiliate Enrollment & Commission Dashboard, Bank Details, Custom Coupon Management. |
| **`DeviceController`** | `src/controllers/deviceController.ts` | 373 | 4 | Legacy Desktop Bot Client API (`/device/status`, `/device/activation`), Single Machine Lock for Trials, License Transfer for Paid subscriptions, Indonesian Date Formatting. |
| **`ProductController`** | `src/controllers/productController.ts` | 35 | 2 | Public REST API JSON endpoints for product catalogue (`/api/v1/products`, `/api/v1/products/:id`). |
| **`PublicController`** | `src/controllers/publicController.ts` | 19 | 1 | Public Download Center view controller (`/download`). |

---

## 1. `AdminController` (`src/controllers/adminController.ts`)

Exported as singleton instance `adminController = new AdminController()`.

### Method Details

#### 1.1 `showLogin(req: Request, res: Response)`
- **HTTP Endpoint**: `GET /admin/login`
- **Auth Guard**: Public (Redirects to `/admin/dashboard` if `req.session.isAuthenticated` is true).
- **Inputs**: `req.query.error` (optional string).
- **Template Rendered**: `loginPage(error)`.

#### 1.2 `processLogin(req: Request, res: Response)`
- **HTTP Endpoint**: `POST /admin/login`
- **Auth Guard**: Public.
- **Inputs**: `req.body.pin` (6-digit numeric string).
- **Prisma Queries**:
  - `prisma.admin.findFirst({ where: { pin: pin } })`
- **Session State Set**:
  - `req.session.adminId = admin.id`
  - `req.session.adminName = admin.username`
  - `req.session.isAuthenticated = true`
- **Failure Flow**: Redirects back with query error (`PIN harus 6 digit` or `PIN tidak valid`).

#### 1.3 `logout(req: Request, res: Response)`
- **HTTP Endpoint**: `GET /admin/logout`
- **Auth Guard**: `adminAuthMiddleware`.
- **Logic**: Destroys Express/MySQL session (`req.session.destroy`) and redirects to `/admin/login`.

#### 1.4 `showDashboard(req: Request, res: Response)`
- **HTTP Endpoint**: `GET /admin/dashboard`
- **Auth Guard**: `adminAuthMiddleware`.
- **Business Logic & Calculations**:
  1. **Date Bounds**: Calculates start and end timestamps for today, current month, and 7-day trailing windows.
  2. **Smart Revenue Calculation (Fallback Algorithm)**:
     - Loops all `order_list` entries marked `'Order has been complete'` for the current month.
     - Uses `order.total_amount` if $> 0$; otherwise computes manual fallback: `(item_price * duration_months) - discount`.
  3. **Affiliate Cost Deduction**: Sums `affiliate_income` from `affiliate_transaksi` for the current month.
  4. **Net Revenue Formula**: `netMonthlyRevenue = totalMonthlyGross - monthlyAffiliateIncome`.
  5. **7-Day Trailing Trend**: Aggregates revenue per day for Chart.js bar chart.
  6. **Top Selling Products**: Groups orders by product and counts top 5 bestsellers.
- **Template Rendered**: `dashboardPage(data)`.

#### 1.5 `showPaymentsList(req: Request, res: Response)`
- **HTTP Endpoint**: `GET /admin/payments`
- **Auth Guard**: `adminAuthMiddleware`.
- **Inputs**: `req.query.search`, `req.query.status`, `req.query.page`.
- **Prisma Queries**:
  - `prisma.order_list.findMany(...)` with JSON parsing of `items` and `user`.
  - Soft-join with `token_device_activation` and `device` tables.
- **Template Rendered**: `paymentsListPage(data)`.

#### 1.6 `confirmPaymentManually(req: Request, res: Response)`
- **HTTP Endpoint**: `POST /admin/payments/confirm/:id`
- **Auth Guard**: `adminAuthMiddleware`.
- **Logic**: Manually sets `order_list.status = 'Order has been complete'`, `confirmed_by = req.session.adminName`, and invokes `processOrderSuccess(orderId, 'MANUAL_CONFIRM')`.

#### 1.7 `updateOrderDuration(req: Request, res: Response)`
- **HTTP Endpoint**: `POST /admin/payments/update-duration/:id`
- **Auth Guard**: `adminAuthMiddleware`.
- **Inputs**: `req.body.duration` (duration in minutes).
- **Prisma Queries**:
  - Updates `order_list.duration`.
  - Cascades duration update to linked `token_device_activation` and `device` records.

#### 1.8 `showCreatePayment(req: Request, res: Response)` & `processCreatePayment(req: Request, res: Response)`
- **HTTP Endpoints**: `GET /admin/payment/create`, `POST /admin/payment/create`
- **Auth Guard**: `adminAuthMiddleware`.
- **Inputs**: `customer_email`, `customer_name`, `product_id`, `duration_months`, `admin_fee_percent`, `notes`.
- **Logic**: Calculates IDR total with admin fee, calls `xenditService.createInvoice()`, inserts `order_list` record, and returns generated payment URL.

#### 1.9 `showCreateTrial(req: Request, res: Response)` & `processCreateTrial(req: Request, res: Response)`
- **HTTP Endpoints**: `GET /admin/trials/create`, `POST /admin/trials/create`
- **Auth Guard**: `adminAuthMiddleware`.
- **Inputs**: `product_id`, `duration_value`, `duration_unit` (`hours`, `days`, `months`).
- **Token Generation**: Format `TRIAL-` + 16 uppercase random alphanumeric characters (`TRIAL-XXXXXXXXXXXXXXXX`).
- **Prisma Queries**: Inserts into `prisma.trial` with initial `user: 'WAITING_ACTIVATION'`.

#### 1.10 `showAffiliateManagement(req: Request, res: Response)`
- **HTTP Endpoint**: `GET /admin/affiliate`
- **Auth Guard**: `adminAuthMiddleware`.
- **Inputs**: `req.query.search`, `req.query.sort` (`income`, `memberSince`, `email`), `req.query.page` (pagination 25/page).
- **Calculations**:
  - Aggregates pending commission (`already_paid === 0`) per affiliate.
  - Aggregates total paid commission from `affiliate_payouts`.
- **Template Rendered**: `adminAffiliatePage(data)`.

#### 1.11 `markAffiliateAsPaid(req: Request, res: Response)`
- **HTTP Endpoint**: `POST /admin/affiliate/mark-paid`
- **Auth Guard**: `adminAuthMiddleware`.
- **Inputs**: `req.body.affiliate_email`.
- **Transactional Logic**:
  1. Finds all `affiliate_transaksi` where `affiliator_email === email` AND `already_paid === 0`.
  2. Calculates total unpaid amount.
  3. Inserts new record in `prisma.affiliate_payouts` (`amount`, `note: 'Manual Payout Admin'`, `accepted_by: adminName`).
  4. Updates all pending transactions to `already_paid = 1` and `paid_at = now`.
  5. Returns JSON response for AJAX UI instant update.

#### 1.12 `showPayoutHistory(req: Request, res: Response)`
- **HTTP Endpoint**: `GET /admin/affiliate/history`
- **Auth Guard**: `adminAuthMiddleware`.
- **Inputs**: `req.query.email`, `req.query.page` (20/page), `req.query.sort`, `req.query.order`.
- **Template Rendered**: `adminPayoutHistoryPage(data)`.

#### 1.13 Product Management Methods
- `showProductsList(req, res)`: `GET /admin/products`
- `processCreateProduct(req, res)`: `POST /admin/products/create`
- `processEditProduct(req, res)`: `POST /admin/products/edit/:id`
- `processDeleteProduct(req, res)`: `POST /admin/products/delete/:id`
- `processToggleProductStatus(req, res)`: `POST /admin/products/toggle-status/:id`

#### 1.14 `handleWebhook(req: Request, res: Response)` & `processOrderSuccess(orderId: number, paymentId: string)`
- **HTTP Endpoints**: `POST /payment/success`, `POST /admin/webhook`
- **Auth Guard**: Validates `req.headers['x-callback-token']` against `xenditConfig.webhookToken`.
- **Idempotency**: Verifies order status is not already complete.
- **Fulfillment**:
  1. Updates `order_list.status = 'Order has been complete'`.
  2. Generates 20-character license token in `token_device_activation`.
  3. If order contains affiliate voucher, calculates 5% commission and inserts `affiliate_transaksi` (`already_paid: 0`).

---

## 2. `MemberController` (`src/controllers/memberController.ts`)

Exported as singleton instance `memberController = new MemberController()`.

### Method Details

#### 2.1 Auth & Registration
- `showLogin(req, res)`: `GET /member/login`
- `processLogin(req, res)`: `POST /member/login` (Validates email & password in `prisma.user`, checks `verified === true` and `banned === false`, sets `req.session.isMemberAuthenticated = true`).
- `showRegister(req, res)`: `GET /member/register`
- `processRegister(req, res)`: `POST /member/register` (Checks email uniqueness, creates `prisma.user` with `verified: true`, auto-creates session).
- `logout(req, res)`: `GET /member/logout` (Destroys member session).

#### 2.2 Dashboard & Order Management
- `showDashboard(req, res)`: `GET /member/dashboard` (Fetches user statistics, total orders, active licenses).
- `showOrders(req, res)`: `GET /member/orders` (Lists user orders with search, status badges, and invoice links).
- `showCreateOrder(req, res)`: `GET /member/orders/create` (Interactive checkout calculator).
- `apiCheckVoucher(req, res)`: `POST /member/api/check-voucher` (AJAX endpoint validating promo codes or affiliate coupons).
- `processCreateOrder(req, res)`: `POST /member/orders/create` (Validates voucher, calculates total, creates `order_list`, generates Xendit Invoice).
- `payOrder(req, res)`: `GET /member/orders/:orderId/pay` (Re-fetches or re-generates Xendit payment link).

#### 2.3 Licensing & Machine ID (HWID)
- `showLicenses(req, res)`: `GET /member/licenses` (Lists user's products, 20-char license keys, copy-to-clipboard, Machine ID, expiry dates).
- `showEditMachine(req, res)`: `GET /member/device/:deviceId/edit-machine` (Form to change bound Machine ID).
- `processEditMachine(req, res)`: `POST /member/device/:deviceId/edit-machine` (Updates `device.machine_id` securely for user's own devices).

#### 2.4 Affiliate Portal
- `showAffiliate(req, res)`: `GET /member/affiliate` (Renders affiliate dashboard, motivation performance banner, pending commissions, coupon code, bank account).
- `processJoinAffiliate(req, res)`: `POST /member/affiliate/join` (Enforces rule: must have $\ge 6$ completed orders in last 180 days; generates `ZQ` + 4 char coupon).
- `updateAffiliateProfile(req, res)`: `POST /member/affiliate/update-payout` (Updates bank name, account number, account holder name).
- `updateAffiliateCoupon(req, res)`: `POST /member/affiliate/update-coupon` (Updates custom coupon code; enforces uppercase alphanumeric `^[A-Z0-9]+$`).
- `showPayoutHistory(req, res)`: `GET /member/affiliate/payouts` (Unified payout table showing both settled records from `affiliate_payouts` and pending commissions from `affiliate_transaksi`).

#### 2.5 Profile & Downloads
- `showProfile(req, res)`: `GET /member/profile` (Account information & password change form).
- `processChangePassword(req, res)`: `POST /member/change-password` (Verifies current password, updates new password).
- `showDownloads(req, res)`: `GET /member/downloads` (Scrapes and renders software downloads).

---

## 3. `DeviceController` (`src/controllers/deviceController.ts`)

Serves client desktop applications and legacy bots.

### Method Details

#### 3.1 `checkDeviceStatus(req: Request, res: Response)`
- **HTTP Endpoint**: `POST /device/status` (and `/api/v1/device/status`)
- **Inputs**: `req.query.product`, `req.query.machine_id`.
- **Validation Logic**:
  1. Checks `prisma.device` for matching `machine_id` + `product` + `expired > now`.
  2. If not found, checks `prisma.trial` for matching `machine_id` + `product` + `expired > now`.
  3. Formats dates in Indonesian locale (`"24 Agustus 2026"`).
- **Response Format**:
  ```json
  {
    "tobelsoft": {
      "status": 200,
      "message": "Device Registered",
      "data": {
        "registered": true,
        "user": { "email": "...", "name": "..." },
        "created": "...",
        "expired": "...",
        "remaining": "28 Hari",
        "label": "Premium License",
        "product": "..."
      }
    }
  }
  ```

#### 3.2 `activateLicense(req: Request, res: Response)`
- **HTTP Endpoint**: `POST /device/activation` (and `/api/v1/device/activation`)
- **Inputs**: `req.query.token`, `req.query.product`, `req.query.machine_id`.
- **Paid License Activation**:
  - Finds license in `prisma.token_device_activation`.
  - If existing device found: **Transfers License** by updating `device.machine_id = machine_id`.
  - If new device: Creates new `device` entry with `expired = now + (duration_minutes * 60)`.
- **Trial License Activation**:
  - Finds trial in `prisma.trial`.
  - **Strict Single Machine Lock**: If `trial.machine_id` is already set, rejects with `"Kode trial tidak bisa diaktifkan 2x"`.
  - Otherwise binds `trial.machine_id = machine_id`.

#### 3.3 Standalone Device View Helpers
- `showDeviceLicensePage`: Render helper for standalone device view.
- `updateDeviceMachineId`: POST handler for standalone machine ID update.

---

## 4. `ProductController` (`src/controllers/productController.ts`)

Provides public JSON APIs.

### Method Details
- `getProducts(req, res)`: `GET /api/v1/products` (Returns up to 20 product items in JSON).
- `getProductById(req, res)`: `GET /api/v1/products/:id` (Returns single product details by ID).

---

## 5. `PublicController` (`src/controllers/publicController.ts`)

Handles public web views.

### Method Details
- `showDownloads(req, res)`: `GET /download` (Fetches installer file links from `downloadService.getDownloadFiles()` and renders `public-downloads.ts`).
