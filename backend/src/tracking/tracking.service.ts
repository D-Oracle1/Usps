import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTrackingEventDto } from './dto/tracking.dto';

@Injectable()
export class TrackingService {
  constructor(private prisma: PrismaService) {}

  async createEvent(
    createTrackingEventDto: CreateTrackingEventDto,
    adminId?: string,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: createTrackingEventDto.shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const event = await this.prisma.trackingEvent.create({
      data: {
        shipmentId: createTrackingEventDto.shipmentId,
        status: createTrackingEventDto.status,
        description: createTrackingEventDto.description,
        location: createTrackingEventDto.location,
        eventTime: createTrackingEventDto.eventTime || new Date(),
        createdBy: adminId,
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.prisma.shipment.update({
      where: { id: createTrackingEventDto.shipmentId },
      data: {
        currentStatus: createTrackingEventDto.status as any,
        currentLocation: createTrackingEventDto.location,
      },
    });

    return event;
  }

  async getTimeline(shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const events = await this.prisma.trackingEvent.findMany({
      where: { shipmentId },
      orderBy: {
        eventTime: 'desc',
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      shipment,
      events,
    };
  }

  async getTimelineByTrackingNumber(trackingNumber: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { trackingNumber },
      include: {
        movementState: {
          include: {
            pausedByAdmin: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
        locations: {
          orderBy: { recordedAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const events = await this.prisma.trackingEvent.findMany({
      where: { shipmentId: shipment.id },
      orderBy: {
        eventTime: 'desc',
      },
      include: {
        admin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return {
      shipment,
      events,
    };
  }
}
