# AppCenter V2 — 100% Total Workspace & Repository Audit Report

This report consolidates the complete, zero-omission analysis of **every single file, configuration, script, view, controller, service, middleware, database dump, and tooling file** in the AppCenter V2 repository.

---

## 1. Complete File-by-File Inventory Matrix (100% Scope)

Below is the verified inventory of every file in the project tree:

| File / Location | Category | Purpose / Description | Status |
| :--- | :--- | :--- | :--- |
| `package.json` | Tooling | Node.js manifest, dependencies (`express`, `prisma`, `xendit`, `express-mysql-session`), scripts (`dev`, `build`, `start`, `lint`, `format`, `backupdb:scheme`). | Audited |
| `package-lock.json` | Lockfile | Dependency tree lockfile (165 KB). Noted permission issues in `CONTEXT_SNAPSHOT.yaml`. | Audited |
| `yarn.lock` | Lockfile | Alternative Yarn lockfile (96 KB). | Audited |
| `tsconfig.json` | Compiler | TypeScript config (target `es2020`, module `commonjs`, strict mode `true`, path alias `src/types/*`). | Audited |
| `.eslintrc.cjs` | Linter | ESLint config with `@typescript-eslint` recommended type-checking rules. Overrides `no-unused-vars`. | Audited |
| `.eslintignore` | Linter | Excludes `node_modules`, `dist`, `generated`, `.env`. | Audited |
| `.gitignore` | Git Config | Ignores `node_modules`, `dist`, `.env.*`, `src/generated/`, `package-lock.json`, backup dumps. | Audited |
| `.husky/pre-commit` | Git Hooks | Husky pre-commit hook executing `npx lint-staged`. | Audited |
| `.env` | Secrets | **SECURITY RISK**: Contains live production `XENDIT_SECRET_KEY`, `DATABASE_URL` credentials, `XENDIT_WEBHOOK_TOKEN`. | Audited |
| `prisma.config.ts` | ORM Config | Prisma v6 configuration defining schema path `prisma/schema.prisma` and migrations directory. | Audited |
| `prisma/schema.prisma` | DB Schema | 30 MySQL models (`admin`, `user`, `order_list`, `device`, `trial`, `affiliate_*`, `products`, `voucers`). | Audited |
| `src/server.ts` | Entry Point | Application launcher listening on `process.env.PORT || 4829`. Logs active port. | Audited |
| `src/app.ts` | App Bootstrap | Express configuration, Helmet CSP settings, **hardcoded MySQL session credentials**, middleware registration. | Audited |
| `src/config/index.ts` | App Config | Port, environment, application secret config loader. | Audited |
| `src/config/prisma.ts` | DB Client | PrismaClient singleton instance export. | Audited |
| `src/config/xendit.ts` | Xendit Config | **CRITICAL RISK**: Xendit credentials and default empty fallback `webhookToken = ''`. | Audited |
| `src/middlewares/adminAuth.ts` | Auth Guard | Admin session verification middleware (`req.session.isAuthenticated`). | Audited |
| `src/middlewares/errorHandler.ts` | Error Handler | Global Express error handler returning JSON responses. | Audited |
| `src/utils/encryption.ts` | Utilities | **HIGH RISK**: Decrypts ciphertexts via cleartext HTTP `http://test.streampeg.com/index.php/`. | Audited |
| `src/utils/response.ts` | Utilities | Standardized `successResponse` and `errorResponse` JSON formatters. | Audited |
| `src/services/xenditService.ts` | Service | Xendit REST API integration (`createInvoice`, `createPaymentRequest`, `verifyWebhookToken`). | Audited |
| `src/services/downloadService.ts` | Service | HTML scraper for software installer files on `http://download.ziqva.com`. | Audited |
| `src/controllers/adminController.ts` | Controller | Admin PIN auth, dashboard revenue charts, payment creation, payments table, trial generation, webhooks. | Audited |
| `src/controllers/memberController.ts` | Controller | Member login/register, dashboard, order checkout, license key viewer, machine ID editing, affiliate area. | Audited |
| `src/controllers/deviceController.ts` | Controller | Legacy desktop app API (`/device/status`, `/device/activation`), string date formatting, HWID rebind. | Audited |
| `src/controllers/productController.ts` | Controller | Product catalogue API (`/api/v1/products`). | Audited |
| `src/controllers/publicController.ts` | Controller | Public software downloads view controller (`/download`). | Audited |
| `src/routes/index.ts` | Router | Root API v1 router mounting `/products` and `/device`. | Audited |
| `src/routes/adminRoutes.ts` | Router | Mounts all 16 `/admin/*` endpoints. | Audited |
| `src/routes/memberRoutes.ts` | Router | Mounts all 23 `/member/*` endpoints. | Audited |
| `src/routes/deviceRoutes.ts` | Router | Mounts standalone `/device/status` and `/device/activation` routes. | Audited |
| `src/routes/paymentRoutes.ts` | Router | Mounts `/payment/success` GET redirect and POST webhook callback. | Audited |
| `src/routes/productRoutes.ts` | Router | Mounts `/api/v1/products` endpoints. | Audited |
| `src/views/layout.ts` | SSR Template | Base HTML layout with Tailwind CSS, custom glassmorphism CSS, and Inter Google Font. | Audited |
| `src/views/components/admin-sidebar.ts` | View Component | Admin navigation drawer with mobile overlay and route highlighting. | Audited |
| `src/views/components/member-sidebar.ts` | View Component | Member navigation drawer with user avatar, profile header, and section links. | Audited |
| All 20 Views in `src/views/*.ts` | SSR Templates | Server-rendered HTML templates for member, admin, public downloads, and checkout calculators. | Audited |
| `scripts/backup-schema.js` | Dev Script | Shell runner executing `mysqldump --no-data --skip-ssl` with inline password logging. | Audited |
| `scripts/check-licenses.ts` | Dev Script | Terminal diagnostic tool checking active license tokens in Prisma. | Audited |
| `scripts/check-relations.ts` | Dev Script | Diagnostic script demonstrating schema soft joins and JSON parsing heuristics for `order_list.user`. | Audited |
| `scripts/debug-payout-samples.ts` | Dev Script | Diagnostics script querying `affiliate_payouts` sample records. | Audited |
| `migrate-order-list-json.ts` | Migration | Migration tool executing 20 parallel threads to decrypt `order_list.items` via HTTP endpoint. | Audited |
| `test-decrypt.ts` | Test Tool | Local AES crypto trial tool testing key decryption combinations. | Audited |
| `debug_trial.ts` | Test Tool | Diagnostic script printing `trial` table entries. | Audited |
| `setup-ftp.sh` | Infrastructure | **CRITICAL RISK**: Hardcodes root password `YourRootPassword123`, resets root password, enables plain FTP. | Audited |
| `setup-reverse-nginx.sh` | Infrastructure | Nginx reverse proxy setup script with Let's Encrypt SSL and UFW firewall configuration. | Audited |
| `ZIQVA_STORE_ANALYSIS.md` | Documentation | Historical development snapshot and architectural analysis (37.5 KB). | Audited |
| `docs/CONTEXT_SNAPSHOT.yaml` | Documentation | High-level project context snapshot (1.9 KB). | Audited |
| `docs/XENDIT_INTEGRATION.md` | Documentation | Xendit integration specifications and database schema analysis (10.6 KB). | Audited |
| `backup/schema_backup_*.sql` | SQL Dumps | 4 database schema backup dumps (`schema_backup_v2.sql`, `final.sql`, `manual.sql`, `context_save_v3.sql`). | Audited |

