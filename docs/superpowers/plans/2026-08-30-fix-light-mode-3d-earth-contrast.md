# Implementation Plan: Dual-Theme Contrast Isolation & High-Luminance Light Mode Rendering for 3D Earth

> **For agentic workers:** Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 3D Earth globe visibility and contrast in Light Mode by adding a dynamic theme-aware radial backdrop vignette container, boosting light-mode ambient fill lighting, strengthening the atmospheric rim glow, and ensuring high-contrast orbital lines and satellites across both Light and Dark themes.

## Problems in Light Mode:
1. **Polar Boundary Bleed:** White ice caps and white clouds blend directly into the flat `#FFFFFF` white background, losing the globe's spherical contour.
2. **Night-Side Shadow Cut-off:** The unlit shadow side was tuned for dark space (pitch black), looking unnatural against a bright background.
3. **Low-Contrast Orbit Lines & Particles:** Pale cyan/light blue orbital rings and stardust disappear against pure white backgrounds.
4. **Missing Backdrop Depth:** The 3D canvas had no localized contrast anchor to separate the 3D celestial object from the white page surface.

## Solutions:
1. **Theme-Aware Radial Contrast Anchor:**
   - Add a subtle localized circular backdrop container behind the 3D Earth canvas:
     - In Light Mode: `bg-gradient-to-tr from-blue-100/60 via-indigo-50/40 to-slate-100/70 border border-blue-200/50 shadow-2xl shadow-blue-500/10` to frame the globe and give the white atmosphere and polar regions crisp definition.
     - In Dark Mode: `dark:from-[#0b162e]/70 dark:via-[#081024]/50 dark:to-transparent dark:border-blue-500/20`
2. **Three.js Theme-Reactive Lighting & Shader Tuning:**
   - Track active theme (`$theme` store) in `LandingPage.svelte`.
   - Update Three.js lighting dynamically on theme toggle:
     - Ambient Light: `0.75` in Light Mode (clear details on shadow side) vs `0.45` in Dark Mode (deep space).
     - Directional Sun Light: Balanced warm sunlight `2.4`.
     - Atmosphere Rim Light: Royal Blue `0x2563eb` with increased intensity (`4.0`) so the glowing rim is sharply defined against light backgrounds.
     - Orbit Line Colors: `0x2563eb` (Royal Blue) & `0x0284c7` (Deep Cyan) with `opacity: 0.65` for crisp visibility in both modes.
     - Stardust Particles: `0x2563eb` with `size: 0.05` and `opacity: 0.8`.

**Tech Stack:** Svelte 4, Three.js, WebGL, Tailwind CSS.

---

### Task 1: Add Canvas Contrast Frame & Theme Reactive Three.js Lighting in `LandingPage.svelte`

**Files:**
- Modify: `client/src/lib/pages/LandingPage.svelte`

- [ ] **Step 1: Wrap 3D canvas in a high-contrast radial glass halo frame**
- [ ] **Step 2: Connect `$theme` store to Three.js lighting & material reactive updates**
- [ ] **Step 3: Run `pnpm run build` verification**
- [ ] **Step 4: Commit and push changes to `origin/reborn`**
