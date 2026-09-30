#!/usr/bin/env node
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Load dotenv if present
try {
  require('dotenv').config({ path: path.join(process.cwd(), '.env') });
} catch (e) {
  // ignore
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not found in environment or .env file');
  process.exit(1);
}

// Parse mysql://user:pass@host:port/dbname?...
const m = dbUrl.match(/^mysql:\/\/(.*?):(.*?)@(.*?):(\d+)\/(.*?)(\?.*)?$/);
if (!m) {
  console.error('Failed to parse DATABASE_URL:', dbUrl);
  process.exit(1);
}

const user = decodeURIComponent(m[1]);
const pass = decodeURIComponent(m[2]);
const host = m[3];
const port = parseInt(m[4], 10);
const db = m[5];

const outDir = path.join(process.cwd(), 'backup');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true, mode: 0o755 });
const outFile = path.join(outDir, 'schema_backup.sql');

/**
 * Check and auto-install mysqldump on Linux VPS if missing
 */
function ensureLinuxMysqldump() {
  if (process.platform !== 'linux') return;
  try {
    execSync('which mysqldump || which mariadb-dump', { stdio: 'ignore' });
  } catch (err) {
    console.log('mysqldump not found. Attempting auto-installation on Linux VPS...');
    try {
      if (fs.existsSync('/usr/bin/apt-get') || fs.existsSync('/bin/apt-get')) {
        execSync('DEBIAN_FRONTEND=noninteractive apt-get update -qq && apt-get install -y -qq default-mysql-client || mariadb-client', { stdio: 'inherit', timeout: 30000 });
      } else if (fs.existsSync('/sbin/apk') || fs.existsSync('/usr/bin/apk')) {
        execSync('apk add --no-cache mysql-client mariadb-client', { stdio: 'inherit', timeout: 20000 });
      } else if (fs.existsSync('/usr/bin/yum') || fs.existsSync('/bin/yum')) {
        execSync('yum install -y mysql mariadb', { stdio: 'inherit', timeout: 30000 });
      }
    } catch (installErr) {
      console.warn('Auto-install skipped (non-root or restricted VPS). Falling back to pure Node.js MySQL engine.');
    }
  }
}

async function pureNodeSchemaBackup() {
  console.log('Running pure Node.js / MySQL2 schema backup fallback...');
  const connection = await mysql.createConnection({
    host,
    port,
    user,
    password: pass,
    database: db,
    ssl: { rejectUnauthorized: false }
  });

  try {
    const [tables] = await connection.query("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
    const chunks = [];
    const nowIso = new Date().toISOString();

    chunks.push(`-- ========================================================\n`);
    chunks.push(`-- Appcenter Ziqva Labs Database Schema Backup\n`);
    chunks.push(`-- Generated At: ${nowIso}\n`);
    chunks.push(`-- Target Tables: ${tables.length}\n`);
    chunks.push(`-- Engine: Pure Node.js MySQL2 Exporter (Linux VPS Failsafe)\n`);
    chunks.push(`-- ========================================================\n\n`);
    chunks.push(`SET FOREIGN_KEY_CHECKS=0;\n`);
    chunks.push(`SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";\n`);
    chunks.push(`SET NAMES utf8mb4;\n\n`);

    for (const row of tables) {
      const tableName = Object.values(row)[0];
      chunks.push(`-- --------------------------------------------------------\n`);
      chunks.push(`-- Table structure for table \`${tableName}\`\n`);
      chunks.push(`-- --------------------------------------------------------\n`);
      chunks.push(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);

      const [createRes] = await connection.query(`SHOW CREATE TABLE \`${tableName}\``);
      if (createRes && createRes[0]) {
        const createSql = createRes[0]['Create Table'] || createRes[0]['Create View'] || Object.values(createRes[0])[1] || '';
        chunks.push(`${createSql};\n\n`);
      }
    }

    chunks.push(`SET FOREIGN_KEY_CHECKS=1;\n`);
    chunks.push(`-- End of Schema Backup\n`);

    fs.writeFileSync(outFile, chunks.join(''), 'utf8');
    console.log('\nSchema backup saved successfully to', outFile);
  } finally {
    await connection.end();
  }
}

async function main() {
  ensureLinuxMysqldump();

  let hasCliDump = false;
  try {
    execSync('which mysqldump || which mariadb-dump', { stdio: 'ignore' });
    hasCliDump = true;
  } catch (e) {
    hasCliDump = false;
  }

  if (hasCliDump) {
    const cmd = `mysqldump --no-data --skip-ssl -h ${host} -P ${port} -u ${user} -p'${pass}' ${db} > ${outFile}`;
    console.log('Running schema backup command:');
    console.log(cmd.replace(pass, '********'));
    try {
      execSync(cmd, { stdio: 'inherit', shell: '/bin/bash' });
      console.log('\nSchema backup saved to', outFile);
      return;
    } catch (err) {
      console.warn('mysqldump command failed. Falling back to pure Node.js exporter:', err.message || err);
    }
  }

  await pureNodeSchemaBackup();
}

main().catch((err) => {
  console.error('Fatal schema backup error:', err.message || err);
  process.exit(1);
});

