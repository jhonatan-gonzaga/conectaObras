import { IsBoolean } from 'class-validator';

export class UpdateStorePromotionEnabledDto {
  @IsBoolean()
  enabled: boolean;
}
