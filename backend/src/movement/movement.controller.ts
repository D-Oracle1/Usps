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
import { RolesGuard, Roles } from '../auth/guards/roles.guard';
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
@UseGuards(JwtAuthGuard, RolesGuard)
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  @Post(':shipmentId/start')
  @Roles('ADMIN', 'SUPER_ADMIN')
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
  @Roles('ADMIN', 'SUPER_ADMIN')
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
  @Roles('ADMIN', 'SUPER_ADMIN')
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
  @Roles('ADMIN', 'SUPER_ADMIN')
  cancelShipment(@Param('shipmentId') shipmentId: string, @Request() req) {
    return this.movementService.cancelShipment(shipmentId, req.user.userId);
  }

  @Get(':shipmentId/state')
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  getMovementState(@Param('shipmentId') shipmentId: string) {
    return this.movementService.getMovementState(shipmentId);
  }

  @Get(':shipmentId/history')
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  getMovementHistory(@Param('shipmentId') shipmentId: string) {
    return this.movementService.getMovementHistory(shipmentId);
  }

  @Get(':shipmentId/route')
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  getRoute(@Param('shipmentId') shipmentId: string) {
    return this.movementService.getRoute(shipmentId);
  }

  @Get(':shipmentId/trip-info')
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  getTripInfo(@Param('shipmentId') shipmentId: string) {
    return this.movementService.getTripInfo(shipmentId);
  }

  @Post(':shipmentId/calculate-address-change-fee')
  @Roles('ADMIN', 'SUPER_ADMIN')
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
  @Roles('ADMIN', 'SUPER_ADMIN')
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
