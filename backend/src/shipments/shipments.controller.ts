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

@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipmentsService: ShipmentsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  create(@Body() createShipmentDto: CreateShipmentDto) {
    return this.shipmentsService.create(createShipmentDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.shipmentsService.findAll(
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 20,
    );
  }

  @Get('statistics')
  @UseGuards(JwtAuthGuard)
  getStatistics() {
    return this.shipmentsService.getStatistics();
  }

  @Get('tracking/:trackingNumber')
  findByTrackingNumber(@Param('trackingNumber') trackingNumber: string) {
    return this.shipmentsService.findByTrackingNumber(trackingNumber);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  findOne(@Param('id') id: string) {
    return this.shipmentsService.findOne(id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard)
  update(@Param('id') id: string, @Body() updateShipmentDto: UpdateShipmentDto) {
    return this.shipmentsService.update(id, updateShipmentDto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  remove(@Param('id') id: string) {
    return this.shipmentsService.remove(id);
  }

  @Post('bulk/update-status')
  @UseGuards(JwtAuthGuard)
  bulkUpdateStatus(@Body() body: { shipmentIds: string[]; status: string }) {
    return this.shipmentsService.bulkUpdateStatus(body.shipmentIds, body.status);
  }

  @Post('bulk/delete')
  @UseGuards(JwtAuthGuard)
  bulkDelete(@Body() body: { shipmentIds: string[] }) {
    return this.shipmentsService.bulkDelete(body.shipmentIds);
  }

  @Get('export')
  @UseGuards(JwtAuthGuard)
  exportShipments() {
    return this.shipmentsService.exportShipments();
  }
}
