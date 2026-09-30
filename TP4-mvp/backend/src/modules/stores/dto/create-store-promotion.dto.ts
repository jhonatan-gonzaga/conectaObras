import { StorePromotionStatus } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateStorePromotionDto {
  @IsString()
  @MaxLength(120)
  name: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(100)
  discountPct: number;

  @IsOptional()
  @IsString()
  productId?: string;

  @IsOptional()
  @IsEnum(StorePromotionStatus)
  status?: StorePromotionStatus;
}
