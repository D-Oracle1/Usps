import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateTrackingEventDto {
  @IsString()
  shipmentId: string;

  @IsString()
  status: string;

  @IsString()
  description: string;

  @IsString()
  location: string;

  @IsOptional()
  @IsDateString()
  eventTime?: Date;
}
