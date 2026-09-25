import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { PrismaService } from '../src/prisma/prisma.service';
import { UpsertMyStoreDto } from '../src/modules/stores/dto/upsert-my-store.dto';
import { PrismaStoreRepository } from '../src/modules/stores/infrastructure/prisma-store.repository';

describe('PrismaStoreRepository', () => {
  it('cria o perfil, endereco e horarios na mesma transacao', async () => {
    const calls: string[] = [];
    const transaction = {
      storeProfile: {
        upsert: async (args: any) => {
          calls.push('profile');
          assert.equal(args.where.ownerId, 'owner-a');
          assert.equal(args.create.ownerId, 'owner-a');
          return { id: 'store-a' };
        },
        findUniqueOrThrow: async () => ({ id: 'store-a', ownerId: 'owner-a' }),
      },
      storeAddress: {
        upsert: async (args: any) => {
          calls.push('address');
          assert.equal(args.create.storeId, 'store-a');
          assert.equal(args.create.state, 'AM');
        },
      },
      storeOpeningHour: {
        deleteMany: async () => { calls.push('delete-hours'); },
        createMany: async (args: any) => {
          calls.push('hours');
          assert.equal(args.data[0].storeId, 'store-a');
        },
      },
    };
    const prisma = {
      $transaction: async (callback: (client: typeof transaction) => Promise<unknown>) => {
        calls.push('begin');
        const result = await callback(transaction);
        calls.push('commit');
        return result;
      },
    } as unknown as PrismaService;

    await new PrismaStoreRepository(prisma).upsertProfile('owner-a', {
      name: 'Loja A',
      address: { city: 'Manaus', state: 'am' },
      openingHours: [{ dayOfWeek: 'MONDAY' as any, openingTime: '08:00', closingTime: '18:00', closed: false }],
    });

    assert.deepEqual(calls, ['begin', 'profile', 'address', 'delete-hours', 'hours', 'commit']);
  });

  it('propaga falha do endereco e deixa a reversao a cargo da transacao Prisma', async () => {
    const state = {
      profile: { id: 'existing-store', name: 'Nome anterior' },
      address: { city: 'Itacoatiara' },
      hours: [{ dayOfWeek: 'MONDAY', openingTime: '09:00', closingTime: '17:00' }],
    };
    const originalState = structuredClone(state);
    const transaction = {
      storeProfile: {
        upsert: async () => {
          state.profile = { id: 'store-a', name: 'Nome parcial' };
          return { id: 'store-a' };
        },
        findUniqueOrThrow: async () => state.profile,
      },
      storeAddress: {
        upsert: async () => {
          state.address = { city: 'Manaus' };
          throw new Error('address constraint');
        },
      },
      storeOpeningHour: {
        deleteMany: async () => { state.hours = []; },
        createMany: async () => undefined,
      },
    };
    const prisma = {
      $transaction: async (callback: (client: typeof transaction) => Promise<unknown>) => {
        try {
          return await callback(transaction);
        } catch (error) {
          Object.assign(state, originalState);
          throw error;
        }
      },
    } as unknown as PrismaService;

    await assert.rejects(
      new PrismaStoreRepository(prisma).upsertProfile('owner-a', {
        name: 'Loja A',
        address: { city: 'Manaus' },
      } as UpsertMyStoreDto),
      /address constraint/,
    );
    assert.deepEqual(state, originalState);
  });
});
