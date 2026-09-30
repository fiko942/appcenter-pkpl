# Implementation Plan: Restrict Search Query Matching to Project Name and Description

## Problem Identified:
The search query logic in `memberController.ts` was checking `catMatch = (p.category_name || '').toLowerCase().includes(searchQuery)`.
Because `Vids` had category `#Tools Pendukung Affiliator`, searching for `affilia` matched its category tag substring and included `Vids` in the results.

## Proposed Change:
- Restrict text search exclusively to **Product Name** (`p.name`) and **Product Description** (`p.description`).
- Only filter by category when the user explicitly clicks a category filter pill or passes the `category` parameter.

```typescript
// Search matching: strictly name & description
if (searchQuery) {
    const nameMatch = (p.name || '').toLowerCase().includes(searchQuery);
    const descMatch = (p.description || '').toLowerCase().includes(searchQuery);
    if (!nameMatch && !descMatch) return false;
}
```

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
- Verify searching `affilia` returns only products whose name or description contains `affilia` (e.g. `Affilia`).
