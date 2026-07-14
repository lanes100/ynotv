import { IEPGService, Program, GuideRow, Channel } from '@ynotv/core';
import { db, StoredProgram, StoredChannel } from '../index';
import { dbEvents } from '../sqlite-adapter';
import { syncAllStaleGlobalEpgLinks } from '../sync';

function mapStoredProgramToProgram(p: StoredProgram): Program {
  return {
    id: p.id,
    channel_id: p.stream_id,
    title: p.title,
    subtitle: p.subtitle,
    start: p.start instanceof Date ? p.start : new Date(p.start),
    stop: p.end instanceof Date ? p.end : new Date(p.end),
    desc: p.description,
    source_id: p.source_id,
  };
}

export class EpgRepository implements IEPGService {
  private _isRefreshingEPG = false;
  private _lastEPGUpdate: Date | null = null;

  constructor() {
    this.loadLastEPGUpdate();
    dbEvents.subscribe('programs', () => this.loadLastEPGUpdate());
  }

  private async loadLastEPGUpdate() {
    try {
      const metas = await db.sourcesMeta.toArray();
      let latest: Date | null = null;
      for (const m of metas) {
        if (m.last_synced) {
          const d = new Date(m.last_synced);
          if (!latest || d > latest) {
            latest = d;
          }
        }
      }
      this._lastEPGUpdate = latest;
    } catch {
      // Ignore
    }
  }

  async getPrograms(
    channelIds: string[],
    start: Date,
    end: Date
  ): Promise<Map<string, Program[]>> {
    const map = new Map<string, Program[]>();
    if (channelIds.length === 0) return map;

    const isoStart = start.toISOString();
    const isoEnd = end.toISOString();

    const MAX_CHUNK_SIZE = 500;
    const allResults: StoredProgram[] = [];
    for (let i = 0; i < channelIds.length; i += MAX_CHUNK_SIZE) {
      const chunk = channelIds.slice(i, i + MAX_CHUNK_SIZE);
      const placeholders = chunk.map((_, idx) => `$${idx + 1}`).join(',');
      const results = await db.programs
        .whereRaw(
          `stream_id IN (${placeholders}) AND start <= $${chunk.length + 1} AND end >= $${chunk.length + 2}`,
          [...chunk, isoEnd, isoStart]
        )
        .toArray();
      allResults.push(...(results as StoredProgram[]));
    }

    for (const prog of allResults) {
      const streamId = prog.stream_id;
      if (!map.has(streamId)) {
        map.set(streamId, []);
      }
      map.get(streamId)!.push(mapStoredProgramToProgram(prog));
    }

    for (const progs of map.values()) {
      progs.sort((a, b) => {
        const aStart = a.start instanceof Date ? a.start.getTime() : new Date(a.start).getTime();
        const bStart = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
        return aStart - bStart;
      });
    }

    return map;
  }

  async getProgramsForChannel(
    channelId: string,
    start: Date,
    end: Date
  ): Promise<Program[]> {
    const isoStart = start.toISOString();
    const isoEnd = end.toISOString();
    const results = await db.programs
      .whereRaw('stream_id = $1 AND start <= $2 AND end >= $3', [channelId, isoEnd, isoStart])
      .toArray();

    const mapped = (results as StoredProgram[]).map(mapStoredProgramToProgram);

    mapped.sort((a, b) => {
      const aStart = a.start instanceof Date ? a.start.getTime() : new Date(a.start).getTime();
      const bStart = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
      return aStart - bStart;
    });

    return mapped;
  }

  async getCurrentProgram(channelId: string): Promise<Program | null> {
    const now = new Date();
    const isoNow = now.toISOString();
    const results = await db.programs
      .whereRaw('stream_id = $1 AND start <= $2 AND end >= $3', [channelId, isoNow, isoNow])
      .toArray();
    return results[0] ? mapStoredProgramToProgram(results[0] as StoredProgram) : null;
  }

  async getNextProgram(channelId: string): Promise<Program | null> {
    const now = new Date();
    const isoNow = now.toISOString();
    const results = await db.programs
      .whereRaw('stream_id = $1 AND start > $2 ORDER BY start ASC LIMIT 1', [channelId, isoNow])
      .toArray();
    return results[0] ? mapStoredProgramToProgram(results[0] as StoredProgram) : null;
  }

  async getGuideRows(options: {
    startIndex: number;
    count: number;
    categoryIds?: string[];
    timeOffsetHours?: number;
    hoursToShow?: number;
  }): Promise<{ rows: GuideRow[]; total: number }> {
    const timeOffset = options.timeOffsetHours || 0;
    const hours = options.hoursToShow || 3;

    const start = new Date(Date.now() + timeOffset * 60 * 60 * 1000);
    const end = new Date(start.getTime() + hours * 60 * 60 * 1000);

    let query: any;
    if (options.categoryIds && options.categoryIds.length > 0) {
      const constraints = options.categoryIds.map((_, i) => `category_ids LIKE $${i + 1}`);
      const params = options.categoryIds.map((catId) => `%"${catId}"%`);
      query = db.channels.whereRaw(constraints.join(' OR '), params);
    } else {
      query = db.channels.toCollection();
    }

    const total = await query.count();

    const channels = await query
      .offset(options.startIndex)
      .limit(options.count)
      .toArray() as StoredChannel[];

    const programsMap = await this.getPrograms(
      channels.map((c: StoredChannel) => c.stream_id),
      start,
      end
    );

    const rows: GuideRow[] = channels.map((channel: StoredChannel, idx: number) => ({
      channel: channel as Channel,
      programs: programsMap.get(channel.stream_id) || [],
      index: options.startIndex + idx,
    }));

    return { rows, total };
  }

  async refreshEPG(sourceIds?: string[]): Promise<void> {
    this._isRefreshingEPG = true;
    try {
      await syncAllStaleGlobalEpgLinks(undefined, sourceIds);
      await this.loadLastEPGUpdate();
    } finally {
      this._isRefreshingEPG = false;
    }
  }

  isRefreshingEPG(): boolean {
    return this._isRefreshingEPG;
  }

  getLastEPGUpdate(): Date | null {
    return this._lastEPGUpdate;
  }

  onEPGChanged(callback: () => void): () => void {
    return dbEvents.subscribe('programs', callback);
  }
}
