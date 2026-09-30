import https from 'https';

export interface ProductTutorialItem {
    id: string;
    title: string;
    url: string;
    embedUrl?: string;
    isPlaylist?: boolean;
    videoId?: string;
    playlistId?: string;
}

/**
 * Parses any YouTube URL (single video, shorts, playlist, shortened youtu.be, embed)
 * and returns the normalized embed URL for iframe player.
 */
export function parseYouTubeEmbedUrl(url: string): { embedUrl: string; isPlaylist: boolean; videoId?: string; playlistId?: string } | null {
    if (!url || typeof url !== 'string') return null;
    const cleanUrl = url.trim();

    try {
        // 1. YouTube Playlist URL: youtube.com/playlist?list=ID
        const playlistMatch = cleanUrl.match(/[?&]list=([a-zA-Z0-9_-]+)/i);
        const isPurePlaylist = cleanUrl.includes('/playlist') && Boolean(playlistMatch);

        if (isPurePlaylist && playlistMatch) {
            const playlistId = playlistMatch[1];
            return {
                embedUrl: `https://www.youtube-nocookie.com/embed/videoseries?list=${playlistId}`,
                isPlaylist: true,
                playlistId
            };
        }

        // 2. YouTube Shorts: youtube.com/shorts/ID
        const shortsMatch = cleanUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/i);
        if (shortsMatch) {
            const videoId = shortsMatch[1];
            return {
                embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
                isPlaylist: false,
                videoId
            };
        }

        // 3. Shortened youtu.be: youtu.be/ID
        const youtuBeMatch = cleanUrl.match(/youtu\.be\/([a-zA-Z0-9_-]+)/i);
        if (youtuBeMatch) {
            const videoId = youtuBeMatch[1];
            const hasList = playlistMatch ? `?list=${playlistMatch[1]}` : '';
            return {
                embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}${hasList}`,
                isPlaylist: Boolean(playlistMatch),
                videoId,
                playlistId: playlistMatch ? playlistMatch[1] : undefined
            };
        }

        // 4. Standard youtube.com/watch?v=ID
        const watchMatch = cleanUrl.match(/[?&]v=([a-zA-Z0-9_-]+)/i);
        if (watchMatch) {
            const videoId = watchMatch[1];
            const hasList = playlistMatch ? `?list=${playlistMatch[1]}` : '';
            return {
                embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}${hasList}`,
                isPlaylist: Boolean(playlistMatch),
                videoId,
                playlistId: playlistMatch ? playlistMatch[1] : undefined
            };
        }

        // 5. Direct embed URL: youtube.com/embed/ID or youtube-nocookie.com/embed/ID
        const embedMatch = cleanUrl.match(/youtube(?:-nocookie)?\.com\/embed\/([a-zA-Z0-9_-]+)/i);
        if (embedMatch) {
            const cleanEmbed = cleanUrl.replace('youtube.com/embed', 'youtube-nocookie.com/embed');
            return {
                embedUrl: cleanEmbed,
                isPlaylist: cleanUrl.includes('videoseries') || Boolean(playlistMatch),
                videoId: embedMatch[1],
                playlistId: playlistMatch ? playlistMatch[1] : undefined
            };
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Fetches all video items in a YouTube playlist via YouTube RSS Feed
 */
export function fetchYouTubePlaylistVideos(playlistId: string): Promise<ProductTutorialItem[]> {
    return new Promise((resolve) => {
        if (!playlistId) return resolve([]);
        const feedUrl = `https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`;

        const req = https.get(feedUrl, { timeout: 8000 }, (res) => {
            if (res.statusCode !== 200) {
                res.resume(); // Consume response data to free memory
                return resolve([]);
            }
            let xmlData = '';
            res.on('data', (chunk) => { xmlData += chunk; });
            res.on('end', () => {
                const entries = xmlData.split('<entry>');
                const videos: ProductTutorialItem[] = [];

                for (let i = 1; i < entries.length; i++) {
                    const entry = entries[i];
                    const titleMatch = entry.match(/<title>([^<]+)<\/title>/);
                    const videoIdMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);

                    if (videoIdMatch && videoIdMatch[1]) {
                        const videoId = videoIdMatch[1];
                        const rawTitle = titleMatch ? titleMatch[1] : `Video ${i}`;
                        const decodedTitle = rawTitle
                            .replace(/&amp;/g, '&')
                            .replace(/&lt;/g, '<')
                            .replace(/&gt;/g, '>')
                            .replace(/&quot;/g, '"')
                            .replace(/&#39;/g, "'");

                        videos.push({
                            id: `yt_${videoId}`,
                            title: decodedTitle,
                            url: `https://www.youtube.com/watch?v=${videoId}`,
                            embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}`,
                            videoId,
                            isPlaylist: false
                        });
                    }
                }
                resolve(videos);
            });
        });

        req.on('timeout', () => {
            req.destroy();
            resolve([]);
        });

        req.on('error', () => resolve([]));
    });
}

/**
 * Automatically expands any playlist items into individual video items.
 */
export async function expandTutorialsWithPlaylists(tutorials: ProductTutorialItem[]): Promise<ProductTutorialItem[]> {
    const results: ProductTutorialItem[] = [];

    for (const item of tutorials) {
        const parsed = parseYouTubeEmbedUrl(item.url);
        if (parsed && parsed.isPlaylist && parsed.playlistId) {
            const playlistVideos = await fetchYouTubePlaylistVideos(parsed.playlistId);
            if (playlistVideos.length > 0) {
                results.push(...playlistVideos);
                continue;
            }
        }
        results.push(item);
    }

    return results;
}

/**
 * Sanitizes and normalizes an array of tutorials or raw JSON string.
 */
export function sanitizeTutorials(input: unknown): ProductTutorialItem[] {
    if (!input) return [];

    let rawList: unknown[] = [];
    if (typeof input === 'string') {
        const trimmed = input.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed) as unknown;
            if (Array.isArray(parsed)) {
                rawList = parsed;
            }
        } catch {
            return [];
        }
    } else if (Array.isArray(input)) {
        rawList = input;
    }

    const results: ProductTutorialItem[] = [];

    for (let i = 0; i < rawList.length; i++) {
        const item = rawList[i];
        if (item && typeof item === 'object') {
            const casted = item as { id?: unknown; title?: unknown; url?: unknown; embedUrl?: unknown; isPlaylist?: unknown; videoId?: unknown; playlistId?: unknown };
            const title = typeof casted.title === 'string' ? casted.title.trim() : '';
            const url = typeof casted.url === 'string' ? casted.url.trim() : '';

            if (url) {
                const parsedYt = parseYouTubeEmbedUrl(url);
                const id = typeof casted.id === 'string' && casted.id.trim()
                    ? casted.id.trim()
                    : `tut_${Date.now()}_${i + 1}`;

                results.push({
                    id,
                    title: title || `Tutorial ${i + 1}`,
                    url,
                    embedUrl: typeof casted.embedUrl === 'string' && casted.embedUrl ? casted.embedUrl : (parsedYt ? parsedYt.embedUrl : url),
                    isPlaylist: parsedYt ? parsedYt.isPlaylist : false,
                    videoId: parsedYt ? parsedYt.videoId : undefined,
                    playlistId: parsedYt ? parsedYt.playlistId : undefined
                });
            }
        }
    }

    return results;
}

/**
 * Serializes tutorial list to JSON string for database storage.
 */
export function serializeTutorials(input: unknown): string {
    const list = sanitizeTutorials(input);
    return JSON.stringify(list);
}

/**
 * Generates the YouTube thumbnail URL for a video or playlist.
 */
export function getYouTubeThumbnail(url?: string | null, embedUrl?: string | null, videoId?: string | null): string {
    if (videoId && typeof videoId === 'string' && videoId.trim()) {
        return `https://img.youtube.com/vi/${videoId.trim()}/hqdefault.jpg`;
    }
    const targetUrl = (url || embedUrl || '').trim();
    if (targetUrl) {
        const parsed = parseYouTubeEmbedUrl(targetUrl);
        if (parsed && parsed.videoId) {
            return `https://img.youtube.com/vi/${parsed.videoId}/hqdefault.jpg`;
        }
    }
    // Fallback abstract dark technology background
    return `https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=60`;
}

