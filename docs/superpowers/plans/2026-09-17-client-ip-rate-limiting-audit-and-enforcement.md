# Implementation Plan: System-Wide True Client IP Rate Limiting & Abuse Prevention

**Date**: 2026-09-17  
**Status**: Completed  
**Target**: Complete audit and enforcement of true client IP detection (`getClientIp`) across all rate limiting, login lockouts, OTP brute-force protections, and audit records in AppCenter.

---

## 1. Problem Statement & Architecture Analysis

### The Problem
When running behind a reverse proxy (Nginx in aaPanel + PM2), Express without `trust proxy` and raw `req.ip` defaults to `127.0.0.1` (or `::ffff:127.0.0.1`). If rate limiting or brute-force lockouts use this raw IP, **a single user triggering a lockout locks out all users across the entire server**.

### The Solution
1. **Express Trust Proxy Configuration**: Configure `app.set('trust proxy', true)` in `src/app.ts` so Express properly reads upstream proxy headers (`X-Forwarded-For`, `X-Real-IP`).
2. **Centralized True IP Extraction (`src/utils/ipHelper.ts`)**: `getClientIp(req)` inspects headers in priority order:
   - `cf-connecting-ip` (Cloudflare CDN)
   - `x-real-ip` (Nginx `$remote_addr`)
   - `x-forwarded-for` (first IP in client chain)
   - Express `req.ip`
   - `req.socket.remoteAddress`
   - Normalizes IPv6-mapped IPv4 (`::ffff:x.x.x.x` -> `x.x.x.x`) and loopbacks (`::1` -> `127.0.0.1`).
3. **Strict Isolation Across Rate Limiters**: All rate limiting keys throughout Admin and Member modules must use `getClientIp(req)` combined with user identity keys where applicable, guaranteeing that actions from one client IP never interfere with other users.

---

## 2. Proposed Changes & File Decomposition

### Files to Modify / Create

| File Path | Responsibility |
| :--- | :--- |
| `src/app.ts` | Ensure `trust proxy` is enabled at application entry point. |
| `src/utils/ipHelper.ts` | Centralized true client IP resolver and sanitizer. |
| `src/controllers/adminController.ts` | Enforce `getClientIp(req)` for Admin PIN login, Forgot PIN 3-stage flow, PIN update/reset, and audit logs. |
| `src/controllers/memberController.ts` | Enforce `getClientIp(req)` for Member login brute-force protection, Member registration OTP, Member password reset OTP, and user IP audit logs. |
| `src/controllers/deviceController.ts` | Enforce `getClientIp(req)` for device license activations and tracking. |
| `scripts/test-ip-rate-limiting.ts` | Comprehensive test verifying independent client IP isolation and lockout enforcement. |

---

## 3. Step-by-Step Implementation Tasks

### Task 1: Verify & Harden `src/utils/ipHelper.ts` and `src/app.ts`
- Ensure `app.set('trust proxy', true)` is active before any route handler in `src/app.ts`.
- Ensure `getClientIp(req)` in `src/utils/ipHelper.ts` robustly handles null headers, array headers, comma-separated chains, Cloudflare `cf-connecting-ip`, Nginx `x-real-ip`, and IPv6-mapped IPv4 addresses.

### Task 2: Audit & Enforce IP Rate Limiting in `src/controllers/adminController.ts`
- In `apiGetLoginStatus(req)`: Extract `cleanIp = getClientIp(req)` and query `adminRateLimiter.check(cleanIp)`.
- In `apiLogin(req)`: Track failure and success with `cleanIp = getClientIp(req)`.
- In `apiForgotPinRequestOtp(req)`: Enforce dual lockout `forgot-pin-lockout:${cleanIp}` and `forgot-pin-admin-lock:${username}`.
- In `apiForgotPinVerifyOtp(req)`: Enforce dual lockout `forgot-pin-lockout:${cleanIp}` and `forgot-pin-admin-lock:${username}`.
- In `apiProcessForgotPinReset(req)`: Enforce dual lockout and clear keys upon successful PIN reset.
- In `apiUpdatePin(req)` & `apiResetPinAdmin(req)`: Rate-limit failed PIN/username verification attempts using `getClientIp(req)`.
- In Admin profile, activity logs, and DB records: Ensure `prisma.admin.update({ data: { ip: cleanIp } })` and downloads store `getClientIp(req)`.

