import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MovementService } from './movement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IsString, IsNotEmpty, IsNumber, IsOptional, Min } from 'class-validator';

class StartMovementDto {
  @IsNumber()
  @Min(0.1)
  deliveryDays: number; // Estimated delivery period in days (e.g., 2 for 2 days)
}

class PauseShipmentDto {
  @IsString()
  @IsNotEmpty()
  reason: string; // Reason for interception
}

class ResumeShipmentDto {
  @IsString()
  @IsNotEmpty()
  reason: string; // Reason for clearance
}

class ChangeAddressDto {
  @IsString()
  @IsNotEmpty()
  newDestination: string;
}

@Controller('movement')
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  @Post(':shipmentId/start')
  @UseGuards(JwtAuthGuard)
  startMovement(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: StartMovementDto,
    @Request() req,
  ) {
    return this.movementService.startMovement(
      shipmentId,
      req.user.userId,
      dto.deliveryDays,
    );
  }

  @Post(':shipmentId/pause')
  @UseGuards(JwtAuthGuard)
  pauseShipment(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: PauseShipmentDto,
    @Request() req,
  ) {
    return this.movementService.pauseShipment(
      shipmentId,
      req.user.userId,
      dto.reason,
    );
  }

  @Post(':shipmentId/resume')
  @UseGuards(JwtAuthGuard)
  resumeShipment(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: ResumeShipmentDto,
    @Request() req,
  ) {
    return this.movementService.resumeShipment(
      shipmentId,
      req.user.userId,
      dto.reason,
    );
  }

  @Post(':shipmentId/cancel')
  @UseGuards(JwtAuthGuard)
  cancelShipment(@Param('shipmentId') shipmentId: string, @Request() req) {
    return this.movementService.cancelShipment(shipmentId, req.user.userId);
  }

  @Get(':shipmentId/state')
  @UseGuards(JwtAuthGuard)
  getMovementState(@Param('shipmentId') shipmentId: string) {
    return this.movementService.getMovementState(shipmentId);
  }

  @Get(':shipmentId/history')
  @UseGuards(JwtAuthGuard)
  getMovementHistory(@Param('shipmentId') shipmentId: string) {
    return this.movementService.getMovementHistory(shipmentId);
  }

  @Get(':shipmentId/route')
  @UseGuards(JwtAuthGuard)
  getRoute(@Param('shipmentId') shipmentId: string) {
    return this.movementService.getRoute(shipmentId);
  }

  @Get(':shipmentId/trip-info')
  @UseGuards(JwtAuthGuard)
  getTripInfo(@Param('shipmentId') shipmentId: string) {
    return this.movementService.getTripInfo(shipmentId);
  }

  @Post(':shipmentId/calculate-address-change-fee')
  @UseGuards(JwtAuthGuard)
  calculateAddressChangeFee(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: ChangeAddressDto,
  ) {
    return this.movementService.calculateAddressChangeFee(
      shipmentId,
      dto.newDestination,
    );
  }

  @Post(':shipmentId/change-address')
  @UseGuards(JwtAuthGuard)
  applyAddressChange(
    @Param('shipmentId') shipmentId: string,
    @Body() dto: ChangeAddressDto,
    @Request() req,
  ) {
    return this.movementService.applyAddressChange(
      shipmentId,
      dto.newDestination,
      req.user.userId,
    );
  }
}
