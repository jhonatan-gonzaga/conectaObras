import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { NestExpressApplication } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { StoreDashboardService } from '../src/modules/stores/store-dashboard.service';
import { StorePromotionsController } from '../src/modules/stores/store-promotions.controller';

const calls: Array<{ method: string; args: unknown[] }> = [];
const dashboard = {
  createPromotion: async (...args: unknown[]) => { calls.push({ method: 'create', args }); return { id: 'promotion-a' }; },
  listPromotions: async (...args: unknown[]) => { calls.push({ method: 'list', args }); return []; },
  updatePromotion: async (...args: unknown[]) => { calls.push({ method: 'update', args }); return { id: 'promotion-a' }; },
  setPromotionEnabled: async (...args: unknown[]) => { calls.push({ method: 'enabled', args }); return { enabled: false }; },
};

let app: NestExpressApplication;
let baseUrl: string;
let jwt: JwtService;

before(async () => {
  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'promotions-endpoint-test' })],
    controllers: [StorePromotionsController],
    providers: [JwtAuthGuard, RolesGuard, { provide: StoreDashboardService, useValue: dashboard }],
  }).compile();
  app = module.createNestApplication<NestExpressApplication>();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  jwt = module.get(JwtService);
});

after(async () => { await app?.close(); });

const token = (id: string, role: UserRole = UserRole.LOJISTA) => jwt.sign({ id, email: `${id}@example.com`, role });
const request = (path: string, bearer?: string, method = 'GET', body?: unknown) => fetch(`${baseUrl}/api/store-promotions${path}`, {
  method,
  headers: { ...(bearer ? { authorization: `Bearer ${bearer}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
  body: body ? JSON.stringify(body) : undefined,
});

test('promotion endpoints require lojista and derive owner only from JWT', async () => {
  assert.equal((await request('')).status, 401);
  assert.equal((await request('', token('client', UserRole.CLIENTE))).status, 403);
  assert.equal((await request('?status=CURRENT', token('owner-a'))).status, 200);
  assert.deepEqual(calls.at(-1), { method: 'list', args: ['owner-a', 'CURRENT'] });
  assert.equal((await request('?status=INVALID', token('owner-a'))).status, 400);
});

test('POST and PATCH validate UTC dates, terms and payload ownership', async () => {
  const bearer = token('owner-a');
  const body = { productId: 'product-a', promotionalPrice: 80, startAt: '2099-01-01T00:00:00.000Z', endAt: '2099-01-02T00:00:00.000Z' };
  assert.equal((await request('', bearer, 'POST', { ...body, ownerId: 'owner-b' })).status, 400);
  assert.equal((await request('', bearer, 'POST', { ...body, startAt: '2099-01-01T00:00:00-04:00' })).status, 400);
  assert.equal((await request('', bearer, 'POST', body)).status, 201);
  assert.equal(calls.at(-1)?.method, 'create');
  assert.equal(calls.at(-1)?.args[0], 'owner-a');
  assert.equal((calls.at(-1)?.args[1] as any).startAt.toISOString(), body.startAt);
  assert.equal((await request('/promotion-a', bearer, 'PATCH', { discountPercent: 10 })).status, 200);
  assert.deepEqual(calls.at(-1), { method: 'update', args: ['owner-a', 'promotion-a', { discountPercent: 10, startAt: undefined, endAt: undefined }] });
  assert.equal((await request('/promotion-a/enabled', bearer, 'PATCH', { enabled: false })).status, 200);
  assert.deepEqual(calls.at(-1), { method: 'enabled', args: ['owner-a', 'promotion-a', false] });
  assert.equal((await request('/promotion-a/enabled', bearer, 'PATCH', { enabled: 'false' })).status, 400);
});
