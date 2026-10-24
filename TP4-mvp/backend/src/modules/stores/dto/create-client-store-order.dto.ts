import { Type } from 'class-transformer';
import { Allow, ArrayMinSize, IsArray, IsDefined, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, ValidateNested } from 'class-validator';
import { StoreOrderAddressDto } from './create-store-order.dto';

export class CreateClientStoreOrderItemDto {
  @IsString()
  @Matches(/\S/, { message: 'O produto e obrigatorio.' })
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(2147483647)
  quantity: number;

  // Legacy client-supplied prices are accepted for compatibility and ignored.
  @Allow()
  unitPrice?: unknown;

  @Allow()
  price?: unknown;
}

export class CreateClientStoreOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateClientStoreOrderItemDto)
  items: CreateClientStoreOrderItemDto[];

  @IsDefined()
  @ValidateNested()
  @Type(() => StoreOrderAddressDto)
  address: StoreOrderAddressDto;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;

  @Allow()
  unitPrice?: unknown;

  @Allow()
  price?: unknown;

  @Allow()
  total?: unknown;
}
