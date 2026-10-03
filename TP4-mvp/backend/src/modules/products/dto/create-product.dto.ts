import { IsInt, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, Min } from 'class-validator';

export const PRICE_PATTERN = /^(0|[1-9]\d{0,7})(\.\d{1,2})?$/;

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  categoryId: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsString()
  @Matches(PRICE_PATTERN, { message: 'Preco deve ter ate oito digitos inteiros e duas casas decimais.' })
  price: string;

  @IsInt()
  @Min(0)
  stock: number;
}
