import { ContractStatus } from '@prisma/client';
import {
  BaseContractState,
  ContractActor,
  ContractState,
  ContractTransitionContext,
  ContractTransitionDeniedError,
} from './contract-state';

export class PendingStartContractState extends BaseContractState {
  readonly status = ContractStatus.PENDING_START;

  assertCanTransition({ actor, targetStatus }: ContractTransitionContext) {
    const professionalCanStart =
      actor === ContractActor.PROFESSIONAL && targetStatus === ContractStatus.IN_PROGRESS;
    const clientCanCancel =
      actor === ContractActor.CLIENT && targetStatus === ContractStatus.CANCELED;

    if (professionalCanStart || clientCanCancel) {
      return;
    }

    this.deny(actor);
  }
}

export class InProgressContractState extends BaseContractState {
  readonly status = ContractStatus.IN_PROGRESS;

  assertCanTransition({ actor, targetStatus }: ContractTransitionContext) {
    const professionalCanRequestApproval =
      actor === ContractActor.PROFESSIONAL &&
      targetStatus === ContractStatus.WAITING_CLIENT_APPROVAL;
    const clientCanComplete =
      actor === ContractActor.CLIENT && targetStatus === ContractStatus.COMPLETED;

    if (professionalCanRequestApproval || clientCanComplete) {
      return;
    }

    this.deny(actor);
  }
}

export class WaitingClientApprovalContractState extends BaseContractState {
  readonly status = ContractStatus.WAITING_CLIENT_APPROVAL;

  assertCanTransition({ actor, targetStatus }: ContractTransitionContext) {
    if (actor === ContractActor.CLIENT && targetStatus === ContractStatus.COMPLETED) {
      return;
    }

    this.deny(actor);
  }
}

export class CompletedContractState extends BaseContractState {
  readonly status = ContractStatus.COMPLETED;

  assertCanTransition({ actor, targetStatus, hasReview }: ContractTransitionContext) {
    if (targetStatus === ContractStatus.REOPENED && hasReview) {
      throw new ContractTransitionDeniedError('Servico avaliado nao pode ser reaberto.');
    }

    if (actor === ContractActor.CLIENT && targetStatus === ContractStatus.REOPENED) {
      return;
    }

    this.deny(actor);
  }
}

export class ReopenedContractState extends BaseContractState {
  readonly status = ContractStatus.REOPENED;

  assertCanTransition({ actor, targetStatus }: ContractTransitionContext) {
    if (
      actor === ContractActor.PROFESSIONAL &&
      targetStatus === ContractStatus.IN_PROGRESS
    ) {
      return;
    }

    this.deny(actor);
  }
}

export class CanceledContractState extends BaseContractState {
  readonly status = ContractStatus.CANCELED;

  assertCanTransition({ actor }: ContractTransitionContext) {
    this.deny(actor);
  }
}

export const contractStates: readonly ContractState[] = [
  new PendingStartContractState(),
  new InProgressContractState(),
  new WaitingClientApprovalContractState(),
  new CompletedContractState(),
  new ReopenedContractState(),
  new CanceledContractState(),
];
