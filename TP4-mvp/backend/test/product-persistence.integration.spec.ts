import { strict as assert } from 'node:assert';
import { execFileSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '../src/prisma/prisma.service';
import { PrismaProductRepository } from '../src/modules/products/infrastructure/prisma-product.repository';

const databaseUrl = process.env.PRODUCT_TEST_DATABASE_URL;
const root = resolve(__dirname, '../..');
const migration = '20260926090000_add_product_catalog';

test('Catalogo em MySQL: migration, constraints, FK, imagens e isolamento', {
  skip: !databaseUrl && 'Configure PRODUCT_TEST_DATABASE_URL com um banco vazio catalog_test_*.',
  timeout: 180000,
}, async (t) => {
  const url = new URL(databaseUrl!);
  assert.equal(url.protocol, 'mysql:');
  assert.match(url.pathname, /^\/catalog_test_[a-zA-Z0-9_]+$/);
  const client = new PrismaClient({ datasources: { db: { url: databaseUrl! } } });
  const stagingPrefix = resolve(root, 'node_modules/.catalog-migrations-');
  const staging = mkdtempSync(stagingPrefix);
  const cli = (...args: string[]) => execFileSync(process.execPath, [
    resolve(root, 'node_modules/prisma/build/index.js'), ...args,
  ], { cwd: root, env: { ...process.env, DATABASE_URL: databaseUrl! }, stdio: 'pipe' });
  try {
    const [{ version }] = await client.$queryRaw<Array<{ version: string }>>`SELECT VERSION() AS version`;
    const [major, minor, patch] = version.split('.').map(Number);
    assert(!version.includes('MariaDB') && (major > 8 || (major === 8 && (minor > 0 || patch >= 16))),
      'Requires MySQL >= 8.0.16 with enforced CHECK constraints');
    const tables = await client.$queryRaw<unknown[]>`SELECT TABLE_NAME FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE()`;
    assert.equal(tables.length, 0, 'Use a fresh empty disposable database for each run');

    await t.test('aplica historico anterior e nova migration preservando loja e categorias profissionais', async () => {
      cpSync(resolve(root, 'prisma/schema.prisma'), resolve(staging, 'schema.prisma'));
      mkdirSync(resolve(staging, 'migrations'));
      for (const entry of readdirSync(resolve(root, 'prisma/migrations'))) {
        if (entry === 'migration_lock.toml' || entry < migration) {
          cpSync(resolve(root, 'prisma/migrations', entry), resolve(staging, 'migrations', entry), { recursive: true });
        }
      }
      cli('migrate', 'deploy', '--schema', resolve(staging, 'schema.prisma'));
      await client.user.create({ data: {
        id: 'existing-owner', name: 'Existing owner', email: 'catalog-owner@example.test',
        passwordHash: 'test-only', role: 'LOJISTA',
      } });
      const store = await client.storeProfile.create({ data: { id: 'existing-store', ownerId: 'existing-owner' } });
      const category = await client.category.create({ data: { id: 'service-category', name: 'Pintura' } });
      cli('migrate', 'deploy');
      assert.deepEqual(await client.storeProfile.findUnique({ where: { id: store.id } }), store);
      assert.deepEqual(await client.category.findUnique({ where: { id: category.id } }), category);
      assert.equal(await client.productCategory.count(), 0, 'Service categories must not be reused or copied');
      assert.equal(await client.product.count(), 0);
      cli('migrate', 'deploy');
      cli('migrate', 'status');
      const applied = await client.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count
        FROM _prisma_migrations WHERE migration_name = ${migration} AND finished_at IS NOT NULL`;
      assert.equal(Number(applied[0].count), 1);
    });

    await t.test('cria os indices de busca e unicidade planejados', async () => {
      const indexes = await client.$queryRaw<Array<{ name: string; columns: string }>>`
        SELECT INDEX_NAME AS name, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS columns
        FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products'
        GROUP BY INDEX_NAME`;
      for (const columns of ['storeId,status', 'categoryId,status', 'name', 'storeId,sku']) {
        assert(indexes.some((index) => index.columns === columns), `Missing index: ${columns}`);
      }
    });

    await t.test('criacao de produto e imagens e atomica quando uma imagem e invalida', async () => {
      const repository = new PrismaProductRepository(client as PrismaService);
      const category = await client.productCategory.create({ data: { name: 'Atomic', slug: 'atomic' } });
      const before = await client.product.count();
      await assert.rejects(repository.create('existing-store', {
        categoryId: category.id, name: 'Atomic', price: '1.00', stock: 0,
        images: [{ url: '/invalid.jpg', position: -1 }],
      }));
      assert.equal(await client.product.count(), before);
      await client.productCategory.delete({ where: { id: category.id } });
    });

    const rollback = new Error('Rollback catalog fixtures');
    await client.$transaction(async (tx) => {
      const repository = new PrismaProductRepository(tx as unknown as PrismaService);
      await tx.user.create({ data: {
        id: 'other-owner', name: 'Other owner', email: 'other-owner@example.test', passwordHash: 'test-only', role: 'LOJISTA',
      } });
      const storeA = 'existing-store';
      const storeB = (await tx.storeProfile.create({ data: { ownerId: 'other-owner' } })).id;
      const category = await tx.productCategory.create({ data: { name: 'Pintura', slug: 'pintura' } });
      const input = { categoryId: category.id, sku: 'SKU-01', name: 'Tinta', price: '49.90', stock: 4 };
      const product = await repository.create(storeA, input);
      const duplicate = (operation: Promise<unknown>) => assert.rejects(operation, { code: 'P2002' });
      const foreignKey = (operation: Promise<unknown>) => assert.rejects(operation, { code: 'P2003' });
      const sqlError = (code: string, query: string, ...values: unknown[]) => assert.rejects(
        tx.$executeRawUnsafe(query, ...values),
        (error: any) => error.code === 'P2010' && String(error.meta?.code) === code,
      );

      await t.test('slug unico e SKU unico por loja, permitindo SKU repetido em outra loja e varios null', async () => {
        await duplicate(tx.productCategory.create({ data: { name: 'Duplicada', slug: 'pintura' } }));
        await duplicate(repository.create(storeA, { ...input, sku: ' sku-01 ' }));
        await duplicate(tx.product.create({ data: { ...input, storeId: storeA, sku: 'sku-01' } }));
        await repository.create(storeB, input);
        await repository.create(storeA, { ...input, sku: null });
        await repository.create(storeA, { ...input, sku: null });
        assert.equal(await tx.product.count({ where: { storeId: storeA, sku: null } }), 2);
        assert.equal(product.price, '49.90');
        assert.equal(product.status, 'DRAFT');
        assert(product.lastPriceUpdateAt instanceof Date);
      });

      await t.test('NOT NULL e CHECK protegem preco, estoque e posicao inclusive em SQL direto', async () => {
        for (const field of ['price', 'stock']) {
          await sqlError('1048', `UPDATE products SET ${field} = NULL WHERE id = ?`, product.id);
        }
        await sqlError('1364', 'INSERT INTO products (id, storeId, categoryId, name, updatedAt) VALUES (?, ?, ?, ?, NOW(3))',
          'no-price', storeA, category.id, 'Sem preco');
        for (const price of ['0', '-1']) {
          await sqlError('3819', 'UPDATE products SET price = ? WHERE id = ?', price, product.id);
        }
        await sqlError('3819', 'UPDATE products SET stock = -1 WHERE id = ?', product.id);
        const zeroStock = await tx.product.create({ data: {
          storeId: storeA, categoryId: category.id, name: 'Estoque padrao', price: '0.01',
        } });
        assert.equal(zeroStock.stock, 0);
        const maxPrice = await repository.create(storeA, { ...input, sku: null, price: '99999999.99' });
        assert.equal(maxPrice.price, '99999999.99');
      });

      await t.test('FK impede produto sem loja/categoria, categoria profissional e imagem orfa', async () => {
        await foreignKey(repository.create('missing-store', input));
        await foreignKey(repository.create(storeA, { ...input, sku: null, categoryId: 'missing-category' }));
        await foreignKey(repository.create(storeA, { ...input, sku: null, categoryId: 'service-category' }));
        await foreignKey(tx.productImage.create({ data: { productId: 'missing-product', url: '/orphan.jpg' } }));
        await foreignKey(tx.storeProfile.delete({ where: { id: storeA } }));
        await foreignKey(tx.user.delete({ where: { id: 'existing-owner' } }));
        await foreignKey(tx.productCategory.delete({ where: { id: category.id } }));
      });

      await t.test('imagens sao ordenadas por posicao e id, preservando chave, alt e capa', async () => {
        await tx.productImage.createMany({ data: [
          { id: 'image-z', productId: product.id, url: '/last.jpg', position: 9 },
          { id: 'image-b', productId: product.id, url: '/b.jpg', position: 1 },
          { id: 'image-a', productId: product.id, url: '/a.jpg', position: 1, isCover: true, altText: 'Lata', objectKey: 'products/a.jpg' },
        ] });
        const detail = await repository.findByStore(storeA, product.id);
        assert.deepEqual(detail!.images.map((image) => image.id), ['image-a', 'image-b', 'image-z']);
        assert.equal(detail!.images[0].objectKey, 'products/a.jpg');
        assert.equal(detail!.images[0].altText, 'Lata');
        assert.equal(detail!.images[0].isCover, true);
        const list = await repository.listByStore(storeA);
        assert.deepEqual(list.find((item) => item.id === product.id)!.images, detail!.images);
        await sqlError('3819', 'UPDATE product_images SET position = -1 WHERE id = ?', 'image-a');
      });

      await t.test('loja B nao le, arquiva nem altera preco de produto da loja A', async () => {
        const before = await repository.findByStore(storeA, product.id);
        assert.equal(await repository.findByStore(storeB, product.id), null);
        const productsB = await repository.listByStore(storeB);
        assert.equal(productsB.length, 1);
        assert(productsB.every((item) => item.storeId === storeB));
        assert.equal(await repository.archive(storeB, product.id), false);
        assert.equal(await repository.updatePrice(storeB, product.id, '12.30'), false);
        assert.deepEqual(await repository.findByStore(storeA, product.id), before);
      });

      await t.test('preco e timestamp mudam juntos; preco igual preserva a data', async () => {
        const oldDate = new Date('2020-01-01T00:00:00.000Z');
        await tx.product.update({ where: { id: product.id }, data: { lastPriceUpdateAt: oldDate } });
        assert.equal(await repository.updatePrice(storeA, product.id, '49.90'), false);
        assert.deepEqual((await repository.findByStore(storeA, product.id))!.lastPriceUpdateAt, oldDate);
        assert.equal(await repository.updatePrice(storeA, product.id, '12.30'), true);
        const changed = (await repository.findByStore(storeA, product.id))!;
        assert.equal(changed.price, '12.30');
        assert(changed.lastPriceUpdateAt > oldDate);
      });

      await t.test('arquivamento preserva produto, imagens e SKU; arquivado nao muda preco', async () => {
        const before = (await repository.findByStore(storeA, product.id))!;
        assert.equal(await repository.archive(storeA, product.id), true);
        const archived = (await repository.findByStore(storeA, product.id))!;
        assert.equal(archived.status, 'ARCHIVED');
        assert.equal(archived.price, before.price);
        assert.equal(archived.stock, before.stock);
        assert.deepEqual(archived.images, before.images);
        assert.equal(await repository.updatePrice(storeA, product.id, '99'), false);
        assert.deepEqual((await repository.listByStore(storeA, 'ARCHIVED')).map((item) => item.id), [product.id]);
        await duplicate(repository.create(storeA, input));
        await foreignKey(tx.storeProfile.delete({ where: { id: storeA } }));
      });

      await t.test('exclusao fisica de manutencao nao deixa imagens orfas', async () => {
        const disposable = await repository.create(storeA, {
          ...input, sku: null, images: [{ url: '/disposable.jpg', position: 0 }],
        });
        await tx.product.delete({ where: { id: disposable.id } });
        assert.equal(await tx.productImage.count({ where: { productId: disposable.id } }), 0);
      });
      throw rollback;
    }, { timeout: 60000 }).catch((error) => { if (error !== rollback) throw error; });
  } finally {
    await client.$disconnect();
    assert(staging.startsWith(stagingPrefix), 'Cleanup must stay within the temporary test directory');
    rmSync(staging, { recursive: true, force: true });
  }
});
