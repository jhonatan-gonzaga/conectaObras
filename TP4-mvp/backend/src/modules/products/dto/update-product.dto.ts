import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min, ValidateIf } from 'class-validator';
import { PRICE_PATTERN } from './create-product.dto';

export class UpdateProductDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(PRICE_PATTERN, { message: 'Preco deve ter ate oito digitos inteiros e duas casas decimais.' })
  price?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  stock?: number;
}
