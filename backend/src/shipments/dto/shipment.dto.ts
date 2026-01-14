import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsEmail,
} from 'class-validator';

export class CreateShipmentDto {
  @IsString()
  trackingNumber: string;

  @IsString()
  originLocation: string;

  @IsString()
  destinationLocation: string;

  @IsOptional()
  @IsEnum([
    'PENDING',
    'PICKED_UP',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED',
    'CANCELLED',
  ])
  currentStatus?: string;

  // Package details
  @IsOptional()
  @IsString()
  goodsDescription?: string;

  @IsOptional()
  @IsNumber()
  packageWeight?: number;

  @IsOptional()
  @IsString()
  packageDimensions?: string;

  @IsOptional()
  @IsNumber()
  declaredValue?: number;

  @IsOptional()
  @IsString()
  serviceType?: string;

  // Sender info
  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderPhone?: string;

  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  // Recipient info
  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  // Special instructions
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}

export class UpdateShipmentDto {
  @IsOptional()
  @IsString()
  originLocation?: string;

  @IsOptional()
  @IsString()
  destinationLocation?: string;

  @IsOptional()
  @IsEnum([
    'PENDING',
    'PICKED_UP',
    'IN_TRANSIT',
    'OUT_FOR_DELIVERY',
    'DELIVERED',
    'FAILED',
    'CANCELLED',
  ])
  currentStatus?: string;

  @IsOptional()
  @IsString()
  currentLocation?: string;

  // Package details
  @IsOptional()
  @IsString()
  goodsDescription?: string;

  @IsOptional()
  @IsNumber()
  packageWeight?: number;

  @IsOptional()
  @IsString()
  packageDimensions?: string;

  @IsOptional()
  @IsNumber()
  declaredValue?: number;

  @IsOptional()
  @IsString()
  serviceType?: string;

  // Sender info
  @IsOptional()
  @IsString()
  senderName?: string;

  @IsOptional()
  @IsString()
  senderPhone?: string;

  @IsOptional()
  @IsEmail()
  senderEmail?: string;

  // Recipient info
  @IsOptional()
  @IsString()
  recipientName?: string;

  @IsOptional()
  @IsString()
  recipientPhone?: string;

  @IsOptional()
  @IsEmail()
  recipientEmail?: string;

  // Special instructions
  @IsOptional()
  @IsString()
  specialInstructions?: string;
}
