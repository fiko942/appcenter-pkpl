# Design Specification: Server-Side Pagination, Filtering, Sorting & Svelte Dropdowns for Catalog Products

## 1. Overview
Upgrade the Admin Products Catalog (`AdminProducts.svelte`) and backend API (`apiGetProducts`) from client-side filtering to full server-side query processing (pagination, search, category filter, status filter, and sorting) per page. Replace all native HTML `<select>` elements with Svelte `CustomSelect` components.

---

## 2. Backend Specifications (`src/controllers/adminController.ts`)

### 2.1 Query Parameters for `GET /admin/api/products`
- `page`: number (default: 1)
- `pageSize` / `limit`: number (default: 10)
- `search`: string (case-insensitive search in `name`, `description`, and numeric `id`/`product_id`)
- `category_id`: string / number (`'all'` or specific category ID)
- `status`: string (`'all'` | `'active'` | `'inactive'` | `'discount'`)
- `sort`: string (`'newest'` | `'name'` | `'price-asc'` | `'price-desc'`)

### 2.2 Response Structure
```json
{
  "status": "success",
  "data": {
    "products": [ /* paginated enriched products */ ],
    "categories": [ /* all categories for filters & modals */ ],
    "pagination": {
      "page": 1,
      "pageSize": 10,
      "total": 22,
      "totalPages": 3
    },
    "stats": {
      "total": 22,
      "active": 18,
      "inactive": 4,
      "discount": 5
    }
  }
}
```

---

## 3. Frontend Specifications (`client/src/lib/pages/AdminProducts.svelte`)

### 3.1 Server-Side Interactive Flow
- **Search**: Debounced input (300ms) that triggers backend fetch with `page = 1`.
- **Filters**: Changing Category pill, Status chip, or Sort dropdown resets `page = 1` and fetches fresh paginated data.
- **Pagination Bar**:
  - Information: Showing `X - Y dari Z produk`
  - Per Page Selector: `CustomSelect` (10, 25, 50, 100)
  - Navigation: `Sebelumnya`, Page numbers, `Selanjutnya`

### 3.2 Svelte Component Replacement
- Replace all `<select>` elements:
  - Sort selector -> `CustomSelect.svelte`
  - Page size selector -> `CustomSelect.svelte`
  - Modal Category selector -> `CustomSelect.svelte`

---

## 4. Verification Checklist
- [x] Backend handles all query params (`page`, `pageSize`, `search`, `category_id`, `status`, `sort`).
- [x] Frontend requests per page from backend with debounced search.
- [x] All native HTML dropdowns replaced with Svelte `CustomSelect`.
- [x] Linter & build passes 100%.
