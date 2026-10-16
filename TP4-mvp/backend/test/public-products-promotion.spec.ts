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
    id: 'product-a', name: 'Cimento', description: 'Saco de cimento', price: new Prisma.Decimal('100.00'),
    images: [{ url: 'https://example.com/cimento.jpg', altText: 'Cimento', isCover: true }],
    promotions: [{ promotionalPrice: new Prisma.Decimal('79.90'), discountPercent: null, startAt: new Date(now - 1000), endAt: new Date(now + 60_000), enabled: true }],
  };
  const prisma = { product: {
    findFirst: async ({ where }: any) => { assert.equal(where.status, 'ACTIVE'); assert.equal(where.stock.gt, 0); return product; },
    findMany: async ({ where }: any) => { assert.equal(where.store.status, 'ACTIVE'); return [product]; },
  } };
  const service = new PublicProductsService(prisma as never);
  const detail = await service.get('product-a');
  assert.deepEqual(detail, {
    id: 'product-a', name: 'Cimento', description: 'Saco de cimento',
    basePrice: '100.00', effectivePrice: '79.90', images: product.images,
  });
  assert.deepEqual(await service.list(), [detail]);
  product.promotions[0].endAt = new Date(now - 1);
  assert.equal((await service.get('product-a')).effectivePrice, '100.00');
  product.promotions[0].endAt = new Date(now + 60_000);
  product.promotions[0].enabled = false;
  assert.equal((await service.get('product-a')).effectivePrice, '100.00');
});

test('public product query does not reveal products outside its eligibility filter', async () => {
  const service = new PublicProductsService({ product: { findFirst: async () => null } } as never);
  await assert.rejects(() => service.get('hidden-product'), NotFoundException);
});

test('public HTTP product detail applies the promotion and hides its internal fields', async () => {
  const now = Date.now();
  const row = {
    id: 'product-a', name: 'Cimento', description: null, price: new Prisma.Decimal('100'), images: [],
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
    assert.deepEqual(await current.json(), {
      id: 'product-a', name: 'Cimento', description: null,
      basePrice: '100.00', effectivePrice: '75.00', images: [],
    });
    row.promotions[0].endAt = new Date(now - 1);
    const expired = await fetch(`${url}/api/products/product-a`);
    assert.equal((await expired.json() as { effectivePrice: string }).effectivePrice, '100.00');
  } finally {
    await app.close();
  }
});
