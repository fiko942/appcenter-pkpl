import { Request } from 'express';

/**
 * Clean and sanitize IP string by stripping IPv6-mapped IPv4 prefix (::ffff:)
 * and normalizing localhost.
 */
function cleanIpString(ip: string): string {
    if (!ip) return '';
    const cleaned = ip.replace(/^::ffff:/i, '').trim();
    if (cleaned === '::1' || cleaned === 'localhost') {
        return '127.0.0.1';
    }
    return cleaned;
}

/**
 * Safely extract a single string value from a possible string or string array header.
 */
function getHeaderValue(val: string | string[] | undefined): string | null {
    if (!val) return null;
    if (Array.isArray(val)) {
        return val.length > 0 ? String(val[0]).trim() : null;
    }
    if (typeof val === 'string') {
        return val.trim();
    }
    return null;
}

/**
 * Extracts and sanitizes the true client IP address from an Express request.
 * Handles Cloudflare (CF-Connecting-IP), Nginx (X-Real-IP, X-Forwarded-For),
 * Express trust-proxy parsed IP, and socket remote address.
 */
export function getClientIp(req: Request): string {
    if (!req) return '127.0.0.1';

    // 1. Cloudflare header
    const rawCfIp = req.headers ? getHeaderValue(req.headers['cf-connecting-ip']) : null;
    if (rawCfIp) {
        const clean = cleanIpString(rawCfIp);
        if (clean) return clean;
    }

    // 2. Nginx X-Real-IP
    const rawRealIp = req.headers ? getHeaderValue(req.headers['x-real-ip']) : null;
    if (rawRealIp) {
        const clean = cleanIpString(rawRealIp);
        if (clean) return clean;
    }

    // 3. X-Forwarded-For (first IP in comma-separated chain)
    const rawForwarded = req.headers ? getHeaderValue(req.headers['x-forwarded-for']) : null;
    if (rawForwarded) {
        const firstIp = rawForwarded.split(',')[0].trim();
        const clean = cleanIpString(firstIp);
        if (clean) return clean;
    }

    // 4. Express req.ip (active when trust proxy is enabled)
    if (req.ip && typeof req.ip === 'string') {
        const clean = cleanIpString(req.ip.trim());
        if (clean) return clean;
    }

    // 5. Socket remoteAddress
    const socketIp = req.socket?.remoteAddress;
    if (socketIp && typeof socketIp === 'string') {
        const clean = cleanIpString(socketIp.trim());
        if (clean) return clean;
    }

    return '127.0.0.1';
}
