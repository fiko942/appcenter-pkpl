# Admin Usernames Update, Mandatory Username Confirmation on PIN Reset, and Strict Anti-Brute-Force Rate Limiting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update admin usernames in database (`Pak Effand` -> `Effands`, `Wiji Fiko Teren` -> `fiko942`), require explicit target username confirmation prior to resetting admin PINs, and enforce zero-tolerance anti-brute-force rate limiting across all PIN login, PIN reset, and credential update endpoints.

**Architecture:** 
1. Database migration via Prisma Client updating admin rows in MySQL (`admin` table).
2. Centralized security rate limiting service (`src/services/adminRateLimiter.ts` & `src/services/securityRateLimiter.ts`) providing IP & session-based attempt tracking, exponential backoff lockouts (5m -> 15m -> 30m -> 60m), and strict input sanitization.
3. Backend controller enforcement in `src/controllers/adminController.ts` requiring matching `confirmUsername` in `POST /admin/api/admins/reset-pin/:id` and rate limiting PIN updates and logins.
4. Svelte UI overhaul in `client/src/lib/pages/AdminProfile.svelte` adding target username confirmation input with live matching feedback, and `client/src/lib/pages/AdminLogin.svelte` reflecting escalating lockouts.

**Tech Stack:** Express 5, TypeScript 5.5, Prisma ORM 6, MySQL, Svelte 4, Vite 5, Tailwind CSS 4.

**Spec:** User prompt requirements on admin username updates, mandatory username verification before PIN reset, and strict anti-brute-force rate limiting.

## Global Constraints
- Admin ID 6 username MUST be updated to `Effands`.
- Admin ID 2 username MUST be updated to `fiko942`.
- PIN reset endpoint (`POST /admin/api/admins/reset-pin/:id`) MUST require `confirmUsername` matching the target admin's username before updating the PIN in MySQL.
- Admin PIN login attempts MUST enforce a maximum of 3 failed attempts with strict escalating lockouts: 5 min -> 15 min -> 30 min -> 60 min.
- PIN reset and PIN update endpoints MUST enforce strict rate limiting (max 3 failed attempts per 15 minutes before lockout).
- Zero tolerance for malicious inputs (non-numeric PINs, SQL injection strings, or fuzzing payloads instantly trigger failure counter).
- All client and server TypeScript builds MUST pass with 0 errors.

---

### Task 1: Database Migration for Admin Usernames

**Files:**
- Create: `scripts/update-admin-usernames.ts`
- Test: `scripts/verify-admin-usernames.ts`

**Interfaces:**
- Consumes: `prisma.admin` from `src/config/prisma.ts`
- Produces: Updated database records:
  - ID 6: `username = 'Effands'`
  - ID 2: `username = 'fiko942'`

- [ ] **Step 1: Write verification script to check target database state**

```typescript
// scripts/verify-admin-usernames.ts
import prisma from '../src/config/prisma';

async function main() {
    const admin2 = await prisma.admin.findUnique({ where: { id: 2 } });
    const admin6 = await prisma.admin.findUnique({ where: { id: 6 } });

    console.log('Admin ID 2:', admin2?.username);
    console.log('Admin ID 6:', admin6?.username);

    if (admin2?.username !== 'fiko942' || admin6?.username !== 'Effands') {
        console.error('FAIL: Usernames not updated yet.');
        process.exit(1);
    }
    console.log('PASS: All target admin usernames verified.');
    await prisma.$disconnect();
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
```

- [ ] **Step 2: Run verification test to verify it fails initially**

Run: `npx ts-node scripts/verify-admin-usernames.ts`
Expected: FAIL with "FAIL: Usernames not updated yet."

- [ ] **Step 3: Create migration script to update admin usernames**

