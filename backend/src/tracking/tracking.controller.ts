import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { CreateTrackingEventDto } from './dto/tracking.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('events')
  @UseGuards(JwtAuthGuard)
  createEvent(
    @Body() createTrackingEventDto: CreateTrackingEventDto,
    @Request() req,
  ) {
    return this.trackingService.createEvent(
      createTrackingEventDto,
      req.user.userId,
    );
  }

  @Get('timeline/:shipmentId')
  @UseGuards(JwtAuthGuard)
  getTimeline(@Param('shipmentId') shipmentId: string) {
    return this.trackingService.getTimeline(shipmentId);
  }

  @Get('public/:trackingNumber')
  getTimelineByTrackingNumber(@Param('trackingNumber') trackingNumber: string) {
    return this.trackingService.getTimelineByTrackingNumber(trackingNumber);
  }
}
