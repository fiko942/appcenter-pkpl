# Implementation Plan: True Automated Multi-OS Installer Detection & Tactile Liquid Glass Cards

## Requirements:
1. **Dynamic Accurate OS Detection**:
   - Parse `installer_files` strictly based on real installer objects / JSON:
     - Check for real Windows installer (`installer_files.windows`, `installer_files.win`, `installer_files.exe`, `.msi`, `.zip` with win indicators).
     - Check for real macOS installer (`installer_files.mac`, `installer_files.macos`, `installer_files.dmg`, `installer_files.pkg`).
     - **Strict Invariant**: If only macOS exists -> Display ONLY macOS badge. If only Windows exists -> Display ONLY Windows badge. If both exist -> Display both badges.
2. **Tactile Liquid Glass Product Cards**:
   - Refine card styling with **Liquid Glass** treatment:
     - Translucent glass background with backdrop blur (`backdrop-blur-xl bg-[var(--surface-1)]/70 dark:bg-[#0c162e]/70`).
     - Subsurface light sheen gradient overlay.
     - Dual-tone borders (`border border-white/40 dark:border-blue-500/20 hover:border-blue-400/60`).
     - Smooth hover tilt & lift physics with ambient blue/indigo rim glow.

## Verification Plan:
- Run `pnpm run build` (Exit code 0).
