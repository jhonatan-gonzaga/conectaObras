
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateStoreOrderItemDto {
  @IsOptional()
  @IsString()
  productId?: string;

  @IsString()
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  sku?: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;

  @IsString()
  @Matches(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/)
  unitPrice: string;
}

export class CreateStoreOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStoreOrderItemDto)
  items: CreateStoreOrderItemDto[];
}
