import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug'],
  });

  // Security middleware
  app.use(helmet());

  const configService = app.get(ConfigService);

  // Global exception filter - catches all unhandled errors
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  const port = configService.get('PORT') || 3000;

  try {
    await app.listen(port, '0.0.0.0');

    logger.log(`
    ┌─────────────────────────────────────────┐
    │  Courier Tracking System - Backend API  │
    │  Server running on port: ${port}             │
    │  WebSocket: ws://0.0.0.0:${port}/tracking   │
    │  Environment: ${process.env.NODE_ENV || 'development'}
    └─────────────────────────────────────────┘
    `);
  } catch (error) {
    logger.error(`Failed to start server: ${error.message}`, error.stack);
    process.exit(1);
  }
}

bootstrap().catch((error) => {
  console.error('Bootstrap failed:', error);
  process.exit(1);
});
