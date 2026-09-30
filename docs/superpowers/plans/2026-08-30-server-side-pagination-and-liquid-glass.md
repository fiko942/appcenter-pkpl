# Implementation Plan: Server-Side Query, Filter, & 10-Item Progressive Pagination with Tactile Liquid Glass Restyling

## 1. Backend Server-Side Processing in `memberController.ts` (`apiGetProducts`):
Support query parameters:
- `search` (string): Filters product name and description server-side.
- `category` (string | number):
  - `'all'`: All active products.
  - `'bundle'`: `is_bundle === true`.
  - `'free'`: `price === 0`.
  - Numeric ID: matching `category_id` or `category_ids`.
  - Tag string (`tag:name`): matching category tags.
- `page` (number, default 1).
- `pageSize` (number, strictly default 10).
- Response shape:
  ```json
  {
    "status": "success",
    "data": {
      "products": [...],
      "categories": [...],
      "tags": [...],
      "pagination": {
        "page": 1,
        "pageSize": 10,
        "total": 24,
        "totalPages": 3,
        "hasMore": true
      }
    }
  }
  ```

## 2. Frontend Svelte Integration in `LandingPage.svelte`:
- Every search input change (debounced 250ms) or category filter change triggers a fresh backend fetch (`page = 1`, `products = []`).
- "Load More" triggers `fetchCatalogData(page + 1)` and appends the 10 server-fetched items to the list.
- Show clear loading skeletons during server requests.

## 3. High-Contrast Tactile Liquid Glass Card Restyling:
- Deepen the visual depth of the product cards:
  - Multi-layer glass background with `bg-[var(--surface-1)]/90` and gradient sheen.
  - Bevel specular top border and ambient blue/indigo glow on hover.
  - Distinctive colored badge accents and bold price typography.

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
- Verify server returns 10 items per page with accurate pagination metadata.
