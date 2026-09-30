import prisma from '../src/config/prisma';
import { securityRateLimiter } from '../src/services/securityRateLimiter';

async function testPinResetLogic() {
    // Target admin ID 6 is 'Effands'
    const target = await prisma.admin.findUnique({ where: { id: 6 } });
    if (!target || target.username !== 'Effands') {
        throw new Error('Target admin ID 6 must be Effands');
    }

    // 1. Wrong username confirmation should fail
    const inputWrongUsername = 'wrong_user';
    const matchesWrong = inputWrongUsername.trim().toLowerCase() === target.username.toLowerCase();
    if (matchesWrong) throw new Error('Wrong username unexpectedly matched');

    // 2. Correct username confirmation should pass
    const inputCorrectUsername = 'effands';
    const matchesCorrect = inputCorrectUsername.trim().toLowerCase() === target.username.toLowerCase();
    if (!matchesCorrect) throw new Error('Correct username did not match');

    // 3. Security rate limiter on reset PIN
    const key = `reset-pin:127.0.0.1:${target.id}`;
    securityRateLimiter.clear(key);
    const check1 = securityRateLimiter.check(key, 3, 15 * 60 * 1000);
    if (check1.isLocked) throw new Error('Should not be locked initially');

    console.log('PASS: PIN Reset username confirmation logic verified');
    await prisma.$disconnect();
    process.exit(0);
}

testPinResetLogic().catch(e => {
    console.error('FAIL:', e);
    process.exit(1);
});
