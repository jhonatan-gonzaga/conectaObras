import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { BadRequestException } from '@nestjs/common';
import { ContractStatus } from '@prisma/client';
import { ContractStatusPolicyService } from '../src/modules/contracts/contract-status-policy.service';
import { ContractsService } from '../src/modules/contracts/contracts.service';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { ConversationsService } from '../src/modules/conversations/conversations.service';
import { PrismaService } from '../src/prisma/prisma.service';

describe('ContractsService.createReview', () => {
  for (const status of [ContractStatus.PENDING_START, ContractStatus.REOPENED]) {
    it(`bloqueia avaliacao quando a transicao ${status} -> COMPLETED nao e permitida`, async () => {
      let transactionCalled = false;
      const prisma = {
        contract: {
          findUnique: async () => ({
            id: 'contract-1',
            title: 'Reforma',
            status,
            clientId: 'client-1',
            professionalId: 'professional-1',
            client: { userId: 'client-user-1' },
            professional: { userId: 'professional-user-1' },
            review: null,
          }),
        },
        $transaction: async () => {
          transactionCalled = true;
        },
      } as unknown as PrismaService;
      const service = new ContractsService(
        prisma,
        new ContractStatusPolicyService(),
        new NotificationsService(prisma),
        new ConversationsService(prisma),
      );

      await assert.rejects(
        service.createReview('client-user-1', 'contract-1', {
          rating: 5,
          comment: 'Otimo trabalho.',
        }),
        BadRequestException,
      );
      assert.equal(transactionCalled, false);
    });
  }
});
