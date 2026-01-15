import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('pricing')
@UseGuards(JwtAuthGuard)
export class PricingController {
  constructor(private pricingService: PricingService) {}

  @Get('fees/:shipmentId')
  getFeeHistory(@Param('shipmentId') shipmentId: string) {
    return this.pricingService.getAddressChangeFeeHistory(shipmentId);
  }
}
