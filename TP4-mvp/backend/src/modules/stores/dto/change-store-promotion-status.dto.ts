import { IsIn } from 'class-validator';

export class ChangeStorePromotionStatusDto {
  @IsIn(['ACTIVE', 'CANCELED'])
  status: 'ACTIVE' | 'CANCELED';
}
