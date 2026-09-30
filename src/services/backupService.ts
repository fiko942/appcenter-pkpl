import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import prisma from '../config/prisma';

const execAsync = util.promisify(exec);

export interface DownloadLogEntry {
    downloaded_at: number;
    downloaded_by: string;
    ip: string;
    browser: string;
    user_agent: string;
}

export function parseUserAgent(ua: string | undefined): string {
    if (!ua) return 'Unknown Browser';

    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Detect OS
    if (/Windows NT 10.0/i.test(ua)) os = 'Windows 10/11';
    else if (/Windows NT 6.3/i.test(ua)) os = 'Windows 8.1';
    else if (/Windows NT 6.1/i.test(ua)) os = 'Windows 7';
    else if (/Macintosh|Mac OS X/i.test(ua)) {
        const match = ua.match(/Mac OS X ([0-9_]+)/i);
        os = match ? `macOS ${match[1].replace(/_/g, '.')}` : 'macOS';
    } else if (/Android/i.test(ua)) {
        const match = ua.match(/Android ([0-9.]+)/i);
        os = match ? `Android ${match[1]}` : 'Android';
    } else if (/iPhone|iPad|iPod/i.test(ua)) {
        os = 'iOS';
    } else if (/Linux/i.test(ua)) {
        os = 'Linux';
    }

    // Detect Browser
    if (/Edg\/([0-9.]+)/i.test(ua)) {
        const match = ua.match(/Edg\/([0-9.]+)/i);
        browser = `Edge ${match ? match[1] : ''}`.trim();
    } else if (/OPR\/([0-9.]+)/i.test(ua) || /Opera/i.test(ua)) {
        const match = ua.match(/OPR\/([0-9.]+)/i);
        browser = `Opera ${match ? match[1] : ''}`.trim();
    } else if (/Chrome\/([0-9.]+)/i.test(ua) && !/Chromium/i.test(ua)) {
        const match = ua.match(/Chrome\/([0-9.]+)/i);
        browser = `Chrome ${match ? match[1] : ''}`.trim();
    } else if (/Safari\/([0-9.]+)/i.test(ua) && !/Chrome/i.test(ua)) {
        const match = ua.match(/Version\/([0-9.]+)/i);
        browser = `Safari ${match ? match[1] : ''}`.trim();
    } else if (/Firefox\/([0-9.]+)/i.test(ua)) {
        const match = ua.match(/Firefox\/([0-9.]+)/i);
        browser = `Firefox ${match ? match[1] : ''}`.trim();
    }

    return `${browser} on ${os}`;
}

export class BackupService {
    private static backupDir = path.join(process.cwd(), 'storage', 'backups');
    private static linuxPrerequisitesChecked = false;

    public static getBackupDir(): string {
        if (!fs.existsSync(this.backupDir)) {
            fs.mkdirSync(this.backupDir, { recursive: true, mode: 0o755 });
        }
        return this.backupDir;
    }

    /**
     * Ensure Linux VPS environment has required database client utilities
     * Non-blocking and failsafe: if not root, falls back directly to pure Node.js streamer
     */
    public static async ensureLinuxPrerequisites(): Promise<void> {
        if (this.linuxPrerequisitesChecked) return;
        if (process.platform !== 'linux') {
            this.linuxPrerequisitesChecked = true;
            return;
        }

        try {
            await execAsync('which mysqldump || which mariadb-dump');
            this.linuxPrerequisitesChecked = true;
        } catch {
            // Attempt auto-install if package manager is available
            try {
                if (fs.existsSync('/usr/bin/apt-get') || fs.existsSync('/bin/apt-get')) {
                    await execAsync('DEBIAN_FRONTEND=noninteractive apt-get update -qq && apt-get install -y -qq default-mysql-client || mariadb-client', { timeout: 30000 });
                } else if (fs.existsSync('/sbin/apk') || fs.existsSync('/usr/bin/apk')) {
                    await execAsync('apk add --no-cache mysql-client mariadb-client', { timeout: 20000 });
                } else if (fs.existsSync('/usr/bin/yum') || fs.existsSync('/bin/yum')) {
                    await execAsync('yum install -y mysql mariadb', { timeout: 30000 });
                }
            } catch {
                // Non-root VPS or restricted container: pure Node streamer handles everything seamlessly
            }
            this.linuxPrerequisitesChecked = true;
        }
    }