### Task 3: Implement IP & Account Rate Limiting in `src/controllers/memberController.ts`
- **Member Login (`processLogin`)**:
  - Extract `cleanIp = getClientIp(req)` and `cleanEmail = email.trim().toLowerCase()`.
  - Check `securityRateLimiter.check(`member-login:ip:${cleanIp}`, 5, 15 * 60 * 1000)` and `securityRateLimiter.check(`member-login:account:${cleanEmail}`, 5, 15 * 60 * 1000)`.
  - If locked, return `HTTP 429` with remaining lockout minutes.
  - On incorrect password: Call `securityRateLimiter.recordFailure` on both IP and account keys.
  - On successful login: Call `securityRateLimiter.clear` on both IP and account keys.
- **Member Registration OTP (`apiSendRegisterOtp` & `processRegister`)**:
  - Rate-limit OTP requests per IP (`register-otp-req:${cleanIp}`, max 5 requests per 10 minutes).
  - Rate-limit OTP verification attempts per IP + email (`register-otp-verify:${cleanIp}:${cleanEmail}`, max 5 attempts per 15 minutes).
- **Member Password Reset OTP (`apiSendResetPasswordOtp` & `apiResetPassword`)**:
  - Rate-limit reset OTP requests per IP (`reset-pwd-req:${cleanIp}`).
  - Rate-limit reset OTP verification attempts (`reset-pwd-verify:${cleanIp}:${cleanEmail}`, max 5 attempts per 15 minutes).
- **Member Audit Logging**:
  - Use `getClientIp(req)` when saving `prisma.user.create({ data: { ip: getClientIp(req) } })` and device HWID history logs.

### Task 4: Audit & Enforce IP Logging in `src/controllers/deviceController.ts`
- Verify `activateLicense` and `checkDeviceStatus` record `getClientIp(req)` for `taked_ip`.

### Task 5: Automated Verification & Independent IP Isolation Test
- Create `scripts/test-ip-rate-limiting.ts`:
  1. Test IP extraction across headers (`cf-connecting-ip`, `x-real-ip`, `x-forwarded-for`, `req.ip`, IPv6 prefix stripping).
  2. Simulate Client A (`198.51.100.1`) making 3 wrong Admin PIN attempts -> verify Client A is locked out.
  3. Simulate Client B (`203.0.113.5`) making valid Admin PIN attempt -> verify Client B is **NOT locked out** and can log in normally.
  4. Simulate Client A (`198.51.100.1`) making 5 failed Member login attempts -> verify Client A is locked out.
  5. Simulate Client B (`203.0.113.5`) logging in with correct credentials -> verify Client B succeeds without hindrance.
  6. Simulate Member password reset OTP brute-force limit and verify isolation.
- Run `npx ts-node scripts/test-ip-rate-limiting.ts` and confirm 100% test pass.

### Task 6: Build & Deployment Artifact
- Run `npx eslint "src/**/*.{ts,js}"` to ensure 0 lint errors.
- Run `npm run build` to ensure clean compilation.
- Run `npm run zip` to generate the production `release.zip`.
- Commit and push to GitHub `origin/master`.

---

## 4. Verification Checklist
- [x] Client A failure lockout does not impact Client B.
- [x] Express `trust proxy` is active.
- [x] No raw `req.ip` or un-sanitized IP extraction remains in auth/security code paths.
- [x] Member Login, Forgot Password OTP, and Registration OTP have brute force protections.
- [x] Automated tests pass with 100% success.
- [x] Svelte frontend and Node backend build without errors.
