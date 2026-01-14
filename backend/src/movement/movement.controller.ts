import {
  Controller,
  Post,
  Get,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { MovementService } from './movement.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('movement')
export class MovementController {
  constructor(private readonly movementService: MovementService) {}

  @Post(':shipmentId/start')
  @UseGuards(JwtAuthGuard)
  startMovement(@Param('shipmentId') shipmentId: string, @Request() req) {
    return this.movementService.startMovement(shipmentId, req.user.userId);
  }

  @Post(':shipmentId/pause')
  @UseGuards(JwtAuthGuard)
  pauseShipment(@Param('shipmentId') shipmentId: string, @Request() req) {
    return this.movementService.pauseShipment(shipmentId, req.user.userId);
  }

  @Post(':shipmentId/resume')
  @UseGuards(JwtAuthGuard)
  resumeShipment(@Param('shipmentId') shipmentId: string, @Request() req) {
    return this.movementService.resumeShipment(shipmentId, req.user.userId);
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
}
