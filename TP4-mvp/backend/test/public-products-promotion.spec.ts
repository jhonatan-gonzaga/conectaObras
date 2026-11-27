import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PrismaService } from '../src/prisma/prisma.service';
import { PublicProductsController } from '../src/modules/products/public-products.controller';
import { PublicProductsService } from '../src/modules/products/public-products.service';

test('public product query exposes base and effective prices without promotion internals', async () => {
  const now = Date.now();
  const product = {
    id: 'product-a', name: 'Cimento', description: 'Saco de cimento', price: new Prisma.Decimal('100.00'), stock: 3,
    store: { id: 'store-a', name: 'Loja' }, category: { id: 'category-a', name: 'Materiais' },
    images: [{ url: 'https://example.com/cimento.jpg', altText: 'Cimento', isCover: true }],
    promotions: [{ promotionalPrice: new Prisma.Decimal('79.90'), discountPercent: null, startAt: new Date(now - 1000), endAt: new Date(now + 60_000), enabled: true }],
  };
  const prisma = { product: {
    findFirst: async ({ where }: any) => { assert.equal(where.status, 'ACTIVE'); assert.equal(where.category.active, true); return product; },
    findMany: async ({ where }: any) => { assert.equal(where.store.status, 'ACTIVE'); return [product]; },
  } };
  Object.assign(prisma, {
    $queryRaw: async () => [{ id: product.id, total: 1n }],
    $transaction: async (callback: any) => callback(prisma),
  });
  const service = new PublicProductsService(prisma as never);
  const detail = await service.get('product-a');
  assert.deepEqual({ id: detail.id, name: detail.name, description: detail.description, basePrice: detail.basePrice, effectivePrice: detail.effectivePrice, images: detail.images }, {
    id: 'product-a', name: 'Cimento', description: 'Saco de cimento',
    basePrice: '100.00', effectivePrice: '79.90', images: product.images,
  });
  assert.deepEqual(await service.list(), { items: [detail], total: 1, page: 1, limit: 20 });
  assert.equal(detail.coverUrl, product.images[0].url);
  assert.equal(detail.stock, 3);
  assert.deepEqual(detail.store, product.store);
  assert.deepEqual(detail.category, product.category);
  product.promotions[0].endAt = new Date(now - 1);
  assert.equal((await service.get('product-a')).effectivePrice, '100.00');
  product.promotions[0].endAt = new Date(now + 60_000);
  product.promotions[0].enabled = false;
  assert.equal((await service.get('product-a')).effectivePrice, '100.00');
  product.stock = 0;
  const empty = await service.get('product-a');
  assert.equal(empty.stock, 0);
  assert.equal(empty.inStock, false);
  assert.equal(empty.promotion, null);
});

test('public product query does not reveal products outside its eligibility filter', async () => {
  const service = new PublicProductsService({ product: { findFirst: async () => null } } as never);
  await assert.rejects(() => service.get('hidden-product'), NotFoundException);
});

test('public product detail respects exact UTC promotion boundaries', async (t) => {
  const startAt = new Date('2026-10-12T12:00:00Z');
  const endAt = new Date('2026-10-12T13:00:00Z');
  const product = {
    id: 'boundary', name: 'Produto', description: null, stock: 1, price: new Prisma.Decimal('100'),
    store: { id: 'store-a' }, category: { id: 'category-a' }, images: [],
    promotions: [{ enabled: true, promotionalPrice: new Prisma.Decimal('80'), discountPercent: null, startAt, endAt }],
  };
  const service = new PublicProductsService({ product: { findFirst: async () => product } } as never);
  t.mock.timers.enable({ apis: ['Date'], now: startAt.getTime() - 1 });
  assert.equal((await service.get('boundary')).effectivePrice, '100.00');
  t.mock.timers.tick(1);
  assert.equal((await service.get('boundary')).effectivePrice, '80.00');
  t.mock.timers.tick(3599999);
  assert.equal((await service.get('boundary')).effectivePrice, '80.00');
  t.mock.timers.tick(1);
  assert.equal((await service.get('boundary')).effectivePrice, '100.00');
  assert.equal((await service.get('boundary')).onPromotion, false);
});

test('public HTTP product detail applies the promotion and hides its internal fields', async () => {
  const now = Date.now();
  const row = {
    id: 'product-a', name: 'Cimento', description: null, price: new Prisma.Decimal('100'), stock: 3, images: [],
    store: { id: 'store-a', name: 'Loja' }, category: { id: 'category-a', name: 'Materiais' },
    promotions: [{ promotionalPrice: null, discountPercent: new Prisma.Decimal('25'), startAt: new Date(now - 1000), endAt: new Date(now + 60_000), enabled: true }],
  };
  const module = await Test.createTestingModule({
    controllers: [PublicProductsController],
    providers: [PublicProductsService, { provide: PrismaService, useValue: { product: { findFirst: async () => row } } }],
  }).compile();
  const app = module.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api');
  await app.listen(0, '127.0.0.1');
  try {
    const url = await app.getUrl();
    const current = await fetch(`${url}/api/products/product-a`);
    assert.equal(current.status, 200);
    const body = await current.json() as any;
    assert.equal(body.id, 'product-a');
    assert.equal(body.basePrice, '100.00');
    assert.equal(body.effectivePrice, '75.00');
    assert.equal(body.promotion.discountPercent, '25.00');
    assert.equal(body.promotion.enabled, undefined);
    row.promotions[0].endAt = new Date(now - 1);
    const expired = await fetch(`${url}/api/products/product-a`);
    assert.equal((await expired.json() as { effectivePrice: string }).effectivePrice, '100.00');
  } finally {
    await app.close();
  }
});
