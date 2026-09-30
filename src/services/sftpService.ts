import SftpClient from 'ssh2-sftp-client';
import path from 'path';

export interface ProductInstallerInfo {
    id: string; // Unique file ID e.g. "file_1787560341_abc"
    filename: string;
    url: string;
    size: string; // e.g. "45.2 MB"
    bytes?: number;
    uploaded_at: number; // epoch timestamp in seconds
    os?: 'windows' | 'mac';
}

export interface ProductInstallerFiles {
    windows: ProductInstallerInfo[];
    mac: ProductInstallerInfo[];
}

export class SftpService {
    private readonly host = process.env.SFTP_HOST || '127.0.0.1';
    private readonly port = parseInt(process.env.SFTP_PORT || '22', 10);
    private readonly username = process.env.SFTP_USERNAME || 'sftp-user';
    private readonly password = process.env.SFTP_PASSWORD || '';
    private readonly remoteBaseDir = process.env.SFTP_BASE_DIR || '/var/www/html/setup-windows-bin/x86';
    private readonly publicDownloadBase = process.env.SFTP_PUBLIC_URL || 'https://download.example.com';

    /**
     * Creates and connects an SFTP client instance
     */
    private async getClient(): Promise<SftpClient> {
        const client = new SftpClient();
        await client.connect({
            host: this.host,
            port: this.port,
            username: this.username,
            password: this.password,
            readyTimeout: 30000,
            retries: 2
        });
        return client;
    }

