/**
 * stream-resolver.ts
 *
 * Shared utility for resolving IPTV stream URLs before handing them to MPV.
 *
 * Previously this logic was duplicated in 4 places inside App.tsx:
 *   - handleLoadStream   (Live TV)
 *   - handlePlayCatchup  (Live TV catchup / timeshift)
 *   - handlePlayVod      (VOD movies / series)
 *   - dvr:resolve_url_now event handler (DVR Stalker URL pre-resolution)
 *
 * All 4 callers now call resolvePlayUrl() instead.
 */

import { StalkerClient } from '@ynotv/local-adapter';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The shape of a source as returned by window.storage.getSource() */
interface SourceData {
    id: string;
    type: 'xtream' | 'm3u' | 'stalker' | 'epg';
    url: string;
    username?: string;
    password?: string;
    mac?: string;
    user_agent?: string;
    name?: string;
}

/** Extra options for catchup / timeshift URLs (Xtream only) */
export interface CatchupOptions {
    /** Raw stream ID (source-prefix already stripped, e.g. "12345") */
    rawStreamId: string;
    /** Start time of the programme in milliseconds */
    startTimeMs: number;
    /** Requested duration of the programme in minutes */
    durationMinutes: number;
}

/** Result returned by resolvePlayUrl */
export interface ResolvedUrl {
    /** The final, playable URL to pass to MPV */
    url: string;
    /** Custom User-Agent, if the source defines one */
    userAgent?: string;
    /** Source name (for multiview display label) */
    sourceName?: string | null;
}

// ---------------------------------------------------------------------------
// Main resolver
// ---------------------------------------------------------------------------

/**
 * Resolve a raw stream URL (which may be a Stalker opaque token or a Xtream
 * catchup URL) into a concrete, playable HTTP URL.
 *
 * @param sourceId   The source ID to look up from window.storage
 * @param rawUrl     The direct_url / URL string to resolve
 * @param catchup    Pass this for Xtream catchup (timeshift) URLs only
 * @returns          Resolved URL + optional userAgent + optional sourceName
 *
 * @throws           If the Stalker client cannot resolve the URL (callers
 *                   should catch and show an error to the user).
 */
export async function resolvePlayUrl(
    sourceId: string | null | undefined,
    rawUrl: string,
    catchup?: CatchupOptions,
): Promise<ResolvedUrl> {
    // No storage API → nothing to resolve
    if (!window.storage || !sourceId) {
        return { url: rawUrl };
    }

    (window as any).isPlaybackResolving = true;
    (window as any).lastPlaybackTime = Date.now();

    try {
        let sourceData: SourceData | undefined;
        try {
            const sourceRes = await window.storage.getSource(sourceId);
            sourceData = sourceRes.data ?? undefined;
        } catch (e) {
            console.error('[stream-resolver] Failed to fetch source:', e);
            return { url: rawUrl };
        }

        if (!sourceData) {
            return { url: rawUrl };
        }

        let userAgent: string | undefined = sourceData.user_agent || undefined;
        if (!userAgent && (sourceData.type === 'xtream' || sourceData.type === 'm3u')) {
            userAgent = 'ynoTVPlayer';
        }
        const sourceName: string | null = sourceData.name ?? null;
        let resolvedUrl = rawUrl;

        // ── Stalker sources ──────────────────────────────────────────────────────
        // Stalker URLs are opaque tokens like "stalker_ch:12345" or "/media/…"
        // and must be resolved to a real HTTP URL via the Stalker portal API.
        if (
            sourceData.type === 'stalker' &&
            (rawUrl.startsWith('stalker_') || rawUrl.startsWith('/media/'))
        ) {
            const client = new StalkerClient(
                {
                    baseUrl: sourceData.url,
                    mac: sourceData.mac || '',
                    userAgent: sourceData.user_agent,
                },
                sourceData.id,
            );

            // resolveStreamUrl() throws on network / auth failure — caller handles it
            resolvedUrl = await client.resolveStreamUrl(rawUrl);
            return { url: resolvedUrl, userAgent, sourceName };
        }

        // ── Xtream catchup / timeshift ───────────────────────────────────────────
        // For catchup playback on Xtream sources, we must build a special timeshift
        // URL. This only applies when the caller provides `catchup` options.
        if (catchup && (sourceData.type === 'xtream' || (sourceData.type === 'm3u' && (sourceData as any).xtream_catchup))) {
            const { XtreamClient } = await import('@ynotv/local-adapter');
            const { rawStreamId, startTimeMs, durationMinutes } = catchup;

            // Determine XC credentials: from xtream_catchup (M3U) or source (Xtream)
            const xtreamCatchup = (sourceData as any).xtream_catchup;
            const xcUrl = xtreamCatchup?.url || sourceData.url;
            const xcUsername = xtreamCatchup?.username || sourceData.username || '';
            const xcPassword = xtreamCatchup?.password || sourceData.password || '';

            // Re-calculate the maximum allowed duration (EPG start → now, capped)
            const endMs = startTimeMs + durationMinutes * 60_000;
            const actualDurationMinutes = Math.ceil(
                (Math.min(endMs, Date.now()) - startTimeMs) / 60_000,
            );

            // Fetch server_info to calculate the precise timezone offset of the server
            let offsetMs = 0;
            try {
                const client = new XtreamClient({
                    baseUrl: xcUrl,
                    username: xcUsername,
                    password: xcPassword,
                    userAgent: sourceData.user_agent,
                }, sourceData.id);

                const auth = await client.authenticate();
                if (auth?.server_info?.time_now && auth?.server_info?.timestamp_now) {
                    // Parse time_now ("YYYY-MM-DD HH:MM:SS") assuming it's UTC to find the exact drift
                    const timeNowUtcStr = auth.server_info.time_now.replace(' ', 'T') + 'Z';
                    const timeNowUtcMs = new Date(timeNowUtcStr).getTime();
                    const actualUtcMs = auth.server_info.timestamp_now * 1000;

                    if (!isNaN(timeNowUtcMs) && !isNaN(actualUtcMs)) {
                        offsetMs = timeNowUtcMs - actualUtcMs;
                        console.log(`[stream-resolver] Calculated Xtream server timezone offset: ${offsetMs / 3600000} hours`);
                    }
                }
            } catch (e) {
                console.warn('[stream-resolver] Failed to fetch server info for timezone offset:', e);
            }

            const serverTimeMs = startTimeMs + offsetMs;

            resolvedUrl = XtreamClient.buildTimeshiftUrl(
                rawStreamId,
                xcUrl,
                xcUsername,
                xcPassword,
                actualDurationMinutes,
                new Date(serverTimeMs),
            );
            console.log(`[stream-resolver] Catchup URL: ${resolvedUrl}`);
            console.log(`[stream-resolver] Catchup details:`, {
                sourceType: sourceData.type,
                xcUrl,
                rawStreamId,
                actualDurationMinutes,
                serverTimeMs: new Date(serverTimeMs).toISOString(),
                originalStartMs: new Date(startTimeMs).toISOString(),
                offsetMs,
            });
            return { url: resolvedUrl, userAgent, sourceName };
        }

        // ── All other source types (M3U, plain Xtream live) ─────────────────────
        // No URL transformation needed; just return with the userAgent + name.
        return { url: resolvedUrl, userAgent, sourceName };
    } finally {
        (window as any).isPlaybackResolving = false;
    }
}
