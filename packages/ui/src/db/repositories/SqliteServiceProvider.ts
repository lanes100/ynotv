import { IServiceProvider, IChannelService, IEPGService, ISettingsService, IPlayerService } from '@ynotv/core';
import { ChannelRepository } from './ChannelRepository';
import { EpgRepository } from './EpgRepository';
import { SettingsRepository } from './SettingsRepository';
import { PlayerService } from './PlayerService';

export class SqliteServiceProvider implements IServiceProvider {
  channels: IChannelService;
  epg: IEPGService;
  settings: ISettingsService;
  player: IPlayerService;

  constructor() {
    this.channels = new ChannelRepository();
    this.epg = new EpgRepository();
    this.settings = new SettingsRepository();
    this.player = new PlayerService();
  }

  async initialize(): Promise<void> {
    // Service-level initialization if needed
  }

  async dispose(): Promise<void> {
    if (typeof (this.player as any).dispose === 'function') {
      (this.player as any).dispose();
    }
  }
}
