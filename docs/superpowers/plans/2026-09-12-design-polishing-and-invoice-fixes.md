## 2026-09-12-design-polishing-and-invoice-fixes
### Summary of Implementations
- Improved GoQRIS admin configuration modal UI (anti-slop, premium aesthetic, cleaner webhook text).
- Registered `/payment/goqris/status/:orderId` polling endpoint to correctly verify local/production backend payment status.
- Ensured Vite Dev proxy forwards `/payment` requests to local Express backend.
- Improved `InvoicePublic.svelte` and PDF document layout: only show `issueDate` when paid, match footer address.
- Completely overhauled the public invoice UI with a premium dark-themed receipt aesthetic.
