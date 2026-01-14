import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { ExpressAdapter } from '@nestjs/platform-express';
import express from 'express';

const server = express();

export const createNestServer = async (expressInstance: express.Express) => {
  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(expressInstance),
  );

  const configService = app.get(ConfigService);

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS configuration - allow all origins for Vercel
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  await app.init();
  return app;
};

// For Vercel serverless
let cachedApp: any;

export default async function handler(req: any, res: any) {
  if (!cachedApp) {
    cachedApp = await createNestServer(server);
  }
  server(req, res);
}

// For local development
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = configService.get('PORT') || 3000;
  await app.listen(port);

  console.log(`
    ┌─────────────────────────────────────────┐
    │  Courier Tracking System - Backend API  │
    │  Server running on: http://localhost:${port}  │
    │  WebSocket: ws://localhost:${port}/tracking │
    └─────────────────────────────────────────┘
  `);
}

// Only run bootstrap in non-serverless environment
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
  bootstrap();
}
