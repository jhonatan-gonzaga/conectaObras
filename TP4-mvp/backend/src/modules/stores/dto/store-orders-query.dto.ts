import { StoreOrderStatus } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsInt, IsOptional, Max, Min } from 'class-validator';

const integerQuery = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class StoreOrdersQueryDto {
  @IsOptional()
  @IsIn(['OPEN', 'COMPLETED'])
  group?: 'OPEN' | 'COMPLETED';

  @IsOptional()
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(Math.floor(2147483647 / 100))
  page?: number;

  @IsOptional()
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

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
