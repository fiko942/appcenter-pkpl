# Xendit Payment Integration Analysis

## 1. Overview Xendit API

Xendit adalah payment gateway yang menyediakan berbagai metode pembayaran untuk Asia Tenggara, khususnya Indonesia.

### API Endpoints Utama
- **`POST /v3/payment_requests`** - Create payment request
- **`GET /v3/payment_requests/{id}`** - Get payment request status
- **`POST /refunds`** - Create refund

### Authentication
- Menggunakan **Basic Auth** dengan Secret API Key sebagai username
- Format: `Authorization: Basic {base64(API_KEY:)}`

---

## 2. Payment Channels Indonesia (Relevan)

| Channel Code | Nama | Min | Max | Settlement |
|--------------|------|-----|-----|------------|
| BCA_VIRTUAL_ACCOUNT | BCA VA | 10,000 | 50,000,000 | T+1 |
| BNI_VIRTUAL_ACCOUNT | BNI VA | 1 | 50,000,000 | Instant |
| BRI_VIRTUAL_ACCOUNT | BRI VA | 1 | 50B | Instant |
| MANDIRI_VIRTUAL_ACCOUNT | Mandiri VA | 1 | 50M | Instant |
| CIMB_VIRTUAL_ACCOUNT | CIMB VA | 1 | 50M | Instant |
| DANA | DANA | 100 | 20,000,000 | T+2 |
| GOPAY | GoPay | 1 | 50,000,000 | T+1 |
| OVO | OVO | 1 | 20,000,000 | T+1 |
| SHOPEEPAY | ShopeePay | 1 | 10,000,000 | T+2 |
| LINKAJA | LinkAja | 100 | 2,000,000 | T+2 |
| QRIS | QRIS | 1 | 10,000,000 | Varies |
| CARDS | Visa/MC | 5,000 | 200,000,000 | T+5 |
| ALFAMART | Alfamart | 10,000 | 5,000,000 | T+5 |
| INDOMARET | Indomaret | 10,000 | 5,000,000 | T+5 |

---

## 3. Payment Request Flow

### 3.1 Create Payment Request
```http
POST /v3/payment_requests
Authorization: Basic {base64(API_KEY:)}
Content-Type: application/json

{
  "reference_id": "order_123456",
  "type": "PAY",
  "country": "ID",
  "currency": "IDR",
  "request_amount": 115000,  // Termasuk admin fee
  "capture_method": "AUTOMATIC",
  "channel_code": "BCA_VIRTUAL_ACCOUNT",
  "channel_properties": {
    "failure_return_url": "https://yoursite.com/payment/failed",
    "success_return_url": "https://yoursite.com/payment/success"
  },
  "description": "Pembelian Produk ABC",
  "metadata": {
    "order_id": "123456",
    "product_id": "789",
    "product_name": "Product ABC",
    "admin_fee": 5000,
    "base_price": 110000
  }
}
```

### 3.2 Response
```json
{
  "payment_request_id": "pr-1fdaf346-dd2e-4b6c-b938-124c7167a822",
  "reference_id": "order_123456",
  "status": "REQUIRES_ACTION",
  "actions": [
    {
      "type": "REDIRECT_CUSTOMER",
      "value": "https://xendit.co/pay/...",
      "descriptor": "WEB_URL"
    }
  ],
  // atau untuk VA:
  "channel_properties": {
    "virtual_account_number": "9888012345678"
  }
}
```

---

## 4. Webhook untuk Payment Completion

### 4.1 Event Types
- `payment.capture` - Pembayaran berhasil
- `payment.authorization` - Pembayaran diotorisasi (untuk manual capture)
- `payment.failure` - Pembayaran gagal

### 4.2 Webhook Payload (Payment Success)
```json
{
  "event": "payment.capture",
  "business_id": "6094fa76c2fd53701b8e079c",
  "created": "2021-12-02T14:52:21.566Z",
  "data": {
    "payment_id": "py-1fdaf346-dd2e-4b6c-b938-124c7167a822",
    "status": "SUCCEEDED",
    "payment_request_id": "pr-1fdaf346-dd2e-4b6c-b938-124c7167a822",
    "request_amount": 115000,
    "channel_code": "BCA_VIRTUAL_ACCOUNT",
    "country": "ID",
    "currency": "IDR",
    "reference_id": "order_123456"
  }
}
```

