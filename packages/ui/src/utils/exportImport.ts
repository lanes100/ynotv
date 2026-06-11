import { db, type StoredChannel, type StoredCategory, type CustomGroup, type CustomGroupChannel } from '../db';
import type { Source } from '@ynotv/core';
import type { AppSettings } from '../types/app';
import { Bridge } from '../services/tauri-bridge';
import { normalizeBoolean } from './db-helpers';

export interface ExportData {
    version: number;
    timestamp: string;
    sources: Source[];
    settings: AppSettings;
    favorites: Array<{ streamId: string; sourceId: string }>;
    categoryPreferences: Array<{
        categoryId: string;
        sourceId: string;
        enabled?: boolean;
        displayOrder?: number;
        filterWords?: string[];
        alias?: string;
    }>;
    channelPreferences: Array<{
        streamId: string;
        sourceId: string;
        enabled?: boolean;
        alias?: string;
    }>;
    vodCategoryPreferences?: Array<{
        categoryId: string;
        sourceId: string;
        enabled?: boolean;
        displayOrder?: number;
    }>;
    customGroups: Array<{
        groupId: string;
        name: string;
        displayOrder: number;
        channels: string[]; // stream_ids in order
    }>;
    // v4 additions
    watchlist: Array<{
        id: number;
        programId: string;
        channelId: string;
        channelName: string;
        programTitle: string;
        description?: string;
        startTime: number;
        endTime: number;
        sourceId: string;
        addedAt: number;
        reminderEnabled: boolean;
        reminderMinutes: number;
        autoswitchEnabled: boolean;
        autoswitchSecondsBefore: number;
        reminderShown: boolean;
        autoswitchTriggered: boolean;
    }>;
    epgChannelOverrides: Array<{
        streamId: string;
        epgChannelId?: string;
        streamIcon?: string;
        timeshiftHours?: number;
    }>;
    epgProgramOverrides: Array<{
        id: string;
        streamId: string;
        title?: string;
        description?: string;
        start?: string;
        end?: string;
        isDeleted?: number;
        isCustom?: number;
    }>;
    dvrSchedules: Array<{
        id: number;
        sourceId: string;
        channelId: string;
        channelName: string;
        programTitle: string;
        scheduledStart: number;
        scheduledEnd: number;
        startPaddingSec: number;
        endPaddingSec: number;
        status: string;
        seriesMatchTitle?: string;
        recurrence?: string;
        createdAt: number;
        startedAt?: number;
        streamUrl?: string;
    }>;
    dvrRecordings: Array<{
        id: number;
        scheduleId?: number;
        filePath: string;
        filename: string;
        sizeBytes?: number;
        channelName: string;
        programTitle: string;
        scheduledStart?: number;
        scheduledEnd?: number;
        actualStart: number;
        actualEnd?: number;
        durationSec?: number;
        status: string;
        errorMessage?: string;
        keepUntil?: number;
        autoDeletePolicy: string;
        createdAt: number;
        thumbnailPath?: string;
    }>;
    dvrSettings: Array<{ key: string; value: string }>;
    failoverGroups: Array<{
        groupId: string;
        name: string;
        createdAt: number;
        members: Array<{
            id: number;
            streamId: string;
            priority: number;
        }>;
    }>;
    vodHistory: Array<{
        id: number;
        mediaId: string;
        mediaType: 'movie' | 'series';
        sourceId: string;
        title: string;
        watchedAt: number;
        progressSeconds?: number;
        totalDuration?: number;
        posterUrl?: string;
        seasonNum?: number;
        episodeNum?: number;
        episodeTitle?: string;
    }>;
    episodeHistory: Array<{
        id: number;
        episodeId: string;
        seriesId: string;
        sourceId: string;
        seasonNum: number;
        episodeNum: number;
        title?: string;
        watchedAt: number;
        progressSeconds?: number;
        totalDuration?: number;
        completed: number;
    }>;
    userPrefs: Array<{ key: string; value: string }>;
    stremioAddons?: any;
    stremioWatchHistory?: any;
}

const EXPORT_VERSION = 5;

/**
 * Export all application data to a JSON file
 */
