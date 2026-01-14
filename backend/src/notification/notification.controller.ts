import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Post('test')
  async testEmail(@Body() body: { email: string }) {
    const testShipment = {
      id: 'test-id',
      trackingNumber: 'TEST123',
      originLocation: 'Test Origin',
      destinationLocation: 'Test Destination',
      currentStatus: 'PENDING' as any,
      currentLocation: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const success = await this.notificationService.sendShipmentCreatedEmail(
      body.email,
      testShipment,
    );

    return {
      success,
      message: success
        ? 'Test email sent successfully'
        : 'Failed to send test email',
    };
  }
}
