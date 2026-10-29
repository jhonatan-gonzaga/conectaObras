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
import { ClientStoreOrdersController } from '../src/modules/stores/client-store-orders.controller';
import { StoreDashboardService } from '../src/modules/stores/store-dashboard.service';

test('LOJA-020: rotas exigem lojista e recusam loja arbitrária', async () => {
  const calls: unknown[][] = [];
  const service = {
    listClient: async (...args: unknown[]) => { calls.push(['client-list', ...args]); return { items: [], total: 0, page: 1, limit: 20 }; },
    getClient: async (...args: unknown[]) => { calls.push(['client-get', ...args]); return {}; },
    listPage: async (...args: unknown[]) => { calls.push(['page', ...args]); return { items: [], total: 0, page: 2, limit: 10 }; },
    list: async (...args: unknown[]) => { calls.push(['list', ...args]); return []; },
    get: async (...args: unknown[]) => { calls.push(['get', ...args]); return {}; },
    changeStatus: async (...args: unknown[]) => { calls.push(['status', ...args]); return {}; },
    upsertDelivery: async (...args: unknown[]) => { calls.push(['delivery', ...args]); return {}; },
    changeDeliveryStatus: async (...args: unknown[]) => { calls.push(['delivery-status', ...args]); return {}; },
  };
  const clientOrders: unknown[][] = [];
  const dashboard = { createClientOrder: async (...args: unknown[]) => { clientOrders.push(args); return { id: 'new-order' }; } };
  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'store-orders-http-test' })],
    controllers: [StoreOrdersController, ClientStoreOrdersController],
    providers: [JwtAuthGuard, RolesGuard, { provide: StoreOrdersService, useValue: service }, { provide: StoreDashboardService, useValue: dashboard }],
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
    const clientOrderBody = { items: [{ productId: 'product-a', quantity: 1 }], address: { street: 'Rua A', number: '1', neighborhood: 'Centro', city: 'Manaus', state: 'AM', zipCode: '69000000' } };
    const clientOrderUrl = base.replace(/store-orders$/, 'orders');
    assert.equal((await fetch(clientOrderUrl, { method: 'POST', headers: { authorization: `Bearer ${owner}`, 'content-type': 'application/json' }, body: JSON.stringify(clientOrderBody) })).status, 403);
    assert.equal((await fetch(clientOrderUrl, { method: 'POST', headers: { authorization: `Bearer ${client}`, 'content-type': 'application/json' }, body: JSON.stringify(clientOrderBody) })).status, 201);
    assert.equal(clientOrders.length, 1);
    assert.equal(clientOrders[0][0], 'client-a');
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
    const paginated = await request('?page=2&limit=10&status=READY', 'GET', owner);
    assert.equal(paginated.status, 200);
    assert.deepEqual(await paginated.json(), { items: [], total: 0, page: 2, limit: 10 });
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), ['page', 'owner-a', { page: 2, limit: 10, status: 'READY' }]);
    for (const query of ['page=0', 'page=1.5', 'page=1e2', 'page=21474837', 'limit=101', 'limit=-1', 'page=1&page=2', 'page[x]=1']) {
      assert.equal((await request(`?${query}`, 'GET', owner)).status, 400, query);
    }
    assert.equal((await fetch(clientOrderUrl)).status, 401);
    assert.equal((await fetch(clientOrderUrl, { headers: { authorization: `Bearer ${owner}` } })).status, 403);
    assert.equal((await fetch(`${clientOrderUrl}?group=OPEN&page=1`, { headers: { authorization: `Bearer ${client}` } })).status, 200);
    assert.deepEqual(JSON.parse(JSON.stringify(calls.at(-1))), ['client-list', 'client-a', { group: 'OPEN', page: 1 }]);
    assert.equal((await fetch(`${clientOrderUrl}/order-a`, { headers: { authorization: `Bearer ${client}` } })).status, 200);
    assert.deepEqual(calls.at(-1), ['client-get', 'client-a', 'order-a']);
    for (const query of ['customerId=victim', 'storeId=other', 'group=INVALID', 'limit=0']) {
      assert.equal((await fetch(`${clientOrderUrl}?${query}`, { headers: { authorization: `Bearer ${client}` } })).status, 400);
    }
  } finally { await app.close(); }
});
