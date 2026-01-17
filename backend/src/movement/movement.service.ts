import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingGateway } from '../websocket/tracking.gateway';
import { PricingService, AddressChangeFeeCalculation } from '../pricing/pricing.service';

// City and state coordinates for routing simulation
const CITY_COORDINATES: Record<string, { lat: number; lng: number }> = {
  // Major cities
  'new york': { lat: 40.7128, lng: -74.0060 },
  'ny': { lat: 40.7128, lng: -74.0060 },
  'nyc': { lat: 40.7128, lng: -74.0060 },
  'new york city': { lat: 40.7128, lng: -74.0060 },
  'manhattan': { lat: 40.7831, lng: -73.9712 },
  'brooklyn': { lat: 40.6782, lng: -73.9442 },
  'queens': { lat: 40.7282, lng: -73.7949 },
  'bronx': { lat: 40.8448, lng: -73.8648 },
  'staten island': { lat: 40.5795, lng: -74.1502 },
  'los angeles': { lat: 34.0522, lng: -118.2437 },
  'la': { lat: 34.0522, lng: -118.2437 },
  'chicago': { lat: 41.8781, lng: -87.6298 },
  'houston': { lat: 29.7604, lng: -95.3698 },
  'phoenix': { lat: 33.4484, lng: -112.0740 },
  'philadelphia': { lat: 39.9526, lng: -75.1652 },
  'philly': { lat: 39.9526, lng: -75.1652 },
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
  'sf': { lat: 37.7749, lng: -122.4194 },
  'indianapolis': { lat: 39.7684, lng: -86.1581 },
  'seattle': { lat: 47.6062, lng: -122.3321 },
  'denver': { lat: 39.7392, lng: -104.9903 },
  'washington': { lat: 38.9072, lng: -77.0369 },
  'dc': { lat: 38.9072, lng: -77.0369 },
  'washington dc': { lat: 38.9072, lng: -77.0369 },
  'boston': { lat: 42.3601, lng: -71.0589 },
  'miami': { lat: 25.7617, lng: -80.1918 },
  'atlanta': { lat: 33.7490, lng: -84.3880 },
  'las vegas': { lat: 36.1699, lng: -115.1398 },
  'vegas': { lat: 36.1699, lng: -115.1398 },
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

  // States (using major city or geographic center)
  'new jersey': { lat: 40.0583, lng: -74.4057 },
  'nj': { lat: 40.0583, lng: -74.4057 },
  'jersey city': { lat: 40.7178, lng: -74.0431 },
  'newark': { lat: 40.7357, lng: -74.1724 },
  'trenton': { lat: 40.2206, lng: -74.7597 },
  'california': { lat: 36.7783, lng: -119.4179 },
  'ca': { lat: 36.7783, lng: -119.4179 },
  'texas': { lat: 31.9686, lng: -99.9018 },
  'tx': { lat: 31.9686, lng: -99.9018 },
  'florida': { lat: 27.6648, lng: -81.5158 },
  'fl': { lat: 27.6648, lng: -81.5158 },
  'illinois': { lat: 40.6331, lng: -89.3985 },
  'il': { lat: 40.6331, lng: -89.3985 },
  'pennsylvania': { lat: 41.2033, lng: -77.1945 },
  'pa': { lat: 41.2033, lng: -77.1945 },
  'ohio': { lat: 40.4173, lng: -82.9071 },
  'georgia': { lat: 32.1656, lng: -82.9001 },
  'ga': { lat: 32.1656, lng: -82.9001 },
  'north carolina': { lat: 35.7596, lng: -79.0193 },
  'nc': { lat: 35.7596, lng: -79.0193 },
  'michigan': { lat: 44.3148, lng: -85.6024 },
  'arizona': { lat: 34.0489, lng: -111.0937 },
  'az': { lat: 34.0489, lng: -111.0937 },
  'massachusetts': { lat: 42.4072, lng: -71.3824 },
  'ma': { lat: 42.4072, lng: -71.3824 },
  'virginia': { lat: 37.4316, lng: -78.6569 },
  'va': { lat: 37.4316, lng: -78.6569 },
  'tennessee': { lat: 35.5175, lng: -86.5804 },
  'tn': { lat: 35.5175, lng: -86.5804 },
  'washington state': { lat: 47.7511, lng: -120.7401 },
  'wa': { lat: 47.7511, lng: -120.7401 },
  'colorado': { lat: 39.5501, lng: -105.7821 },
  'co': { lat: 39.5501, lng: -105.7821 },
  'maryland': { lat: 39.0458, lng: -76.6413 },
  'md': { lat: 39.0458, lng: -76.6413 },
  'connecticut': { lat: 41.6032, lng: -73.0877 },
  'ct': { lat: 41.6032, lng: -73.0877 },
  'oregon': { lat: 43.8041, lng: -120.5542 },
  'nevada': { lat: 38.8026, lng: -116.4194 },
  'nv': { lat: 38.8026, lng: -116.4194 },
  'utah': { lat: 39.3210, lng: -111.0937 },
  'indiana': { lat: 40.2672, lng: -86.1349 },
  'missouri': { lat: 37.9643, lng: -91.8318 },
  'wisconsin': { lat: 43.7844, lng: -88.7879 },
  'minnesota': { lat: 46.7296, lng: -94.6859 },
  'alabama': { lat: 32.3182, lng: -86.9023 },
  'louisiana': { lat: 30.9843, lng: -91.9623 },
  'kentucky': { lat: 37.8393, lng: -84.2700 },
  'oklahoma': { lat: 35.0078, lng: -97.0929 },
  'south carolina': { lat: 33.8361, lng: -81.1637 },
  'iowa': { lat: 41.8780, lng: -93.0977 },
  'arkansas': { lat: 35.2010, lng: -91.8318 },
  'kansas': { lat: 39.0119, lng: -98.4842 },
  'mississippi': { lat: 32.3547, lng: -89.3985 },
  'nebraska': { lat: 41.4925, lng: -99.9018 },
  'new mexico': { lat: 34.5199, lng: -105.8701 },
  'idaho': { lat: 44.0682, lng: -114.7420 },
  'hawaii': { lat: 19.8968, lng: -155.5828 },
  'west virginia': { lat: 38.5976, lng: -80.4549 },
  'maine': { lat: 45.2538, lng: -69.4455 },
  'new hampshire': { lat: 43.1939, lng: -71.5724 },
  'rhode island': { lat: 41.5801, lng: -71.4774 },
  'montana': { lat: 46.8797, lng: -110.3626 },
  'delaware': { lat: 38.9108, lng: -75.5277 },
  'south dakota': { lat: 43.9695, lng: -99.9018 },
  'north dakota': { lat: 47.5515, lng: -101.0020 },
  'alaska': { lat: 64.2008, lng: -152.4937 },
  'vermont': { lat: 44.5588, lng: -72.5778 },
  'wyoming': { lat: 43.0760, lng: -107.2903 },
};

