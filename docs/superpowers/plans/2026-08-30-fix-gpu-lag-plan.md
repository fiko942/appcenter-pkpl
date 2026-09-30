# Implementation Plan: Fix GPU 100% Starvation & Instant Zero-CPU Rendering

## Root Cause of 100% GPU / Lag:
1. Continuous `requestAnimationFrame` loop in Canvas with dynamic shadow blur (`ctx.shadowBlur = 10`) recalculating 28 nodes + vector lines at full unthrottled browser frame rates on high-DPI displays.
2. Stacking heavy multi-layered `backdrop-blur-3xl`, large `blur-[150px]` divs, and continuous CSS `animate-[spin_40s_linear_infinite]` rotation filters over the canvas.

## Proposed Changes:
1. **Remove the Heavy Canvas Animation Loop**:
   - Completely strip the `requestAnimationFrame` canvas render loop and `heroCanvas` context.
2. **Ultra-Lightweight, GPU-Accelerated Hardware CSS 3D Layer**:
   - Use static, hardware-accelerated pure CSS radial glowing gradients and clean SVG vector meshes that consume 0% GPU / 0% CPU.
3. **Optimize Backdrop Filters**:
   - Normalize `backdrop-blur-3xl` down to standard, smooth `backdrop-blur-md` and `backdrop-blur-lg` to eliminate GPU composite overhead.
4. **Remove Three.js Dependency**:
   - Uninstall `three` and `@types/three` from client (`pnpm remove three @types/three`) to keep the bundle ultralight (saving >600KB JS).

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
- Confirm 0 console errors and smooth 60fps scrolling without GPU load.