    /**
     * Start a database backup in the background with progress reporting
     */
    public static async startBackup(adminUsername: string): Promise<number> {
        // Ensure Linux VPS tools or pure streamer ready
        this.ensureLinuxPrerequisites().catch(() => {});

        const timestamp = Math.floor(Date.now() / 1000);
        const dateStr = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const randHex = crypto.randomBytes(4).toString('hex');
        const filename = `ziqva_db_backup_${dateStr}_${randHex}.sql`;
        const dir = this.getBackupDir();
        const filePath = path.join(dir, filename);

        // Create initial pending record
        const backupRecord = await prisma.database_backups.create({
            data: {
                filename,
                file_path: filePath,
                file_size: BigInt(0),
                status: 'IN_PROGRESS',
                progress: 5,
                current_step: 'Inisialisasi koneksi dan struktur basis data...',
                created_by: adminUsername || 'Admin',
                created_at: timestamp,
                download_count: 0
            }
        });

        const backupId = backupRecord.id;

        // Run background export
        this.runExportProcess(backupId, filePath, filename).catch(async (err) => {
            console.error(`Backup ID ${backupId} failed:`, err);
            try {
                await prisma.database_backups.update({
                    where: { id: backupId },
                    data: {
                        status: 'FAILED',
                        progress: 0,
                        current_step: 'Gagal melakukan pencadangan',
                        error_message: err?.message || String(err)
                    }
                });
            } catch (e) {
                console.error('Failed to update backup failure status in DB:', e);
            }
        });

        return backupId;
    }