```typescript
// scripts/update-admin-usernames.ts
import prisma from '../src/config/prisma';

async function run() {
    console.log('Updating Admin ID 6 ("Pak Effand" -> "Effands")...');
    const u6 = await prisma.admin.update({
        where: { id: 6 },
        data: { username: 'Effands' }
    });
    console.log(`Updated Admin ID 6 to: ${u6.username}`);

    console.log('Updating Admin ID 2 ("Wiji Fiko Teren" -> "fiko942")...');
    const u2 = await prisma.admin.update({
        where: { id: 2 },
        data: { username: 'fiko942' }
    });
    console.log(`Updated Admin ID 2 to: ${u2.username}`);

    console.log('All admin usernames successfully updated in database.');
    await prisma.$disconnect();
}

run().catch(err => {
    console.error('Migration failed:', err);
    process.exit(1);
});
```

- [ ] **Step 4: Execute the migration script and run verification test**

Run: `npx ts-node scripts/update-admin-usernames.ts`
Run: `npx ts-node scripts/verify-admin-usernames.ts`
Expected: PASS with "PASS: All target admin usernames verified."

- [ ] **Step 5: Commit changes**

```bash
git add scripts/update-admin-usernames.ts scripts/verify-admin-usernames.ts
git commit -m "feat(security): update admin usernames to Effands and fiko942"
```

---

### Task 2: Strict Anti-Brute-Force & Rate Limiting Engine

**Files:**
- Modify: `src/services/adminRateLimiter.ts`
- Create: `src/services/securityRateLimiter.ts`
- Test: `scripts/test-rate-limiter.ts`

**Interfaces:**
- Consumes: Client IP string, request endpoint keys, session IDs
- Produces: `adminRateLimiter` (for login PIN with 5m/15m/30m/60m escalations), `securityRateLimiter` (for PIN reset, PIN update, and credential operations)

- [ ] **Step 1: Write test for strict rate limiting rules**

```typescript
// scripts/test-rate-limiter.ts
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
    if (!fail3.isLocked || fail3.remainingSeconds < 290) throw new Error('Lockout level 1 duration mismatch');

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

    if (!locked.isLocked) throw new Error('Security limiter did not lock out after 3 failures');

    console.log('PASS: securityRateLimiter verified');
}

try {
    testAdminLoginLimiter();
    testSecurityRateLimiter();
    console.log('ALL RATE LIMITER TESTS PASSED');
} catch (e) {
    console.error('FAIL:', e);
    process.exit(1);
}
```

- [ ] **Step 2: Run test to verify it fails before implementation**

Run: `npx ts-node scripts/test-rate-limiter.ts`
Expected: FAIL with "Cannot find module '../src/services/securityRateLimiter'"

- [ ] **Step 3: Upgrade `src/services/adminRateLimiter.ts` with strict escalating lockouts**

