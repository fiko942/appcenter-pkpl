import crypto from 'crypto';
import prisma from '../config/prisma';

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
