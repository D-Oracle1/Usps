import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AddressChangeFeeCalculation {
  previousDestination: string;
  newDestination: string;
  previousDistance: number;
  newDistance: number;
  distanceDifference: number;
  timeDifference: number;
  baseFee: number;
  perMileFee: number;
  extraMilesFee: number;
  totalFee: number;
  newEta: Date;
}

@Injectable()
export class PricingService {
  private readonly BASE_FEE = 5.0;
  private readonly PER_MILE_FEE = 0.5;
  private readonly KM_TO_MILES = 0.621371;
  private readonly AVERAGE_SPEED = 45; // km/h

  constructor(private prisma: PrismaService) {}

  calculateAddressChangeFee(
    previousDistance: number,
    newDistance: number,
    remainingDistance: number,
  ): AddressChangeFeeCalculation {
    const distanceDiffKm = newDistance - previousDistance;
    const distanceDiffMiles = distanceDiffKm * this.KM_TO_MILES;

    // Only charge for extra miles, not for shorter routes
    const extraMiles = Math.max(0, distanceDiffMiles);
    const extraMilesFee = extraMiles * this.PER_MILE_FEE;
    const totalFee = this.BASE_FEE + extraMilesFee;

    // Calculate time difference in minutes
    const timeDiffMinutes = (distanceDiffKm / this.AVERAGE_SPEED) * 60;

    // Calculate new ETA
    const newRemainingDistance = Math.max(0, remainingDistance + distanceDiffKm);
    const hoursRemaining = newRemainingDistance / this.AVERAGE_SPEED;
    const newEta = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);

    return {
      previousDestination: '',
      newDestination: '',
      previousDistance,
      newDistance,
      distanceDifference: distanceDiffKm,
      timeDifference: timeDiffMinutes,
      baseFee: this.BASE_FEE,
      perMileFee: this.PER_MILE_FEE,
      extraMilesFee: Math.round(extraMilesFee * 100) / 100,
      totalFee: Math.round(totalFee * 100) / 100,
      newEta,
    };
  }

  async recordAddressChangeFee(
    shipmentId: string,
    feeData: AddressChangeFeeCalculation,
    adminId: string,
  ) {
    return this.prisma.addressChangeFee.create({
      data: {
        shipmentId,
        previousDestination: feeData.previousDestination,
        newDestination: feeData.newDestination,
        distanceDifference: feeData.distanceDifference,
        timeDifference: feeData.timeDifference,
        baseFee: feeData.baseFee,
        perMileFee: feeData.perMileFee,
        totalFee: feeData.totalFee,
        appliedBy: adminId,
      },
    });
  }

  async getAddressChangeFeeHistory(shipmentId: string) {
    return this.prisma.addressChangeFee.findMany({
      where: { shipmentId },
      include: {
        admin: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { appliedAt: 'desc' },
    });
  }

  calculateEta(
    distanceKm: number,
    averageSpeedKmh: number = this.AVERAGE_SPEED,
  ): Date {
    const hoursRemaining = distanceKm / averageSpeedKmh;
    return new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);
  }

  calculateTravelTime(
    distanceKm: number,
    averageSpeedKmh: number = this.AVERAGE_SPEED,
  ): number {
    // Returns time in minutes
    return (distanceKm / averageSpeedKmh) * 60;
  }

  formatEta(eta: Date): string {
    return eta.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatTravelTime(minutes: number): string {
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  }
}