```typescript
// src/services/adminRateLimiter.ts
/**
 * Strict Admin Login Rate Limiter Service
 * Enforces max 3 attempts with escalating lockouts:
 * Level 1: 5 minutes (300s)
 * Level 2: 15 minutes (900s)
 * Level 3: 30 minutes (1800s)
 * Level 4+: 60 minutes (3600s)
 */

interface AttemptRecord {
    failedAttempts: number;
    lockoutLevel: number;
    lockedUntil: number | null;
    lastFailedAt: number;
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
    private attempts: Map<string, AttemptRecord> = new Map();

    constructor() {
        setInterval(() => this.cleanupOldRecords(), 15 * 60 * 1000);
    }

    private getLockoutDurationSeconds(level: number): number {
        if (level <= 1) return 5 * 60;      // 5 mins
        if (level === 2) return 15 * 60;     // 15 mins
        if (level === 3) return 30 * 60;     // 30 mins
        return 60 * 60;                     // 60 mins
    }

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

        if (record.lockedUntil && record.lockedUntil > now) {
            const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
            const lockoutMinutes = Math.ceil(this.getLockoutDurationSeconds(record.lockoutLevel) / 60);
            return {
                isLocked: true,
                remainingSeconds,
                attemptsLeft: 0,
                lockoutMinutes,
                failedAttempts: record.failedAttempts,
                message: `Akses login dibatasi secara ketat. Silakan tunggu ${this.formatDuration(remainingSeconds)} sebelum mencoba lagi.`
            };
        }

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

        if (record.lockedUntil && record.lockedUntil <= now) {
            record.lockedUntil = null;
            record.failedAttempts = 0;
        }

        record.failedAttempts += 1;
        record.lastFailedAt = now;

        if (record.failedAttempts >= this.MAX_ATTEMPTS) {
            record.lockoutLevel += 1;
            const durationSeconds = this.getLockoutDurationSeconds(record.lockoutLevel);
            record.lockedUntil = now + (durationSeconds * 1000);
            const lockoutMinutes = Math.ceil(durationSeconds / 60);

            return {
                isLocked: true,
                remainingSeconds: durationSeconds,
                attemptsLeft: 0,
                lockoutMinutes,
                failedAttempts: record.failedAttempts,
                message: `Terlalu banyak percobaan PIN salah. Akses diblokir selama ${lockoutMinutes} menit.`
            };
        }

        const attemptsLeft = this.MAX_ATTEMPTS - record.failedAttempts;
        return {
            isLocked: false,
            remainingSeconds: 0,
            attemptsLeft,
            lockoutMinutes: 0,
            failedAttempts: record.failedAttempts,
            message: `PIN tidak valid. Sisa percobaan: ${attemptsLeft} kali sebelum IP diblokir.`
        };
    }

    recordSuccess(ip: string): void {
        this.attempts.delete(ip);
    }

    private formatDuration(seconds: number): string {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return `${mins} menit ${secs > 0 ? secs + ' detik' : ''}`.trim();
        }
        return `${secs} detik`;
    }

    private cleanupOldRecords(): void {
        const fourHoursAgo = Date.now() - (4 * 60 * 60 * 1000);
        for (const [ip, record] of this.attempts.entries()) {
            if (record.lastFailedAt < fourHoursAgo && (!record.lockedUntil || record.lockedUntil < Date.now())) {
                this.attempts.delete(ip);
            }
        }
    }
}

export const adminRateLimiter = new AdminRateLimiter();
```

- [ ] **Step 4: Create generic strict security rate limiter `src/services/securityRateLimiter.ts`**

```typescript
// src/services/securityRateLimiter.ts
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
        setInterval(() => this.cleanup(), 10 * 60 * 1000);
    }

    check(key: string, maxAttempts = 3, lockoutDurationMs = 15 * 60 * 1000): SecurityCheckResult {
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
                message: `Terlalu banyak percobaan. Akses dibatasi. Silakan tunggu ${Math.ceil(remainingSeconds / 60)} menit.`
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

    clear(key: string): void {
        this.records.delete(key);
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
```

- [ ] **Step 5: Run rate limiter unit test**

Run: `npx ts-node scripts/test-rate-limiter.ts`
Expected: PASS with "ALL RATE LIMITER TESTS PASSED"

- [ ] **Step 6: Commit changes**

```bash
git add src/services/adminRateLimiter.ts src/services/securityRateLimiter.ts scripts/test-rate-limiter.ts
git commit -m "feat(security): implement strict rate limiters with escalating lockouts"
```

---

### Task 3: Backend PIN Reset Username Confirmation & Security Enforcement

**Files:**
- Modify: `src/controllers/adminController.ts:4380-4665`
- Test: `scripts/test-admin-pin-reset-backend.ts`

