import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { ProductRecord } from '../src/modules/products/application/product.repository';
import { PrismaProductRepository } from '../src/modules/products/infrastructure/prisma-product.repository';

function setup() {
  const initialDate = new Date('2026-01-01T00:00:00.000Z');
  const row = {
    id: 'product-a', storeId: 'store-a', categoryId: 'category', sku: null,
    name: 'Cimento', description: null, price: new Prisma.Decimal('49.90'), stock: 4,
    status: 'ACTIVE', lastPriceUpdateAt: initialDate, createdAt: initialDate,
    updatedAt: initialDate, images: [],
  };
  let current = { ...row };
  let transactionCount = 0;
  let failAudit = false;
  let tail = Promise.resolve();
  const events: any[] = [];
  const writes: any[] = [];
  const prisma = {
    product: {
      findFirst: async ({ where }: any) => {
        if (where.id !== current.id || where.storeId !== current.storeId ||
          where.status !== current.status || where.updatedAt.getTime() !== current.updatedAt.getTime() ||
          !where.price.eq(current.price) || where.stock !== current.stock) return null;
        return { ...current };
      },
    },
    $transaction: async (callback: (tx: any) => Promise<unknown>) => {
      transactionCount++;
      const previous = tail;
      let release!: () => void;
      tail = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const before = { ...current };
      const eventCount = events.length;
      try {
        const result = await callback({
          product: {
            updateMany: async ({ where, data }: any) => {
              writes.push({ where, data });
              if (where.id !== current.id || where.storeId !== current.storeId ||
                where.status !== current.status || where.updatedAt.getTime() !== current.updatedAt.getTime() ||
                !where.price.eq(current.price) || where.stock !== current.stock) return { count: 0 };
              current = {
                ...current,
                price: data.price ?? current.price,
                stock: data.stock ?? current.stock,
                lastPriceUpdateAt: data.lastPriceUpdateAt ?? current.lastPriceUpdateAt,
                updatedAt: new Date(current.updatedAt.getTime() + 1),
              };
              return { count: 1 };
            },
            findUniqueOrThrow: async () => ({ ...current }),
          },
          productInventoryEvent: {
            create: async ({ data }: any) => {
              if (failAudit) throw new Error('audit unavailable');
              events.push(data);
            },
          },
        });
        release();
        return result;
      } catch (error) {
        current = before;
        events.length = eventCount;
        release();
        throw error;
      }
    },
  };
  const repository = new PrismaProductRepository(prisma as unknown as PrismaService);
  const snapshot = (): ProductRecord => ({ ...current, price: current.price.toFixed(2), images: [] } as ProductRecord);
  return { repository, snapshot, events, writes, current: () => current,
    transactionCount: () => transactionCount, failAudit: () => { failAudit = true; } };
}

describe('Inventory persistence', () => {
  it('updates only changed fields and records audit metadata in the same transaction', async () => {
    const state = setup();
    const before = state.snapshot();
    const priced = await state.repository.updateInventory('store-a', 'owner-a', before, { price: '50.00' });
    assert.equal(priced?.price, '50.00');
    assert.equal(priced?.stock, 4);
    assert(state.current().lastPriceUpdateAt > before.lastPriceUpdateAt);
    assert.deepEqual(state.events, [{
      productId: 'product-a', storeId: 'store-a', actorId: 'owner-a', priceChanged: true, stockChanged: false,
    }]);
    assert.equal(state.writes[0].where.storeId, 'store-a');
    assert(state.writes[0].where.price.eq('49.90'));
    assert.equal(state.writes[0].where.stock, 4);
    assert.deepEqual(state.writes[0].where.updatedAt, before.updatedAt);
    assert.equal(state.writes[0].data.stock, undefined);

    const priceDate = state.current().lastPriceUpdateAt;
    const stocked = await state.repository.updateInventory('store-a', 'owner-a', state.snapshot(), { stock: 0 });
    assert.equal(stocked?.stock, 0);
    assert.deepEqual(state.current().lastPriceUpdateAt, priceDate);
    assert.equal(state.writes[1].data.lastPriceUpdateAt, undefined);
    assert.deepEqual(state.events[1], {
      productId: 'product-a', storeId: 'store-a', actorId: 'owner-a', priceChanged: false, stockChanged: true,
    });
  });

  it('does not write or audit equal values', async () => {
    const state = setup();
    const same = await state.repository.updateInventory('store-a', 'owner-a', state.snapshot(), { price: '49.90', stock: 4 });
    assert.equal(same?.price, '49.90');
    assert.equal(state.transactionCount(), 0);
    assert.equal(state.events.length, 0);
    const old = state.snapshot();
    await state.repository.updateInventory('store-a', 'owner-a', old, { stock: 2 });
    assert.equal(await state.repository.updateInventory('store-a', 'owner-a', old, { stock: 4 }), null);
    assert.equal(state.current().stock, 2);
  });

  it('rejects stale concurrent writes and writes one audit event', async () => {
    const state = setup();
    const original = state.snapshot();
    const [first, second] = await Promise.all([
      state.repository.updateInventory('store-a', 'owner-a', original, { stock: 0 }),
      state.repository.updateInventory('store-a', 'owner-a', original, { stock: 2 }),
    ]);
    assert.equal(first?.stock, 0);
    assert.equal(second, null);
    assert.equal(state.current().stock, 0);
    assert.equal(state.events.length, 1);
  });

  it('rejects another store, archived product and invalid values', async () => {
    const state = setup();
    const original = state.snapshot();
    assert.equal(await state.repository.updateInventory('store-b', 'owner-b', original, { stock: 0 }), null);
    assert.equal(await state.repository.updateInventory('store-a', 'owner-a', { ...original, status: 'ARCHIVED' }, { stock: 0 }), null);
    for (const price of ['0', '-1', 'abc', '1.001']) {
      await assert.rejects(state.repository.updateInventory('store-a', 'owner-a', original, { price }), RangeError);
    }
    for (const stock of [-1, 1.5, 2_147_483_648, Number.NaN]) {
      await assert.rejects(state.repository.updateInventory('store-a', 'owner-a', original, { stock }), RangeError);
    }
    assert.equal(state.current().stock, 4);
    assert.equal(state.events.length, 0);
  });

  it('rolls back product update when audit insert fails', async () => {
    const state = setup();
    state.failAudit();
    await assert.rejects(state.repository.updateInventory('store-a', 'owner-a', state.snapshot(), { stock: 0 }), /audit unavailable/);
    assert.equal(state.current().stock, 4);
    assert.equal(state.events.length, 0);
  });
});
