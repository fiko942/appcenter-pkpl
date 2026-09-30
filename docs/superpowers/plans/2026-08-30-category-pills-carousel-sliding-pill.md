# Implementation Plan: Full-Width Horizontal Category Carousel with Smooth Edge Masks & Sliding Animated Pill Indicator

## Problems Identified:
1. **Hard Edge Clipping**: The category tags row is wrapped in a narrow container without proper edge masking or scrolling affordances, causing tags on the right (`#Tool Dropshipper...`) to appear clipped/cut-off.
2. **Missing Sliding Animated Pill on Category Bar**: The category buttons lack the tactile sliding pill indicator animation that smoothly glides between selected tabs.

## Proposed Changes:
1. **Dynamic Category Pill Sliding Indicator**:
   - Track active category element refs (`categoryElements: Record<string, HTMLButtonElement>`).
   - Add a smooth animated background pill (`catPillStyle: { left: number, width: number }`) with CSS easing (`cubic-bezier(0.4, 0, 0.2, 1)`).
   - Auto-scroll active category button into center view (`scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })`).
2. **Smooth Fade-Out Edge Gradients & Generous Width**:
   - Wrap category row in a full-width container (`max-w-4xl mx-auto`).
   - Add left and right fade masks / gradient indicators so users clearly see it's a smooth scrollable list without harsh text truncation.

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
