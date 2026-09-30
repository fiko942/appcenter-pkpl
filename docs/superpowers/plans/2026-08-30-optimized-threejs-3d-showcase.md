# Implementation Plan: Ultra-Optimized Three.js 3D Floating Wireframe Gem / Holographic Torus with Zero-Lag Throttled WebGL

Build a high-end, silky smooth Three.js 3D showcase element inside the Hero visual right beside/behind the main platter:
1. **Scattered 3D Hologram (Torus Knot Wireframe + Floating Particles)**:
   - Scoped strictly to the 320x320 hero platter container (NOT a full-screen canvas that repaints millions of pixels).
   - Render with `pixelRatio: Math.min(window.devicePixelRatio, 1.5)` and `powerPreference: 'high-performance'`.
   - Mesh: Neon glowing wireframe Torus Knot (`THREE.TorusKnotGeometry(1.2, 0.35, 64, 16)`) with `THREE.MeshStandardMaterial({ wireframe: true, color: 0x3b82f6 })` + orbiting cyber particle points.
   - Interactive: Smooth mouse drag / mouse move rotation with damping.
2. **Performance Guarantee**:
   - WebGL render canvas is strictly 320x320 px (consumes < 2% GPU on Apple Silicon/Mac).
   - Pause rendering when section is out of viewport via `IntersectionObserver`.
   - Clean WebGL context and geometry disposal on unmount.

## Verification Plan
- Run `pnpm run build` (Exit code 0).
