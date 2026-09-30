# 2-Hour Admin Login Lockout & Non-Disclosure Security Copy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure the administrator rate limiting lockout duration to a strict 2 hours (120 minutes / 7,200 seconds) upon 3 failed PIN attempts, and completely sanitize all user-facing copy to conceal internal IP tracking mechanisms while clearly informing users that their login attempts are blocked for 2 hours.

**Architecture:**
1. **Backend Rate Limiter (`src/services/adminRateLimiter.ts`)**: Adjust the lockout duration to 2 hours (7,200 seconds / 120 minutes) and update internal feedback messages to frame blocks around user login attempts rather than revealing IP detection.
2. **Backend Controller (`src/controllers/adminController.ts`)**: Sanitize error strings in `processLogin`, `apiGetLoginStatus`, and sensitive PIN handling endpoints to ensure zero technical disclosure of IP-based tracking.
3. **Frontend UI (`client/src/lib/pages/AdminLogin.svelte`)**: Update warning badges, lockout notification banners, and status messages to inform the user of the 2-hour login attempt block cleanly without technical jargon.

**Tech Stack:** Express 5, TypeScript 5.5, Svelte 4, Vite 5, Tailwind CSS 4.

**Spec:** User directive: "jangan ip diblokir, tapi ip diblokir selama 2 jam misalnya, tapii jangan kasih tau klo diblokir ip, tapi kasih tau aja percobaan anda akan diblokir selama 2 jam".

## Global Constraints
- Maximum allowed failed PIN attempts before lockout remains strictly **3 attempts**.
- Lockout duration when 3 attempts fail MUST be **2 hours** (120 minutes / 7,200 seconds).
- ALL user-facing strings (frontend and backend JSON messages) MUST NOT mention "IP", "IP diblokir", or "alamat IP".
- Copy MUST clearly communicate that the user's login attempts will be / are blocked for 2 hours (e.g., *"Sisa kesempatan: X kali lagi sebelum percobaan Anda diblokir selama 2 jam"*).
- All TypeScript compilation (`npx tsc --noEmit`) and client production builds (`npm --prefix client run build`) must succeed with 0 errors.

---

### Task 1: Update Admin Rate Limiter Duration to 2 Hours and Neutralize Messages

**Files:**
- Modify: `src/services/adminRateLimiter.ts`
- Test: `scripts/test-2hr-rate-limiter.ts`

**Interfaces:**
- Consumes: `adminRateLimiter` singleton in `src/services/adminRateLimiter.ts`
- Produces: `RateLimitCheckResult` with `remainingSeconds = 7200`, `lockoutMinutes = 120`, and neutral copy.

- [ ] **Step 1: Write test script verifying 2-hour duration and sanitized copy**

```typescript
// scripts/test-2hr-rate-limiter.ts
import { adminRateLimiter } from '../src/services/adminRateLimiter';

async function main() {
    const testIp = '192.168.99.99';
    adminRateLimiter.recordSuccess(testIp);

    // Initial check
    const init = adminRateLimiter.check(testIp);
    if (init.isLocked || init.attemptsLeft !== 3) {
        throw new Error('Initial check failed');
    }

    // 1st failure
    const f1 = adminRateLimiter.recordFailure(testIp);
    if (f1.isLocked || f1.attemptsLeft !== 2 || f1.message?.includes('IP')) {
        throw new Error(`f1 failed or contains 'IP': ${f1.message}`);
    }

    // 2nd failure
    const f2 = adminRateLimiter.recordFailure(testIp);
    if (f2.isLocked || f2.attemptsLeft !== 1 || f2.message?.includes('IP')) {
        throw new Error(`f2 failed or contains 'IP': ${f2.message}`);
    }

    // 3rd failure - triggers 2 hour lockout
    const f3 = adminRateLimiter.recordFailure(testIp);
    if (!f3.isLocked || f3.remainingSeconds < 7190 || f3.lockoutMinutes !== 120 || f3.message?.includes('IP')) {
        throw new Error(`f3 failed lockout check. Seconds: ${f3.remainingSeconds}, Minutes: ${f3.lockoutMinutes}, Msg: ${f3.message}`);
    }

    // Re-check status while locked
    const lockedCheck = adminRateLimiter.check(testIp);
    if (!lockedCheck.isLocked || lockedCheck.remainingSeconds < 7190 || lockedCheck.message?.includes('IP')) {
        throw new Error(`lockedCheck failed or contains 'IP': ${lockedCheck.message}`);
    }

    adminRateLimiter.recordSuccess(testIp);
    console.log('PASS: 2-hour rate limiter and sanitized messages verified successfully.');
    process.exit(0);
}

main().catch(err => {
    console.error('FAIL:', err);
    process.exit(1);
});
```

- [ ] **Step 2: Run test to verify it fails with old configuration**

Run: `npx ts-node scripts/test-2hr-rate-limiter.ts`
Expected: FAIL due to duration being 5m (300s) and message containing "IP".

- [ ] **Step 3: Update `src/services/adminRateLimiter.ts`**

