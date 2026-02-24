import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Pusher from 'pusher';

@Injectable()
export class PusherService implements OnModuleInit {
  private pusher: Pusher;
  private readonly logger = new Logger(PusherService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const appId = this.configService.get<string>('PUSHER_APP_ID');
    const key = this.configService.get<string>('PUSHER_KEY');
    const secret = this.configService.get<string>('PUSHER_SECRET');
    const cluster = this.configService.get<string>('PUSHER_CLUSTER') || 'us2';

    if (!appId || !key || !secret) {
      this.logger.warn('Pusher credentials not configured — real-time events will be disabled');
      return;
    }

    this.pusher = new Pusher({ appId, key, secret, cluster, useTLS: true });
    this.logger.log(`Pusher initialized (cluster: ${cluster})`);
  }

  async trigger(channel: string, event: string, data: object): Promise<void> {
    if (!this.pusher) {
      this.logger.debug(`Pusher not configured — skipped event ${event} on ${channel}`);
      return;
    }
    try {
      await this.pusher.trigger(channel, event, data);
    } catch (error) {
      this.logger.error(`Failed to trigger Pusher event ${event} on ${channel}: ${error.message}`);
    }
  }
}
