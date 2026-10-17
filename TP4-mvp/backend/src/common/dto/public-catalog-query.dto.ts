import { Transform } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

export const trimQuery = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export const booleanQuery = ({ value }: { value: unknown }) => {
  const normalized = trimQuery({ value });
  return normalized === 'true' ? true : normalized === 'false' ? false : normalized;
};

const integerQuery = ({ value }: { value: unknown }) => {
  const normalized = trimQuery({ value });
  return typeof normalized === 'string' && /^\d+$/.test(normalized) ? Number(normalized) : normalized;
};

export class PublicCatalogQueryDto {
  @IsOptional()
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(Math.floor(Number.MAX_SAFE_INTEGER / 100))
  page?: number = 1;

  @IsOptional()
  @Transform(integerQuery)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Transform(trimQuery)
  @IsString()
  @MaxLength(120)
  q?: string;
}

