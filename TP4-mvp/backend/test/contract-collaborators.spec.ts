import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { NotificationType, Prisma } from '@prisma/client';
import { ConversationsService } from '../src/modules/conversations/conversations.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Colaboradores da contratacao', () => {
  const notification = {
    userId: 'professional',
    type: NotificationType.APPLICATION_ACCEPTED,
    title: 'Candidatura aceita',
    body: 'Aceita',
    data: { contractId: 'contract' },
  };
  const conversation = {
    clientUserId: 'client',
    professionalUserId: 'professional',
    contractId: 'contract',
    applicationId: 'application',
  };

  it('grava notificacao e conversa na transacao recebida, sem usar o cliente global', async () => {
    const prisma = {} as PrismaService;
    const writes: unknown[] = [];
    const tx = {
      notification: { create: async (args: unknown) => { writes.push(args); return notification; } },
      conversation: { create: async (args: unknown) => { writes.push(args); return conversation; } },
    } as unknown as Prisma.TransactionClient;

    assert.equal(await new NotificationsService(prisma).create(notification, tx), notification);
    assert.equal(await new ConversationsService(prisma).create(conversation, tx), conversation);
    assert.deepEqual(writes, [{ data: notification }, { data: conversation }]);
  });

  it('permite gravacao fora de uma transacao quando nao ha unidade de trabalho externa', async () => {
    const prisma = {
      notification: { create: async () => notification },
      conversation: { create: async () => conversation },
    } as unknown as PrismaService;
    assert.equal(await new NotificationsService(prisma).create(notification), notification);
    assert.equal(await new ConversationsService(prisma).create(conversation), conversation);
  });

  it('vincula as conversas existentes da solicitacao sem criar outra conversa', async () => {
    let update: unknown;
    const tx = {
      conversation: { updateMany: async (args: unknown) => { update = args; return { count: 1 }; } },
    } as unknown as Prisma.TransactionClient;
    await new ConversationsService({} as PrismaService)
      .attachDirectRequestToContract('request', 'contract', tx);
    assert.deepEqual(update, {
      where: { directRequestId: 'request' },
      data: { contractId: 'contract' },
    });
  });

  it('propaga falhas de notificacao para a transacao externa', async () => {
    const failure = new Error('Falha de persistencia');
    const tx = {
      notification: { create: async () => { throw failure; } },
    } as unknown as Prisma.TransactionClient;
    await assert.rejects(new NotificationsService({} as PrismaService).create(notification, tx),
      (error: unknown) => error === failure);
  });
});
