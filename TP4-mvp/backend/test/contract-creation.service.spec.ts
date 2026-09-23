import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApplicationStatus, ContractStatus, DirectRequestStatus, NotificationType, Prisma, ServiceAdStatus } from '@prisma/client';
import { ApplicationsService } from '../src/modules/applications/applications.service';
import { contractInclude } from '../src/modules/contracts/contract.include';
import { ContractCreationService } from '../src/modules/contracts/contract-creation.service';
import { ConversationsService } from '../src/modules/conversations/conversations.service';
import { DirectRequestsService } from '../src/modules/direct-requests/direct-requests.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

function fixture(options: {
  missing?: boolean;
  adStatus?: ServiceAdStatus;
  requestStatus?: DirectRequestStatus;
  proposedValue?: number | null;
  budget?: number | null;
  failAt?: string;
} = {}) {
  const startDate = new Date('2026-12-01T12:00:00Z');
  const budget = options.budget === undefined ? 200 : options.budget;
  const application = {
    id: 'application', adId: 'ad', professionalId: 'professional-profile',
    proposedValue: options.proposedValue === undefined ? 120 : options.proposedValue,
    professional: { userId: 'professional-user' },
    ad: {
      title: 'Reforma', description: 'Pintar a casa', startDate, budget,
      clientId: 'client-profile', client: { userId: 'client-user' },
      status: options.adStatus ?? ServiceAdStatus.OPEN,
    },
  };
  const request = {
    id: 'request', clientId: 'client-profile', professionalId: 'professional-profile',
    client: { userId: 'client-user' }, professional: { userId: 'professional-user' },
    status: options.requestStatus ?? DirectRequestStatus.SENT,
    title: 'Reforma', description: 'Pintar a casa', startDate, budget,
  };
  const calls: { operation: string; args: unknown }[] = [];
  const failure = new Error('Falha de persistencia');
  const result = { id: 'contract', conversations: [{ id: 'conversation' }] };
  const record = async (operation: string, args: unknown) => {
    calls.push({ operation, args });
    if (operation === options.failAt) throw failure;
  };
  let readArgs: Prisma.ContractFindUniqueOrThrowArgs | undefined;
  const tx = {
    application: {
      update: (args: unknown) => record('application.update', args),
      updateMany: (args: unknown) => record('application.updateMany', args),
    },
    serviceAd: { update: (args: unknown) => record('ad.update', args) },
    directRequest: { update: (args: unknown) => record('request.update', args) },
    contract: {
      create: async (args: unknown) => { await record('contract.create', args); return { id: 'contract' }; },
      findUniqueOrThrow: async (args: Prisma.ContractFindUniqueOrThrowArgs) => {
        readArgs = args;
        await record('contract.read', args);
        return result;
      },
    },
    contractStatusHistory: { create: (args: unknown) => record('history.create', args) },
    conversation: {
      create: (args: unknown) => record('conversation.create', args),
      updateMany: (args: unknown) => record('conversation.updateMany', args),
    },
    notification: { create: (args: unknown) => record('notification.create', args) },
  };
  let transactions = 0;
  let completed = false;
  // No root writes: every write must use the transaction client.
  const prisma = {
    application: { findUnique: async () => options.missing ? null : application },
    directRequest: { findUnique: async () => options.missing ? null : request },
    $transaction: async (work: (db: unknown) => Promise<unknown>) => {
      transactions++;
      const value = await work(tx);
      completed = true;
      return value;
    },
  } as unknown as PrismaService;
  const notifications = new NotificationsService(prisma);
  const conversations = new ConversationsService(prisma);
  const creation = new ContractCreationService(prisma, notifications, conversations);
  return {
    applications: new ApplicationsService(prisma, notifications, creation),
    requests: new DirectRequestsService(prisma, notifications, conversations, creation),
    calls, result, failure, startDate,
    args: (operation: string) => calls.find(call => call.operation === operation)?.args,
    transactions: () => transactions,
    completed: () => completed,
    readArgs: () => readArgs,
  };
}

