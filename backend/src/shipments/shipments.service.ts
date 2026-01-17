import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/shipment.dto';

@Injectable()
export class ShipmentsService {
  private readonly logger = new Logger(ShipmentsService.name);

  constructor(private prisma: PrismaService) {}

  async create(createShipmentDto: CreateShipmentDto) {
    this.logger.log(`Creating shipment with tracking: ${createShipmentDto.trackingNumber}`);

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

    this.logger.log(`Shipment created: ${shipment.id}`);
    return shipment;
  }

  async findAll(page: number = 1, limit: number = 20) {
    // Ensure page and limit are valid numbers to prevent NaN/negative values
    const safePage = Math.max(1, Math.floor(page) || 1);
    const safeLimit = Math.min(100, Math.max(1, Math.floor(limit) || 20));
    const skip = (safePage - 1) * safeLimit;

    this.logger.log(`Finding all shipments: page=${safePage}, limit=${safeLimit}, skip=${skip}`);

    const [shipments, total] = await Promise.all([
      this.prisma.shipment.findMany({
        skip,
        take: safeLimit,
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

    // Guard against division by zero
    const totalPages = safeLimit > 0 ? Math.ceil(total / safeLimit) : 0;

    this.logger.log(`Found ${shipments.length} shipments (total: ${total})`);

    return {
      data: shipments || [],
      meta: {
        total,
        page: safePage,
        limit: safeLimit,
        totalPages,
      },
    };
  }

  async findOne(id: string) {
    this.logger.log(`Finding shipment: ${id}`);

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
      this.logger.warn(`Shipment not found: ${id}`);
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    return shipment;
  }

  async findByUserEmail(email: string) {
    this.logger.log(`Finding shipments for user email: ${email}`);

    const shipments = await this.prisma.shipment.findMany({
      where: {
        OR: [
          { senderEmail: email },
          { recipientEmail: email },
        ],
      },
      include: {
        movementState: true,
        trackingEvents: {
          orderBy: {
            eventTime: 'desc',
          },
          take: 1,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    this.logger.log(`Found ${shipments.length} shipments for user ${email}`);
    return shipments;
  }

  async findByTrackingNumber(trackingNumber: string) {
    this.logger.log(`Finding shipment by tracking number: ${trackingNumber}`);

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
      this.logger.warn(`Shipment not found for tracking: ${trackingNumber}`);
      throw new NotFoundException(
        `Shipment with tracking number ${trackingNumber} not found`,
      );
    }

    return shipment;
  }

  async update(id: string, updateShipmentDto: UpdateShipmentDto) {
    this.logger.log(`Updating shipment: ${id}`);

    // First check if shipment exists
    const existing = await this.prisma.shipment.findUnique({
      where: { id },
    });

    if (!existing) {
      this.logger.warn(`Shipment not found for update: ${id}`);
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

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

    this.logger.log(`Shipment updated: ${id}`);
    return shipment;
  }

  async remove(id: string) {
    this.logger.log(`Removing shipment: ${id}`);

    // First check if shipment exists
    const existing = await this.prisma.shipment.findUnique({
      where: { id },
    });

    if (!existing) {
      this.logger.warn(`Shipment not found for deletion: ${id}`);
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    await this.prisma.shipment.delete({
      where: { id },
    });

    this.logger.log(`Shipment deleted: ${id}`);
    return { message: 'Shipment deleted successfully' };
  }

  async getStatistics() {
    this.logger.log('Fetching shipment statistics');

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
    this.logger.log(`Bulk updating ${shipmentIds.length} shipments to status: ${status}`);

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

      this.logger.log(`Bulk update completed: ${result.count} shipments updated`);

      return {
        success: true,
        updated: result.count,
        message: `Successfully updated ${result.count} shipments`,
      };
    } catch (error) {
      this.logger.error(`Bulk update failed: ${error.message}`, error.stack);
      return {
        success: false,
        updated: 0,
        message: error.message,
      };
    }
  }

  async bulkDelete(shipmentIds: string[]) {
    this.logger.log(`Bulk deleting ${shipmentIds.length} shipments`);

    try {
      const result = await this.prisma.shipment.deleteMany({
        where: {
          id: {
            in: shipmentIds,
          },
        },
      });

      this.logger.log(`Bulk delete completed: ${result.count} shipments deleted`);

      return {
        success: true,
        deleted: result.count,
        message: `Successfully deleted ${result.count} shipments`,
      };
    } catch (error) {
      this.logger.error(`Bulk delete failed: ${error.message}`, error.stack);
      return {
        success: false,
        deleted: 0,
        message: error.message,
      };
    }
  }

  async exportShipments(filters?: any) {
    this.logger.log('Exporting shipments');

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

    this.logger.log(`Exported ${shipments.length} shipments`);
    return shipments || [];
  }

  async interceptShipment(id: string, reason: string, adminId: string) {
    this.logger.log(`Intercepting shipment: ${id}, reason: ${reason}`);

    const existing = await this.prisma.shipment.findUnique({
      where: { id },
      include: { movementState: true },
    });

    if (!existing) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    // Update shipment status and movement state in a transaction
    const shipment = await this.prisma.$transaction(async (tx) => {
      // Update the shipment status
      const updated = await tx.shipment.update({
        where: { id },
        data: {
          currentStatus: 'INTERCEPTED',
        },
        include: {
          movementState: true,
          trackingEvents: {
            orderBy: { eventTime: 'desc' },
          },
        },
      });

      // Update or create movement state
      await tx.shipmentMovementState.upsert({
        where: { shipmentId: id },
        create: {
          shipmentId: id,
          isMoving: false,
          pausedBy: adminId,
          pausedAt: new Date(),
          interceptReason: reason,
        },
        update: {
          isMoving: false,
          pausedBy: adminId,
          pausedAt: new Date(),
          interceptReason: reason,
          clearReason: null,
        },
      });

      // Create tracking event
      await tx.trackingEvent.create({
        data: {
          shipmentId: id,
          status: 'INTERCEPTED',
          description: `Shipment intercepted: ${reason}`,
          location: updated.currentLocation || 'Unknown',
          eventTime: new Date(),
          createdBy: adminId,
        },
      });

      return updated;
    });

    this.logger.log(`Shipment intercepted: ${id}`);
    return shipment;
  }

  async clearShipment(id: string, reason: string, adminId: string) {
    this.logger.log(`Clearing shipment: ${id}, reason: ${reason}`);

    const existing = await this.prisma.shipment.findUnique({
      where: { id },
      include: { movementState: true },
    });

    if (!existing) {
      throw new NotFoundException(`Shipment with ID ${id} not found`);
    }

    // Update shipment status and movement state in a transaction
    const shipment = await this.prisma.$transaction(async (tx) => {
      // Update the shipment status back to IN_TRANSIT
      const updated = await tx.shipment.update({
        where: { id },
        data: {
          currentStatus: 'IN_TRANSIT',
        },
        include: {
          movementState: true,
          trackingEvents: {
            orderBy: { eventTime: 'desc' },
          },
        },
      });

      // Update movement state
      await tx.shipmentMovementState.upsert({
        where: { shipmentId: id },
        create: {
          shipmentId: id,
          isMoving: true,
          resumedAt: new Date(),
          clearReason: reason,
        },
        update: {
          isMoving: true,
          resumedAt: new Date(),
          clearReason: reason,
          pausedBy: null,
          pausedAt: null,
        },
      });

      // Create tracking event
      await tx.trackingEvent.create({
        data: {
          shipmentId: id,
          status: 'IN_TRANSIT',
          description: `Shipment cleared and resumed: ${reason}`,
          location: updated.currentLocation || 'Unknown',
          eventTime: new Date(),
          createdBy: adminId,
        },
      });

      return updated;
    });

    this.logger.log(`Shipment cleared: ${id}`);
    return shipment;
  }
}