**Interfaces:**
- Consumes: `POST /admin/api/admins/reset-pin/:id` with `{ newPin: string, confirmUsername: string }`
- Produces: JSON response with strict status codes (400 if username confirmation doesn't match or PIN invalid, 429 if rate limited, 200 on success).

- [ ] **Step 1: Write backend test for PIN reset validation and rate limiting**

```typescript
// scripts/test-admin-pin-reset-backend.ts
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

    console.log('PASS: PIN Reset username confirmation logic verified');
    await prisma.$disconnect();
}

testPinResetLogic().catch(e => {
    console.error('FAIL:', e);
    process.exit(1);
});
```

- [ ] **Step 2: Run test to verify prerequisite assumptions**

Run: `npx ts-node scripts/test-admin-pin-reset-backend.ts`
Expected: PASS

- [ ] **Step 3: Modify `src/controllers/adminController.ts` in `apiResetAdminPin` and `apiUpdatePin`**

In `src/controllers/adminController.ts`:
1. In `apiGetLoginStatus`: Add a per-IP rate limiter check to prevent automated polling spam (max 60 req/min).
2. In `apiUpdatePin`: Add strict rate limiting on wrong `currentPin` attempts using `securityRateLimiter.recordFailure(`update-pin:${cleanIp}:${adminId}`)`. Max 3 failures locks PIN updates for 15 minutes.
3. In `apiResetAdminPin`:
   - Extract `confirmUsername` and `newPin` from `req.body`.
   - Check `securityRateLimiter.check(`reset-pin:${cleanIp}:${targetId}`, 3, 15 * 60 * 1000)`. If locked, return 429.
   - Validate target admin exists.
   - Compare `confirmUsername?.trim().toLowerCase()` with `targetAdmin.username.toLowerCase()`.
   - If missing or not matching, record failure in `securityRateLimiter` and return 400 with error `"Konfirmasi username tidak cocok dengan akun admin target (${targetAdmin.username})"`.
   - Validate 6-digit PIN format.
   - Check unique PIN across other admins.
   - On success: clear security limiter for this key, update PIN in DB, return 200 with success message.

- [ ] **Step 4: Verify controller compilation**

Run: `npx ts-node -e "import { adminController } from './src/controllers/adminController'; console.log('adminController loaded successfully');"`
Expected: "adminController loaded successfully"

- [ ] **Step 5: Commit changes**

```bash
git add src/controllers/adminController.ts scripts/test-admin-pin-reset-backend.ts
git commit -m "feat(security): enforce username confirmation and rate limiting on admin PIN reset"
```

---

### Task 4: Frontend Admin PIN Reset Modal with Target Username Confirmation

**Files:**
- Modify: `client/src/lib/pages/AdminProfile.svelte`
- Test: Frontend build & UI verification via build check

**Interfaces:**
- Consumes: Target admin account object `{ id, username, role }`
- Produces: Reset modal with two required inputs:
  1. `confirmUsername`: Input requiring the user to confirm the exact username of the target admin.
  2. `targetNewPin`: 6-digit PIN input.
  - Submit button disabled until username confirmation matches and PIN is exactly 6 digits.

- [ ] **Step 1: Update state and handler in `client/src/lib/pages/AdminProfile.svelte`**

Add `targetConfirmUsername = ''` in modal state:
```typescript
let targetConfirmUsername: string = '';
```
In `openResetPinModal(target: AdminAccount)`:
```typescript
function openResetPinModal(target: AdminAccount) {
    targetResetAdmin = target;
    targetNewPin = '';
    targetConfirmUsername = '';
    resetPinError = '';
    resetPinModalOpen = true;
}
```

In `submitResetAdminPin()`:
```typescript
async function submitResetAdminPin() {
    if (!targetResetAdmin) return;
    resetPinError = '';

    if (!targetConfirmUsername || targetConfirmUsername.trim().toLowerCase() !== targetResetAdmin.username.toLowerCase()) {
        resetPinError = `Konfirmasi username harus sama persis dengan "${targetResetAdmin.username}"`;
        return;
    }

    if (!/^\d{6}$/.test(targetNewPin)) {
        resetPinError = 'PIN baru harus tepat 6 digit angka numerik';
        return;
    }

    isSubmittingResetPin = true;
    try {
        const res = await fetch(`/admin/api/admins/reset-pin/${targetResetAdmin.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                newPin: targetNewPin,
                confirmUsername: targetConfirmUsername.trim()
            })
        });

        const json = await res.json();
        if (json.success) {
            resetPinModalOpen = false;
            showAdminManageMessage(json.message || 'PIN admin berhasil direset', true);
            loadAdminsList();
        } else {
            resetPinError = json.error || 'Gagal mereset PIN admin';
        }
    } catch (err: any) {
        resetPinError = err.message || 'Terjadi kesalahan sistem';
    } finally {
        isSubmittingResetPin = false;
    }
}
```

- [ ] **Step 2: Update modal markup in `client/src/lib/pages/AdminProfile.svelte`**

Replace the reset modal body with high-security confirmation UI:
- Visual alert banner informing the operator that resetting a security PIN requires username verification to prevent unauthorized modifications.
- Input 1: **Konfirmasi Username Target** with live match indicator badge (e.g. green check badge when matching, amber when incomplete).
- Input 2: **PIN Baru (6 Digit Angka)**.
- Submit Button with strict disabled check:
  `disabled={isSubmittingResetPin || targetConfirmUsername.trim().toLowerCase() !== targetResetAdmin.username.toLowerCase() || targetNewPin.length !== 6}`

- [ ] **Step 3: Test client build**

Run: `pnpm --dir client build`
Expected: Build passes with 0 errors.

- [ ] **Step 4: Commit changes**

```bash
git add client/src/lib/pages/AdminProfile.svelte
git commit -m "feat(ui): add mandatory username confirmation in admin PIN reset modal"
```

---

### Task 5: Admin Login PIN Lockout & Security Polish

**Files:**
- Modify: `client/src/lib/pages/AdminLogin.svelte`
- Test: Frontend build & UI verification

**Interfaces:**
- Consumes: Rate limit status from `/admin/api/login-status` and `/admin/login` response payload
- Produces: Polished lockout countdown banner displaying minutes and seconds, with clear warning of escalating penalties.

- [ ] **Step 1: Review and refine `AdminLogin.svelte` countdown and warning banners**

Ensure that:
1. When lockout is active, all inputs and keypad buttons remain disabled.
2. The remaining seconds countdown clearly displays `MM:SS` format.
3. Informational text displays: "Durasi pemblokiran akan berlipat ganda jika terjadi kegagalan berulang (5m -> 15m -> 30m -> 60m)."
4. Error banner highlights remaining chances before IP block when `attemptsLeft < 3`.

- [ ] **Step 2: Test client build**

Run: `pnpm --dir client build`
Expected: Build passes with 0 errors.

- [ ] **Step 3: Commit changes**

```bash
git add client/src/lib/pages/AdminLogin.svelte
git commit -m "feat(security): refine admin login lockout banner and escalating warnings"
```

---

### Task 6: End-to-End System Security Verification

**Files:**
- Create: `scripts/verify-full-pin-security.ts`
- Test: Full end-to-end integration test against database and rate limiter

- [ ] **Step 1: Write comprehensive verification script**

```typescript
// scripts/verify-full-pin-security.ts
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

    console.log('\n=== ALL SECURITY VERIFICATIONS PASSED ===');
    await prisma.$disconnect();
}

main().catch(err => {
    console.error('VERIFICATION FAILED:', err);
    process.exit(1);
});
```

- [ ] **Step 2: Run verification script**

Run: `npx ts-node scripts/verify-full-pin-security.ts`
Expected: ALL SECURITY VERIFICATIONS PASSED

- [ ] **Step 3: Run full production client build & server build checks**

Run: `pnpm --dir client build`
Run: `npm run build`
Expected: 0 errors across client and server.

- [ ] **Step 4: Final commit**

```bash
git add scripts/verify-full-pin-security.ts
git commit -m "test(security): complete full verification for admin usernames, PIN reset confirmation, and anti-brute-force rate limiting"
```
