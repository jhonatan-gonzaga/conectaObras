import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { StoreDashboardService } from '../src/modules/stores/store-dashboard.service';

const future = () => ({
  startAt: new Date(Date.now() + 60_000),
  endAt: new Date(Date.now() + 3_600_000),
});

test('promotion CRUD scopes product and promotion to the authenticated store', async () => {
  const dates = future();
  const writes: unknown[] = [];
  const prisma = {
    storeProfile: { findUnique: async ({ where }: any) => ({ id: `store-${where.ownerId}` }) },
    product: { findFirst: async ({ where }: any) => where.storeId === 'store-owner-a' && where.id === 'product-a'
      ? { id: 'product-a', price: new Prisma.Decimal('100.00'), status: 'ACTIVE', stock: 3 } : null },
    storePromotion: {
      findMany: async () => [],
      findFirst: async ({ where }: any) => where.storeId === 'store-owner-a' && where.id === 'promotion-a'
        ? { id: 'promotion-a', storeId: 'store-owner-a', productId: 'product-a', promotionalPrice: new Prisma.Decimal('80'), discountPercent: null, enabled: true, ...dates, product: { id: 'product-a', status: 'ACTIVE', stock: 3 } } : null,
      create: async (input: any) => { writes.push(input); return { id: 'promotion-a', ...input.data }; },
      update: async (input: any) => { writes.push(input); return input; },
    },
  };
  const service = new StoreDashboardService(prisma as never);
  const created = await service.createPromotion('owner-a', { productId: 'product-a', promotionalPrice: 80, ...dates });
  assert.equal(created.id, 'promotion-a');
  assert.equal((writes[0] as any).data.storeId, 'store-owner-a');
  await assert.rejects(() => service.createPromotion('owner-b', { productId: 'product-a', promotionalPrice: 80, ...dates }), BadRequestException);
  await assert.rejects(() => service.updatePromotion('owner-b', 'promotion-a', { discountPercent: 10 }), NotFoundException);
  await assert.rejects(() => service.setPromotionEnabled('owner-b', 'promotion-a', false), NotFoundException);

  await service.updatePromotion('owner-a', 'promotion-a', { discountPercent: 10 });
  assert.equal((writes[1] as any).where.storeId, 'store-owner-a');
  assert.equal((writes[1] as any).data.discountPercent.toString(), '10');
  assert.equal((writes[1] as any).data.promotionalPrice, null);
  await service.setPromotionEnabled('owner-a', 'promotion-a', false);
  assert.deepEqual((writes[2] as any).where, { id: 'promotion-a', storeId: 'store-owner-a' });
  assert.equal((writes[2] as any).data.enabled, false);
});

test('promotion validity rejects invalid discounts, dates, expired periods and ineligible products', async () => {
  const dates = future();
  let product = { id: 'product-a', price: new Prisma.Decimal('100.00'), status: 'ACTIVE', stock: 3 };
  let created = false;
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-a' }) },
    product: { findFirst: async () => product },
    storePromotion: { findMany: async () => [], create: async () => { created = true; return {}; } },
  };
  const service = new StoreDashboardService(prisma as never);
  const base = { productId: 'product-a', ...dates };
  await assert.rejects(() => service.createPromotion('owner-a', { ...base, promotionalPrice: 100 }), BadRequestException);
  await assert.rejects(() => service.createPromotion('owner-a', { ...base, discountPercent: 0 }), BadRequestException);
  await assert.rejects(() => service.createPromotion('owner-a', { ...base, promotionalPrice: 80, discountPercent: 10 }), BadRequestException);
  await assert.rejects(() => service.createPromotion('owner-a', { ...base, promotionalPrice: 80, endAt: dates.startAt }), BadRequestException);
  await assert.rejects(() => service.createPromotion('owner-a', { ...base, promotionalPrice: 80, endAt: new Date(Date.now() - 1) }), BadRequestException);
  product = { ...product, stock: 0 };
  await assert.rejects(() => service.createPromotion('owner-a', { ...base, promotionalPrice: 80 }), BadRequestException);
  product = { ...product, status: 'INACTIVE', stock: 3 };
  await assert.rejects(() => service.createPromotion('owner-a', { ...base, promotionalPrice: 80 }), BadRequestException);
  assert.equal(created, false);
});

test('GET classifies current, scheduled and ended by the request clock without a job', async () => {
  const now = Date.now();
  const row = (id: string, start: number, end: number, enabled = true) => ({
    id, storeId: 'store-a', productId: 'product-a', promotionalPrice: new Prisma.Decimal('80'), discountPercent: null,
    startAt: new Date(start), endAt: new Date(end), enabled,
    product: { id: 'product-a', name: 'Produto A', price: new Prisma.Decimal('100'), status: 'ACTIVE', stock: 2 },
  });
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-a' }) },
    storePromotion: { findMany: async ({ where }: any) => {
      assert.equal(where.storeId, 'store-a');
      return [
        row('current', now - 1000, now + 60_000),
        row('scheduled', now + 60_000, now + 120_000),
        row('ended', now - 120_000, now - 1000),
        row('disabled', now - 1000, now + 60_000, false),
      ];
    } },
  };
  const service = new StoreDashboardService(prisma as never);
  const all = await service.listPromotions('owner-a');
  assert.deepEqual(all.map((promotion) => promotion.status), ['CURRENT', 'SCHEDULED', 'ENDED', 'CURRENT']);
  assert.deepEqual(all.map((promotion) => promotion.effectivePrice), ['80.00', '100.00', '100.00', '100.00']);
  assert.deepEqual((await service.listPromotions('owner-a', 'ENDED')).map((promotion) => promotion.id), ['ended']);
});

test('enabling rejects expired, ineligible and overlapping promotions', async () => {
  const dates = future();
  const promotion = {
    id: 'promotion-a', storeId: 'store-a', productId: 'product-a', enabled: false,
    ...dates, product: { id: 'product-a', status: 'ACTIVE', stock: 2 },
  };
  let updated = false;
  let overlaps: Array<{ startAt: Date; endAt: Date }> = [];
  const prisma = {
    storeProfile: { findUnique: async () => ({ id: 'store-a' }) },
    storePromotion: {
      findFirst: async () => promotion,
      findMany: async () => overlaps,
      update: async () => { updated = true; return {}; },
    },
  };
  const service = new StoreDashboardService(prisma as never);
  promotion.endAt = new Date(Date.now() - 1);
  await assert.rejects(() => service.setPromotionEnabled('owner-a', 'promotion-a', true), BadRequestException);
  promotion.endAt = dates.endAt;
  promotion.product.stock = 0;
  await assert.rejects(() => service.setPromotionEnabled('owner-a', 'promotion-a', true), BadRequestException);
  promotion.product.stock = 2;
  overlaps = [{ startAt: dates.startAt, endAt: dates.endAt }];
  await assert.rejects(() => service.setPromotionEnabled('owner-a', 'promotion-a', true), /sobreposto/);
  assert.equal(updated, false);
});
