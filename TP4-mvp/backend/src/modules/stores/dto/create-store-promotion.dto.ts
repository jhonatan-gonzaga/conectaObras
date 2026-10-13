import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export class CreateStorePromotionDto {
  @IsString()
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  promotionalPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99.99)
  discountPercent?: number;

  @Type(() => Date)
  @IsDate()
  startAt: Date;

  @Type(() => Date)
  @IsDate()
  endAt: Date;
}
