# Implementation Plan: Product App Installer Upload (Mac & Windows via SFTP)

## Proposed Changes

### 1. Database Schema Migration
- Run real `ALTER TABLE products ADD COLUMN installer_files LONGTEXT NULL;` using `mysql` CLI on `127.0.0.1`.
- Update `prisma/schema.prisma` with `installer_files String? @db.LongText`.
- Run `prisma generate` to update Prisma Client.

### 2. SFTP & File Utility Service
- Create `src/services/sftpService.ts`:
  - Encapsulate connection management to `127.0.0.1:22`.
  - Methods: `uploadInstaller(localFilePath, filename)`, `deleteInstaller(filename)`, `checkFileExists(filename)`.
  - Helper functions for formatting file size and sanitizing filenames.

### 3. Controller & Routes (`AdminController` & `adminRoutes.ts`)
- In `src/routes/adminRoutes.ts`:
  - Setup `multer` temporary upload middleware for files up to 500MB (dest: `os.tmpdir()`).
  - Add routes:
    - `POST /admin/products/:id/upload-installer` (Handles file upload to SFTP, old file deletion, and DB update).
    - `POST /admin/products/:id/delete-installer` (Handles file deletion from SFTP and DB update).
- In `src/controllers/adminController.ts`:
  - Implement `uploadProductInstaller` and `deleteProductInstaller`.

### 4. Admin UI (`src/views/admin-products.ts`)
- Update `ProductItem` interface to include `installer_files?: string | null`.
- In Products Table:
  - Add **"File Installer"** column with interactive badges:
    - `🪟 Win` (Green / Gray)
    - `🍎 Mac` (Green / Gray)
    - Click to open `#manageAppFileModal`.
- In Page:
  - Add `#manageAppFileModal` with:
    - Current active files preview per OS (Filename, size, date, download link).
    - Form to upload/replace Windows installer (`.exe`, `.zip`, `.rar`, `.7z`).
    - Form to upload/replace Mac installer (`.dmg`, `.pkg`, `.zip`, `.rar`, `.7z`).
    - Action button to delete installer.
    - Upload progress / spinner state during transmission to SFTP.

---

## Verification Plan

### 1. Database Verification
- Execute `DESCRIBE products;` via `mysql` CLI to confirm `installer_files` column exists.

### 2. Automated Integration Testing
- Create a test script to upload a test file to SFTP, check presence, delete file, and verify database update.

### 3. TypeScript & Lint Verification
- Run `npx tsc --noEmit`.
- Run `npx eslint` on modified files.
