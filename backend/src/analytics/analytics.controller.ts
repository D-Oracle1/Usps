import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  getDashboardStats() {
    return this.analyticsService.getDashboardStats();
  }

  @Get('status')
  getShipmentsByStatus() {
    return this.analyticsService.getShipmentsByStatus();
  }

  @Get('trends')
  getShipmentsTrend(@Query('days') days?: string) {
    const daysNumber = days ? parseInt(days) : 30;
    return this.analyticsService.getShipmentsTrend(daysNumber);
  }

  @Get('routes')
  getTopRoutes(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit) : 10;
    return this.analyticsService.getTopRoutes(limitNumber);
  }

  @Get('activity')
  getRecentActivity(@Query('limit') limit?: string) {
    const limitNumber = limit ? parseInt(limit) : 20;
    return this.analyticsService.getRecentActivity(limitNumber);
  }

  @Get('performance')
  getPerformanceMetrics() {
    return this.analyticsService.getPerformanceMetrics();
  }
}