    /**
     * Sanitizes filename to prevent directory traversal or invalid characters
     */
    sanitizeFilename(name: string): string {
        const basename = path.basename(name.trim());
        // Replace dangerous characters, preserve spaces, hyphens, dots, underscores
        return basename.replace(/[\\/:*?"<>|]/g, '_');
    }

    /**
     * Format bytes into human readable format
     */
    formatBytes(bytes: number): string {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Uploads local file to remote SFTP directory and returns metadata
     */
    async uploadInstaller(localFilePath: string, rawFilename: string, osType: 'windows' | 'mac' = 'windows'): Promise<ProductInstallerInfo> {
        const filename = this.sanitizeFilename(rawFilename);
        const remotePath = `${this.remoteBaseDir}/${filename}`;
        const client = await this.getClient();

        try {
            // Upload local file to remote path with chunk size optimization
            await client.fastPut(localFilePath, remotePath, {
                concurrency: 4,
                chunkSize: 64 * 1024
            });

            // Get uploaded file stats for exact size
            const stat = await client.stat(remotePath);
            const bytes = typeof stat.size === 'number' ? stat.size : 0;
            const size = this.formatBytes(bytes);
            const now = Math.floor(Date.now() / 1000);
            const url = `${this.publicDownloadBase}/${encodeURIComponent(filename)}`;
            const fileId = `${osType}_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

            return {
                id: fileId,
                filename,
                url,
                size,
                bytes,
                uploaded_at: now,
                os: osType
            };
        } finally {
            await client.end();
        }
    }

    /**
     * Deletes a remote installer file from SFTP
     */
    async deleteInstaller(rawFilename: string): Promise<boolean> {
        if (!rawFilename) return false;
        const filename = this.sanitizeFilename(rawFilename);
        const remotePath = `${this.remoteBaseDir}/${filename}`;
        const client = await this.getClient();

        try {
            const exists = await client.exists(remotePath);
            if (exists) {
                await client.delete(remotePath);
                return true;
            }
            return false;
        } catch (error) {
            console.error(`SFTP Delete Error for ${filename}:`, error);
            return false;
        } finally {
            await client.end();
        }
    }

    /**
     * Checks if a file exists on remote SFTP directory
     */
    async checkFileExists(rawFilename: string): Promise<boolean> {
        if (!rawFilename) return false;
        const filename = this.sanitizeFilename(rawFilename);
        const remotePath = `${this.remoteBaseDir}/${filename}`;
        const client = await this.getClient();

        try {
            const exists = await client.exists(remotePath);
            return Boolean(exists);
        } catch {
            return false;
        } finally {
            await client.end();
        }
    }

    /**
     * Safely parse installer_files JSON from DB into multi-file arrays
     */
    parseInstallerFiles(raw: unknown): ProductInstallerFiles {
        const result: ProductInstallerFiles = { windows: [], mac: [] };
        if (!raw) return result;

        let parsed: unknown = raw;
        if (typeof raw === 'string') {
            const trimmed = raw.trim();
            if (!trimmed) return result;
            try {
                parsed = JSON.parse(trimmed) as unknown;
            } catch {
                return result;
            }
        }

        if (!parsed || typeof parsed !== 'object') return result;
        const casted = parsed as { windows?: unknown; mac?: unknown };

        // Parse Windows files
        if (Array.isArray(casted.windows)) {
            result.windows = casted.windows
                .filter(item => item && typeof item === 'object' && (item as { filename?: unknown }).filename)
                .map((item, idx) => {
                    const it = item as { id?: string; filename: string; url?: string; size?: string; bytes?: number; uploaded_at?: number };
                    return {
                        id: it.id || `win_${Date.now()}_${idx}`,
                        filename: it.filename,
                        url: it.url || `${this.publicDownloadBase}/${encodeURIComponent(it.filename)}`,
                        size: it.size || '0 B',
                        bytes: it.bytes,
                        uploaded_at: it.uploaded_at || Math.floor(Date.now() / 1000),
                        os: 'windows'
                    };
                });
        } else if (casted.windows && typeof casted.windows === 'object') {
            const it = casted.windows as { id?: string; filename?: string; url?: string; size?: string; bytes?: number; uploaded_at?: number };
            if (it.filename) {
                result.windows = [{
                    id: it.id || `win_${Date.now()}_0`,
                    filename: it.filename,
                    url: it.url || `${this.publicDownloadBase}/${encodeURIComponent(it.filename)}`,
                    size: it.size || '0 B',
                    bytes: it.bytes,
                    uploaded_at: it.uploaded_at || Math.floor(Date.now() / 1000),
                    os: 'windows'
                }];
            }
        }

        // Parse Mac files
        if (Array.isArray(casted.mac)) {
            result.mac = casted.mac
                .filter(item => item && typeof item === 'object' && (item as { filename?: unknown }).filename)
                .map((item, idx) => {
                    const it = item as { id?: string; filename: string; url?: string; size?: string; bytes?: number; uploaded_at?: number };
                    return {
                        id: it.id || `mac_${Date.now()}_${idx}`,
                        filename: it.filename,
                        url: it.url || `${this.publicDownloadBase}/${encodeURIComponent(it.filename)}`,
                        size: it.size || '0 B',
                        bytes: it.bytes,
                        uploaded_at: it.uploaded_at || Math.floor(Date.now() / 1000),
                        os: 'mac'
                    };
                });
        } else if (casted.mac && typeof casted.mac === 'object') {
            const it = casted.mac as { id?: string; filename?: string; url?: string; size?: string; bytes?: number; uploaded_at?: number };
            if (it.filename) {
                result.mac = [{
                    id: it.id || `mac_${Date.now()}_0`,
                    filename: it.filename,
                    url: it.url || `${this.publicDownloadBase}/${encodeURIComponent(it.filename)}`,
                    size: it.size || '0 B',
                    bytes: it.bytes,
                    uploaded_at: it.uploaded_at || Math.floor(Date.now() / 1000),
                    os: 'mac'
                }];
            }
        }

        return result;
    }

    /**
     * Serialize ProductInstallerFiles to JSON string
     */
    serializeInstallerFiles(files: ProductInstallerFiles): string {
        return JSON.stringify(files);
    }
}

export const sftpService = new SftpService();