@Injectable()
export class MovementService {
  private readonly AVERAGE_SPEED = 65; // km/h (realistic for delivery trucks)

  constructor(
    private prisma: PrismaService,
    private trackingGateway: TrackingGateway,
    private pricingService: PricingService,
  ) {}

  // Reverse geocode coordinates to get street/area name using Nominatim
  private async reverseGeocode(lat: number, lng: number): Promise<string> {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'USPS-Tracking-System/1.0',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Geocoding request failed');
      }

      const data = await response.json();

      if (data && data.address) {
        // Build a human-readable address from parts
        const parts: string[] = [];

        if (data.address.road) parts.push(data.address.road);
        if (data.address.suburb || data.address.neighbourhood) {
          parts.push(data.address.suburb || data.address.neighbourhood);
        }
        if (data.address.city || data.address.town || data.address.village) {
          parts.push(data.address.city || data.address.town || data.address.village);
        }
        if (data.address.state) parts.push(data.address.state);

        if (parts.length > 0) {
          return parts.join(', ');
        }

        // Fallback to display_name
        if (data.display_name) {
          // Take first 2-3 parts of display name
          const displayParts = data.display_name.split(', ').slice(0, 3);
          return displayParts.join(', ');
        }
      }

      return `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } catch (error) {
      console.error('Reverse geocoding failed:', error);
      return `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    }
  }

  // Calculate distance between two points using Haversine formula
  private calculateHaversineDistance(
    lat1: number,
    lng1: number,
    lat2: number,
    lng2: number,
  ): number {
    const R = 6371; // Earth's radius in km
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  // Calculate total route distance
  private calculateTotalRouteDistance(
    route: Array<{ lat: number; lng: number }>,
  ): number {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      total += this.calculateHaversineDistance(
        route[i].lat,
        route[i].lng,
        route[i + 1].lat,
        route[i + 1].lng,
      );
    }
    return total;
  }

  private getCoordinatesFromLocation(location: string): { lat: number; lng: number } {
    const normalized = location.toLowerCase().trim();

    // Check direct match
    if (CITY_COORDINATES[normalized]) {
      return CITY_COORDINATES[normalized];
    }

    // Check if any city name is contained in the location (prioritize longer matches)
    const sortedCities = Object.entries(CITY_COORDINATES).sort(
      (a, b) => b[0].length - a[0].length
    );

    for (const [city, coords] of sortedCities) {
      if (normalized.includes(city)) {
        return coords;
      }
    }

    // Also check if location contains the city (reverse check)
    for (const [city, coords] of sortedCities) {
      if (city.includes(normalized)) {
        return coords;
      }
    }

    // Default to a central US location if not found
    console.warn(`Location not found in database: "${location}", using default coordinates`);
    return { lat: 39.8283, lng: -98.5795 }; // Geographic center of US
  }

  private generateRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }, points: number = 20): Array<{ lat: number; lng: number }> {
    const route: Array<{ lat: number; lng: number }> = [];

    // Calculate direct distance to determine curve amount
    const directDistance = this.calculateHaversineDistance(
      origin.lat, origin.lng, destination.lat, destination.lng
    );

    // For short distances (<100km), use straight line with minimal curve
    // For longer distances, add slight curve to simulate road routing
    const curveAmount = directDistance < 100 ? 0.01 : Math.min(0.1, directDistance / 5000);

    for (let i = 0; i <= points; i++) {
      const t = i / points;

      // Simple linear interpolation with slight curve for realism
      const lat = origin.lat + (destination.lat - origin.lat) * t;
      const lng = origin.lng + (destination.lng - origin.lng) * t;

      // Add slight perpendicular offset for curve (parabolic)
      const curveOffset = curveAmount * Math.sin(t * Math.PI);
      const angle = Math.atan2(destination.lng - origin.lng, destination.lat - origin.lat);

      route.push({
        lat: lat + curveOffset * Math.cos(angle + Math.PI / 2),
        lng: lng + curveOffset * Math.sin(angle + Math.PI / 2)
      });
    }

    return route;
  }

  async startMovement(shipmentId: string, adminId: string, deliveryDays: number) {
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

    // Calculate total distance
    const totalDistance = this.calculateTotalRouteDistance(route);

    // Calculate ETA based on admin-specified delivery days
    const deliveryHours = deliveryDays * 24;
    const eta = new Date(Date.now() + deliveryHours * 60 * 60 * 1000);

    // Calculate speed needed to cover distance in the specified time
    const calculatedSpeed = totalDistance / deliveryHours; // km/h
    const travelTimeMinutes = deliveryHours * 60;

    // Update shipment status with distance and ETA
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        currentStatus: 'IN_TRANSIT',
        totalDistance,
        remainingDistance: totalDistance,
        estimatedArrival: eta,
        tripStartedAt: new Date(),
        averageSpeed: calculatedSpeed,
      },
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

    // Start the simulation with distance tracking and delivery duration
    this.trackingGateway.startRouteSimulation(shipmentId, route, totalDistance, deliveryDays);

    return {
      message: 'Trip started successfully',
      route,
      origin: originCoords,
      destination: destCoords,
      totalDistance,
      remainingDistance: totalDistance,
      estimatedArrival: eta,
      estimatedTravelTime: travelTimeMinutes,
      deliveryDays,
      calculatedSpeed,
    };
  }

  async pauseShipment(shipmentId: string, adminId: string, reason: string) {
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
      throw new BadRequestException('Shipment is already intercepted');
    }

    // Get the current location from the tracking gateway simulation or database
    const currentLocation = await this.prisma.shipmentLocation.findFirst({
      where: { shipmentId },
      orderBy: { recordedAt: 'desc' },
    });

    // Get coordinates and reverse geocode
    let interceptLat: number | null = null;
    let interceptLng: number | null = null;
    let interceptAddress: string | null = null;

    if (currentLocation) {
      interceptLat = currentLocation.latitude;
      interceptLng = currentLocation.longitude;
      interceptAddress = await this.reverseGeocode(interceptLat, interceptLng);
    } else if (shipment.currentLocation && shipment.currentLocation.includes(',')) {
      // Try to parse from currentLocation string
      const parts = shipment.currentLocation.split(',').map(s => parseFloat(s.trim()));
      if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        interceptLat = parts[0];
        interceptLng = parts[1];
        interceptAddress = await this.reverseGeocode(interceptLat, interceptLng);
      }
    }

    // Update shipment status to INTERCEPTED and store the intercept location
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        currentStatus: 'INTERCEPTED',
        currentLocation: interceptAddress || shipment.currentLocation || 'Unknown',
      },
    });

    const movementState = await this.prisma.shipmentMovementState.update({
      where: { shipmentId },
      data: {
        isMoving: false,
        pausedBy: adminId,
        pausedAt: new Date(),
        interceptReason: reason,
        clearReason: null,
        interceptedLat: interceptLat,
        interceptedLng: interceptLng,
        interceptedAddress: interceptAddress,
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

    // Create tracking event with the address (not coordinates) - no admin info in description
    await this.prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: 'INTERCEPTED',
        description: `Shipment held for inspection: ${reason}`,
        location: interceptAddress || shipment.currentLocation || 'Unknown',
        eventTime: new Date(),
        createdBy: adminId,
      },
    });

    // Emit pause event with intercept location - no admin info for public display
    this.trackingGateway.emitPauseEvent(shipmentId, reason, null, {
      latitude: interceptLat,
      longitude: interceptLng,
      address: interceptAddress,
    });

    return {
      message: 'Shipment intercepted successfully',
      reason,
      movementState,
      interceptLocation: {
        latitude: interceptLat,
        longitude: interceptLng,
        address: interceptAddress,
      },
    };
  }

  async resumeShipment(shipmentId: string, adminId: string, reason: string) {
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

    // Update shipment status to IN_TRANSIT
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: { currentStatus: 'IN_TRANSIT' },
    });

    const movementState = await this.prisma.shipmentMovementState.update({
      where: { shipmentId },
      data: {
        isMoving: true,
        resumedAt: new Date(),
        clearReason: reason,
        // Clear intercept location when resumed
        interceptedLat: null,
        interceptedLng: null,
        interceptedAddress: null,
      },
    });

    // Create tracking event without admin reference in public-facing text
    await this.prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: 'IN_TRANSIT',
        description: `Shipment cleared and in transit: ${reason}`,
        location: shipment.currentLocation || 'Unknown',
        eventTime: new Date(),
        createdBy: adminId,
      },
    });

    // Emit resume event without admin info for public display
    this.trackingGateway.emitResumeEvent(shipmentId, reason, null);

    return {
      message: 'Shipment cleared successfully',
      reason,
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

  // Calculate address change fee preview
  async calculateAddressChangeFee(
    shipmentId: string,
    newDestination: string,
  ): Promise<AddressChangeFeeCalculation> {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (shipment.currentStatus !== 'IN_TRANSIT') {
      throw new BadRequestException(
        'Can only change address for in-transit shipments',
      );
    }

    // Get current position
    const currentLocation = await this.prisma.shipmentLocation.findFirst({
      where: { shipmentId },
      orderBy: { recordedAt: 'desc' },
    });

    const currentPos = currentLocation
      ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
      : this.getCoordinatesFromLocation(shipment.originLocation);

    // Calculate distances
    const oldDestCoords = this.getCoordinatesFromLocation(
      shipment.destinationLocation,
    );
    const newDestCoords = this.getCoordinatesFromLocation(newDestination);

    const previousDistance = this.calculateHaversineDistance(
      currentPos.lat,
      currentPos.lng,
      oldDestCoords.lat,
      oldDestCoords.lng,
    );

    const newDistance = this.calculateHaversineDistance(
      currentPos.lat,
      currentPos.lng,
      newDestCoords.lat,
      newDestCoords.lng,
    );

    const feeCalc = this.pricingService.calculateAddressChangeFee(
      previousDistance,
      newDistance,
      shipment.remainingDistance || previousDistance,
    );

    return {
      ...feeCalc,
      previousDestination: shipment.destinationLocation,
      newDestination,
    };
  }

  // Apply address change with fee
  async applyAddressChange(
    shipmentId: string,
    newDestination: string,
    adminId: string,
  ) {
    const feeCalc = await this.calculateAddressChangeFee(
      shipmentId,
      newDestination,
    );

    // Record the fee
    await this.pricingService.recordAddressChangeFee(
      shipmentId,
      feeCalc,
      adminId,
    );

    // Get current position for route recalculation
    const currentLocation = await this.prisma.shipmentLocation.findFirst({
      where: { shipmentId },
      orderBy: { recordedAt: 'desc' },
    });

    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
    });

    const currentPos = currentLocation
      ? { lat: currentLocation.latitude, lng: currentLocation.longitude }
      : this.getCoordinatesFromLocation(shipment!.originLocation);

    const newDestCoords = this.getCoordinatesFromLocation(newDestination);

    // Generate new route from current position
    const newRoute = this.generateRoute(currentPos, newDestCoords, 15);
    const newTotalDistance = this.calculateTotalRouteDistance(newRoute);

    // Update shipment
    await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        destinationLocation: newDestination,
        remainingDistance: newTotalDistance,
        estimatedArrival: feeCalc.newEta,
      },
    });

    // Create tracking event
    await this.prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: 'ADDRESS_CHANGED',
        description: `Destination changed from ${feeCalc.previousDestination} to ${newDestination}. Fee: $${feeCalc.totalFee}`,
        location: `${currentPos.lat.toFixed(5)},${currentPos.lng.toFixed(5)}`,
        eventTime: new Date(),
        createdBy: adminId,
      },
    });

    // Stop current simulation and restart with new route
    this.trackingGateway.stopSimulation(shipmentId);
    this.trackingGateway.startRouteSimulation(
      shipmentId,
      newRoute,
      newTotalDistance,
    );

    // Emit address change event
    this.trackingGateway.emitAddressChangeEvent(shipmentId, {
      newDestination,
      fee: feeCalc.totalFee,
      newEta: feeCalc.newEta,
      newRemainingDistance: newTotalDistance,
    });

    return {
      message: 'Address changed successfully',
      fee: feeCalc,
      newRoute,
      newEta: feeCalc.newEta,
      newRemainingDistance: newTotalDistance,
    };
  }

  // Manually update location (admin drag marker)
  async updateLocationManually(
    shipmentId: string,
    adminId: string,
    latitude: number,
    longitude: number,
    addressLabel?: string,
  ) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { movementState: true },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    if (shipment.currentStatus === 'DELIVERED' || shipment.currentStatus === 'CANCELLED') {
      throw new BadRequestException('Cannot update location for delivered or cancelled shipment');
    }

    // Get destination coordinates
    const destCoords = this.getCoordinatesFromLocation(shipment.destinationLocation);

    // Calculate new remaining distance
    const newRemainingDistance = this.calculateHaversineDistance(
      latitude,
      longitude,
      destCoords.lat,
      destCoords.lng,
    );

    // Calculate new ETA based on average speed
    const avgSpeed = shipment.averageSpeed || this.AVERAGE_SPEED;
    const hoursRemaining = newRemainingDistance / avgSpeed;
    const newEta = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);

    // Get address from reverse geocoding if not provided
    let locationString: string;
    if (addressLabel) {
      locationString = addressLabel;
    } else {
      locationString = await this.reverseGeocode(latitude, longitude);
    }

    // Record new location
    await this.prisma.shipmentLocation.create({
      data: {
        shipmentId,
        latitude,
        longitude,
        speed: 0,
        heading: 0,
      },
    });

    // Update shipment with new location and ETA
    const updatedShipment = await this.prisma.shipment.update({
      where: { id: shipmentId },
      data: {
        currentLocation: locationString,
        remainingDistance: newRemainingDistance,
        estimatedArrival: newEta,
      },
    });

    // Create tracking event - no admin reference in public text
    await this.prisma.trackingEvent.create({
      data: {
        shipmentId,
        status: 'LOCATION_UPDATED',
        description: `Shipment in transit`,
        location: locationString,
        eventTime: new Date(),
        createdBy: adminId,
      },
    });

    // Emit location update via websocket
    this.trackingGateway.emitLocationUpdate(shipmentId, {
      latitude,
      longitude,
      remainingDistance: newRemainingDistance,
      estimatedArrival: newEta,
      currentLocation: locationString,
    });

    return {
      message: 'Location updated successfully',
      location: {
        latitude,
        longitude,
        label: locationString,
      },
      remainingDistance: newRemainingDistance,
      estimatedArrival: newEta,
      totalDistance: shipment.totalDistance,
    };
  }

  // Get current trip info with distance and ETA
  async getTripInfo(shipmentId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: {
        addressChangeFees: {
          orderBy: { appliedAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!shipment) {
      throw new NotFoundException('Shipment not found');
    }

    const simulationStatus =
      this.trackingGateway.getSimulationStatus(shipmentId);

    return {
      totalDistance: shipment.totalDistance,
      remainingDistance: shipment.remainingDistance,
      estimatedArrival: shipment.estimatedArrival,
      tripStartedAt: shipment.tripStartedAt,
      averageSpeed: shipment.averageSpeed,
      simulationProgress: simulationStatus,
      addressChangeFees: shipment.addressChangeFees,
    };
  }
}
