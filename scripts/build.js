#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const clientDir = path.join(rootDir, 'client');

console.log('==> Step 1: Building Svelte Client...');
execSync('pnpm run build', { cwd: clientDir, stdio: 'inherit', shell: true });

console.log('==> Step 2: Cleaning dist directory...');
if (fs.existsSync(distDir)) {
  fs.rmSync(distDir, { recursive: true, force: true });
}
fs.mkdirSync(distDir, { recursive: true });

console.log('==> Step 3: Compiling TypeScript Backend...');
execSync('npx tsc', { cwd: rootDir, stdio: 'inherit', shell: true });

console.log('==> Step 4: Copying assets and dependencies...');
// Copy client/dist -> dist/client_dist
const clientDist = path.join(clientDir, 'dist');
if (fs.existsSync(clientDist)) {
  fs.cpSync(clientDist, path.join(distDir, 'client_dist'), { recursive: true });
}

// Copy public -> dist/public
const publicDir = path.join(rootDir, 'public');
if (fs.existsSync(publicDir)) {
  fs.cpSync(publicDir, path.join(distDir, 'public'), { recursive: true });
}

// Copy prisma -> dist/prisma
const prismaDir = path.join(rootDir, 'prisma');
if (fs.existsSync(prismaDir)) {
  fs.cpSync(prismaDir, path.join(distDir, 'prisma'), { recursive: true });
}

// Copy root configuration/setup files
const filesToCopy = ['.env', 'package.json', 'prepare.sh'];
for (const file of filesToCopy) {
  const srcFile = path.join(rootDir, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, path.join(distDir, file));
  }
}

// Ensure prepare.sh is executable on POSIX systems
const destPrepare = path.join(distDir, 'prepare.sh');
if (fs.existsSync(destPrepare) && process.platform !== 'win32') {
  try {
    fs.chmodSync(destPrepare, 0o755);
  } catch (_) {}
}

// Copy generated query engines if present
const srcGenClient = path.join(rootDir, 'src', 'generated', 'client');
const destGenClient = path.join(distDir, 'generated', 'client');
if (fs.existsSync(srcGenClient)) {
  if (!fs.existsSync(destGenClient)) {
    fs.mkdirSync(destGenClient, { recursive: true });
  }
  const genFiles = fs.readdirSync(srcGenClient);
  for (const f of genFiles) {
    if (f.endsWith('.node')) {
      fs.copyFileSync(path.join(srcGenClient, f), path.join(destGenClient, f));
    }
  }
}

console.log('==> Build completed successfully! Output located at:', distDir);
