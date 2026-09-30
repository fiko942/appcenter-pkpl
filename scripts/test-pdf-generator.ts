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