### 4.3 Webhook Verification
```typescript
// Header: x-callback-token berisi token dari Xendit Dashboard
const isValidWebhook = (req: Request): boolean => {
  const callbackToken = req.headers['x-callback-token'];
  return callbackToken === process.env.XENDIT_WEBHOOK_TOKEN;
};
```

### 4.4 Best Practices untuk Webhook
1. **Quick Acknowledgement** - Return 200 immediately, process async
2. **Idempotency** - Check `payment_id` untuk hindari duplicate processing
3. **Authentication** - Verify `x-callback-token` header
4. **Server-side only** - Jangan expose webhook endpoint ke client

---

## 5. Admin Fee Implementation

### 5.1 Kalkulasi Admin Fee
```typescript
interface PaymentCalculation {
  basePrice: number;      // Harga produk
  adminFee: number;       // Biaya admin
  totalAmount: number;    // Total yang dibayar user
}

function calculatePayment(basePrice: number, adminFeePercent: number = 0): PaymentCalculation {
  const adminFee = Math.ceil(basePrice * adminFeePercent / 100);
  return {
    basePrice,
    adminFee,
    totalAmount: basePrice + adminFee
  };
}

// Contoh: Admin fee 5% dari 100,000
// basePrice: 100,000
// adminFee: 5,000
// totalAmount: 105,000
```

### 5.2 Simpan di Metadata
Admin fee harus disimpan di `metadata` payment request agar bisa ditrack:
```json
{
  "metadata": {
    "base_price": 100000,
    "admin_fee": 5000,
    "admin_fee_percent": 5
  }
}
```

---

## 5.5 Database Analysis - Existing Tables

### order_list.duration Field
**Satuan: MENIT (bukan detik atau bulan)**

| Duration (menit) | Konversi | Interpretasi |
|------------------|----------|--------------|
| 43800 | 30.4 hari | **1 bulan** |
| 87600 | 60.8 hari | **2 bulan** |
| 131400 | 91.25 hari | **3 bulan** |
| 262800 | 182.5 hari | **6 bulan** |
| 525600 | 365 hari | **12 bulan** |

**Formula konversi ke bulan:**
```typescript
const durationMonths = Math.round(duration / 43800);
```

### Hubungan order_list dan invoice

**Struktur invoice.id:**
```
{order_id}.{timestamp}
Contoh: 100.1664605193
```

**invoice.data berisi JSON dengan:**
```json
{
  "id": "100",                    // ID order
  "items": {...},                 // Data produk
  "created": 1664587379,          // Timestamp order
  "confirmed_by": "Pak Effand",   // Admin yang konfirmasi
  "status": "Order has been complete",
  "payment": "BCA",
  "duration": 43800,              // Durasi dalam MENIT
  "user": "email@gmail.com",
  "token": {                      // Token aktivasi produk
    "token": "l1ZsKmA8JyLekYVCP",
    "duration": 43800,
    "product": "Ziqva Auto Bot",
    "taked": false,
    "taked_at": 1664605186,
    "taked_ip": "",
    "user": "email@gmail.com"
  }
}
```

**Kesimpulan:**
- `invoice` adalah arsip/snapshot dari `order_list` setelah selesai
- Berisi data lengkap termasuk token aktivasi
- `invoice.email` = email pelanggan (plaintext setelah didekripsi)

---

## 6. Database Schema untuk Payment

