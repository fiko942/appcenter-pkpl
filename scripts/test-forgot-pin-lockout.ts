import { securityRateLimiter } from '../src/services/securityRateLimiter';
import { adminRateLimiter } from '../src/services/adminRateLimiter';
import { adminController } from '../src/controllers/adminController';
import { Request, Response } from 'express';

function mockReqRes(body: any, ip: string = '127.0.0.1') {
    let statusCode = 200;
    let jsonResult: any = null;

    const req = {
        body,
        ip,
        headers: {},
        socket: { remoteAddress: ip }
    } as unknown as Request;

    const res = {
        status(code: number) {
            statusCode = code;
            return this;
        },
        json(data: any) {
            jsonResult = data;
            return this;
        }
    } as unknown as Response;

    return { req, res, getStatus: () => statusCode, getJson: () => jsonResult };
}

async function runTest() {
    console.log('=== TEST: Strict Unified OTP Lockout & Brute-Force Protection ===\n');

    // Step 0: Clear all previous rate limiters
    securityRateLimiter.clearAll();
    adminRateLimiter.clearAll();

    const testIp = '192.168.1.99';
    const testUsername = 'fiko942';

    // Step 1: Request OTP for fiko942
    console.log('1. Requesting OTP for admin:', testUsername);
    const step1 = mockReqRes({ username: testUsername }, testIp);
    await adminController.apiForgotPinRequestOtp(step1.req, step1.res);
    console.log('   Response status:', step1.getStatus());
    console.log('   Response json:', step1.getJson());
    if (step1.getStatus() !== 200 || !step1.getJson()?.success) {
        throw new Error('Step 1 failed: Expected successful OTP request');
    }

    // Step 2: Attempt wrong OTP #1
    console.log('\n2. Submitting Wrong OTP #1...');
    const step2 = mockReqRes({ username: testUsername, otp: '111111' }, testIp);
    await adminController.apiForgotPinVerifyOtp(step2.req, step2.res);
    console.log('   Response status:', step2.getStatus());
    console.log('   Response json:', step2.getJson());
    if (step2.getStatus() !== 400 || step2.getJson()?.attemptsLeft !== 2) {
        throw new Error('Step 2 failed: Expected 400 and attemptsLeft=2');
    }

    // Step 3: Attempt wrong OTP #2
    console.log('\n3. Submitting Wrong OTP #2...');
    const step3 = mockReqRes({ username: testUsername, otp: '222222' }, testIp);
    await adminController.apiForgotPinVerifyOtp(step3.req, step3.res);
    console.log('   Response status:', step3.getStatus());
    console.log('   Response json:', step3.getJson());
    if (step3.getStatus() !== 400 || step3.getJson()?.attemptsLeft !== 1) {
        throw new Error('Step 3 failed: Expected 400 and attemptsLeft=1');
    }

    // Step 4: Attempt wrong OTP #3 (Trigger Lockout)
    console.log('\n4. Submitting Wrong OTP #3 (Lockout Trigger)...');
    const step4 = mockReqRes({ username: testUsername, otp: '333333' }, testIp);
    await adminController.apiForgotPinVerifyOtp(step4.req, step4.res);
    console.log('   Response status:', step4.getStatus());
    console.log('   Response json:', step4.getJson());
    if (step4.getStatus() !== 429 || !step4.getJson()?.isLocked) {
        throw new Error('Step 4 failed: Expected 429 Too Many Requests and isLocked=true');
    }

    // Step 5: Verify that Request OTP / Resend is BLOCKED during lockout
    console.log('\n5. Attempting to Request OTP / Resend for fiko942 while locked out...');
    const step5 = mockReqRes({ username: testUsername }, testIp);
    await adminController.apiForgotPinRequestOtp(step5.req, step5.res);
    console.log('   Response status:', step5.getStatus());
    console.log('   Response json:', step5.getJson());
    if (step5.getStatus() !== 429 || !step5.getJson()?.isLocked) {
        throw new Error('Step 5 failed: Resend/Request OTP MUST be blocked (429) during lockout!');
    }

    // Step 6: Verify that requesting OTP for another admin from SAME IP is also BLOCKED
    console.log('\n6. Attempting to Request OTP for Effands from SAME locked IP...');
    const step6 = mockReqRes({ username: 'Effands' }, testIp);
    await adminController.apiForgotPinRequestOtp(step6.req, step6.res);
    console.log('   Response status:', step6.getStatus());
    console.log('   Response json:', step6.getJson());
    if (step6.getStatus() !== 429 || !step6.getJson()?.isLocked) {
        throw new Error('Step 6 failed: IP Lockout MUST block requests for any admin account!');
    }

    // Step 7: Verify that requesting OTP for the LOCKED admin account from ANOTHER IP is also BLOCKED
    console.log('\n7. Attempting to Request OTP for fiko942 from ANOTHER IP (Account Lockout test)...');
    const step7 = mockReqRes({ username: testUsername }, '203.0.113.50');
    await adminController.apiForgotPinRequestOtp(step7.req, step7.res);
    console.log('   Response status:', step7.getStatus());
    console.log('   Response json:', step7.getJson());
    if (step7.getStatus() !== 429 || !step7.getJson()?.isLocked) {
        throw new Error('Step 7 failed: Account Lockout MUST block requests for target admin account from any IP!');
    }

    // Step 8: Clean up
    securityRateLimiter.clearAll();
    adminRateLimiter.clearAll();

    console.log('\n======================================================');
    console.log('ALL TESTS PASSED: Strict Unified OTP Lockout Verified!');
    console.log('======================================================\n');
    process.exit(0);
}

runTest().catch((err) => {
    console.error('Test Error:', err);
    process.exit(1);
});
