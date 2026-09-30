# Implementation Plan: Category Tag Filtering & Dynamic "Load More" Pagination in Catalog

## Requirement:
1. **Dynamic Category / Tag Extraction**:
   - Instead of only having `Semua Software (3)`, extract and expose all unique product categories and tag taxonomy (`#Tool Dropshipper`, `#Tools Farming`, `#Tools Pendukung Affiliator`, etc.) as interactive filter pills.
2. **Progressive "Load More" Pagination**:
   - Set an initial visible batch limit (`visibleLimit = 6` or `visibleLimit = 3`).
   - If `filteredProducts.length > visibleLimit`, display a sleek **"Muat Lebih Banyak Software (Load More) ↓"** button with item counter.
   - Smoothly reveal the next batch on click with scale/fade animations.

## Proposed Changes

### Frontend: `client/src/lib/pages/LandingPage.svelte`
- Collect unique tags and categories dynamically from `products` array:
  - Extract `category_name` and parse comma-separated tags into unified filter pills.
- Add `let visibleCount = 6;`
- Reset `visibleCount` when `selectedFilter` or `searchQuery` changes.
- Slice `filteredProducts.slice(0, visibleCount)` for display.
- Add modern **"Muat Lebih Banyak ({remaining} tersisa) ↓"** button at the bottom of the grid.

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
