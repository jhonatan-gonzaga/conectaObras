import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { MessageType, SupportTicketStatus, UserRole } from '@prisma/client';
import { SupportService } from '../src/modules/support/support.service';

const client = { id: 'client-a', email: 'client@example.com', role: UserRole.CLIENTE };
const agent = { id: 'agent-a', email: 'agent@example.com', role: UserRole.SUPORTE };
const ticket = { id: 'ticket-a', userId: client.id, status: SupportTicketStatus.OPEN, user: { phone: '92999999999' }, messages: [], auditLogs: [] };

function setup(overrides: Record<string, unknown> = {}) {
  const calls: unknown[][] = [];
  const tx = {
    supportTicket: {
      updateMany: async (input: unknown) => { calls.push(['updateMany', input]); return { count: 1 }; },
      findUniqueOrThrow: async () => ticket,
    },
    supportMessage: { create: async (input: unknown) => { calls.push(['message', input]); return { id: 'message-a' }; } },
    supportAuditLog: { create: async (input: unknown) => { calls.push(['audit', input]); return { id: 'audit-a' }; } },
  };
  const prisma = {
    supportTicket: { findUnique: async () => ticket },
    supportAuditLog: { create: tx.supportAuditLog.create },
    $transaction: async (arg: unknown) => typeof arg === 'function' ? (arg as (value: typeof tx) => Promise<unknown>)(tx) : Promise.all(arg as Promise<unknown>[]),
    ...overrides,
  };
  return { service: new SupportService(prisma as never), calls, tx };
}

test('only the owner or a support agent can read a ticket', async () => {
  const { service } = setup();
  assert.equal((await service.detail(client, ticket.id)).id, ticket.id);
  assert.equal((await service.detail(agent, ticket.id)).id, ticket.id);
  await assert.rejects(service.detail({ ...client, id: 'other-client' }, ticket.id), NotFoundException);
  const missing = setup({ supportTicket: { findUnique: async () => null } });
  await assert.rejects(missing.service.detail(agent, ticket.id), NotFoundException);
});

test('sending a message records an audit event and accepts only uploaded media URLs', async () => {
  const { service, calls } = setup();
  const origin = 'https://api.example.com';
  await service.sendMessage(client, ticket.id, { type: MessageType.TEXT, text: '  Preciso de ajuda  ' }, origin);
  assert.equal(calls[0][0], 'updateMany');
  assert.deepEqual((calls[1][1] as { data: { text: string } }).data.text, 'Preciso de ajuda');
  assert.equal((calls[2][1] as { data: { action: string } }).data.action, 'MESSAGE_SENT');
  await service.sendMessage(client, ticket.id, { type: MessageType.IMAGE, imageUrl: `${origin}/uploads/images/prova.png` }, origin);
  for (const imageUrl of ['https://evil.example/uploads/images/x.png', `${origin}/private/x.png`, `${origin}/uploads/images/x.png?token=1`]) {
    await assert.rejects(service.sendMessage(client, ticket.id, { type: MessageType.IMAGE, imageUrl }, origin), BadRequestException);
  }
});

test('status transitions are restricted, compare the previous state and record the actor', async () => {
  const { service, calls, tx } = setup();
  await service.changeStatus(agent.id, ticket.id, { status: SupportTicketStatus.IN_REVIEW, note: '  Em análise  ' });
  assert.equal((calls[1][1] as { data: { actorId: string; fromStatus: string; toStatus: string; note: string } }).data.actorId, agent.id);
  assert.equal((calls[1][1] as { data: { note: string } }).data.note, 'Em análise');
  await assert.rejects(service.changeStatus(agent.id, ticket.id, { status: SupportTicketStatus.RESOLVED }), ConflictException);
  tx.supportTicket.updateMany = async () => ({ count: 0 });
  await assert.rejects(service.changeStatus(agent.id, ticket.id, { status: SupportTicketStatus.IN_REVIEW }), ConflictException);
});

test('WhatsApp handoff requires a valid phone and leaves an audit trail', async () => {
  const { service, calls } = setup();
  assert.deepEqual(await service.transferToWhatsApp(agent.id, ticket.id), { url: 'https://wa.me/5592999999999' });
  assert.equal((calls[1][1] as { data: { action: string } }).data.action, 'WHATSAPP_HANDOFF');
  const noPhone = setup({ supportTicket: { findUnique: async () => ({ ...ticket, user: { phone: null } }) } });
  await assert.rejects(noPhone.service.transferToWhatsApp(agent.id, ticket.id), BadRequestException);
});