    private static escapeSql(val: string): string {
        return "'" + val
            .replace(/\\/g, '\\\\')
            .replace(/'/g, "\\'")
            .replace(/\0/g, '\\0')
            .replace(/\n/g, '\\n')
            .replace(/\r/g, '\\r')
            + "'";
    }

    private static async runExportProcess(backupId: number, filePath: string, _filename: string): Promise<void> {
        const updateProgress = async (progress: number, step: string, tableCount = 0, recordCount = 0) => {
            await prisma.database_backups.update({
                where: { id: backupId },
                data: {
                    progress,
                    current_step: step,
                    table_count: tableCount,
                    record_count: recordCount
                }
            });
        };

        await updateProgress(10, 'Membaca skema dan daftar tabel database...');

        // Query all database tables
        const rawTables: Array<{ [key: string]: string }> = await prisma.$queryRawUnsafe(
            "SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'"
        );

        const tableNames: string[] = [];
        for (const row of rawTables) {
            const firstKey = Object.keys(row)[0];
            if (firstKey && row[firstKey]) {
                tableNames.push(row[firstKey]);
            }
        }

        const totalTables = tableNames.length;
        let totalRecords = 0;

        await updateProgress(15, `Ditemukan ${totalTables} tabel. Membuka streaming berkas SQL murni...`, totalTables, 0);

        // Open uncompressed raw SQL write stream
        const writeStream = fs.createWriteStream(filePath, { encoding: 'utf8', flags: 'w', mode: 0o644 });
        const hash = crypto.createHash('sha256');

        const writeChunk = async (chunk: string) => {
            hash.update(chunk, 'utf8');
            if (!writeStream.write(chunk, 'utf8')) {
                await new Promise((resolve) => writeStream.once('drain', resolve));
            }
        };

        // Header SQL
        const nowIso = new Date().toISOString();
        await writeChunk(`-- ========================================================\n`);
        await writeChunk(`-- Appcenter Ziqva Labs Database Backup (Raw Standard SQL)\n`);
        await writeChunk(`-- Generated At: ${nowIso}\n`);
        await writeChunk(`-- Target Tables: ${totalTables}\n`);
        await writeChunk(`-- Format: Uncompressed Raw SQL (Anti-Corruption Standard)\n`);
        await writeChunk(`-- ========================================================\n\n`);
        await writeChunk(`SET FOREIGN_KEY_CHECKS=0;\n`);
        await writeChunk(`SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";\n`);
        await writeChunk(`SET NAMES utf8mb4;\n\n`);

        for (let i = 0; i < totalTables; i++) {
            const tableName = tableNames[i];
            const percent = 15 + Math.floor(((i + 0.5) / totalTables) * 70); // 15% to 85%
            await updateProgress(percent, `Mengekstrak skema dan data tabel: ${tableName} (${i + 1}/${totalTables})...`, totalTables, totalRecords);

            // Table Structure
            await writeChunk(`-- --------------------------------------------------------\n`);
            await writeChunk(`-- Table structure for table \`${tableName}\`\n`);
            await writeChunk(`-- --------------------------------------------------------\n`);
            await writeChunk(`DROP TABLE IF EXISTS \`${tableName}\`;\n`);

            const createTableRes: Array<{ [key: string]: string }> = await prisma.$queryRawUnsafe(
                `SHOW CREATE TABLE \`${tableName}\``
            );

            if (createTableRes && createTableRes[0]) {
                const rowObj: any = createTableRes[0];
                const createSql =
                    rowObj['Create Table'] ||
                    rowObj['Create View'] ||
                    rowObj.f1 ||
                    Object.values(rowObj).find(
                        (v: any) => typeof v === 'string' && (v.startsWith('CREATE TABLE') || v.startsWith('CREATE ALGORITHM') || v.startsWith('CREATE VIEW'))
                    ) ||
                    Object.values(rowObj)[1] ||
                    '';
                if (createSql) {
                    await writeChunk(`${createSql};\n\n`);
                }
            }

            // Table Data (Skip data for database_backups table to keep dumps clean, but keep schema)
            if (tableName === 'database_backups') {
                continue;
            }

            const rows: Array<Record<string, any>> = await prisma.$queryRawUnsafe(
                `SELECT * FROM \`${tableName}\``
            );

            if (rows && rows.length > 0) {
                totalRecords += rows.length;
                await writeChunk(`-- Dumping data for table \`${tableName}\` (${rows.length} rows)\n`);

                const batchSize = 100;
                for (let j = 0; j < rows.length; j += batchSize) {
                    const batch = rows.slice(j, j + batchSize);
                    const columns = Object.keys(batch[0]).map(c => `\`${c}\``).join(', ');
                    
                    const valueStrings = batch.map(row => {
                        const vals = Object.values(row).map(val => {
                            if (val === null || val === undefined) return 'NULL';
                            if (typeof val === 'number') return String(val);
                            if (typeof val === 'bigint') return val.toString();
                            if (typeof val === 'boolean') return val ? '1' : '0';
                            if (val instanceof Date) return `'${val.toISOString().slice(0, 19).replace('T', ' ')}'`;
                            if (Buffer.isBuffer(val)) return `0x${val.toString('hex')}`;
                            if (typeof val === 'object') {
                                return BackupService.escapeSql(JSON.stringify(val));
                            }
                            
                            // String escaping
                            return BackupService.escapeSql(String(val));
                        });
                        return `(${vals.join(', ')})`;
                    });

                    await writeChunk(`INSERT INTO \`${tableName}\` (${columns}) VALUES\n${valueStrings.join(',\n')};\n`);
                }
                await writeChunk(`\n`);
            }
        }

        // Footer SQL
        await writeChunk(`SET FOREIGN_KEY_CHECKS=1;\n`);
        await writeChunk(`-- End of Backup\n`);

        await updateProgress(90, 'Menyelesaikan penulisan berkas SQL murni...', totalTables, totalRecords);

        // Finalize Stream
        writeStream.end();
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
        });

        await updateProgress(95, 'Memverifikasi integritas berkas dan menghitung checksum SHA256...', totalTables, totalRecords);

        const stats = fs.statSync(filePath);
        const checksum = hash.digest('hex');
        const completedAt = Math.floor(Date.now() / 1000);

