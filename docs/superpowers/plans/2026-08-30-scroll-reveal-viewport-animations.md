# Implementation Plan: Scroll-Driven Viewport Replay Animations using Svelte Action (`use:reveal`)

## Problem Identified:
1. Currently, sections use Svelte's `in:fly`, `in:fade`, `in:scale` transitions on static DOM nodes.
2. Because all HTML elements exist in the DOM on initial mount, Svelte executes every `in:...` transition simultaneously at $t=0$ upon page load/refresh.
3. When the user scrolls down to `#catalog`, `#features`, `#affiliate`, `#faq`, or `#footer`, the animations have already finished playing seconds ago.
4. If the user scrolls up and down again, the animations never re-trigger.

## Solution Architecture:
1. Implement a lightweight, high-performance Svelte Action `reveal(node, options)` using a shared native `IntersectionObserver`:
   - Configured with `threshold: 0.1` and `rootMargin: '0px 0px -40px 0px'`.
   - Adds CSS classes `opacity-100 translate-y-0 scale-100` when the element enters the viewport.
   - Resets to `opacity-0 translate-y-8 scale-[0.97]` when the element leaves the viewport.
   - Triggers clean, smooth hardware-accelerated CSS transforms (`transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]`) every time the user scrolls into view.
2. Replace static `in:fly` / `in:scale` on scrollable sections with `use:reveal={{ delay: N, direction: 'up' | 'scale' | 'fade' }}`.

## Verification:
- Run `pnpm run build` (Exit code 0).
- Confirm zero hydration or mobile/desktop regressions.
