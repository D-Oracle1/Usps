import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { Logger } from '@nestjs/common';

interface LocationUpdate {
  shipmentId: string;
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  timestamp: Date;
}

interface RoutePoint {
  lat: number;
  lng: number;
}

interface SimulationState {
  interval: NodeJS.Timeout;
  route: RoutePoint[];
  currentIndex: number;
  isPaused: boolean;
  totalDistance: number;
  remainingDistance: number;
  deliveryHours: number;
  startTime: number;
  pausedAt: number | null;
  totalPausedTime: number;
  subStep: number;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://usps-ten.vercel.app',
      'https://www-usps-com.vercel.app',
      /\.vercel\.app$/,
      /\.up\.railway\.app$/,
    ],
    credentials: true,
  },
  namespace: '/tracking',
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);
  private activeSimulations = new Map<string, SimulationState>();

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token || client.handshake.headers?.authorization?.split(' ')[1];

      if (token) {
        try {
          const payload = this.jwtService.verify(token);
          client.data.user = payload;
          this.logger.log(`Admin client connected: ${client.id}`);
        } catch (error) {
          this.logger.log(`Public client connected: ${client.id}`);
        }
      } else {
        this.logger.log(`Public client connected: ${client.id}`);
      }
    } catch (error) {
      this.logger.error(`Connection error: ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  @SubscribeMessage('joinShipment')
  async handleJoinShipment(
    @MessageBody() data: { shipmentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { shipmentId } = data;

    try {
      const shipment = await this.prisma.shipment.findUnique({
        where: { id: shipmentId },
        include: {
          movementState: true,
        },
      });

      if (!shipment) {
        client.emit('error', { message: 'Shipment not found' });
        return;
      }

      const room = `shipment:${shipmentId}`;
      client.join(room);

      const latestLocation = await this.prisma.shipmentLocation.findFirst({
        where: { shipmentId },
        orderBy: { recordedAt: 'desc' },
      });

      // Get simulation state if exists
      const simulation = this.activeSimulations.get(shipmentId);

      client.emit('joinedShipment', {
        shipmentId,
        isMoving: shipment.movementState?.isMoving ?? false,
        currentLocation: latestLocation || null,
        shipment,
        hasActiveSimulation: !!simulation,
        simulationProgress: simulation ? {
          currentIndex: simulation.currentIndex,
          totalPoints: simulation.route.length,
        } : null,
      });

      this.logger.log(`Client ${client.id} joined room: ${room}`);
    } catch (error) {
      this.logger.error(`Error joining shipment: ${error.message}`);
      client.emit('error', { message: 'Failed to join shipment' });
    }
  }

  @SubscribeMessage('leaveShipment')
  handleLeaveShipment(
    @MessageBody() data: { shipmentId: string },
    @ConnectedSocket() client: Socket,
  ) {
    const { shipmentId } = data;
    const room = `shipment:${shipmentId}`;
    client.leave(room);
    this.logger.log(`Client ${client.id} left room: ${room}`);
  }

  @SubscribeMessage('updateLocation')
  async handleLocationUpdate(
    @MessageBody() data: LocationUpdate,
    @ConnectedSocket() client: Socket,
  ) {
    if (!client.data.user) {
      client.emit('error', { message: 'Unauthorized' });
      return;
    }

    try {
      const movementState =
        await this.prisma.shipmentMovementState.findUnique({
          where: { shipmentId: data.shipmentId },
        });

      if (!movementState?.isMoving) {
        client.emit('error', {
          message: 'Shipment is paused, cannot update location',
        });
        return;
      }

      const location = await this.prisma.shipmentLocation.create({
        data: {
          shipmentId: data.shipmentId,
          latitude: data.latitude,
          longitude: data.longitude,
          speed: data.speed || 0,
          heading: data.heading || 0,
        },
      });

      await this.prisma.shipment.update({
        where: { id: data.shipmentId },
        data: {
          currentLocation: `${data.latitude},${data.longitude}`,
        },
      });

      this.emitLocationUpdate(data.shipmentId, {
        latitude: data.latitude,
        longitude: data.longitude,
        speed: data.speed,
        heading: data.heading,
        timestamp: new Date(),
      });
    } catch (error) {
      this.logger.error(`Error updating location: ${error.message}`);
      client.emit('error', { message: 'Failed to update location' });
    }
  }

  emitLocationUpdate(shipmentId: string, location: any) {
    const room = `shipment:${shipmentId}`;
    this.server.to(room).emit('locationUpdate', {
      shipmentId,
      ...location,
    });
  }

  emitPauseEvent(shipmentId: string, reason?: string) {
    const room = `shipment:${shipmentId}`;
    this.server.to(room).emit('shipmentIntercepted', {
      shipmentId,
      status: 'INTERCEPTED',
      reason: reason || 'Shipment intercepted',
      timestamp: new Date(),
    });

    // Pause the simulation if running and track pause time
    const simulation = this.activeSimulations.get(shipmentId);
    if (simulation) {
      simulation.isPaused = true;
      simulation.pausedAt = Date.now();
    }

    this.logger.log(`Emitted intercept event for shipment: ${shipmentId}, reason: ${reason}`);
  }

  emitResumeEvent(shipmentId: string, reason?: string) {
    const room = `shipment:${shipmentId}`;
    this.server.to(room).emit('shipmentCleared', {
      shipmentId,
      status: 'CLEARED',
      reason: reason || 'Shipment cleared',
      timestamp: new Date(),
    });

    // Resume the simulation if paused and calculate total paused time
    const simulation = this.activeSimulations.get(shipmentId);
    if (simulation) {
      if (simulation.pausedAt) {
        // Add the duration of this pause to total paused time
        const pauseDuration = Date.now() - simulation.pausedAt;
        simulation.totalPausedTime += pauseDuration;
        this.logger.log(`Shipment ${shipmentId} was paused for ${Math.round(pauseDuration / 1000 / 60)} minutes. Total paused time: ${Math.round(simulation.totalPausedTime / 1000 / 60)} minutes`);
      }
      simulation.isPaused = false;
      simulation.pausedAt = null;
    }

    this.logger.log(`Emitted cleared event for shipment: ${shipmentId}, reason: ${reason}`);
  }

  emitCancelEvent(shipmentId: string) {
    const room = `shipment:${shipmentId}`;
    this.server.to(room).emit('shipmentCancelled', {
      shipmentId,
      timestamp: new Date(),
    });

    // Stop any active simulation
    this.stopSimulation(shipmentId);

    this.logger.log(`Emitted cancel event for shipment: ${shipmentId}`);
  }

  // Calculate heading between two points
  private calculateHeading(from: RoutePoint, to: RoutePoint): number {
    const dLng = to.lng - from.lng;
    const dLat = to.lat - from.lat;
    const heading = Math.atan2(dLng, dLat) * (180 / Math.PI);
    return (heading + 360) % 360;
  }

  // Calculate distance between two points (in km)
  private calculateDistance(from: RoutePoint, to: RoutePoint): number {
    const R = 6371; // Earth's radius in km
    const dLat = (to.lat - from.lat) * Math.PI / 180;
    const dLng = (to.lng - from.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(from.lat * Math.PI / 180) * Math.cos(to.lat * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  // Calculate total route distance
  private calculateRouteDistance(route: RoutePoint[]): number {
    let total = 0;
    for (let i = 0; i < route.length - 1; i++) {
      total += this.calculateDistance(route[i], route[i + 1]);
    }
    return total;
  }

  // Calculate remaining distance from current position
  private calculateRemainingDistance(
    route: RoutePoint[],
    currentIndex: number,
    currentLat: number,
    currentLng: number,
  ): number {
    let remaining = 0;
    if (currentIndex < route.length - 1) {
      remaining += this.calculateDistance(
        { lat: currentLat, lng: currentLng },
        route[currentIndex + 1],
      );
      for (let i = currentIndex + 1; i < route.length - 1; i++) {
        remaining += this.calculateDistance(route[i], route[i + 1]);
      }
    }
    return remaining;
  }

  // Start route-based simulation with real-time delivery based on estimated time
  startRouteSimulation(
    shipmentId: string,
    route: RoutePoint[],
    totalDistance?: number,
    deliveryDays?: number,
  ) {
    // Stop any existing simulation
    this.stopSimulation(shipmentId);

    if (route.length < 2) {
      this.logger.warn(`Route too short for shipment: ${shipmentId}`);
      return;
    }

    const calculatedDistance =
      totalDistance || this.calculateRouteDistance(route);

    // Calculate timing based on delivery days - REAL TIME delivery
    const deliveryHours = (deliveryDays || 1) * 24;
    const totalSegments = route.length - 1;
    const STEPS_PER_SEGMENT = 10; // Smooth interpolation between route points
    const totalSteps = totalSegments * STEPS_PER_SEGMENT;

    // Calculate interval to spread simulation across ACTUAL delivery period
    // No speed factor - shipment moves in real time to complete in exactly deliveryDays
    const totalSimulationMs = deliveryHours * 60 * 60 * 1000; // Actual delivery time in ms
    const UPDATE_INTERVAL_MS = Math.max(1000, Math.floor(totalSimulationMs / totalSteps));

    const state: SimulationState = {
      interval: null as any,
      route,
      currentIndex: 0,
      isPaused: false,
      totalDistance: calculatedDistance,
      remainingDistance: calculatedDistance,
      deliveryHours,
      startTime: Date.now(),
      pausedAt: null,
      totalPausedTime: 0,
      subStep: 0,
    };

    this.logger.log(`Starting real-time simulation for shipment: ${shipmentId}`);
    this.logger.log(`Delivery time: ${deliveryDays} days (${deliveryHours} hours)`);
    this.logger.log(`Total steps: ${totalSteps}, Update interval: ${UPDATE_INTERVAL_MS}ms`);

    const interval = setInterval(async () => {
      try {
        // Check if paused - don't advance simulation
        if (state.isPaused) {
          return;
        }

        // Check movement state in database
        const movementState = await this.prisma.shipmentMovementState.findUnique({
          where: { shipmentId },
        });

        if (!movementState?.isMoving) {
          return;
        }

        const currentPoint = route[state.currentIndex];
        const nextIndex = Math.min(state.currentIndex + 1, route.length - 1);
        const nextPoint = route[nextIndex];

        // Interpolate between current and next point
        const t = state.subStep / STEPS_PER_SEGMENT;
        const interpolatedLat = currentPoint.lat + (nextPoint.lat - currentPoint.lat) * t;
        const interpolatedLng = currentPoint.lng + (nextPoint.lng - currentPoint.lng) * t;

        // Calculate speed and heading
        const heading = this.calculateHeading(currentPoint, nextPoint);
        const segmentDistance = this.calculateDistance(currentPoint, nextPoint);
        const speed = calculatedDistance / deliveryHours; // Average speed in km/h

        // Calculate remaining distance
        const remainingDistance = this.calculateRemainingDistance(
          route,
          state.currentIndex,
          interpolatedLat,
          interpolatedLng,
        );
        state.remainingDistance = remainingDistance;

        // Calculate ETA based on elapsed time and paused time
        // Time that has actually passed towards delivery (excluding paused time)
        const elapsedMs = Date.now() - state.startTime - state.totalPausedTime;
        const elapsedHours = elapsedMs / (1000 * 60 * 60);
        const remainingHours = Math.max(0, deliveryHours - elapsedHours);

        // Add any current pause time to the ETA
        const currentPauseMs = state.pausedAt ? Date.now() - state.pausedAt : 0;
        const etaMinutes = (remainingHours * 60) + (currentPauseMs / (1000 * 60));
        const eta = new Date(Date.now() + etaMinutes * 60 * 1000);

        // Calculate progress percentage
        const progressPercent = Math.round((state.currentIndex * STEPS_PER_SEGMENT + state.subStep) / totalSteps * 100);

        // Save to database periodically (every 5 steps)
        if (state.subStep % 5 === 0) {
          await this.prisma.shipmentLocation.create({
            data: {
              shipmentId,
              latitude: interpolatedLat,
              longitude: interpolatedLng,
              speed: Math.min(speed, 120), // Cap at 120 km/h
              heading,
            },
          });

          await this.prisma.shipment.update({
            where: { id: shipmentId },
            data: {
              currentLocation: `${interpolatedLat.toFixed(6)},${interpolatedLng.toFixed(6)}`,
              remainingDistance,
              estimatedArrival: eta,
            },
          });
        }

        // Emit location update with distance and ETA
        this.emitLocationUpdate(shipmentId, {
          latitude: interpolatedLat,
          longitude: interpolatedLng,
          speed: Math.min(speed, 120),
          heading,
          timestamp: new Date(),
          progress: {
            currentIndex: state.currentIndex,
            totalPoints: route.length,
            percentComplete: progressPercent,
          },
          distance: {
            total: state.totalDistance,
            remaining: remainingDistance,
            covered: state.totalDistance - remainingDistance,
          },
          eta: {
            arrival: eta,
            minutesRemaining: Math.round(etaMinutes),
          },
        });

        // Move to next substep
        state.subStep++;
        if (state.subStep >= STEPS_PER_SEGMENT) {
          state.subStep = 0;
          state.currentIndex++;

          // Check if we've reached the destination
          if (state.currentIndex >= route.length - 1) {
            this.logger.log(`Shipment ${shipmentId} reached destination`);

            // Update shipment status to delivered
            await this.prisma.shipment.update({
              where: { id: shipmentId },
              data: { currentStatus: 'DELIVERED' },
            });

            await this.prisma.shipmentMovementState.update({
              where: { shipmentId },
              data: { isMoving: false },
            });

            // Create delivered event
            const shipment = await this.prisma.shipment.findUnique({
              where: { id: shipmentId },
            });

            await this.prisma.trackingEvent.create({
              data: {
                shipmentId,
                status: 'DELIVERED',
                description: 'Package delivered successfully',
                location: shipment?.destinationLocation || 'Destination',
                eventTime: new Date(),
              },
            });

            // Emit delivered event
            const room = `shipment:${shipmentId}`;
            this.server.to(room).emit('shipmentDelivered', {
              shipmentId,
              timestamp: new Date(),
            });

            this.stopSimulation(shipmentId);
          }
        }
      } catch (error) {
        this.logger.error(`Simulation error for ${shipmentId}: ${error.message}`);
      }
    }, UPDATE_INTERVAL_MS);

    state.interval = interval;
    this.activeSimulations.set(shipmentId, state);
    this.logger.log(`Started real-time route simulation for shipment: ${shipmentId} with ${route.length} points, completing in ${deliveryDays} days`);
  }

  // Legacy simulation method
  startSimulation(shipmentId: string) {
    if (this.activeSimulations.has(shipmentId)) {
      this.logger.warn(`Simulation already running for shipment: ${shipmentId}`);
      return;
    }

    // Create a simple route for legacy simulation
    const route: RoutePoint[] = [];
    let currentLat = 40.7128;
    let currentLng = -74.006;
    const targetLat = 34.0522;
    const targetLng = -118.2437;

    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      route.push({
        lat: currentLat + (targetLat - currentLat) * t,
        lng: currentLng + (targetLng - currentLng) * t,
      });
    }

    this.startRouteSimulation(shipmentId, route);
  }

  stopSimulation(shipmentId: string) {
    const simulation = this.activeSimulations.get(shipmentId);
    if (simulation) {
      clearInterval(simulation.interval);
      this.activeSimulations.delete(shipmentId);
      this.logger.log(`Stopped simulation for shipment: ${shipmentId}`);
    }
  }

  // Get current simulation status
  getSimulationStatus(shipmentId: string) {
    const simulation = this.activeSimulations.get(shipmentId);
    if (!simulation) {
      return null;
    }
    return {
      currentIndex: simulation.currentIndex,
      totalPoints: simulation.route.length,
      isPaused: simulation.isPaused,
      percentComplete: Math.round(
        (simulation.currentIndex / (simulation.route.length - 1)) * 100,
      ),
    };
  }

  // Emit address change event
  emitAddressChangeEvent(
    shipmentId: string,
    data: {
      newDestination: string;
      fee: number;
      newEta: Date;
      newRemainingDistance: number;
    },
  ) {
    const room = `shipment:${shipmentId}`;
    this.server.to(room).emit('addressChanged', {
      shipmentId,
      ...data,
      timestamp: new Date(),
    });
    this.logger.log(`Emitted address change event for shipment: ${shipmentId}`);
  }
}
