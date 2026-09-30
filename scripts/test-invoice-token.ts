import { generateInvoiceToken } from '../src/utils/invoiceToken';

const token = generateInvoiceToken();
console.log('Generated token:', token);
if (!token.startsWith('inv_') || token.length < 50) {
    console.error('Invalid token format');
    process.exit(1);
}
console.log('Token generation test passed!');
