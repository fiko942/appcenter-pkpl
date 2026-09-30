# Implementation Plan: Vite Client Dev Server with Proxy to Express Backend (Hot Reload / HMR)

## Objective:
Provide instantaneous Hot Module Replacement (HMR) during frontend development so every edit in `.svelte` or `.css` files updates the browser instantly without requiring manual page reloads or full rebuilds.

## Architecture:
1. Configure Vite Dev Proxy in `client/vite.config.ts`:
   - Proxy API and backend routes (`/member`, `/admin`, `/api`, `/uploads`, `/css`, `/js`, `/images`) to `http://localhost:4829`.
2. Add dev script in root `package.json`:
   - `"dev:client": "cd client && pnpm run dev"`
   - `"dev:all": "concurrently \"pnpm run dev\" \"pnpm run dev:client\""` (or run separately).
3. When running `pnpm run dev` in `client`, Vite runs on `http://localhost:5173` with instant HMR and proxies all session and API requests directly to the Express backend (port 4829).

## Verification:
- Test Vite config and build check via `pnpm run build`.
