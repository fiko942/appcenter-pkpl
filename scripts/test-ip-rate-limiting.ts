import { getClientIp } from '../src/utils/ipHelper';
import { adminRateLimiter } from '../src/services/adminRateLimiter';
import { securityRateLimiter } from '../src/services/securityRateLimiter';

function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        process.exit(1);
    }
    console.log(`✅ PASS: ${message}`);
}

async function runTests() {
    console.log('====================================================');
    console.log('  RUNNING TRUE CLIENT IP & RATE LIMITING ISOLATION TESTS');
    console.log('====================================================\n');

    // ----------------------------------------------------
    // TEST 1: Header Resolution & Normalization in getClientIp
    // ----------------------------------------------------
    console.log('--- TEST 1: IP Extraction and Cleaning ---');

    // 1.1 Cloudflare header priority
    const reqCf: any = {
        headers: {
            'cf-connecting-ip': '198.51.100.15',
            'x-real-ip': '198.51.100.87',
            'x-forwarded-for': '198.51.100.87'
        }
    };
    assert(getClientIp(reqCf) === '198.51.100.15', 'Cloudflare CF-Connecting-IP takes highest priority');

    // 1.2 Nginx X-Real-IP
    const reqNginx: any = {
        headers: {
            'x-real-ip': '203.0.113.226',
            'x-forwarded-for': '203.0.113.226, 127.0.0.1'
        }
    };
    assert(getClientIp(reqNginx) === '203.0.113.226', 'Nginx X-Real-IP is correctly extracted');

    // 1.3 X-Forwarded-For comma chain
    const reqChain: any = {
        headers: {
            'x-forwarded-for': '192.0.2.116, 10.0.0.1, 192.168.1.1'
        }
    };
    assert(getClientIp(reqChain) === '192.0.2.116', 'First client IP in X-Forwarded-For chain is extracted');

    // 1.4 IPv6-mapped IPv4 prefix stripping
    const reqIpv6Mapped: any = {
        socket: { remoteAddress: '::ffff:198.51.100.228' },
        headers: {}
    };
    assert(getClientIp(reqIpv6Mapped) === '198.51.100.228', 'IPv6-mapped ::ffff: prefix is stripped to clean IPv4');

    // 1.5 Localhost loopback normalization
    const reqLoopback: any = {
        ip: '::1',
        headers: {}
    };
    assert(getClientIp(reqLoopback) === '127.0.0.1', 'IPv6 loopback ::1 is normalized to 127.0.0.1');

    // ----------------------------------------------------
    // TEST 2: Admin Login Rate Limiting IP Isolation
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Admin Login PIN Rate Limiting Isolation ---');
    const ipAttacker = '198.51.100.88';
    const ipLegit = '203.0.113.99';

    // Clear state
    adminRateLimiter.clearAll();

    // Attacker makes 3 failed attempts
    adminRateLimiter.recordFailure(ipAttacker);
    adminRateLimiter.recordFailure(ipAttacker);
    const lockAttacker = adminRateLimiter.recordFailure(ipAttacker);

    assert(lockAttacker.isLocked === true, 'Attacker IP is locked out after 3 failed attempts');
    assert(lockAttacker.attemptsLeft === 0, 'Attacker IP has 0 attempts left');

    // Legit admin from different IP checks status
    const legitStatus = adminRateLimiter.check(ipLegit);
    assert(legitStatus.isLocked === false, 'Legit user IP is NOT locked out');
    assert(legitStatus.attemptsLeft === 3, 'Legit user IP has full 3 attempts available');

    // ----------------------------------------------------
    // TEST 3: Member Login Rate Limiting Isolation
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Member Login Rate Limiting Isolation ---');
    const memberIpA = '198.51.100.10';
    const memberIpB = '203.0.113.25';
    const memberEmailA = 'victim@example.com';
    const memberEmailB = 'innocent@example.com';

    securityRateLimiter.clearAll();

    // Attacker fails 5 times against memberEmailA from memberIpA
    for (let i = 0; i < 5; i++) {
        securityRateLimiter.recordFailure(`member-login:ip:${memberIpA}`, 5, 15 * 60 * 1000);
        securityRateLimiter.recordFailure(`member-login:account:${memberEmailA}`, 5, 15 * 60 * 1000);
    }

    const checkIpA = securityRateLimiter.check(`member-login:ip:${memberIpA}`, 5, 15 * 60 * 1000);
    const checkAccountA = securityRateLimiter.check(`member-login:account:${memberEmailA}`, 5, 15 * 60 * 1000);
    assert(checkIpA.isLocked === true, 'Member IP A is locked out after 5 failures');
    assert(checkAccountA.isLocked === true, 'Member Account A is locked out after 5 failures');

    // Member B from memberIpB attempting memberEmailB
    const checkIpB = securityRateLimiter.check(`member-login:ip:${memberIpB}`, 5, 15 * 60 * 1000);
    const checkAccountB = securityRateLimiter.check(`member-login:account:${memberEmailB}`, 5, 15 * 60 * 1000);
    assert(checkIpB.isLocked === false, 'Member IP B is NOT affected and is NOT locked');
    assert(checkAccountB.isLocked === false, 'Member Account B is NOT affected and is NOT locked');
    assert(checkIpB.attemptsLeft === 5, 'Member IP B has full 5 attempts remaining');

    // ----------------------------------------------------
    // TEST 4: Registration OTP & Reset Password Isolation
    // ----------------------------------------------------
    console.log('\n--- TEST 4: OTP Verification Brute-Force Isolation ---');
    const otpIpA = '198.51.100.55';
    const otpIpB = '203.0.113.77';
    const regEmail = 'newuser@domain.com';

    // Attacker on IP A tries 5 wrong OTP guesses
    for (let i = 0; i < 5; i++) {
        securityRateLimiter.recordFailure(`register-otp-verify:${otpIpA}:${regEmail}`, 5, 15 * 60 * 1000);
    }

    const otpLockA = securityRateLimiter.check(`register-otp-verify:${otpIpA}:${regEmail}`, 5, 15 * 60 * 1000);
    assert(otpLockA.isLocked === true, 'IP A is locked out from guessing OTP');

    // User on IP B tries to verify OTP for the same or different email
    const otpCheckB = securityRateLimiter.check(`register-otp-verify:${otpIpB}:${regEmail}`, 5, 15 * 60 * 1000);
    assert(otpCheckB.isLocked === false, 'IP B is completely unaffected and free to verify OTP');
    assert(otpCheckB.attemptsLeft === 5, 'IP B retains all 5 attempts');

    console.log('\n====================================================');
    console.log('  ALL TRUE CLIENT IP RATE LIMITING TESTS PASSED 100%');
    console.log('====================================================\n');
}

runTests().then(() => process.exit(0)).catch((err) => {
    console.error('Fatal Test Error:', err);
    process.exit(1);
});
