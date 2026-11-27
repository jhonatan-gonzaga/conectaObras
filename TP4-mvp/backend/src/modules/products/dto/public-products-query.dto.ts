import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional, IsString, Matches, MaxLength } from 'class-validator';
import { booleanQuery, PublicCatalogQueryDto, trimQuery } from '../../../common/dto/public-catalog-query.dto';

export class PublicProductsQueryDto extends PublicCatalogQueryDto {
  @IsOptional()
  @Transform(trimQuery)
  @IsString()
  @MaxLength(191)
  storeId?: string;

  @IsOptional()
  @Transform(trimQuery)
  @IsString()
  @MaxLength(191)
  categoryId?: string;

  @IsOptional()
  @Transform(trimQuery)
  @Matches(/^\d{1,8}(\.\d{1,2})?$/, { message: 'minPrice deve ser um preco nao negativo com ate duas casas decimais.' })
  minPrice?: string;

  @IsOptional()
  @Transform(trimQuery)
  @Matches(/^\d{1,8}(\.\d{1,2})?$/, { message: 'maxPrice deve ser um preco nao negativo com ate duas casas decimais.' })
  maxPrice?: string;

  @IsOptional()
  @Transform(booleanQuery)
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @Transform(booleanQuery)
  @IsBoolean()
  onPromotion?: boolean;
}
