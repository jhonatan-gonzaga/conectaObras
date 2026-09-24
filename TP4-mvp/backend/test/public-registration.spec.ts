import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { UserRole } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { RegisterDto } from '../src/modules/auth/dto/register.dto';

const registration = (role?: UserRole) => plainToInstance(RegisterDto, {
  name: 'Usuario de teste',
  email: 'usuario@example.com',
  password: 'senha-segura',
  role,
});

describe('politica de cadastro publico', () => {
  for (const role of [undefined, UserRole.CLIENTE, UserRole.PROFISSIONAL]) {
    it(`permite o papel ${role ?? 'padrao CLIENTE'}`, async () => {
      assert.equal((await validate(registration(role))).length, 0);
    });
  }

  for (const role of [UserRole.LOJISTA, UserRole.SUPORTE]) {
    it(`proibe o papel privilegiado ${role}`, async () => {
      const errors = await validate(registration(role));
      assert.equal(errors.some((error) => error.property === 'role'), true);
    });
  }
});
