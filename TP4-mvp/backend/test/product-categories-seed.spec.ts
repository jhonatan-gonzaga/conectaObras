import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';
import { PrismaClient } from '@prisma/client';

const { productCategories, seedProductCategories } = require(
  resolve(process.cwd(), 'prisma/seed-product-categories.js'),
) as {
  productCategories: Array<{ name: string; slug: string }>;
  seedProductCategories: (prisma: any) => Promise<void>;
};

describe('seed de categorias de produto', () => {
  it('popula um catálogo vazio e não escreve nas categorias de serviço', async () => {
    const productRows = new Map<string, { name: string; slug: string }>();
    const serviceRows = [{ id: 'service-category', name: 'Pintura' }];
    const prisma = {
      productCategory: {
        upsert: async ({ where, create }: any) => {
          assert.equal(where.slug, create.slug);
          if (!productRows.has(where.slug)) productRows.set(where.slug, create);
        },
      },
      category: {
        upsert: () => { throw new Error('Categorias de serviço não devem ser alteradas'); },
      },
    };

    await seedProductCategories(prisma);
    assert.equal(productRows.size, 9);
    assert.deepEqual([...productRows.values()], productCategories);
    assert.deepEqual(serviceRows, [{ id: 'service-category', name: 'Pintura' }]);

    await seedProductCategories(prisma);
    assert.equal(productRows.size, 9);
    assert.deepEqual([...productRows.values()], productCategories);
  });

  it('popula um MySQL vazio duas vezes preservando categorias de serviço', {
    skip: !process.env.PRODUCT_CATEGORIES_TEST_DATABASE_URL &&
      'Configure PRODUCT_CATEGORIES_TEST_DATABASE_URL com um banco vazio product_categories_test_*.',
    timeout: 180000,
  }, async () => {
    const databaseUrl = process.env.PRODUCT_CATEGORIES_TEST_DATABASE_URL!;
    const url = new URL(databaseUrl);
    assert.equal(url.protocol, 'mysql:');
    assert.match(url.pathname, /^\/product_categories_test_[a-zA-Z0-9_]+$/);

    const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
    const root = resolve(process.cwd());
    const cli = (...args: string[]) => execFileSync(process.execPath, [
      resolve(root, 'node_modules/prisma/build/index.js'), ...args,
    ], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });
    const runSeed = () => execFileSync(process.execPath, [
      resolve(root, 'prisma/seed-product-categories.js'),
    ], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl }, stdio: 'pipe' });

    try {
      const tables = await client.$queryRaw<unknown[]>`SELECT TABLE_NAME FROM information_schema.TABLES
        WHERE TABLE_SCHEMA = DATABASE()`;
      assert.equal(tables.length, 0, 'Use um banco descartável vazio em cada execução');
      cli('migrate', 'deploy');

      const serviceCategory = await client.category.create({
        data: { id: 'service-category', name: 'Pintura' },
      });

      runSeed();
      assert.equal(await client.productCategory.count(), productCategories.length);
      assert.deepEqual(
        (await client.productCategory.findMany({ orderBy: { slug: 'asc' } })).map(({ slug, name }) => ({ slug, name })),
        [...productCategories].sort((a, b) => a.slug.localeCompare(b.slug)).map(({ slug, name }) => ({ slug, name })),
      );

      const beforeSecondRun = await client.productCategory.findMany({ orderBy: { slug: 'asc' } });
      runSeed();
      assert.deepEqual(await client.productCategory.findMany({ orderBy: { slug: 'asc' } }), beforeSecondRun);
      assert.deepEqual(await client.category.findMany(), [serviceCategory]);
    } finally {
      await client.$disconnect();
    }
  });
});
