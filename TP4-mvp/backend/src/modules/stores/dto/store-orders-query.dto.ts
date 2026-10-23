import { StoreOrderStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional } from 'class-validator';

export class StoreOrdersQueryDto {
  @IsOptional()
  @IsEnum(StoreOrderStatus)
  status?: StoreOrderStatus;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;
}
