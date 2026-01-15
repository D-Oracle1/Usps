import { IsString, IsOptional } from 'class-validator';

export class CreateConversationDto {
  @IsOptional()
  @IsString()
  trackingNumber?: string;

  @IsOptional()
  @IsString()
  subject?: string;

  @IsString()
  initialMessage: string;
}
