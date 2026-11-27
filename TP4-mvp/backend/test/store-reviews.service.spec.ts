import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { DeliveryStatus, Prisma, StoreOrderStatus } from '@prisma/client';
import { StoreReviewsService } from '../src/modules/stores/store-reviews.service';

type StoredReview = { id: string; orderId: string; storeId: string; customerId: string; rating: number; comment: string | null; createdAt: Date; updatedAt: Date };

function fixture() {
  const stores = [
    { id: 'store-a', ownerId: 'owner-a', status: 'ACTIVE' },
    { id: 'store-b', ownerId: 'owner-b', status: 'ACTIVE' },
    { id: 'store-inactive', ownerId: 'owner-inactive', status: 'INACTIVE' },
  ];
  const order = { id: 'order-a', storeId: 'store-a', customerId: 'customer-a' as string | null, status: StoreOrderStatus.COMPLETED as StoreOrderStatus, delivery: { status: DeliveryStatus.DELIVERED } as { status: DeliveryStatus } | null };
  const reviews: StoredReview[] = [];
  const calls: { operation: string; input: any }[] = [];
  const present = (review: StoredReview) => ({
    id: review.id, storeId: review.storeId, rating: review.rating, comment: review.comment,
    createdAt: review.createdAt, updatedAt: review.updatedAt, customer: { name: 'Cliente' },
  });
  const tx = {
    storeOrder: {
      findFirst: async (input: any) => {
        calls.push({ operation: 'order', input });
        return input.where.id === order.id && input.where.customerId === order.customerId ? order : null;
      },
    },
    storeReview: {
      create: async (input: any) => {
        calls.push({ operation: 'create', input });
        if (reviews.some((review) => review.orderId === input.data.orderId)) {
          throw new Prisma.PrismaClientKnownRequestError('Unique orderId', { code: 'P2002', clientVersion: 'test', meta: { target: ['orderId'] } });
        }
        const review = { id: `review-${reviews.length + 1}`, ...input.data, createdAt: new Date(), updatedAt: new Date() };
        reviews.push(review);
        return present(review);
      },
      findMany: async (input: any) => {
        calls.push({ operation: 'page', input });
        return reviews.filter((review) => review.storeId === input.where.storeId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id))
          .slice(input.skip, input.skip + input.take).map(present);
      },
      aggregate: async (input: any) => {
        calls.push({ operation: 'aggregate', input });
        const matching = reviews.filter((review) => review.storeId === input.where.storeId);
        return { _count: { _all: matching.length }, _avg: { rating: matching.length ? matching.reduce((sum, review) => sum + review.rating, 0) / matching.length : null } };
      },
      groupBy: async (input: any) => {
        calls.push({ operation: 'distribution', input });
        const counts = new Map<number, number>();
        for (const review of reviews.filter((entry) => entry.storeId === input.where.storeId)) counts.set(review.rating, (counts.get(review.rating) ?? 0) + 1);
        return [...counts].map(([rating, count]) => ({ rating, _count: { _all: count } }));
      },
    },
  };
  const prisma = {
    storeProfile: {
      findFirst: async ({ where }: any) => stores.find((store) => store.id === where.id && store.status === where.status) ?? null,
      findUnique: async ({ where }: any) => stores.find((store) => store.ownerId === where.ownerId) ?? null,
    },
    $transaction: async (callback: (transaction: typeof tx) => Promise<unknown>, options?: unknown) => {
      calls.push({ operation: 'transaction', input: options });
      return callback(tx);
    },
  };
  const seed = (ratings: number[], storeId = 'store-a') => ratings.forEach((rating) => {
    const id = `seed-${reviews.length}`;
    reviews.push({ id, orderId: `order-${id}`, storeId, customerId: 'customer-a', rating, comment: null, createdAt: new Date('2026-10-25T10:00:00Z'), updatedAt: new Date('2026-10-25T10:00:00Z') });
  });
  return { service: new StoreReviewsService(prisma as never), order, reviews, calls, seed, tx };
}

test('LOJA-026: accepts the customer delivered order and derives the store and customer from trusted data', async () => {
  const f = fixture();
  const result = await f.service.create('customer-a', 'order-a', { rating: 5, comment: '  Entrega excelente.  ', storeId: 'store-b', customerId: 'other' } as never);
  assert.equal(result.rating, 5);
  assert.equal(result.comment, 'Entrega excelente.');
  assert.deepEqual(f.reviews.map(({ orderId, storeId, customerId }) => ({ orderId, storeId, customerId })), [{ orderId: 'order-a', storeId: 'store-a', customerId: 'customer-a' }]);
  assert.deepEqual(f.calls.find((call) => call.operation === 'order')!.input.where, { id: 'order-a', customerId: 'customer-a' });
});

test('LOJA-026: rejects another customer, missing order and legacy order without customer', async () => {
  const f = fixture();
  await assert.rejects(f.service.create('customer-b', 'order-a', { rating: 4 }), NotFoundException);
  await assert.rejects(f.service.create('customer-a', 'missing', { rating: 4 }), NotFoundException);
  f.order.customerId = null;
  await assert.rejects(f.service.create('customer-a', 'order-a', { rating: 4 }), NotFoundException);
  assert.equal(f.reviews.length, 0);
});

