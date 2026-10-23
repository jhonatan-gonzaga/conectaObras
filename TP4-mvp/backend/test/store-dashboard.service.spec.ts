import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { StoreDashboardService } from '../src/modules/stores/store-dashboard.service';

const orderDto = (items = [{ productId: 'p1', quantity: 2 }]) => ({
  items,
  address: 'Rua das Flores, 10',
  observation: 'Entregar pela manhã',
});

function createPrisma(options: {
  products?: any[];
  promotions?: any[];
  updateCounts?: number[];
  status?: string;
  simulateRollback?: boolean;
} = {}) {
  const state: any = { stocks: new Map<string, number>(), orderCreated: 0, histories: 0, decrements: 0, createdData: null };
  for (const product of options.products ?? []) state.stocks.set(product.id, product.stock);
  const tx: any = {
    product: {
      findMany: async ({ where }: any) => (options.products ?? []).filter((product) =>
        where.id.in.includes(product.id) && where.status === product.status),
      updateMany: async ({ where, data }: any) => {
        const count = options.updateCounts?.[state.decrements] ?? 1;
        state.decrements += 1;
        const stock = state.stocks.get(where.id) ?? 0;
        if (count !== 1 || stock < where.stock.gte) return { count: 0 };
        state.stocks.set(where.id, stock - data.stock.decrement);
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        state.stocks.set(where.id, (state.stocks.get(where.id) ?? 0) + data.stock.increment);
        return {};
      },
    },
    storePromotion: { findMany: async () => (options.promotions ?? []).filter((promotion) =>
      (!promotion.startsAt || promotion.startsAt <= new Date()) && (!promotion.endsAt || promotion.endsAt >= new Date())) },
    storeOrder: {
      create: async (input: any) => { state.orderCreated += 1; state.createdData = input.data; return input; },
      findFirst: async () => ({ status: options.status ?? 'PENDING', items: [{ productId: 'p1', quantity: 2 }] }),
      updateMany: async () => ({ count: 1 }),
      findFirstOrThrow: async () => ({ items: [] }),
    },
    storeOrderStatusHistory: { create: async () => { state.histories += 1; } },
  };
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-1' }) },
    $transaction: async (callback: (transaction: any) => Promise<any>) => {
      const stocksBefore = new Map(state.stocks);
      try { return await callback(tx); } catch (error) {
        if (options.simulateRollback !== false) state.stocks = stocksBefore;
        throw error;
      }
    },
  };
  return { prisma, state };
}

const products = [
  { id: 'p1', storeId: 'store-1', name: 'Saco de cimento', price: '31.50', stock: 8, status: 'ACTIVE' },
  { id: 'p2', storeId: 'store-1', name: 'Areia', price: '8.00', stock: 4, status: 'ACTIVE' },
];

test('ignores client supplied price and calculates item and total from current catalog values', async () => {
  const { prisma, state } = createPrisma({ products });
  const service = new StoreDashboardService(prisma as never);
  await service.createOrder('customer-1', {
    ...orderDto([{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 1 }]),
    unitPrice: '0.01', total: '0.01',
  } as never);
  assert.equal(state.createdData.total.toString(), '71');
  assert.deepEqual(state.createdData.items.create.map((item: any) => item.unitPrice.toString()), ['31.5', '8']);
  assert.equal(state.createdData.customerId, 'customer-1');
  assert.equal(state.createdData.address, 'Rua das Flores, 10');
});

test('rejects products from different stores before changing stock', async () => {
  const { prisma, state } = createPrisma({ products: [products[0], { ...products[1], storeId: 'store-2' }] });
  await assert.rejects(() => new StoreDashboardService(prisma as never).createOrder(
    'customer-1', orderDto([{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }]),
  ), BadRequestException);
  assert.equal(state.decrements, 0);
  assert.equal(state.orderCreated, 0);
});

test('ignores an expired promotion and uses the catalog price', async () => {
  const { prisma, state } = createPrisma({ products, promotions: [{ productId: 'p1', discountPct: '50.00', status: 'ACTIVE', endsAt: new Date('2020-01-01') }] });
  await new StoreDashboardService(prisma as never).createOrder('customer-1', orderDto());
  assert.equal(state.createdData.items.create[0].unitPrice.toString(), '31.5');
});

test('applies a current promotion using the server price', async () => {
  const { prisma, state } = createPrisma({ products, promotions: [{ productId: 'p1', discountPct: '10.00' }] });
  await new StoreDashboardService(prisma as never).createOrder('customer-1', orderDto());
  assert.equal(state.createdData.items.create[0].unitPrice.toString(), '28.35');
});

test('conditional stock update rejects insufficient inventory and creates no order', async () => {
  const { prisma, state } = createPrisma({ products: [{ ...products[0], stock: 1 }] });
  await assert.rejects(() => new StoreDashboardService(prisma as never).createOrder('customer-1', orderDto()), ConflictException);
  assert.equal(state.orderCreated, 0);
});

test('concurrent purchases cannot decrement the same final unit twice', async () => {
  const { prisma, state } = createPrisma({ products: [{ ...products[0], stock: 1 }], simulateRollback: false });
  const service = new StoreDashboardService(prisma as never);
  const outcomes = await Promise.allSettled([
    service.createOrder('customer-1', orderDto([{ productId: 'p1', quantity: 1 }])),
    service.createOrder('customer-2', orderDto([{ productId: 'p1', quantity: 1 }])),
  ]);
  assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
  assert.equal(state.stocks.get('p1'), 0);
  assert.equal(state.orderCreated, 1);
});

test('later line failure rolls back previous stock decrement and order writes', async () => {
  const { prisma, state } = createPrisma({ products, updateCounts: [1, 0] });
  await assert.rejects(() => new StoreDashboardService(prisma as never).createOrder(
    'customer-1', orderDto([{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }]),
  ), ConflictException);
  assert.equal(state.orderCreated, 0);
  assert.equal(state.stocks.get('p1'), 8);
});

test('cancellation restores stock once and records one status history entry', async () => {
  const { prisma, state } = createPrisma({ products, status: 'PENDING' });
  const service = new StoreDashboardService(prisma as never);
  await service.changeOrderStatus('owner-1', 'order-1', 'CANCELED' as never);
  assert.equal(state.stocks.get('p1'), 10);
  assert.equal(state.histories, 1);
  const { prisma: canceledPrisma, state: canceledState } = createPrisma({ products, status: 'CANCELED' });
  await assert.rejects(() => new StoreDashboardService(canceledPrisma as never).changeOrderStatus(
    'owner-1', 'order-1', 'CANCELED' as never,
  ), BadRequestException);
  assert.equal(canceledState.stocks.get('p1'), 8);
});
