import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { booleanQuery, PublicCatalogQueryDto, trimQuery } from '../../../common/dto/public-catalog-query.dto';

export class PublicStoresQueryDto extends PublicCatalogQueryDto {
  @IsOptional()
  @Transform(trimQuery)
  @IsString()
  @MaxLength(120)
  city?: string;

  @IsOptional()
  @Transform(trimQuery)
  @IsString()
  @MaxLength(120)
  neighborhood?: string;

  @IsOptional()
  @Transform(booleanQuery)
  @IsBoolean()
  openNow?: boolean;
}
