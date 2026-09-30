# Implementation Plan: Expand Hero 3D Satellite Feature Cards & Fix Left Trust Badge Alignment

## 1. Expanding Right Hero 3D Satellite Cards (From 2 to 4 Rich Feature Satellites):
Currently there are only 2 floating cards (`Tools Gratis` and `HWID Lock`).
Expand to **4 balanced, beautifully floating 3D feature satellite cards** surrounding the 3D Gyroscope at 4 strategic quadrants:
1. **Top-Left (Emerald)**:
   - Icon: `Rp 0` Glowing Badge
   - Title: **Tools Gratis**
   - Subtitle: *Akses Instan 1-Klik*
2. **Top-Right (Purple)**:
   - Icon: Glowing Film/Play Reel
   - Title: **Video Tutorial**
   - Subtitle: *16:9 Cinema Guides*
3. **Bottom-Left (Cyan)**:
   - Icon: Glowing Auto-Sync Arrow
   - Title: **Auto-Updater**
   - Subtitle: *Zero-Downtime Patch*
4. **Bottom-Right (Royal Blue)**:
   - Icon: Glowing HWID Padlock Shield
   - Title: **HWID Lock**
   - Subtitle: *Proteksi Lisensi Mesin*

## 2. Left Hero Trust Badges Layout Alignment:
- Replace the uneven wrapping flex pills with a clean **4-Item Grid** (`grid grid-cols-2 sm:grid-cols-4 gap-2.5`) so `Windows 10/11 & macOS` is never an orphaned badge on a second row.

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