export async function exportAllData(): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
        if (!window.storage) throw new Error('Storage API not available');

        // 1. Get Sources and Settings
        const sourcesResult = await window.storage.getSources();
        const settingsResult = await window.storage.getSettings();

        if (sourcesResult.error) throw new Error(sourcesResult.error);
        if (settingsResult.error) throw new Error(settingsResult.error);

        // 2. Get Favorites from DB
        const allChannels = await db.channels.toArray();
        const favorites = allChannels.filter(ch => normalizeBoolean(ch.is_favorite));
        const favoriteData = favorites.map(ch => ({
            streamId: ch.stream_id,
            sourceId: ch.source_id
        }));

        // 3. Get Category Preferences (including filter words and alias)
        const allCategories = await db.categories.toArray();
        const categoryCallback = (cat: StoredCategory) => {
            // SQLite returns BOOLEAN as 0/1, handle both cases
            const enabled = cat.enabled as boolean | number | undefined;
            const isDisabled = enabled === false || enabled === 0;
            const hasCustomSettings = isDisabled ||
                (cat.display_order !== undefined && cat.display_order !== 0) ||
                (cat.filter_words && cat.filter_words.length > 0) ||
                (cat.alias && cat.alias.trim().length > 0);
            return hasCustomSettings;
        };

        const categoryPreferences = allCategories
            .filter(categoryCallback)
            .map(cat => ({
                categoryId: cat.category_id,
                sourceId: cat.source_id,
                enabled: cat.enabled,
                displayOrder: cat.display_order,
                filterWords: cat.filter_words,
                alias: cat.alias
            }));

        // 4. Get Channel Preferences (enabled/disabled status and alias)
        const channelCallback = (ch: StoredChannel) => {
            const enabled = ch.enabled as boolean | number | undefined;
            // Include if channel has been explicitly disabled or has an alias
            const isDisabled = enabled === false || enabled === 0;
            return isDisabled || (ch.alias && ch.alias.trim().length > 0);
        };

        const channelPreferences = allChannels
            .filter(channelCallback)
            .map(ch => ({
                streamId: ch.stream_id,
                sourceId: ch.source_id,
                enabled: ch.enabled,
                alias: ch.alias
            }));

        // 4b. Get VOD Category Preferences (enabled/disabled status and display order)
        const allVodCategories = await db.vodCategories.toArray();
        const vodCategoryPreferences = allVodCategories
            .filter(cat => cat.enabled === false || (cat.display_order !== undefined && cat.display_order !== 0))
            .map(cat => ({
                categoryId: cat.category_id,
                sourceId: cat.source_id,
                enabled: cat.enabled,
                displayOrder: cat.display_order
            }));

        // 5. Get Custom Groups with their channels
        const allCustomGroups = await db.customGroups.toArray();
        const allGroupChannels = await db.customGroupChannels.toArray();

        const customGroups = allCustomGroups.map(group => {
            const groupChans = allGroupChannels
                .filter(gc => gc.group_id === group.group_id)
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0))
                .map(gc => gc.stream_id);

            return {
                groupId: group.group_id,
                name: group.name,
                displayOrder: group.display_order,
                channels: groupChans
            };
        });

        // 6. Get Watchlist
        const allWatchlist = await db.watchlist.toArray();
        const watchlist = allWatchlist.map(w => ({
            id: w.id!,
            programId: w.program_id,
            channelId: w.channel_id,
            channelName: w.channel_name,
            programTitle: w.program_title,
            description: w.description,
            startTime: w.start_time,
            endTime: w.end_time,
            sourceId: w.source_id,
            addedAt: w.added_at,
            reminderEnabled: w.reminder_enabled,
            reminderMinutes: w.reminder_minutes,
            autoswitchEnabled: w.autoswitch_enabled,
            autoswitchSecondsBefore: w.autoswitch_seconds_before,
            reminderShown: w.reminder_shown,
            autoswitchTriggered: w.autoswitch_triggered
        }));

        // 7. Get EPG Overrides
        const epgChannelOverrides = (await db.epgChannelOverrides.toArray()).map(o => ({
            streamId: o.stream_id,
            epgChannelId: o.epg_channel_id,
            streamIcon: o.stream_icon,
            timeshiftHours: o.timeshift_hours
        }));

        const epgProgramOverrides = (await db.epgProgramOverrides.toArray()).map(o => ({
            id: o.id,
            streamId: o.stream_id,
            title: o.title,
            description: o.description,
            start: o.start,
            end: o.end,
            isDeleted: o.is_deleted,
            isCustom: o.is_custom
        }));

        // 8. Get DVR data
        const dvrSchedules = (await db.dvrSchedules.toArray()).map(s => ({
            id: s.id!,
            sourceId: s.source_id,
            channelId: s.channel_id,
            channelName: s.channel_name,
            programTitle: s.program_title,
            scheduledStart: s.scheduled_start,
            scheduledEnd: s.scheduled_end,
            startPaddingSec: s.start_padding_sec,
            endPaddingSec: s.end_padding_sec,
            status: s.status,
            seriesMatchTitle: s.series_match_title,
            recurrence: s.recurrence,
            createdAt: s.created_at,
            startedAt: s.started_at,
            streamUrl: s.stream_url
        }));

        const dvrRecordings = (await db.dvrRecordings.toArray()).map(r => ({
            id: r.id!,
            scheduleId: r.schedule_id,
            filePath: r.file_path,
            filename: r.filename,
            sizeBytes: r.size_bytes,
            channelName: r.channel_name,
            programTitle: r.program_title,
            scheduledStart: r.scheduled_start,
            scheduledEnd: r.scheduled_end,
            actualStart: r.actual_start,
            actualEnd: r.actual_end,
            durationSec: r.duration_sec,
            status: r.status,
            errorMessage: r.error_message,
            keepUntil: r.keep_until,
            autoDeletePolicy: r.auto_delete_policy,
            createdAt: r.created_at,
            thumbnailPath: r.thumbnail_path
        }));

        const dvrSettings = await db.dvrSettings.toArray();

        // 9. Get Failover Groups
        const allFailoverGroups = await db.failoverGroups.toArray();
        const allFailoverMembers = await db.failoverGroupMembers.toArray();
        const failoverGroups = allFailoverGroups.map(group => ({
            groupId: group.group_id,
            name: group.name,
            createdAt: group.created_at,
            members: allFailoverMembers
                .filter(m => m.group_id === group.group_id)
                .sort((a, b) => a.priority - b.priority)
                .map(m => ({
                    id: m.id!,
                    streamId: m.stream_id,
                    priority: m.priority
                }))
        }));

        // 10. Get VOD History
        const vodHistory = (await db.vodHistory.toArray()).map(h => ({
            id: h.id!,
            mediaId: h.media_id,
            mediaType: h.media_type,
            sourceId: h.source_id,
            title: h.title,
            watchedAt: h.watched_at,
            progressSeconds: h.progress_seconds,
            totalDuration: h.total_duration,
            posterUrl: h.poster_url,
            seasonNum: h.season_num,
            episodeNum: h.episode_num,
            episodeTitle: h.episode_title
        }));

        const episodeHistory = (await db.episodeHistory.toArray()).map(h => ({
            id: h.id!,
            episodeId: h.episode_id,
            seriesId: h.series_id,
            sourceId: h.source_id,
            seasonNum: h.season_num,
            episodeNum: h.episode_num,
            title: h.title,
            watchedAt: h.watched_at,
            progressSeconds: h.progress_seconds,
            totalDuration: h.total_duration,
            completed: h.completed
        }));

        // 11. Get User Prefs
        const userPrefs = await db.prefs.toArray();

        // 12. Get Stremio data from localStorage
        let stremioAddons = undefined;
        try {
            const addonsRaw = localStorage.getItem('stremio-addons');
            if (addonsRaw) {
                stremioAddons = JSON.parse(addonsRaw);
            }
        } catch (e) {
            console.warn('[Export] Failed to parse stremio-addons from localStorage:', e);
        }

        let stremioWatchHistory = undefined;
        try {
            const historyRaw = localStorage.getItem('stremio-watch-history');
            if (historyRaw) {
                stremioWatchHistory = JSON.parse(historyRaw);
            }
        } catch (e) {
            console.warn('[Export] Failed to parse stremio-watch-history from localStorage:', e);
        }

        const exportData: ExportData = {
            version: EXPORT_VERSION,
            timestamp: new Date().toISOString(),
            sources: sourcesResult.data || [],
            settings: settingsResult.data || { theme: 'glass-neon' },
            favorites: favoriteData,
            categoryPreferences,
            channelPreferences,
            vodCategoryPreferences,
            customGroups,
            watchlist,
            epgChannelOverrides,
            epgProgramOverrides,
            dvrSchedules,
            dvrRecordings,
            dvrSettings,
            failoverGroups,
            vodHistory,
            episodeHistory,
            userPrefs,
            stremioAddons,
            stremioWatchHistory
        };

        const fileName = `ynotv-backup-${new Date().toISOString().split('T')[0]}.json`;
        // Use Bridge for save dialog
        const result = await Bridge.saveJsonFile(JSON.stringify(exportData, null, 2), fileName);

        if (result.canceled) return { success: false, error: 'Cancelled' };

        return { success: true, filePath: result.data?.filePath };

    } catch (err) {
        console.error('Export failed:', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}

/**
 * Import application data from a JSON file
 */
export async function importAllData(): Promise<{ success: boolean; error?: string }> {
    try {
        if (!window.storage) throw new Error('Storage API not available');

        // 1. Open File via Bridge
        const fileResult = await Bridge.openJsonFile();
        if (fileResult.canceled) return { success: false, error: 'Cancelled' };

        if (!fileResult.data) throw new Error('Failed to read file');

        const data: ExportData = JSON.parse(fileResult.data);

        // Basic validation
        if (!data.version || !data.sources || !data.settings) {
            throw new Error('Invalid backup file format');
        }

        // 2. Restore Settings
        await window.storage.updateSettings(data.settings);

        // Restore Stremio addons
        if (data.stremioAddons) {
            localStorage.setItem('stremio-addons', JSON.stringify(data.stremioAddons));
        } else {
            localStorage.removeItem('stremio-addons');
        }

        // Restore Stremio watch history
        if (data.stremioWatchHistory) {
            localStorage.setItem('stremio-watch-history', JSON.stringify(data.stremioWatchHistory));
        } else {
            localStorage.removeItem('stremio-watch-history');
        }

        // 3. Restore Sources
        // Delete existing sources to ensure clean state matching backup
        const currentSources = await window.storage.getSources();
        if (currentSources.data) {
            for (const source of currentSources.data) {
                await window.storage.deleteSource(source.id);
            }
        }

        for (const source of data.sources) {
            await window.storage.saveSource(source);
        }

        // 4. Restore SQLite data in bulk transactions
        await db.transaction('rw', [
            db.channels, db.categories,
            db.watchlist, db.epgChannelOverrides, db.epgProgramOverrides,
            db.dvrSchedules, db.dvrRecordings, db.dvrSettings,
            db.failoverGroups, db.failoverGroupMembers,
            db.vodHistory, db.episodeHistory, db.prefs,
            db.sourcesMeta, db.programs, db.epgChannels,
            db.vodMovies, db.vodSeries, db.vodEpisodes,
            db.vodCategories, db.channelMetadata
        ], async () => {
            // Clear existing data (both configurations and cache tables)
            await db.channels.clear();
            await db.categories.clear();
            await db.watchlist.clear();
            await db.epgChannelOverrides.clear();
            await db.epgProgramOverrides.clear();
            await db.dvrSchedules.clear();
            await db.dvrRecordings.clear();
            await db.dvrSettings.clear();
            await db.failoverGroups.clear();
            await db.failoverGroupMembers.clear();
            await db.vodHistory.clear();
            await db.episodeHistory.clear();
            await db.prefs.clear();
            await db.sourcesMeta.clear();
            await db.programs.clear();
            await db.epgChannels.clear();
            await db.vodMovies.clear();
            await db.vodSeries.clear();
            await db.vodEpisodes.clear();
            await db.vodCategories.clear();
            await db.channelMetadata.clear();

            // Restore Favorites stubs
            if (data.favorites && data.favorites.length > 0) {
                const favoriteStubs = data.favorites.map(fav => ({
                    stream_id: fav.streamId,
                    source_id: fav.sourceId,
                    name: 'Unknown', // Placeholder, will be overwritten by sync
                    category_ids: [],
                    is_favorite: true
                } as unknown as StoredChannel));

                await db.channels.bulkAdd(favoriteStubs);
            }

            // Restore Category Preference stubs (including filter words and alias)
            if (data.categoryPreferences && data.categoryPreferences.length > 0) {
                const catStubs = data.categoryPreferences.map(pref => ({
                    category_id: pref.categoryId,
                    source_id: pref.sourceId,
                    category_name: 'Unknown', // Placeholder
                    enabled: pref.enabled,
                    display_order: pref.displayOrder,
                    filter_words: pref.filterWords,
                    alias: pref.alias
                } as StoredCategory));

                await db.categories.bulkAdd(catStubs);
            }

            // Restore VOD Category Preference stubs
            if (data.vodCategoryPreferences && data.vodCategoryPreferences.length > 0) {
                const vodCatStubs = data.vodCategoryPreferences.map(pref => ({
                    category_id: pref.categoryId,
                    source_id: pref.sourceId,
                    name: 'Unknown', // Placeholder
                    type: 'movie',
                    enabled: pref.enabled,
                    display_order: pref.displayOrder
                } as any));

                await db.vodCategories.bulkAdd(vodCatStubs);
            }

            // Restore Channel Preference stubs (enabled/disabled status and alias)
            if (data.channelPreferences && data.channelPreferences.length > 0) {
                const channelStubs = data.channelPreferences.map(pref => ({
                    stream_id: pref.streamId,
                    source_id: pref.sourceId,
                    name: 'Unknown', // Placeholder, will be overwritten by sync
                    category_ids: [],
                    enabled: pref.enabled,
                    alias: pref.alias
                } as unknown as StoredChannel));

                await db.channels.bulkAdd(channelStubs);
            }

            // Restore Watchlist
            if (data.watchlist && data.watchlist.length > 0) {
                const watchlistItems = data.watchlist.map(w => ({
                    id: w.id,
                    program_id: w.programId,
                    channel_id: w.channelId,
                    channel_name: w.channelName,
                    program_title: w.programTitle,
                    description: w.description,
                    start_time: w.startTime,
                    end_time: w.endTime,
                    source_id: w.sourceId,
                    added_at: w.addedAt,
                    reminder_enabled: w.reminderEnabled,
                    reminder_minutes: w.reminderMinutes,
                    autoswitch_enabled: w.autoswitchEnabled,
                    autoswitch_seconds_before: w.autoswitchSecondsBefore,
                    reminder_shown: w.reminderShown,
                    autoswitch_triggered: w.autoswitchTriggered
                }));
                await db.watchlist.bulkAdd(watchlistItems);
            }

            // Restore EPG Channel Overrides
            if (data.epgChannelOverrides && data.epgChannelOverrides.length > 0) {
                const overrides = data.epgChannelOverrides.map(o => ({
                    stream_id: o.streamId,
                    epg_channel_id: o.epgChannelId,
                    stream_icon: o.streamIcon,
                    timeshift_hours: o.timeshiftHours
                }));
                await db.epgChannelOverrides.bulkAdd(overrides);
            }

            // Restore EPG Program Overrides
            if (data.epgProgramOverrides && data.epgProgramOverrides.length > 0) {
                const overrides = data.epgProgramOverrides.map(o => ({
                    id: o.id,
                    stream_id: o.streamId,
                    title: o.title,
                    description: o.description,
                    start: o.start,
                    end: o.end,
                    is_deleted: o.isDeleted,
                    is_custom: o.isCustom
                }));
                await db.epgProgramOverrides.bulkAdd(overrides);
            }

            // Restore DVR Schedules
            if (data.dvrSchedules && data.dvrSchedules.length > 0) {
                const schedules = data.dvrSchedules.map(s => ({
                    id: s.id,
                    source_id: s.sourceId,
                    channel_id: s.channelId,
                    channel_name: s.channelName,
                    program_title: s.programTitle,
                    scheduled_start: s.scheduledStart,
                    scheduled_end: s.scheduledEnd,
                    start_padding_sec: s.startPaddingSec,
                    end_padding_sec: s.endPaddingSec,
                    status: s.status,
                    series_match_title: s.seriesMatchTitle,
                    recurrence: s.recurrence,
                    created_at: s.createdAt,
                    started_at: s.startedAt,
                    stream_url: s.streamUrl
                }));
                await db.dvrSchedules.bulkAdd(schedules as any);
            }

            // Restore DVR Recordings
            if (data.dvrRecordings && data.dvrRecordings.length > 0) {
                const recordings = data.dvrRecordings.map(r => ({
                    id: r.id,
                    schedule_id: r.scheduleId,
                    file_path: r.filePath,
                    filename: r.filename,
                    size_bytes: r.sizeBytes,
                    channel_name: r.channelName,
                    program_title: r.programTitle,
                    scheduled_start: r.scheduledStart,
                    scheduled_end: r.scheduledEnd,
                    actual_start: r.actualStart,
                    actual_end: r.actualEnd,
                    duration_sec: r.durationSec,
                    status: r.status,
                    error_message: r.errorMessage,
                    keep_until: r.keepUntil,
                    auto_delete_policy: r.autoDeletePolicy,
                    created_at: r.createdAt,
                    thumbnail_path: r.thumbnailPath
                }));
                await db.dvrRecordings.bulkAdd(recordings as any);
            }

            // Restore DVR Settings
            if (data.dvrSettings && data.dvrSettings.length > 0) {
                await db.dvrSettings.bulkAdd(data.dvrSettings);
            }

            // Restore Failover Groups
            if (data.failoverGroups && data.failoverGroups.length > 0) {
                for (const group of data.failoverGroups) {
                    await db.failoverGroups.add({
                        group_id: group.groupId,
                        name: group.name,
                        created_at: group.createdAt
                    });

                    if (group.members && group.members.length > 0) {
                        const members = group.members.map(m => ({
                            id: m.id,
                            group_id: group.groupId,
                            stream_id: m.streamId,
                            priority: m.priority
                        }));
                        await db.failoverGroupMembers.bulkAdd(members);
                    }
                }
            }

            // Restore VOD Watch History
            if (data.vodHistory && data.vodHistory.length > 0) {
                const history = data.vodHistory.map(h => ({
                    id: h.id,
                    media_id: h.mediaId,
                    media_type: h.mediaType,
                    source_id: h.sourceId,
                    title: h.title,
                    watched_at: h.watchedAt,
                    progress_seconds: h.progressSeconds,
                    total_duration: h.totalDuration,
                    poster_url: h.posterUrl,
                    season_num: h.seasonNum,
                    episode_num: h.episodeNum,
                    episode_title: h.episodeTitle
                }));
                await db.vodHistory.bulkAdd(history);
            }

            // Restore Episode Watch History
            if (data.episodeHistory && data.episodeHistory.length > 0) {
                const history = data.episodeHistory.map(h => ({
                    id: h.id,
                    episode_id: h.episodeId,
                    series_id: h.seriesId,
                    source_id: h.sourceId,
                    season_num: h.seasonNum,
                    episode_num: h.episodeNum,
                    title: h.title,
                    watched_at: h.watchedAt,
                    progress_seconds: h.progressSeconds,
                    total_duration: h.totalDuration,
                    completed: h.completed
                }));
                await db.episodeHistory.bulkAdd(history);
            }

            // Restore User Prefs
            if (data.userPrefs && data.userPrefs.length > 0) {
                await db.prefs.bulkAdd(data.userPrefs);
            }
        });

        // 5. Restore Custom Groups (separate transaction to keep original pattern)
        if (data.customGroups && data.customGroups.length > 0) {
            await db.transaction('rw', [db.customGroups, db.customGroupChannels], async () => {
                await db.customGroups.clear();
                await db.customGroupChannels.clear();

                for (const group of data.customGroups!) {
                    await db.customGroups.add({
                        group_id: group.groupId,
                        name: group.name,
                        display_order: group.displayOrder,
                        created_at: Date.now()
                    });

                    if (group.channels && group.channels.length > 0) {
                        const now = Date.now();
                        const groupChannels: CustomGroupChannel[] = group.channels.map((streamId, index) => ({
                            group_id: group.groupId,
                            stream_id: streamId,
                            display_order: index,
                            added_at: now
                        }));
                        await db.customGroupChannels.bulkAdd(groupChannels);
                    }
                }
            });
        }

        return { success: true };

    } catch (err) {
        console.error('Import failed:', err);
        return { success: false, error: err instanceof Error ? err.message : String(err) };
    }
}
