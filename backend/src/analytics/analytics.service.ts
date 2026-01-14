import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getDashboardStats() {
    const [
      total,
      pending,
      inTransit,
      delivered,
      failed,
      todayShipments,
      weekShipments,
      avgDeliveryTime,
    ] = await Promise.all([
      this.prisma.shipment.count(),
      this.prisma.shipment.count({ where: { currentStatus: 'PENDING' } }),
      this.prisma.shipment.count({ where: { currentStatus: 'IN_TRANSIT' } }),
      this.prisma.shipment.count({ where: { currentStatus: 'DELIVERED' } }),
      this.prisma.shipment.count({ where: { currentStatus: 'FAILED' } }),
      this.getTodayShipmentsCount(),
      this.getWeekShipmentsCount(),
      this.getAverageDeliveryTime(),
    ]);

    return {
      total,
      pending,
      inTransit,
      delivered,
      failed,
      todayShipments,
      weekShipments,
      avgDeliveryTime,
      deliveryRate: total > 0 ? ((delivered / total) * 100).toFixed(2) : '0',
    };
  }

  async getShipmentsByStatus() {
    const shipments = await this.prisma.shipment.groupBy({
      by: ['currentStatus'],
      _count: true,
    });

    return shipments.map((item) => ({
      status: item.currentStatus,
      count: item._count,
    }));
  }

  async getShipmentsTrend(days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const shipments = await this.prisma.shipment.findMany({
      where: {
        createdAt: {
          gte: startDate,
        },
      },
      select: {
        createdAt: true,
        currentStatus: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group by date
    const trendsMap = new Map<string, { date: string; count: number }>();

    shipments.forEach((shipment) => {
      const dateKey = shipment.createdAt.toISOString().split('T')[0];
      if (!trendsMap.has(dateKey)) {
        trendsMap.set(dateKey, { date: dateKey, count: 0 });
      }
      trendsMap.get(dateKey)!.count++;
    });

    return Array.from(trendsMap.values());
  }

  async getTopRoutes(limit: number = 10) {
    const routes = await this.prisma.shipment.groupBy({
      by: ['originLocation', 'destinationLocation'],
      _count: true,
      orderBy: {
        _count: {
          originLocation: 'desc',
        },
      },
      take: limit,
    });

    return routes.map((route) => ({
      origin: route.originLocation,
      destination: route.destinationLocation,
      count: route._count,
    }));
  }

  async getRecentActivity(limit: number = 20) {
    const events = await this.prisma.trackingEvent.findMany({
      take: limit,
      orderBy: {
        eventTime: 'desc',
      },
      include: {
        shipment: {
          select: {
            trackingNumber: true,
            originLocation: true,
            destinationLocation: true,
          },
        },
        admin: {
          select: {
            name: true,
            email: true,
          },
        },
      },
    });

    return events;
  }

  async getPerformanceMetrics() {
    const [totalEvents, totalLocations, avgEventsPerShipment] =
      await Promise.all([
        this.prisma.trackingEvent.count(),
        this.prisma.shipmentLocation.count(),
        this.getAverageEventsPerShipment(),
      ]);

    return {
      totalEvents,
      totalLocations,
      avgEventsPerShipment,
    };
  }

  private async getTodayShipmentsCount() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    return this.prisma.shipment.count({
      where: {
        createdAt: {
          gte: startOfDay,
        },
      },
    });
  }

  private async getWeekShipmentsCount() {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    return this.prisma.shipment.count({
      where: {
        createdAt: {
          gte: startOfWeek,
        },
      },
    });
  }

  private async getAverageDeliveryTime() {
    const deliveredShipments = await this.prisma.shipment.findMany({
      where: {
        currentStatus: 'DELIVERED',
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    });

    if (deliveredShipments.length === 0) return 0;

    const totalTime = deliveredShipments.reduce((acc, shipment) => {
      const diff =
        shipment.updatedAt.getTime() - shipment.createdAt.getTime();
      return acc + diff;
    }, 0);

    const avgMs = totalTime / deliveredShipments.length;
    const avgHours = avgMs / (1000 * 60 * 60);

    return Math.round(avgHours * 10) / 10; // Round to 1 decimal
  }

  private async getAverageEventsPerShipment() {
    const totalShipments = await this.prisma.shipment.count();
    const totalEvents = await this.prisma.trackingEvent.count();

    if (totalShipments === 0) return 0;

    return Math.round((totalEvents / totalShipments) * 10) / 10;
  }
}