Update `getLockoutDurationSeconds` and all user message strings:
- Lockout duration: `2 * 60 * 60` (7,200s / 120 minutes).
- Failure warning message: `PIN tidak valid. Sisa percobaan: ${attemptsLeft} kali lagi sebelum percobaan Anda diblokir selama 2 jam.`
- Lockout triggered message: `Terlalu banyak percobaan PIN salah. Percobaan login Anda diblokir selama 2 jam.`
- Locked check message: `Percobaan login Anda sedang dibatasi. Silakan tunggu ${this.formatDuration(remainingSeconds)} sebelum mencoba kembali.`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx ts-node scripts/test-2hr-rate-limiter.ts`
Expected: PASS with "PASS: 2-hour rate limiter and sanitized messages verified successfully."

- [ ] **Step 5: Clean up test script**

Run: `Remove-Item -Force scripts/test-2hr-rate-limiter.ts`

---

### Task 2: Sanitize Backend Controller Messages and Error Fallbacks

**Files:**
- Modify: `src/controllers/adminController.ts:60-140`

**Interfaces:**
- Consumes: `adminRateLimiter` from `src/services/adminRateLimiter.ts`
- Produces: Sanitized JSON responses in `POST /admin/login` and `GET /admin/api/login-status`.

- [ ] **Step 1: Inspect and update `src/controllers/adminController.ts`**

Ensure `processLogin`:
- When locked: returns `data.message || 'Percobaan login Anda diblokir selama 2 jam karena terlalu banyak percobaan gagal.'`.
- When failed attempt: returns `data.message || 'PIN tidak valid. Sisa percobaan: ${data.attemptsLeft} kali lagi sebelum percobaan Anda diblokir selama 2 jam.'`.
- All fallback strings must be free of "IP" or "IP diblokir".

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: 0 errors.

---

### Task 3: Update Frontend Login View Copy (`AdminLogin.svelte`)

**Files:**
- Modify: `client/src/lib/pages/AdminLogin.svelte`

**Interfaces:**
- Consumes: Backend `/admin/login` and `/admin/api/login-status` responses.
- Produces: Refined UI banners, attempt warning text, and countdown timer.

- [ ] **Step 1: Update warning and lockout banners in `AdminLogin.svelte`**

Update warning banner when attempts remain:
```svelte
{#if attemptsLeft < 3 && attemptsLeft > 0}
    <span class="text-[11px] font-semibold text-amber-500 dark:text-amber-400">
        ⚠️ Sisa kesempatan: {attemptsLeft}x lagi sebelum percobaan Anda diblokir selama 2 jam.
    </span>
{/if}
```

Update locked state card content:
```svelte
{#if isLocked}
    <div class="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 mb-5 text-center space-y-2">
        <div class="w-10 h-10 rounded-xl bg-rose-500/15 text-rose-500 mx-auto flex items-center justify-center shadow-xs">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
        </div>
        <div>
            <h4 class="text-xs font-bold text-rose-500 uppercase tracking-wider">Percobaan Login Dibatasi</h4>
            <p class="text-[11px] text-[var(--text-3)] mt-0.5 leading-relaxed">
                Batas percobaan PIN salah tercapai. Percobaan login Anda diblokir selama 2 jam:
            </p>
        </div>
        <div class="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 tracking-widest py-1.5 bg-[var(--surface-2)] rounded-xl border border-rose-500/20 shadow-inner">
            {formatTimer(remainingSeconds)}
        </div>
        <p class="text-[10px] text-slate-500 dark:text-slate-400 leading-tight">
            🔒 Perlindungan keamanan sistem aktif. Silakan tunggu hingga waktu tunggu berakhir untuk mencoba kembali.
        </p>
    </div>
{/if}
```

Update `formatTimer` to support hour format `HH:MM:SS` when `remainingSeconds >= 3600`:
```typescript
function formatTimer(secs: number): string {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    if (h > 0) {
        return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
```

- [ ] **Step 2: Build Svelte client and sync output**

Run: `npm --prefix client run build`
Sync: `powershell -Command "if (Test-Path client_dist) { Copy-Item -Recurse -Force client/dist/* client_dist/ }; if (Test-Path dist/client_dist) { Copy-Item -Recurse -Force client/dist/* dist/client_dist/ }"`
Expected: Build passes with 0 errors.

---

### Task 4: End-to-End Verification

**Files:**
- Test: API calls & browser test on `http://localhost:5173/#/admin/login`

- [ ] **Step 1: Test failed attempt response copy via Node.js fetch**

Run:
```powershell
node -e "fetch('http://127.0.0.1:5173/admin/login', { method: 'POST', headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}, body: JSON.stringify({ pin: '000000' }) }).then(r => r.json()).then(d => console.log('Login attempt result:', d))"
```
Expected: Response contains `message` with `"sebelum percobaan Anda diblokir selama 2 jam"` and NO `"IP"` text.

- [ ] **Step 2: Verify browser UI rendering**

Navigate to `http://localhost:5173/#/admin/login`, enter an incorrect PIN, and confirm the warning banner displays *"Sisa kesempatan: 2x lagi sebelum percobaan Anda diblokir selama 2 jam"* without any IP leak.
