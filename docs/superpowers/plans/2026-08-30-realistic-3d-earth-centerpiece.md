# Implementation Plan: Realistic 3D Earth Centerpiece with Cloud Layer & Glowing Orbit

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the abstract wireframe icosahedron/core in `init3DHeroScene` on `LandingPage.svelte` with a high-fidelity, photorealistic 3D Earth (Bumi) complete with day map, normal bump map, specular reflection map, rotating cloud atmosphere layer, and elegant orbital rings.

**Assets Available at `/textures/earth/`:**
- `/textures/earth/earth_day.jpg` (2048x1024 high-res surface)
- `/textures/earth/earth_normal.jpg` (2048x1024 normal bump map)
- `/textures/earth/earth_specular.jpg` (2048x1024 ocean specular reflection)
- `/textures/earth/earth_clouds.jpg` (1024x512 cloud atmosphere map)

**Architecture & Lighting:**
- **Earth Globe Mesh:** SphereGeometry (radius 1.15, 64 segments) with MeshStandardMaterial (day map, normal map, roughness/specular highlights, metalness 0.1).
- **Atmospheric Cloud Layer:** SphereGeometry (radius 1.17, 64 segments) with MeshStandardMaterial (cloud map, transparent: true, opacity 0.45, blending: AdditiveBlending) with independent subtle rotation speed for natural parallax.
- **Orbital Gyro Rings & Particle Stars:** Retain cyan/indigo sleek orbital tracks and stardust particles around Earth.
- **Lighting Setup:** Directional sunlight with warm highlight, ambient light for soft shadowed sides, and blue rim light for atmospheric glow.
- **Performance & GPU Safety:** Maintain IntersectionObserver pause and pixel ratio clamp (1.5 max) so GPU usage remains at 0% when off-screen.

**Tech Stack:** Svelte 4, Three.js, WebGL, Vite.

---

### Task 1: Replace Centerpiece in `LandingPage.svelte` with 3D Earth Globe

**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte:210-350`

- [ ] **Step 1: Implement TextureLoader and build Earth sphere + Cloud atmosphere layer**
- [ ] **Step 2: Add independent cloud rotation & natural axial tilt in animate loop**
- [ ] **Step 3: Clean up geometries, materials, and textures in return disposal**
- [ ] **Step 4: Run `pnpm run build` verification**
- [ ] **Step 5: Commit and push changes to `origin/reborn`**
