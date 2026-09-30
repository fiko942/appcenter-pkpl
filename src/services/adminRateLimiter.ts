/**
 * Strict Admin Login Rate Limiter Service
 * Enforces max 3 attempts with 2-hour lockout (7200s / 120 minutes)
 */

interface AttemptRecord {
    failedAttempts: number;
    lockoutLevel: number;
    lockedUntil: number | null; // Epoch ms timestamp
    lastFailedAt: number;       // Epoch ms timestamp
}

export interface RateLimitCheckResult {
    isLocked: boolean;
    remainingSeconds: number;
    attemptsLeft: number;
    lockoutMinutes: number;
    failedAttempts: number;
    message?: string;
}

class AdminRateLimiter {
    private readonly MAX_ATTEMPTS = 3;
    private readonly LOCKOUT_DURATION_SECONDS = 2 * 60 * 60; // 2 hours (7200s)
    private attempts: Map<string, AttemptRecord> = new Map();

    constructor() {
        // Cleanup records inactive for more than 6 hours
        const timer = setInterval(() => this.cleanupOldRecords(), 15 * 60 * 1000);
        if (timer && typeof timer.unref === 'function') {
            timer.unref();
        }
    }

    /**
     * Get lockout duration in seconds (2 hours)
     */
    private getLockoutDurationSeconds(): number {
        return this.LOCKOUT_DURATION_SECONDS;
    }

    /**
     * Check rate limit status for given IP
     */
    check(ip: string): RateLimitCheckResult {
        const record = this.attempts.get(ip);
        if (!record) {
            return {
                isLocked: false,
                remainingSeconds: 0,
                attemptsLeft: this.MAX_ATTEMPTS,
                lockoutMinutes: 0,
                failedAttempts: 0
            };
        }

        const now = Date.now();

        // Check if currently locked
        if (record.lockedUntil && record.lockedUntil > now) {
            const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
            const lockoutMinutes = Math.ceil(this.getLockoutDurationSeconds() / 60);
            return {
                isLocked: true,
                remainingSeconds,
                attemptsLeft: 0,
                lockoutMinutes,
                failedAttempts: record.failedAttempts,
                message: `Percobaan login Anda sedang dibatasi. Silakan tunggu ${this.formatDuration(remainingSeconds)} sebelum mencoba kembali.`
            };
        }

        // Lockout expired - reset failed attempts for new window
        if (record.lockedUntil && record.lockedUntil <= now) {
            record.lockedUntil = null;
            record.failedAttempts = 0;
        }

        const attemptsLeft = Math.max(0, this.MAX_ATTEMPTS - record.failedAttempts);

        return {
            isLocked: false,
            remainingSeconds: 0,
            attemptsLeft,
            lockoutMinutes: 0,
            failedAttempts: record.failedAttempts
        };
    }

    /**
     * Record a failed login attempt for given IP
     */
    recordFailure(ip: string): RateLimitCheckResult {
        const now = Date.now();
        let record = this.attempts.get(ip);

        if (!record) {
            record = {
                failedAttempts: 0,
                lockoutLevel: 0,
                lockedUntil: null,
                lastFailedAt: now
            };
            this.attempts.set(ip, record);
        }

        // If lockout expired, reset attempt count
        if (record.lockedUntil && record.lockedUntil <= now) {
            record.lockedUntil = null;
            record.failedAttempts = 0;
        }

        record.failedAttempts += 1;
        record.lastFailedAt = now;

        // If reached max attempts, trigger 2-hour lockout
        if (record.failedAttempts >= this.MAX_ATTEMPTS) {
            record.lockoutLevel += 1;
            const durationSeconds = this.getLockoutDurationSeconds();
            record.lockedUntil = now + (durationSeconds * 1000);
            const lockoutMinutes = Math.ceil(durationSeconds / 60);

            return {
                isLocked: true,
                remainingSeconds: durationSeconds,
                attemptsLeft: 0,
                lockoutMinutes,
                failedAttempts: record.failedAttempts,
                message: 'Terlalu banyak percobaan PIN salah. Percobaan login Anda diblokir selama 2 jam.'
            };
        }

        const attemptsLeft = this.MAX_ATTEMPTS - record.failedAttempts;
        return {
            isLocked: false,
            remainingSeconds: 0,
            attemptsLeft,
            lockoutMinutes: 0,
            failedAttempts: record.failedAttempts,
            message: `PIN tidak valid. Sisa percobaan: ${attemptsLeft} kali lagi sebelum percobaan Anda diblokir selama 2 jam.`
        };
    }

    /**
     * Record a successful login - resets IP record
     */
    recordSuccess(ip: string): void {
        this.attempts.delete(ip);
    }

    /**
     * Clear all rate limit records
     */
    clearAll(): void {
        this.attempts.clear();
    }

    /**
     * Reset / unblock a specific IP
     */
    reset(ip: string): void {
        this.attempts.delete(ip);
    }

    /**
     * Format seconds into human readable duration
     */
    private formatDuration(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hours > 0) {
            return `${hours} jam ${mins > 0 ? mins + ' menit' : ''}`.trim();
        }
        if (mins > 0) {
            return `${mins} menit ${secs > 0 ? secs + ' detik' : ''}`.trim();
        }
        return `${secs} detik`;
    }

    /**
     * Periodic cleanup of inactive records
     */
    private cleanupOldRecords(): void {
        const sixHoursAgo = Date.now() - (6 * 60 * 60 * 1000);
        for (const [ip, record] of this.attempts.entries()) {
            if (record.lastFailedAt < sixHoursAgo && (!record.lockedUntil || record.lockedUntil < Date.now())) {
                this.attempts.delete(ip);
            }
        }
    }
}

export const adminRateLimiter = new AdminRateLimiter();
