import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { UserRole, WeekDay } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { UpsertMyStoreDto } from '../src/modules/stores/dto/upsert-my-store.dto';
import { StoresService } from '../src/modules/stores/stores.service';
import { BadRequestException } from '@nestjs/common';

describe('StoresService', () => {
  for (const value of ['', '  ', null]) {
    it(`persiste CNPJ e CEP vazios como null: ${JSON.stringify(value)}`, async () => {
      let profile: any;
      let address: any;
      const transaction = {
        storeProfile: {
          upsert: async (args: any) => { profile = args.create; return { id: 'store' }; },
          findUniqueOrThrow: async () => ({ status: 'DRAFT' }),
        },
        storeAddress: { upsert: async (args: any) => { address = args.create; } },
      };
      const service = new StoresService({
        $transaction: async (callback: any) => callback(transaction),
      } as unknown as PrismaService);
      await service.upsertMine('owner', { cnpj: value, address: { zipCode: value } } as UpsertMyStoreDto);
      assert.equal(profile.cnpj, null);
      assert.equal(address.zipCode, null);
    });
  }

  it('rejeita identificadores parciais mesmo em DRAFT', async () => {
    const service = new StoresService({
      $transaction: async (callback: any) => callback({ storeProfile: {
        upsert: async () => ({ id: 'store' }),
      }, storeAddress: { upsert: async () => undefined } }),
    } as unknown as PrismaService);
    await assert.rejects(service.upsertMine('owner', { cnpj: '123' }), BadRequestException);
    await assert.rejects(service.upsertMine('owner', { address: { zipCode: '123' } }), BadRequestException);
  });

  it('propaga cadastro incompleto antes de confirmar a transacao', async () => {
    let committed = false;
    const service = new StoresService({
      $transaction: async (callback: any) => {
        const result = await callback({ storeProfile: {
          upsert: async () => ({ id: 'store' }),
          findUniqueOrThrow: async () => ({
            status: 'ACTIVE', name: null, cnpj: null, phone: null, address: null, openingHours: [],
          }),
        } });
        committed = true;
        return result;
      },
    } as unknown as PrismaService);
    await assert.rejects(service.upsertMine('owner', { name: '' }), BadRequestException);
    assert.equal(committed, false);
  });

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
        findUniqueOrThrow: async () => ({ id: 'store-a', name: 'Loja A', status: 'DRAFT' }),
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
