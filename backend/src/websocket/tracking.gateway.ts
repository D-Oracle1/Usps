import { Injectable, Logger } from '@nestjs/common';
import { PusherService } from '../pusher/pusher.service';

/**
 * TrackingGateway — previously a Socket.IO WebSocket gateway.
 * Now a thin wrapper over PusherService, emitting events to
 * the `shipment-{shipmentId}` Pusher channel.
 *
 * The class name is kept to avoid cascading renames across MovementModule.
 */
@Injectable()
export class TrackingGateway {
  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private readonly pusherService: PusherService) {}

  emitLocationUpdate(shipmentId: string, location: Record<string, any>): void {
    this.pusherService.trigger(`shipment-${shipmentId}`, 'location-update', {
      shipmentId,
      ...location,
    });
  }

  emitPauseEvent(
    shipmentId: string,
    reason?: string,
    admin?: { id: string; name: string; email: string } | null,
    interceptLocation?: {
      latitude: number | null;
      longitude: number | null;
      address: string | null;
    },
  ): void {
    this.pusherService.trigger(`shipment-${shipmentId}`, 'shipment-intercepted', {
      shipmentId,
      status: 'INTERCEPTED',
      reason: reason || 'Shipment held for inspection',
      timestamp: new Date(),
      location: interceptLocation || null,
    });
    this.logger.log(`Emitted shipment-intercepted for ${shipmentId}`);
  }

  emitResumeEvent(
    shipmentId: string,
    reason?: string,
    admin?: { id: string; name: string; email: string } | null,
  ): void {
    this.pusherService.trigger(`shipment-${shipmentId}`, 'shipment-cleared', {
      shipmentId,
      status: 'CLEARED',
      reason: reason || 'Shipment cleared and in transit',
      timestamp: new Date(),
    });
    this.logger.log(`Emitted shipment-cleared for ${shipmentId}`);
  }

  emitCancelEvent(shipmentId: string): void {
    this.pusherService.trigger(`shipment-${shipmentId}`, 'shipment-cancelled', {
      shipmentId,
      timestamp: new Date(),
    });
    this.logger.log(`Emitted shipment-cancelled for ${shipmentId}`);
  }

  emitAddressChangeEvent(
    shipmentId: string,
    data: {
      newDestination: string;
      fee: number;
      newEta: Date;
      newRemainingDistance: number;
    },
  ): void {
    this.pusherService.trigger(`shipment-${shipmentId}`, 'address-changed', {
      shipmentId,
      ...data,
      timestamp: new Date(),
    });
    this.logger.log(`Emitted address-changed for ${shipmentId}`);
  }

  emitSpeedChange(
    shipmentId: string,
    data: {
      speedKmh: number;
      estimatedArrival: Date;
      remainingDistance: number;
    },
  ): void {
    this.pusherService.trigger(`shipment-${shipmentId}`, 'speed-changed', {
      shipmentId,
      ...data,
      timestamp: new Date(),
    });
    this.logger.log(`Emitted speed-changed for ${shipmentId}, speed: ${data.speedKmh} km/h`);
  }

  // Kept for backward compatibility with callers that check simulation status
  updateSimulationSpeed(_shipmentId: string, _speedKmh: number): boolean {
    return false;
  }
}
