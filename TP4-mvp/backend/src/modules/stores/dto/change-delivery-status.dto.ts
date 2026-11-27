import { DeliveryStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class ChangeDeliveryStatusDto {
  @IsEnum(DeliveryStatus)
  status: DeliveryStatus;
}
