import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { StoreDashboardService } from '../src/modules/stores/store-dashboard.service';

const address = {
  street: 'Rua das Flores', number: '10', neighborhood: 'Centro',
  city: 'Manaus', state: 'AM', zipCode: '69000000',
};
const dto = (items = [{ productId: 'p1', quantity: 2 }]) => ({ items, address });
const products = [
  { id: 'p1', storeId: 'store-1', name: 'Cimento', sku: 'CIM', price: '31.50', stock: 8, status: 'ACTIVE' },
  { id: 'p2', storeId: 'store-1', name: 'Areia', sku: null, price: '8.00', stock: 4, status: 'ACTIVE' },
];

function makePrisma(options: { products?: typeof products; promotions?: any[]; failUpdate?: number; status?: string; simulateRollback?: boolean; reserved?: boolean } = {}) {
  const catalog = options.products ?? products;
  const state: any = { stocks: new Map(catalog.map((product) => [product.id, product.stock])), created: null, histories: 0, updates: 0 };
  const tx: any = {
    product: {
      findMany: async ({ where }: any) => catalog.filter((product) => where.id.in.includes(product.id) && product.status === 'ACTIVE'),
      updateMany: async ({ where, data }: any) => {
        state.updates++;
        const stock = state.stocks.get(where.id);
        if (state.updates === options.failUpdate || stock < where.stock.gte) return { count: 0 };
        state.stocks.set(where.id, stock - data.stock.decrement);
        return { count: 1 };
      },
      update: async ({ where, data }: any) => {
        state.stocks.set(where.id, state.stocks.get(where.id) + data.stock.increment);
      },
    },
    storePromotion: { findMany: async () => options.promotions ?? [] },
    storeOrder: {
      create: async ({ data }: any) => { state.created = data; return data; },
      findFirst: async () => ({ status: options.status ?? 'PENDING', customerId: 'customer-1', statusHistory: [{ actorId: options.reserved === false ? 'owner-1' : 'customer-1' }], items: [{ productId: 'p1', quantity: 2 }] }),
      updateMany: async () => ({ count: 1 }),
      findFirstOrThrow: async () => ({}),
    },
    orderStatusHistory: { create: async () => { state.histories++; } },
  };
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-1' }) },
    $transaction: async (callback: (tx: any) => Promise<any>) => {
      const before = new Map(state.stocks);
      try { return await callback(tx); }
      catch (error) { if (options.simulateRollback !== false) state.stocks = before; throw error; }
    },
  };
  return { prisma, state };
}

test('uses catalog prices and saves the address, item totals, and initial history', async () => {
  const { prisma, state } = makePrisma();
  await new StoreDashboardService(prisma as never).createClientOrder('customer-1', {
    ...dto([{ productId: 'p1', quantity: 2 }, { productId: 'p2', quantity: 1 }]),
    total: '0.01', unitPrice: '0.01',
  } as never);
  assert.equal(state.created.total.toString(), '71');
  assert.equal(state.created.subtotal.toString(), '71');
  assert.deepEqual(state.created.items.create.map((item: any) => item.lineTotal.toString()), ['63', '8']);
  assert.equal(state.created.customerId, 'customer-1');
  assert.equal(state.created.addressSnapshot.street, address.street);
  assert.equal(state.created.statusHistory.create.actorId, 'customer-1');
  assert.equal(state.stocks.get('p1'), 6);
});

test('applies a current promotion using the server price', async () => {
  const { prisma, state } = makePrisma({ promotions: [{
    productId: 'p1', enabled: true, startAt: new Date('2020-01-01'),
    endAt: new Date('2099-01-01'), discountPercent: '10', promotionalPrice: null,
  }] });
  await new StoreDashboardService(prisma as never).createClientOrder('customer-1', dto());
  assert.equal(state.created.items.create[0].unitPrice.toString(), '28.35');
  assert.equal(state.created.discount.toString(), '6.3');
});

test('rejects products from different stores before decrementing stock', async () => {
  const { prisma, state } = makePrisma({ products: [products[0], { ...products[1], storeId: 'store-2' }] });
  await assert.rejects(() => new StoreDashboardService(prisma as never).createClientOrder(
    'customer-1', dto([{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }]),
  ), BadRequestException);
  assert.equal(state.updates, 0);
});

test('rejects insufficient stock and rolls back prior decrements', async () => {
  const { prisma, state } = makePrisma({ failUpdate: 2 });
  await assert.rejects(() => new StoreDashboardService(prisma as never).createClientOrder(
    'customer-1', dto([{ productId: 'p1', quantity: 1 }, { productId: 'p2', quantity: 1 }]),
  ), ConflictException);
  assert.equal(state.created, null);
  assert.equal(state.stocks.get('p1'), 8);
});

test('concurrent orders cannot consume the same final unit twice', async () => {
  const { prisma, state } = makePrisma({ products: [{ ...products[0], stock: 1 }], simulateRollback: false });
  const service = new StoreDashboardService(prisma as never);
  const results = await Promise.allSettled([
    service.createClientOrder('customer-1', dto([{ productId: 'p1', quantity: 1 }])),
    service.createClientOrder('customer-2', dto([{ productId: 'p1', quantity: 1 }])),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(state.stocks.get('p1'), 0);
});

test('canceling restores stock once and writes one status change', async () => {
  const { prisma, state } = makePrisma();
  const service = new StoreDashboardService(prisma as never);
  await service.changeOrderStatus('owner-1', 'order-1', 'CANCELED' as never);
  assert.equal(state.stocks.get('p1'), 10);
  assert.equal(state.histories, 1);

  const { prisma: canceledPrisma, state: canceledState } = makePrisma({ status: 'CANCELED' });
  await assert.rejects(() => new StoreDashboardService(canceledPrisma as never).changeOrderStatus(
    'owner-1', 'order-1', 'CANCELED' as never,
  ), BadRequestException);
  assert.equal(canceledState.stocks.get('p1'), 8);
});

test('canceling a manually entered order does not add unreserved stock', async () => {
  const { prisma, state } = makePrisma({ reserved: false });
  await new StoreDashboardService(prisma as never).changeOrderStatus('owner-1', 'order-1', 'CANCELED' as never);
  assert.equal(state.stocks.get('p1'), 8);
  assert.equal(state.histories, 1);
});
