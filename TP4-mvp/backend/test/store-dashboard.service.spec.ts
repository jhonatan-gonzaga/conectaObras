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
    name: 'Oferta', discountPct: 10, productId: 'product-from-another-store',
  }), BadRequestException);
  assert.equal(created, undefined);
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

test('allows only valid next status transitions and scopes update by store lookup', async () => {
  let updated: any;
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-1' }) },
    storeOrder: {
      findFirst: async () => ({ status: 'PENDING' }),
      updateMany: async (input: any) => { updated = input; return { count: 1 }; },
      findFirstOrThrow: async (input: any) => input,
    },
  };
  const service = new StoreDashboardService(prisma as never);
  await service.changeOrderStatus('owner-1', 'order-1', 'CONFIRMED' as never);
  assert.equal(updated.where.id, 'order-1');
  assert.equal(updated.where.storeId, 'store-1');
  assert.equal(updated.data.status, 'CONFIRMED');
  await assert.rejects(() => service.changeOrderStatus('owner-1', 'order-1', 'COMPLETED' as never), BadRequestException);
});
