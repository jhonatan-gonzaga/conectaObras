import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException, ValidationPipe } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StorePromotionsService } from '../src/modules/stores/store-promotions.service';
import { CreateStorePromotionDto } from '../src/modules/stores/dto/create-store-promotion.dto';

const dto: CreateStorePromotionDto = { name: ' Oferta ', productId: 'p1', discountType: 'PERCENTAGE', discountValue: 20, startsAt: '2030-10-15T11:00:00.000Z', endsAt: '2030-10-23T02:59:00.000Z', status: 'ACTIVE' };
function fixture() {
  let data: any;
  let overlap = false;
  let saved: any = null;
  let product: any = { id: 'p1', price: new Prisma.Decimal('89.90') };
  const queries: any[] = [];
  const events: string[] = [];
  const tx = {
    $queryRaw: async () => { events.push('lock'); },
    product: { findFirst: async (input: any) => { queries.push(input); events.push('product'); return product; } },
    storePromotion: {
      findFirst: async (input: any) => { queries.push(input); return typeof input.where.id === 'string' ? saved : overlap ? { id: 'other' } : null; },
      create: async (input: any) => { data = input.data; return data; },
      update: async (input: any) => { data = input.data; return data; },
    },
  };
  const prisma = { storeProfile: { findUnique: async () => ({ id: 'store-owner' }) }, $transaction: async (callback: any) => callback(tx), storePromotion: { findMany: async (input: any) => { queries.push(input); return []; }, findFirst: tx.storePromotion.findFirst } };
  return { service: new StorePromotionsService(prisma as never), queries, events, data: () => data,
    overlap: () => { overlap = true; }, saved: (value: any) => { saved = value; }, noProduct: () => { product = null; } };
}

test('saves all rule types with exact decimal preview, owner scope and dates', async () => {
  for (const [discountType, discountValue] of [['PERCENTAGE', 20], ['FIXED', 17.98], ['DIRECT', 71.92]] as const) {
    const f = fixture();
    await f.service.save('owner', { ...dto, discountType, discountValue });
    assert.equal(f.data().storeId, 'store-owner'); assert.equal(f.data().name, 'Oferta');
    assert.equal(f.data().discountType, discountType); assert.equal(f.data().discountValue.toNumber(), discountValue);
    assert.equal(f.data().discountPct.toNumber(), 20); assert.equal(f.data().startsAt.toISOString(), dto.startsAt);
    assert.deepEqual(f.events, ['lock', 'product']);
    assert.deepEqual(f.queries[0].where, { id: 'p1', storeId: 'store-owner', status: 'ACTIVE' });
  }
});
test('rejects invalid discounts, inverted dates, missing names and expired publication', async () => {
  for (const change of [{ discountValue: 0 }, { discountValue: 100 }, { discountType: 'FIXED', discountValue: 89.90 }, { discountType: 'DIRECT', discountValue: 90 }, { endsAt: dto.startsAt }, { endsAt: 'invalid' }, { name: ' ' }, { startsAt: '2020-01-01T00:00:00Z', endsAt: '2020-01-02T00:00:00Z' }]) {
    const f = fixture();
    await assert.rejects(() => f.service.save('owner', { ...dto, ...change } as CreateStorePromotionDto), BadRequestException);
    assert.equal(f.data(), undefined);
  }
});
test('rejects another store product before saving', async () => {
  const f = fixture(); f.noProduct();
  await assert.rejects(() => f.service.save('owner', dto), BadRequestException);
  assert.equal(f.data(), undefined);
});
test('blocks overlapping active periods and permits draft rules', async () => {
  const f = fixture(); f.overlap();
  await assert.rejects(() => f.service.save('owner', dto), ConflictException);
  const query = f.queries.at(-1).where;
  assert.equal(query.storeId, 'store-owner'); assert.equal(query.productId, 'p1'); assert.equal(query.status, 'ACTIVE');
  assert.equal(query.AND[0].OR[1].startsAt.lt.toISOString(), dto.endsAt);
  assert.equal(query.AND[1].OR[1].endsAt.gt.toISOString(), dto.startsAt);
  await f.service.save('owner', { ...dto, status: 'DRAFT' }); assert.equal(f.data().status, 'DRAFT');
});
test('editing excludes the same promotion from conflicts and is scoped to owner', async () => {
  const f = fixture();
  await assert.rejects(() => f.service.save('owner', dto, 'foreign-promo'), NotFoundException);
  f.saved({ id: 'mine' }); await f.service.save('owner', dto, 'mine');
  assert.deepEqual(f.queries.at(-1).where.id, { not: 'mine' });
  assert.ok(f.queries.some((q) => q.where.id === 'mine' && q.where.storeId === 'store-owner'));
});
test('activation rechecks expiry and conflicts, deactivation remains possible after expiry', async () => {
  const f = fixture();
  f.saved({ ...dto, id: 'mine', startsAt: new Date(dto.startsAt), endsAt: new Date('2020-01-02T00:00:00Z') });
  await assert.rejects(() => f.service.changeStatus('owner', 'mine', 'ACTIVE'), BadRequestException);
  await f.service.changeStatus('owner', 'mine', 'CANCELED'); assert.equal(f.data().status, 'CANCELED');
  f.saved({ ...dto, id: 'mine', startsAt: new Date(dto.startsAt), endsAt: new Date(dto.endsAt) }); f.overlap();
  await assert.rejects(() => f.service.changeStatus('owner', 'mine', 'ACTIVE'), ConflictException);
});
test('list returns all owner states so the app can derive expiry on refresh', async () => {
  const f = fixture(); await f.service.list('owner');
  assert.deepEqual(f.queries[0].where, { storeId: 'store-owner' });
});
test('HTTP validation rejects two simultaneous rules, malformed dates and extra payload fields', async () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const metadata = { type: 'body' as const, metatype: CreateStorePromotionDto };
  for (const change of [{ discountType: ['PERCENTAGE', 'FIXED'] }, { discountPct: 10 }, { discountValue: 1.234 }, { startsAt: '2030-10-15T08:00' }, { startsAt: null }, { discountValue: '20' }]) {
    await assert.rejects(() => pipe.transform({ ...dto, ...change }, metadata), BadRequestException);
  }
  assert.equal((await pipe.transform(dto, metadata)).discountValue, 20);
});