describe('Fachada de contratacao', () => {
  it('aceita candidatura com contrato, historico, conversa e notificacao na mesma transacao', async () => {
    const f = fixture();
    assert.equal(await f.applications.accept('client-user', 'application'), f.result);
    assert.equal(f.transactions(), 1);
    assert.equal(f.completed(), true);
    assert.deepEqual(f.args('application.update'), {
      where: { id: 'application' }, data: { status: ApplicationStatus.ACCEPTED },
    });
    assert.deepEqual(f.args('application.updateMany'), {
      where: { adId: 'ad', id: { not: 'application' } }, data: { status: ApplicationStatus.REJECTED },
    });
    assert.deepEqual(f.args('ad.update'), {
      where: { id: 'ad' }, data: { status: ServiceAdStatus.CONTRACTED },
    });
    assert.deepEqual(f.args('contract.create'), { data: {
      clientId: 'client-profile', professionalId: 'professional-profile',
      adId: 'ad', applicationId: 'application', title: 'Reforma', description: 'Pintar a casa',
      agreedValue: 120, startDate: f.startDate, status: ContractStatus.PENDING_START,
    } });
    assert.deepEqual(f.args('history.create'), {
      data: { contractId: 'contract', toStatus: ContractStatus.PENDING_START },
    });
    assert.deepEqual(f.args('conversation.create'), { data: {
      clientUserId: 'client-user', professionalUserId: 'professional-user',
      contractId: 'contract', applicationId: 'application',
    } });
    assert.deepEqual(f.args('notification.create'), { data: {
      userId: 'professional-user', type: NotificationType.APPLICATION_ACCEPTED,
      title: 'Candidatura aceita', body: 'Sua candidatura para Reforma foi aceita.',
      data: { contractId: 'contract', applicationId: 'application' },
    } });
    assert.equal(f.args('conversation.updateMany'), undefined);
  });

  it('aceita solicitacao vinculando a conversa existente e notificando o cliente', async () => {
    const f = fixture();
    assert.equal(await f.requests.accept('professional-user', 'request'), f.result);
    assert.equal(f.transactions(), 1);
    assert.deepEqual(f.args('request.update'), {
      where: { id: 'request' }, data: { status: DirectRequestStatus.ACCEPTED },
    });
    assert.deepEqual(f.args('contract.create'), { data: {
      clientId: 'client-profile', professionalId: 'professional-profile', directRequestId: 'request',
      title: 'Reforma', description: 'Pintar a casa', agreedValue: 200,
      startDate: f.startDate, status: ContractStatus.PENDING_START,
    } });
    assert.deepEqual(f.args('history.create'), {
      data: { contractId: 'contract', toStatus: ContractStatus.PENDING_START },
    });
    assert.deepEqual(f.args('conversation.updateMany'), {
      where: { directRequestId: 'request' }, data: { contractId: 'contract' },
    });
    assert.equal(f.args('conversation.create'), undefined);
    assert.deepEqual(f.args('notification.create'), { data: {
      userId: 'client-user', type: NotificationType.DIRECT_REQUEST_ACCEPTED,
      title: 'Solicitacao aceita', body: 'Sua solicitacao Reforma foi aceita.',
      data: { directRequestId: 'request', contractId: 'contract' },
    } });
  });

  for (const [proposedValue, budget, expected] of [[null, 200, 200], [0, 200, 0], [null, null, null]]) {
    it(`preserva valor negociado: proposta=${proposedValue}, orcamento=${budget}`, async () => {
      const f = fixture({ proposedValue, budget });
      await f.applications.accept('client-user', 'application');
      const creation = f.args('contract.create') as { data: { agreedValue: number | null } };
      assert.equal(creation.data.agreedValue, expected);
    });
  }

  it('preserva o formato de consulta e os campos publicos de usuario nos dois aceites', async () => {
    const application = fixture();
    const request = fixture();
    await application.applications.accept('client-user', 'application');
    await request.requests.accept('professional-user', 'request');
    assert.deepEqual(application.readArgs(), request.readArgs());
    const include = application.readArgs()?.include;
    assert.equal(include, contractInclude);
    assert.equal(request.readArgs()?.include, contractInclude);
    assert.deepEqual(include?.statusHistory, { orderBy: { createdAt: 'desc' } });
    assert.equal(contractInclude.conversations.include.messages.take, 1);
    assert.deepEqual(contractInclude.conversations.include.messages.orderBy, { createdAt: 'desc' });
    assert.deepEqual(Object.keys(include ?? {}).sort(), [
      'ad', 'application', 'client', 'conversations', 'directRequest', 'professional', 'review', 'statusHistory',
    ]);
    assert.deepEqual(include?.client, {
      include: { user: { select: { id: true, name: true, phone: true, avatarUrl: true } } },
    });
  });

  for (const source of ['application', 'request'] as const) {
    for (const scenario of ['missing', 'outsider', 'closed'] as const) {
      it(`bloqueia ${source}: ${scenario}, sem iniciar transacao`, async () => {
        const f = fixture({
          missing: scenario === 'missing',
          adStatus: scenario === 'closed' ? ServiceAdStatus.CONTRACTED : ServiceAdStatus.OPEN,
          requestStatus: scenario === 'closed' ? DirectRequestStatus.ACCEPTED : DirectRequestStatus.SENT,
        });
        const user = scenario === 'outsider' ? 'outsider' : source === 'application' ? 'client-user' : 'professional-user';
        const action = source === 'application'
          ? f.applications.accept(user, 'application') : f.requests.accept(user, 'request');
        await assert.rejects(action, scenario === 'missing' ? NotFoundException :
          scenario === 'outsider' ? ForbiddenException : BadRequestException);
        assert.equal(f.transactions(), 0);
        assert.equal(f.calls.length, 0);
      });
    }

    for (const failAt of ['contract.create', 'history.create', source === 'application' ? 'conversation.create' : 'conversation.updateMany', 'notification.create']) {
      it(`propaga falha de ${failAt} no aceite de ${source} sem concluir a transacao`, async () => {
        const f = fixture({ failAt });
        const action = source === 'application'
          ? f.applications.accept('client-user', 'application')
          : f.requests.accept('professional-user', 'request');
        await assert.rejects(action, (error: unknown) => error === f.failure);
        assert.equal(f.completed(), false);
        assert.equal(f.calls[f.calls.length - 1]?.operation, failAt);
        assert.equal(f.args('contract.read'), undefined);
      });
    }
  }
});