### 6.1 Tabel `payment_requests` (Baru)
```prisma
model payment_request {
  id                  Int       @id @default(autoincrement())
  payment_request_id  String    @unique @db.VarChar(100)  // Xendit ID
  reference_id        String    @unique @db.VarChar(100)  // Order ID
  order_id            Int                                  // FK to order_list
  user_id             Int                                  // FK to user
  status              String    @db.VarChar(50)           // PENDING, SUCCEEDED, FAILED
  request_amount      Int                                  // Total amount
  base_price          Int                                  // Product price
  admin_fee           Int                                  // Admin fee
  channel_code        String    @db.VarChar(50)           // BCA_VA, GOPAY, etc
  payment_method      String    @db.VarChar(50)           // virtual_account, ewallet, etc
  payment_url         String?   @db.Text                  // Redirect URL
  va_number           String?   @db.VarChar(50)           // For VA
  qr_string           String?   @db.Text                  // For QR
  expires_at          DateTime?                            // Payment expiry
  paid_at             DateTime?                            // When paid
  created_at          DateTime  @default(now())
  updated_at          DateTime  @updatedAt
}
```

### 6.2 Tabel `payment_webhook_logs` (Baru)
```prisma
model payment_webhook_log {
  id            Int      @id @default(autoincrement())
  payment_id    String   @db.VarChar(100)    // Xendit payment ID
  event         String   @db.VarChar(50)     // payment.capture, etc
  payload       String   @db.LongText        // Raw JSON
  processed     Boolean  @default(false)
  created_at    DateTime @default(now())
}
```

---

## 7. Implementation Plan

### Phase 1: Setup & Configuration
1. Tambah environment variables
   - `XENDIT_SECRET_KEY`
   - `XENDIT_PUBLIC_KEY`
   - `XENDIT_WEBHOOK_TOKEN`
   - `XENDIT_CALLBACK_URL`
2. Buat Prisma models untuk payment
3. Install Xendit SDK atau gunakan fetch

### Phase 2: Payment Service
1. Buat `src/services/xenditService.ts`
   - `createPaymentRequest()`
   - `getPaymentRequest()`
   - `verifyWebhook()`
2. Buat `src/services/paymentService.ts`
   - `createOrder()`
   - `calculateTotal()`
   - `processPaymentSuccess()`

### Phase 3: API Endpoints
1. `POST /api/v1/payment/create`
   - Terima order details
   - Hitung total + admin fee
   - Buat payment request ke Xendit
   - Return payment URL/VA number
2. `POST /api/v1/payment/webhook`
   - Verify callback token
   - Process payment status
   - Update order status
   - Activate product/license
3. `GET /api/v1/payment/status/:orderId`
   - Check payment status

### Phase 4: Order Flow Integration
1. Update order creation to include payment
2. Implement product activation on payment success
3. Send email notification on payment

---

## 8. Folder Structure

```
src/
├── config/
│   └── xendit.ts           # Xendit configuration
├── services/
│   ├── xenditService.ts    # Xendit API calls
│   └── paymentService.ts   # Payment business logic
├── controllers/
│   └── paymentController.ts # Payment endpoints
├── routes/
│   └── paymentRoutes.ts    # Payment routes
└── types/
    └── xendit.ts           # Xendit type definitions
```

---

## 9. Security Considerations

1. **API Key Security**
   - Store di environment variables
   - Jangan expose ke client
   - Gunakan different keys untuk test/live

2. **Webhook Security**
   - Verify `x-callback-token`
   - Use HTTPS only
   - Implement idempotency dengan `payment_id`

3. **Payment Validation**
   - Validate amount server-side
   - Check order exists before payment
   - Prevent duplicate payments

---

## 10. Environment Variables Needed

```env
# Xendit Configuration
XENDIT_SECRET_KEY=xnd_development_xxx
XENDIT_PUBLIC_KEY=xnd_public_development_xxx
XENDIT_WEBHOOK_TOKEN=your_webhook_token_from_dashboard
XENDIT_CALLBACK_URL=https://your-api.com/api/v1/payment/webhook

# Payment Settings
PAYMENT_ADMIN_FEE_PERCENT=5
PAYMENT_EXPIRY_HOURS=24
```

---

## 11. Next Steps

Setelah analisis ini, langkah selanjutnya:
1. [ ] Confirm payment channels yang akan digunakan
2. [ ] Tentukan besaran admin fee (flat atau persentase)
3. [ ] Create Xendit account & get API keys
4. [ ] Implement payment service
5. [ ] Create webhook endpoint
6. [ ] Test di sandbox environment
7. [ ] Deploy ke production
