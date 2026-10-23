import { Type } from 'class-transformer';
import { ArrayMinSize, IsArray, IsInt, IsOptional, IsString, MaxLength, Min, ValidateNested } from 'class-validator';

export class CreateStoreOrderItemDto {
  @IsString()
  @MaxLength(120)
  productId: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateStoreOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateStoreOrderItemDto)
  items: CreateStoreOrderItemDto[];

  @IsString()
  @MaxLength(500)
  address: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  observation?: string;
}
