import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { AddressInfo } from 'node:net';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { StoreOrdersController } from '../src/modules/stores/store-orders.controller';
import { StoreOrdersService } from '../src/modules/stores/store-orders.service';

test('LOJA-020: rotas exigem lojista e recusam loja arbitrária', async () => {
  const calls: unknown[][] = [];
  const service = {
    list: async (...args: unknown[]) => { calls.push(['list', ...args]); return []; },
    get: async (...args: unknown[]) => { calls.push(['get', ...args]); return {}; },
    changeStatus: async (...args: unknown[]) => { calls.push(['status', ...args]); return {}; },
    upsertDelivery: async (...args: unknown[]) => { calls.push(['delivery', ...args]); return {}; },
    changeDeliveryStatus: async (...args: unknown[]) => { calls.push(['delivery-status', ...args]); return {}; },
  };
  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'store-orders-http-test' })],
    controllers: [StoreOrdersController],
    providers: [JwtAuthGuard, RolesGuard, { provide: StoreOrdersService, useValue: service }],
  }).compile();
  const app = module.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  await app.listen(0);
  const base = `http://127.0.0.1:${(app.getHttpServer().address() as AddressInfo).port}/api/store-orders`;
  const jwt = module.get(JwtService);
  const owner = jwt.sign({ id: 'owner-a', role: UserRole.LOJISTA });
  const client = jwt.sign({ id: 'client-a', role: UserRole.CLIENTE });
  const request = (path = '', method = 'GET', token?: string, body?: unknown) => fetch(`${base}${path}`, {
    method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  try {
    assert.equal((await request()).status, 401);
    assert.equal((await request('', 'GET', client)).status, 403);
    assert.equal((await request('?storeId=store-b', 'GET', owner)).status, 400);
    assert.equal((await request('?status=READY&from=2026-10-01T00%3A00%3A00Z', 'GET', owner)).status, 200);
    assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), ['list', 'owner-a', { status: 'READY', from: '2026-10-01T00:00:00Z' }]);
    assert.equal((await request('/order-a', 'GET', owner)).status, 200);
    assert.equal((await request('/order-a/status', 'PATCH', owner, { status: 'CONFIRMED', storeId: 'store-b' })).status, 400);
    assert.equal((await request('/order-a/status', 'PATCH', owner, { status: 'CONFIRMED' })).status, 200);
    assert.equal((await request('/order-a/delivery', 'PUT', owner, { estimatedDate: '2026-10-24T12:00:00Z' })).status, 200);
    assert.equal((await request('/order-a/delivery/status', 'PATCH', owner, { status: 'IN_TRANSIT' })).status, 200);
    assert.deepEqual(JSON.parse(JSON.stringify(calls.slice(1))), [
      ['get', 'owner-a', 'order-a'],
      ['status', 'owner-a', 'order-a', 'CONFIRMED'],
      ['delivery', 'owner-a', 'order-a', { estimatedDate: '2026-10-24T12:00:00Z' }],
      ['delivery-status', 'owner-a', 'order-a', 'IN_TRANSIT'],
    ]);
  } finally { await app.close(); }
});
