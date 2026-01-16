import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/shipment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';

@Controller('shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  create(@Body() createShipmentDto: CreateShipmentDto) {
    return this.shipmentsService.create(createShipmentDto);
  }

  @Get()
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.shipmentsService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  // Static routes MUST come before parameterized routes
  @Get('statistics')
  @Roles('ADMIN', 'SUPER_ADMIN')
  getStatistics() {
    return this.shipmentsService.getStatistics();
  }

  @Get('export')
  @Roles('ADMIN', 'SUPER_ADMIN')
  exportShipments() {
    return this.shipmentsService.exportShipments();
  }

  @Get('tracking/:trackingNumber')
  findByTrackingNumber(@Param('trackingNumber') trackingNumber: string) {
    return this.shipmentsService.findByTrackingNumber(trackingNumber);
  }

  @Post('bulk/update-status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  bulkUpdateStatus(@Body() body: { shipmentIds: string[]; status: string }) {
    return this.shipmentsService.bulkUpdateStatus(body.shipmentIds, body.status);
  }

  @Post('bulk/delete')
  @Roles('ADMIN', 'SUPER_ADMIN')
  bulkDelete(@Body() body: { shipmentIds: string[] }) {
    return this.shipmentsService.bulkDelete(body.shipmentIds);
  }

  // Parameterized routes come AFTER all static routes
  @Get(':id')
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  findOne(@Param('id') id: string) {
    return this.shipmentsService.findOne(id);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  update(@Param('id') id: string, @Body() updateShipmentDto: UpdateShipmentDto) {
    return this.shipmentsService.update(id, updateShipmentDto);
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  remove(@Param('id') id: string) {
    return this.shipmentsService.remove(id);
  }
}
