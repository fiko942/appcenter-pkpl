# Implementation Plan: Ultra-Precise Array & Object Installer OS Detection with High-Contrast Liquid Glass Glow Cards

## 1. Automated OS Installer Detection Fix:
Looking at the real database entries:
- `AsistenQ Owner` (id 78): `installer_files` is an object with arrays: `{"windows": [{...exe}], "mac": [{...dmg}]}`.
- `Affilia` (id 102): `installer_files` is an object with single objects: `{"windows": {...zip}, "mac": {...dmg}}`.
- `Vids` (id 103): `installer_files` is an object: `{"windows": {...zip}, "mac": {...zip}}`.
- Other products: `null` (no installer uploaded yet).

### Logic Rule:
- A product supports **Windows** if and only if `windows` is present in `installer_files` (as an array with length > 0, non-empty object, or valid download url/filename string).
- A product supports **macOS** if and only if `mac` or `macos` is present in `installer_files` (as an array with length > 0, non-empty object, or valid download url/filename string).
- If `installer_files` is `null`, empty, or has no uploaded binary, display a clean fallback badge `Desktop App` or default to detected platform.

## 2. High-Contrast Tactile Liquid Glass Card Styling:
Enhance card background, borders, and typography so the Liquid Glass effect is crisp and unmistakable:
- Card surface: `bg-white/85 dark:bg-[#0c1730]/85 border-2 border-white/60 dark:border-blue-500/25 backdrop-blur-2xl shadow-xl hover:shadow-blue-500/20 hover:border-blue-500/70 hover:-translate-y-2 transition-all duration-300`.
- Top-rim specular reflection sheen.
- Bold, high-contrast OS badges with clear icons (Windows: blue, macOS: dark-slate/white, Web/Desktop: indigo).

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
