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
  BadRequestException,
  UnauthorizedException,
  HttpException,
  HttpStatus,
  Logger,
  Request,
} from '@nestjs/common';
import { ShipmentsService } from './shipments.service';
import { CreateShipmentDto, UpdateShipmentDto } from './dto/shipment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard, Roles } from '../auth/guards/roles.guard';

@Controller('shipments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ShipmentsController {
  private readonly logger = new Logger(ShipmentsController.name);

  constructor(private readonly shipmentsService: ShipmentsService) {}

  /**
   * Safely parse pagination parameters with validation
   */
  private parsePagination(
    pageStr?: string,
    limitStr?: string,
  ): { page: number; limit: number } {
    let page = 1;
    let limit = 20;

    if (pageStr !== undefined && pageStr !== null && pageStr !== '') {
      const parsed = parseInt(pageStr, 10);
      if (isNaN(parsed) || parsed < 1) {
        throw new BadRequestException(
          `Invalid page parameter: "${pageStr}". Must be a positive integer.`,
        );
      }
      page = parsed;
    }

    if (limitStr !== undefined && limitStr !== null && limitStr !== '') {
      const parsed = parseInt(limitStr, 10);
      if (isNaN(parsed) || parsed < 1 || parsed > 100) {
        throw new BadRequestException(
          `Invalid limit parameter: "${limitStr}". Must be between 1 and 100.`,
        );
      }
      limit = parsed;
    }

    return { page, limit };
  }

  /**
   * Validate that req.user exists and has required fields
   */
  private validateAuth(req: any, context: string): void {
    if (!req?.user) {
      this.logger.warn(`Unauthenticated request to ${context}`);
      throw new UnauthorizedException('Authentication required');
    }
    if (!req.user.userId && !req.user.sub) {
      this.logger.warn(`Invalid user token in ${context}: missing userId`);
      throw new UnauthorizedException('Invalid authentication token');
    }
  }

  @Post()
  @Roles('ADMIN', 'SUPER_ADMIN')
  async create(@Request() req, @Body() createShipmentDto: CreateShipmentDto) {
    this.validateAuth(req, 'POST /shipments');
    this.logger.log(`Creating shipment: ${JSON.stringify({ trackingNumber: createShipmentDto.trackingNumber })}`);

    try {
      const result = await this.shipmentsService.create(createShipmentDto);
      this.logger.log(`Shipment created: ${result.id}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to create shipment: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to create shipment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get()
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async findAll(
    @Request() req,
    @Query('page') pageStr?: string,
    @Query('limit') limitStr?: string,
  ) {
    this.validateAuth(req, 'GET /shipments');

    const { page, limit } = this.parsePagination(pageStr, limitStr);

    this.logger.log(`Fetching shipments: page=${page}, limit=${limit}, user=${req.user?.userId || req.user?.sub}`);

    try {
      const result = await this.shipmentsService.findAll(page, limit);
      this.logger.log(`Found ${result.data.length} shipments (total: ${result.meta.total})`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch shipments: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch shipments',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Static routes MUST come before parameterized routes
  @Get('statistics')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async getStatistics(@Request() req) {
    this.validateAuth(req, 'GET /shipments/statistics');
    this.logger.log('Fetching shipment statistics');

    try {
      const result = await this.shipmentsService.getStatistics();
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch statistics: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch statistics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('export')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async exportShipments(@Request() req) {
    this.validateAuth(req, 'GET /shipments/export');
    this.logger.log('Exporting shipments');

    try {
      const result = await this.shipmentsService.exportShipments();
      return result;
    } catch (error) {
      this.logger.error(`Failed to export shipments: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to export shipments',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('tracking/:trackingNumber')
  async findByTrackingNumber(
    @Request() req,
    @Param('trackingNumber') trackingNumber: string,
  ) {
    if (!trackingNumber || trackingNumber.trim() === '') {
      throw new BadRequestException('Tracking number is required');
    }

    this.logger.log(`Finding shipment by tracking: ${trackingNumber}`);

    try {
      const result = await this.shipmentsService.findByTrackingNumber(trackingNumber.trim());
      return result;
    } catch (error) {
      this.logger.error(`Failed to find shipment ${trackingNumber}: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to find shipment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bulk/update-status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async bulkUpdateStatus(
    @Request() req,
    @Body() body: { shipmentIds: string[]; status: string },
  ) {
    this.validateAuth(req, 'POST /shipments/bulk/update-status');

    if (!body?.shipmentIds || !Array.isArray(body.shipmentIds) || body.shipmentIds.length === 0) {
      throw new BadRequestException('shipmentIds must be a non-empty array');
    }
    if (!body?.status || typeof body.status !== 'string') {
      throw new BadRequestException('status is required');
    }

    this.logger.log(`Bulk updating ${body.shipmentIds.length} shipments to status: ${body.status}`);

    try {
      const result = await this.shipmentsService.bulkUpdateStatus(body.shipmentIds, body.status);
      return result;
    } catch (error) {
      this.logger.error(`Failed to bulk update status: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update shipments',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('bulk/delete')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async bulkDelete(@Request() req, @Body() body: { shipmentIds: string[] }) {
    this.validateAuth(req, 'POST /shipments/bulk/delete');

    if (!body?.shipmentIds || !Array.isArray(body.shipmentIds) || body.shipmentIds.length === 0) {
      throw new BadRequestException('shipmentIds must be a non-empty array');
    }

    this.logger.log(`Bulk deleting ${body.shipmentIds.length} shipments`);

    try {
      const result = await this.shipmentsService.bulkDelete(body.shipmentIds);
      return result;
    } catch (error) {
      this.logger.error(`Failed to bulk delete: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete shipments',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  // Parameterized routes come AFTER all static routes
  @Get(':id')
  @Roles('USER', 'ADMIN', 'SUPER_ADMIN')
  async findOne(@Request() req, @Param('id') id: string) {
    this.validateAuth(req, `GET /shipments/${id}`);

    if (!id || id.trim() === '') {
      throw new BadRequestException('Shipment ID is required');
    }

    this.logger.log(`Fetching shipment: ${id}`);

    try {
      const result = await this.shipmentsService.findOne(id);
      return result;
    } catch (error) {
      this.logger.error(`Failed to fetch shipment ${id}: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to fetch shipment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async update(
    @Request() req,
    @Param('id') id: string,
    @Body() updateShipmentDto: UpdateShipmentDto,
  ) {
    this.validateAuth(req, `PATCH /shipments/${id}`);

    if (!id || id.trim() === '') {
      throw new BadRequestException('Shipment ID is required');
    }

    this.logger.log(`Updating shipment: ${id}`);

    try {
      const result = await this.shipmentsService.update(id, updateShipmentDto);
      this.logger.log(`Shipment updated: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to update shipment ${id}: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to update shipment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete(':id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async remove(@Request() req, @Param('id') id: string) {
    this.validateAuth(req, `DELETE /shipments/${id}`);

    if (!id || id.trim() === '') {
      throw new BadRequestException('Shipment ID is required');
    }

    this.logger.log(`Deleting shipment: ${id}`);

    try {
      const result = await this.shipmentsService.remove(id);
      this.logger.log(`Shipment deleted: ${id}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to delete shipment ${id}: ${error.message}`, error.stack);
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        'Failed to delete shipment',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
