import { StoreStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeStoreStatusDto {
  @IsEnum(StoreStatus)
  status: StoreStatus;
}
