import { adminRateLimiter } from '../src/services/adminRateLimiter';
import { securityRateLimiter } from '../src/services/securityRateLimiter';

function testAdminLoginLimiter() {
    const testIp = '198.51.100.25';
    adminRateLimiter.recordSuccess(testIp); // clear

    let status = adminRateLimiter.check(testIp);
    if (status.isLocked || status.attemptsLeft !== 3) throw new Error('Initial status incorrect');

    // 1st failure
    let fail1 = adminRateLimiter.recordFailure(testIp);
    if (fail1.isLocked || fail1.attemptsLeft !== 2) throw new Error('Attempt 1 failed state mismatch');

    // 2nd failure
    let fail2 = adminRateLimiter.recordFailure(testIp);
    if (fail2.isLocked || fail2.attemptsLeft !== 1) throw new Error('Attempt 2 failed state mismatch');

    // 3rd failure -> Level 1 Lockout (5 minutes = 300s)
    let fail3 = adminRateLimiter.recordFailure(testIp);
    if (!fail3.isLocked || fail3.remainingSeconds < 290 || fail3.lockoutMinutes !== 5) {
        throw new Error(`Lockout level 1 duration mismatch: remaining=${fail3.remainingSeconds}, minutes=${fail3.lockoutMinutes}`);
    }

    console.log('PASS: adminLoginLimiter lockout verified');
}

function testSecurityRateLimiter() {
    const key = 'pin-reset:admin:127.0.0.1:2';
    securityRateLimiter.clear(key);

    let check = securityRateLimiter.check(key, 3, 15 * 60 * 1000);
    if (check.isLocked || check.attemptsLeft !== 3) throw new Error('Initial security limiter mismatch');

    securityRateLimiter.recordFailure(key, 3, 15 * 60 * 1000);
    securityRateLimiter.recordFailure(key, 3, 15 * 60 * 1000);
    let locked = securityRateLimiter.recordFailure(key, 3, 15 * 60 * 1000);

    if (!locked.isLocked || locked.attemptsLeft !== 0) throw new Error('Security limiter did not lock out after 3 failures');

    console.log('PASS: securityRateLimiter verified');
}

try {
    testAdminLoginLimiter();
    testSecurityRateLimiter();
    console.log('ALL RATE LIMITER TESTS PASSED');
    process.exit(0);
} catch (e) {
    console.error('FAIL:', e);
    process.exit(1);
}
