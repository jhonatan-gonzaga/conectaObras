import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { StoreReviewsService } from '../src/modules/stores/store-reviews.service';

const databaseUrl = process.env.STORE_REVIEWS_TEST_DATABASE_URL;
const root = resolve(__dirname, '../..');

test('LOJA-026 MySQL: verified reviews, uniqueness, rating constraint and derived reputation', {
  skip: !databaseUrl && 'Configure STORE_REVIEWS_TEST_DATABASE_URL com um banco vazio store_reviews_test_*.',
  timeout: 180000,
}, async (t) => {
  const url = new URL(databaseUrl!);
  assert.equal(url.protocol, 'mysql:');
  assert.match(url.pathname, /^\/store_reviews_test_[a-zA-Z0-9_]+$/);
  const prisma = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
  const service = new StoreReviewsService(prisma as PrismaService);
  const cli = (...args: string[]) => execFileSync(process.execPath, [resolve(root, 'node_modules/prisma/build/index.js'), ...args], {
    cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl! }, stdio: 'pipe',
  });
  try {
    const [{ version }] = await prisma.$queryRaw<{ version: string }[]>`SELECT VERSION() AS version`;
    const [major, minor, patch] = version.split('.').map((part) => parseInt(part, 10));
    assert(!version.includes('MariaDB') && (major > 8 || (major === 8 && (minor > 0 || patch >= 16))), 'Requires MySQL >= 8.0.16 for enforced CHECK constraints.');
    const tables = await prisma.$queryRaw<unknown[]>`SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE()`;
    assert.equal(tables.length, 0, 'Use a fresh empty disposable database; never use COI.');
    cli('migrate', 'deploy');

    await prisma.user.createMany({ data: [
      { id: 'review-owner-a', name: 'Owner A', email: 'review-owner-a@example.test', passwordHash: 'test-only', role: 'LOJISTA' },
      { id: 'review-owner-b', name: 'Owner B', email: 'review-owner-b@example.test', passwordHash: 'test-only', role: 'LOJISTA' },
      { id: 'review-customer-a', name: 'Customer A', email: 'review-customer-a@example.test', passwordHash: 'test-only', role: 'CLIENTE' },
      { id: 'review-customer-b', name: 'Customer B', email: 'review-customer-b@example.test', passwordHash: 'test-only', role: 'CLIENTE' },
    ] });
    await prisma.storeProfile.createMany({ data: [
      { id: 'review-store-a', ownerId: 'review-owner-a', name: 'Store A', cnpj: '11222333000181', phone: '92999999999', status: 'ACTIVE' },
      { id: 'review-store-b', ownerId: 'review-owner-b', name: 'Store B', cnpj: '11222333000182', phone: '92999999998', status: 'ACTIVE' },
    ] });
    for (const id of ['race', 'low', 'high', 'invalid', 'undelivered', 'incomplete', 'other-customer', 'other-store']) {
      await prisma.storeOrder.create({ data: {
        id: `review-order-${id}`, storeId: id === 'other-store' ? 'review-store-b' : 'review-store-a',
        customerId: id.startsWith('other-') ? 'review-customer-b' : 'review-customer-a',
        status: id === 'incomplete' ? 'READY' : 'COMPLETED', total: '10.00',
        delivery: { create: { status: id === 'undelivered' ? 'IN_TRANSIT' : 'DELIVERED', deliveredAt: id === 'undelivered' ? null : new Date() } },
      } });
    }

    await t.test('migrates the unique index, rating CHECK and required relations without a stored average', async () => {
      const indexes = await prisma.$queryRaw<{ name: string; nonUnique: bigint }[]>`
        SELECT INDEX_NAME AS name, NON_UNIQUE AS nonUnique FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'store_reviews' AND COLUMN_NAME = 'orderId'`;
      assert.ok(indexes.some((index) => index.name === 'store_reviews_orderId_key' && Number(index.nonUnique) === 0));
      const storedReputation = await prisma.$queryRaw<unknown[]>`
        SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'store_profiles' AND COLUMN_NAME IN ('rating', 'averageRating', 'reviewCount')`;
      assert.equal(storedReputation.length, 0);
      const relations = await prisma.$queryRaw<{ rule: string }[]>`
        SELECT DELETE_RULE AS rule FROM information_schema.REFERENTIAL_CONSTRAINTS
        WHERE CONSTRAINT_SCHEMA = DATABASE() AND TABLE_NAME = 'store_reviews'`;
      assert.equal(relations.length, 3); assert.ok(relations.every((relation) => relation.rule === 'RESTRICT'));
      for (const rating of [0, 6]) {
        await assert.rejects(prisma.$executeRaw`
          INSERT INTO store_reviews (id, orderId, storeId, customerId, rating, updatedAt)
          VALUES (${`invalid-rating-${rating}`}, 'review-order-invalid', 'review-store-a', 'review-customer-a', ${rating}, NOW())`,
        (error: unknown) => error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2010'
          && String(error.meta?.message).includes('store_reviews_rating_check'));
      }
    });

    await t.test('rejects foreign authors, undelivered orders and a completed delivery without a completed order', async () => {
      await assert.rejects(service.create('review-customer-a', 'review-order-other-customer', { rating: 5 }), NotFoundException);
      await assert.rejects(service.create('review-customer-a', 'review-order-undelivered', { rating: 5 }), BadRequestException);
      await assert.rejects(service.create('review-customer-a', 'review-order-incomplete', { rating: 5 }), BadRequestException);
      assert.equal(await prisma.storeReview.count(), 0);
    });

    await t.test('accepts exactly one simultaneous review for the same delivered order', async () => {
      const results = await Promise.allSettled([
        service.create('review-customer-a', 'review-order-race', { rating: 3, comment: 'First request' }),
        service.create('review-customer-a', 'review-order-race', { rating: 3, comment: 'Concurrent request' }),
      ]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      const rejected = results.find((result) => result.status === 'rejected');
      assert.ok(rejected?.status === 'rejected' && rejected.reason instanceof ConflictException);
      assert.equal(await prisma.storeReview.count({ where: { orderId: 'review-order-race' } }), 1);
      await assert.rejects(service.create('review-customer-a', 'review-order-race', { rating: 5 }), ConflictException);
    });

    await t.test('uses real aggregates for the whole store, stable pagination and public author privacy', async () => {
      await service.create('review-customer-a', 'review-order-low', { rating: 1 });
      await service.create('review-customer-a', 'review-order-high', { rating: 5, comment: '  Excellent  ' });
      await service.create('review-customer-b', 'review-order-other-store', { rating: 2 });
      const page1 = await service.listPublic('review-store-a', { page: 1, limit: 2 });
      const page2 = await service.listPublic('review-store-a', { page: 2, limit: 2 });
      const empty = await service.listPublic('review-store-a', { page: 3, limit: 2 });
      const reputation = { averageRating: 3, reviewCount: 3, distribution: { 1: 1, 2: 0, 3: 1, 4: 0, 5: 1 } };
      assert.deepEqual(page1.reputation, reputation); assert.deepEqual(page2.reputation, reputation); assert.deepEqual(empty.reputation, reputation);
      assert.equal(page1.total, 3); assert.equal(page1.items.length, 2); assert.equal(page2.items.length, 1); assert.deepEqual(empty.items, []);
      assert.equal(new Set([...page1.items, ...page2.items].map((review) => review.id)).size, 3);
      assert.deepEqual((await service.listMine('review-owner-a')).reputation, reputation);
      assert.equal((await service.listMine('review-owner-b')).reputation.averageRating, 2);
      for (const review of [...page1.items, ...page2.items]) {
        assert.ok(!('orderId' in review) && !('customerId' in review));
        assert.deepEqual(review.customer, { name: 'Customer A' });
        assert.ok(review.createdAt instanceof Date && review.updatedAt instanceof Date);
      }
      assert.equal(page1.items.find((review) => review.rating === 5)?.comment, 'Excellent');
      await prisma.storeProfile.update({ where: { id: 'review-store-a' }, data: { status: 'INACTIVE' } });
      await assert.rejects(service.listPublic('review-store-a'), NotFoundException);
      assert.deepEqual((await service.listMine('review-owner-a')).reputation, reputation);
    });
  } finally { await prisma.$disconnect(); }
});
