import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  Query,
} from '@nestjs/common';
import { LocationService } from './location.service';
import { RecordLocationDto } from './dto/location.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('locations')
export class LocationController {
  constructor(private readonly locationService: LocationService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  recordLocation(@Body() recordLocationDto: RecordLocationDto) {
    return this.locationService.recordLocation(recordLocationDto);
  }

  @Get(':shipmentId')
  @UseGuards(JwtAuthGuard)
  getLocations(
    @Param('shipmentId') shipmentId: string,
    @Query('limit') limit?: string,
  ) {
    return this.locationService.getLocations(
      shipmentId,
      limit ? parseInt(limit) : 100,
    );
  }

  @Get(':shipmentId/latest')
  @UseGuards(JwtAuthGuard)
  getLatestLocation(@Param('shipmentId') shipmentId: string) {
    return this.locationService.getLatestLocation(shipmentId);
  }
}
