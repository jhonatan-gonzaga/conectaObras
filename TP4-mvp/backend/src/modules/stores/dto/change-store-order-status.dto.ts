import { StoreOrderStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeStoreOrderStatusDto {
  @IsEnum(StoreOrderStatus)
  status: StoreOrderStatus;
}
