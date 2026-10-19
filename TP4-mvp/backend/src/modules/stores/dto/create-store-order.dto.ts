
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
  @Matches(/\S/, { message: 'O nome do item nao pode ser vazio.' })
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
export class StoreOrderAddressDto {
  @IsString()
  @MaxLength(120)
  street: string;

  @IsString()
  @MaxLength(20)
  number: string;

  @IsString()
  @MaxLength(120)
  neighborhood: string;

  @IsString()
  @MaxLength(120)
  city: string;

  @IsString()
  @MaxLength(2)
  state: string;

  @IsString()
  @Matches(/^\d{8}$/)
  zipCode: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  complement?: string;
}
export class CreateStoreOrderDto {
  @IsOptional()
  @IsString()
  customerId?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStoreOrderItemDto)
  items: CreateStoreOrderItemDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => StoreOrderAddressDto)
  address?: StoreOrderAddressDto;
}
