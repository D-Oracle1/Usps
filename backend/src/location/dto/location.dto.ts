import { IsString, IsNumber, IsOptional, IsBoolean } from 'class-validator';

export class RecordLocationDto {
  @IsString()
  shipmentId: string;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsNumber()
  speed?: number;

  @IsOptional()
  @IsNumber()
  heading?: number;

  @IsOptional()
  @IsBoolean()
  forceUpdate?: boolean;

  @IsOptional()
  @IsString()
  addressLabel?: string;
}
