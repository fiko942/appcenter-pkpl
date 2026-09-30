## 2026-09-12-bilingual-pdf-and-performance-fixes
### Additional Implementations
- Migrated PDF generation from `puppeteer-core` (heavy, GUI dependencies) to `PDFKit` (ultra-lightweight, 15MB RAM, native Node.js).
- Implemented 2-page bilingual PDF document rendering (Bahasa Indonesia on Page 1, English on Page 2).
- Added dynamic timezone detection and URL parameters (`?tz=`) for accurate local time rendering on invoices.
- Fixed date text overlap and wrapping in PDF by increasing column width and shortening timezone abbreviations (e.g., `WIB`).
- Fixed member portal checkout redirection to use secure `invoiceToken` instead of raw ID.
