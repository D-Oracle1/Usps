import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../websocket/tracking.gateway';

// City coordinates for routing simulation
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  'new york': { lat: 40.7128, lng: -74.0060 },
  'ny': { lat: 40.7128, lng: -74.0060 },
  'nyc': { lat: 40.7128, lng: -74.0060 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'la': { lat: 34.0522, lng: -118.2437 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'houston': { lat: 29.7604, lng: -95.3698 },
  'phoenix': { lat: 33.4484, lng: -112.0740 },
  'philadelphia': { lat: 39.9526, lng: -75.1652 },
  'san antonio': { lat: 29.4241, lng: -98.4936 },
  'san diego': { lat: 32.7157, lng: -117.1611 },
  'dallas': { lat: 32.7767, lng: -96.7970 },
  'san jose': { lat: 37.3382, lng: -121.8863 },
  'austin': { lat: 30.2672, lng: -97.7431 },
  'jacksonville': { lat: 30.3322, lng: -81.6557 },
  'fort worth': { lat: 32.7555, lng: -97.3308 },
  'columbus': { lat: 39.9612, lng: -82.9988 },
  'charlotte': { lat: 35.2271, lng: -80.8431 },
  'san francisco': { lat: 37.7749, lng: -122.4194 },
  'indianapolis': { lat: 39.7684, lng: -86.1581 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'denver': { lat: 39.7392, lng: -104.9903 },
  'washington': { lat: 38.9072, lng: -77.0369 },
  'dc': { lat: 38.9072, lng: -77.0369 },
  'boston': { lat: 42.3601, lng: -71.0589 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'atlanta': { lat: 33.7490, lng: -84.3880 },
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'portland': { lat: 45.5152, lng: -122.6784 },
  'detroit': { lat: 42.3314, lng: -83.0458 },
  'memphis': { lat: 35.1495, lng: -90.0490 },
  'louisville': { lat: 38.2527, lng: -85.7585 },
  'baltimore': { lat: 39.2904, lng: -76.6122 },
  'milwaukee': { lat: 43.0389, lng: -87.9065 },
  'albuquerque': { lat: 35.0844, lng: -106.6504 },
  'tucson': { lat: 32.2226, lng: -110.9747 },
  'fresno': { lat: 36.7378, lng: -119.7871 },
  'sacramento': { lat: 38.5816, lng: -121.4944 },
  'kansas city': { lat: 39.0997, lng: -94.5786 },
  'mesa': { lat: 33.4152, lng: -111.8315 },
  'omaha': { lat: 41.2565, lng: -95.9345 },
  'cleveland': { lat: 41.4993, lng: -81.6944 },
  'virginia beach': { lat: 36.8529, lng: -75.9780 },
  'raleigh': { lat: 35.7796, lng: -78.6382 },
  'minneapolis': { lat: 44.9778, lng: -93.2650 },
  'tampa': { lat: 27.9506, lng: -82.4572 },
  'new orleans': { lat: 29.9511, lng: -90.0715 },
  'pittsburgh': { lat: 40.4406, lng: -79.9959 },
  'cincinnati': { lat: 39.1031, lng: -84.5120 },
  'st louis': { lat: 38.6270, lng: -90.1994 },
  'orlando': { lat: 28.5383, lng: -81.3792 },
};

@Injectable()
export class MovementService {
  constructor(
    private prisma: PrismaService,
    private trackingGateway: TrackingGateway,
  ) {}

  private getCoordinatesFromLocation(location: string): { lat: number; lng: number } {
    const normalized = location.toLowerCase().trim();

    // Check direct match
    if (CITY_COORDINATES[normalized]) {
      return CITY_COORDINATES[normalized];
    }

    // Check if any city name is contained in the location
    for (const [city, coords] of Object.entries(CITY_COORDINATES)) {
      if (normalized.includes(city)) {
        return coords;
      }
    }

    // Default to a random US location if not found
    return { lat: 39.8283, lng: -98.5795 }; // Geographic center of US
  }

  private generateRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, points: number = 20): Array<{ lat: number; lng: number }> {
    const route: Array<{ lat: number; lng: number }> = [];

    for (let i = 0; i <= points; i++) {
      const t = i / points;
      // Add some curve to make it more realistic (Bezier-like)
      const midLat = (origin.lat + destination.lat) / 2 + (Math.random() - 0.5) * 2;
      const midLng = (origin.lng + destination.lng) / 2 + (Math.random() - 0.5) * 2;

      let lat: number, lng: number;
      if (t <= 0.5) {
        const t2 = t * 2;
        lat = origin.lat + (midLat - origin.lat) * t2;
        lng = origin.lng + (midLng - origin.lng) * t2;
      } else {
        const t2 = (t - 0.5) * 2;
        lat = midLat + (destination.lat - midLat) * t2;
        lng = midLng + (destination.lng - midLng) * t2;
      }

      route.push({ lat, lng });
    }

    return route;
  }

  async startMovement(shipmentId: string, adminId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { movementState: true },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (shipment.currentStatus === 'DELIVERED' || shipment.currentStatus === 'CANCELLED') {
      throw new BadRequestException('Cannot start movement for delivered or cancelled shipment');
    }

    // Get coordinates for origin and destination
    const originCoords = this.getCoordinatesFromLocation(shipment.originLocation);
    const destCoords = this.getCoordinatesFromLocation(shipment.destinationLocation);

    // Generate route
    const route = this.generateRoute(originCoords, destCoords, 25);

    // Update shipment status
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { currentStatus: 'IN_TRANSIT' },
    });

    // Update movement state
    await this.prisma.shipmentMovementState.upsert({
      where: { shipmentId },
      update: { isMoving: true, resumedAt: new Date() },
      create: { shipmentId, isMoving: true },
    });

    // Create initial location
    await this.prisma.shipmentLocation.create({
      data: {
        shipmentId,
        latitude: originCoords.lat,
        longitude: originCoords.lng,
        speed: 0,
        heading: 0,
      },
    });

    // Create tracking event
    await this.prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: 'IN_TRANSIT',
        description: 'Shipment movement started',
        location: shipment.originLocation,
        eventTime: new Date(),
        createdBy: adminId,
      },
    });

    // Start the simulation
    this.trackingGateway.startRouteSimulation(shipmentId, route);

    return {
      message: 'Movement started successfully',
      route,
      origin: originCoords,
      destination: destCoords,
    };
  }

  async pauseShipment(shipmentId: string, adminId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        movementState: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (!shipment.movementState) {
      throw new BadRequestException('Movement state not initialized');
    }

    if (!shipment.movementState.isMoving) {
      throw new BadRequestException('Shipment is already paused');
    }

    const movementState = await this.prisma.shipmentMovementState.update({
      where: { shipmentId },
      data: {
        isMoving: false,
        pausedBy: adminId,
        pausedAt: new Date(),
      },
      include: {
        pausedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await this.prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: 'PAUSED',
        description: 'Shipment movement paused by admin',
        location: shipment.currentLocation || 'Unknown',
        eventTime: new Date(),
        createdBy: adminId,
      },
    });

    this.trackingGateway.emitPauseEvent(shipmentId);

    return {
      message: 'Shipment paused successfully',
      movementState,
    };
  }

  async resumeShipment(shipmentId: string, adminId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        movementState: true,
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (!shipment.movementState) {
      throw new BadRequestException('Movement state not initialized');
    }

    if (shipment.movementState.isMoving) {
      throw new BadRequestException('Shipment is already moving');
    }

    const movementState = await this.prisma.shipmentMovementState.update({
      where: { shipmentId },
      data: {
        isMoving: true,
        resumedAt: new Date(),
      },
    });

    await this.prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: 'RESUMED',
        description: 'Shipment movement resumed by admin',
        location: shipment.currentLocation || 'Unknown',
        eventTime: new Date(),
        createdBy: adminId,
      },
    });

    this.trackingGateway.emitResumeEvent(shipmentId);

    return {
      message: 'Shipment resumed successfully',
      movementState,
    };
  }

  async cancelShipment(shipmentId: string, adminId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { movementState: true },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (shipment.currentStatus === 'DELIVERED') {
      throw new BadRequestException('Cannot cancel a delivered shipment');
    }

    if (shipment.currentStatus === 'CANCELLED') {
      throw new BadRequestException('Shipment is already cancelled');
    }

    // Stop any active simulation
    this.trackingGateway.stopSimulation(shipmentId);

    // Update shipment status
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { currentStatus: 'CANCELLED' },
    });

    // Update movement state
    if (shipment.movementState) {
      await this.prisma.shipmentMovementState.update({
        where: { shipmentId },
        data: { isMoving: false, pausedAt: new Date(), pausedBy: adminId },
      });
    }

    // Create tracking event
    await this.prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: 'CANCELLED',
        description: 'Shipment cancelled by admin',
        location: shipment.currentLocation || shipment.originLocation,
        eventTime: new Date(),
        createdBy: adminId,
      },
    });

    // Emit cancel event
    this.trackingGateway.emitCancelEvent(shipmentId);

    return {
      message: 'Shipment cancelled successfully',
    };
  }

  async getMovementState(shipmentId: string) {
    const movementState = await this.prisma.shipmentMovementState.findUnique({
      where: { shipmentId },
      include: {
        pausedByAdmin: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!movementState) {
      throw new NotFoundException('Movement state not found');
    }

    return movementState;
  }

  async getMovementHistory(shipmentId: string) {
    const events = await this.prisma.trackingEvent.findMany({
      where: {
        shipmentId,
        status: {
          in: ['PAUSED', 'RESUMED', 'CANCELLED', 'IN_TRANSIT'],
        },
      },
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

    return events;
  }

  async getRoute(shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const originCoords = this.getCoordinatesFromLocation(shipment.originLocation);
    const destCoords = this.getCoordinatesFromLocation(shipment.destinationLocation);
    const route = this.generateRoute(originCoords, destCoords, 25);

    // Get current position from locations
    const currentLocation = await this.prisma.shipmentLocation.findFirst({
      where: { shipmentId },
      orderBy: { recordedAt: 'desc' },
    });

    return {
      origin: originCoords,
      destination: destCoords,
      route,
      currentPosition: currentLocation ? {
        lat: currentLocation.latitude,
        lng: currentLocation.longitude,
      } : originCoords,
    };
  }
}
