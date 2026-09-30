# Implementation Plan: Fix Layout Alignment, Floating Dot, & Structured Description in Quick Detail Modal

## Problem Identified:
1. **Broken Card Alignment & Cut-off Headings**:
   - The OS support box and description box lack sufficient internal padding and clear hierarchy.
   - The blue dot on the footnote is misaligned.
2. **Dense Paragraph Body**:
   - The description needs clean line breaks and feature highlights with bullet icons.
3. **Modal Structure Refinement**:
   - Clean up spacing, remove stray decorative dots, fix padding and border radius so all contents fit cleanly within the viewport without awkward scroll clippings.

## Verification:
- Build check via `pnpm run build` (Exit code 0).
