import { xenditConfig, getXenditAuthHeader } from '../config/xendit';

interface PaymentRequestParams {
    referenceId: string;
    amount: number;
    channelCode: string;
    customerEmail: string;
    customerName: string;
    description: string;
    successUrl?: string;
    failureUrl?: string;
    metadata?: Record<string, any>;
}

interface XenditPaymentResponse {
    payment_request_id: string;
    reference_id: string;
    status: string;
    request_amount: number;
    channel_code: string;
    actions?: Array<{
        type: string;
        value: string;
        descriptor: string;
    }>;
    channel_properties?: {
        virtual_account_number?: string;
        qr_string?: string;
        expires_at?: string;
    };
    created: string;
}

interface InvoiceParams {
    externalId: string;
    amount: number;
    payerEmail: string;
    description: string;
    shouldSendEmail: boolean;
    customer: {
        given_names: string;
        email: string;
    };
    invoiceDuration?: number; // seconds
}

interface XenditInvoiceResponse {
    id: string;
    external_id: string;
    status: string;
    amount: number;
    payer_email: string;
    invoice_url: string;
    expiry_date: string;
    created: string;
    updated: string;
}

export class XenditService {
    private baseUrl = xenditConfig.baseUrl;

    /**
     * Create a new payment request (Invoice for generic checkout)
     */
    async createInvoice(params: InvoiceParams): Promise<XenditInvoiceResponse> {
        const requestBody = {
            external_id: params.externalId,
            amount: params.amount,
            description: params.description,
            invoice_duration: params.invoiceDuration || xenditConfig.expiryHours * 3600,
            payer_email: params.payerEmail,
            should_send_email: params.shouldSendEmail,
            customer: params.customer,
            currency: 'IDR'
        };

        const response = await fetch(`${this.baseUrl}/v2/invoices`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getXenditAuthHeader(),
                'x-api-version': '2020-05-31', // or latest stable
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            const errorData = await response.json() as { message?: string };
            throw new Error(errorData.message || `Xendit API error: ${response.status}`);
        }

        return await response.json() as XenditInvoiceResponse;
    }

    /**
     * Legacy: Create a new single-channel payment request
     * Kept for reference but implementation switched to Invoices for flexibility
     */
    async createPaymentRequest(params: PaymentRequestParams): Promise<XenditPaymentResponse> {
        // ... implementation kept for compatibility or fallback ...
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + xenditConfig.expiryHours);

        // Determine channel properties based on channel code
        const channelProperties: Record<string, any> = {};

        if (params.channelCode.includes('VIRTUAL_ACCOUNT')) {
            channelProperties.display_name = params.customerName;
            channelProperties.expires_at = expiresAt.toISOString();
        } else if (['DANA', 'OVO', 'GOPAY', 'SHOPEEPAY', 'LINKAJA'].includes(params.channelCode)) {
            channelProperties.success_return_url = params.successUrl || `${xenditConfig.callbackUrl}/success`;
            channelProperties.failure_return_url = params.failureUrl || `${xenditConfig.callbackUrl}/failure`;
        } else if (params.channelCode === 'QRIS') {
            channelProperties.qr_string_type = 'DYNAMIC';
            channelProperties.expires_at = expiresAt.toISOString();
        }

        const requestBody = {
            reference_id: params.referenceId,
            type: 'PAY',
            country: 'ID',
            currency: 'IDR',
            request_amount: params.amount,
            capture_method: 'AUTOMATIC',
            channel_code: params.channelCode,
            channel_properties: channelProperties,
            description: params.description,
            customer: {
                type: 'INDIVIDUAL',
                reference_id: `cust_${params.referenceId}`,
                individual_detail: {
                    given_names: params.customerName,
                },
                email: params.customerEmail,
            },
            metadata: params.metadata || {},
        };

        const response = await fetch(`${this.baseUrl}/v3/payment_requests`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': getXenditAuthHeader(),
                'x-api-version': '2020-05-31', // or latest stable
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            const errorData = await response.json() as { message?: string };
            throw new Error(errorData.message || `Xendit API error: ${response.status}`);
        }

        return await response.json() as XenditPaymentResponse;
    }

    /**
     * Get payment request by ID
     */
    async getPaymentRequest(paymentRequestId: string): Promise<XenditPaymentResponse> {
        const response = await fetch(`${this.baseUrl}/v3/payment_requests/${paymentRequestId}`, {
            method: 'GET',
            headers: {
                'Authorization': getXenditAuthHeader(),
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            const errorData = await response.json() as { message?: string };
            throw new Error(errorData.message || `Xendit API error: ${response.status}`);
        }

        return await response.json() as XenditPaymentResponse;
    }

    /**
     * Verify webhook callback token
     */
    verifyWebhookToken(token: string): boolean {
        return token === xenditConfig.webhookToken;
    }

    /**
     * Extract payment details from Xendit response (supports both Invoice and Payment Request)
     */
    extractPaymentDetails(response: unknown): {
        paymentRequestId: string;
        paymentUrl: string | null;
        vaNumber: string | null;
        qrString: string | null;
        expiresAt: number | null;
    } {
        interface InvoiceResponse {
            id: string;
            invoice_url: string;
            expiry_date: string;
        }

        interface PaymentResponse {
            payment_request_id: string;
            actions?: Array<{ type: string; value: string }>;
            channel_properties?: Record<string, string | undefined>;
        }

        const data = response as Partial<InvoiceResponse> & Partial<PaymentResponse>;

        // Handle Invoice Response
        if (data.invoice_url && data.id) {
            return {
                paymentRequestId: data.id,
                paymentUrl: data.invoice_url,
                vaNumber: null,
                qrString: null,
                expiresAt: data.expiry_date ? Math.floor(new Date(data.expiry_date).getTime() / 1000) : null,
            };
        }

        // Handle Payment Request Response (Legacy)
        let paymentUrl: string | null = null;
        let vaNumber: string | null = null;
        let qrString: string | null = null;
        let expiresAt: number | null = null;

        if (data.actions && Array.isArray(data.actions)) {
            const redirectAction = data.actions.find(a => a.type === 'REDIRECT_CUSTOMER');
            if (redirectAction) {
                paymentUrl = redirectAction.value;
            }
        }

        if (data.channel_properties) {
            const props = data.channel_properties;
            if (props.virtual_account_number) {
                vaNumber = props.virtual_account_number;
            }
            if (props.qr_string) {
                qrString = props.qr_string;
            }
            if (props.expires_at) {
                expiresAt = Math.floor(new Date(props.expires_at).getTime() / 1000);
            }
        }

        return {
            paymentRequestId: data.payment_request_id || '',
            paymentUrl,
            vaNumber,
            qrString,
            expiresAt,
        };
    }
}

export const xenditService = new XenditService();
