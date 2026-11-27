import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';
import { ContractStatus } from '@prisma/client';
import { ContractStatusPolicyService } from '../src/modules/contracts/contract-status-policy.service';
import {
  ContractActor,
  ContractTransitionDeniedError,
} from '../src/modules/contracts/states/contract-state';

const statuses = Object.values(ContractStatus);

const allowedTransitions = new Set([
  `${ContractStatus.PENDING_START}:${ContractActor.CLIENT}:${ContractStatus.CANCELED}`,
  `${ContractStatus.PENDING_START}:${ContractActor.PROFESSIONAL}:${ContractStatus.IN_PROGRESS}`,
  `${ContractStatus.IN_PROGRESS}:${ContractActor.CLIENT}:${ContractStatus.COMPLETED}`,
  `${ContractStatus.IN_PROGRESS}:${ContractActor.PROFESSIONAL}:${ContractStatus.WAITING_CLIENT_APPROVAL}`,
  `${ContractStatus.WAITING_CLIENT_APPROVAL}:${ContractActor.CLIENT}:${ContractStatus.COMPLETED}`,
  `${ContractStatus.COMPLETED}:${ContractActor.CLIENT}:${ContractStatus.REOPENED}`,
  `${ContractStatus.REOPENED}:${ContractActor.PROFESSIONAL}:${ContractStatus.IN_PROGRESS}`,
]);

describe('ContractStatusPolicyService', () => {
  const policy = new ContractStatusPolicyService();

  for (const currentStatus of statuses) {
    for (const actor of Object.values(ContractActor)) {
      for (const targetStatus of statuses) {
        const transitionKey = `${currentStatus}:${actor}:${targetStatus}`;
        const shouldAllow = allowedTransitions.has(transitionKey);

        it(`${shouldAllow ? 'permite' : 'bloqueia'} ${transitionKey}`, () => {
          const transition = () =>
            policy.assertCanTransition({
              currentStatus,
              targetStatus,
              actor,
              hasReview: false,
            });

          if (shouldAllow) {
            assert.doesNotThrow(transition);
            return;
          }

          assert.throws(transition, ContractTransitionDeniedError);
        });
      }
    }
  }

  it('bloqueia a reabertura de contrato avaliado', () => {
    assert.throws(
      () =>
        policy.assertCanTransition({
          currentStatus: ContractStatus.COMPLETED,
          targetStatus: ContractStatus.REOPENED,
          actor: ContractActor.CLIENT,
          hasReview: true,
        }),
      (error: unknown) =>
        error instanceof ContractTransitionDeniedError &&
        error.message === 'Servico avaliado nao pode ser reaberto.',
    );
  });

  it('possui uma politica para cada status do Prisma', () => {
    for (const currentStatus of statuses) {
      assert.throws(
        () =>
          policy.assertCanTransition({
            currentStatus,
            targetStatus: currentStatus,
            actor: ContractActor.CLIENT,
            hasReview: false,
          }),
        ContractTransitionDeniedError,
      );
    }
  });
});
