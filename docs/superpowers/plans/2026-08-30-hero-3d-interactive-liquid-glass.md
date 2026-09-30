# Implementation Plan: Interactive 3D Canvas Mesh Background & Liquid Glass Cards for Hero Showcase

Elevate the Hero section with:
1. **Interactive 3D Geometric Floating Node/Mesh Background Canvas**:
   - Create a lightweight, high-performance HTML5 Canvas 3D particle constellation / floating icosahedron wireframe orb behind the hero platter.
   - Interactive: reacts subtly to mouse movement / cursor parallax with gentle floating spring physics and zero external dependencies (pure Canvas 2D/3D math, 60fps, zero memory leak, auto-resize handling).
2. **True Liquid Glass UI for Platter & Satellite Cards**:
   - Apply realistic Apple macOS / visionOS Liquid Glass aesthetic:
     - Multi-layered refractive backdrop-blur (`backdrop-blur-3xl`).
     - Subsurface light sheen gradient overlay.
     - Specular highlight rim borders (`border border-white/30 dark:border-blue-400/25` with top-left bevel gradient).
     - Deep dynamic box-shadows with radial royal-blue / cyan ambient diffusion.
     - Smooth tilt & parallax hover effect.

## Proposed Changes

### Frontend: `client/src/lib/pages/LandingPage.svelte`
- Add 3D Canvas element `<canvas bind:this={heroCanvas} class="absolute inset-0 w-full h-full pointer-events-none -z-10"></canvas>` inside `#hero`.
- Implement `initHero3DAnimation()` in `onMount()` with interactive mouse tracking, rotating nodes/polyhedron mesh, glowing connection vectors, and ambient floating orbs.
- Overhaul CSS styles for Main Platter and Satellite Cards with `.liquid-glass-card`, dynamic refractive border gradients, and interactive 3D perspective transforms.

## Verification Plan
- Verify animation compiles cleanly via `pnpm run build` (Exit code 0).
- Ensure canvas cleans up animation frames and event listeners on destroy.
