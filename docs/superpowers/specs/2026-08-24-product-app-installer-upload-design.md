# Design Spec: Product App Installer Upload (Mac & Windows via SFTP)

**Date**: 2026-08-24  
**Status**: Approved  
**Author**: Antigravity Pair-Programmer & User  

---

## 1. Objective & Requirements

Provide a clean, robust, and safe system for administrators to upload, preview, replace, and delete software installer files (Windows & Mac) per product on the `/admin/products` page.

### Key Requirements:
1. **Remote SFTP Storage**:
   - Host: `127.0.0.1`
   - Port: `22` (SFTP)
   - User: `ziqva-apps-upload`
   - Pass: `your_sftp_password`
   - Target Folder: `/var/www/html/setup-windows-bin/x86`
   - Public Download Domain: `https://download.ziqva.com/<filename>`
2. **Supported OS & File Types**:
   - **Windows**: `.exe`, `.zip`, `.rar`, `.7z`
   - **Mac**: `.dmg`, `.pkg`, `.zip`, `.rar`, `.7z`
3. **Product Creation vs Management Flow**:
   - "Tambah Produk Baru" modal remains lightweight (upload is optional/skipped during creation).
   - Once a product exists, the admin can manage its installer files anytime via a dedicated **"📦 Kelola File Installer"** modal on `/admin/products`.
4. **File Replacement & Deletion**:
   - When uploading a new installer for an OS, if a previous file was assigned to the product, that old file is deleted from the remote SFTP server.
   - If an existing file with the same name already exists on the server, it is replaced cleanly.
   - Admin can delete an existing installer without uploading a new one.
5. **Database Migration**:
   - Direct MySQL interaction to add `installer_files LONGTEXT NULL` on `products` table.
   - Synchronize with `prisma/schema.prisma` and Prisma Client.

---

## 2. Architecture & Data Structures

### Database Schema: `products.installer_files`
Stored as JSON string with TypeScript interface:
```typescript
export interface ProductInstallerInfo {
    filename: string;
    url: string;
    size: string; // e.g. "45.2 MB"
    bytes?: number;
    uploaded_at: number; // epoch seconds
}

export interface ProductInstallerFiles {
    windows?: ProductInstallerInfo | null;
    mac?: ProductInstallerInfo | null;
}
```

### SFTP Service: `src/services/sftpService.ts`
Provides methods:
- `uploadFile(localPath: string, remoteFilename: string): Promise<number>` (returns bytes uploaded).
- `deleteFile(remoteFilename: string): Promise<boolean>` (deletes remote file if exists).
- `fileExists(remoteFilename: string): Promise<boolean>`.

---

## 3. UI/UX Workflow on `/admin/products`

1. **Table Column & Badges**:
   - New column **"File Installer"** showing:
     - 🪟 Windows badge (Green if uploaded, Gray if not).
     - 🍎 Mac badge (Green if uploaded, Gray if not).
     - Clickable button to open `#manageAppFileModal`.
2. **Modal `#manageAppFileModal`**:
   - Product name in header.
   - Tabs or dual sections for **Windows** and **Mac**.
   - For each OS:
     - **Active File Preview Card**: Filename, Size, Uploaded date, direct download button `Buka File ↗`, and `Hapus File` button.
     - **Upload Form**: File input with extension restrictions, Upload Progress / Loading state, Submit button.

---

## 4. Security & Safety Considerations
- Sanitize uploaded filenames (remove directory traversal characters like `..`, `/`, `\`).
- Use temporary local multer upload in memory or tmp directory, stream to SFTP, then remove local temp file immediately.
- Prevent non-admin access (protected by `adminAuth` middleware).
