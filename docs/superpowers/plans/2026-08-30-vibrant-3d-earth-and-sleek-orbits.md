# Implementation Plan: Vibrant Deep-Space 3D Earth & Elegant Celestial Telemetry Orbit

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the 3D Earth from washed-out/pale into a rich, deep-space blue marble with high-contrast oceans, rich landmasses, sRGB color space correction, soft atmospheric limb rim-glow, and replace the clunky thick solid rings with ultra-sleek, elegant glowing celestial orbit tracks with traveling pulse satellites.

## Problems Identified & Root Causes:
1. **Pale/Washed-Out Earth:**
   - Missing `dayTexture.colorSpace = THREE.SRGBColorSpace` causing severe gamma/contrast washout in Three.js renderer.
   - Ambient light was overpowered (`1.1`), removing shadows and making oceans look grey.
   - Cloud texture was washing out the globe like a milky film.
2. **Clunky Orbital Rings:**
   - Thick solid `TorusGeometry` with flat `MeshBasicMaterial` cutting rigidly across the globe without gradient or elegance.
   - Particles were square default points with no soft circular glow.

## Proposed Solutions & Upgrades:
1. **Vibrant Earth Material:**
   - `dayTexture.colorSpace = THREE.SRGBColorSpace;`
   - Ambient light lowered to `0.35` for deep contrast.
   - Sun directional light enhanced to `2.8` with warm golden-white light.
   - Blue atmosphere point rim-light (`#38bdf8`, intensity `3.5`) behind the shadow side for cinematic space limb glow.
   - Saturated Earth material with specular ocean reflections.
   - Fine-tuned cloud layer (`opacity: 0.28`, `blending: THREE.AdditiveBlending`).
2. **Sleek Celestial Telemetry Orbit:**
   - Replace clunky solid tubes with delicate, glowing orbital line paths (`THREE.Line` / fine geometry with luminous blue/cyan gradients).
   - Add 2 glowing satellite pulse beacons traveling continuously along the orbit paths.
   - Soft circular stardust points (using dynamic canvas texture for round glow).

**Tech Stack:** Svelte 4, Three.js, WebGL.

---

### Task 1: Refactor `init3DHeroScene` in `LandingPage.svelte`
**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte:187-360`

- [ ] **Step 1: Apply sRGB texture color space and contrast lighting**
- [ ] **Step 2: Build delicate celestial orbit lines & traveling satellite nodes**
- [ ] **Step 3: Add smooth circular stardust glow**
- [ ] **Step 4: Run `pnpm run build` and verify visual output**
- [ ] **Step 5: Commit and push changes to `origin/reborn`**
