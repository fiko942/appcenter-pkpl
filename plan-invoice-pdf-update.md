# Invoice PDF Update Plan
1. Fix the logo icon in `InvoicePublic.svelte` and PDF template: The user wants a clean icon instead of the current text + icon layout which looks forced. Change "APPCENTER" to "Ziqva Labs".
2. Change the address in the PDF footer or somewhere on the PDF template to match the image: "Jl. Digital Kreatif No. 88, Kemang, Jakarta Selatan 12730", "support@ziqvastore.com", "+62 812-3456-7890".
3. Provide a two-page PDF template: page 1 in English, page 2 in Indonesian.

## Tasks
- [ ] Task 1: Update `src/views/invoicePdfTemplate.ts` to output two pages (page-break CSS between them), Page 1 in EN, Page 2 in ID. Include the requested address. Update the brand section to "Ziqva Labs" and remove text icon layout.
- [ ] Task 2: Review and apply any necessary changes to frontend `InvoicePublic.svelte` logo area (if requested, but main request seems to be about the PDF structure and brand representation).
