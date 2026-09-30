# Root Cause Analysis & Solution: Hot Reload Not Reflecting Automatically

## Root Cause Investigation (Phase 1):
1. The app architecture consists of two environments:
   - **Production Express Server (Port 4829)**: Serves static pre-compiled HTML/JS files from `client_dist` or `client/dist`. It **cannot** hot-reload Svelte component source files directly without a manual rebuild or running Vite HMR.
   - **Vite Dev Server (Port 5173)**: Vite is the only tool that supports Hot Module Replacement (HMR).
2. **Why it didn't update automatically:**
   - If the browser is accessing `http://localhost:4829` (the Express port), Express is serving the static built bundle. It will never auto-reload unless you run `pnpm run build` and refresh.
   - For real-time Hot Reload (HMR) to work without refreshing, the browser MUST open **`http://localhost:5173`** (Vite Dev Server) while `pnpm run dev:client` is active.
3. **Unified Single-Command DX Improvement**:
   - Install/use a single command `pnpm run dev` to run BOTH Express (Port 4829) and Vite Client (Port 5173) in parallel using `concurrently` (or node child processes), so running one command boots the full hot-reload ecosystem seamlessly.

## Action Steps:
1. Update `package.json` with `concurrently` so `pnpm run dev` starts both Backend and Vite HMR simultaneously.
2. Direct user to access `http://localhost:5173` for active frontend hot-reload development.
