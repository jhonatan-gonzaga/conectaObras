import { IsDateString, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpsertDeliveryDto {
  @IsOptional()
  @IsString()
  @MaxLength(191)
  trackingCode?: string;

  @IsOptional()
  @IsString()
  @MaxLength(191)
  carrier?: string;

  @IsOptional()
  @IsDateString()
  estimatedDate?: string;
}
