import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, beforeEach, test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { ClientStoreReviewsController, OwnerStoreReviewsController, PublicStoreReviewsController } from '../src/modules/stores/store-reviews.controller';
import { StoreReviewsService } from '../src/modules/stores/store-reviews.service';
import { UpsertMyStoreDto } from '../src/modules/stores/dto/upsert-my-store.dto';

let app: NestExpressApplication;
let base: string;
let jwt: JwtService;
const calls: unknown[][] = [];
const result = {
  items: [{ id: 'review-a', storeId: 'store-a', rating: 5, comment: 'Otimo', customer: { name: 'Cliente A' } }],
  total: 1, page: 1, limit: 20,
  reputation: { averageRating: 5, reviewCount: 1, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 1 } },
};

before(async () => {
  const service = {
    create: async (...args: unknown[]) => { calls.push(['create', ...args]); return result.items[0]; },
    listMine: async (...args: unknown[]) => { calls.push(['mine', ...args]); return result; },
    listPublic: async (...args: unknown[]) => { calls.push(['public', ...args]); return result; },
  };
  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'store-reviews-http-test' })],
    controllers: [ClientStoreReviewsController, OwnerStoreReviewsController, PublicStoreReviewsController],
    providers: [JwtAuthGuard, RolesGuard, { provide: StoreReviewsService, useValue: service }],
  }).compile();
  app = module.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  base = `${await app.getUrl()}/api`;
  jwt = module.get(JwtService);
});
beforeEach(() => { calls.length = 0; });
after(async () => { await app?.close(); });

const token = (role: UserRole, id = 'actor-a') => jwt.sign({ id, role });
const request = (path: string, method = 'GET', auth?: string, body?: unknown) => fetch(`${base}${path}`, {
  method, headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
  body: body === undefined ? undefined : JSON.stringify(body),
});

test('LOJA-026 HTTP: only a CLIENTE can submit a review using the JWT author and route order', async () => {
  assert.equal((await request('/orders/order-a/review', 'POST', undefined, { rating: 5 })).status, 401);
  for (const role of [UserRole.LOJISTA, UserRole.PROFISSIONAL, UserRole.SUPORTE]) {
    assert.equal((await request('/orders/order-a/review', 'POST', token(role), { rating: 5 })).status, 403);
  }
  assert.equal(calls.length, 0);
  const response = await request('/orders/order-a/review', 'POST', token(UserRole.CLIENTE, 'customer-a'), { rating: 5, comment: 'Otimo' });
  assert.equal(response.status, 201);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [['create', 'customer-a', 'order-a', { rating: 5, comment: 'Otimo' }]]);
});

test('LOJA-026 HTTP: rejects invalid ratings, oversized comments and forged ownership fields', async () => {
  const client = token(UserRole.CLIENTE);
  for (const body of [
    {}, { rating: 0 }, { rating: 6 }, { rating: -1 }, { rating: 1.5 }, { rating: '5' }, { rating: null },
    { rating: [5] }, { rating: 5, comment: 1 }, { rating: 5, comment: 'a'.repeat(2001) },
    { rating: 5, storeId: 'store-b' }, { rating: 5, customerId: 'victim' }, { rating: 5, clientId: 'victim' },
    { rating: 5, orderId: 'other-order' }, { rating: 5, createdAt: '2020-01-01' },
  ]) {
    assert.equal((await request('/orders/order-a/review', 'POST', client, body)).status, 400, JSON.stringify(body).slice(0, 120));
  }
  assert.equal(calls.length, 0);
  for (const rating of [1, 5]) assert.equal((await request('/orders/order-a/review', 'POST', client, { rating })).status, 201);
  assert.equal(calls.length, 2);
});

test('LOJA-026 HTTP: public reads are unauthenticated and owner reads are protected and scoped by JWT', async () => {
  const publicRead = await request('/stores/store-a/reviews?page=2&limit=3');
  assert.equal(publicRead.status, 200);
  assert.deepEqual(await publicRead.json(), result);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['public', 'store-a', { page: 2, limit: 3 }]);
  assert.equal((await request('/stores/me/reviews')).status, 401);
  assert.equal((await request('/stores/me/reviews', 'GET', token(UserRole.CLIENTE))).status, 403);
  const ownerRead = await request('/stores/me/reviews', 'GET', token(UserRole.LOJISTA, 'owner-a'));
  assert.equal(ownerRead.status, 200);
  assert.deepEqual(await ownerRead.json(), result);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), ['mine', 'owner-a', { page: 1, limit: 20 }]);
});

test('LOJA-026 HTTP: validates pagination and forbids arbitrary store or customer scopes', async () => {
  for (const path of ['/stores/store-a/reviews', '/stores/me/reviews']) {
    const auth = path.includes('/me/') ? token(UserRole.LOJISTA) : undefined;
    for (const query of [
      'page=0', 'page=-1', 'page=1.5', 'page=NaN', 'page=Infinity', 'page=21474837', 'page=1&page=2', 'page[x]=1',
      'limit=0', 'limit=101', 'limit=1.5', 'limit=1e2', 'limit=20&limit=30', 'storeId=other', 'customerId=victim', 'rating=5',
    ]) assert.equal((await request(`${path}?${query}`, 'GET', auth)).status, 400, `${path}?${query}`);
    assert.equal((await request(`${path}?page=1&limit=100`, 'GET', auth)).status, 200);
  }
  assert.equal(calls.length, 2);
});

test('LOJA-026 HTTP: no role, including the store owner, has an edit or delete review route', async () => {
  for (const role of [UserRole.LOJISTA, UserRole.CLIENTE]) {
    for (const path of ['/stores/me/reviews/review-a', '/stores/store-a/reviews/review-a', '/orders/order-a/review']) {
      for (const method of ['PUT', 'PATCH', 'DELETE']) assert.equal((await request(path, method, token(role), { rating: 1 })).status, 404);
    }
  }
  assert.equal(calls.length, 0);
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  for (const body of [{ rating: 5 }, { reputation: { averageRating: 5 } }]) {
    await assert.rejects(pipe.transform(body, { type: 'body', metatype: UpsertMyStoreDto }), (error: any) => error.getStatus() === 400);
  }
});
