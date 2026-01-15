import { Module } from '@nestjs/common';
import { MovementService } from './movement.service';
import { MovementController } from './movement.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { PricingModule } from '../pricing/pricing.module';

@Module({
  imports: [WebsocketModule, PricingModule],
  controllers: [MovementController],
  providers: [MovementService],
  exports: [MovementService],
})
export class MovementModule {}
