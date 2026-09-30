# Implementation Plan: Restoring Rich Solid Blue Banner & High-End Solid Pill Navigation

Refine the header based on user feedback:
1. **Top Announcement Bar**: Restore rich, vibrant solid blue gradient (`bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 text-white`) with clean white badge and bold typography.
2. **Navbar Thickness**: Increase vertical presence and generous padding (h-20 with spacious container) so it doesn't look thin or cramped.
3. **Navigation Items Polish**:
   - Give each nav item comfortable horizontal and vertical padding (`px-5 py-2.5`, `text-sm font-semibold`).
   - Use an ultra-clean, Apple TV-grade frosted glass container with smooth borders.
   - Design the active sliding pill with high-contrast, premium styling (`bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/30` or sleek solid dark/light pill) that fits seamlessly without awkward cutoffs or tight margins.
4. **Action Buttons**: Solid, tactile, well-proportioned buttons with clean hover physics.

## Verification Plan
- Run `pnpm run build` (Exit code 0).
