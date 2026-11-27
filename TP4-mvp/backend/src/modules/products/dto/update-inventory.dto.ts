import { IsInt, IsString, Matches, Max, Min, ValidateIf } from 'class-validator';
import { MAX_PRODUCT_STOCK } from '../application/product.policy';
import { PRICE_PATTERN } from './create-product.dto';

export class UpdateInventoryDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(PRICE_PATTERN, { message: 'Preco deve ter ate oito digitos inteiros e duas casas decimais.' })
  price?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(MAX_PRODUCT_STOCK)
  stock?: number;
}
