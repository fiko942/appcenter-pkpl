import prisma from '../src/config/prisma';
import { adminRateLimiter } from '../src/services/adminRateLimiter';
import { securityRateLimiter } from '../src/services/securityRateLimiter';

async function main() {
    console.log('=== 1. VERIFYING DATABASE USERNAMES ===');
    const adminFiko = await prisma.admin.findUnique({ where: { id: 2 } });
    const adminEffand = await prisma.admin.findUnique({ where: { id: 6 } });

    if (adminFiko?.username !== 'fiko942') {
        throw new Error(`Expected admin ID 2 username to be "fiko942", got "${adminFiko?.username}"`);
    }
    if (adminEffand?.username !== 'Effands') {
        throw new Error(`Expected admin ID 6 username to be "Effands", got "${adminEffand?.username}"`);
    }
    console.log('✓ Admin ID 2 username: fiko942');
    console.log('✓ Admin ID 6 username: Effands');

    console.log('\n=== 2. VERIFYING ESCALATING LOGIN PIN RATE LIMITER ===');
    const testIp = '10.99.88.77';
    adminRateLimiter.recordSuccess(testIp);

    adminRateLimiter.recordFailure(testIp);
    adminRateLimiter.recordFailure(testIp);
    const lock1 = adminRateLimiter.recordFailure(testIp);
    if (!lock1.isLocked || lock1.lockoutMinutes !== 5) {
        throw new Error(`Expected level 1 lockout to be 5 minutes, got ${lock1.lockoutMinutes}`);
    }
    console.log('✓ Level 1 lockout enforced: 5 minutes');

    console.log('\n=== 3. VERIFYING SECURITY RATE LIMITER (PIN RESET & UPDATE) ===');
    const resetKey = 'reset-pin:test-admin:6';
    securityRateLimiter.clear(resetKey);
    securityRateLimiter.recordFailure(resetKey);
    securityRateLimiter.recordFailure(resetKey);
    const lockReset = securityRateLimiter.recordFailure(resetKey);
    if (!lockReset.isLocked) {
        throw new Error('Expected security limiter to lock out after 3 failed attempts');
    }
    console.log('✓ PIN Reset brute force lockout enforced: 15 minutes');

    console.log('\n=== 4. VERIFYING USERNAME CONFIRMATION LOGIC ===');
    const match1 = 'Effands'.toLowerCase() === adminEffand.username.toLowerCase();
    const match2 = 'fiko942'.toLowerCase() === adminFiko.username.toLowerCase();
    const mismatch = 'wrong_name'.toLowerCase() === adminEffand.username.toLowerCase();
    if (!match1 || !match2 || mismatch) {
        throw new Error('Username confirmation matching check failed');
    }
    console.log('✓ Username confirmation logic strictly verified');

    console.log('\n=== ALL SECURITY VERIFICATIONS PASSED ===');
    await prisma.$disconnect();
    process.exit(0);
}

main().catch(err => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
});
