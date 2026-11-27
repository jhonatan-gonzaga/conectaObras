import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';

function contextFor(role?: UserRole) {
  class TestController {}
  const handler = () => undefined;
  const context = {
    getHandler: () => handler,
    getClass: () => TestController,
    switchToHttp: () => ({
      getRequest: () => role
        ? { user: { id: 'user-1', email: 'user@example.com', role } }
        : {},
    }),
  } as unknown as ExecutionContext;

  return { context, handler, TestController };
}

describe('RolesGuard', () => {
  it('permite rota sem metadado de papeis', () => {
    const guard = new RolesGuard({
      getAllAndOverride: () => undefined,
    } as unknown as Reflector);

    assert.equal(guard.canActivate(contextFor().context), true);
  });

  it('permite o papel exigido no handler', () => {
    const guard = new RolesGuard({
      getAllAndOverride: () => [UserRole.LOJISTA],
    } as unknown as Reflector);

    assert.equal(guard.canActivate(contextFor(UserRole.LOJISTA).context), true);
  });

  for (const role of [UserRole.CLIENTE, UserRole.PROFISSIONAL, UserRole.SUPORTE]) {
    it(`bloqueia o papel ${role} em rota de lojista`, () => {
      const guard = new RolesGuard({
        getAllAndOverride: () => [UserRole.LOJISTA],
      } as unknown as Reflector);

      assert.throws(
        () => guard.canActivate(contextFor(role).context),
        ForbiddenException,
      );
    });
  }

  it('bloqueia quando o JwtAuthGuard nao preencheu o usuario', () => {
    const guard = new RolesGuard({
      getAllAndOverride: () => [UserRole.LOJISTA],
    } as unknown as Reflector);

    assert.throws(
      () => guard.canActivate(contextFor().context),
      ForbiddenException,
    );
  });
});