test('LOJA-026: rejects every undelivered state, missing delivery and inconsistent order status', async () => {
  const f = fixture();
  for (const status of Object.values(DeliveryStatus).filter((value) => value !== DeliveryStatus.DELIVERED)) {
    f.order.delivery = { status };
    await assert.rejects(f.service.create('customer-a', 'order-a', { rating: 4 }), BadRequestException);
  }
  f.order.delivery = null;
  await assert.rejects(f.service.create('customer-a', 'order-a', { rating: 4 }), BadRequestException);
  f.order.delivery = { status: DeliveryStatus.DELIVERED };
  for (const status of Object.values(StoreOrderStatus).filter((value) => value !== StoreOrderStatus.COMPLETED)) {
    f.order.status = status;
    await assert.rejects(f.service.create('customer-a', 'order-a', { rating: 4 }), BadRequestException);
  }
  assert.equal(f.reviews.length, 0);
});

test('LOJA-026: one review per order also rejects simultaneous duplicate submissions', async () => {
  const f = fixture();
  const results = await Promise.allSettled([
    f.service.create('customer-a', 'order-a', { rating: 1 }),
    f.service.create('customer-a', 'order-a', { rating: 5 }),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  const rejected = results.find((result) => result.status === 'rejected');
  assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof ConflictException);
  assert.equal(f.reviews.length, 1);
  await assert.rejects(f.service.create('customer-a', 'order-a', { rating: 3 }), ConflictException);
});

test('LOJA-026: accepts the rating boundaries and rejects fractional, out-of-range and nonnumeric ratings', async () => {
  for (const rating of [1, 5]) {
    const f = fixture();
    assert.equal((await f.service.create('customer-a', 'order-a', { rating })).rating, rating);
  }
  const f = fixture();
  for (const rating of [0, 6, -1, 1.5, NaN, Infinity, '5', null, undefined]) {
    await assert.rejects(f.service.create('customer-a', 'order-a', { rating } as never), BadRequestException);
  }
  assert.equal(f.calls.length, 0);
});

test('LOJA-026: limits comments and normalizes an empty optional comment', async () => {
  const f = fixture();
  await assert.rejects(f.service.create('customer-a', 'order-a', { rating: 5, comment: 'a'.repeat(2001) }), BadRequestException);
  await assert.rejects(f.service.create('customer-a', 'order-a', { rating: 5, comment: 123 } as never), BadRequestException);
  assert.equal((await f.service.create('customer-a', 'order-a', { rating: 5, comment: '   ' })).comment, null);
});

test('LOJA-026: computes the full-store aggregate and distribution independently of the requested page', async () => {
  const f = fixture(); f.seed([1, 2, 3, 4, 5, 5]); f.seed([1], 'store-b');
  const result = await f.service.listPublic('store-a', { page: 2, limit: 2 });
  assert.equal(result.total, 6); assert.equal(result.page, 2); assert.equal(result.limit, 2);
  assert.deepEqual(result.items.map((item) => item.id), ['seed-3', 'seed-2']);
  assert.deepEqual(result.reputation, { averageRating: 20 / 6, reviewCount: 6, distribution: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 2 } });
  assert.deepEqual(f.calls.find((call) => call.operation === 'aggregate')!.input, { where: { storeId: 'store-a' }, _avg: { rating: true }, _count: { _all: true } });
  assert.deepEqual(f.calls.find((call) => call.operation === 'transaction')!.input, { isolationLevel: 'RepeatableRead' });
  assert.ok(!('orderId' in result.items[0]) && !('customerId' in result.items[0]));
  assert.deepEqual(result.items[0].customer, { name: 'Cliente' });
});

test('LOJA-026: derives reputation again on each read and preserves aggregate on an empty page', async () => {
  const f = fixture(); f.seed([5]);
  assert.equal((await f.service.listPublic('store-a')).reputation.averageRating, 5);
  f.seed([1]);
  const result = await f.service.listPublic('store-a', { page: 5, limit: 1 });
  assert.deepEqual(result.items, []); assert.equal(result.reputation.averageRating, 3); assert.equal(result.total, 2);
});

test('LOJA-026: a store without reviews has no average and a zero-filled distribution', async () => {
  const f = fixture();
  const result = await f.service.listPublic('store-a');
  assert.deepEqual(result, { items: [], total: 0, page: 1, limit: 20, reputation: { averageRating: null, reviewCount: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } } });
});

test('LOJA-026: owners read only their own store, including inactive stores, and public reads require an active store', async () => {
  const f = fixture(); f.seed([5]); f.seed([2], 'store-b'); f.seed([3], 'store-inactive');
  assert.equal((await f.service.listMine('owner-a')).reputation.averageRating, 5);
  assert.equal((await f.service.listMine('owner-b')).reputation.averageRating, 2);
  assert.equal((await f.service.listMine('owner-inactive')).reputation.averageRating, 3);
  await assert.rejects(f.service.listPublic('store-inactive'), NotFoundException);
  await assert.rejects(f.service.listPublic('missing'), NotFoundException);
  await assert.rejects(f.service.listMine('unknown'), NotFoundException);
});

test('LOJA-026: unrelated database failures are not reported as duplicate reviews', async () => {
  const f = fixture(); const failure = new Error('Database unavailable');
  f.tx.storeReview.create = async () => { throw failure; };
  await assert.rejects(f.service.create('customer-a', 'order-a', { rating: 3 }), (error) => error === failure);
});
