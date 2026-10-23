import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsDefined, IsInt, IsOptional, IsString, Matches, MaxLength, Min, ValidateNested } from 'class-validator';
import { StoreOrderAddressDto } from './create-store-order.dto';

export class CreateClientStoreOrderItemDto {
  @IsString()
  @Matches(/\S/, { message: 'O produto e obrigatorio.' })
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
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
}