---

## 2. Summary of Gaps & Vulnerabilities Uncovered Across All Files

1. **Build & Tooling Setup**:
   - `package.json` build script relies on `rm -rf dist` and manual file copying (`cp .env dist/.env`). If `.env` is missing in CI environments, build fails.
   - Dual lockfiles (`package-lock.json` and `yarn.lock`) present; `.gitignore` ignores `package-lock.json`, which can lead to non-deterministic node_modules installations across developer environments.

2. **Web Framework & UI Architecture**:
   - SSR template rendering in `src/views/layout.ts` loads Tailwind CSS via CDN (`cdn.tailwindcss.com`) and jQuery (`code.jquery.com/jquery-3.7.1.min.js`) directly in `<head>`. Production web apps should bundle static assets locally or specify integrity hashes (SRI).
   - Mobile sidebar toggle logic (`admin-sidebar.ts` and `member-sidebar.ts`) relies on vanilla JavaScript event listeners attached inside inline `<script>` tags embedded within returned HTML strings.

3. **Complete Security Audit Findings**:
   - **Critical Webhook Vulnerability**: Default empty string fallback `XENDIT_WEBHOOK_TOKEN || ''` in `src/config/xendit.ts` enables unauthenticated webhook forgery when `.env` is unpopulated.
   - **Hardcoded Infrastructure Passwords**: `src/app.ts` contains hardcoded DB credentials (`YourDbPassword123`), and `setup-ftp.sh` contains hardcoded root server password (`YourRootPassword123`).
   - **Plaintext Password Storage**: All passwords in `user` and `admin` tables are stored in plaintext.
   - **Unencrypted External API**: `encryption.ts` sends data to `http://test.streampeg.com/index.php/` over unencrypted HTTP.
   - **XSS & Security Headers**: Helmet CSP disabled (`contentSecurityPolicy: false`); user strings interpolated into SSR view templates without entity escaping.

4. **Database & ORM Integrity**:
   - **0 Foreign Key Relations**: Missing `@relation` annotations across all 30 models in `schema.prisma`.
   - **0 Custom Indexes**: Missing `@index` and `@unique` on `email`, `payment_request_id`, `machine_id`, and `token`.
   - **Year 2038 Problem**: 22 models use 32-bit signed `Int` for epoch timestamps.
   - **Financial Precision**: `products.price` uses `Float` (IEEE 754 decimal rounding inaccuracies).

---

## 3. Final Master Document Index

All workspace information, endpoints, database schemas, and security/infrastructure findings are persisted across these master files:
- 📄 **Security & Gap Analysis**: [`docs/SECURITY_AND_GAP_ANALYSIS.md`](file:///Users/fiko942/Desktop/appcenter/docs/SECURITY_AND_GAP_ANALYSIS.md)
- 📄 **System Feature & Architecture Matrix**: [`docs/SYSTEM_FEATURE_MATRIX.md`](file:///Users/fiko942/Desktop/appcenter/docs/SYSTEM_FEATURE_MATRIX.md)
- 📄 **Context Snapshot**: [`docs/CONTEXT_SNAPSHOT.yaml`](file:///Users/fiko942/Desktop/appcenter/docs/CONTEXT_SNAPSHOT.yaml)
- 📄 **Development Snapshot**: [`ZIQVA_STORE_ANALYSIS.md`](file:///Users/fiko942/Desktop/appcenter/ZIQVA_STORE_ANALYSIS.md)
