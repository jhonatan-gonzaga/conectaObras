import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateClientStoreOrderDto } from '../src/modules/stores/dto/create-client-store-order.dto';
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
  const state: any = { stocks: new Map(catalog.map((product) => [product.id, product.stock])), created: null, histories: 0, updates: 0, status: options.status ?? 'PENDING', promotionWhere: null };
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
    storePromotion: { findMany: async ({ where }: any) => {
      state.promotionWhere = where;
      return (options.promotions ?? []).filter((promotion) =>
        where.productId.in.includes(promotion.productId)
        && promotion.enabled === where.enabled
        && promotion.startAt <= where.startAt.lte
        && promotion.endAt > where.endAt.gt);
    } },
    storeOrder: {
      create: async ({ data }: any) => { state.created = data; return data; },
      findFirst: async () => ({ status: state.status, stockReserved: options.reserved !== false, items: [{ productId: 'p1', quantity: 2 }] }),
      updateMany: async ({ where, data }: any) => {
        if (state.status !== where.status) return { count: 0 };
        state.status = data.status;
        return { count: 1 };
      },
      findFirstOrThrow: async () => ({ status: state.status }),
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
    observation: 'Entregar pela manhã',
    total: '0.01', unitPrice: '0.01',
  } as never);
  assert.equal(state.created.total.toString(), '71');
  assert.equal(state.created.subtotal.toString(), '71');
  assert.deepEqual(state.created.items.create.map((item: any) => item.lineTotal.toString()), ['63', '8']);
  assert.equal(state.created.customerId, 'customer-1');
  assert.equal(state.created.addressSnapshot.street, address.street);
  assert.equal(state.created.note, 'Entregar pela manhã');
  assert.equal(state.created.statusHistory.create.actorId, 'customer-1');
  assert.equal(state.created.stockReserved, true);
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

test('ignores an expired promotion and uses the catalog price', async () => {
  const { prisma, state } = makePrisma({ promotions: [{
    productId: 'p1', enabled: true, startAt: new Date('2020-01-01'),
    endAt: new Date('2020-02-01'), discountPercent: '50', promotionalPrice: null,
  }] });
  await new StoreDashboardService(prisma as never).createClientOrder('customer-1', dto());
  assert.equal(state.created.items.create[0].unitPrice.toString(), '31.5');
  assert.equal(state.promotionWhere.enabled, true);
  assert.ok(state.promotionWhere.endAt.gt instanceof Date);
});

test('the request validator accepts but ignores supplied price and total fields', async () => {
  const request = plainToInstance(CreateClientStoreOrderDto, {
    ...dto(), total: '0.01', price: '0.01',
    items: [{ productId: 'p1', quantity: 2, unitPrice: '0.01' }],
  });
  assert.deepEqual(await validate(request, { whitelist: true, forbidNonWhitelisted: true }), []);
  const { prisma, state } = makePrisma();
  await new StoreDashboardService(prisma as never).createClientOrder('customer-1', request);
  assert.equal(state.created.total.toString(), '63');
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

test('combines duplicate product quantities before checking stock', async () => {
  const { prisma, state } = makePrisma({ products: [{ ...products[0], stock: 3 }] });
  await assert.rejects(() => new StoreDashboardService(prisma as never).createClientOrder(
    'customer-1', dto([{ productId: 'p1', quantity: 2 }, { productId: 'p1', quantity: 2 }]),
  ), ConflictException);
  assert.equal(state.created, null);
  assert.equal(state.stocks.get('p1'), 3);
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
  await service.changeOrderStatus('owner-1', 'order-1', 'CANCELED' as never);
  assert.equal(state.stocks.get('p1'), 10);
  assert.equal(state.histories, 1);
});

test('canceling a manually entered order does not add unreserved stock', async () => {
  const { prisma, state } = makePrisma({ reserved: false });
  await new StoreDashboardService(prisma as never).changeOrderStatus('owner-1', 'order-1', 'CANCELED' as never);
  assert.equal(state.stocks.get('p1'), 8);
  assert.equal(state.histories, 1);
});
