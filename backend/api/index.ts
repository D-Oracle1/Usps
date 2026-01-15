import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { Request, Response } from 'express';

let cachedApp: any = null;

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

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
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  });

  await app.init();
  return app;
}

export default async function handler(req: Request, res: Response) {
  // Handle CORS preflight requests immediately
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(200).end();
    return;
  }

  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  try {
    if (!cachedApp) {
      console.log('Bootstrapping NestJS application...');
      cachedApp = await bootstrap();
      console.log('NestJS application ready');
    }

    const httpAdapter = cachedApp.getHttpAdapter();
    const instance = httpAdapter.getInstance();
    instance(req, res);
  } catch (error: any) {
    console.error('Server initialization error:', error);
    res.status(500).json({
      error: 'Server initialization failed',
      message: error.message,
    });
  }
}
