import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getRoot() {
    return {
      name: 'USPS Courier Tracking API',
      version: '1.0.0',
      status: 'running',
      endpoints: {
        auth: '/auth',
        shipments: '/shipments',
        tracking: '/tracking',
        locations: '/locations',
        movement: '/movement',
        analytics: '/analytics',
      },
      documentation: 'Contact admin for API documentation',
    };
  }

  @Get('health')
  getHealth() {
    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
    };
  }
}
