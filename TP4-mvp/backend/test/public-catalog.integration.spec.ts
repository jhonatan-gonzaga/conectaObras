import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { performance } from 'node:perf_hooks';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaClient, Prisma } from '@prisma/client';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { EffectivePriceService } from '../src/modules/stores/promotion.policy';
import { weekDays } from '../src/modules/stores/public-store.policy';

const databaseUrl = process.env.PUBLIC_CATALOG_TEST_DATABASE_URL;

test('public catalog: real MySQL, HTTP, combined filters, pagination and bounded SQL queries', {
  skip: !databaseUrl && 'Configure PUBLIC_CATALOG_TEST_DATABASE_URL with a migrated disposable catalog_public_test_* database.',
  timeout: 120000,
}, async (t) => {
  const url = new URL(databaseUrl!);
  assert.equal(url.protocol, 'mysql:');
  assert.match(url.pathname, /^\/catalog_public_test_[a-zA-Z0-9_]+$/);
  const prisma = new PrismaClient({
    datasources: { db: { url: databaseUrl! } }, log: [{ emit: 'event', level: 'query' }],
  });
  const queries: string[] = [];
  prisma.$on('query', (event) => queries.push(event.query));
  const prefix = `public-${process.pid}-`;
  const id = (name: string) => `${prefix}${name}`;
  const cnpj = (index: number) => {
    let digits = `${process.pid}${index}`.padStart(12, '1').slice(-12);
    for (const weights of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
      const remainder = [...digits].reduce((sum, digit, i) => sum + Number(digit) * weights[i], 0) % 11;
      digits += remainder < 2 ? '0' : String(11 - remainder);
    }
    return digits;
  };
  let app: NestExpressApplication | undefined;
  try {
    const now = new Date();
    const stores = [
      ['a', 'ACTIVE', 'Manaus', 'Centro', 'AM'], ['b', 'ACTIVE', 'Manaus', 'Flores', 'AM'],
      ['c', 'ACTIVE', 'Sao Paulo', 'Centro', 'SP'], ['inactive', 'INACTIVE', 'Manaus', 'Centro', 'AM'],
      ['draft', 'DRAFT', 'Manaus', 'Centro', 'AM'], ['acre', 'ACTIVE', 'Rio Branco', 'Centro', 'AC'],
      ['west', 'ACTIVE', 'Eirunepe', 'Centro', 'AM'], ['island', 'ACTIVE', 'Fernando de Noronha', 'Centro', 'PE'],
      ...Array.from({ length: 30 }, (_, i) => [`bulk-${i}`, 'ACTIVE', 'Manaus', 'Volume', 'AM']),
    ];
    await prisma.user.createMany({ data: stores.map(([key]) => ({
      id: id(`owner-${key}`), name: 'Private owner', email: `${id(key)}@example.test`, passwordHash: 'private-hash', role: 'LOJISTA',
    })) });
    await prisma.storeProfile.createMany({ data: stores.map(([key, status], index) => ({
      id: id(key), ownerId: id(`owner-${key}`), name: key.startsWith('bulk') ? 'Volume' : 'Casa Obras',
      status: status as 'ACTIVE', cnpj: cnpj(index), phone: '92999999999', description: 'Materiais de construcao', logoUrl: '/store.jpg',
    })) });
    await prisma.storeAddress.createMany({ data: stores.map(([key, , city, neighborhood, state]) => ({
      storeId: id(key), street: 'Rua das Obras', number: '10', zipCode: '69000000', city, neighborhood, state,
    })) });
    await prisma.storeOpeningHour.createMany({ data: stores.flatMap(([key]) => [...weekDays].reverse().map((dayOfWeek) => ({
      storeId: id(key), dayOfWeek, closed: key === 'b', openingTime: key === 'b' ? null : '00:00', closingTime: key === 'b' ? null : '23:59',
    }))) });
    await prisma.productCategory.createMany({ data: [
      { id: id('materials'), name: 'Materiais', slug: id('materials'), active: true },
      { id: id('paint'), name: 'Pintura', slug: id('paint'), active: true },
      { id: id('disabled-category'), name: 'Oculta', slug: id('disabled-category'), active: false },
    ] });
    const fixture = (key: string, overrides: Partial<Prisma.ProductCreateManyInput> = {}): Prisma.ProductCreateManyInput => ({
      id: id(key), storeId: id('a'), categoryId: id('materials'), name: key,
      description: 'Material para reforma', price: '100.00', stock: 10, status: 'ACTIVE', createdAt: now, ...overrides,
    });
    const products = [
      fixture('cement', { name: 'Cimento especial' }), fixture('paint', { categoryId: id('paint'), name: 'Tinta azul' }),
      fixture('zero', { stock: 0 }), fixture('future'), fixture('expired'), fixture('disabled'),
      fixture('plain', { storeId: id('b'), price: '25' }), fixture('rounding', { price: '19.99' }),
      fixture('literal', { name: 'Parafuso 100%_x' }),
      fixture('inactive-product', { status: 'INACTIVE' }), fixture('draft-product', { status: 'DRAFT' }),
      fixture('archived-product', { status: 'ARCHIVED' }), fixture('inactive-store-product', { storeId: id('inactive') }),
      fixture('draft-store-product', { storeId: id('draft') }), fixture('disabled-category-product', { categoryId: id('disabled-category') }),
      ...Array.from({ length: 1200 }, (_, i) => fixture(`bulk-product-${String(i).padStart(4, '0')}`, {
        storeId: id(`bulk-${i % 30}`), name: 'Produto de volume', stock: i % 3 === 0 ? 0 : 10,
      })),
    ];
    await prisma.product.createMany({ data: products });
    await prisma.productImage.createMany({ data: products.flatMap((product) => [
      { productId: product.id!, url: '/secondary.jpg', objectKey: 'private-key', position: 0, isCover: false },
      { productId: product.id!, url: '/cover.jpg', objectKey: 'private-cover-key', position: 1, isCover: true },
    ]) });
    const promotion = (key: string, overrides: Partial<Prisma.StorePromotionCreateManyInput> = {}): Prisma.StorePromotionCreateManyInput => ({
      id: id(`promotion-${key}`), storeId: id('a'), productId: id(key), promotionalPrice: '80', enabled: true,
      startAt: new Date(now.getTime() - 3600000), endAt: new Date(now.getTime() + 3600000), ...overrides,
    });
    await prisma.storePromotion.createMany({ data: [
      promotion('cement'), promotion('paint', { promotionalPrice: null, discountPercent: '12.50' }),
      promotion('zero', { promotionalPrice: '60' }), promotion('disabled', { enabled: false }),
      promotion('future', { startAt: new Date(now.getTime() + 1800000) }),
      promotion('expired', { endAt: new Date(now.getTime() - 1) }),
      promotion('rounding', { promotionalPrice: null, discountPercent: '12.50' }),
      ...Array.from({ length: 1200 }, (_, i) => promotion(`bulk-product-${String(i).padStart(4, '0')}`, { storeId: id(`bulk-${i % 30}`) })),
    ] });
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma).compile();
    app = module.createNestApplication<NestExpressApplication>();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.listen(0, '127.0.0.1');
    const baseUrl = await app.getUrl();
    const response = (path: string) => fetch(`${baseUrl}/api/${path}`);
    const get = async (path: string): Promise<any> => {
      const result = await response(path);
      assert.equal(result.status, 200, `${path}: ${await result.clone().text()}`);
      return result.json();
    };
    const productList = (query: string) => get(`products?${query}`);
    const storeList = (query: string) => get(`stores?${query}`);
    const ids = (items: any[]) => items.map((item) => item.id);

    await t.test('eligible detail/list, zero stock, public projection and private route precedence', async () => {
      for (const key of ['missing', 'inactive', 'draft']) assert.equal((await response(`stores/${id(key)}`)).status, 404);
      for (const key of ['missing', 'inactive-product', 'draft-product', 'archived-product', 'inactive-store-product', 'draft-store-product', 'disabled-category-product']) {
        assert.equal((await response(`products/${id(key)}`)).status, 404, key);
      }
      for (const route of ['stores/me', 'stores/me/identity', 'stores/me/dashboard']) assert.equal((await response(route)).status, 401);
      const detail = await get(`products/${id('cement')}`);
      assert.equal(detail.coverUrl, '/cover.jpg');
      assert.equal(detail.effectivePrice, '80.00');
      assert.equal(detail.stock, 10);
      assert.equal(detail.store.id, id('a'));
      assert.equal(detail.category.id, id('materials'));
      const serialized = JSON.stringify(detail);
      for (const field of ['ownerId', 'passwordHash', 'objectKey', 'inventoryEvents', 'cnpj', 'enabled']) assert(!serialized.includes(field), field);
      assert.equal((await get(`products/${id('zero')}`)).stock, 0);
      assert.equal((await get(`products/${id('zero')}`)).effectivePrice, '100.00');
      const store = await get(`stores/${id('a')}`);
      assert.deepEqual(store.openingHours.map((hour: any) => hour.dayOfWeek), weekDays);
      assert.equal(store.timeZone, 'America/Manaus');
      assert.deepEqual(store.promotions.map((item: any) => item.productId).sort(), [id('cement'), id('paint'), id('rounding')].sort());
      for (const field of ['ownerId', 'cnpj', 'passwordHash', 'enabled']) assert(!JSON.stringify(store).includes(field), field);
    });

    await t.test('store filters individually and combined, including open/closed before pagination', async () => {
      assert.equal((await storeList('q=construcao&limit=100')).total, 36);
      assert.equal((await storeList('city=Manaus&limit=100')).total, 32);
      assert.equal((await storeList('neighborhood=Flores')).total, 1);
      assert.equal((await storeList('city=Manaus&neighborhood=Centro')).total, 1);
      assert.equal((await storeList('city=Inexistente')).total, 0);
      assert.equal((await storeList('q=sem-resultado')).total, 0);
      const all = await storeList('limit=100');
      for (const openNow of [true, false]) {
        const expected = all.items.filter((item: any) => item.openNow === openNow);
        const filtered = await storeList(`openNow=${openNow}&limit=100`);
        assert.deepEqual(ids(filtered.items), ids(expected));
        const combined = await storeList(`q=Obras&city=Manaus&neighborhood=Flores&openNow=${openNow}&limit=1`);
        assert.equal(combined.total, openNow ? 0 : 1);
      }
      assert.equal((await get(`stores/${id('west')}`)).timeZone, 'America/Rio_Branco');
      assert.equal((await get(`stores/${id('island')}`)).timeZone, 'America/Noronha');
    });

    await t.test('product filters individually and combined use effective prices and available inventory', async () => {
      assert.equal((await productList('limit=100')).total, 1209);
      assert.equal((await productList('q=Cimento')).total, 1);
      assert.equal((await productList(`categoryId=${id('paint')}`)).total, 1);
      assert.equal((await productList(`storeId=${id('a')}`)).total, 8);
      assert.equal((await productList(`storeId=${id('missing')}`)).total, 0);
      assert.equal((await productList(`categoryId=${id('missing')}`)).total, 0);
      assert.equal((await productList('minPrice=99.99')).total, 405);
      assert.equal((await productList('maxPrice=25')).total, 2);
      assert.equal((await productList('inStock=true')).total, 808);
      assert.equal((await productList('inStock=false')).total, 401);
      assert.equal((await productList('onPromotion=true')).total, 803);
      assert.equal((await productList('onPromotion=false')).total, 406);
      assert.equal((await productList('q=%25_x')).total, 1);
      assert.equal((await productList("q=%27%20OR%201%3D1%20--")).total, 0);
      const combined = await productList(`storeId=${id('a')}&categoryId=${id('materials')}&q=cimento&minPrice=79.99&maxPrice=80&inStock=true&onPromotion=true&limit=1`);
      assert.equal(combined.total, 1);
      assert.deepEqual(ids(combined.items), [id('cement')]);
      assert.equal((await productList('minPrice=80.01&maxPrice=80.02')).total, 0);
      assert.equal((await productList(`storeId=${id('a')}&inStock=false`)).total, 1);
      assert.equal((await productList(`storeId=${id('a')}&inStock=true`)).total, 7);
      const zero = await productList(`storeId=${id('a')}&inStock=false&onPromotion=true`);
      assert.equal(zero.total, 0);
      const listed = (await productList(`q=Cimento`)).items[0];
      assert.deepEqual(listed, await get(`products/${id('cement')}`));
      assert.equal((await response('products?minPrice=20&maxPrice=10')).status, 400);
    });

    await t.test('current, future, expired and disabled promotions and rounding match detail and filters', async () => {
      const plain = await get(`products/${id('plain')}`);
      assert.equal(plain.onPromotion, false);
      assert.equal(plain.effectivePrice, '25.00');
      for (const key of ['zero', 'future', 'expired', 'disabled']) {
        const item = await get(`products/${id(key)}`);
        assert.equal(item.effectivePrice, '100.00', key);
        assert.equal(item.onPromotion, false, key);
      }
      assert.equal((await get(`products/${id('paint')}`)).effectivePrice, '87.50');
      assert.equal((await get(`products/${id('rounding')}`)).effectivePrice, '17.49');
      assert.deepEqual(ids((await productList('minPrice=17.49&maxPrice=17.49')).items), [id('rounding')]);
      assert.equal((await productList(`storeId=${id('a')}&onPromotion=true`)).total, 3);
      assert.equal((await productList(`storeId=${id('a')}&onPromotion=false`)).total, 5);
      // UTC start inclusive / end exclusive, and SQL/Decimal agreement at exact instants.
      const start = new Date('2026-01-01T04:00:00Z');
      const end = new Date('2026-01-02T04:00:00Z');
      const terms = { enabled: true, promotionalPrice: null, discountPercent: new Prisma.Decimal('12.50'), startAt: start, endAt: end };
      for (const at of [new Date(start.getTime() - 1), start, new Date(end.getTime() - 1), end]) {
        const sql = new EffectivePriceService().getEffectivePriceSql(Prisma.sql`19.99`, Prisma.sql`NULL`, Prisma.sql`12.50`, Prisma.sql`${at} >= ${start} AND ${at} < ${end}`);
        const [row] = await prisma.$queryRaw<{ price: Prisma.Decimal }[]>(Prisma.sql`SELECT ${sql} AS price`);
        assert.equal(row.price.toFixed(2), new EffectivePriceService().getEffectivePrice('19.99', terms, at).toFixed(2));
      }
    });

    await t.test('stable pages, ties, last/empty pages, different limits and combined filters', async () => {
      for (const [route, query] of [['stores', 'q=Obras'], ['products', `storeId=${id('a')}&inStock=true`]]) {
        const all = await get(`${route}?${query}&limit=100`);
        for (const limit of [1, 3, 4]) {
          const paged: string[] = [];
          for (let page = 1; page <= Math.ceil(all.total / limit); page++) {
            const current = await get(`${route}?${query}&page=${page}&limit=${limit}`);
            assert.equal(current.total, all.total);
            assert.equal(current.page, page);
            assert.equal(current.limit, limit);
            paged.push(...ids(current.items));
          }
          assert.deepEqual(paged, ids(all.items));
          assert.equal(new Set(paged).size, all.total);
          const empty = await get(`${route}?${query}&page=999&limit=${limit}`);
          assert.deepEqual(empty.items, []);
          assert.equal(empty.total, all.total);
        }
      }
    });

    await t.test('1200 products: SQL query count stays bounded as page/relationship count increases', async () => {
      const measure = async (path: string) => {
        queries.length = 0;
        const start = performance.now();
        const result = await get(path);
        return { result, count: queries.filter((query) => /^\s*(SELECT|WITH)\b/i.test(query)).length, duration: performance.now() - start };
      };
      for (const route of ['products?q=volume&inStock=true&onPromotion=true&minPrice=79&maxPrice=81', 'stores?neighborhood=Volume']) {
        const small = await measure(`${route}&limit=1`);
        const large = await measure(`${route}&limit=100`);
        assert.equal(large.count, small.count, route);
        assert(large.count <= 12, `${route}: ${large.count} SQL queries`);
        assert(large.duration < 2000, `${route}: ${large.duration}ms`);
        assert.equal(large.result.total, route.startsWith('products') ? 800 : 30);
        t.diagnostic(`${route.split('?')[0]}: ${large.result.items.length} items, ${large.count} SQL statements, ${large.duration.toFixed(1)}ms`);
      }
      const indexes = await prisma.$queryRaw<{ name: string }[]>`SELECT INDEX_NAME AS name FROM information_schema.STATISTICS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'products' AND INDEX_NAME = 'products_status_createdAt_id_idx'`;
      assert(indexes.length > 0);
      assert.equal((await response('professionals?q=sem-profissional')).status, 200);
    });
  } finally {
    await app?.close();
    // Remove only this run's fixtures; never truncate or target the development catalog.
    await prisma.product.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.user.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.productCategory.deleteMany({ where: { id: { startsWith: prefix } } });
    await prisma.$disconnect();
  }
});
