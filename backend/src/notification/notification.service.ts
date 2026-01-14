import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import type { Shipment, TrackingEvent } from '@prisma/client';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private configService: ConfigService) {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailHost = this.configService.get('EMAIL_HOST');
    const emailPort = this.configService.get('EMAIL_PORT');
    const emailUser = this.configService.get('EMAIL_USER');
    const emailPassword = this.configService.get('EMAIL_PASSWORD');

    if (!emailHost || !emailUser || !emailPassword) {
      this.logger.warn('Email configuration missing. Email notifications disabled.');
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: emailHost,
      port: parseInt(emailPort || '587'),
      secure: emailPort === '465',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    });

    this.logger.log('Email transporter initialized');
  }

  async sendShipmentCreatedEmail(
    recipientEmail: string,
    shipment: Shipment,
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn('Email transporter not initialized');
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_FROM') || 'noreply@courier.com',
        to: recipientEmail,
        subject: `Shipment Created - ${shipment.trackingNumber}`,
        html: `
          <h2>New Shipment Created</h2>
          <p>Your shipment has been successfully created.</p>
          <ul>
            <li><strong>Tracking Number:</strong> ${shipment.trackingNumber}</li>
            <li><strong>Origin:</strong> ${shipment.originLocation}</li>
            <li><strong>Destination:</strong> ${shipment.destinationLocation}</li>
            <li><strong>Status:</strong> ${shipment.currentStatus}</li>
          </ul>
          <p>Track your shipment at: <a href="${this.configService.get('FRONTEND_URL')}/track">Track Shipment</a></p>
        `,
      });

      this.logger.log(`Shipment created email sent to ${recipientEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return false;
    }
  }

  async sendStatusUpdateEmail(
    recipientEmail: string,
    shipment: Shipment,
    event: TrackingEvent,
  ): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_FROM') || 'noreply@courier.com',
        to: recipientEmail,
        subject: `Status Update - ${shipment.trackingNumber}`,
        html: `
          <h2>Shipment Status Update</h2>
          <p><strong>Tracking Number:</strong> ${shipment.trackingNumber}</p>
          <p><strong>New Status:</strong> ${event.status}</p>
          <p><strong>Description:</strong> ${event.description}</p>
          <p><strong>Location:</strong> ${event.location}</p>
          <p>Track your shipment at: <a href="${this.configService.get('FRONTEND_URL')}/track">Track Shipment</a></p>
        `,
      });

      this.logger.log(`Status update email sent to ${recipientEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return false;
    }
  }

  async sendDeliveredEmail(
    recipientEmail: string,
    shipment: Shipment,
  ): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_FROM') || 'noreply@courier.com',
        to: recipientEmail,
        subject: `Delivered - ${shipment.trackingNumber}`,
        html: `
          <h2>Your Shipment Has Been Delivered!</h2>
          <p>Your shipment has been successfully delivered.</p>
          <ul>
            <li><strong>Tracking Number:</strong> ${shipment.trackingNumber}</li>
            <li><strong>Destination:</strong> ${shipment.destinationLocation}</li>
          </ul>
          <p>Thank you for using our courier service!</p>
        `,
      });

      this.logger.log(`Delivery email sent to ${recipientEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return false;
    }
  }

  async sendBulkStatusEmail(
    recipientEmail: string,
    results: { success: number; failed: number; total: number },
  ): Promise<boolean> {
    if (!this.transporter) {
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.configService.get('EMAIL_FROM') || 'noreply@courier.com',
        to: recipientEmail,
        subject: 'Bulk Operation Completed',
        html: `
          <h2>Bulk Operation Results</h2>
          <p>Your bulk operation has been completed.</p>
          <ul>
            <li><strong>Total:</strong> ${results.total}</li>
            <li><strong>Success:</strong> ${results.success}</li>
            <li><strong>Failed:</strong> ${results.failed}</li>
          </ul>
        `,
      });

      this.logger.log(`Bulk operation email sent to ${recipientEmail}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to send email: ${error.message}`);
      return false;
    }
  }
}
