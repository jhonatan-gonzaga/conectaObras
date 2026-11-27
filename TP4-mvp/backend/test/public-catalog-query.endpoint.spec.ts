import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { PublicProductsController } from '../src/modules/products/public-products.controller';
import { PublicProductsService } from '../src/modules/products/public-products.service';
import { PublicStoresController } from '../src/modules/stores/public-stores.controller';
import { PublicStoresService } from '../src/modules/stores/public-stores.service';

let app: NestExpressApplication;
let baseUrl: string;
const echo = { list: async (query: unknown) => query };

before(async () => {
  const module = await Test.createTestingModule({
    controllers: [PublicProductsController, PublicStoresController],
    providers: [{ provide: PublicProductsService, useValue: echo }, { provide: PublicStoresService, useValue: echo }],
  }).compile();
  app = module.createNestApplication<NestExpressApplication>();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
});
after(async () => { await app?.close(); });

test('public filters normalize whitespace and parse false without Boolean string coercion', async () => {
  const response = await fetch(`${baseUrl}/products?q=%20cimento%20&storeId=%20a%20&categoryId=%20b%20&minPrice=0&maxPrice=99.90&inStock=false&onPromotion=true&page=2&limit=3`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { page: 2, limit: 3, q: 'cimento', storeId: 'a', categoryId: 'b', minPrice: '0', maxPrice: '99.90', inStock: false, onPromotion: true });
  const stores = await fetch(`${baseUrl}/stores?city=%20Manaus%20&neighborhood=%20Centro%20&openNow=false`);
  assert.deepEqual(await stores.json(), { page: 1, limit: 20, city: 'Manaus', neighborhood: 'Centro', openNow: false });
  for (const route of ['stores', 'products']) {
    const empty = await fetch(`${baseUrl}/${route}?q=%20&page=&limit=%20`);
    assert.equal(empty.status, 200);
    assert.deepEqual(await empty.json(), {});
  }
});

test('public catalog rejects invalid query types, duplicate values and excessive limits', async () => {
  const cases = [
    'page=0', 'page=-1', 'page=1.2', 'page=NaN', 'page=Infinity', 'page=9007199254740991',
    'limit=0', 'limit=101', 'limit=1e2', 'page=1&page=2', 'q[x]=abc', 'q=a&q=b', 'status=ACTIVE',
  ];
  for (const route of ['stores', 'products']) {
    for (const query of cases) assert.equal((await fetch(`${baseUrl}/${route}?${query}`)).status, 400, `${route}?${query}`);
  }
  for (const query of [
    'minPrice=-1', 'minPrice=NaN', 'maxPrice=Infinity', 'minPrice=1e2', 'minPrice=1.234',
    'maxPrice=100000000', 'inStock=1', 'inStock=FALSE', 'onPromotion=yes', 'storeId[]=a',
  ]) assert.equal((await fetch(`${baseUrl}/products?${query}`)).status, 400, query);
  assert.equal((await fetch(`${baseUrl}/stores?openNow=0`)).status, 400);
});
