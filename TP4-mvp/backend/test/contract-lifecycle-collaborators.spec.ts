import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { ContractStatus } from '@prisma/client';
import { ContractStatusPolicyService } from '../src/modules/contracts/contract-status-policy.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { ConversationsService } from '../src/modules/conversations/conversations.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ContractsService com colaboradores extraidos', () => {
  function fixture(status: ContractStatus) {
    const contract = {
      id: 'contract', title: 'Reforma', status,
      clientId: 'client-profile', professionalId: 'professional-profile',
      client: { userId: 'client' }, professional: { userId: 'professional' }, review: null,
    };
    const history: unknown[] = [];
    const notifications: unknown[] = [];
    const review = { id: 'review', rating: 5 };
    let updates = 0;
    const tx = {
      contract: { update: async () => { updates++; return { ...contract, status: ContractStatus.COMPLETED }; } },
      contractStatusHistory: { create: async (args: unknown) => { history.push(args); } },
      notification: { create: async (args: unknown) => { notifications.push(args); } },
      review: { create: async () => review },
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
    };
  }

  for (const status of [ContractStatus.IN_PROGRESS, ContractStatus.WAITING_CLIENT_APPROVAL, ContractStatus.COMPLETED]) {
    it(`preserva avaliacao permitida em ${status} e notifica o profissional`, async () => {
      const f = fixture(status);
      assert.equal(await f.service.createReview('client', 'contract', { rating: 5 }), f.review);
      assert.equal(f.updates(), status === ContractStatus.COMPLETED ? 0 : 1);
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
    assert.deepEqual(f.history, [{ data: {
      contractId: 'contract', fromStatus: ContractStatus.IN_PROGRESS,
      toStatus: ContractStatus.COMPLETED, note: 'Concluido',
    } }]);
    assert.deepEqual(f.notifications, [{ data: {
      userId: 'professional', type: 'CONTRACT_STATUS_CHANGED', title: 'Status do contrato atualizado',
      body: 'Reforma mudou para COMPLETED.', data: { contractId: 'contract', status: ContractStatus.COMPLETED },
    } }]);
  });
});
