import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { StoreDashboardService } from '../src/modules/stores/store-dashboard.service';

test('store dashboard returns aggregated counts from the store and never reads paginated client lists', async () => {
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-1' }) },
    product: { count: async ({ where }: { where: { stock?: { lte: number } } }) => where.stock ? 2 : 8 },
    storePromotion: { count: async () => 3 },
    storeOrder: {
      groupBy: async () => [{ status: 'PENDING', _count: { _all: 4 } }, { status: 'READY', _count: { _all: 1 } }],
      findFirst: async () => ({ id: 'order-1', status: 'PENDING', total: '349.00', createdAt: new Date('2026-10-03T12:00:00.000Z'), items: [{ name: 'Produto A' }] }),
    },
    notification: { count: async () => 5 },
  };
  const service = new StoreDashboardService(prisma as never);
  const summary = await service.summary('owner-1');
  assert.deepEqual(summary, {
    hasStore: true,
    activeProducts: 8,
    lowStockProducts: 2,
    activePromotions: 3,
    ordersByStatus: { PENDING: 4, READY: 1 },
    unreadMessages: 5,
    latestOrder: { id: 'order-1', status: 'PENDING', total: '349.00', createdAt: new Date('2026-10-03T12:00:00.000Z'), itemName: 'Produto A' },
  });
});

test('store dashboard routes owner without a store to onboarding data', async () => {
  const prisma = { storeProfile: { findUnique: async () => null } };
  const summary = await new StoreDashboardService(prisma as never).summary('owner-1');
  assert.equal(summary.hasStore, false);
  assert.equal(summary.activeProducts, 0);
  assert.deepEqual(summary.ordersByStatus, {});
});

test('creates promotion only for a product owned by the authenticated store', async () => {
  let created: any;
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-1' }) },
    product: { findFirst: async () => null },
    storePromotion: { create: async (input: any) => { created = input; return input; } },
  };
  const service = new StoreDashboardService(prisma as never);
  await assert.rejects(() => service.createPromotion('owner-1', {
    productId: 'product-from-another-store', discountPercent: 10,
    startAt: new Date('2026-10-01T00:00:00.000Z'), endAt: new Date('2026-10-02T00:00:00.000Z'),
  }), BadRequestException);
  assert.equal(created, undefined);
});

test('creates promotions only for active products with stock and rejects overlap', async () => {
  const startAt = new Date(Date.now() + 60_000);
  const endAt = new Date(Date.now() + 86_400_000);
  const base = {
    storeProfile: { findUnique: async () => ({ id: 'store-1' }) },
    product: { findFirst: async () => ({ id: 'product-1', price: '100.00', status: 'ACTIVE', stock: 2 }) },
    storePromotion: { findMany: async () => [{ startAt: new Date(startAt.getTime() + 60_000), endAt }], create: async () => ({ id: 'created' }) },
  };
  const service = new StoreDashboardService(base as never);
  const dto = { productId: 'product-1', promotionalPrice: 80, startAt, endAt };
  await assert.rejects(() => service.createPromotion('owner-1', dto), /sobreposto/);

  const noStock = new StoreDashboardService({
    ...base,
    product: { findFirst: async () => ({ id: 'product-1', price: '100.00', status: 'ACTIVE', stock: 0 }) },
  } as never);
  await assert.rejects(() => noStock.createPromotion('owner-1', dto), /ativos e com estoque/);
});

test('updates a promotion without changing its product and persists normalized discount terms', async () => {
  let updateInput: any;
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-1' }) },
    storePromotion: {
      findFirst: async () => ({ id: 'promotion-1', storeId: 'store-1', productId: 'product-1' }),
      findMany: async () => [],
      update: async (input: any) => { updateInput = input; return input; },
    },
    product: { findFirst: async () => ({ id: 'product-1', price: '100.00', status: 'ACTIVE', stock: 4 }) },
  };
  const startAt = new Date(Date.now() + 60_000);
  const endAt = new Date(Date.now() + 86_400_000);
  await new StoreDashboardService(prisma as never).updatePromotion('owner-1', 'promotion-1', {
    productId: 'product-1', discountPercent: 15, startAt, endAt,
  });
  assert.equal(updateInput.where.id, 'promotion-1');
  assert.equal(updateInput.data.discountPercent.toString(), '15');
  assert.equal(updateInput.data.promotionalPrice, null);
});

test('creates an order with a decimal total derived from its line items', async () => {
  let created: any;
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-1' }) },
    storeOrder: { create: async (input: any) => { created = input; return input; } },
  };
  const service = new StoreDashboardService(prisma as never);
  await service.createOrder('owner-1', {
    items: [
      { name: 'Saco de cimento', quantity: 2, unitPrice: '31.50' },
      { name: 'Areia', quantity: 1, unitPrice: '8.00' },
    ],
  });
  assert.equal(created.data.total.toString(), '71');
  assert.equal(created.data.storeId, 'store-1');
  assert.equal(created.data.items.create.length, 2);
  assert.equal(created.data.subtotal.toString(), '71');
  assert.equal(created.data.discount.toString(), '0');

  assert.equal(
    created.data.items.create[0].lineTotal.toString(),
    '63',
  );

  assert.equal(
    created.data.items.create[1].lineTotal.toString(),
    '8',
  );

  assert.match(
    created.data.orderNumber,
    /^PED-[0-9a-f-]{36}$/,
  );
  });

test('rejects nonpositive order line prices before persistence', async () => {
  let created = false;
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-1' }) },
    storeOrder: { create: async () => { created = true; return {}; } },
  };
  await assert.rejects(() => new StoreDashboardService(prisma as never).createOrder('owner-1', {
    items: [{ name: 'Item', quantity: 1, unitPrice: '0.00' }],
  }), BadRequestException);
  assert.equal(created, false);
});


test('updates order status and records history in the same transaction', async () => {
  let updated: any;
  let history: any;
  let transactionCalled = false;

  const tx = {
    storeOrder: {
      updateMany: async (input: any) => {
        updated = input;
        return { count: 1 };
      },
      findFirstOrThrow: async (input: any) => input,
    },
    orderStatusHistory: {
      create: async (input: any) => {
        history = input;
        return input;
      },
    },
  };

  const prisma = {
    storeProfile: {
      findUnique: async () => ({ id: 'store-1' }),
    },
    storeOrder: {
      findFirst: async () => ({ status: 'PENDING' }),
    },
    $transaction: async (callback: any) => {
      transactionCalled = true;
      return callback(tx);
    },
  };

  const service = new StoreDashboardService(prisma as never);

  await service.changeOrderStatus(
    'owner-1',
    'order-1',
    'CONFIRMED' as never,
  );

  assert.equal(transactionCalled, true);

  assert.equal(updated.where.id, 'order-1');
  assert.equal(updated.where.storeId, 'store-1');
  assert.equal(updated.where.status, 'PENDING');
  assert.equal(updated.data.status, 'CONFIRMED');

  assert.equal(history.data.orderId, 'order-1');
  assert.equal(history.data.fromStatus, 'PENDING');
  assert.equal(history.data.toStatus, 'CONFIRMED');
  assert.equal(history.data.actorId, 'owner-1');

  await assert.rejects(
    () => service.changeOrderStatus(
      'owner-1',
      'order-1',
      'COMPLETED' as never,
    ),
    BadRequestException,
  );
});
