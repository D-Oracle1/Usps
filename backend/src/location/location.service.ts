import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RecordLocationDto } from './dto/location.dto';

@Injectable()
export class LocationService {
  constructor(private prisma: PrismaService) {}

  async recordLocation(recordLocationDto: RecordLocationDto) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: recordLocationDto.shipmentId },
      include: {
        movementState: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    // Allow manual updates when forceUpdate is true (for manual address input)
    if (!shipment.movementState?.isMoving && !recordLocationDto.forceUpdate) {
      return {
        message: 'Shipment is paused, location not recorded',
        paused: true,
      };
    }

    const location = await this.prisma.shipmentLocation.create({
      data: {
        shipmentId: recordLocationDto.shipmentId,
        latitude: recordLocationDto.latitude,
        longitude: recordLocationDto.longitude,
        speed: recordLocationDto.speed || 0,
        heading: recordLocationDto.heading || 0,
        recordedAt: new Date(),
      },
    });

    // Build the current location string
    const locationString = recordLocationDto.addressLabel
      ? `${recordLocationDto.addressLabel} (${recordLocationDto.latitude.toFixed(5)},${recordLocationDto.longitude.toFixed(5)})`
      : `${recordLocationDto.latitude},${recordLocationDto.longitude}`;

    await this.prisma.shipment.update({
      where: { id: recordLocationDto.shipmentId },
      data: {
        currentLocation: locationString,
      },
    });

    return {
      ...location,
      isManualUpdate: recordLocationDto.forceUpdate || false,
    };
  }

  async getLocations(shipmentId: string, limit: number = 100) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const locations = await this.prisma.shipmentLocation.findMany({
      where: { shipmentId },
      orderBy: {
        recordedAt: 'desc',
      },
      take: limit,
    });

    return locations;
  }

  async getLatestLocation(shipmentId: string) {
    const location = await this.prisma.shipmentLocation.findFirst({
      where: { shipmentId },
      orderBy: {
        recordedAt: 'desc',
      },
    });

    if (!location) {
      throw new NotFoundException('No location data found for this shipment');
    }

    return location;
  }
}
