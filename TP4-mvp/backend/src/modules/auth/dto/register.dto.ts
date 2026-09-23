import { UserRole } from '@prisma/client';
import { IsEmail, IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export const PUBLIC_REGISTRATION_ROLES = [
  UserRole.CLIENTE,
  UserRole.PROFISSIONAL,
] as const;

export type PublicRegistrationRole = (typeof PUBLIC_REGISTRATION_ROLES)[number];

export class RegisterDto {
  @IsString()
  @MinLength(2, { message: 'O nome deve ter pelo menos 2 caracteres.' })
  name: string;

  @IsEmail({}, { message: 'Informe um e-mail valido.' })
  email: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsString()
  @MinLength(6, { message: 'A senha deve ter pelo menos 6 caracteres.' })
  password: string;

  @IsOptional()
  @IsIn(PUBLIC_REGISTRATION_ROLES, {
    message: 'Cadastro publico permitido apenas para cliente ou profissional.',
  })
  role?: PublicRegistrationRole;
}
