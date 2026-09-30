// Xendit Configuration
export const xenditConfig = {
    secretKey: process.env.XENDIT_SECRET_KEY || '',
    publicKey: process.env.XENDIT_PUBLIC_KEY || '',
    webhookToken: process.env.XENDIT_WEBHOOK_TOKEN || '',
    callbackUrl: process.env.XENDIT_CALLBACK_URL || '',
    baseUrl: 'https://api.xendit.co',

    // Payment Settings
    adminFeePercent: parseInt(process.env.PAYMENT_ADMIN_FEE_PERCENT || '0'),
    expiryHours: parseInt(process.env.PAYMENT_EXPIRY_HOURS || '24'),
};

// Get Basic Auth header
export const getXenditAuthHeader = (): string => {
    const credentials = Buffer.from(`${xenditConfig.secretKey}:`).toString('base64');
    return `Basic ${credentials}`;
};
