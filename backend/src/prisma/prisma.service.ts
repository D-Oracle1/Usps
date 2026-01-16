import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    });
  }

  async onModuleInit() {
    // Connect with timeout to prevent blocking server startup
    const connectWithTimeout = async (timeoutMs: number) => {
      return Promise.race([
        this.$connect(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Connection timeout')), timeoutMs)
        ),
      ]);
    };

    try {
      this.logger.log('Connecting to database...');
      await connectWithTimeout(5000); // 5 second timeout
      this.logger.log('Database connected successfully');
    } catch (error) {
      this.logger.error(`Failed to connect to database: ${error.message}`);
      this.logger.warn('Server will start but database operations will fail until connection is restored');
      // Don't throw - allow server to start for healthcheck
    }
  }

  async onModuleDestroy() {
    this.logger.log('Disconnecting from database...');
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
