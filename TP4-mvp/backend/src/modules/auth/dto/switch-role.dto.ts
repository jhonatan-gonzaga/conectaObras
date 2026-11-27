import { IsIn } from 'class-validator';
import { PUBLIC_REGISTRATION_ROLES, PublicRegistrationRole } from './register.dto';

export class SwitchRoleDto {
  @IsIn(PUBLIC_REGISTRATION_ROLES, {
    message: 'Perfil permitido apenas para cliente ou profissional.',
  })
  role: PublicRegistrationRole;
}
