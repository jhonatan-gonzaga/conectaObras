import { SupportTicketStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSupportStatusDto {
  @IsEnum(SupportTicketStatus)
  status: SupportTicketStatus;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
