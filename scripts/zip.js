#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const zipFile = path.join(rootDir, 'release.zip');

// Step 1: Run build
console.log('==> Starting full project build before zip...');
require('./build.js');

console.log('==> Packaging dist directory into release.zip...');
if (fs.existsSync(zipFile)) {
  fs.rmSync(zipFile, { force: true });
}

let packed = false;
try {
  // Method 1: Use tar (available on modern Windows 10/11, macOS, Linux)
  execSync(`tar -a -c -f "${zipFile}" *`, { cwd: distDir, stdio: 'inherit', shell: true });
  if (fs.existsSync(zipFile) && fs.statSync(zipFile).size > 0) {
    packed = true;
  }
} catch (_) {
  packed = false;
}

if (!packed) {
  try {
    if (process.platform === 'win32') {
      console.log('Using PowerShell Compress-Archive fallback...');
      const psCmd = `powershell -NoProfile -Command "Compress-Archive -Path '${distDir}\\*' -DestinationPath '${zipFile}' -Force"`;
      execSync(psCmd, { stdio: 'inherit', shell: true });
    } else {
      console.log('Using zip command fallback...');
      execSync(`zip -r "${zipFile}" .`, { cwd: distDir, stdio: 'inherit', shell: true });
    }
  } catch (fallbackErr) {
    console.error('Packaging fallback error:', fallbackErr.message || fallbackErr);
  }
}

if (fs.existsSync(zipFile) && fs.statSync(zipFile).size > 0) {
  const stats = fs.statSync(zipFile);
  const sizeMb = (stats.size / (1024 * 1024)).toFixed(2);
  console.log(`\n==> SUCCESS: release.zip created successfully! (${sizeMb} MB)`);
  console.log(`==> Path: ${zipFile}`);
} else {
  console.error('\n==> ERROR: Failed to create release.zip');
  process.exit(1);
}
