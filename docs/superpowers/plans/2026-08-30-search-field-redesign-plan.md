# Implementation Plan: Sleek Apple-Grade Search Input Field Overhaul

## Problem Identified:
The search input field currently uses `bg-[var(--surface-1)]/90` with inconsistent opacity stacking, resulting in a dull, muddy-grey brownish box that clashes with the crisp cool-navy background, lacks prominent borders, and has low placeholder contrast.

## Proposed Changes:
1. **Design System & Color Realignment**:
   - Match the sleek frosted glass styling of the rest of the interface:
     - Background: `bg-[#0b1328]/80 dark:bg-[#070d1e]/85` (Light mode: `bg-white/90`).
     - Border: `border border-blue-500/25 dark:border-blue-400/20 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/15`.
     - Text & Placeholder: `text-[var(--text)]` with high-contrast cool-slate placeholder (`placeholder-slate-400 dark:placeholder-slate-500`).
     - Search Icon: crisp royal-blue / cyan active glow (`text-blue-500 dark:text-blue-400`).
2. **Keyboard Shortcut Affordance & Clear Action**:
   - Add a subtle `⌘K` / `Ctrl+K` shortcut chip badge on the right side when empty, and quick clear `✕` button when text is typed.
3. **Smooth Interactive Focus Transition**:
   - Add backdrop-blur and subtle shadow glow on hover & focus.

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
