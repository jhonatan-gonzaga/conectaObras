import 'reflect-metadata';
import { strict as assert } from 'node:assert';
import { after, before, beforeEach, test } from 'node:test';
import { ValidationPipe } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../src/modules/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { SupportAdminController, SupportController } from '../src/modules/support/support.controller';
import { SupportService } from '../src/modules/support/support.service';

let app: NestExpressApplication;
let base: string;
let jwt: JwtService;
const calls: unknown[][] = [];

before(async () => {
  const service = {
    createTicket: async (...args: unknown[]) => { calls.push(['create', ...args]); return { id: 'ticket-a' }; },
    findMine: async (...args: unknown[]) => { calls.push(['mine', ...args]); return []; },
    detail: async (...args: unknown[]) => { calls.push(['detail', ...args]); return { id: 'ticket-a' }; },
    sendMessage: async (...args: unknown[]) => { calls.push(['message', ...args]); return { id: 'message-a' }; },
    queue: async (...args: unknown[]) => { calls.push(['queue', ...args]); return { items: [], total: 0, page: 1, limit: 20 }; },
    changeStatus: async (...args: unknown[]) => { calls.push(['status', ...args]); return { id: 'ticket-a', status: 'IN_REVIEW' }; },
    transferToWhatsApp: async (...args: unknown[]) => { calls.push(['whatsapp', ...args]); return { url: 'https://wa.me/5592999999999' }; },
  };
  const module = await Test.createTestingModule({
    imports: [JwtModule.register({ secret: 'support-http-test' })],
    controllers: [SupportController, SupportAdminController],
    providers: [JwtAuthGuard, RolesGuard, { provide: SupportService, useValue: service }],
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

test('support queue, status and WhatsApp require SUPORTE', async () => {
  for (const [path, method, body] of [
    ['/support-tickets', 'GET', undefined],
    ['/support-tickets/ticket-a/status', 'PATCH', { status: 'IN_REVIEW' }],
    ['/support-tickets/ticket-a/whatsapp', 'POST', undefined],
  ] as const) {
    assert.equal((await request(path, method, undefined, body)).status, 401);
    for (const role of [UserRole.CLIENTE, UserRole.PROFISSIONAL, UserRole.LOJISTA]) {
      assert.equal((await request(path, method, token(role), body)).status, 403);
    }
    assert.equal((await request(path, method, token(UserRole.SUPORTE), body)).status, method === 'POST' ? 201 : 200);
  }
  assert.deepEqual(calls.map((call) => call[0]), ['queue', 'status', 'whatsapp']);
});

test('ticket messages use JWT identity and reject forged fields', async () => {
  const client = token(UserRole.CLIENTE, 'client-a');
  assert.equal((await request('/support-tickets/ticket-a/messages', 'POST', client, { type: 'TEXT', text: 'Olá', actorId: 'agent-a' })).status, 400);
  assert.equal((await request('/support-tickets/ticket-a/messages', 'POST', client, { type: 'TEXT', text: 'Olá' })).status, 201);
  assert.equal(calls[0][0], 'message');
  assert.equal((calls[0][1] as { id: string }).id, 'client-a');
  assert.equal((calls[0][1] as { role: UserRole }).role, UserRole.CLIENTE);
  assert.equal(calls[0][2], 'ticket-a');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0][3])), { type: 'TEXT', text: 'Olá' });
});

test('new tickets reject blank trimmed content', async () => {
  const client = token(UserRole.CLIENTE, 'client-a');
  assert.equal((await request('/support-tickets', 'POST', client, { subject: '   ', message: '          ' })).status, 400);
  assert.equal((await request('/support-tickets', 'POST', client, { subject: '  Ajuda  ', message: '  Preciso de ajuda  ' })).status, 201);
  assert.equal((calls[0][2] as { subject: string }).subject, 'Ajuda');
  assert.equal((calls[0][2] as { message: string }).message, 'Preciso de ajuda');
});

test('queue filters and status payloads are validated', async () => {
  const support = token(UserRole.SUPORTE);
  for (const query of ['status=OTHER', 'page=0', 'page=-1', 'limit=0', 'limit=51']) {
    assert.equal((await request(`/support-tickets?${query}`, 'GET', support)).status, 400, query);
  }
  for (const body of [{ status: 'UNKNOWN' }, { status: 'RESOLVED', actorId: 'other' }, { status: 'RESOLVED', note: 'x'.repeat(501) }]) {
    assert.equal((await request('/support-tickets/ticket-a/status', 'PATCH', support, body)).status, 400);
  }
  assert.equal(calls.length, 0);
});
