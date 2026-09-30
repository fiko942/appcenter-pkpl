
import axios from 'axios';

export interface FileData {
    name: string;
    url: string;
    date: string;
    size: string;
    type: 'exe' | 'dmg' | 'zip' | 'other';
}

export class DownloadService {
    private readonly baseUrl = 'http://download.ziqva.com';

    /**
     * Fetch and parse file listing from download server
     */
    async getFiles(): Promise<FileData[]> {
        try {
            const response = await axios.get(this.baseUrl, {
                timeout: 5000,
                headers: {
                    'User-Agent': 'AppCenter/1.0'
                }
            });
            const html = response.data as string;

            // Extract path from Title (e.g. Index of /setup-windows-bin/x86/)
            const titleMatch = html.match(/<title>Index of ([^<]+)<\/title>/);
            const path = titleMatch ? titleMatch[1].trim() : '/';

            // Construct base URL with path (Using HTTPS as requested)
            const downloadBase = `https://download.ziqva.com${path}`;

            return this.parseHtml(html, downloadBase);
        } catch (error) {
            console.error('DownloadService Error:', error instanceof Error ? error.message : error);
            return [];
        }
    }

    /**
     * Parse raw HTML directory listing
     * Expected format: Standard Apache/Nginx Autoindex
     */
    private parseHtml(html: string, downloadBase: string): FileData[] {
        const files: FileData[] = [];

        // Split by lines to process each entry
        const lines = html.split('\n');

        for (const line of lines) {
            // Ignore Parent Directory links or empty lines
            if (line.includes('Parent Directory') || line.includes('../') || !line.includes('<a href="')) {
                continue;
            }

            // Extract HREF/Name
            const linkMatch = line.match(/<a href="([^"]+)">([^<]+)<\/a>/);
            if (!linkMatch) continue;

            // Extract raw HREF for URL (preserve encoding)
            const rawHref = linkMatch[1];

            // Decode for Display Name
            const fileName = decodeURIComponent(rawHref);

            // Skip folders if they end with /
            if (rawHref.endsWith('/') || fileName.endsWith('/')) continue;

            // Extract Date and Size (Text after the closing </a> tag)
            const restOfLine = line.substring(line.indexOf('</a>') + 4).trim();

            // Typical autoindex format: DATE  TIME  SIZE
            const metaMatch = restOfLine.match(/(\d{2}-[A-Za-z]{3}-\d{4}\s\d{2}:\d{2})\s+([\d-]+)/);

            let date = '-';
            let size = '-';

            if (metaMatch) {
                date = metaMatch[1];
                const rawSize = metaMatch[2];
                if (rawSize !== '-') {
                    size = this.formatSize(parseInt(rawSize));
                }
            }

            files.push({
                name: fileName,
                url: `${downloadBase}${rawHref}`,
                date: date,
                size: size,
                type: this.getFileType(fileName)
            });
        }

        return files;
    }

    /**
     * format bytes to readable string
     */
    private formatSize(bytes: number): string {
        if (!bytes || isNaN(bytes) || bytes <= 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Determine file type for icon display
     */
    private getFileType(filename: string): 'exe' | 'dmg' | 'zip' | 'other' {
        const lower = filename.toLowerCase();
        if (lower.endsWith('.exe')) return 'exe';
        if (lower.endsWith('.dmg')) return 'dmg';
        if (lower.endsWith('.zip') || lower.endsWith('.rar') || lower.endsWith('.7z')) return 'zip';
        return 'other';
    }
}

export const downloadService = new DownloadService();
