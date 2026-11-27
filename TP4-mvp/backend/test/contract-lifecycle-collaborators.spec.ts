import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { ContractStatusPolicyService } from '../src/modules/contracts/contract-status-policy.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { ConversationsService } from '../src/modules/conversations/conversations.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ContractsService com colaboradores extraidos', () => {
  function fixture(status: ContractStatus, claimed = true) {
    const contract = {
      id: 'contract', title: 'Reforma', status,
      clientId: 'client-profile', professionalId: 'professional-profile',
      client: { userId: 'client' }, professional: { userId: 'professional' }, review: null,
    };
    const history: unknown[] = [];
    const notifications: unknown[] = [];
    const review = { id: 'review', rating: 5 };
    let updates = 0;
    let reviewCreated = false;
    let persistedStatus = status;
    const claims: unknown[] = [];
    const tx = {
      contract: {
        updateMany: async (args: { data: { status: ContractStatus } }) => {
          updates++;
          claims.push(args);
          if (claimed) persistedStatus = args.data.status;
          return { count: claimed ? 1 : 0 };
        },
        findUniqueOrThrow: async () => ({ ...contract, status: persistedStatus }),
      },
      contractStatusHistory: { create: async (args: unknown) => { history.push(args); } },
      notification: { create: async (args: unknown) => { notifications.push(args); } },
      review: { create: async () => { reviewCreated = true; return review; } },
    };
    const prisma = {
      contract: { findUnique: async () => contract },
      review: { aggregate: async () => ({ _avg: { rating: 5 }, _count: { rating: 1 } }) },
      professionalProfile: { update: async () => ({}) },
      notification: { create: async (args: unknown) => { notifications.push(args); } },
      $transaction: async (work: (db: unknown) => Promise<unknown>) => work(tx),
    } as unknown as PrismaService;
    return {
      service: new ContractsService(prisma, new ContractStatusPolicyService(),
        new NotificationsService(prisma), new ConversationsService(prisma)),
      prisma, history, notifications, review, updates: () => updates,
      claims, reviewCreated: () => reviewCreated,
    };
  }

  for (const status of [ContractStatus.IN_PROGRESS, ContractStatus.WAITING_CLIENT_APPROVAL, ContractStatus.COMPLETED]) {
    it(`preserva avaliacao permitida em ${status} e notifica o profissional`, async () => {
      const f = fixture(status);
      assert.equal(await f.service.createReview('client', 'contract', { rating: 5 }), f.review);
      assert.equal(f.updates(), 1);
      assert.deepEqual(f.claims, [{
        where: { id: 'contract', status, review: { is: null } },
        data: { status: ContractStatus.COMPLETED },
      }]);
      assert.equal(f.history.length, status === ContractStatus.COMPLETED ? 0 : 1);
      assert.deepEqual(f.notifications, [{ data: {
        userId: 'professional', type: 'REVIEW_RECEIVED', title: 'Nova avaliacao recebida',
        body: 'Voce recebeu uma avaliacao de 5 estrela(s).',
        data: { contractId: 'contract', reviewId: 'review' },
      } }]);
    });
  }

  it('mantem historico e notificacao de status na transacao da atualizacao', async () => {
    const f = fixture(ContractStatus.IN_PROGRESS);
    f.prisma.notification.create = () => { throw new Error('Gravacao fora da transacao'); };
    await f.service.updateStatus('client', 'contract', { status: ContractStatus.COMPLETED, note: 'Concluido' });
    assert.deepEqual(f.claims, [{
      where: { id: 'contract', status: ContractStatus.IN_PROGRESS },
      data: { status: ContractStatus.COMPLETED },
    }]);
    assert.deepEqual(f.history, [{ data: {
      contractId: 'contract', fromStatus: ContractStatus.IN_PROGRESS,
      toStatus: ContractStatus.COMPLETED, note: 'Concluido',
    } }]);
    assert.deepEqual(f.notifications, [{ data: {
      userId: 'professional', type: 'CONTRACT_STATUS_CHANGED', title: 'Status do contrato atualizado',
      body: 'Reforma mudou para COMPLETED.', data: { contractId: 'contract', status: ContractStatus.COMPLETED },
    } }]);
  });

  it('bloqueia atualizacao quando o estado mudou apos a leitura', async () => {
    const f = fixture(ContractStatus.IN_PROGRESS, false);
    await assert.rejects(
      f.service.updateStatus('client', 'contract', { status: ContractStatus.COMPLETED }),
      BadRequestException,
    );
    assert.equal(f.history.length, 0);
    assert.equal(f.notifications.length, 0);
  });

  it('bloqueia avaliacao quando o estado ou a avaliacao mudou apos a leitura', async () => {
    const f = fixture(ContractStatus.IN_PROGRESS, false);
    await assert.rejects(f.service.createReview('client', 'contract', { rating: 5 }), BadRequestException);
    assert.equal(f.reviewCreated(), false);
    assert.equal(f.history.length, 0);
    assert.equal(f.notifications.length, 0);
  });

  it('reabre somente contrato concluido que continua sem avaliacao', async () => {
    const f = fixture(ContractStatus.COMPLETED);
    const reopened = await f.service.updateStatus('client', 'contract', { status: ContractStatus.REOPENED });
    assert.equal(reopened.status, ContractStatus.REOPENED);
    assert.deepEqual(f.claims, [{
      where: { id: 'contract', status: ContractStatus.COMPLETED, review: { is: null } },
      data: { status: ContractStatus.REOPENED },
    }]);
  });
});
