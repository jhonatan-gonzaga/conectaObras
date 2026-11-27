import { ProductStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeProductStatusDto {
  @IsEnum(ProductStatus)
  status: ProductStatus;
}
