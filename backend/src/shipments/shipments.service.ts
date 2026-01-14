import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/shipment.dto';

@Injectable()
export class ShipmentsService {
  constructor(private prisma: PrismaService) {}

  async create(createShipmentDto: CreateShipmentDto) {
    const shipment = await this.prisma.shipment.create({
      data: {
        trackingNumber: createShipmentDto.trackingNumber,
        originLocation: createShipmentDto.originLocation,
        destinationLocation: createShipmentDto.destinationLocation,
        currentStatus: (createShipmentDto.currentStatus as any) || 'PENDING',
        currentLocation: createShipmentDto.originLocation,
        // Package details
        goodsDescription: createShipmentDto.goodsDescription,
        packageWeight: createShipmentDto.packageWeight,
        packageDimensions: createShipmentDto.packageDimensions,
        declaredValue: createShipmentDto.declaredValue,
        serviceType: createShipmentDto.serviceType,
        // Sender info
        senderName: createShipmentDto.senderName,
        senderPhone: createShipmentDto.senderPhone,
        senderEmail: createShipmentDto.senderEmail,
        // Recipient info
        recipientName: createShipmentDto.recipientName,
        recipientPhone: createShipmentDto.recipientPhone,
        recipientEmail: createShipmentDto.recipientEmail,
        // Special instructions
        specialInstructions: createShipmentDto.specialInstructions,
        movementState: {
          create: {
            isMoving: true,
          },
        },
      },
      include: {
        movementState: true,
        trackingEvents: {
          orderBy: {
            eventTime: 'desc',
          },
        },
      },
    });

    return shipment;
  }

  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        skip,
        take: limit,
        include: {
          movementState: true,
          _count: {
            select: {
              trackingEvents: true,
              locations: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.shipment.count(),
    ]);

    return {
      data: shipments,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        movementState: true,
        trackingEvents: {
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
        },
        locations: {
          orderBy: {
            recordedAt: 'desc',
          },
          take: 100,
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    return shipment;
  }

  async findByTrackingNumber(trackingNumber: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { trackingNumber },
      include: {
        movementState: true,
        trackingEvents: {
          orderBy: {
            eventTime: 'desc',
          },
        },
        locations: {
          orderBy: {
            recordedAt: 'desc',
          },
          take: 1,
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException(
        `Shipment with tracking number ${trackingNumber} not found`,
      );
    }

    return shipment;
  }

  async update(id: string, updateShipmentDto: UpdateShipmentDto) {
    const shipment = await this.prisma.shipment.update({
      where: { id },
      data: {
        originLocation: updateShipmentDto.originLocation,
        destinationLocation: updateShipmentDto.destinationLocation,
        currentStatus: updateShipmentDto.currentStatus as any,
        currentLocation: updateShipmentDto.currentLocation,
        // Package details
        goodsDescription: updateShipmentDto.goodsDescription,
        packageWeight: updateShipmentDto.packageWeight,
        packageDimensions: updateShipmentDto.packageDimensions,
        declaredValue: updateShipmentDto.declaredValue,
        serviceType: updateShipmentDto.serviceType,
        // Sender info
        senderName: updateShipmentDto.senderName,
        senderPhone: updateShipmentDto.senderPhone,
        senderEmail: updateShipmentDto.senderEmail,
        // Recipient info
        recipientName: updateShipmentDto.recipientName,
        recipientPhone: updateShipmentDto.recipientPhone,
        recipientEmail: updateShipmentDto.recipientEmail,
        // Special instructions
        specialInstructions: updateShipmentDto.specialInstructions,
      },
      include: {
        movementState: true,
        trackingEvents: {
          orderBy: {
            eventTime: 'desc',
          },
        },
      },
    });

    return shipment;
  }

  async remove(id: string) {
    await this.prisma.shipment.delete({
      where: { id },
    });

    return { message: 'Shipment deleted successfully' };
  }

  async getStatistics() {
    const [total, pending, inTransit, delivered, failed] = await Promise.all([
      this.prisma.shipment.count(),
      this.prisma.shipment.count({ where: { currentStatus: 'PENDING' } }),
      this.prisma.shipment.count({ where: { currentStatus: 'IN_TRANSIT' } }),
      this.prisma.shipment.count({ where: { currentStatus: 'DELIVERED' } }),
      this.prisma.shipment.count({ where: { currentStatus: 'FAILED' } }),
    ]);

    return {
      total,
      pending,
      inTransit,
      delivered,
      failed,
    };
  }

  async bulkUpdateStatus(shipmentIds: string[], status: string) {
    try {
      const result = await this.prisma.shipment.updateMany({
        where: {
          id: {
            in: shipmentIds,
          },
        },
        data: {
          currentStatus: status as any,
        },
      });

      return {
        success: true,
        updated: result.count,
        message: `Successfully updated ${result.count} shipments`,
      };
    } catch (error) {
      return {
        success: false,
        updated: 0,
        message: error.message,
      };
    }
  }

  async bulkDelete(shipmentIds: string[]) {
    try {
      const result = await this.prisma.shipment.deleteMany({
        where: {
          id: {
            in: shipmentIds,
          },
        },
      });

      return {
        success: true,
        deleted: result.count,
        message: `Successfully deleted ${result.count} shipments`,
      };
    } catch (error) {
      return {
        success: false,
        deleted: 0,
        message: error.message,
      };
    }
  }

  async exportShipments(filters?: any) {
    const shipments = await this.prisma.shipment.findMany({
      where: filters,
      include: {
        trackingEvents: {
          orderBy: {
            eventTime: 'desc',
          },
        },
        movementState: true,
      },
    });

    return shipments;
  }
}
