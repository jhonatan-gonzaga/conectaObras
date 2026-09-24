import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { UserRole, WeekDay } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { UpsertMyStoreDto } from '../src/modules/stores/dto/upsert-my-store.dto';
import { StoresService } from '../src/modules/stores/stores.service';

describe('StoresService', () => {
  it('consulta a loja exclusivamente pelo userId autenticado', async () => {
    let receivedArguments: unknown;
    const prisma = {
      storeProfile: {
        findUnique: async (args: unknown) => {
          receivedArguments = args;
          return { id: 'store-a' };
        },
      },
    } as unknown as PrismaService;
    const service = new StoresService(prisma);

    await service.findMine('lojista-a');

    assert.deepEqual(
      (receivedArguments as { where: unknown }).where,
      { ownerId: 'lojista-a' },
    );
  });

  it('copia apenas campos permitidos e fixa ownerId com o userId autenticado', async () => {
    let storeUpsertArguments: Record<string, unknown> | undefined;
    let addressUpsertArguments: Record<string, unknown> | undefined;
    let openingHoursArguments: Record<string, unknown> | undefined;

    const transaction = {
      storeProfile: {
        upsert: async (args: Record<string, unknown>) => {
          storeUpsertArguments = args;
          return { id: 'store-a' };
        },
        findUniqueOrThrow: async () => ({ id: 'store-a', name: 'Loja A' }),
      },
      storeAddress: {
        upsert: async (args: Record<string, unknown>) => {
          addressUpsertArguments = args;
          return { id: 'address-a' };
        },
      },
      storeOpeningHour: {
        deleteMany: async () => ({ count: 0 }),
        createMany: async (args: Record<string, unknown>) => {
          openingHoursArguments = args;
          return { count: 1 };
        },
      },
    };
    const prisma = {
      $transaction: async (
        callback: (client: typeof transaction) => Promise<unknown>,
      ) => callback(transaction),
    } as unknown as PrismaService;
    const service = new StoresService(prisma);
    const maliciousInput = {
      name: 'Loja A',
      cnpj: '12.345.678/0001-90',
      ownerId: 'lojista-b',
      storeId: 'store-b',
      role: UserRole.SUPORTE,
      address: {
        city: 'Manaus',
        state: 'am',
        zipCode: '69000-000',
        ownerId: 'lojista-b',
      },
      openingHours: [{
        dayOfWeek: WeekDay.MONDAY,
        openingTime: '08:00',
        closingTime: '18:00',
        closed: false,
        storeId: 'store-b',
      }],
    } as unknown as UpsertMyStoreDto;

    await service.upsertMine('lojista-a', maliciousInput);

    const storeCreate = storeUpsertArguments?.create as Record<string, unknown>;
    const storeUpdate = storeUpsertArguments?.update as Record<string, unknown>;
    const addressCreate = addressUpsertArguments?.create as Record<string, unknown>;
    const openingHour = (
      openingHoursArguments?.data as Array<Record<string, unknown>>
    )[0];

    assert.equal(storeCreate.ownerId, 'lojista-a');
    assert.equal(storeCreate.cnpj, '12345678000190');
    assert.equal(storeCreate.storeId, undefined);
    assert.equal(storeCreate.role, undefined);
    assert.equal(storeUpdate.ownerId, undefined);
    assert.equal(addressCreate.storeId, 'store-a');
    assert.equal(addressCreate.ownerId, undefined);
    assert.equal(addressCreate.state, 'AM');
    assert.equal(addressCreate.zipCode, '69000000');
    assert.equal(openingHour.storeId, 'store-a');
    assert.equal(openingHour.ownerId, undefined);
  });
});
