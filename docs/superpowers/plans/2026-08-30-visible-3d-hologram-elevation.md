# Implementation Plan: Standalone Dynamic 3D Floating Interactive Orb & Transparent Liquid Glass Elevation

## Root Cause of 3D Being Hidden:
The 3D canvas was trapped directly behind the solid opaque 300px central card platter, and the geometry size was too small to expand beyond the card bounds.

## Proposed Changes:
1. **Make 3D Element Massive & Distinct (Hero Focal Point)**:
   - Expand the 3D Canvas viewport to `480px × 480px` centered inside the 3D showcase.
   - Replace the small hidden torus with a luminous, glowing **Multi-Ring Cyber Planetary Gyroscope / Tech Orb** (`outer cyan ring`, `middle blue wireframe sphere`, and `bright rotating glowing core`).
   - Increase emissive lighting (`0x38bdf8`, `0x2563eb`, `emissiveIntensity: 1.2`) and bright point lights so it pops visually with high contrast on both Dark and Light modes.
2. **True Floating Liquid Glass Platter**:
   - Make the central card semi-transparent (`bg-white/30 dark:bg-[#070e20]/40 backdrop-blur-md border border-white/40 dark:border-blue-400/30`) so the 3D elements rotate and shine directly through and around the card.
   - Elevate satellite cards with glowing glass tags.
3. **Interactive 3D Mouse Controls**:
   - Smooth mouse drag and cursor tilt interaction.

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
