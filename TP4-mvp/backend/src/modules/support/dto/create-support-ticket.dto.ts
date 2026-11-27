import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;

export class CreateSupportTicketDto {
  @Transform(trim)
  @IsString()
  @MinLength(3, { message: 'Informe um assunto com pelo menos 3 caracteres.' })
  @MaxLength(120, { message: 'O assunto deve ter no maximo 120 caracteres.' })
  subject: string;

  @Transform(trim)
  @IsString()
  @MinLength(10, { message: 'Descreva sua mensagem com pelo menos 10 caracteres.' })
  @MaxLength(2000, { message: 'A mensagem deve ter no maximo 2000 caracteres.' })
  message: string;

  @Transform(trim)
  @IsOptional()
  @IsString()
  @MaxLength(80)
  context?: string;
}
