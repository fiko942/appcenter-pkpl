/**
 * Generic Strict Security Rate Limiter
 * Used for critical operations: PIN reset, PIN update, OTP request, credential modifications.
 */

interface SecurityAttemptRecord {
    attempts: number;
    lockedUntil: number | null;
    firstAttemptAt: number;
    lastAttemptAt: number;
}

export interface SecurityCheckResult {
    isLocked: boolean;
    remainingSeconds: number;
    attemptsLeft: number;
    message?: string;
}

class SecurityRateLimiter {
    private records: Map<string, SecurityAttemptRecord> = new Map();

    constructor() {
        // Cleanup inactive records periodically
        const timer = setInterval(() => this.cleanup(), 10 * 60 * 1000);
        if (timer && typeof timer.unref === 'function') {
            timer.unref();
        }
    }

    /**
     * Check rate limit status for given key (e.g. `reset-pin:${ip}:${adminId}`)
     */
    check(key: string, maxAttempts = 3, _lockoutDurationMs = 15 * 60 * 1000): SecurityCheckResult {
        const record = this.records.get(key);
        if (!record) {
            return { isLocked: false, remainingSeconds: 0, attemptsLeft: maxAttempts };
        }

        const now = Date.now();
        if (record.lockedUntil && record.lockedUntil > now) {
            const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
            return {
                isLocked: true,
                remainingSeconds,
                attemptsLeft: 0,
                message: `Terlalu banyak percobaan. Akses dibatasi secara ketat. Silakan tunggu ${Math.ceil(remainingSeconds / 60)} menit.`
            };
        }

        if (record.lockedUntil && record.lockedUntil <= now) {
            this.records.delete(key);
            return { isLocked: false, remainingSeconds: 0, attemptsLeft: maxAttempts };
        }

        const attemptsLeft = Math.max(0, maxAttempts - record.attempts);
        return {
            isLocked: false,
            remainingSeconds: 0,
            attemptsLeft
        };
    }

    /**
     * Record a failure attempt for given key
     */
    recordFailure(key: string, maxAttempts = 3, lockoutDurationMs = 15 * 60 * 1000): SecurityCheckResult {
        const now = Date.now();
        let record = this.records.get(key);

        if (!record || (record.lockedUntil && record.lockedUntil <= now)) {
            record = {
                attempts: 0,
                lockedUntil: null,
                firstAttemptAt: now,
                lastAttemptAt: now
            };
            this.records.set(key, record);
        }

        record.attempts += 1;
        record.lastAttemptAt = now;

        if (record.attempts >= maxAttempts) {
            record.lockedUntil = now + lockoutDurationMs;
            const remainingSeconds = Math.ceil(lockoutDurationMs / 1000);
            return {
                isLocked: true,
                remainingSeconds,
                attemptsLeft: 0,
                message: `Batas percobaan tercapai (${maxAttempts}x). Akses dibatasi selama ${Math.ceil(remainingSeconds / 60)} menit.`
            };
        }

        const attemptsLeft = maxAttempts - record.attempts;
        return {
            isLocked: false,
            remainingSeconds: 0,
            attemptsLeft,
            message: `Percobaan gagal. Sisa kesempatan: ${attemptsLeft} kali.`
        };
    }

    /**
     * Clear rate limit on successful operation
     */
    clear(key: string): void {
        this.records.delete(key);
    }

    /**
     * Clear all records
     */
    clearAll(): void {
        this.records.clear();
    }

    private cleanup(): void {
        const oneHourAgo = Date.now() - (60 * 60 * 1000);
        for (const [key, record] of this.records.entries()) {
            if (record.lastAttemptAt < oneHourAgo && (!record.lockedUntil || record.lockedUntil < Date.now())) {
                this.records.delete(key);
            }
        }
    }
}

export const securityRateLimiter = new SecurityRateLimiter();
