import { IChannelService, Source, Category, Channel } from '@ynotv/core';
import { db } from '../index';
import { dbEvents } from '../sqlite-adapter';
import { syncSource } from '../sync';
import { XtreamClient, StalkerClient } from '@ynotv/local-adapter';

export class ChannelRepository implements IChannelService {
  private _isRefreshing = false;

  async getSources(): Promise<Source[]> {
    if (window.storage) {
      const result = await window.storage.getSources();
      return result.data || [];
    }
    return [];
  }

  async addSource(source: Omit<Source, 'id'>): Promise<Source> {
    const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    const newSource = { ...source, id } as Source;
    if (window.storage) {
      await window.storage.saveSource(newSource);
    }
    return newSource;
  }

  async updateSource(id: string, updates: Partial<Source>): Promise<Source> {
    const sources = await this.getSources();
    const source = sources.find((s) => s.id === id);
    if (!source) throw new Error(`Source with ID ${id} not found`);
    const updated = { ...source, ...updates } as Source;
    if (window.storage) {
      await window.storage.saveSource(updated);
    }
    return updated;
  }

  async removeSource(id: string): Promise<void> {
    if (window.storage) {
      await window.storage.deleteSource(id);
    }
  }

  async testSource(
    source: Omit<Source, 'id'>
  ): Promise<{ success: boolean; error?: string; channelCount?: number }> {
    try {
      if (source.type === 'xtream') {
        const client = new XtreamClient({
          baseUrl: source.url,
          username: source.username || '',
          password: source.password || '',
          userAgent: source.user_agent,
        }, 'test-source');
        const res = await client.testConnection();
        return { success: res.success, error: res.error };
      } else if (source.type === 'stalker') {
        const client = new StalkerClient({
          baseUrl: source.url,
          mac: source.mac || '',
          userAgent: source.user_agent,
        }, 'test-source');
        const res = await client.testConnection();
        return { success: res.success, error: res.error };
      } else if (source.type === 'm3u') {
        const response = await fetch(source.url, {
          headers: source.user_agent ? { 'User-Agent': source.user_agent } : {},
        });
        if (!response.ok) {
          return { success: false, error: `HTTP error: ${response.status}` };
        }
        return { success: true };
      }
      return { success: false, error: 'Unsupported source type' };
    } catch (err: any) {
      return { success: false, error: err.message || String(err) };
    }
  }

  async getCategories(sourceIds?: string[]): Promise<Category[]> {
    if (sourceIds && sourceIds.length > 0) {
      const placeholders = sourceIds.map((_, i) => `$${i + 1}`).join(',');
      const storedCategories = await db.categories
        .whereRaw(`source_id IN (${placeholders})`, sourceIds)
        .toArray();
      return storedCategories as Category[];
    }
    const storedCategories = await db.categories.toArray();
    return storedCategories as Category[];
  }

  async getChannels(options?: {
    categoryIds?: string[];
    sourceIds?: string[];
    streamIds?: string[];
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Channel[]> {
    let query: any;
    const constraints: string[] = [];
    const params: any[] = [];

    if (options?.sourceIds && options.sourceIds.length > 0) {
      const placeholders = options.sourceIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      constraints.push(`source_id IN (${placeholders})`);
      params.push(...options.sourceIds);
    }

    if (options?.streamIds && options.streamIds.length > 0) {
      const placeholders = options.streamIds.map((_, i) => `$${params.length + i + 1}`).join(',');
      constraints.push(`stream_id IN (${placeholders})`);
      params.push(...options.streamIds);
    }

    if (options?.categoryIds && options.categoryIds.length > 0) {
      const catConstraints = options.categoryIds.map((catId) => {
        params.push(`%"${catId}"%`);
        return `category_ids LIKE $${params.length}`;
      });
      constraints.push(`(${catConstraints.join(' OR ')})`);
    }

    if (options?.search) {
      params.push(`%${options.search}%`);
      constraints.push(`name LIKE $${params.length}`);
    }

    if (constraints.length > 0) {
      query = db.channels.whereRaw(constraints.join(' AND '), params);
    } else {
      query = db.channels.toCollection();
    }

    if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    if (options?.offset !== undefined) {
      query = query.offset(options.offset);
    }

    const storedChannels = await query.toArray();
    return storedChannels as Channel[];
  }

  async getChannelById(id: string): Promise<Channel | null> {
    const channel = await db.channels.get(id);
    return (channel as Channel) || null;
  }

  async getChannelCount(categoryIds?: string[]): Promise<number> {
    if (categoryIds && categoryIds.length > 0) {
      const constraints = categoryIds.map((_, i) => `category_ids LIKE $${i + 1}`);
      const params = categoryIds.map((catId) => `%"${catId}"%`);
      return await db.channels.countWhere(constraints.join(' OR '), params);
    }
    return await db.channels.count();
  }

  async refreshData(sourceIds?: string[]): Promise<void> {
    this._isRefreshing = true;
    try {
      const sources = await this.getSources();
      const ids = sourceIds || sources.map((s) => s.id);
      for (const id of ids) {
        const source = sources.find((s) => s.id === id);
        if (source) {
          await syncSource(source as any);
        }
      }
    } finally {
      this._isRefreshing = false;
    }
  }

  isRefreshing(): boolean {
    return this._isRefreshing;
  }

  onDataChanged(callback: () => void): () => void {
    const unsub1 = dbEvents.subscribe('channels', callback);
    const unsub2 = dbEvents.subscribe('categories', callback);
    return () => {
      unsub1();
      unsub2();
    };
  }
}
