import prisma from '../config/prisma';

export interface GoqrisConfig {
    apiKey: string;
    projectName: string;
    callbackUrl?: string;
    webhookSecret?: string;
    isActive: boolean;
    expiryMinutes: number;
    adminFee: number;
    adminFeePercent: number;
}

export async function getGoqrisConfig(): Promise<GoqrisConfig> {
    try {
        const settings = await prisma.payment_settings.findUnique({
            where: { gateway_name: 'goqris' }
        });

        if (settings) {
            return {
                apiKey: settings.api_key || process.env.GOQRIS_API_KEY || 'GO_G53XrncWJRxmee',
                projectName: settings.project_name || process.env.GOQRIS_PROJECT_NAME || 'Ziqva Labs',
                callbackUrl: settings.callback_url || process.env.GOQRIS_CALLBACK_URL || '',
                webhookSecret: settings.webhook_secret || process.env.GOQRIS_WEBHOOK_SECRET || '',
                isActive: settings.is_active ?? true,
                expiryMinutes: settings.expiry_minutes || 1440,
                adminFee: settings.admin_fee || 0,
                adminFeePercent: settings.admin_fee_percent || 0
            };
        }
    } catch (e) {
        console.error('Failed to load payment_settings from DB:', e);
    }

    return {
        apiKey: process.env.GOQRIS_API_KEY || 'GO_G53XrncWJRxmee',
        projectName: process.env.GOQRIS_PROJECT_NAME || 'Ziqva Labs',
        callbackUrl: process.env.GOQRIS_CALLBACK_URL || '',
        webhookSecret: process.env.GOQRIS_WEBHOOK_SECRET || '',
        isActive: process.env.GOQRIS_IS_ACTIVE !== 'false',
        expiryMinutes: parseInt(process.env.GOQRIS_EXPIRY_MINUTES || '1440', 10),
        adminFee: parseInt(process.env.GOQRIS_ADMIN_FEE || '0', 10),
        adminFeePercent: parseFloat(process.env.GOQRIS_ADMIN_FEE_PERCENT || '0')
    };
}

const GOQRIS_BASE_URL = 'https://api.goqris.web.id';

export async function goqrisRequest(path: string, body: Record<string, any>) {
    const config = await getGoqrisConfig();

    if (!config.isActive) {
        throw new Error('Metode pembayaran GoQRIS sedang dinonaktifkan sementara oleh Administrator.');
    }

    if (!config.apiKey) {
        throw new Error('GoQRIS API Key belum dikonfigurasi.');
    }

    const response = await fetch(`${GOQRIS_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apikey: config.apiKey, ...body }),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok || !payload || payload.status !== 'success') {
        const errorMsg = payload?.message || `GoQRIS HTTP Error ${response.status}`;
        throw new Error(errorMsg);
    }
    return payload;
}

export interface CreateGoqrisOrderParams {
    refId: string;
    amount: number;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    callbackUrl?: string;
    eventOrigin?: string;
}

export async function createGoqrisOrder(params: CreateGoqrisOrderParams) {
    const config = await getGoqrisConfig();

    if (!config.isActive) {
        throw new Error('Pembelian dinonaktifkan sementara karena gateway pembayaran sedang dipelihara.');
    }

    // Calculate Admin Fee (Flat + Percent)
    let extraFee = config.adminFee;
    if (config.adminFeePercent > 0) {
        extraFee += Math.round((params.amount * config.adminFeePercent) / 100);
    }

    const finalAmount = params.amount + extraFee;

    const requestBody: Record<string, any> = {
        nama_project: config.projectName,
        ref_id: params.refId,
        amount: finalAmount,
        customer_name: params.customerName || 'Customer',
        customer_email: params.customerEmail || '',
        customer_phone: params.customerPhone || '',
        expired: config.expiryMinutes || 1440 // in minutes (24 hours)
    };

    // Sertakan callback_url jika dikonfigurasi di setting / parameter
    const effectiveCallbackUrl = params.callbackUrl || config.callbackUrl;
    if (effectiveCallbackUrl) {
        requestBody.callback_url = effectiveCallbackUrl;
    }

    // Sertakan event_origin jika ada
    if (params.eventOrigin) {
        requestBody.event_origin = params.eventOrigin;
    }

    const payload = await goqrisRequest('/order', requestBody);

    return {
        ...payload,
        calculatedAdminFee: extraFee
    };
}

export async function checkGoqrisStatus(refId: string) {
    return goqrisRequest('/status', { ref_id: refId });
}
