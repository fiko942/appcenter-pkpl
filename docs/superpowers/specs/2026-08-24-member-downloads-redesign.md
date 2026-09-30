# Design Spec: Member Downloads Hub Redesign

## 1. Overview
Modernize `/member/downloads` to integrate the active product catalog, SFTP installer files (Windows & macOS), and video tutorials with YouTube player modal in a single cohesive dark UI hub.

## 2. Requirements & UI Standards
- **Proper SVG Icons**: Use inline SVG vector graphics for all OS badges and buttons (Windows SVG, Apple macOS SVG, Video/Tutorial Play SVG, Download Cloud Arrow SVG, Search SVG, etc.) rather than emoji symbols.
- **Product Card Layout**:
  - App Header: Clean App SVG icon, product name, description.
  - OS Availability Badges: Windows & macOS status tags.
  - Download Buttons:
    - Windows Download button (with Windows SVG, file size, download link).
    - macOS Download button (with Apple SVG, file size, download link).
    - If file not uploaded for an OS, gracefully show disabled "Belum tersedia" state.
  - Video Tutorial Button:
    - If product has tutorials, show a purple-themed Tutorial button with YouTube/Play SVG and count of video parts.
    - Clicking opens the Interactive Tutorial Video Player modal with playlist selector and `referrerpolicy="strict-origin-when-cross-origin"`.
- **Search & Quick Filtering**:
  - Live search input.
  - Filter tabs: `Semua`, `Windows`, `macOS`, `Memiliki Tutorial`.
- **Backend Controller**:
  - In `memberController.showDownloads`: fetch active products from Prisma database including `installer_files` and `tutorials`, parse them via `sftpService` & `youtube.ts`, and pass to `memberDownloadsPage`.

## 3. Data Flow
1. User requests `GET /member/downloads`.
2. `memberController.showDownloads` loads active products from Prisma (`prisma.products.findMany({ where: { is_active: true } })`).
3. Formats products with `installerFiles` and `tutorials` list.
4. Renders `memberDownloadsPage` with SVG icons and interactive modal player.
