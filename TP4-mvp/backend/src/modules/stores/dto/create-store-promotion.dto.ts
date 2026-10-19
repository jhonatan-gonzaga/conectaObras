import { PromotionDiscountType } from '@prisma/client';
import { IsEnum, IsISO8601, IsNumber, IsString, Matches, Max, MaxLength, Min, MinLength } from 'class-validator';

export class CreateStorePromotionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsEnum(PromotionDiscountType)
  discountType: PromotionDiscountType;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99999999.99)
  discountValue: number;

  @IsString()
  @MinLength(1)
  productId: string;

  @IsEnum({ DRAFT: 'DRAFT', ACTIVE: 'ACTIVE' })
  status: 'DRAFT' | 'ACTIVE';

  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  startsAt: string;

  @IsISO8601({ strict: true })
  @Matches(/(Z|[+-]\d{2}:\d{2})$/)
  endsAt: string;
}