        // Update completed record in DB
        await prisma.database_backups.update({
            where: { id: backupId },
            data: {
                status: 'COMPLETED',
                progress: 100,
                current_step: 'Pencadangan database selesai dan siap diunduh.',
                file_size: BigInt(stats.size),
                checksum_sha256: checksum,
                table_count: totalTables,
                record_count: totalRecords,
                completed_at: completedAt
            }
        });
    }

    /**
     * Get list of all database backups
     */
    public static async getBackupsList() {
        const backups = await prisma.database_backups.findMany({
            orderBy: { id: 'desc' }
        });

        return backups.map((b) => {
            let history: DownloadLogEntry[] = [];
            try {
                if (b.download_history) {
                    history = JSON.parse(b.download_history);
                }
            } catch (e) {
                history = [];
            }

            return {
                id: b.id,
                filename: b.filename,
                file_size: Number(b.file_size),
                checksum_sha256: b.checksum_sha256,
                table_count: b.table_count,
                record_count: b.record_count,
                status: b.status,
                progress: b.progress,
                current_step: b.current_step,
                error_message: b.error_message,
                created_by: b.created_by,
                created_at: b.created_at,
                completed_at: b.completed_at,
                download_count: b.download_count,
                last_download_at: b.last_download_at,
                last_download_by: b.last_download_by,
                last_download_ip: b.last_download_ip,
                last_download_browser: b.last_download_browser,
                download_history: history
            };
        });
    }

    /**
     * Get single backup status for live polling
     */
    public static async getBackupStatus(id: number) {
        const b = await prisma.database_backups.findUnique({
            where: { id }
        });

        if (!b) return null;

        let history: DownloadLogEntry[] = [];
        try {
            if (b.download_history) {
                history = JSON.parse(b.download_history);
            }
        } catch (e) {
            history = [];
        }

        return {
            id: b.id,
            filename: b.filename,
            file_size: Number(b.file_size),
            checksum_sha256: b.checksum_sha256,
            table_count: b.table_count,
            record_count: b.record_count,
            status: b.status,
            progress: b.progress,
            current_step: b.current_step,
            error_message: b.error_message,
            created_by: b.created_by,
            created_at: b.created_at,
            completed_at: b.completed_at,
            download_count: b.download_count,
            last_download_at: b.last_download_at,
            last_download_by: b.last_download_by,
            last_download_ip: b.last_download_ip,
            last_download_browser: b.last_download_browser,
            download_history: history
        };
    }

    /**
     * Record download audit log and return file path
     */
    public static async recordDownloadAndGetFile(
        id: number,
        downloader: { adminUsername: string; ip: string; userAgent: string }
    ): Promise<{ filePath: string; filename: string; fileSize: number } | null> {
        const b = await prisma.database_backups.findUnique({
            where: { id }
        });

        if (!b || b.status !== 'COMPLETED') {
            return null;
        }

        if (!fs.existsSync(b.file_path)) {
            return null;
        }

        const timestamp = Math.floor(Date.now() / 1000);
        const parsedBrowser = parseUserAgent(downloader.userAgent);

        let history: DownloadLogEntry[] = [];
        try {
            if (b.download_history) {
                history = JSON.parse(b.download_history);
            }
        } catch (e) {
            history = [];
        }

        const newLogEntry: DownloadLogEntry = {
            downloaded_at: timestamp,
            downloaded_by: downloader.adminUsername || 'Admin',
            ip: downloader.ip || 'Unknown IP',
            browser: parsedBrowser,
            user_agent: downloader.userAgent || ''
        };

        history.unshift(newLogEntry);
        if (history.length > 50) {
            history = history.slice(0, 50); // Keep latest 50 logs
        }

        await prisma.database_backups.update({
            where: { id },
            data: {
                download_count: { increment: 1 },
                last_download_at: timestamp,
                last_download_by: downloader.adminUsername || 'Admin',
                last_download_ip: downloader.ip || 'Unknown IP',
                last_download_ua: downloader.userAgent || '',
                last_download_browser: parsedBrowser,
                download_history: JSON.stringify(history)
            }
        });

        const stats = fs.statSync(b.file_path);

        return {
            filePath: b.file_path,
            filename: b.filename,
            fileSize: stats.size
        };
    }

    /**
     * Delete backup file from disk and record from DB
     */
    public static async deleteBackup(id: number): Promise<boolean> {
        const b = await prisma.database_backups.findUnique({
            where: { id }
        });

        if (!b) return false;

        if (fs.existsSync(b.file_path)) {
            try {
                fs.unlinkSync(b.file_path);
            } catch (e) {
                console.error(`Failed to delete backup file ${b.file_path}:`, e);
            }
        }

        await prisma.database_backups.delete({
            where: { id }
        });

        return true;
    }
}
