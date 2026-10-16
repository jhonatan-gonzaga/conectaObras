import { IsBoolean, IsISO8601, IsNumber, IsOptional, IsString, Matches, Max, Min } from 'class-validator';

const utcTimestamp = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

export class CreatePromotionRequestDto {
  @IsString()
  productId: string;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  promotionalPrice?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99.99)
  discountPercent?: number | null;

  @IsISO8601({ strict: true })
  @Matches(utcTimestamp)
  startAt: string;

  @IsISO8601({ strict: true })
  @Matches(utcTimestamp)
  endAt: string;
}

export class UpdatePromotionRequestDto {
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  promotionalPrice?: number | null;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99.99)
  discountPercent?: number | null;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(utcTimestamp)
  startAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  @Matches(utcTimestamp)
  endAt?: string;
}

export class PromotionEnabledRequestDto {
  @IsBoolean()
  enabled: boolean;
}
