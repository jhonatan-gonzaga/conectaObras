import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { trimQuery } from '../../../common/dto/public-catalog-query.dto';

const integerQuery = ({ value }: { value: unknown }) => {
  const normalized = trimQuery({ value });
  return typeof normalized === 'string' && /^\d+$/.test(normalized) ? Number(normalized) : normalized;
};

export class StoreReviewsQueryDto {
  @IsOptional()
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  // Keep Prisma's skip within the signed 32-bit range, even at limit=100.
  @Max(Math.floor(2147483647 / 100))
  page?: number = 1;

  @IsOptional()
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
