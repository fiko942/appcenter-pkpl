import { Request, Response } from 'express';
import crypto from 'crypto';
import prisma from '../config/prisma';
import { getGoqrisConfig } from '../services/goqrisService';
import { adminController } from './adminController';

class PaymentNotificationController {
    /**
     * API: Polling GoQRIS Payment Status
     * Frontend will call this endpoint repeatedly every 3 seconds to check if payment is complete.
     * Note: GoQRIS now uses Webhook / Callback push notifications.
     * This endpoint now queries the local database first (which is updated instantly by Webhook),
     * and returns the current payment status gracefully without throwing GoQRIS `/status` deprecated errors.
     */
    async checkGoqrisPaymentStatus(req: Request, res: Response) {
        try {
            const orderIdStr = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
            if (!orderIdStr) {
                return res.status(400).json({ status: 'error', message: 'Order ID is required' });
            }

            const order = await prisma.order_list.findUnique({
                where: { id: parseInt(orderIdStr, 10) }
            });

            if (!order) {
                return res.status(404).json({ status: 'error', message: 'Order not found' });
            }

            // Jika status order di database sudah berstatus complete/paid (diupdate via Webhook GoQRIS)
            const isAlreadyPaid = order.status === 'Order has been complete' || order.status === 'PAID' || !!order.paid_at;
            if (isAlreadyPaid) {
                return res.json({ status: 'success', payment_status: 'paid' });
            }

            // Status masih pending menunggu webhook callback dari GoQRIS
            return res.json({ status: 'success', payment_status: 'pending' });

        } catch (error: any) {
            console.error('Check GoQRIS status error:', error);
            return res.json({ status: 'success', payment_status: 'pending', error_detail: error.message });
        }
    }

    /**
     * API: GoQRIS Webhook / Callback Handler
     * GoQRIS sends a POST request here when payment is completed.
     * Specification:
     * - Event: 'payment.paid'
     * - Header: X-GoQRIS-Signature = sha256=<hmac_hex> (computed on raw request body)
     * - Header: X-GoQRIS-Delivery = delivery ID for idempotency
     */
    async handleGoqrisWebhook(req: Request, res: Response) {
        try {
            const body = req.body || {};
            console.log('GoQRIS Webhook received:', JSON.stringify(body));

            const config = await getGoqrisConfig();

            // 1. Verify HMAC-SHA256 Signature if webhook_secret is configured
            const sigHeader = req.header('X-GoQRIS-Signature') || (req.headers['x-goqris-signature'] as string) || '';
            const webhookSecret = config.webhookSecret;

            if (webhookSecret && sigHeader) {
                const rawBody = (req as any).rawBody || Buffer.from(JSON.stringify(body));
                const expectedSignature = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');

                try {
                    const isValidSig = crypto.timingSafeEqual(Buffer.from(sigHeader), Buffer.from(expectedSignature));
                    if (!isValidSig) {
                        console.warn('GoQRIS Webhook Signature mismatch. Received:', sigHeader, 'Expected:', expectedSignature);
                        return res.status(401).json({ status: 'error', message: 'Invalid signature' });
                    }
                } catch {
                    console.warn('GoQRIS Webhook Signature length mismatch or malformed signature');
                    return res.status(401).json({ status: 'error', message: 'Invalid signature format' });
                }
            }

            // 2. Extract event data (support standard GoQRIS format or direct payload format)
            const eventType = req.header('X-GoQRIS-Event') || body.event || '';
            const eventData = body.data || body;
            const refId = eventData.ref_id || body.ref_id;
            const paymentStatus = eventData.payment_status || body.payment_status || '';
            const totalAmountFromPayload = eventData.total_amount ? Number(eventData.total_amount) : (body.total_amount ? Number(body.total_amount) : 0);
            const trxId = eventData.trx_id || body.trx_id || 'GOQRIS_WEBHOOK';

            if (!refId) {
                return res.status(400).json({ status: 'error', message: 'Missing ref_id' });
            }

            // 3. Find order by ref_id or payment_request_id
            const order = await prisma.order_list.findFirst({
                where: {
                    OR: [
                        { payment_request_id: refId },
                        { id: parseInt(refId.replace(/\D/g, ''), 10) || 0 }
                    ]
                }
            });

            if (!order) {
                return res.status(404).json({ status: 'error', message: 'Order not found' });
            }

            // 4. Idempotency: if already paid, return 200 OK immediately
            const isAlreadyPaid = order.status === 'Order has been complete' || order.status === 'PAID' || !!order.paid_at;
            if (isAlreadyPaid) {
                return res.json({ status: 'success', message: 'Order already completed (idempotent response)' });
            }

            // 5. Match amounts if available to prevent underpayment spoofing
            const expectedAmount = Number(order.total_amount || 0);
            if (totalAmountFromPayload > 0 && expectedAmount > 0) {
                if (totalAmountFromPayload < expectedAmount) {
                    console.warn(`GoQRIS Webhook total_amount mismatch for Order #${order.id}. Received: ${totalAmountFromPayload}, Expected: ${expectedAmount}`);
                    return res.status(400).json({ status: 'error', message: 'Amount mismatch' });
                }
            }

            // 6. Confirm status: check either signature verified payment.paid or payment_status === 'paid'
            const isPaidEvent = eventType === 'payment.paid' || paymentStatus.toLowerCase() === 'paid' || paymentStatus.toLowerCase() === 'success';

            if (isPaidEvent) {
                // Call unified processOrderSuccess to generate license, machine tokens, and affiliate rewards
                await adminController.processOrderSuccess(order.id, trxId);

                return res.json({ status: 'success', message: 'Payment confirmed and order processed' });
            }

            return res.json({ status: 'success', message: 'Webhook received but payment is not paid yet', current_status: paymentStatus });
        } catch (error: any) {
            console.error('GoQRIS Webhook error:', error);
            return res.status(500).json({ status: 'error', message: 'Internal Server Error', error_detail: error.message });
        }
    }
}

export const paymentNotificationController = new PaymentNotificationController();
